/**
 * Isolated security regression tests. Every user, assignment and Event below is
 * an Apex test fixture and is rolled back by Salesforce. No actual users are
 * assigned a permission set. Uses the standard Minimum Access profile so an
 * administrator's implicit access cannot hide missing grants.
 */
@IsTest
private class ForceCalendarPermissionsTest {
    private static Datetime windowStart() {
        return Datetime.newInstanceGMT(2027, 1, 15, 9, 0, 0);
    }

    private static User fixtureUser(String suffix, String permissionSetName) {
        Profile minimum = [SELECT Id FROM Profile WHERE Name = 'Minimum Access - Salesforce' LIMIT 1];
        String uniqueName = UserInfo.getOrganizationId() + '.' + suffix + '.'
            + String.valueOf(Crypto.getRandomInteger()).replace('-', '')
            + '@forcecalendar.example.invalid';
        User fixture = new User(
            Alias = suffix.left(8), Email = 'fixture@example.invalid',
            EmailEncodingKey = 'UTF-8', LastName = 'ForceCalendar Permission Fixture',
            LanguageLocaleKey = 'en_US', LocaleSidKey = 'en_US',
            ProfileId = minimum.Id, TimeZoneSidKey = 'America/Los_Angeles',
            Username = uniqueName
        );
        insert fixture;
        if (permissionSetName != null) {
            PermissionSet shipped = [
                SELECT Id, PermissionsActivitiesAccess, PermissionsEditEvent
                FROM PermissionSet WHERE Name = :permissionSetName LIMIT 1
            ];
            insert new PermissionSetAssignment(AssigneeId = fixture.Id, PermissionSetId = shipped.Id);
        }
        return fixture;
    }

    private static Event ownedFixture() {
        Event fixture = new Event(
            Subject = 'Security fixture', StartDateTime = windowStart(),
            EndDateTime = windowStart().addHours(1), IsAllDayEvent = false,
            Description = 'Synthetic test only', Location = 'Fixture room'
        );
        // Test setup deliberately inserts in system mode. Production paths are
        // exercised independently below and must enforce the runAs user's access.
        insert fixture;
        return fixture;
    }

    @IsTest
    static void accessOnlyDoesNotBypassMissingFieldPermissions() {
        User fixture = fixtureUser('fcbase', 'ForceCalendarAccess');
        System.runAs(fixture) {
            System.assertEquals(false, Event.Description.getDescribe().isAccessible(),
                'The baseline must not have the required Event FLS');
            Boolean denied = false;
            try {
                ForceCalendarController.getEvents(windowStart(), windowStart().addHours(2), null);
            } catch (AuraHandledException error) {
                denied = true;
            }
            System.assert(denied, 'Controller access alone must not bypass read FLS');
        }
    }

    @IsTest
    static void readerCanReadButCannotCreateUpdateOrDelete() {
        User fixture = fixtureUser('fcread', 'ForceCalendarReader');
        System.runAs(fixture) {
            System.assert(Event.SObjectType.getDescribe().isAccessible());
            System.assertEquals(false, Event.SObjectType.getDescribe().isCreateable());
            System.assertEquals(false, Event.SObjectType.getDescribe().isUpdateable());
            System.assertEquals(false, Event.SObjectType.getDescribe().isDeletable());
            Event existing = ownedFixture();

            Test.startTest();
            List<Map<String, Object>> results = ForceCalendarController.getEvents(
                windowStart(), windowStart().addHours(2), null);
            System.assertEquals(1, results.size());
            System.assertEquals('Fixture room', results[0].get('location'));
            System.assertEquals(null, results[0].get('whoId'), 'Inaccessible optional association is omitted');

            Boolean createDenied = false;
            Boolean updateDenied = false;
            Boolean deleteDenied = false;
            try {
                ForceCalendarController.createEvent('Denied', windowStart(),
                    windowStart().addHours(1), false, 'Denied', 'Denied', null, null);
            } catch (AuraHandledException error) { createDenied = true; }
            try {
                ForceCalendarController.updateEvent(existing.Id, 'Denied', null,
                    null, null, null, null);
            } catch (AuraHandledException error) { updateDenied = true; }
            try {
                ForceCalendarController.deleteEvent(existing.Id);
            } catch (AuraHandledException error) { deleteDenied = true; }
            Test.stopTest();

            System.assert(createDenied, 'Reader cannot create Events');
            System.assert(updateDenied, 'Reader cannot update Events');
            System.assert(deleteDenied, 'Reader cannot delete Events');
            System.assertEquals(1, [SELECT COUNT() FROM Event]);
            System.assertEquals('Security fixture', [SELECT Subject FROM Event WHERE Id = :existing.Id].Subject);
        }
    }

