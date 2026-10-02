@IsTest
private class ForceCalendarControllerTest {

    @TestSetup
    static void setup() {
        Event evt = new Event();
        evt.Subject = 'Test Event';
        evt.StartDateTime = Datetime.now();
        evt.EndDateTime = Datetime.now().addHours(1);
        evt.IsAllDayEvent = false;
        evt.Description = 'Test description';
        evt.Location = 'Test Location';
        insert evt;
    }

    @IsTest
    static void testGetEvents() {
        Datetime startDt = Datetime.now().addDays(-1);
        Datetime endDt = Datetime.now().addDays(1);

        Test.startTest();
        List<Map<String, Object>> results = ForceCalendarController.getEvents(startDt, endDt, null);
        Test.stopTest();

        System.assertNotEquals(0, results.size(), 'Should return at least one event');
        Map<String, Object> first = results[0];
        System.assertEquals('Test Event', first.get('title'));
        System.assertEquals(false, first.get('allDay'));
        System.assertEquals('Test description', first.get('description'));
        System.assertEquals('Test Location', first.get('location'));
        System.assertEquals('#0176D3', first.get('backgroundColor'));
        System.assertNotEquals(null, first.get('id'));
        System.assertNotEquals(null, first.get('start'));
        System.assertNotEquals(null, first.get('end'));
    }

    @IsTest
    static void testGetEventsWithRecordId() {
        // Passing a recordId that doesn't match any WhoId/WhatId should return empty
        Datetime startDt = Datetime.now().addDays(-1);
        Datetime endDt = Datetime.now().addDays(1);

        Contact c = new Contact(LastName = 'TestContact');
        insert c;

        Test.startTest();
        List<Map<String, Object>> results = ForceCalendarController.getEvents(startDt, endDt, c.Id);
        Test.stopTest();

        System.assertEquals(0, results.size(), 'Should return no events for unrelated record');
    }

    @IsTest
    static void testGetEventsNullDates() {
        Boolean threwException = false;
        Test.startTest();
        try {
            ForceCalendarController.getEvents(null, null, null);
        } catch (AuraHandledException e) {
            threwException = true;
        }
        Test.stopTest();

        System.assert(threwException, 'Should throw exception for null dates');
    }

    @IsTest
    static void testCreateEvent() {
        Datetime startDt = Datetime.now().addDays(1);
        Datetime endDt = Datetime.now().addDays(1).addHours(2);

        Test.startTest();
        Id eventId = ForceCalendarController.createEvent(
            'New Test Event',
            startDt,
            endDt,
            false,
            'New description',
            'New Location',
            null,
            null
        );
        Test.stopTest();

        System.assertNotEquals(null, eventId, 'Should return the new event ID');
        Event created = [SELECT Subject, Description, Location FROM Event WHERE Id = :eventId];
        System.assertEquals('New Test Event', created.Subject);
        System.assertEquals('New description', created.Description);
        System.assertEquals('New Location', created.Location);
    }

    @IsTest
    static void testCreateEventBlankTitle() {
        Boolean threwException = false;
        Test.startTest();
        try {
            ForceCalendarController.createEvent(
                '  ',
                Datetime.now(),
                Datetime.now().addHours(1),
                false,
                null,
                null,
                null,
                null
            );
        } catch (AuraHandledException e) {
            threwException = true;
        }
        Test.stopTest();

        System.assert(threwException, 'Should throw exception for blank title');
    }

    @IsTest
    static void testCreateEventNullDates() {
        Boolean threwException = false;
        Test.startTest();
        try {
            ForceCalendarController.createEvent('Test', null, null, false, null, null, null, null);
        } catch (AuraHandledException e) {
            threwException = true;
        }
        Test.stopTest();

        System.assert(threwException, 'Should throw exception for null dates');
    }

    @IsTest
    static void testCreateEventEndBeforeStart() {
        Boolean threwException = false;
        Datetime startDt = Datetime.now().addDays(1);
        Datetime endDt = Datetime.now(); // before start

        Test.startTest();
        try {
            ForceCalendarController.createEvent(
                'Bad Event', startDt, endDt, false, null, null, null, null
            );
        } catch (AuraHandledException e) {
            threwException = true;
        }
        Test.stopTest();

        System.assert(threwException, 'Should throw exception when end is before start');
    }

