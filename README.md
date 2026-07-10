# forceCalendar for Salesforce

[![Build & Release](https://github.com/forceCalendar/salesforce/actions/workflows/build-release.yml/badge.svg)](https://github.com/forceCalendar/salesforce/actions/workflows/build-release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Website](https://img.shields.io/badge/forcecalendar.org-website-0ea5e9)](https://forcecalendar.org/salesforce)

A native Salesforce Lightning Web Component implementation of [forceCalendar](https://forcecalendar.org) — an enterprise scheduling interface over the standard `Event` sObject, fully compatible with Lightning Locker Service and Lightning Web Security.

This repository contains **packaging and build tooling only**. The calendar itself lives in [`@forcecalendar/core`](https://github.com/forceCalendar/core) (engine) and [`@forcecalendar/interface`](https://github.com/forceCalendar/interface) (Web Components); this repo bundles them into a deployable Salesforce DX source tree.

## Install into your org

No npm required — everything is pre-bundled.

1. Download `forcecalendar-salesforce-dist.zip` from the [latest release](https://github.com/forceCalendar/salesforce/releases/latest) and unzip it.
2. Deploy with the Salesforce CLI:

```bash
cd dist
sf project deploy start --target-org your-org-alias
```

(or run the generated `deploy.sh` / `deploy.bat`)

3. Drag the **forceCalendar** component onto any App, Record, or Home page in Lightning App Builder. Design attributes: `currentView` (`month`/`week`/`day`), `height`, `readOnly`.

## What gets deployed

| Artifact | Purpose |
|---|---|
| `staticresources/forcecalendar.js` | Single-file bundle of `@forcecalendar/interface` + `@forcecalendar/core` |
| `lwc/forceCalendar` | Production component — loads the bundle, renders `<forcecal-main>`, wires events to Apex |
| `lwc/forceCalendarDemo` | Standalone demo with generated sample events (no data access) |
| `classes/ForceCalendarController` | Apex data layer over the standard `Event` sObject (`WITH SECURITY_ENFORCED`, CRUD checks) |

Data flow: **`Event` sObject → Apex → LWC → `<forcecal-main>` Web Component**, with user actions (create/update/delete, navigation) flowing back the same way.

## Build from source

```bash
npm install
cd src && npm install && cd ..
npm run build          # bundles the static resource and assembles dist/
```

## Contributing & security

See the organization-wide [contributing guide](https://github.com/forceCalendar/.github/blob/main/CONTRIBUTING.md) and [security policy](https://github.com/forceCalendar/.github/blob/main/SECURITY.md).

## License

[MIT](LICENSE)