    @IsTest
    static void editorCanUseRequiredFieldsThroughUserMode() {
        User fixture = fixtureUser('fcedit', 'ForceCalendarEditor');
        System.runAs(fixture) {
            System.assert(Event.SObjectType.getDescribe().isCreateable());
            System.assert(Event.SObjectType.getDescribe().isUpdateable());
            System.assert(Event.SObjectType.getDescribe().isDeletable());
            System.assertEquals(false, Account.SObjectType.getDescribe().isAccessible(),
                'The editor must not receive unrelated Account access');

            Test.startTest();
            Id eventId = ForceCalendarController.createEventForRecord(
                'Editor create', windowStart(), windowStart().addHours(1),
                false, 'Description', 'Initial room', null);
            List<Map<String, Object>> results = ForceCalendarController.getEvents(
                windowStart(), windowStart().addHours(3), null);
            System.assertEquals(1, results.size());
            System.assertEquals(eventId, results[0].get('id'));
            ForceCalendarController.updateEvent(eventId, 'Editor update',
                windowStart().addMinutes(15), windowStart().addHours(2), false,
                'Updated description', 'Updated room');
            Event changed = [SELECT Subject, Description, Location FROM Event WHERE Id = :eventId WITH USER_MODE];
            System.assertEquals('Editor update', changed.Subject);
            System.assertEquals('Updated description', changed.Description);
            System.assertEquals('Updated room', changed.Location);
            ForceCalendarController.deleteEvent(eventId);
            Test.stopTest();
            System.assertEquals(0, [SELECT COUNT() FROM Event WHERE Id = :eventId]);
        }
    }

    @IsTest
    static void editorCannotReadOrMutateAnotherUsersPrivateEvent() {
        User owner = fixtureUser('fcowner', 'ForceCalendarEditor');
        User other = fixtureUser('fcother', 'ForceCalendarEditor');
        Id privateEventId;
        System.runAs(owner) { privateEventId = ownedFixture().Id; }
        System.runAs(other) {
            Test.startTest();
            List<Map<String, Object>> results = ForceCalendarController.getEvents(
                windowStart(), windowStart().addHours(2), null);
            System.assertEquals(0, results.size(), 'Unrelated user must not see the private Event');
            Boolean updateDenied = false;
            Boolean deleteDenied = false;
            try {
                ForceCalendarController.updateEvent(privateEventId, 'Denied', null,
                    null, null, null, null);
            } catch (AuraHandledException error) { updateDenied = true; }
            try {
                ForceCalendarController.deleteEvent(privateEventId);
            } catch (AuraHandledException error) { deleteDenied = true; }
            Test.stopTest();
            System.assert(updateDenied, 'Sharing must block another user updating the Event');
            System.assert(deleteDenied, 'Sharing must block another user deleting the Event');
        }
        System.assertEquals(1, [SELECT COUNT() FROM Event WHERE Id = :privateEventId]);
    }

    @IsTest
    static void editorCannotUseInaccessibleRelatedRecords() {
        User fixture = fixtureUser('fcrelate', 'ForceCalendarEditor');
        System.runAs(fixture) {
            Account accountFixture = new Account(Name = 'Synthetic restricted account');
            Contact contactFixture = new Contact(LastName = 'Synthetic restricted contact');
            insert accountFixture;
            insert contactFixture;
            System.assertEquals(false, Account.SObjectType.getDescribe().isAccessible());
            System.assertEquals(false, Contact.SObjectType.getDescribe().isAccessible());

            Test.startTest();
            for (Id relatedId : new List<Id>{accountFixture.Id, contactFixture.Id}) {
                Boolean createDenied = false;
                Boolean legacyCreateDenied = false;
                Boolean filterDenied = false;
                try {
                    ForceCalendarController.createEventForRecord('Denied relationship',
                        windowStart(), windowStart().addHours(1), false,
                        'Synthetic only', 'Fixture room', relatedId);
                } catch (AuraHandledException error) { createDenied = true; }
                try {
                    Boolean isWho = relatedId.getSObjectType() == Contact.SObjectType;
                    ForceCalendarController.createEvent('Denied legacy relationship',
                        windowStart(), windowStart().addHours(1), false,
                        'Synthetic only', 'Fixture room', isWho ? relatedId : null,
                        isWho ? null : relatedId);
                } catch (AuraHandledException error) { legacyCreateDenied = true; }
                try {
                    ForceCalendarController.getEvents(windowStart(),
                        windowStart().addHours(2), relatedId);
                } catch (AuraHandledException error) { filterDenied = true; }
                System.assert(createDenied, 'Record context must not bypass related-object access');
                System.assert(legacyCreateDenied, 'The legacy API must not bypass related-object access');
                System.assert(filterDenied, 'A record filter must fail closed when its object is inaccessible');
            }
            Test.stopTest();
            System.assertEquals(0, [SELECT COUNT() FROM Event]);
        }
    }