    @IsTest
    static void testUpdateEvent() {
        Event existing = [SELECT Id FROM Event LIMIT 1];

        Datetime newStart = Datetime.now().addDays(2);
        Datetime newEnd = Datetime.now().addDays(2).addHours(3);

        Test.startTest();
        ForceCalendarController.updateEvent(
            existing.Id,
            'Updated Title',
            newStart,
            newEnd,
            true,
            'Updated description',
            'Updated Location'
        );
        Test.stopTest();

        Event updated = [SELECT Subject, IsAllDayEvent, Description, Location FROM Event WHERE Id = :existing.Id];
        System.assertEquals('Updated Title', updated.Subject);
        System.assertEquals(true, updated.IsAllDayEvent);
        System.assertEquals('Updated description', updated.Description);
        System.assertEquals('Updated Location', updated.Location);
    }

    @IsTest
    static void testUpdateEventNullId() {
        Boolean threwException = false;
        Test.startTest();
        try {
            ForceCalendarController.updateEvent(null, 'Title', null, null, null, null, null);
        } catch (AuraHandledException e) {
            threwException = true;
        }
        Test.stopTest();

        System.assert(threwException, 'Should throw exception for null event ID');
    }

    @IsTest
    static void testUpdateEventEmptyTitle() {
        Event existing = [SELECT Id FROM Event LIMIT 1];

        Boolean threwException = false;
        Test.startTest();
        try {
            ForceCalendarController.updateEvent(
                existing.Id, '  ', null, null, null, null, null
            );
        } catch (AuraHandledException e) {
            threwException = true;
        }
        Test.stopTest();

        System.assert(threwException, 'Should throw exception for empty title');
    }

    @IsTest
    static void testDeleteEvent() {
        Event existing = [SELECT Id FROM Event LIMIT 1];

        Test.startTest();
        ForceCalendarController.deleteEvent(existing.Id);
        Test.stopTest();

        List<Event> remaining = [SELECT Id FROM Event WHERE Id = :existing.Id];
        System.assertEquals(0, remaining.size(), 'Event should be deleted');
    }

    @IsTest
    static void testDeleteEventNullId() {
        Boolean threwException = false;
        Test.startTest();
        try {
            ForceCalendarController.deleteEvent(null);
        } catch (AuraHandledException e) {
            threwException = true;
        }
        Test.stopTest();

        System.assert(threwException, 'Should throw exception for null event ID');
    }

    @IsTest
    static void testCreateEventAllDay() {
        Datetime startDt = Datetime.now().addDays(3);
        Datetime endDt = Datetime.now().addDays(4);

        Test.startTest();
        Id eventId = ForceCalendarController.createEvent(
            'All Day Event',
            startDt,
            endDt,
            true,
            null,
            null,
            null,
            null
        );
        Test.stopTest();

        Event created = [SELECT IsAllDayEvent FROM Event WHERE Id = :eventId];
        System.assertEquals(true, created.IsAllDayEvent);
    }

    @IsTest
    static void testUpdateEventPartialFields() {
        Event existing = [SELECT Id, Subject FROM Event LIMIT 1];

        Test.startTest();
        // Only update description, leave other fields null (unchanged)
        ForceCalendarController.updateEvent(
            existing.Id,
            null,
            null,
            null,
            null,
            'Partial update description',
            null
        );
        Test.stopTest();

        Event updated = [SELECT Subject, Description FROM Event WHERE Id = :existing.Id];
        System.assertEquals('Test Event', updated.Subject, 'Title should remain unchanged');
        System.assertEquals('Partial update description', updated.Description);
    }

