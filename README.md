# ForceCalendar Salesforce

Lightning Web Component calendar for Salesforce, built on @forcecalendar/core and @forcecalendar/interface.

## Structure

```
/src        - Development (uses npm packages)
/dist       - Distribution (pre-bundled, no npm needed)
```

## For Developers

```bash
cd src
npm install
# Make changes
sf project deploy start
```

## For Salesforce Users

Download from [Releases](https://github.com/forceCalendar/salesforce/releases) and deploy:

```bash
sf project deploy start
```

## Build

```bash
npm run build  # Creates /dist
```