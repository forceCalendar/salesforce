import { LightningElement, api } from 'lwc';
// We import the actual library from the npm package
import '@forcecalendar/interface';

export default class ForceCalendarLwc extends LightningElement {
    @api currentView = 'month';
    @api height = '800px';

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

        container.appendChild(this.calendarElement);
    }

    // Public API to allow external control via LWC
    @api
    addEvent(event) {
        if (this.calendarElement) {
            this.calendarElement.addEvent(event);
        }
    }

    @api
    setView(view) {
        if (this.calendarElement) {
            this.calendarElement.setView(view);
        }
    }
}