    @IsTest
    static void testGetEventsIncludesOverlappingIntervals() {
        Datetime startDt = Datetime.newInstanceGMT(2030, 1, 2, 10, 0, 0);
        Datetime endDt = startDt.addHours(2);
        insert new List<Event>{
            new Event(Subject = 'Inside', StartDateTime = startDt, EndDateTime = startDt.addHours(1)),
            new Event(Subject = 'Overlaps start', StartDateTime = startDt.addHours(-1), EndDateTime = startDt.addHours(1)),
            new Event(Subject = 'Overlaps end', StartDateTime = startDt.addHours(1), EndDateTime = endDt.addHours(1)),
            new Event(Subject = 'Spans window', StartDateTime = startDt.addDays(-1), EndDateTime = endDt.addDays(1)),
            new Event(Subject = 'Ends at boundary', StartDateTime = startDt.addHours(-1), EndDateTime = startDt),
            new Event(Subject = 'Starts at boundary', StartDateTime = endDt, EndDateTime = endDt.addHours(1))
        };
        Test.startTest();
        List<Map<String, Object>> results = ForceCalendarController.getEvents(startDt, endDt, null);
        Test.stopTest();
        Set<String> titles = new Set<String>();
        for (Map<String, Object> result : results) titles.add((String) result.get('title'));
        System.assertEquals(new Set<String>{'Inside', 'Overlaps start', 'Overlaps end', 'Spans window', 'Starts at boundary'}, titles,
            'Include events starting at the inclusive range end; exclude events ending exactly at the range start');
    }

    @IsTest
    static void testGetEventsRejectsInvalidRange() {
        Datetime now = Datetime.now();
        for (Datetime endDt : new List<Datetime>{now, now.addHours(-1)}) {
            Boolean rejected = false;
            try {
                ForceCalendarController.getEvents(now, endDt, null);
            } catch (AuraHandledException error) {
                rejected = true;
            }
            System.assert(rejected, 'Empty and reversed ranges must be rejected');
        }
    }

    @IsTest
    static void testCreateEventForRecordAssociations() {
        Account account = new Account(Name = 'Calendar account');
        insert account;
        Contact contact = new Contact(LastName = 'Calendar contact', AccountId = account.Id);
        insert contact;
        Lead lead = new Lead(LastName = 'Calendar lead', Company = 'Calendar company');
        insert lead;
        Datetime startDt = Datetime.now().addDays(1);
        Test.startTest();
        Id contactEventId = ForceCalendarController.createEventForRecord(
            'Contact event', startDt, startDt.addHours(1), false, null, 'Contact room', contact.Id);
        Id leadEventId = ForceCalendarController.createEventForRecord(
            'Lead event', startDt, startDt.addHours(1), false, null, null, lead.Id);
        Id accountEventId = ForceCalendarController.createEventForRecord(
            'Account event', startDt, startDt.addHours(1), false, null, 'Account room', account.Id);
        Id unassociatedEventId = ForceCalendarController.createEventForRecord(
            'App page event', startDt, startDt.addHours(1), false, null, null, null);
        List<Map<String, Object>> contactEvents = ForceCalendarController.getEvents(
            startDt.addHours(-1), startDt.addHours(2), contact.Id);
        List<Map<String, Object>> accountEvents = ForceCalendarController.getEvents(
            startDt.addHours(-1), startDt.addHours(2), account.Id);
        Test.stopTest();
        Set<Id> eventIds = new Set<Id>{contactEventId, leadEventId, accountEventId, unassociatedEventId};
        Map<Id, Event> events = new Map<Id, Event>([
            SELECT WhoId, WhatId, Location FROM Event
            WHERE Id IN :eventIds
        ]);
        System.assertEquals(contact.Id, events.get(contactEventId).WhoId);
        System.assertEquals(null, events.get(contactEventId).WhatId);
        System.assertEquals('Contact room', events.get(contactEventId).Location);
        System.assertEquals(lead.Id, events.get(leadEventId).WhoId);
        System.assertEquals(account.Id, events.get(accountEventId).WhatId);
        System.assertEquals(null, events.get(accountEventId).WhoId);
        System.assertEquals(null, events.get(unassociatedEventId).WhoId);
        System.assertEquals(null, events.get(unassociatedEventId).WhatId);
        System.assertEquals(1, contactEvents.size(), 'Created record-page event survives a filtered reload');
        System.assertEquals(1, accountEvents.size(), 'Related account event survives a filtered reload');
    }

    @IsTest
    static void testCreateEventForRecordRejectsUnsupportedType() {
        Integer beforeCount = [SELECT COUNT() FROM Event];
        Boolean rejected = false;
        Test.startTest();
        try {
            ForceCalendarController.createEventForRecord('Invalid association', Datetime.now(),
                Datetime.now().addHours(1), false, null, null, UserInfo.getUserId());
        } catch (AuraHandledException error) {
            rejected = true;
        }
        Test.stopTest();
        System.assert(rejected, 'A User cannot be used as WhoId or WhatId');
        System.assertEquals(beforeCount, [SELECT COUNT() FROM Event], 'Rejected association must not insert an event');
    }

