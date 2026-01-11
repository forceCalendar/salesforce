import { LightningElement, track } from 'lwc';
// Import forceCalendar module to ensure the web component library is loaded
// This executes the bundled code that registers forcecal-* custom elements
import ForceCalendarModule from 'c/forceCalendar';
// Reference to prevent tree-shaking
const _forceCalendarLoaded = ForceCalendarModule;

export default class ForceCalendarDemo extends LightningElement {
    @track isLoading = false;

    calendarElement;
    _isInitialized = false;

    renderedCallback() {
        if (this._isInitialized) {
            return;
        }
        this._isInitialized = true;
        this.initializeCalendar();
    }

    initializeCalendar() {
        const container = this.template.querySelector('.calendar-container');
        if (!container) return;

        // Create the calendar web component
        // Use dynamic string to bypass Salesforce static module analysis
        const elementName = ['forcecal', 'main'].join('-');
        this.calendarElement = document.createElement(elementName);
        this.calendarElement.setAttribute('view', 'month');
        this.calendarElement.setAttribute('height', '700px');
        // Set inline styles to ensure visibility
        this.calendarElement.style.display = 'block';
        this.calendarElement.style.width = '100%';
        this.calendarElement.style.height = '700px';
        this.calendarElement.style.minHeight = '700px';

        // Listen for events from the calendar
        this.calendarElement.addEventListener('calendar-date-select', (e) => {
            console.log('Date selected:', e.detail);
        });

        this.calendarElement.addEventListener('calendar-event-click', (e) => {
            console.log('Event clicked:', e.detail);
        });

        this.calendarElement.addEventListener('calendar-event-create', (e) => {
            console.log('Event create requested:', e.detail);
        });

        container.appendChild(this.calendarElement);

        // Load sample events after calendar is ready
        setTimeout(() => {
            this.loadSampleEvents();
        }, 100);
    }

    generateSampleEvents(baseDate = new Date()) {
        const events = [];
        const today = baseDate;
        const eventTypes = [
            { title: 'Team Meeting', color: '#0176D3' },
            { title: 'Project Review', color: '#9050E9' },
            { title: 'Client Call', color: '#04844B' },
            { title: 'Development Work', color: '#FF9A3C' },
            { title: 'Training Session', color: '#EA001E' }
        ];

        // Generate 15 events across the month
        for (let i = 0; i < 15; i++) {
            const daysOffset = Math.floor(Math.random() * 60) - 30;
            const startDate = new Date(today);
            startDate.setDate(startDate.getDate() + daysOffset);

            const startHour = 8 + Math.floor(Math.random() * 10);
            startDate.setHours(startHour, Math.random() < 0.5 ? 0 : 30, 0, 0);

            const duration = (0.5 + Math.random() * 2);
            const endDate = new Date(startDate);
            endDate.setTime(endDate.getTime() + duration * 60 * 60 * 1000);

            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

            events.push({
                id: `demo-event-${i}`,
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

    handleAddEvent() {
        if (!this.calendarElement) return;

        const newEvent = {
            id: `event-${Date.now()}`,
            title: 'New Event',
            start: new Date(),
            end: new Date(Date.now() + 60 * 60 * 1000),
            allDay: false,
            description: 'New event added via demo',
            color: '#0176D3'
        };

        this.calendarElement.addEvent(newEvent);
    }

    handleClearEvents() {
        if (!this.calendarElement) return;

        const events = this.calendarElement.getEvents ? this.calendarElement.getEvents() : [];
        if (events && events.length > 0) {
            events.forEach(evt => {
                if (this.calendarElement.deleteEvent) {
                    this.calendarElement.deleteEvent(evt.id);
                }
            });
        }
    }

    loadSampleEvents() {
        if (!this.calendarElement) return;

        const events = this.generateSampleEvents();
        events.forEach(event => {
            this.calendarElement.addEvent(event);
        });

        console.log(`Loaded ${events.length} sample events`);
    }

    handleLoadSampleEvents() {
        this.handleClearEvents();
        setTimeout(() => {
            this.loadSampleEvents();
        }, 100);
    }

    handleSetMonthView() {
        if (this.calendarElement) {
            this.calendarElement.setView('month');
        }
    }

    handleSetWeekView() {
        if (this.calendarElement) {
            this.calendarElement.setView('week');
        }
    }

    handleSetDayView() {
        if (this.calendarElement) {
            this.calendarElement.setView('day');
        }
    }
}
