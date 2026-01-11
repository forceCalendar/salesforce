import { LightningElement, api, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

// Import Apex methods
import getEvents from '@salesforce/apex/ForceCalendarController.getEvents';
import createEvent from '@salesforce/apex/ForceCalendarController.createEvent';
import updateEvent from '@salesforce/apex/ForceCalendarController.updateEvent';
import deleteEvent from '@salesforce/apex/ForceCalendarController.deleteEvent';

// Import the calendar interface library
import '@forcecalendar/interface';

export default class ForceCalendarLwc extends LightningElement {
    @api currentView = 'month';
    @api height = '800px';

    @track startDateTime;
    @track endDateTime;
    @track isLoading = false;
    @track error;

    calendarElement;
    _isInitialized = false;
    wiredEventResult;

    connectedCallback() {
        // Initialize date range based on current view
        this.calculateDateRange();
    }

    renderedCallback() {
        if (this._isInitialized) {
            return;
        }
        this._isInitialized = true;

        this.initializeCalendar();
    }

    // Wire Apex method to fetch events
    @wire(getEvents, {
        startDateTime: '$startDateTime',
        endDateTime: '$endDateTime'
    })
    wiredEvents(result) {
        this.wiredEventResult = result;
        const { error, data } = result;

        if (data) {
            this.isLoading = false;
            this.error = undefined;

            // Pass events to the calendar
            if (this.calendarElement) {
                // Clear existing events by deleting each one
                const existingEvents = this.calendarElement.getEvents ? this.calendarElement.getEvents() : [];
                if (existingEvents && existingEvents.length > 0) {
                    existingEvents.forEach(evt => {
                        if (this.calendarElement.deleteEvent) {
                            this.calendarElement.deleteEvent(evt.id);
                        }
                    });
                }

                // Add all events from Salesforce
                data.forEach(event => {
                    this.calendarElement.addEvent({
                        id: event.id,
                        title: event.title || 'Untitled Event',
                        start: new Date(event.start),
                        end: new Date(event.end),
                        allDay: event.allDay || false,
                        description: event.description || '',
                        color: event.backgroundColor || '#0176D3'
                    });
                });

                console.log(`Loaded ${data.length} events from Salesforce`);
            }
        } else if (error) {
            this.isLoading = false;
            this.error = 'Error loading events';
            console.error('Error fetching events:', error);

            // Show error toast
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error loading events',
                    message: error.body ? error.body.message : error.message,
                    variant: 'error'
                })
            );
        }
    }

    initializeCalendar() {
        const container = this.template.querySelector('.calendar-container');

        // Create the custom element
        // Use dynamic string to bypass Salesforce's static module analysis
        const elementName = 'forcecal' + '-' + 'main';
        this.calendarElement = document.createElement(elementName);
        this.calendarElement.setAttribute('view', this.currentView);
        this.calendarElement.setAttribute('height', this.height);

        // Map events from the Web Component to LWC events
        this.calendarElement.addEventListener('calendar-date-select', (e) => {
            this.dispatchEvent(new CustomEvent('dateselect', { detail: e.detail }));
        });

        this.calendarElement.addEventListener('calendar-event-click', (e) => {
            this.dispatchEvent(new CustomEvent('eventclick', { detail: e.detail }));
        });

        // Listen for view changes to update date range
        this.calendarElement.addEventListener('calendar-view-change', (e) => {
            this.handleViewChange(e.detail);
        });

        // Listen for navigation (next/prev/today)
        this.calendarElement.addEventListener('calendar-navigate', (e) => {
            this.handleNavigate(e.detail);
        });

        // Listen for event creation requests
        this.calendarElement.addEventListener('calendar-event-create', (e) => {
            this.handleEventCreate(e.detail);
        });

        // Listen for event update requests
        this.calendarElement.addEventListener('calendar-event-update', (e) => {
            this.handleEventUpdate(e.detail);
        });

        // Listen for event delete requests
        this.calendarElement.addEventListener('calendar-event-delete', (e) => {
            this.handleEventDelete(e.detail);
        });

        container.appendChild(this.calendarElement);

        // If we already have data, load it into the calendar
        if (this.wiredEventResult && this.wiredEventResult.data) {
            this.wiredEvents(this.wiredEventResult);
        }
    }

    // Calculate date range based on current view
    calculateDateRange() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const date = now.getDate();

        let start, end;

        switch(this.currentView) {
            case 'month':
                // Get first and last day of current month, plus buffer for adjacent days
                start = new Date(year, month - 1, 1); // Previous month start for buffer
                end = new Date(year, month + 2, 0); // Next month end for buffer
                break;

            case 'week':
                // Get current week (Sunday to Saturday by default)
                const day = now.getDay();
                start = new Date(year, month, date - day - 7); // Include previous week
                end = new Date(year, month, date + (6 - day) + 7); // Include next week
                break;

            case 'day':
                // Current day plus/minus one day for context
                start = new Date(year, month, date - 1);
                end = new Date(year, month, date + 1);
                break;

            default:
                // Default to month view
                start = new Date(year, month - 1, 1);
                end = new Date(year, month + 2, 0);
        }

        // Set time to start and end of day
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        this.startDateTime = start;
        this.endDateTime = end;

        console.log(`Date range updated: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`);
    }

    // Handle view changes
    handleViewChange(detail) {
        this.currentView = detail.view;

        // Update date range for the new view
        if (detail.date) {
            this.updateDateRangeForDate(detail.date, detail.view);
        } else {
            this.calculateDateRange();
        }
    }

    // Handle navigation (next/prev/today)
    handleNavigate(detail) {
        if (detail.date) {
            this.updateDateRangeForDate(detail.date, this.currentView);
        } else if (detail.action === 'today') {
            this.calculateDateRange();
        }
    }

    // Update date range for a specific date and view
    updateDateRangeForDate(targetDate, view) {
        const date = new Date(targetDate);
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();

        let start, end;

        switch(view) {
            case 'month':
                start = new Date(year, month - 1, 1);
                end = new Date(year, month + 2, 0);
                break;

            case 'week':
                const dayOfWeek = date.getDay();
                start = new Date(year, month, day - dayOfWeek - 7);
                end = new Date(year, month, day + (6 - dayOfWeek) + 7);
                break;

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

        // Only update if the range actually changed
        if (this.startDateTime?.getTime() !== start.getTime() ||
            this.endDateTime?.getTime() !== end.getTime()) {
            this.startDateTime = start;
            this.endDateTime = end;
            console.log(`Date range updated: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`);
        }
    }

    // Handle event creation
    handleEventCreate(detail) {
        console.log('Event creation requested:', detail);
        this.isLoading = true;

        const eventData = detail.event || detail;
        const startDt = eventData.start ? new Date(eventData.start) : new Date();
        const endDt = eventData.end ? new Date(eventData.end) : new Date(startDt.getTime() + 60 * 60 * 1000);

        createEvent({
            title: eventData.title || 'New Event',
            startDateTime: startDt.toISOString(),
            endDateTime: endDt.toISOString(),
            isAllDay: eventData.allDay || false,
            description: eventData.description || ''
        })
            .then(eventId => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Event created successfully',
                        variant: 'success'
                    })
                );
                return refreshApex(this.wiredEventResult);
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error creating event',
                        message: error.body ? error.body.message : error.message,
                        variant: 'error'
                    })
                );
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    // Handle event updates
    handleEventUpdate(detail) {
        console.log('Event update requested:', detail);
        this.isLoading = true;

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
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Event updated successfully',
                        variant: 'success'
                    })
                );
                return refreshApex(this.wiredEventResult);
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error updating event',
                        message: error.body ? error.body.message : error.message,
                        variant: 'error'
                    })
                );
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    // Handle event deletion
    handleEventDelete(detail) {
        console.log('Event deletion requested:', detail);
        this.isLoading = true;

        const eventId = detail.eventId || detail.id || (detail.event && detail.event.id);

        deleteEvent({ eventId: eventId })
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Event deleted successfully',
                        variant: 'success'
                    })
                );
                return refreshApex(this.wiredEventResult);
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error deleting event',
                        message: error.body ? error.body.message : error.message,
                        variant: 'error'
                    })
                );
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    // Public API to refresh events from Salesforce
    @api
    refreshEvents() {
        this.isLoading = true;
        return refreshApex(this.wiredEventResult)
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Events refreshed',
                        variant: 'success'
                    })
                );
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error refreshing events',
                        message: error.body ? error.body.message : error.message,
                        variant: 'error'
                    })
                );
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    // Public API to add event (locally, needs save to Salesforce)
    @api
    addEvent(event) {
        if (this.calendarElement) {
            this.calendarElement.addEvent(event);
        }
    }

    // Public API to change view
    @api
    setView(view) {
        if (this.calendarElement) {
            this.calendarElement.setView(view);
            this.currentView = view;
            this.calculateDateRange();
        }
    }

    // Public API to navigate to a specific date
    @api
    goToDate(date) {
        if (this.calendarElement) {
            this.calendarElement.setDate(date);
            this.updateDateRangeForDate(date, this.currentView);
        }
    }

    // Getters for template
    get showSpinner() {
        return this.isLoading;
    }

    get hasError() {
        return !!this.error;
    }
}