    @IsTest
    static void testCreateEventForRecordRejectsDeletedRecord() {
        Account account = new Account(Name = 'Deleted calendar record');
        insert account;
        Id deletedRecordId = account.Id;
        delete account;
        Integer beforeCount = [SELECT COUNT() FROM Event];
        Boolean rejected = false;
        Test.startTest();
        try {
            ForceCalendarController.createEventForRecord('Invalid association', Datetime.now(),
                Datetime.now().addHours(1), false, null, null, deletedRecordId);
        } catch (AuraHandledException error) {
            rejected = true;
        }
        Test.stopTest();
        System.assert(rejected, 'A supported type does not authorize an invalid/deleted record association');
        System.assertEquals(beforeCount, [SELECT COUNT() FROM Event], 'Rejected association must not insert an event');
    }

    @IsTest
    static void testUpdateEventLocationAndPartialRange() {
        Event existing = [SELECT Id, StartDateTime, EndDateTime FROM Event LIMIT 1];
        Test.startTest();
        ForceCalendarController.updateEvent(existing.Id, null, null, null, null, null, '  New room  ');
        Boolean rejected = false;
        try {
            ForceCalendarController.updateEvent(existing.Id, null, existing.EndDateTime.addHours(1), null, null, null, null);
        } catch (AuraHandledException error) {
            rejected = true;
        }
        Test.stopTest();
        Event result = [SELECT Location, StartDateTime, EndDateTime FROM Event WHERE Id = :existing.Id];
        System.assertEquals('New room', result.Location);
        System.assertEquals(existing.StartDateTime, result.StartDateTime, 'An invalid partial range must not be saved');
        System.assertEquals(existing.EndDateTime, result.EndDateTime);
        System.assert(rejected, 'Validate supplied start against persisted end');
    }


    // Users and records below exist only in the isolated Apex transaction.
    private static User securityTestUser(String profileName, String suffix) {
        Profile p = [SELECT Id FROM Profile WHERE Name = :profileName LIMIT 1];
        String unique = UserInfo.getOrganizationId() + '.' + String.valueOf(Datetime.now().getTime()) + suffix;
        User u = new User(ProfileId = p.Id, Username = 'forcecalendar.' + unique + '@example.com',
            Email = 'forcecalendar-test@example.com', Alias = suffix,
            LastName = 'Calendar security fixture', TimeZoneSidKey = 'America/Los_Angeles',
            LocaleSidKey = 'en_US', EmailEncodingKey = 'UTF-8', LanguageLocaleKey = 'en_US');
        insert u;
        return u;
    }

    @IsTest
    static void testMinimumAccessCannotReadOrMutateEvents() {
        User restricted = securityTestUser('Minimum Access - Salesforce', 'fcmin');
        Event original = [SELECT Id, Subject FROM Event LIMIT 1];
        Integer beforeCount = [SELECT COUNT() FROM Event];
        Datetime startDt = Datetime.now();
        System.runAs(restricted) {
            System.assertEquals(false, Schema.sObjectType.Event.isCreateable(), 'Fixture must deny Event creation');
            System.assertEquals(false, Schema.sObjectType.Event.isUpdateable(), 'Fixture must deny Event updates');
            System.assertEquals(false, Schema.sObjectType.Event.isDeletable(), 'Fixture must deny Event deletion');
            Boolean readDenied = false;
            Boolean createDenied = false;
            Boolean updateDenied = false;
            Boolean deleteDenied = false;
            try { ForceCalendarController.getEvents(startDt.addDays(-1), startDt.addDays(1), null); }
            catch (AuraHandledException e) { readDenied = true; }
            try { ForceCalendarController.createEvent('Denied', startDt, startDt.addHours(1), false, null, null, null, null); }
            catch (AuraHandledException e) { createDenied = true; }
            try { ForceCalendarController.updateEvent(original.Id, 'Denied', null, null, null, null, null); }
            catch (AuraHandledException e) { updateDenied = true; }
            try { ForceCalendarController.deleteEvent(original.Id); }
            catch (AuraHandledException e) { deleteDenied = true; }
            System.assert(readDenied, 'User-mode query must enforce read permissions');
            System.assert(createDenied && updateDenied && deleteDenied, 'All writes must reject the restricted user');
        }
        System.assertEquals(beforeCount, [SELECT COUNT() FROM Event]);
        System.assertEquals(original.Subject, [SELECT Subject FROM Event WHERE Id = :original.Id].Subject);
    }

