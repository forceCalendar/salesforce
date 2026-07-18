# AppExchange Listing Plan

Working document for getting forceCalendar onto the AppExchange. The steps
marked **[human]** need the maintainer's Salesforce identity and cannot be
automated.

## Why AppExchange

It is the distribution channel Salesforce admins actually search, and a
listing carries implicit trust (every listed app passes Salesforce security
review). Today's install path (release zip + `sf project deploy`) selects
for developers; AppExchange reaches admins.

## Path to listing

1. **[human] Join the Partner Program** — sign up at partners.salesforce.com
   (free ISV track), which grants the Partner Business Org.
2. **[human] Create a Dev Hub + namespace** — register a namespace (e.g.
   `forcecal`) in a Developer Edition org, link it to the Dev Hub.
3. **Convert to a managed package** — AppExchange listings require a managed
   (1GP) or managed 2GP package. This repo's SFDX source converts directly:
   `sf package create --package-type Managed --path force-app` under the
   namespace, then `sf package version create`. Namespacing renames the
   components (`forcecal__ForceCalendarController` etc.); the LWC and static
   resource need no code changes.
4. **[human] Submit for security review** — via the Partner Console
   (~$0 for free apps as of the current program). See readiness notes below.
5. **[human] Create the listing** — copy below, plus screenshots.

## Security review readiness

The review focuses on exactly what this project was engineered for:

- **No eval / dynamic code**: none anywhere in the bundle (CI-verifiable:
  `grep -E "eval\(|new Function" dist/.../forcecalendar.js` is empty).
- **Locker/LWS compliance**: the component runs under Lightning Web
  Security today; the custom element is created via `createElement` to
  respect static analysis.
- **CRUD/FLS**: `ForceCalendarController` uses `WITH SECURITY_ENFORCED`
  on queries and explicit `isCreateable/isUpdateable/isDeletable` checks
  before DML.
- **Zero third-party JavaScript**: the static resource contains only
  @forcecalendar code (MIT, same author). Supply-chain review is one
  package family. Public audit page: audit.forcecalendar.org.
- **Data handling**: reads/writes only the standard `Event` object in the
  subscriber org; no external callouts, no data leaves the org.
- **Test coverage**: `ForceCalendarControllerTest` covers the Apex surface;
  run `sf apex run test` in a scratch org before submission.

## Listing copy (draft)

**Title**: forceCalendar — Native Calendar for Lightning

**Tagline**: An accessible, drag-and-drop calendar for the standard Event
object. Zero third-party code, MIT licensed, Locker/LWS native.

**Description**:
forceCalendar is an open-source calendar built specifically for the
Salesforce platform — not a web library wrapped until it fits. Month, week,
and day views over your standard Event records, with drag to reschedule,
drag to create, full keyboard navigation and screen-reader support
(WAI-ARIA grid pattern in every view), RFC 5545 recurrence, timezone/DST
handling, and ICS import/export.

- Installs in minutes, works on App, Record, and Home pages
- Drag events to move or resize; drag empty grid to create
- Accessible by default: keyboard navigation and screen-reader labels
- Zero third-party JavaScript — one MIT-licensed codebase to review
- Respects sharing and FLS (`WITH SECURITY_ENFORCED`, CRUD checks)
- Open source: github.com/forceCalendar — public benchmarks and security audit

**Categories**: Productivity; Calendar & Scheduling
**Pricing**: Free

## Screenshots to capture **[human]**

1. Month view on a Record page with events (light + dark org themes)
2. Mid-drag reschedule with the drop target highlighted
3. Drag-to-create selection on the week view with the event form open
4. Lightning App Builder showing the component's design attributes
