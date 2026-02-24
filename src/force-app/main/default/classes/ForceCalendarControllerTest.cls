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
}