    @IsTest
    static void objectEditPermissionDoesNotBypassWriteFieldSecurity() {
        User fixture = fixtureUser('fcfls', 'ForceCalendarReader');
        PermissionSet objectEditOnly = new PermissionSet(
            Name = 'ForceCalendarTestEditWithoutFields',
            Label = 'ForceCalendar test edit without fields',
            PermissionsActivitiesAccess = true, PermissionsEditEvent = true
        );
        insert objectEditOnly;
        insert new PermissionSetAssignment(AssigneeId = fixture.Id, PermissionSetId = objectEditOnly.Id);
        System.runAs(fixture) {
            System.assert(Event.SObjectType.getDescribe().isCreateable());
            System.assert(Event.SObjectType.getDescribe().isUpdateable());
            System.assert(Event.Description.getDescribe().isAccessible());
            System.assertEquals(false, Event.Description.getDescribe().isUpdateable());
            Event existing = ownedFixture();
            Boolean createDenied = false;
            Boolean updateDenied = false;
            Test.startTest();
            try {
                ForceCalendarController.createEvent('Denied FLS', windowStart(),
                    windowStart().addHours(1), false, 'Denied', 'Denied', null, null);
            } catch (AuraHandledException error) { createDenied = true; }
            try {
                ForceCalendarController.updateEvent(existing.Id, null, null,
                    null, null, 'Denied', null);
            } catch (AuraHandledException error) { updateDenied = true; }
            Test.stopTest();
            System.assert(createDenied, 'Event create must enforce field edit permission');
            System.assert(updateDenied, 'Event update must enforce field edit permission');
            System.assertEquals(1, [SELECT COUNT() FROM Event]);
            System.assertEquals('Synthetic test only',
                [SELECT Description FROM Event WHERE Id = :existing.Id].Description);
        }
    }

    @IsTest
    static void permissionSetsDoNotGrantBroadOrRelatedRecordAccess() {
        Set<String> names = new Set<String>{'ForceCalendarReader', 'ForceCalendarEditor'};
        List<PermissionSet> permissions = [
            SELECT Id, Name, PermissionsActivitiesAccess, PermissionsEditEvent,
                PermissionsEditTask, PermissionsViewAllData, PermissionsModifyAllData
            FROM PermissionSet WHERE Name IN :names
        ];
        System.assertEquals(2, permissions.size());
        Set<Id> permissionIds = new Set<Id>();
        for (PermissionSet grants : permissions) {
            permissionIds.add(grants.Id);
            System.assert(grants.PermissionsActivitiesAccess);
            System.assertEquals(grants.Name == 'ForceCalendarEditor', grants.PermissionsEditEvent);
            System.assertEquals(false, grants.PermissionsEditTask);
            System.assertEquals(false, grants.PermissionsViewAllData);
            System.assertEquals(false, grants.PermissionsModifyAllData);
        }
        Set<String> allowedFields = new Set<String>{
            'Event.Description', 'Event.IsAllDayEvent', 'Event.Location', 'Event.LocationId',
            'Event.WhatId', 'Event.WhoId', 'Task.Description', 'Task.WhatId', 'Task.WhoId'
        };
        for (FieldPermissions permission : [
            SELECT Field, SobjectType, PermissionsRead, PermissionsEdit, Parent.Name
            FROM FieldPermissions WHERE ParentId IN :permissionIds
        ]) {
            System.assert(allowedFields.contains(permission.Field), 'Only documented fields are granted');
            System.assert(permission.PermissionsRead);
            System.assertEquals(permission.Parent.Name == 'ForceCalendarEditor', permission.PermissionsEdit);
        }
        System.assertEquals(10, [SELECT COUNT() FROM FieldPermissions
            WHERE ParentId IN :permissionIds AND SobjectType = 'Event'],
            'Each set must grant all five required Event fields');
        System.assertEquals(6, [SELECT COUNT() FROM FieldPermissions
            WHERE ParentId IN :permissionIds AND SobjectType = 'Task'],
            'Shared Activity grants must survive initial installation and redeployment');
        Id controllerId = [SELECT Id FROM ApexClass WHERE Name = 'ForceCalendarController' LIMIT 1].Id;
        System.assertEquals(2, [SELECT COUNT() FROM SetupEntityAccess
            WHERE ParentId IN :permissionIds AND SetupEntityId = :controllerId],
            'Both sets must include the Apex controller access needed by Lightning');
        System.assertEquals(0, [SELECT COUNT() FROM ObjectPermissions WHERE ParentId IN :permissionIds],
            'No unrelated-object or sharing-bypass grants belong in these permission sets');
    }
}
