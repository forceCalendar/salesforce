import { createElement } from 'lwc';
import { readFileSync } from 'fs';
import path from 'path';
import ForceCalendar from 'c/forceCalendar';
import { loadScript } from 'lightning/platformResourceLoader';
import { refreshApex } from '@salesforce/apex';
import getEvents from '@salesforce/apex/ForceCalendarController.getEvents';
import createEvent from '@salesforce/apex/ForceCalendarController.createCalendarEvent';
import updateEvent from '@salesforce/apex/ForceCalendarController.updateCalendarEvent';
import deleteEvent from '@salesforce/apex/ForceCalendarController.deleteEvent';

jest.mock('@salesforce/apex', () => ({ refreshApex: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ForceCalendarController.getEvents', () => {
    const { createApexTestWireAdapter } = require('@salesforce/wire-service-jest-util');
    return { default: createApexTestWireAdapter(jest.fn()) };
}, { virtual: true });
jest.mock('@salesforce/apex/ForceCalendarController.createCalendarEvent', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ForceCalendarController.updateCalendarEvent', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ForceCalendarController.deleteEvent', () => ({ default: jest.fn() }), { virtual: true });

const flush = async () => {
    // Wire updates, asynchronous script loading and LWC render callbacks.
    for (let i = 0; i < 6; i++) await Promise.resolve();
};
const fixture = (overrides = {}) => ({
    id: '00U000000000001AAA',
    title: 'Salesforce event',
    start: '2026-10-02T10:00:00.000Z',
    end: '2026-10-02T11:00:00.000Z',
    allDay: false,
    description: 'A server snapshot',
    location: 'Room 201',
    backgroundColor: '#0176D3',
    ...overrides
});
const calendarOf = element => element.shadowRoot.querySelector('forcecal-main');
const expectNoWrites = () => {
    expect(createEvent).not.toHaveBeenCalled();
    expect(updateEvent).not.toHaveBeenCalled();
    expect(deleteEvent).not.toHaveBeenCalled();
};
async function mount(properties = {}) {
    const element = createElement('c-force-calendar', { is: ForceCalendar });
    Object.assign(element, properties);
    document.body.appendChild(element);
    await flush();
    return element;
}

beforeAll(() => {
    // Exercise the deployable IIFE and real custom element, never a fake
    // addEvent/deleteEvent implementation that could hide feedback writes.
    const bundle = readFileSync(path.resolve(process.cwd(), '../dist/force-app/main/default/staticresources/forcecalendar.js'), 'utf8');
    window.eval(bundle);
});

beforeEach(() => {
    jest.clearAllMocks();
    loadScript.mockResolvedValue(undefined);
    refreshApex.mockResolvedValue(undefined);
    createEvent.mockResolvedValue('00U000000000002AAA');
    updateEvent.mockResolvedValue(undefined);
    deleteEvent.mockResolvedValue(undefined);
});

afterEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

test('cold script loading mounts once after the initial LWC render', async () => {
    let resolveScript;
    loadScript.mockImplementationOnce(() => new Promise(resolve => { resolveScript = resolve; }));
    const element = await mount();
    expect(calendarOf(element)).toBeNull();
    getEvents.emit([fixture()]);
    await flush();
    resolveScript();
    await flush();
    expect(element.shadowRoot.querySelectorAll('forcecal-main')).toHaveLength(1);
    expect(calendarOf(element).getEvents()).toHaveLength(1);
    expectNoWrites();
});

test('App/Home pages send null record context and record-page changes update the wire', async () => {
    const element = await mount();
    expect(getEvents.getLastConfig()).toEqual(expect.objectContaining({ recordId: null }));
    element.recordId = '003000000000001AAA';
    await flush();
    expect(getEvents.getLastConfig().recordId).toBe('003000000000001AAA');
    element.recordId = undefined;
    await flush();
    expect(getEvents.getLastConfig().recordId).toBeNull();
    expectNoWrites();
});

test('loads, repeats, replaces and clears wire snapshots with zero CRUD calls in writable mode', async () => {
    const element = await mount({ readOnly: false });
    const calendar = calendarOf(element);
    expect(typeof calendar.setEvents).toBe('function');
    const added = jest.fn();
    const updated = jest.fn();
    const deleted = jest.fn();
    calendar.addEventListener('calendar-event-added', added);
    calendar.addEventListener('calendar-event-updated', updated);
    calendar.addEventListener('calendar-event-deleted', deleted);

    getEvents.emit([fixture()]);
    await flush();
    expect(calendar.getEvents()).toHaveLength(1);
    expect(calendar.getEvents()[0].location).toBe('Room 201');
    getEvents.emit([fixture()]);
    await flush();
    getEvents.emit([fixture({ title: 'Refreshed', location: 'Room 202' }), fixture({ id: '00U000000000002AAA' })]);
    await flush();
    expect(calendar.getEvents()).toHaveLength(2);
    expect(calendar.getEvents().find(event => event.id === fixture().id).location).toBe('Room 202');
    getEvents.emit([fixture({ id: '00U000000000002AAA' })]);
    await flush();
    expect(calendar.getEvents()).toHaveLength(1);
    getEvents.emit([]);
    await flush();
    expect(calendar.getEvents()).toHaveLength(0);
    expect(added).not.toHaveBeenCalled();
    expect(updated).not.toHaveBeenCalled();
    expect(deleted).not.toHaveBeenCalled();
    expectNoWrites();
});

test('refresh, navigation and view changes do not persist snapshots', async () => {
    const element = await mount();
    getEvents.emit([fixture()]);
    await flush();
    await element.refreshEvents();
    expect(refreshApex).toHaveBeenCalledTimes(1);
    getEvents.emit([fixture({ location: 'Refreshed room' })]);
    await flush();
    element.goToDate('2026-11-15T12:00:00.000Z');
    await flush();
    getEvents.emit([fixture({ start: '2026-11-15T10:00:00Z', end: '2026-11-15T11:00:00Z' })]);
    await flush();
    element.setView('week');
    await flush();
    const range = getEvents.getLastConfig();
    expect(new Date(range.startDateTime).getMonth()).toBe(10);
    expect(new Date(range.endDateTime).getMonth()).toBe(10);
    getEvents.emit([fixture()]);
    await flush();
    calendarOf(element).shadowRoot.querySelector('[data-action="next"]').click();
    await flush();
    getEvents.emit([]);
    await flush();
    expectNoWrites();
});

test('user create persists once with Location and record-page association, then hydrates without feedback', async () => {
    const element = await mount({ recordId: '003000000000001AAA' });
    getEvents.emit([]);
    await flush();
    element.addEvent(fixture({ id: 'local-new' }));
    await flush();
    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Salesforce event', location: 'Room 201', recordId: '003000000000001AAA'
    }));
    expect(refreshApex).toHaveBeenCalledTimes(1);
    getEvents.emit([fixture({ id: '00U000000000002AAA' })]);
    await flush();
    expect(calendarOf(element).getEvents().map(event => event.id)).toEqual(['00U000000000002AAA']);
    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(updateEvent).not.toHaveBeenCalled();
    expect(deleteEvent).not.toHaveBeenCalled();
});

