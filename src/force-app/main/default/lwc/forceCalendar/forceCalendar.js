import { LightningElement, api, wire } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import FORCECALENDAR_LIB from '@salesforce/resourceUrl/forcecalendar';

import getEvents from '@salesforce/apex/ForceCalendarController.getEvents';
import createEvent from '@salesforce/apex/ForceCalendarController.createCalendarEvent';
import updateEvent from '@salesforce/apex/ForceCalendarController.updateCalendarEvent';
import deleteEvent from '@salesforce/apex/ForceCalendarController.deleteEvent';

export default class ForceCalendar extends LightningElement {
    @api currentView = 'month';
    @api height = '800px';
    @api recordId = null;
    _readOnly = false;

    @api
    get readOnly() {
        return this._readOnly;
    }

    set readOnly(value) {
        this._readOnly = value === true || value === 'true';
        if (this._calendarElement) {
            this._calendarElement.readOnly = this._readOnly;
        }
    }

    _libraryLoaded = false;
    _libraryLoadPromise;
    _calendarElement = null;
    _isLoading = false;
    _error;
    _currentDate;
    _startDateTime;
    _endDateTime;
    _wiredEventResult;
    _serverEvents = [];
    _snapshotContext;
    _pendingWrites = [];
    _writeQueues = new Map();
    _createdIds = new Map();
    _queueKeys = new Map();
    _failedCreates = new Set();
    _connectionRevision = 0;

    // --- Lifecycle ---

    async connectedCallback() {
        this._calculateDateRange();
        if (!this._libraryLoaded) {
            try {
                // A quick detach/reconnect must not start a competing load.
                if (!this._libraryLoadPromise) {
                    this._libraryLoadPromise = loadScript(this, FORCECALENDAR_LIB);
                }
                await this._libraryLoadPromise;
                this._libraryLoaded = true;
            } catch (err) {
                this._error = 'Failed to load calendar library';
            } finally {
                this._libraryLoadPromise = undefined;
            }
        }
        // Loading a static resource does not itself schedule an LWC render.
        // The first renderedCallback may have run while loadScript was pending.
        if (this.isConnected && this._libraryLoaded) {
            this._initCalendar();
        }
    }

    renderedCallback() {
        if (!this._libraryLoaded || this._calendarElement) {
            return;
        }
        this._initCalendar();
    }

    disconnectedCallback() {
        this._connectionRevision += 1;
        if (this._calendarElement) {
            const container = this.template.querySelector('.calendar-container');
            if (container && this._calendarElement.parentNode === container) {
                container.removeChild(this._calendarElement);
            }
            this._calendarElement = null;
        }
    }

    // --- Wire: fetch events from Apex ---

    get recordContextId() {
        // Apex wires do not run when a parameter is undefined. App and Home
        // pages intentionally pass null to fetch the user's unfiltered events.
        return this.recordId || null;
    }

    @wire(getEvents, {
        startDateTime: '$_startDateTime',
        endDateTime: '$_endDateTime',
        recordId: '$recordContextId'
    })
    _wiredEvents(result) {
        this._wiredEventResult = result;
        const { error, data } = result;

        if (data) {
            this._isLoading = this._pendingWrites.length > 0;
            this._error = undefined;
            this._loadEventsIntoCalendar(data);
        } else if (error) {
            this._isLoading = false;
            this._error = 'Error loading events';
            this._showToast('Error loading events', this._extractErrorMessage(error), 'error');
        }
    }

    // --- Calendar initialization ---

    _initCalendar() {
        if (this._calendarElement) {
            return;
        }
        const container = this.template.querySelector('.calendar-container');
        if (!container) {
            return;
        }

        // Dynamic element name to bypass Salesforce static module analysis
        const tag = ['forcecal', 'main'].join('-');
        this._calendarElement = document.createElement(tag);
        this._calendarElement.setAttribute('view', this.currentView);
        if (this._currentDate) {
            this._calendarElement.setAttribute('date', this._currentDate.toISOString());
        }
        // Native platform look by default (SLDS token preset)
        this._calendarElement.setAttribute('theme', 'slds');
        // Standard Salesforce Event has no mapped persistent color field.
        this._calendarElement.setAttribute('show-color-picker', 'false');
        this._calendarElement.setAttribute('height', this.height);
        this._calendarElement.readOnly = this.readOnly;

        // Navigation events
        this._calendarElement.addEventListener('calendar-navigate', (e) => {
            this._handleNavigate(e.detail);
            this.dispatchEvent(new CustomEvent('navigate', { detail: e.detail }));
        });

        // View change events
        this._calendarElement.addEventListener('calendar-view-change', (e) => {
            this._handleViewChange(e.detail);
            this.dispatchEvent(new CustomEvent('viewchange', { detail: e.detail }));
        });

        // Date selection
        this._calendarElement.addEventListener('calendar-date-select', (e) => {
            this.dispatchEvent(new CustomEvent('dateselect', { detail: e.detail }));
        });

        // Event lifecycle: use the confirmed past-tense events from the interface
        this._calendarElement.addEventListener('calendar-event-added', (e) => {
            if (!this.readOnly) {
                this._handleEventCreate(e.detail);
            }
        });

        this._calendarElement.addEventListener('calendar-event-updated', (e) => {
            if (!this.readOnly) {
                this._handleEventUpdate(e.detail);
            }
        });

        this._calendarElement.addEventListener('calendar-event-deleted', (e) => {
            if (!this.readOnly) {
                this._handleEventDelete(e.detail);
            }
        });

        container.appendChild(this._calendarElement);

        // If wire data already arrived before the calendar was ready, load it now
        if (this._wiredEventResult && this._wiredEventResult.data) {
            this._loadEventsIntoCalendar(this._wiredEventResult.data);
        }
    }

