# IBEX 2.0 — Encrypted Local Database Spike Criteria

Status: **Required gate before full application scaffold**

## Purpose
Validate that the selected Flutter/Drift/SQLite encryption approach is reliable on representative Android devices without touching production Supabase.

## Required proof-of-concept
A minimal Android app on an isolated branch must demonstrate:
- Flutter startup and Arabic RTL rendering;
- Drift database creation;
- encrypted SQLite database at rest;
- database key generated on first run, never hard-coded;
- key material protected using Android platform keystore-backed protection;
- app restart can reopen the same encrypted database;
- wrong/missing key cannot open the database;
- database file copied off-device is not readable as plain SQLite;
- insert/read/update within a transaction;
- migration from schema version 1 to version 2 on encrypted database;
- encrypted backup creation and verified restore into a clean app state;
- no sensitive key material appears in logs.

## Device matrix
At minimum test:
- one current Android device/API level;
- one older supported Android API level or representative emulator/device;
- one low/mid-range physical device if available, because startup and crypto overhead matter for POS workflows.

## Performance acceptance
Measure and record:
- cold database open time;
- warm reopen time;
- 1,000-row transactional insert benchmark;
- representative sales posting transaction;
- backup and restore timing for a representative dataset.

No fixed numeric threshold is imposed before measurement, but the result must be documented and judged acceptable for interactive POS use.

## Failure recovery
The spike must prove that:
- a failed migration rolls back safely;
- a corrupted database is detected;
- a corrupted backup is rejected;
- loss of keystore-bound key material has a documented recovery implication and does not lead to insecure fallback.

## Dependency rules
- Pin dependency versions in `pubspec.lock`.
- Do not use obsolete encryption packages when the current SQLite integration provides the supported route.
- Record exact dependency versions and native encryption backend used in the spike report.

## Exit criteria
This gate passes only when:
1. all functional checks succeed;
2. device results are documented in Notion;
3. no plaintext database or hard-coded key is found;
4. backup/restore works on a clean install;
5. the branch has automated tests for migrations and basic persistence;
6. the result is reviewed before merging to `main`.