test('user update and delete persist once each and retain Location', async () => {
    const element = await mount();
    getEvents.emit([fixture()]);
    await flush();
    const calendar = calendarOf(element);
    calendar.updateEvent(fixture().id, { title: 'Edited', location: 'New room' });
    await flush();
    expect(updateEvent).toHaveBeenCalledTimes(1);
    expect(updateEvent).toHaveBeenCalledWith(expect.objectContaining({ eventId: fixture().id, title: 'Edited', location: 'New room' }));
    getEvents.emit([fixture({ title: 'Edited', location: 'New room' })]);
    await flush();
    calendar.deleteEvent(fixture().id);
    await flush();
    expect(deleteEvent).toHaveBeenCalledTimes(1);
    expect(deleteEvent).toHaveBeenCalledWith({ eventId: fixture().id });
    getEvents.emit([]);
    await flush();
    expect(createEvent).not.toHaveBeenCalled();
    expect(updateEvent).toHaveBeenCalledTimes(1);
    expect(deleteEvent).toHaveBeenCalledTimes(1);
});

test('readOnly blocks public create and persistence callbacks and forwards dynamic changes', async () => {
    const element = await mount({ readOnly: true });
    getEvents.emit([fixture()]);
    await flush();
    const calendar = calendarOf(element);
    expect(calendar.readOnly).toBe(true);
    element.addEvent(fixture({ id: 'blocked' }));
    expect(calendar.getEvents()).toHaveLength(1);
    for (const kind of ['added', 'updated', 'deleted']) {
        calendar.dispatchEvent(new CustomEvent(`calendar-event-${kind}`, { detail: { event: fixture() } }));
    }
    await flush();
    expectNoWrites();
    element.readOnly = false;
    await flush();
    expect(calendar.readOnly).toBe(false);
    element.addEvent(fixture({ id: 'allowed' }));
    await flush();
    expect(createEvent).toHaveBeenCalledTimes(1);
});