    _loadEventsIntoCalendar(data) {
        this._snapshotContext = this._writeContext();
        // Apex results are snapshots, not user commands. addEvent/deleteEvent
        // emit lifecycle callbacks that would write the loaded records to Apex.
        this._serverEvents = data.map(event => ({
            id: event.id,
            title: event.title || 'Untitled Event',
            start: event.allDay ? this._civilDate(event.startDate || String(event.start).slice(0, 10)) : new Date(event.start),
            end: event.allDay ? this._civilDate(event.lastDay || String(event.end).slice(0, 10), true) : new Date(event.end),
            allDay: event.allDay || false,
            description: event.description || '',
            location: event.location || '',
            color: event.backgroundColor || '#0176D3',
            metadata: { forceCalendarRecurring: event.recurring === true }
        }));
        this._renderConfirmedAndPending();
    }

    _civilDate(value, endOfDay = false) {
        const [year, month, day] = String(value).split('-').map(Number);
        return new Date(year, month - 1, day, endOfDay ? 23 : 0,
            endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
    }

    _civilDateString(value) {
        const date = new Date(value);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    // --- Date range calculation ---

    _calculateDateRange() {
        this._updateDateRangeForDate(this._currentDate || new Date(), this.currentView);
    }

    _updateDateRangeForDate(targetDate, view) {
        const d = new Date(targetDate);
        this._currentDate = d;
        const year = d.getFullYear();
        const month = d.getMonth();
        const day = d.getDate();

        let start, end;

        switch (view) {
            case 'week': {
                const dow = d.getDay();
                start = new Date(year, month, day - dow - 7);
                end = new Date(year, month, day + (6 - dow) + 7);
                break;
            }
            case 'day':
                start = new Date(year, month, day - 1);
                end = new Date(year, month, day + 1);
                break;
            default:
                start = new Date(year, month - 1, 1);
                end = new Date(year, month + 2, 0);
        }

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        const newStart = start.toISOString();
        const newEnd = end.toISOString();

        if (this._startDateTime !== newStart || this._endDateTime !== newEnd) {
            this._startDateTime = newStart;
            this._endDateTime = newEnd;
        }
    }

    // --- Event handlers ---

    _handleViewChange(detail) {
        this.currentView = detail.view;
        if (detail.date) {
            this._updateDateRangeForDate(detail.date, detail.view);
        } else {
            this._calculateDateRange();
        }
    }

    _handleNavigate(detail) {
        if (detail.date) {
            this._updateDateRangeForDate(detail.date, this.currentView);
        } else if (detail.action === 'today') {
            this._updateDateRangeForDate(new Date(), this.currentView);
        }
    }

    _writeContext() {
        return JSON.stringify([this.recordId || null, this._startDateTime,
            this._endDateTime, this._connectionRevision]);
    }

    _renderConfirmedAndPending() {
        if (!this._calendarElement || this._snapshotContext !== this._writeContext()) return;
        const events = new Map(this._serverEvents.map(event => [event.id, event]));
        // Preserve newer optimistic changes while another request or wire refresh
        // settles. Snapshot replacement never emits a persistence command.
        for (const write of this._pendingWrites) {
            if (write.context !== this._snapshotContext) continue;
            const id = this._createdIds.get(write.key) || write.event.id;
            if (write.kind === 'delete') events.delete(id);
            else events.set(id, { ...write.event, id });
        }
        this._calendarElement.setEvents([...events.values()]);
    }

    _handleEventCreate(detail) {
        this._queueWrite('create', detail.event || detail);
    }

    _handleEventUpdate(detail) {
        this._queueWrite('update', detail.event || detail);
    }

    _handleEventDelete(detail) {
        this._queueWrite('delete', { id: detail.eventId || detail.id || detail.event?.id });
    }

    _queueWrite(kind, eventData) {
        if (this.readOnly) return;
        const event = { ...eventData };
        const context = this._writeContext();
        const eventKey = JSON.stringify([this.recordId || null, event.id]);
        const key = this._queueKeys.get(eventKey) || eventKey;
        const write = { kind, event, context, key, recordId: this.recordId || null };
        this._pendingWrites.push(write);
        this._isLoading = true;
        // Serialize writes to the same record. Otherwise an older server request
        // could finish last and overwrite a newer user edit. Other records remain
        // independent, and navigation never changes the write's record context.
        const previous = this._writeQueues.get(key) || Promise.resolve();
        const task = previous.then(() => this._persistWrite(write));
        this._writeQueues.set(key, task);
        task.finally(() => {
            if (this._writeQueues.get(key) === task) this._writeQueues.delete(key);
        });
    }

    async _persistWrite(write) {
        const { kind, event, key } = write;
        const verb = { create: 'creating', update: 'updating', delete: 'deleting' }[kind];
        let savedId;
        try {
            if (kind !== 'create' && this._failedCreates.has(key)) {
                throw new Error('This event was not created. Refresh and create it again.');
            }
            const id = this._createdIds.get(key) || event.id;
            if (kind === 'delete') {
                await deleteEvent({ eventId: id });
            } else {
                const start = event.start ? new Date(event.start) : new Date();
                const end = event.end ? new Date(event.end) : new Date(start.getTime() + 3600000);
                const values = {
                    title: kind === 'create' ? event.title || 'New Event' : event.title,
                    startDateTime: event.allDay ? null : (kind === 'create' || event.start ? start.toISOString() : null),
                    endDateTime: event.allDay ? null : (kind === 'create' || event.end ? end.toISOString() : null),
                    startDate: event.allDay ? this._civilDateString(start) : null,
                    lastDay: event.allDay ? this._civilDateString(end) : null,
                    isAllDay: kind === 'create' ? event.allDay || false : event.allDay,
                    description: kind === 'create' ? event.description || '' : event.description,
                    location: kind === 'create' ? event.location || '' : event.location
                };
                if (kind === 'create') {
                    savedId = await createEvent({ ...values, recordId: write.recordId });
                    this._createdIds.set(key, savedId);
                    this._queueKeys.set(JSON.stringify([write.recordId, savedId]), key);
                    this._failedCreates.delete(key);
                } else await updateEvent({ ...values, eventId: id });
            }
            if (write.context === this._writeContext() && this._snapshotContext === write.context) {
                const confirmedId = savedId || id;
                this._serverEvents = this._serverEvents.filter(value => value.id !== event.id && value.id !== confirmedId);
                if (kind !== 'delete') this._serverEvents.push({ ...event, id: confirmedId });
            }
            this._showToast('Success', `Event ${{ create: 'created', update: 'updated', delete: 'deleted' }[kind]}`, 'success');
            this.dispatchEvent(new CustomEvent(`event${kind}`, {
                detail: kind === 'delete' ? { eventId: id } : { ...event, id: savedId || id }
            }));
        } catch (error) {
            if (kind === 'create') this._failedCreates.add(key);
            this._showToast(`Error ${verb} event`, this._extractErrorMessage(error), 'error');
        } finally {
            this._pendingWrites = this._pendingWrites.filter(value => value !== write);
            this._renderConfirmedAndPending();
            this._isLoading = this._pendingWrites.length > 0;
        }
        // Refresh failures are distinct from write failures: a committed write
        // must not be reported as rejected, nor retried/duplicated automatically.
        if (this.isConnected && this._wiredEventResult) {
            try {
                await refreshApex(this._wiredEventResult);
            } catch (error) {
                this._showToast('Calendar refresh failed', this._extractErrorMessage(error), 'error');
            }
        }
    }

    // --- Public API ---

    @api
    refreshEvents() {
        this._isLoading = true;
        return refreshApex(this._wiredEventResult)
            .finally(() => {
                this._isLoading = false;
            });
    }

    @api
    addEvent(event) {
        if (this._calendarElement && !this.readOnly) {
            this._calendarElement.addEvent(event);
        }
    }

    @api
    setView(view) {
        if (this._calendarElement) {
            this._calendarElement.setView(view);
            this.currentView = view;
            this._calculateDateRange();
        }
    }

    @api
    goToDate(date) {
        if (this._calendarElement) {
            this._calendarElement.setDate(date);
            this._updateDateRangeForDate(date, this.currentView);
        }
    }

    // --- Template getters ---

    get showSpinner() {
        return this._isLoading;
    }

    get hasError() {
        return !!this._error;
    }

    get errorMessage() {
        return this._error;
    }

    // --- Utilities ---

    _showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    _extractErrorMessage(error) {
        if (error && error.body && error.body.message) {
            return error.body.message;
        }
        if (error && error.message) {
            return error.message;
        }
        return 'An unexpected error occurred';
    }
}
