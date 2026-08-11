# IBEX 2.0 — Android Foundation Spike Execution Log

Status: **Active validation — not production-approved**

## 2026-08-11 — PostSale hardening slice

### Implemented
- Removed hard-coded YER base-currency assumption from `PostSaleService`; command-owned `baseCurrencyCode` is now authoritative for the spike.
- Added normalized ISO-style 3-letter Latin currency validation at the application boundary.
- Added pre-validation aggregation of requested quantity by product before any stock-affecting write.
- Fixed repeated-product-line handling so canonical inventory balance is updated once per product using the aggregate quantity and aggregate COGS.
- Preserved individual sale lines and stock movement lines for audit/detail while using one canonical balance update per product.
- Added deterministic spike-only failure injection points:
  - `after_sequence`
  - `after_first_inventory_write`
  - `before_commit`
- Added tests proving that injected failures must roll back visible document sequence allocation, sale rows, sale items, stock movements, stock movement items, journal entries, journal lines, payments, operation log, audit log, and inventory balance changes.
- Added recovery expectation that the next successful sale after a rolled-back sequence allocation receives `SAL-2026-000001`, proving no committed numbering gap from the failed transaction.
- Added explicit test that repeated lines for one product cannot collectively overdraw stock.
- Added explicit test that repeated lines within available stock reduce quantity/value correctly.
- Added explicit non-YER base-currency conversion test (`USD` transaction -> `SAR` base) to detect accidental YER coupling.

### Invariants under validation
1. One operation ID creates at most one canonical sale truth.
2. Required stock is validated in aggregate per product, not line-by-line in isolation.
3. Inventory balance mutation occurs once per product per PostSale transaction.
4. Commercial, stock, accounting, payment, audit, operation and numbering effects share one DB transaction.
5. Any injected exception before transaction commit must leave zero partial posted truth.
6. Base currency is business/application context, never a global hard-coded currency.

## 2026-08-11 — Encrypted persistence + migration evidence

### Passed in Linux CI
- sqlite3mc encrypted database creation/open.
- plaintext SQLite header absence check.
- correct-key reopen of persisted operational truth.
- wrong-key rejection.
- encrypted backup creation with SHA-256 manifest validation.
- backup corruption detection before restore.
- backup → delete → restore → reconciliation for sale, inventory, journal, payment, operation log and audit evidence.
- encrypted schema migration from v1 to v2.
- migration preserves historical sale truth and does not invent missing historical base currency.
- Migration Gate CI run `31464336669` completed successfully through dependency resolution, Drift generation, `flutter analyze`, and `flutter test`.

## 2026-08-11 — Android Runtime Gate passed

### Verified on Android emulator
- Android Runtime Gate run `31482010165` completed with conclusion `success`.
- Flutter dependency resolution and Drift generation completed successfully.
- Disposable Android host generation completed successfully.
- Android debug build completed successfully.
- KVM-backed Android emulator startup completed successfully.
- The encrypted persistence integration test completed successfully on the Android emulator.
- The runtime test exercised app-private storage, secure-key creation/read/reuse, sqlite3mc database creation, atomic `PostSale`, close/reopen, encrypted-header check, wrong-key rejection, encrypted backup, database deletion, restore, operational reconciliation, and secure-key persistence during the test session.

### What this proves
The selected Flutter + Drift + sqlite3 3.x + sqlite3mc direction is technically viable on an Android emulator for the tested encrypted local-first slice. The Android packaging path can build and execute the native encrypted SQLite runtime, and the tested secure-storage-backed key flow can reopen the same encrypted database during the integration-test lifecycle.

### What remains unproven
- Representative physical Android device behavior.
- Key persistence across real process death / reboot / upgrade scenarios.
- Android backup/restore interactions and device migration policy.
- Performance on representative low/mid-range devices.
- Production hardening of Android manifest, backup exclusion, release signing, and secure-storage options.

### Promotion rule
The emulator gate is now **Passed**, but production scaffold promotion still requires representative-device security/runtime validation and the remaining critical foundation gates.