test('disconnect before load resolution does not create a detached calendar; reconnect mounts once', async () => {
    let resolveScript;
    loadScript.mockImplementationOnce(() => new Promise(resolve => { resolveScript = resolve; }));
    const element = await mount();
    document.body.removeChild(element);
    resolveScript();
    await flush();
    expect(calendarOf(element)).toBeNull();
    document.body.appendChild(element);
    await flush();
    expect(element.shadowRoot.querySelectorAll('forcecal-main')).toHaveLength(1);
    getEvents.emit([fixture()]);
    await flush();
    expectNoWrites();
});

test('multiple calendars initialize independently and read their shared snapshots without writes', async () => {
    const first = await mount();
    const second = await mount();
    getEvents.emit([fixture()]);
    await flush();
    expect(calendarOf(first)).not.toBe(calendarOf(second));
    expect(calendarOf(first).getEvents()).toHaveLength(1);
    expect(calendarOf(second).getEvents()).toHaveLength(1);
    expectNoWrites();
});

// Run automatically for interface 1.8+; the override permits testing a local
// release candidate without pointing dependency locks at unpublished code.
const interfaceVersion = JSON.parse(readFileSync(path.resolve(process.cwd(), 'node_modules/@forcecalendar/interface/package.json'), 'utf8')).version;
const [interfaceMajor, interfaceMinor] = interfaceVersion.split('.').map(Number);
const requiresReadOnlyUI = interfaceMajor > 1 || (interfaceMajor === 1 && interfaceMinor >= 8);
(requiresReadOnlyUI || process.env.FORCECALENDAR_READONLY_UI === '1' ? test : test.skip)(
    'readOnly disables real editing controls and cancels open forms while navigation stays usable',
    async () => {
        const element = await mount({ readOnly: true });
        getEvents.emit([fixture()]);
        await flush();
        const calendar = calendarOf(element);
        expect(calendar.shadowRoot.querySelector('#create-event-btn').disabled).toBe(true);
        const modal = calendar.shadowRoot.querySelector('#event-modal');
        calendar.shadowRoot.dispatchEvent(new CustomEvent('day-click', { detail: { date: new Date() } }));
        expect(modal.hasAttribute('open')).toBe(false);
        modal.dispatchEvent(new CustomEvent('save', { detail: fixture({ id: 'blocked-form' }) }));
        await flush();
        expectNoWrites();
        expect(calendar.getEvents()).toHaveLength(1);
        element.setView('week');
        await flush();
        expect(calendar.shadowRoot.querySelectorAll('.fc-resize-handle')).toHaveLength(0);
        const next = calendar.shadowRoot.querySelector('[data-action="next"]');
        expect(next.disabled).toBe(false);
        next.click();
        await flush();
        expectNoWrites();
        element.readOnly = false;
        await flush();
        expect(calendar.shadowRoot.querySelector('#create-event-btn').disabled).toBe(false);
        calendar.shadowRoot.querySelector('#create-event-btn').click();
        expect(calendar.shadowRoot.querySelector('#event-modal').hasAttribute('open')).toBe(true);
        element.readOnly = true;
        await flush();
        expect(calendar.shadowRoot.querySelector('#event-modal').hasAttribute('open')).toBe(false);
        expectNoWrites();
    }
);

