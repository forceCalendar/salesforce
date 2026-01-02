/**
 * ForceCalendar LWC - Bundled Version
 * NO NPM REQUIRED - Just deploy and use!
 *
 * This version has the calendar libraries embedded directly
 * so Salesforce developers can deploy without any npm setup
 */

import { LightningElement, api, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getEvents from '@salesforce/apex/ForceCalendarController.getEvents';

export default class ForceCalendarLwc extends LightningElement {
    @api currentView = 'month';
    @api height = '800px';

    @track startDateTime;
    @track endDateTime;
    @track isLoading = true;
    @track error;
    @track libraryLoaded = false;

    calendarElement;
    _isInitialized = false;
    wiredEventResult;

    connectedCallback() {
        // Initialize date range
        this.calculateDateRange();
        // Load the calendar library
        this.loadCalendarLibrary();
    }

    /**
     * Load calendar library from CDN
     * This approach requires no npm installation
     */
    async loadCalendarLibrary() {
        try {
            // Option 1: Load from CDN (requires CSP trusted site setup)
            // For production, you'd host these files as Static Resources

            // For now, we'll inject the minimal calendar implementation
            // In production, this would load from Static Resource or CDN

            // Check if already loaded
            if (window.customElements.get('force-calendar')) {
                this.libraryLoaded = true;
                this.isLoading = false;
                return;
            }

            // Create a minimal calendar web component inline
            // This is a simplified version - in production, load the full library
            class ForceCalendarElement extends HTMLElement {
                constructor() {
                    super();
                    this.attachShadow({ mode: 'open' });
                    this.events = [];
                }

                connectedCallback() {
                    this.render();
                }

                set view(value) {
                    this.setAttribute('view', value);
                    this.render();
                }

                get view() {
                    return this.getAttribute('view') || 'month';
                }

                addEvent(event) {
                    this.events.push(event);
                    this.render();
                }

                clearEvents() {
                    this.events = [];
                }

                removeAllEvents() {
                    this.events = [];
                }

                setView(view) {
                    this.view = view;
                }

                goToDate(date) {
                    // Navigate to date
                    this.dispatchEvent(new CustomEvent('calendar-navigate', {
                        detail: { date }
                    }));
                }

                render() {
                    // Simplified rendering - in production, use full @forcecalendar/interface
                    this.shadowRoot.innerHTML = `
                        <style>
                            :host {
                                display: block;
                                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                            }
                            .calendar-header {
                                padding: 1rem;
                                background: #f3f3f3;
                                border-bottom: 1px solid #ddd;
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                            }
                            .calendar-body {
                                padding: 1rem;
                                min-height: 400px;
                                background: white;
                            }
                            .calendar-grid {
                                display: grid;
                                grid-template-columns: repeat(7, 1fr);
                                gap: 1px;
                                background: #ddd;
                                border: 1px solid #ddd;
                            }
                            .calendar-cell {
                                background: white;
                                min-height: 80px;
                                padding: 4px;
                                position: relative;
                            }
                            .calendar-day {
                                font-weight: bold;
                                margin-bottom: 4px;
                            }
                            .event {
                                background: #0176d3;
                                color: white;
                                padding: 2px 4px;
                                margin: 1px 0;
                                border-radius: 3px;
                                font-size: 11px;
                                cursor: pointer;
                                overflow: hidden;
                                text-overflow: ellipsis;
                                white-space: nowrap;
                            }
                            .view-buttons {
                                display: flex;
                                gap: 0.5rem;
                            }
                            button {
                                padding: 0.5rem 1rem;
                                border: 1px solid #ddd;
                                background: white;
                                cursor: pointer;
                                border-radius: 4px;
                            }
                            button:hover {
                                background: #f0f0f0;
                            }
                            button.active {
                                background: #0176d3;
                                color: white;
                            }
                        </style>
                        <div class="calendar-header">
                            <div class="nav-buttons">
                                <button id="prev">Previous</button>
                                <button id="today">Today</button>
                                <button id="next">Next</button>
                            </div>
                            <div class="current-date">
                                ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </div>
                            <div class="view-buttons">
                                <button class="${this.view === 'month' ? 'active' : ''}" data-view="month">Month</button>
                                <button class="${this.view === 'week' ? 'active' : ''}" data-view="week">Week</button>
                                <button class="${this.view === 'day' ? 'active' : ''}" data-view="day">Day</button>
                            </div>
                        </div>
                        <div class="calendar-body">
                            ${this.renderView()}
                        </div>
                    `;

                    // Add event listeners
                    this.shadowRoot.getElementById('prev')?.addEventListener('click', () => {
                        this.dispatchEvent(new CustomEvent('calendar-navigate', {
                            detail: { action: 'prev' }
                        }));
                    });

                    this.shadowRoot.getElementById('next')?.addEventListener('click', () => {
                        this.dispatchEvent(new CustomEvent('calendar-navigate', {
                            detail: { action: 'next' }
                        }));
                    });

                    this.shadowRoot.getElementById('today')?.addEventListener('click', () => {
                        this.dispatchEvent(new CustomEvent('calendar-navigate', {
                            detail: { action: 'today' }
                        }));
                    });

                    this.shadowRoot.querySelectorAll('[data-view]').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const newView = e.target.dataset.view;
                            this.view = newView;
                            this.dispatchEvent(new CustomEvent('calendar-view-change', {
                                detail: { view: newView }
                            }));
                        });
                    });
                }

                renderView() {
                    if (this.view === 'month') {
                        return this.renderMonthView();
                    } else if (this.view === 'week') {
                        return this.renderWeekView();
                    } else {
                        return this.renderDayView();
                    }
                }

                renderMonthView() {
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const today = new Date();
                    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

                    let html = '<div class="calendar-grid">';

                    // Day headers
                    days.forEach(day => {
                        html += `<div class="calendar-cell" style="background: #f9f9f9; font-weight: bold; padding: 8px;">${day}</div>`;
                    });

                    // Empty cells before first day
                    for (let i = 0; i < firstDay.getDay(); i++) {
                        html += '<div class="calendar-cell"></div>';
                    }

                    // Days of month with events
                    for (let day = 1; day <= lastDay.getDate(); day++) {
                        const cellDate = new Date(today.getFullYear(), today.getMonth(), day);
                        const dayEvents = this.getEventsForDate(cellDate);

                        html += '<div class="calendar-cell">';
                        html += `<div class="calendar-day">${day}</div>`;

                        dayEvents.slice(0, 3).forEach(event => {
                            html += `<div class="event" title="${event.title}">${event.title}</div>`;
                        });

                        if (dayEvents.length > 3) {
                            html += `<div style="font-size: 10px; color: #666;">+${dayEvents.length - 3} more</div>`;
                        }

                        html += '</div>';
                    }

                    html += '</div>';
                    return html;
                }

                renderWeekView() {
                    return '<div style="padding: 2rem; text-align: center;">Week View<br><br>' +
                           `Showing ${this.events.length} events this week</div>`;
                }

                renderDayView() {
                    const todayEvents = this.getEventsForDate(new Date());
                    return '<div style="padding: 2rem;">' +
                           '<h3>Today\'s Events</h3>' +
                           (todayEvents.length > 0
                            ? todayEvents.map(e => `<div class="event" style="margin: 0.5rem 0;">${e.title}</div>`).join('')
                            : '<p>No events today</p>') +
                           '</div>';
                }

                getEventsForDate(date) {
                    return this.events.filter(event => {
                        const eventDate = new Date(event.start);
                        return eventDate.toDateString() === date.toDateString();
                    });
                }
            }

            // Register the custom element
            customElements.define('force-calendar', ForceCalendarElement);

            this.libraryLoaded = true;
            this.isLoading = false;
            console.log('Calendar library loaded (simplified version)');

        } catch (error) {
            console.error('Error loading calendar library:', error);
            this.error = 'Failed to load calendar library';
            this.isLoading = false;
        }
    }

    renderedCallback() {
        if (this._isInitialized || !this.libraryLoaded) {
            return;
        }
        this._isInitialized = true;
        this.initializeCalendar();
    }

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

            if (this.calendarElement) {
                if (typeof this.calendarElement.clearEvents === 'function') {
                    this.calendarElement.clearEvents();
                } else if (typeof this.calendarElement.removeAllEvents === 'function') {
                    this.calendarElement.removeAllEvents();
                } else {
                    this.calendarElement.events = [];
                }

                data.forEach(event => {
                    this.calendarElement.addEvent({
                        id: event.id,
                        title: event.title || 'Untitled Event',
                        start: new Date(event.start),
                        end: new Date(event.end),
                        allDay: event.allDay || false,
                        description: event.description || '',
                        backgroundColor: event.backgroundColor || '#0176D3'
                    });
                });

                console.log(`Loaded ${data.length} events from Salesforce`);
            }
        } else if (error) {
            this.isLoading = false;
            this.error = 'Error loading events';
            console.error('Error fetching events:', error);
        }
    }

    initializeCalendar() {
        const container = this.template.querySelector('.calendar-container');

        this.calendarElement = document.createElement('force-calendar');
        this.calendarElement.setAttribute('view', this.currentView);
        this.calendarElement.style.height = this.height;

        this.calendarElement.addEventListener('calendar-view-change', (e) => {
            this.handleViewChange(e.detail);
        });

        this.calendarElement.addEventListener('calendar-navigate', (e) => {
            this.handleNavigate(e.detail);
        });

        container.appendChild(this.calendarElement);

        if (this.wiredEventResult && this.wiredEventResult.data) {
            this.wiredEvents(this.wiredEventResult);
        }
    }

    calculateDateRange() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const date = now.getDate();

        let start, end;

        switch(this.currentView) {
            case 'month':
                start = new Date(year, month - 1, 1);
                end = new Date(year, month + 2, 0);
                break;
            case 'week':
                const day = now.getDay();
                start = new Date(year, month, date - day - 7);
                end = new Date(year, month, date + (6 - day) + 7);
                break;
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

        this.startDateTime = start;
        this.endDateTime = end;
    }

    handleViewChange(detail) {
        this.currentView = detail.view;
        this.calculateDateRange();
    }

    handleNavigate(detail) {
        this.calculateDateRange();
    }

    @api
    refreshEvents() {
        this.isLoading = true;
        return refreshApex(this.wiredEventResult);
    }

    get showSpinner() {
        return this.isLoading;
    }

    get hasError() {
        return !!this.error;
    }
}