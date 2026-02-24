public with sharing class ForceCalendarController {

    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getEvents(
        Datetime startDateTime,
        Datetime endDateTime,
        Id recordId
    ) {
        try {
            if (startDateTime == null || endDateTime == null) {
                throw new AuraHandledException('Start and end dates are required');
            }

            List<Map<String, Object>> results = new List<Map<String, Object>>();

            String query = 'SELECT Id, Subject, StartDateTime, EndDateTime, IsAllDayEvent, Description, Location, WhoId, WhatId'
                + ' FROM Event'
                + ' WHERE StartDateTime >= :startDateTime AND EndDateTime <= :endDateTime';

            if (recordId != null) {
                query += ' AND (WhoId = :recordId OR WhatId = :recordId)';
            }

            query += ' WITH SECURITY_ENFORCED ORDER BY StartDateTime ASC LIMIT 1000';

            for (Event evt : Database.query(query)) {
                Map<String, Object> entry = new Map<String, Object>();
                entry.put('id', evt.Id);
                entry.put('title', evt.Subject);
                entry.put('start', evt.StartDateTime);
                entry.put('end', evt.EndDateTime);
                entry.put('allDay', evt.IsAllDayEvent);
                entry.put('description', evt.Description);
                entry.put('location', evt.Location);
                entry.put('whoId', evt.WhoId);
                entry.put('whatId', evt.WhatId);
                entry.put('backgroundColor', '#0176D3');
                results.add(entry);
            }

            return results;
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static Id createEvent(
        String title,
        Datetime startDateTime,
        Datetime endDateTime,
        Boolean isAllDay,
        String description,
        String location,
        Id whoId,
        Id whatId
    ) {
        try {
            if (!Schema.sObjectType.Event.isCreateable()) {
                throw new AuraHandledException('You do not have permission to create events');
            }

            if (String.isBlank(title)) {
                throw new AuraHandledException('Event title is required');
            }
            if (startDateTime == null || endDateTime == null) {
                throw new AuraHandledException('Start and end dates are required');
            }
            if (endDateTime <= startDateTime) {
                throw new AuraHandledException('End date must be after start date');
            }

            Event evt = new Event();
            evt.Subject = title.trim();
            evt.StartDateTime = startDateTime;
            evt.EndDateTime = endDateTime;
            evt.IsAllDayEvent = isAllDay != null ? isAllDay : false;
            evt.Description = description != null ? description.trim() : null;
            evt.Location = location != null ? location.trim() : null;
            if (whoId != null) {
                evt.WhoId = whoId;
            }
            if (whatId != null) {
                evt.WhatId = whatId;
            }

            insert evt;
            return evt.Id;
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void updateEvent(
        Id eventId,
        String title,
        Datetime startDateTime,
        Datetime endDateTime,
        Boolean isAllDay,
        String description,
        String location
    ) {
        try {
            if (!Schema.sObjectType.Event.isUpdateable()) {
                throw new AuraHandledException('You do not have permission to update events');
            }

            if (eventId == null) {
                throw new AuraHandledException('Event ID is required');
            }

            List<Event> events = [
                SELECT Id, Subject, StartDateTime, EndDateTime, IsAllDayEvent, Description, Location
                FROM Event
                WHERE Id = :eventId
                WITH SECURITY_ENFORCED
                LIMIT 1
            ];

            if (events.isEmpty()) {
                throw new AuraHandledException('Event not found');
            }

            Event evt = events[0];

            if (title != null) {
                if (String.isBlank(title)) {
                    throw new AuraHandledException('Event title cannot be empty');
                }
                evt.Subject = title.trim();
            }
            if (startDateTime != null) evt.StartDateTime = startDateTime;
            if (endDateTime != null) evt.EndDateTime = endDateTime;
            if (isAllDay != null) evt.IsAllDayEvent = isAllDay;
            if (description != null) evt.Description = description.trim();
            if (location != null) evt.Location = location.trim();

            if (evt.EndDateTime <= evt.StartDateTime) {
                throw new AuraHandledException('End date must be after start date');
            }

            update evt;
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteEvent(Id eventId) {
        try {
            if (!Schema.sObjectType.Event.isDeletable()) {
                throw new AuraHandledException('You do not have permission to delete events');
            }

            if (eventId == null) {
                throw new AuraHandledException('Event ID is required');
            }

            List<Event> events = [
                SELECT Id
                FROM Event
                WHERE Id = :eventId
                WITH SECURITY_ENFORCED
                LIMIT 1
            ];

            if (events.isEmpty()) {
                throw new AuraHandledException('Event not found');
            }

            delete events[0];
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
