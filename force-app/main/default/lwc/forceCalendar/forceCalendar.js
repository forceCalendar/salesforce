import { LightningElement, api, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

// Import Apex methods
import getEvents from '@salesforce/apex/ForceCalendarController.getEvents';

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
                // Clear existing events first (if method exists)
                if (typeof this.calendarElement.clearEvents === 'function') {
                    this.calendarElement.clearEvents();
                } else if (typeof this.calendarElement.removeAllEvents === 'function') {
                    this.calendarElement.removeAllEvents();
                } else {
                    // If no clear method, set events array directly
                    this.calendarElement.events = [];
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
                        backgroundColor: event.backgroundColor || '#0176D3',
                        borderColor: event.backgroundColor || '#0176D3'
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
        this.calendarElement = document.createElement('force-calendar');
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

    // Handle event creation (placeholder - needs Apex method)
    handleEventCreate(detail) {
        console.log('Event creation requested:', detail);

        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Event Creation',
                message: 'Event creation not yet implemented. Add createEvent Apex method.',
                variant: 'info'
            })
        );
    }

    // Handle event updates (placeholder - needs Apex method)
    handleEventUpdate(detail) {
        console.log('Event update requested:', detail);

        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Event Update',
                message: 'Event update not yet implemented. Add updateEvent Apex method.',
                variant: 'info'
            })
        );
    }

    // Handle event deletion (placeholder - needs Apex method)
    handleEventDelete(detail) {
        console.log('Event deletion requested:', detail);

        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Event Deletion',
                message: 'Event deletion not yet implemented. Add deleteEvent Apex method.',
                variant: 'info'
            })
        );
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
            this.calendarElement.goToDate(date);
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