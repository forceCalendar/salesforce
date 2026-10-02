# Salesforce permission setup

Choose one permission set according to the intended user's role. Installing does not assign any permission set.

| Optional set | Grants |
| --- | --- |
| ForceCalendar Access | ForceCalendarController Apex access only |
| ForceCalendar Reader | Controller access, Access Activities, and read FLS for Event Description, IsAllDayEvent, Location, WhoId and WhatId |
| ForceCalendar Editor | Reader capabilities, Edit Events, and edit FLS for the five fields above |

Edit Events permits creating, updating and deleting Events that Salesforce sharing permits. No set grants View All, Modify All, Edit Tasks, or related-object access. Permission sets are additive: assigning Reader cannot revoke permissions already granted by a profile or another set. The component's `readOnly` setting disables editing UI but is not an authorization boundary.

## Platform scope and prerequisites

Salesforce does not retain Event `objectPermissions` declarations in permission-set metadata. Activity user permissions are the supported controls. Access Activities also applies to Task/calendar/email activity access. Salesforce shares Description, WhoId and WhatId FLS with Task. The metadata explicitly includes those three Task counterparts so Salesforce retains the shared Event grants during redeployment or upgrades. Subject, StartDateTime and EndDateTime have no independent configurable FLS.

- Verify the user's Salesforce license supports activities and these permissions.
- Assign the selected set through your ordinary administration process.
- Grant access to related records/objects only where needed. A Contact/Lead record page needs that person's object and record access; supported other record pages need the corresponding access. The calendar does not grant those permissions for you.
- Configure sharing through your existing access model. Private or unshared Events must remain protected.
- Enable Lightning Web Security; the third-party custom element is unsupported under Lightning Locker.
- For intentionally view-only pages, enable the component’s `readOnly` setting in Lightning App Builder. Permission sets themselves do not configure page UI.
- Verify as an intended user before wider deployment. These sets do not override other grants or organization policies.

Standalone own-calendar listing conditionally omits inaccessible optional relationship fields. A record-context query fails closed when its object or record is inaccessible.

See Salesforce's [activity access permissions](https://help.salesforce.com/s/articleView?id=sf.activity_access_user_perm.htm&language=en_US&type=5). Isolated Apex fixture tests verify both allowed and denied paths; no persistent test users or assignments are created by those tests.
