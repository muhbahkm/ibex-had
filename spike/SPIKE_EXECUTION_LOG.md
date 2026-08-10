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

### CI state
GitHub Actions workflow `IBEX Foundation Spike` is configured to run dependency resolution, Drift generation, static analysis and tests on every spike-package push. The latest run for this slice was queued at the time this log entry was written. A queued/in-progress run is **not** accepted as passing evidence.

### Promotion rule
Do not promote these implementations to the production scaffold until CI passes and the same transaction/encryption behavior is validated on Android runtime with the selected encrypted SQLite provider.
