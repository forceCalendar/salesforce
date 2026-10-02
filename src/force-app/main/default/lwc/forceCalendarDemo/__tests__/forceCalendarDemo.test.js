import { createElement } from 'lwc';
import { readFileSync } from 'fs';
import path from 'path';
import ForceCalendarDemo from 'c/forceCalendarDemo';
import { loadScript } from 'lightning/platformResourceLoader';

const flush = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
};
const calendarOf = element => element.shadowRoot.querySelector('forcecal-main');
const click = (element, label) => {
    const button = [...element.shadowRoot.querySelectorAll('lightning-button')]
        .find(candidate => candidate.label === label);
    expect(button).toBeDefined();
    button.click();
};
const advance = async (milliseconds = 100) => {
    jest.advanceTimersByTime(milliseconds);
    await flush();
};
async function mount() {
    const element = createElement('c-force-calendar-demo', { is: ForceCalendarDemo });
    document.body.appendChild(element);
    await flush();
    return element;
}
function deferScript() {
    let resolve;
    loadScript.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    return () => resolve();
}
function expectSamples(calendar) {
    const events = calendar.getEvents();
    expect(events).toHaveLength(15);
    expect(new Set(events.map(event => event.id)).size).toBe(15);
    expect(events.every(event => event.description === 'Sample event for demo')).toBe(true);
}

beforeAll(() => {
    // Exercise the exact deployable bundle: real core/interface custom elements,
    // rather than stubbing setEvents/addEvent and hiding lifecycle regressions.
    const bundle = readFileSync(path.resolve(process.cwd(), '../dist/force-app/main/default/staticresources/forcecalendar.js'), 'utf8');
    window.eval(bundle);
});

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    loadScript.mockResolvedValue(undefined);
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

test('cold deferred resource load mounts once and loads one quiet sample snapshot', async () => {
    const resolve = deferScript();
    const element = await mount();
    expect(calendarOf(element)).toBeNull();
    await advance();
    resolve();
    await flush();

    const calendar = calendarOf(element);
    expect(element.shadowRoot.querySelectorAll('forcecal-main')).toHaveLength(1);
    expect(calendar.getEvents()).toHaveLength(0);
    const snapshot = jest.spyOn(calendar, 'setEvents');
    const added = jest.fn();
    calendar.addEventListener('calendar-event-added', added);
    await advance(99);
    expect(snapshot).not.toHaveBeenCalled();
    await advance(1);
    expectSamples(calendar);
    await advance(500);
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(added).not.toHaveBeenCalled();
    expect(loadScript).toHaveBeenCalledTimes(1);
});

test('disconnect before resource resolution does not initialize until reconnect', async () => {
    const resolve = deferScript();
    const element = await mount();
    document.body.removeChild(element);
    resolve();
    await flush();
    await advance();
    expect(calendarOf(element)).toBeNull();

    document.body.appendChild(element);
    await flush();
    expect(element.shadowRoot.querySelectorAll('forcecal-main')).toHaveLength(1);
    await advance();
    expectSamples(calendarOf(element));
    expect(loadScript).toHaveBeenCalledTimes(1);
});

test('reconnect while the resource is pending shares the load and schedules samples once', async () => {
    const resolve = deferScript();
    const element = await mount();
    document.body.removeChild(element);
    document.body.appendChild(element);
    await flush();
    expect(loadScript).toHaveBeenCalledTimes(1);
    expect(calendarOf(element)).toBeNull();

    resolve();
    await flush();
    const calendar = calendarOf(element);
    const snapshot = jest.spyOn(calendar, 'setEvents');
    await advance();
    expect(element.shadowRoot.querySelectorAll('forcecal-main')).toHaveLength(1);
    expectSamples(calendar);
    expect(snapshot).toHaveBeenCalledTimes(1);
});

test('disconnect cancels the initial timer and reconnect creates a fresh working calendar', async () => {
    const element = await mount();
    const first = calendarOf(element);
    const staleSnapshot = jest.spyOn(first, 'setEvents');
    await advance(50);
    document.body.removeChild(element);
    expect(calendarOf(element)).toBeNull();
    await advance(100);
    expect(staleSnapshot).not.toHaveBeenCalled();

    document.body.appendChild(element);
    await flush();
    const second = calendarOf(element);
    expect(second).not.toBe(first);
    const snapshot = jest.spyOn(second, 'setEvents');
    await advance();
    expectSamples(second);
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(staleSnapshot).not.toHaveBeenCalled();
    expect(loadScript).toHaveBeenCalledTimes(1);
});

test('rapid sample requests coalesce and Clear cancels an outstanding sample load', async () => {
    const element = await mount();
    const calendar = calendarOf(element);
    const snapshot = jest.spyOn(calendar, 'setEvents');
    click(element, 'Load Sample');
    click(element, 'Load Sample');
    click(element, 'Load Sample');
    await advance();
    expectSamples(calendar);
    expect(snapshot.mock.calls.filter(([events]) => events.length === 15)).toHaveLength(1);

    click(element, 'Load Sample');
    await advance(50);
    click(element, 'Clear');
    await advance(500);
    expect(calendar.getEvents()).toHaveLength(0);
    expect(snapshot.mock.calls.filter(([events]) => events.length === 15)).toHaveLength(1);
});

test('disconnect cancels a reload so it cannot populate the next calendar early', async () => {
    const element = await mount();
    await advance();
    const first = calendarOf(element);
    click(element, 'Load Sample');
    const staleSnapshot = jest.spyOn(first, 'setEvents');
    await advance(50);
    document.body.removeChild(element);
    document.body.appendChild(element);
    await flush();
    const second = calendarOf(element);
    const snapshot = jest.spyOn(second, 'setEvents');
    await advance(50);
    expect(snapshot).not.toHaveBeenCalled();
    expect(staleSnapshot).not.toHaveBeenCalled();
    await advance(50);
    expectSamples(second);
    expect(snapshot).toHaveBeenCalledTimes(1);
});

test('sample replacement and clear stay quiet while Add Event emits exactly once after reconnect', async () => {
    const element = await mount();
    await advance();
    document.body.removeChild(element);
    document.body.appendChild(element);
    await flush();
    const calendar = calendarOf(element);
    const added = jest.fn();
    const deleted = jest.fn();
    calendar.addEventListener('calendar-event-added', added);
    calendar.addEventListener('calendar-event-deleted', deleted);
    await advance();
    expectSamples(calendar);
    click(element, 'Load Sample');
    await advance();
    expectSamples(calendar);
    expect(added).not.toHaveBeenCalled();
    expect(deleted).not.toHaveBeenCalled();
    click(element, 'Clear');
    expect(calendar.getEvents()).toHaveLength(0);
    click(element, 'Add Event');
    expect(calendar.getEvents()).toHaveLength(1);
    expect(added).toHaveBeenCalledTimes(1);
    expect(deleted).not.toHaveBeenCalled();
    const changedView = jest.fn();
    calendar.addEventListener('calendar-view-change', changedView);
    for (const label of ['Week', 'Day', 'Month']) {
        click(element, label);
        expect(changedView.mock.calls.at(-1)[0].detail.view).toBe(label.toLowerCase());
    }
});

test('a failed resource load can be retried when the demo reconnects', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    loadScript.mockRejectedValueOnce(new Error('resource unavailable'));
    const element = await mount();
    expect(calendarOf(element)).toBeNull();
    expect(console.error).toHaveBeenCalledTimes(1);
    document.body.removeChild(element);
    document.body.appendChild(element);
    await flush();
    await advance();
    expectSamples(calendarOf(element));
    expect(loadScript).toHaveBeenCalledTimes(2);
});
