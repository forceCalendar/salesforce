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
            if (endDateTime <= startDateTime) {
                throw new AuraHandledException('End date must be after start date');
            }

            List<Map<String, Object>> results = new List<Map<String, Object>>();

            // The LWC supplies an inclusive end-of-day. Events ending exactly
            // at the range start do not overlap; events starting at its end do.
            // Salesforce hides polymorphic activity fields when none of their
            // referenced objects is readable, even if Event field FLS is granted.
            // Do not require broad Contact/Account access just to read own events.
            Boolean readWho = Event.WhoId.getDescribe().isAccessible();
            Boolean readWhat = Event.WhatId.getDescribe().isAccessible();
            Date allDayRangeEnd = endDateTime.dateGMT();
            Datetime allDayRangeStart = Datetime.newInstanceGMT(startDateTime.dateGMT(), Time.newInstance(0, 0, 0, 0));
            String relationshipFields = (readWho ? ', WhoId' : '') + (readWhat ? ', WhatId' : '');
            String query = 'SELECT Id, Subject, ActivityDate, StartDateTime, EndDateTime, IsAllDayEvent, Description, Location, IsRecurrence, IsRecurrence2, RecurrenceActivityId, IsRecurrence2Exception, IsRecurrence2Exclusion' + relationshipFields
                + ' FROM Event'
                + ' WHERE ((IsAllDayEvent = false AND StartDateTime <= :endDateTime AND EndDateTime > :startDateTime)'
                + ' OR (IsAllDayEvent = true AND ActivityDate <= :allDayRangeEnd AND EndDateTime >= :allDayRangeStart))';

            if (recordId != null) {
                Schema.SObjectType contextType = recordId.getSObjectType();
                Boolean isWho = contextType == Contact.SObjectType || contextType == Lead.SObjectType;
                if (!contextType.getDescribe().isAccessible() || (isWho && !readWho) || (!isWho && !readWhat)
                    || (!isWho && !Event.WhatId.getDescribe().getReferenceTo().contains(contextType))) {
                    throw new AuraHandledException('You do not have access to this calendar record context');
                }
                assertReadableRelatedRecord(recordId, isWho);
                query += isWho ? ' AND WhoId = :recordId' : ' AND WhatId = :recordId';
            }

            query += ' WITH USER_MODE ORDER BY StartDateTime ASC LIMIT 1000';

            for (Event evt : Database.query(query)) {
                Map<String, Object> entry = new Map<String, Object>();
                entry.put('id', evt.Id);
                entry.put('title', evt.Subject);
                entry.put('start', evt.StartDateTime);
                entry.put('end', evt.EndDateTime);
                entry.put('allDay', evt.IsAllDayEvent);
                // Native all-day Event dates are inclusive civil dates encoded
                // at UTC midnight, not instants and not an exclusive end.
                entry.put('startDate', evt.IsAllDayEvent ? evt.ActivityDate : null);
                entry.put('lastDay', evt.IsAllDayEvent ? evt.EndDateTime.dateGMT() : null);
                entry.put('description', evt.Description);
                entry.put('location', evt.Location);
                entry.put('whoId', readWho ? evt.get('WhoId') : null);
                entry.put('whatId', readWhat ? evt.get('WhatId') : null);
                entry.put('backgroundColor', '#0176D3');
                entry.put('recurring', isNativeRecurring(evt));
                results.add(entry);
            }

            return results;
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    private static Boolean isNativeRecurring(Event evt) {
        return evt.IsRecurrence || evt.IsRecurrence2 || evt.RecurrenceActivityId != null
            || evt.IsRecurrence2Exception || evt.IsRecurrence2Exclusion;
    }

    private static void assertNonRecurring(Event evt) {
        if (isNativeRecurring(evt)) {
            throw new AuraHandledException('Edit or delete recurring events using Salesforce Calendar');
        }
    }

    private static void assertReadableRelatedRecord(Id recordId, Boolean isWho) {
        Schema.SObjectType relatedType = recordId.getSObjectType();
        Boolean supported = isWho
            ? relatedType == Contact.SObjectType || relatedType == Lead.SObjectType
            : Event.WhatId.getDescribe().getReferenceTo().contains(relatedType);
        if (!supported || !relatedType.getDescribe().isAccessible()) {
            throw new AuraHandledException('You do not have access to this calendar record context');
        }
        String query = 'SELECT Id FROM ' + relatedType.getDescribe().getName()
            + ' WHERE Id = :recordId WITH USER_MODE LIMIT 1';
        if (Database.query(query).isEmpty()) {
            throw new AuraHandledException('You do not have access to this calendar record context');
        }
    }

    // Date-aware LWC boundary. Existing Apex entry points remain available for
    // callers that already follow native Salesforce Event date semantics.
    @AuraEnabled
    public static Id createCalendarEvent(String title, Datetime startDateTime,
        Datetime endDateTime, Boolean isAllDay, Date startDate, Date lastDay,
        String description, String location, Id recordId) {
        if (isAllDay == true) {
            List<Datetime> dates = civilDates(startDate, lastDay);
            startDateTime = dates[0]; endDateTime = dates[1];
        }
        return createEventForRecord(title, startDateTime, endDateTime, isAllDay,
            description, location, recordId);
    }

    @AuraEnabled
    public static void updateCalendarEvent(Id eventId, String title,
        Datetime startDateTime, Datetime endDateTime, Boolean isAllDay,
        Date startDate, Date lastDay, String description, String location) {
        if (isAllDay == true) {
            List<Datetime> dates = civilDates(startDate, lastDay);
            startDateTime = dates[0]; endDateTime = dates[1];
        }
        updateEvent(eventId, title, startDateTime, endDateTime, isAllDay, description, location);
    }

    private static List<Datetime> civilDates(Date startDate, Date lastDay) {
        if (startDate == null || lastDay == null || lastDay < startDate) {
            throw new AuraHandledException('A valid start date and inclusive last day are required');
        }
        return new List<Datetime>{
            Datetime.newInstanceGMT(startDate, Time.newInstance(0, 0, 0, 0)),
            Datetime.newInstanceGMT(lastDay, Time.newInstance(0, 0, 0, 0))
        };
    }

    // Preserve the original createEvent Apex API for existing callers. Record
    // page creates resolve their association on the server using schema types.
    @AuraEnabled
    public static Id createEventForRecord(
        String title,
        Datetime startDateTime,
        Datetime endDateTime,
        Boolean isAllDay,
        String description,
        String location,
        Id recordId
    ) {
        Id whoId;
        Id whatId;
        if (recordId != null) {
            Schema.SObjectType recordType = recordId.getSObjectType();
            if (recordType == Contact.SObjectType || recordType == Lead.SObjectType) {
                whoId = recordId;
            } else if (Event.WhatId.getDescribe().getReferenceTo().contains(recordType)) {
                whatId = recordId;
            } else {
                throw new AuraHandledException('This record type cannot be associated with an event');
            }
        }
        return createEvent(title, startDateTime, endDateTime, isAllDay,
            description, location, whoId, whatId);
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
            if (isAllDay == true ? endDateTime.dateGMT() < startDateTime.dateGMT() : endDateTime <= startDateTime) {
                throw new AuraHandledException('End date must be after start date (or the same day for all-day events)');
            }

            if (whoId != null) assertReadableRelatedRecord(whoId, true);
            if (whatId != null) assertReadableRelatedRecord(whatId, false);

            Event evt = new Event();
            evt.Subject = title.trim();
            evt.StartDateTime = startDateTime;
            evt.EndDateTime = endDateTime;
            evt.IsAllDayEvent = isAllDay != null ? isAllDay : false;
            if (description != null) evt.Description = description.trim();
            if (location != null) evt.Location = location.trim();
            if (whoId != null) {
                evt.WhoId = whoId;
            }
            if (whatId != null) {
                evt.WhatId = whatId;
            }

            // Object CRUD alone does not enforce write FLS or related-record access.
            Database.insert(evt, AccessLevel.USER_MODE);
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
                SELECT Id, Subject, StartDateTime, EndDateTime, IsAllDayEvent, Description, Location,
                    IsRecurrence, IsRecurrence2, RecurrenceActivityId, IsRecurrence2Exception, IsRecurrence2Exclusion
                FROM Event
                WHERE Id = :eventId
                WITH USER_MODE
                LIMIT 1
            ];

            if (events.isEmpty()) {
                throw new AuraHandledException('Event not found');
            }

            Event evt = events[0];
            assertNonRecurring(evt);
            // Only write supplied fields. Reusing the queried sObject would
            // also submit untouched fields and require their write permissions.
            Event changes = new Event(Id = eventId);

            if (title != null) {
                if (String.isBlank(title)) {
                    throw new AuraHandledException('Event title cannot be empty');
                }
                changes.Subject = title.trim();
            }
            if (startDateTime != null) changes.StartDateTime = startDateTime;
            if (endDateTime != null) changes.EndDateTime = endDateTime;
            if (isAllDay != null) changes.IsAllDayEvent = isAllDay;
            if (description != null) changes.Description = description.trim();
            if (location != null) changes.Location = location.trim();

            Datetime effectiveStart = startDateTime != null ? startDateTime : evt.StartDateTime;
            Datetime effectiveEnd = endDateTime != null ? endDateTime : evt.EndDateTime;
            Boolean effectiveAllDay = isAllDay != null ? isAllDay : evt.IsAllDayEvent;
            if (effectiveAllDay ? effectiveEnd.dateGMT() < effectiveStart.dateGMT() : effectiveEnd <= effectiveStart) {
                throw new AuraHandledException('End date must be after start date (or the same day for all-day events)');
            }

            Database.update(changes, AccessLevel.USER_MODE);
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
                SELECT Id, IsRecurrence, IsRecurrence2, RecurrenceActivityId, IsRecurrence2Exception, IsRecurrence2Exclusion
                FROM Event
                WHERE Id = :eventId
                WITH USER_MODE
                LIMIT 1
            ];

            if (events.isEmpty()) {
                throw new AuraHandledException('Event not found');
            }

            assertNonRecurring(events[0]);
            Database.delete(events[0], AccessLevel.USER_MODE);
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