test('reconnect while the resource is pending reuses the same load and mounts once', async () => {
    let resolveScript;
    loadScript.mockImplementation(() => new Promise(resolve => { resolveScript = resolve; }));
    const element = await mount();
    document.body.removeChild(element);
    document.body.appendChild(element);
    await flush();
    expect(loadScript).toHaveBeenCalledTimes(1);
    expect(calendarOf(element)).toBeNull();
    resolveScript();
    await flush();
    expect(element.shadowRoot.querySelectorAll('forcecal-main')).toHaveLength(1);
    getEvents.emit([fixture()]);
    await flush();
    expectNoWrites();
});

const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};

test.each(['update', 'delete', 'create'])('rejected %s restores confirmed snapshot without feedback writes', async kind => {
    const element = await mount();
    getEvents.emit([fixture()]);
    await flush();
    const calendar = calendarOf(element);
    const request = deferred();
    ({ update: updateEvent, delete: deleteEvent, create: createEvent })[kind].mockReturnValueOnce(request.promise);
    if (kind === 'update') calendar.updateEvent(fixture().id, { title: 'Rejected' });
    if (kind === 'delete') calendar.deleteEvent(fixture().id);
    if (kind === 'create') element.addEvent(fixture({ id: 'rejected-new', title: 'Rejected' }));
    await flush();
    request.reject(new Error('Access denied'));
    await flush();
    expect(calendar.getEvents().map(event => [event.id, event.title])).toEqual([[fixture().id, fixture().title]]);
    expect(refreshApex).toHaveBeenCalledTimes(1);
    expect(createEvent).toHaveBeenCalledTimes(kind === 'create' ? 1 : 0);
    expect(updateEvent).toHaveBeenCalledTimes(kind === 'update' ? 1 : 0);
    expect(deleteEvent).toHaveBeenCalledTimes(kind === 'delete' ? 1 : 0);
});

test('failed earlier edit preserves a queued newer edit and serializes server writes', async () => {
    const element = await mount(); getEvents.emit([fixture()]); await flush();
    const calendar = calendarOf(element), first = deferred(), second = deferred();
    updateEvent.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    calendar.updateEvent(fixture().id, { title: 'First' }); await flush();
    calendar.updateEvent(fixture().id, { title: 'Second' }); await flush();
    expect(updateEvent).toHaveBeenCalledTimes(1);
    getEvents.emit([fixture()]); await flush();
    expect(calendar.getEvents()[0].title).toBe('Second');
    first.reject(new Error('First rejected')); await flush(); await flush();
    expect(calendar.getEvents()[0].title).toBe('Second');
    expect(updateEvent).toHaveBeenCalledTimes(2);
    second.resolve(); await flush();
    expect(calendar.getEvents()[0].title).toBe('Second');
    expect(createEvent).not.toHaveBeenCalled(); expect(deleteEvent).not.toHaveBeenCalled();
});

test('one rejected record does not erase another pending edit or a refreshed server record', async () => {
    const secondId = '00U000000000003AAA';
    const element = await mount(); getEvents.emit([fixture(), fixture({ id: secondId })]); await flush();
    const calendar = calendarOf(element), first = deferred(), second = deferred();
    updateEvent.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    calendar.updateEvent(fixture().id, { title: 'Rejected' });
    calendar.updateEvent(secondId, { title: 'Keep pending' }); await flush();
    getEvents.emit([fixture({ location: 'Fresh server room' }), fixture({ id: secondId })]); await flush();
    first.reject(new Error('Rejected')); await flush();
    expect(calendar.getEvents().find(event => event.id === fixture().id).location).toBe('Fresh server room');
    expect(calendar.getEvents().find(event => event.id === secondId).title).toBe('Keep pending');
    second.resolve(); await flush();
});

