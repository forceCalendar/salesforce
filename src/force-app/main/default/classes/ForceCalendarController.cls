public with sharing class ForceCalendarController {

    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getEvents(Datetime startDateTime, Datetime endDateTime) {
        List<Map<String, Object>> results = new List<Map<String, Object>>();

        for (Event evt : [
            SELECT Id, Subject, StartDateTime, EndDateTime, IsAllDayEvent, Description
            FROM Event
            WHERE StartDateTime >= :startDateTime AND EndDateTime <= :endDateTime
            WITH SECURITY_ENFORCED
            LIMIT 1000
        ]) {
            Map<String, Object> entry = new Map<String, Object>();
            entry.put('id', evt.Id);
            entry.put('title', evt.Subject);
            entry.put('start', evt.StartDateTime);
            entry.put('end', evt.EndDateTime);
            entry.put('allDay', evt.IsAllDayEvent);
            entry.put('description', evt.Description);
            entry.put('backgroundColor', '#0176D3');
            results.add(entry);
        }

        return results;
    }

    @AuraEnabled
    public static Id createEvent(String title, Datetime startDateTime, Datetime endDateTime, Boolean isAllDay, String description) {
        Event evt = new Event();
        evt.Subject = title;
        evt.StartDateTime = startDateTime;
        evt.EndDateTime = endDateTime;
        evt.IsAllDayEvent = isAllDay != null ? isAllDay : false;
        evt.Description = description;

        insert evt;
        return evt.Id;
    }

    @AuraEnabled
    public static void updateEvent(Id eventId, String title, Datetime startDateTime, Datetime endDateTime, Boolean isAllDay, String description) {
        Event evt = [
            SELECT Id, Subject, StartDateTime, EndDateTime, IsAllDayEvent, Description
            FROM Event
            WHERE Id = :eventId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];

        if (title != null) evt.Subject = title;
        if (startDateTime != null) evt.StartDateTime = startDateTime;
        if (endDateTime != null) evt.EndDateTime = endDateTime;
        if (isAllDay != null) evt.IsAllDayEvent = isAllDay;
        if (description != null) evt.Description = description;

        update evt;
    }

    @AuraEnabled
    public static void deleteEvent(Id eventId) {
        Event evt = [
            SELECT Id
            FROM Event
            WHERE Id = :eventId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];

        delete evt;
    }
}
