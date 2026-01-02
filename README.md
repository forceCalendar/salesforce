# ForceCalendar Salesforce Integration

A Lightning Web Component (LWC) that integrates the ForceCalendar calendar system with Salesforce, displaying native Event records in a modern, interactive calendar interface.

## Features

### ✅ Implemented
- **Data Binding**: Apex controller connected to LWC via @wire adapter
- **Auto-refresh**: Events automatically load based on current view and date range
- **View Support**: Month, Week, and Day views with dynamic date range calculation
- **Event Display**: Shows Salesforce Event records with title, time, description
- **Navigation**: Responds to next/prev/today navigation with data refresh
- **Error Handling**: Toast notifications for errors with retry capability
- **Loading States**: Spinner displays during data fetch
- **Refresh Button**: Manual refresh capability for users

### 🚧 Pending (Placeholders Added)
- Event creation (needs Apex method)
- Event updates (needs Apex method)
- Event deletion (needs Apex method)
- Custom event colors by type/category
- Recurring event support
- Custom object support

## Architecture

```
┌─────────────────────────────────┐
│     Salesforce Event Object     │
└────────────┬────────────────────┘
             │
             ↓ SOQL Query
┌─────────────────────────────────┐
│   ForceCalendarController.cls   │
│       getEvents() @wire         │
└────────────┬────────────────────┘
             │
             ↓ @wire Adapter
┌─────────────────────────────────┐
│      forceCalendar LWC          │
│   - Date range management       │
│   - Event data transformation   │
│   - Error handling              │
└────────────┬────────────────────┘
             │
             ↓ DOM Manipulation
┌─────────────────────────────────┐
│  <force-calendar> Web Component │
│    (@forcecalendar/interface)   │
└─────────────────────────────────┘
```

## Components

### LWC Component: `forceCalendar`

**Key Features:**
- Imports events using `@wire(getEvents, { startDateTime, endDateTime })`
- Dynamically calculates date ranges based on view (month/week/day)
- Handles navigation and view changes
- Provides error recovery with retry
- Shows loading spinner during data fetch

**Public APIs:**
- `@api refreshEvents()` - Refresh events from Salesforce
- `@api setView(view)` - Change calendar view
- `@api goToDate(date)` - Navigate to specific date
- `@api addEvent(event)` - Add event locally (not persisted)

### Apex Controller: `ForceCalendarController`

**Methods:**
- `getEvents(Datetime startDateTime, Datetime endDateTime)`
  - Returns List<Map<String, Object>> of events
  - Queries standard Event object
  - Applies security with `WITH SECURITY_ENFORCED`
  - Cacheable for performance

## Installation

### Prerequisites
- Salesforce org with API v60.0 or higher
- npm installed locally
- Salesforce CLI (sf or sfdx)

### Steps

1. **Clone the repository**
```bash
git clone https://github.com/forceCalendar/salesforce.git
cd salesforce
```

2. **Install npm dependencies**
```bash
npm install
```

3. **Authorize your Salesforce org**
```bash
sf org login web --alias myorg --set-default
```

4. **Deploy to your org**
```bash
sf project deploy start --source-dir force-app
```

5. **Assign permissions (if needed)**
```bash
sf org assign permset --name ForceCalendar_User
```

## Usage

### Adding to Lightning Pages

1. Navigate to any Lightning App Builder page (Home, App, or Record page)
2. Find "Force Calendar" in the component list
3. Drag it onto the page
4. Configure properties:
   - **Default View**: month, week, or day
   - **Calendar Height**: e.g., "800px"
5. Save and activate the page

### Component Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `currentView` | String | "month" | Initial calendar view (month/week/day) |
| `height` | String | "800px" | Height of the calendar component |

## Testing

### Manual Testing

1. **Deploy the component** to your org
2. **Add to a Lightning page** using App Builder
3. **Create test events** in Salesforce:
```apex
// Execute Anonymous Apex to create test events
List<Event> testEvents = new List<Event>();
for(Integer i = 0; i < 10; i++) {
    testEvents.add(new Event(
        Subject = 'Test Event ' + i,
        StartDateTime = DateTime.now().addDays(i),
        EndDateTime = DateTime.now().addDays(i).addHours(1),
        Description = 'Test description for event ' + i
    ));
}
insert testEvents;
```

4. **Verify functionality**:
   - Events appear in the calendar
   - Switching views (month/week/day) refreshes data
   - Navigation (next/prev) loads appropriate events
   - Refresh button works
   - Error handling (disconnect network to test)

### Debug Console

Open browser console to see debug messages:
- "Date range updated: [start] - [end]" - Shows date range calculations
- "Loaded X events from Salesforce" - Confirms data loading
- Event creation/update/deletion requests (placeholders)

## Data Flow Example

```javascript
// 1. User navigates to next month
handleNavigate({ action: 'next', date: '2024-02-01' })
  ↓
// 2. Date range recalculated
updateDateRangeForDate('2024-02-01', 'month')
// Result: Feb 1 - Mar 31 (includes buffer)
  ↓
// 3. @wire adapter triggered
@wire(getEvents, {
  startDateTime: '2024-02-01T00:00:00',
  endDateTime: '2024-03-31T23:59:59'
})
  ↓
// 4. Apex query executed
SELECT Id, Subject, StartDateTime, EndDateTime...
FROM Event WHERE StartDateTime >= :start AND EndDateTime <= :end
  ↓
// 5. Data returned and passed to calendar
this.calendarElement.addEvent({...})
```

## Troubleshooting

### Events not showing
- Check browser console for errors
- Verify Event object access permissions
- Ensure events exist within the date range
- Check network tab for Apex calls

### Calendar not rendering
- Verify npm packages installed: `npm ls @forcecalendar/interface`
- Check that LWC deployed successfully
- Clear browser cache and reload

### Performance issues
- Limit date range queries (currently max 1000 events)
- Enable Apex caching (already configured)
- Consider implementing pagination

## Next Steps

### High Priority
1. **Implement Event CRUD**:
   - Add `createEvent()` Apex method
   - Add `updateEvent()` Apex method
   - Add `deleteEvent()` Apex method
   - Wire to calendar event handlers

2. **Add Event Form Integration**:
```apex
@AuraEnabled
public static Map<String, Object> createEvent(
    String subject,
    Datetime startDateTime,
    Datetime endDateTime,
    String description
) {
    Event newEvent = new Event(
        Subject = subject,
        StartDateTime = startDateTime,
        EndDateTime = endDateTime,
        Description = description
    );
    insert newEvent;
    return FormatEvent(newEvent);
}
```

3. **Support Recurring Events**:
   - Query RecurrencePattern fields
   - Pass to calendar with RRULE format

### Medium Priority
- Custom event colors by type
- Support for custom objects
- Multi-user calendar views
- Resource/room scheduling

### Low Priority
- Export to ICS format
- Email invitations
- Mobile optimization
- Offline support

## API Version Compatibility

- **Salesforce API**: v60.0 (Winter '24)
- **@forcecalendar/core**: ^0.3.1
- **@forcecalendar/interface**: ^0.7.0

## License

ISC

## Support

For issues or questions:
- GitHub Issues: https://github.com/forceCalendar/salesforce/issues
- Documentation: https://forcecalendar.com/docs

## Contributors

- Initial integration by forceCalendar team
- Apex-LWC wiring implementation (Jan 2025)