test('write rejection after navigation does not restore the old visible range', async () => {
    const element = await mount(); getEvents.emit([fixture()]); await flush();
    const calendar = calendarOf(element), request = deferred(); updateEvent.mockReturnValueOnce(request.promise);
    calendar.updateEvent(fixture().id, { title: 'Rejected' }); await flush();
    element.goToDate('2027-04-15T12:00:00Z'); await flush();
    const newer = fixture({ id: '00U000000000009AAA', title: 'New range', start: '2027-04-15T10:00:00Z', end: '2027-04-15T11:00:00Z' });
    getEvents.emit([newer]); await flush();
    request.reject(new Error('Old range failed')); await flush();
    expect(calendar.getEvents().map(event => event.id)).toEqual([newer.id]);
    expect(new Date(getEvents.getLastConfig().startDateTime).getFullYear()).toBe(2027);
});

test('refresh failure after successful create keeps server ID and never retries the write', async () => {
    const element = await mount(); getEvents.emit([]); await flush();
    const toasts = []; element.addEventListener('lightning__showtoast', event => toasts.push(event.detail));
    refreshApex.mockRejectedValueOnce(new Error('Offline during refresh'));
    element.addEvent(fixture({ id: 'local-new' })); await flush(); await flush();
    expect(calendarOf(element).getEvents().map(event => event.id)).toEqual(['00U000000000002AAA']);
    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(toasts.some(toast => toast.title === 'Calendar refresh failed')).toBe(true);
    expect(toasts.some(toast => toast.title === 'Error creating event')).toBe(false);
});

test('edit queued behind create uses its returned Salesforce ID', async () => {
    const element = await mount(); getEvents.emit([]); await flush();
    const request = deferred(); createEvent.mockReturnValueOnce(request.promise);
    element.addEvent(fixture({ id: 'local-new' })); await flush();
    calendarOf(element).updateEvent('local-new', { title: 'Edited before save' }); await flush();
    expect(updateEvent).not.toHaveBeenCalled();
    request.resolve('00U000000000002AAA'); await flush(); await flush();
    expect(updateEvent).toHaveBeenCalledWith(expect.objectContaining({ eventId: '00U000000000002AAA', title: 'Edited before save' }));
    expect(calendarOf(element).getEvents().map(event => [event.id, event.title])).toEqual([['00U000000000002AAA', 'Edited before save']]);
});

test('new server ID retains the same queue as edits already queued under its temporary ID', async () => {
    const element = await mount(); getEvents.emit([]); await flush();
    const creating = deferred(), oldEdit = deferred(), newEdit = deferred();
    createEvent.mockReturnValueOnce(creating.promise);
    updateEvent.mockReturnValueOnce(oldEdit.promise).mockReturnValueOnce(newEdit.promise);
    element.addEvent(fixture({ id: 'temp' })); await flush();
    const calendar = calendarOf(element);
    calendar.updateEvent('temp', { title: 'Older queued edit' }); await flush();
    creating.resolve('00U000000000002AAA'); await flush(); await flush();
    expect(updateEvent).toHaveBeenCalledTimes(1);
    calendar.updateEvent('00U000000000002AAA', { title: 'Newest edit' }); await flush();
    expect(updateEvent).toHaveBeenCalledTimes(1);
    oldEdit.resolve(); await flush(); await flush();
    expect(updateEvent).toHaveBeenCalledTimes(2);
    expect(calendar.getEvents()[0].title).toBe('Newest edit');
    newEdit.resolve(); await flush();
    expect(calendar.getEvents()[0].title).toBe('Newest edit');
});

