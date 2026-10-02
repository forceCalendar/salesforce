# Verification scope — October 2, 2026

## Tested 0.3 release contents

Interface commit `3dbfee020791ea82a457381cf3b0dc415c88ff55` and published core `2.5.6` add existing-event details, editing and confirmed deletion. The dependency lockfile pins the published core 2.5.6 and interface 1.9.0 artifacts. A clean root/src dependency installation and normal npm test pass all 38 tests with zero skips; the rebuilt resource is byte-identical to the live-tested candidate. A prior 0.2 beta installer does not contain these new features.

Verified:

- 38 Salesforce LWC/Jest tests passed with zero skips in UTC, America/Los_Angeles, Asia/Kolkata and Pacific/Auckland, using the real bundled interface. Apex transport alone is mocked.
- Tests cover cold load/reconnect, snapshots without feedback CRUD, Location and record context payloads, readOnly guards, UI edit/delete, rejected writes restoring confirmed state, pending-change preservation, per-record write ordering, temporary-to-Salesforce ID continuity, navigation and detach isolation, and refresh failure without duplicate writes.
- 25 main Apex tests passed in the scratch org, including Event CRUD, dates/overlap, Location, Contact/Lead WhoId, Account WhatId, filtered reload, rejected inaccessible/unsupported/deleted associations, Minimum Access denial, private-event protection, and native recurrence mutation rejection.
- Seven additional permission tests assign the actual Reader/Editor sets only to rollback fixtures. All 32 combined tests passed the all-day regression run; the earlier 30-test permissions suite also passed identical redeployment. Post-commit metadata readback confirms five Event fields and three shared Task counterparts remain intact. No persistent fixture users or Reader/Editor assignments were created.
- Candidate controller/LWC/static resource were retrieved from the development org and matched the deployed source. Bundle SHA-256: `dfc40d4e5aee8da0e448990c800dfbb28deaf8e92f0441bb250ea5c3d793078d`.

Live production-LWC create/read/edit/delete was verified with one uniquely named synthetic Event. Server queries confirmed exactly one created record, updated fields on the same ID, and zero active matching fixtures after confirmed deletion. Browser checks include refresh/navigation persistence and cancellation. No existing real Event was edited.

Inclusive all-day dates now have separate civil-date transport. Same-day, multi-day, DST transitions and UTC/negative/positive timezones are covered by the LWC and Apex tests. Salesforce’s native StartDateTime/EndDateTime represent inclusive all-day civil dates at UTC midnight; no blanket day subtraction or historical-data repair is performed. Live multi-day (October 5–7 inclusive), same-day (October 6), and all-day-to-timed conversion passed with server-side date/flag/duration corroboration. All corresponding synthetic records were deleted and the final query found zero active matching records.

Unlocked beta **0.3.0.1** (`04tg5000000ExTFAA0`) installed into the disposable scratch org after the old package and test-only metadata were removed; both installed-package and matching-Apex-class baselines were empty. All 32 test methods plus setup passed after installation (33 results), with zero failures/skips. Package creation coverage is 98%; post-install test-run coverage is 99%. The installer is still a beta: irreversible release promotion has not been performed. No comprehensive security audit or assistive-technology certification is claimed.

## Intentional boundaries

- Native Salesforce recurring Events are readable but edited/deleted through Salesforce Calendar. The interface marker and server guard protect unsupported series/occurrence semantics.
- Production color selection is hidden: standard Event records have no mapped custom color field and use Salesforce blue. The standalone synthetic demo retains color selection.
- Permission sets are optional and additive. No assignment is automatic, no set bypasses sharing, and related records still require their own access. See [permission setup](PERMISSIONS.md).
- Lightning Web Security is required; Lightning Locker does not support these third-party custom elements.

## Previously verified baseline

Unlocked beta 0.2.0.2, core 2.5.5/interface 1.8.1, installed into a clean disposable scratch org with zero preinstalled packages. Its 22 Apex test methods passed, with 96% coverage; metadata and resource contents matched. That baseline lacks the candidate existing-event editing/deletion interface and new Reader/Editor sets. It has not been promoted to a production release.

Screenshots were captured during verification using only synthetic fixtures, but image assets are not included in this public source update.


## Minor nonblocking polish

Date-only inputs use native browser styling, and some navigation accessibility labels retain month wording in day view. These do not change the verified date or CRUD behavior.
