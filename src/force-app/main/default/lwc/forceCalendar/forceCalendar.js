import { LightningElement, api, wire } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import FORCECALENDAR_LIB from '@salesforce/resourceUrl/forcecalendar';

import getEvents from '@salesforce/apex/ForceCalendarController.getEvents';
import createEvent from '@salesforce/apex/ForceCalendarController.createEvent';
import updateEvent from '@salesforce/apex/ForceCalendarController.updateEvent';
import deleteEvent from '@salesforce/apex/ForceCalendarController.deleteEvent';

export default class ForceCalendar extends LightningElement {
    @api currentView = 'month';
    @api height = '800px';
    @api recordId;
    @api readOnly = false;

    _libraryLoaded = false;
    _calendarElement = null;
    _isLoading = false;
    _error;
    _startDateTime;
    _endDateTime;
    _wiredEventResult;

    // --- Lifecycle ---

    async connectedCallback() {
        this._calculateDateRange();
        if (!this._libraryLoaded) {
            try {
                await loadScript(this, FORCECALENDAR_LIB);
                this._libraryLoaded = true;
            } catch (err) {
                this._error = 'Failed to load calendar library';
            }
        }
    }

    renderedCallback() {
        if (!this._libraryLoaded || this._calendarElement) {
            return;
        }
        this._initCalendar();
    }

    disconnectedCallback() {
        if (this._calendarElement) {
            const container = this.template.querySelector('.calendar-container');
            if (container && this._calendarElement.parentNode === container) {
                container.removeChild(this._calendarElement);
            }
            this._calendarElement = null;
        }
    }

    // --- Wire: fetch events from Apex ---

    @wire(getEvents, {
        startDateTime: '$_startDateTime',
        endDateTime: '$_endDateTime',
        recordId: '$recordId'
    })
    _wiredEvents(result) {
        this._wiredEventResult = result;
        const { error, data } = result;

        if (data) {
            this._isLoading = false;
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
        const container = this.template.querySelector('.calendar-container');
        if (!container) {
            return;
        }

        // Dynamic element name to bypass Salesforce static module analysis
        const tag = ['forcecal', 'main'].join('-');
        this._calendarElement = document.createElement(tag);
        this._calendarElement.setAttribute('view', this.currentView);
        this._calendarElement.setAttribute('height', this.height);

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
        if (!this._calendarElement) {
            return;
        }

        // Clear existing events
        const existing = this._calendarElement.getEvents
            ? this._calendarElement.getEvents()
            : [];
        if (existing && existing.length > 0) {
            existing.forEach(evt => {
                if (this._calendarElement.deleteEvent) {
                    this._calendarElement.deleteEvent(evt.id);
                }
            });
        }

        // Add all events from Salesforce
        data.forEach(event => {
            this._calendarElement.addEvent({
                id: event.id,
                title: event.title || 'Untitled Event',
                start: new Date(event.start),
                end: new Date(event.end),
                allDay: event.allDay || false,
                description: event.description || '',
                color: event.backgroundColor || '#0176D3'
            });
        });
    }

    // --- Date range calculation ---

    _calculateDateRange() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const date = now.getDate();

        let start, end;

        switch (this.currentView) {
            case 'week': {
                const day = now.getDay();
                start = new Date(year, month, date - day - 7);
                end = new Date(year, month, date + (6 - day) + 7);
                break;
            }
            case 'day':
                start = new Date(year, month, date - 1);
                end = new Date(year, month, date + 1);
                break;
            default:
                start = new Date(year, month - 1, 1);
                end = new Date(year, month + 2, 0);
        }

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        this._startDateTime = start.toISOString();
        this._endDateTime = end.toISOString();
    }

    _updateDateRangeForDate(targetDate, view) {
        const d = new Date(targetDate);
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
            this._calculateDateRange();
        }
    }

    _handleEventCreate(detail) {
        this._isLoading = true;
        const eventData = detail.event || detail;
        const startDt = eventData.start ? new Date(eventData.start) : new Date();
        const endDt = eventData.end
            ? new Date(eventData.end)
            : new Date(startDt.getTime() + 60 * 60 * 1000);

        createEvent({
            title: eventData.title || 'New Event',
            startDateTime: startDt.toISOString(),
            endDateTime: endDt.toISOString(),
            isAllDay: eventData.allDay || false,
            description: eventData.description || ''
        })
            .then(() => {
                this._showToast('Success', 'Event created', 'success');
                this.dispatchEvent(new CustomEvent('eventcreate', { detail: eventData }));
                return refreshApex(this._wiredEventResult);
            })
            .catch(error => {
                this._showToast('Error creating event', this._extractErrorMessage(error), 'error');
            })
            .finally(() => {
                this._isLoading = false;
            });
    }

    _handleEventUpdate(detail) {
        this._isLoading = true;
        const eventData = detail.event || detail;

        updateEvent({
            eventId: eventData.id,
            title: eventData.title,
            startDateTime: eventData.start ? new Date(eventData.start).toISOString() : null,
            endDateTime: eventData.end ? new Date(eventData.end).toISOString() : null,
            isAllDay: eventData.allDay,
            description: eventData.description
        })
            .then(() => {
                this._showToast('Success', 'Event updated', 'success');
                this.dispatchEvent(new CustomEvent('eventupdate', { detail: eventData }));
                return refreshApex(this._wiredEventResult);
            })
            .catch(error => {
                this._showToast('Error updating event', this._extractErrorMessage(error), 'error');
            })
            .finally(() => {
                this._isLoading = false;
            });
    }

    _handleEventDelete(detail) {
        this._isLoading = true;
        const eventId = detail.eventId || detail.id || (detail.event && detail.event.id);

        deleteEvent({ eventId })
            .then(() => {
                this._showToast('Success', 'Event deleted', 'success');
                this.dispatchEvent(new CustomEvent('eventdelete', { detail: { eventId } }));
                return refreshApex(this._wiredEventResult);
            })
            .catch(error => {
                this._showToast('Error deleting event', this._extractErrorMessage(error), 'error');
            })
            .finally(() => {
                this._isLoading = false;
            });
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
        if (this._calendarElement) {
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
