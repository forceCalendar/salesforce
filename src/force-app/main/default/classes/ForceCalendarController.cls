public with sharing class ForceCalendarController {
    
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getEvents(Datetime startDateTime, Datetime endDateTime) {
        List<Map<String, Object>> results = new List<Map<String, Object>>();
        
        // Fetch standard Salesforce Events
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
            // Default Salesforce Blue
            entry.put('backgroundColor', '#0176D3');
            results.add(entry);
        }
        
        return results;
    }
}