// These end-to-end UI contracts require the candidate details/edit/delete UI.
// Run with FORCECALENDAR_DETAILS_UI=1 until its dependency version is released.
(interfaceMajor > 1 || (interfaceMajor === 1 && interfaceMinor >= 9) || process.env.FORCECALENDAR_DETAILS_UI === '1' ? test : test.skip)(
    'details editor updates through Apex and restores rejected saves, delete confirmation restores rejected deletes',
    async () => {
        const element = await mount(); element.goToDate('2026-10-02T12:00:00Z'); await flush();
        getEvents.emit([fixture()]); await flush();
        const calendar = calendarOf(element), q = selector => calendar.shadowRoot.querySelector(selector);
        const click = node => node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        click(q('.fc-event')); expect(q('#fc-details-title').textContent).toBe(fixture().title);
        click(q('#fc-details-edit'));
        let form = q('#event-modal');
        expect(form.showColorPicker).toBe(false);
        expect(form.$('#color-group').hidden).toBe(true);
        form.titleInput.value = 'Saved title'; form.locationInput.value = 'Saved location';
        click(form.$('#save-btn')); await flush();
        expect(updateEvent).toHaveBeenCalledTimes(1);
        expect(updateEvent).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Saved title', location: 'Saved location' }));
        expect(calendar.getEvents()[0].title).toBe('Saved title');
        updateEvent.mockRejectedValueOnce(new Error('Denied by server'));
        click(q('.fc-event')); click(q('#fc-details-edit')); form = q('#event-modal');
        form.titleInput.value = 'Rejected title'; click(form.$('#save-btn')); await flush();
        expect(calendar.getEvents()[0].title).toBe('Saved title');
        click(q('.fc-event')); click(q('#fc-details-delete')); click(q('#fc-delete-cancel')); await flush();
        expect(deleteEvent).not.toHaveBeenCalled();
        deleteEvent.mockRejectedValueOnce(new Error('Delete denied'));
        click(q('#fc-details-delete')); click(q('#fc-delete-confirm')); await flush();
        expect(deleteEvent).toHaveBeenCalledTimes(1);
        expect(calendar.getEvents()[0].title).toBe('Saved title');
        click(q('.fc-event')); click(q('#fc-details-delete')); click(q('#fc-delete-confirm')); await flush();
        expect(deleteEvent).toHaveBeenCalledTimes(2);
        expect(calendar.getEvents()).toHaveLength(0);
        expect(createEvent).not.toHaveBeenCalled();
    }
);

test('failed create rejects its queued edit without sending a temporary ID to Apex', async () => {
    const element = await mount(); getEvents.emit([]); await flush();
    const request = deferred(); createEvent.mockReturnValueOnce(request.promise);
    element.addEvent(fixture({ id: 'temp-failed' })); await flush();
    calendarOf(element).updateEvent('temp-failed', { title: 'Queued' }); await flush();
    request.reject(new Error('Create rejected')); await flush(); await flush();
    expect(calendarOf(element).getEvents()).toHaveLength(0);
    expect(updateEvent).not.toHaveBeenCalled();
});

test('a rejected write after disconnect cannot alter a different calendar instance', async () => {
    const first = await mount(); getEvents.emit([fixture()]); await flush();
    const request = deferred(); deleteEvent.mockReturnValueOnce(request.promise);
    calendarOf(first).deleteEvent(fixture().id); await flush();
    first.remove();
    const second = await mount(); getEvents.emit([fixture({ title: 'New instance' })]); await flush();
    request.reject(new Error('Detached request rejected')); await flush();
    expect(calendarOf(second).getEvents()[0].title).toBe('New instance');
    expect(refreshApex).not.toHaveBeenCalled();
});