    @IsTest
    static void testPrivateEventCannotBeChangedByOtherUser() {
        User other = securityTestUser('Standard User', 'fcother');
        Event original = [SELECT Id, Subject FROM Event LIMIT 1];
        original.IsPrivate = true;
        System.runAs(new User(Id = UserInfo.getUserId())) { update original; }
        System.runAs(other) {
            System.assert(Schema.sObjectType.Event.isUpdateable(), 'Fixture requires object update permission');
            Boolean updateDenied = false;
            Boolean deleteDenied = false;
            try { ForceCalendarController.updateEvent(original.Id, 'Denied', null, null, null, null, null); }
            catch (AuraHandledException e) { updateDenied = true; }
            try { ForceCalendarController.deleteEvent(original.Id); }
            catch (AuraHandledException e) { deleteDenied = true; }
            System.assert(updateDenied && deleteDenied, 'Object permission must not bypass access to a private Event');
        }
        System.assertEquals(original.Subject, [SELECT Subject FROM Event WHERE Id = :original.Id].Subject);
    }

    @IsTest
    static void testNativeRecurringEventsAreReadOnly() {
        Datetime startDt = Datetime.now().addDays(1);
        Event series = new Event(Subject = 'Native recurring fixture',
            StartDateTime = startDt, EndDateTime = startDt.addHours(1),
            IsRecurrence = true, RecurrenceType = 'RecursDaily', RecurrenceInterval = 1,
            RecurrenceStartDateTime = startDt,
            RecurrenceEndDateOnly = startDt.date().addDays(2));
        insert series;
        Test.startTest();
        List<Map<String, Object>> rows = ForceCalendarController.getEvents(
            startDt.addDays(-1), startDt.addDays(4), null);
        Boolean found = false;
        for (Map<String, Object> row : rows) {
            if (row.get('id') == series.Id) {
                System.assertEquals(true, row.get('recurring'));
                found = true;
            }
        }
        Boolean updateDenied = false;
        Boolean deleteDenied = false;
        try { ForceCalendarController.updateEvent(series.Id, 'Not allowed', null, null, null, null, null); }
        catch (AuraHandledException error) { updateDenied = true; }
        try { ForceCalendarController.deleteEvent(series.Id); }
        catch (AuraHandledException error) { deleteDenied = true; }
        Test.stopTest();
        System.assert(found, 'Native recurring series is visible with a read-only marker');
        System.assert(updateDenied && deleteDenied, 'Native recurrence must not be mutated without series/occurrence semantics');
        System.assertEquals('Native recurring fixture', [SELECT Subject FROM Event WHERE Id = :series.Id].Subject);
    }

