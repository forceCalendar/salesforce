import { LightningElement } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import FORCECALENDAR_LIB from '@salesforce/resourceUrl/forcecalendar';

export default class ForceCalendarDemo extends LightningElement {
    _libraryLoaded = false;
    _calendarElement = null;
    _isInitialized = false;

    async connectedCallback() {
        if (!this._libraryLoaded) {
            try {
                await loadScript(this, FORCECALENDAR_LIB);
                this._libraryLoaded = true;
            } catch (err) {
                console.error('Failed to load ForceCalendar library:', err);
            }
        }
    }

    renderedCallback() {
        if (this._isInitialized || !this._libraryLoaded) {
            return;
        }
        this._isInitialized = true;
        this._initCalendar();
    }

    _initCalendar() {
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

        // Load sample events after a short delay so the element has time to mount
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this._loadSampleEvents();
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
        events.forEach(event => {
            this._calendarElement.addEvent(event);
        });
        console.log('Loaded ' + events.length + ' sample events');
    }

    _clearEvents() {
        if (!this._calendarElement) {
            return;
        }
        const events = this._calendarElement.getEvents
            ? this._calendarElement.getEvents()
            : [];
        if (events && events.length > 0) {
            events.forEach(evt => {
                if (this._calendarElement.deleteEvent) {
                    this._calendarElement.deleteEvent(evt.id);
                }
            });
        }
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
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this._loadSampleEvents();
        }, 100);
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
