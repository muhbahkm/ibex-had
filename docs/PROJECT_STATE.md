# IBEX 2.0 — Project State

Last updated: 2026-08-11

## Current Phase
**V1 Domain/Schema Freeze Candidate 2 and isolated Android foundation spike execution. Production IBEX 2.0 application scaffold has not started.**

## Completed
- Legacy repository inspected and production Supabase project `IBEX_26` identified.
- Production Supabase redesign boundary fixed as **READ ONLY**.
- GitHub established as source of truth for code/schema/tests/contracts/project state.
- Notion established as documentation/decision/planning/execution ledger.
- Product vision, architecture, database, accounting, inventory, POS, security, backup, sync, migration, testing, roadmap, design, and continuity areas documented.
- Approved visual direction recorded: calm, premium, minimal, generous whitespace, restrained motion, Arabic RTL, Latin digits only, Noto typography baseline.
- ADR-009 accepted: **IBEX Operating Engine** centralizes operational business logic.
- ADR-010 accepted: **Canonical Domain Modules**.
- ADR-011 accepted: **Reusable Behavior Ownership**.
- Central Modules Catalog and Reuse/Ownership Rules documented.
- Command Traceability Matrix completed.
- Ownership & Traceability Matrix completed.
- Document Lifecycle Contract completed.
- Domain Error Catalog completed.
- Database schema updated to **Freeze Candidate 2**.
- Full Architecture Cross-Review completed.
- Technical Spike Plan V1 completed.
- Physical schema decisions ADR-012..ADR-016 accepted for returns, stock transfer, tax-ready metadata, quantity precision, and visible numbering.
- Isolated branch `spike/android-foundation-v1` created.
- First executable spike slice committed under `spike/ibex_foundation/`:
  - `Money` Int64-scale `1e4` domain value object;
  - `Quantity` Int64-scale `1e6` domain value object;
  - `ExchangeRate` scale `1e8` with half-away-from-zero conversion;
  - Latin-digit-only numeric boundary parsing;
  - canonical document-number formatter;
  - Android secure-storage-backed local database key-store candidate;
  - unit tests for numeric, precision, currency, digit, and numbering invariants.

## Current Constraints
- Production Supabase: **READ ONLY**.
- Android first.
- Local-first runtime.
- Arabic RTL first.
- Latin digits only (`0-9`).
- Calm/premium/minimal design language.
- Noto Sans Arabic + Noto Sans baseline pending device validation.
- No UI, report, dashboard, import, sync, automation, repository adapter, or future AI component may create competing financial/inventory/settlement/document-lifecycle/permission truth.
- No new phase advances unless previous phase gates and regression checks pass.

## Accepted Core Invariants
- Double-entry accounting.
- Moving Weighted Average inventory valuation.
- Money stored as signed Int64 scaled by 10,000.
- FX rates scaled by 100,000,000.
- Quantity stored as signed Int64 scaled by 1,000,000 with per-unit allowed/display precision.
- Half-away-from-zero rounding.
- Posted documents immutable.
- Reversal/correction through linked compensating records.
- Negative stock blocked for V1 posting.
- Inventory balances are rebuildable projections from stock movements.
- Payment allocations are explicit.
- Cash accounts map to ledger accounts.
- Transaction/base-currency snapshots freeze at posting.
- Operation IDs provide idempotency/correlation basis.
- Audit is append-only by application contract.
- Document numbering has one transactional canonical owner.

## Android Foundation Spike — Current Evidence
Dependency baseline was checked against current package documentation before code was committed:
- Drift 2.34.x / sqlite3 3.x architecture;
- sqlite3 Flutter legacy helper libraries intentionally excluded;
- flutter_secure_storage 10.x selected only as a spike candidate for key protection;
- no database encryption provider has been accepted yet.

The current committed code is deliberately limited to contracts that can be validated before database wiring. It must not be promoted to production until executable tests and representative-device evidence pass.

## Next Planned Work
1. Validate/update the spike package against the current Flutter stable toolchain.
2. Add the minimal Drift schema for `PostSale`: business, user/permission, product, warehouse, inventory balance/movement, sale/line, accounts/journal, cash/payment/allocation, operation log, audit, and document sequences.
3. Implement transaction runner and persistent document-sequence allocation with rollback proof.
4. Implement operation-id idempotency persistence.
5. Implement the first `PostSale` Operating Engine vertical slice using synthetic data only.
6. Add journal-balance and negative-stock rollback tests.
7. Select and wire an encrypted sqlite3 v3-compatible provider in the spike only; validate wrong-key/open/migration/backup/restore behavior.
8. Generate/validate the Android host project and test Noto, RTL, Latin digits, motion, barcode, printing, and performance on representative hardware.
9. Document every pass/failure in GitHub + Notion.
10. Only after all critical spike gates pass: issue final V1 Domain/Schema Freeze and scaffold the production Android app.

## Resume Protocol
Use `IBEX2-CONTINUE` in a new conversation, then read `PROJECT_CONTEXT.md`, this file, `docs/DECISIONS.md`, `docs/PHYSICAL_SCHEMA_DECISIONS_V1.md`, `docs/FULL_CROSS_REVIEW_V1.md`, `docs/TECHNICAL_SPIKE_PLAN_V1.md`, `docs/DATABASE_SCHEMA_V1.md`, `docs/OPERATING_ENGINE_V1.md`, `docs/COMMAND_TRACEABILITY_V1.md`, `docs/CENTRAL_MODULES_CATALOG_V1.md`, `docs/OWNERSHIP_TRACEABILITY_V1.md`, `docs/DOCUMENT_LIFECYCLE_V1.md`, `docs/DOMAIN_ERROR_CATALOG_V1.md`, `docs/DESIGN_SYSTEM.md`, and `spike/FOUNDATION_SPIKE_SCOPE.md` before taking action.