    @IsTest
    static void testCalendarAllDayCivilDatesAcrossTimeZones() {
        List<String> zones = new List<String>{'GMT', 'America/Los_Angeles', 'Asia/Kolkata'};
        List<User> fixtures = new List<User>();
        for (Integer i = 0; i < zones.size(); i++) {
            User fixture = securityTestUser('Standard User', 'fcday' + i);
            fixture.TimeZoneSidKey = zones[i]; update fixture;
            fixtures.add(fixture);
        }
        List<List<Date>> ranges = new List<List<Date>>{
            new List<Date>{Date.newInstance(2026, 10, 5), Date.newInstance(2026, 10, 7)},
            new List<Date>{Date.newInstance(2026, 3, 8), Date.newInstance(2026, 3, 8)},
            new List<Date>{Date.newInstance(2026, 3, 7), Date.newInstance(2026, 3, 9)},
            new List<Date>{Date.newInstance(2026, 10, 31), Date.newInstance(2026, 11, 2)}
        };
        for (User fixture : fixtures) {
            System.runAs(fixture) {
                for (List<Date> range : ranges) {
                    Date first = range[0], last = range[1];
                    Id eventId = ForceCalendarController.createCalendarEvent('Civil day fixture',
                        null, null, true, first, last, null, 'Date-only room', null);
                    Event saved = [SELECT ActivityDate, StartDateTime, EndDateTime, IsAllDayEvent, DurationInMinutes
                        FROM Event WHERE Id = :eventId];
                    System.assertEquals(true, saved.IsAllDayEvent);
                    System.assertEquals(first, saved.ActivityDate);
                    System.assertEquals(first, saved.StartDateTime.dateGMT());
                    System.assertEquals(last, saved.EndDateTime.dateGMT());
                    System.assertEquals((first.daysBetween(last) + 1) * 1440, saved.DurationInMinutes,
                        'Native all-day duration counts inclusive civil days, independent of DST');
                    List<Map<String, Object>> rows = ForceCalendarController.getEvents(
                        Datetime.newInstanceGMT(last, Time.newInstance(0, 0, 0, 0)),
                        Datetime.newInstanceGMT(last, Time.newInstance(23, 59, 59, 999)), null);
                    Boolean found = false;
                    for (Map<String, Object> row : rows) if (row.get('id') == eventId) {
                        found = true;
                        System.assertEquals(first, row.get('startDate'));
                        System.assertEquals(last, row.get('lastDay'));
                    }
                    System.assert(found, 'The inclusive last day must match the calendar query');
                    ForceCalendarController.updateCalendarEvent(eventId, 'Moved civil fixture',
                        null, null, true, first.addDays(1), last.addDays(1), null, null);
                    saved = [SELECT ActivityDate, EndDateTime FROM Event WHERE Id = :eventId];
                    System.assertEquals(first.addDays(1), saved.ActivityDate);
                    System.assertEquals(last.addDays(1), saved.EndDateTime.dateGMT());
                    ForceCalendarController.deleteEvent(eventId);
                }
            }
        }
    }

    @IsTest
    static void testCalendarDateBoundaryKeepsTimedInstantsAndRejectsInvalidCivilDates() {
        Datetime startDt = Datetime.newInstanceGMT(2026, 11, 1, 9, 30, 0);
        Id eventId = ForceCalendarController.createCalendarEvent('Timed instant fixture', startDt,
            startDt.addHours(1), false, null, null, null, null, null);
        ForceCalendarController.updateCalendarEvent(eventId, 'Timed instant edited', startDt,
            startDt.addHours(2), false, null, null, null, null);
        Event saved = [SELECT StartDateTime, EndDateTime, IsAllDayEvent FROM Event WHERE Id = :eventId];
        System.assertEquals(startDt, saved.StartDateTime);
        System.assertEquals(startDt.addHours(2), saved.EndDateTime);
        System.assertEquals(false, saved.IsAllDayEvent);
        Integer beforeCount = [SELECT COUNT() FROM Event];
        Boolean denied = false;
        try { ForceCalendarController.createCalendarEvent('Invalid civil range', null, null, true,
            Date.newInstance(2026, 10, 7), Date.newInstance(2026, 10, 5), null, null, null); }
        catch (AuraHandledException error) { denied = true; }
        System.assert(denied);
        System.assertEquals(beforeCount, [SELECT COUNT() FROM Event]);

        Account context = new Account(Name = 'Civil date account fixture');
        insert context;
        Date day = Date.newInstance(2027, 1, 15);
        Id relatedId = ForceCalendarController.createCalendarEvent('Related civil event',
            null, null, true, day, day, null, null, context.Id);
        ForceCalendarController.createCalendarEvent('Unrelated civil event',
            null, null, true, day, day, null, null, null);
        List<Map<String, Object>> filtered = ForceCalendarController.getEvents(
            Datetime.newInstanceGMT(day, Time.newInstance(0, 0, 0, 0)),
            Datetime.newInstanceGMT(day, Time.newInstance(23, 59, 59, 999)), context.Id);
        System.assertEquals(1, filtered.size(), 'Record-context filtering applies to the all-day OR branch too');
        System.assertEquals(relatedId, filtered[0].get('id'));
        System.assertEquals(context.Id, filtered[0].get('whatId'));
    }

}
