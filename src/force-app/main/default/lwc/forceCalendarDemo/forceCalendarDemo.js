import { LightningElement } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import FORCECALENDAR_LIB from '@salesforce/resourceUrl/forcecalendar';

export default class ForceCalendarDemo extends LightningElement {
    _libraryLoaded = false;
    _libraryLoadPromise;
    _calendarElement = null;
    _sampleEventsTimer;

    async connectedCallback() {
        if (!this._libraryLoaded) {
            try {
                // Reconnecting while the resource is pending shares one load.
                if (!this._libraryLoadPromise) {
                    this._libraryLoadPromise = loadScript(this, FORCECALENDAR_LIB);
                }
                await this._libraryLoadPromise;
                this._libraryLoaded = true;
            } catch (err) {
                console.error('Failed to load ForceCalendar library:', err);
            } finally {
                this._libraryLoadPromise = undefined;
            }
        }
        // Resolving loadScript does not itself schedule an LWC render.
        if (this.isConnected && this._libraryLoaded) {
            this._initCalendar();
        }
    }

    renderedCallback() {
        if (this._calendarElement || !this._libraryLoaded) {
            return;
        }
        this._initCalendar();
    }

    disconnectedCallback() {
        this._cancelSampleEvents();
        if (this._calendarElement) {
            const container = this.template.querySelector('.calendar-container');
            if (container && this._calendarElement.parentNode === container) {
                container.removeChild(this._calendarElement);
            }
            this._calendarElement = null;
        }
    }

    _initCalendar() {
        if (!this.isConnected || this._calendarElement) {
            return;
        }
        const container = this.template.querySelector('.calendar-container');
        if (!container) {
            return;
        }

        // Dynamic element name to bypass Salesforce static module analysis
        const tag = ['forcecal', 'main'].join('-');
        this._calendarElement = document.createElement(tag);
        this._calendarElement.setAttribute('view', 'month');
        this._calendarElement.setAttribute('height', '700px');

        this._calendarElement.addEventListener('calendar-date-select', (e) => {
            console.log('Date selected:', e.detail);
        });

        this._calendarElement.addEventListener('calendar-event-added', (e) => {
            console.log('Event added:', e.detail);
        });

        container.appendChild(this._calendarElement);

        this._scheduleSampleEvents();
    }

    _cancelSampleEvents() {
        if (this._sampleEventsTimer !== undefined) {
            clearTimeout(this._sampleEventsTimer);
            this._sampleEventsTimer = undefined;
        }
    }

    _scheduleSampleEvents() {
        this._cancelSampleEvents();
        const calendar = this._calendarElement;
        if (!this.isConnected || !calendar) {
            return;
        }
        // Keep the demo's short mount delay, with only one pending sample load.
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._sampleEventsTimer = setTimeout(() => {
            this._sampleEventsTimer = undefined;
            if (this.isConnected && this._calendarElement === calendar) {
                this._loadSampleEvents();
            }
        }, 100);
    }

    _generateSampleEvents() {
        const events = [];
        const today = new Date();
        const types = [
            { title: 'Team Meeting', color: '#0176D3' },
            { title: 'Project Review', color: '#9050E9' },
            { title: 'Client Call', color: '#04844B' },
            { title: 'Development Work', color: '#FF9A3C' },
            { title: 'Training Session', color: '#EA001E' }
        ];

        for (let i = 0; i < 15; i++) {
            const daysOffset = Math.floor(Math.random() * 60) - 30;
            const startDate = new Date(today);
            startDate.setDate(startDate.getDate() + daysOffset);

            const startHour = 8 + Math.floor(Math.random() * 10);
            startDate.setHours(startHour, Math.random() < 0.5 ? 0 : 30, 0, 0);

            const duration = 0.5 + Math.random() * 2;
            const endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);

            const eventType = types[Math.floor(Math.random() * types.length)];

            events.push({
                id: 'demo-event-' + i,
                title: eventType.title,
                start: startDate,
                end: endDate,
                allDay: Math.random() < 0.15,
                description: 'Sample event for demo',
                color: eventType.color
            });
        }

        return events;
    }

    _loadSampleEvents() {
        if (!this._calendarElement) {
            return;
        }
        const events = this._generateSampleEvents();
        this._calendarElement.setEvents(events);
        console.log('Loaded ' + events.length + ' sample events');
    }

    _clearEvents() {
        this._cancelSampleEvents();
        if (!this._calendarElement) {
            return;
        }
        this._calendarElement.setEvents([]);
    }

    handleAddEvent() {
        if (!this._calendarElement) {
            return;
        }
        this._calendarElement.addEvent({
            id: 'event-' + Date.now(),
            title: 'New Event',
            start: new Date(),
            end: new Date(Date.now() + 60 * 60 * 1000),
            allDay: false,
            description: 'New event added via demo',
            color: '#0176D3'
        });
    }

    handleClearEvents() {
        this._clearEvents();
    }

    handleLoadSampleEvents() {
        this._clearEvents();
        this._scheduleSampleEvents();
    }

    handleSetMonthView() {
        if (this._calendarElement) {
            this._calendarElement.setView('month');
        }
    }

    handleSetWeekView() {
        if (this._calendarElement) {
            this._calendarElement.setView('week');
        }
    }

    handleSetDayView() {
        if (this._calendarElement) {
            this._calendarElement.setView('day');
        }
    }
}