(interfaceMajor > 1 || (interfaceMajor === 1 && interfaceMinor >= 9) || process.env.FORCECALENDAR_DETAILS_UI === '1' ? test : test.skip)(
    'native Salesforce recurring instance is shown once with details but no edit delete or resize',
    async () => {
        const element = await mount(); element.goToDate('2026-10-02T12:00:00Z'); await flush();
        getEvents.emit([fixture({ recurring: true })]); await flush();
        const calendar = calendarOf(element);
        expect(calendar.getEvents()).toHaveLength(1);
        expect(calendar.getEvents()[0].id).toBe(fixture().id);
        expect(calendar.getEvents()[0].metadata.forceCalendarRecurring).toBe(true);
        calendar.shadowRoot.querySelector('.fc-event').click();
        expect(calendar.shadowRoot.querySelector('#fc-details-edit')).toBeNull();
        expect(calendar.shadowRoot.querySelector('#fc-details-delete')).toBeNull();
        element.setView('week'); await flush();
        expect(calendar.shadowRoot.querySelectorAll('.fc-resize-handle')).toHaveLength(0);
        expectNoWrites();
    }
);


test.each([['2026-10-05', '2026-10-07'], ['2026-03-08', '2026-03-08'], ['2026-03-07', '2026-03-09'], ['2026-10-31', '2026-11-02']])(
    'all-day snapshot %s through %s keeps inclusive civil dates instead of UTC instants', async (first, last) => {
        const element = await mount();
        getEvents.emit([fixture({ allDay: true, startDate: first, lastDay: last, start: `${first}T00:00:00.000Z`, end: `${last}T00:00:00.000Z` })]);
        await flush();
        const event = calendarOf(element).getEvents()[0];
        const civil = value => { const date = new Date(value); return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((part, index) => index ? String(part).padStart(2, '0') : part).join('-'); };
        expect(civil(event.start)).toBe(first); expect(civil(event.end)).toBe(last);
        expect(new Date(event.start).getHours()).toBe(0); expect(new Date(event.end).getHours()).toBe(23);
        expectNoWrites();
        calendarOf(element).updateEvent(event.id, { title: 'Civil title edit' }); await flush();
        expect(updateEvent).toHaveBeenCalledWith(expect.objectContaining({ isAllDay: true, startDate: first, lastDay: last, startDateTime: null, endDateTime: null }));
    }
);

test('all-day create sends date-only fields, never shifted UTC instant values', async () => {
    const element = await mount(); getEvents.emit([]); await flush();
    element.addEvent(fixture({ id: 'civil-new', allDay: true, start: new Date(2026, 2, 8, 0, 0), end: new Date(2026, 2, 8, 23, 59, 59, 999) }));
    await flush();
    expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ isAllDay: true, startDate: '2026-03-08', lastDay: '2026-03-08', startDateTime: null, endDateTime: null }));
});

(interfaceMajor > 1 || (interfaceMajor === 1 && interfaceMinor >= 9) || process.env.FORCECALENDAR_DETAILS_UI === '1' ? test : test.skip)(
    'all-day date-only editor permits same-day and sends inclusive last-day civil dates', async () => {
        const element = await mount(); element.goToDate('2026-10-05T12:00:00Z'); getEvents.emit([]); await flush();
        const calendar = calendarOf(element), form = calendar.shadowRoot.querySelector('#event-modal');
        calendar.shadowRoot.querySelector('#create-event-btn').click();
        form.allDayInput.checked = true; form.allDayInput.dispatchEvent(new Event('change', { bubbles: true }));
        expect(form.startInput.type).toBe('date'); expect(form.endInput.type).toBe('date');
        form.titleInput.value = 'One inclusive day'; form.startInput.value = '2026-03-08'; form.endInput.value = '2026-03-08';
        form.$('#save-btn').click(); await flush();
        expect(createEvent).toHaveBeenCalledTimes(1);
        expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ startDate: '2026-03-08', lastDay: '2026-03-08', isAllDay: true, startDateTime: null, endDateTime: null }));
        getEvents.emit([fixture({ id: '00U000000000002AAA', allDay: true, startDate: '2026-03-08', lastDay: '2026-03-08', start: '2026-03-08T00:00:00Z', end: '2026-03-08T00:00:00Z' })]); await flush();
        expect(calendar.getEvents()[0].start.getDate()).toBe(8); expect(calendar.getEvents()[0].end.getDate()).toBe(8);
    }
);
