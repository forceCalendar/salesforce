# forceCalendar for Salesforce

[![Build & Release](https://github.com/forceCalendar/salesforce/actions/workflows/build-release.yml/badge.svg)](https://github.com/forceCalendar/salesforce/actions/workflows/build-release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Website](https://img.shields.io/badge/forcecalendar.org-website-0ea5e9)](https://forcecalendar.org/salesforce)

A Salesforce Lightning Web Component implementation of [forceCalendar](https://forcecalendar.org), with a scheduling interface over the standard `Event` sObject. **Lightning Web Security must be enabled**: Salesforce does not support third-party custom elements under Lightning Locker. See [Salesforce custom-element support](https://developer.salesforce.com/docs/platform/lwc/guide/create-use-custom-elements.html).

This repository contains the **Salesforce integration and build tooling**. The calendar engine lives in [`@forcecalendar/core`](https://github.com/forceCalendar/core) and the Web Components in [`@forcecalendar/interface`](https://github.com/forceCalendar/interface); this repo connects them to Apex and bundles them into a deployable Salesforce DX source tree.

## Verified functionality

The production LWC was verified against actual Salesforce Event records using only disposable synthetic fixtures: create, read, edit, cancellation, confirmed delete, refresh/navigation persistence, and inclusive all-day dates. All test records were removed afterward.

Interface 1.9 adds existing-event details, title/location/date editing and confirmed deletion. Native recurring Salesforce Events remain read-only here; manage their series or occurrences in Salesforce Calendar. Restricted-user behavior is covered by isolated Apex tests; an actual restricted-user Lightning session has not been tested. See [verification scope](docs/VERIFICATION.md).

## Install into your org

No npm required — everything is pre-bundled.

**Verified beta 0.3.0.1:** [Install in a sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04tg5000000ExTFAA0) or [install in a Developer Edition org](https://login.salesforce.com/packaging/installPackage.apexp?p0=04tg5000000ExTFAA0). This unlocked beta passed a clean install and all 32 Apex test methods, with 98% package coverage. It has **not** been promoted for production installation. Review [permissions](docs/PERMISSIONS.md) before assigning access.

For a source deployment:

1. Download `forcecalendar-salesforce-dist.zip` from the [latest release](https://github.com/forceCalendar/salesforce/releases/latest) and unzip it.
2. Deploy with the Salesforce CLI:

```bash
cd dist
sf project deploy start --target-org your-org-alias
```

(or run the generated `deploy.sh` / `deploy.bat`)

3. Drag the **Force Calendar** component onto any App, Record, or Home page in Lightning App Builder. Design attributes: `currentView` (`month`/`week`/`day`), `height`, `readOnly`.

Deploy the LWC, Apex controller and static resource together. The updated LWC requires the controller's date-aware `createCalendarEvent` and `updateCalendarEvent` methods and the interface snapshot API. Legacy Apex create/update entry points remain available.

Choose one optional permission set and assign it only to intended users:

- **ForceCalendar Access**: Apex controller access only, for orgs managing their own activity permissions.
- **ForceCalendar Reader**: controller access, Access Activities, and read access to the five permissionable fields used by the component.
- **ForceCalendar Editor**: Reader access plus Edit Events and edit access to those fields. Edit Events permits create/update/delete subject to Salesforce sharing.

No permission set is assigned automatically. These sets do not grant related Account/Contact/Lead access, Edit Tasks, View All or Modify All. Permission sets are additive: Reader cannot revoke write rights a user already has. Access Activities covers activities beyond this calendar; Salesforce shares Description/WhoId/WhatId field permissions with Task. Subject/StartDateTime/EndDateTime do not have independent configurable FLS. See [permission setup and scope](docs/PERMISSIONS.md) before assignment.

Creates on Contact/Lead pages use `WhoId`; supported related-record pages use `WhatId`. Related-record pages require access to that object and record; inaccessible or unsupported contexts fail closed.

`readOnly` disables the interface's editing and dragging controls while preserving navigation and selection. It also blocks the LWC's save callbacks and public `addEvent` method. This UI setting is not a security boundary; Salesforce permissions are enforced independently by Apex.

## What gets deployed

| Artifact | Purpose |
|---|---|
| `staticresources/forcecalendar.js` | Single-file bundle of `@forcecalendar/interface` + `@forcecalendar/core` |
| `lwc/forceCalendar` | Production component — loads the bundle, renders `<forcecal-main>`, wires events to Apex |
| `lwc/forceCalendarDemo` | Standalone demo with generated sample events (no data access) |
| `classes/ForceCalendarController` | Apex data layer over the standard `Event` sObject (sharing, user-mode reads and writes with CRUD/FLS enforcement) |
| `permissionsets/ForceCalendarAccess`, `ForceCalendarReader`, `ForceCalendarEditor` | Optional controller-only, read, and edit permissions; no automatic assignment or sharing bypass |

Data flow: **`Event` sObject → Apex → LWC → `<forcecal-main>` Web Component**, with user actions (create/update/delete, navigation) flowing back the same way.

All-day events use inclusive civil dates: Start date October 5 and Last day October 7 covers three days; a same-day event is valid. The adapter maps these dates explicitly to Salesforce’s native UTC-date fields without shifting them by the browser timezone. Timed events continue to use actual instants. Existing records display their stored dates; there is no automatic historical-date repair.

Fetched events use the interface's `setEvents` snapshot API. Loading, refreshing and changing the visible range never issue Apex create/update/delete calls. Date queries include overlapping events, even when they begin before or finish after the requested window. The range end is inclusive (the LWC sends `23:59:59.999`); events starting exactly at that end are included, while events ending exactly at the range start are excluded.

## Build from source

```bash
npm ci
cd src && npm ci && cd ..
npm run build          # bundles the static resource and assembles dist/
npm test               # builds, compiles the LWC and tests against the real bundle
```

The local Jest suite mocks Apex transport, not the calendar. It covers snapshot safety, CRUD command forwarding, Location, record context, cold loading, reconnects, multiple instances and read-only persistence guards. It does not execute Apex or prove Lightning Web Security behavior in an org.

The pinned bundle uses **core 2.5.6 and interface 1.9.0**. Its read-only UI integration regression runs automatically. For an older local release candidate, `FORCECALENDAR_READONLY_UI=1` explicitly enables the same check against that prebuilt bundle.

After an authorized deployment, run `ForceCalendarControllerTest` in the target org and check restricted users, record-page creation and refresh/navigation in Lightning before promoting the package. Apex tests require an authenticated Salesforce org and are not run by `npm test`.

## Contributing & security

See the organization-wide [contributing guide](https://github.com/forceCalendar/.github/blob/main/CONTRIBUTING.md) and [security policy](https://github.com/forceCalendar/.github/blob/main/SECURITY.md).

## License

[MIT](LICENSE)
