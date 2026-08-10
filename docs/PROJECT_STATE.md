# IBEX 2.0 — Project State

Last updated: 2026-08-11

## Current Phase
**V1 Domain/Schema Freeze Candidate 2 complete enough for isolated Android technical-spike execution. Production application scaffold has not started.**

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
- ADR-012 accepted: dedicated immutable sales/purchase return documents.
- ADR-013 accepted: one stock-transfer document creates paired source/destination stock movements atomically.
- ADR-014 accepted: tax-ready metadata only; tax behavior disabled in V1.
- ADR-015 accepted: fixed canonical quantity scale 1e6 with unit precision policy 0..6 decimals.
- ADR-016 accepted: application-owned transactional visible document numbering; UUID remains canonical identity.
- All five former physical-schema clarifications are closed.

## Current Constraints
- Production Supabase: **READ ONLY**.
- Android first.
- Local-first runtime.
- Arabic RTL first.
- Latin digits only (`0-9`).
- Calm/premium/minimal design language.
- Noto Sans Arabic + Noto Sans baseline pending device validation.
- No UI, report, dashboard, import, sync, automation, repository adapter, or future AI component may create competing financial/inventory/settlement/document-lifecycle/permission truth.
- No new production phase advances unless previous phase gates and regression checks pass.

## Accepted Core Invariants
- Double-entry accounting.
- Moving Weighted Average inventory valuation.
- Money stored as signed Int64 scaled by 10,000.
- FX/tax rates scaled by 100,000,000.
- Quantity stored as signed Int64 scaled by 1,000,000.
- Unit metadata controls allowed/display quantity decimals from 0 to 6.
- Half-away-from-zero monetary rounding.
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
- Human document numbers are not SQLite row IDs.
- Tax behavior remains disabled until explicit approved rules exist.

## Closed Physical Movement/Schema Decisions
### Returns
Dedicated `sales_returns` / `sales_return_items` and `purchase_returns` / `purchase_return_items`, linked to source documents and source lines. Returns create compensating effects and never mutate posted source truth.

### Warehouse transfers
`stock_transfers` / `stock_transfer_items` is the business document. Posting creates one `TRANSFER_OUT` movement for the source warehouse and one `TRANSFER_IN` movement for the destination warehouse inside one transaction, preserving carrying value.

### Quantity precision
Canonical quantity/conversion factor scale = 1e6. `units.allowed_decimals` and `units.display_decimals` govern input/presentation precision.

### Tax readiness
Minimal tax registration and posted snapshot fields exist, but `tax_enabled=false` forces tax mode disabled and tax amounts to zero.

### Visible numbering
`document_sequences` allocates business/document/year scoped numbers transactionally, with defaults such as `SAL-2026-000001`; UUID remains canonical identity.

## Technical Spike
The next executable work is an isolated spike, not the production scaffold.

Planned validation:
- Flutter Android;
- Drift + SQLite;
- encrypted SQLite candidate;
- Android Keystore key protection;
- encrypted migration + backup/restore;
- Money/Quantity/FX value objects;
- minimal local `PostSale` vertical slice proving authorization, stock validation, sale + journal + stock + payment/allocation + operation log + audit under one transaction and rollback;
- stock-transfer paired movement transaction test;
- return quantity ceiling / compensating movement test;
- transactional document-sequence rollback test;
- Noto + RTL + Latin digits + approved motion/design language;
- barcode baseline;
- 58mm/80mm thermal print baseline;
- performance evidence.

Target branch: `spike/android-foundation-v1`.

## Current Design Artifacts
- `docs/DATABASE_SCHEMA_V1.md`
- `docs/PHYSICAL_SCHEMA_DECISIONS_V1.md`
- `docs/FULL_CROSS_REVIEW_V1.md`
- `docs/TECHNICAL_SPIKE_PLAN_V1.md`
- `docs/OPERATING_ENGINE_V1.md`
- `docs/COMMAND_CATALOG_V1.md`
- `docs/COMMAND_TRACEABILITY_V1.md`
- `docs/CENTRAL_MODULES_CATALOG_V1.md`
- `docs/REUSE_OWNERSHIP_RULES_V1.md`
- `docs/OWNERSHIP_TRACEABILITY_V1.md`
- `docs/DOCUMENT_LIFECYCLE_V1.md`
- `docs/DOMAIN_ERROR_CATALOG_V1.md`
- `docs/POSTING_MATRIX_V1.md`
- `docs/INVENTORY_MOVEMENT_MATRIX_V1.md`
- `docs/ACCEPTANCE_TEST_MATRIX_V1.md`
- `docs/BACKUP_RESTORE_CONTRACT_V1.md`
- `docs/ENCRYPTION_SPIKE_CRITERIA.md`
- `docs/DESIGN_SYSTEM.md`

## Remaining Gates Before Production Scaffold
1. Execute isolated Android technical spike with synthetic data only.
2. Validate encrypted SQLite + Android Keystore.
3. Validate Drift migrations under encryption.
4. Validate backup/restore round trip.
5. Validate critical Operating Engine/domain invariants as executable tests.
6. Validate document sequence, return, and transfer behavior under rollback/retry.
7. Validate Noto/RTL/Latin-digit UI direction and motion.
8. Validate thermal printing and barcode baseline.
9. Validate representative Android performance.
10. Complete legacy migration reconciliation validation.
11. Only then issue final V1 Domain/Schema Freeze and scaffold the production IBEX 2.0 application.

## Resume Protocol
Use `IBEX2-CONTINUE` in a new conversation, then read `PROJECT_CONTEXT.md`, this file, `docs/DECISIONS.md`, `docs/PHYSICAL_SCHEMA_DECISIONS_V1.md`, `docs/FULL_CROSS_REVIEW_V1.md`, `docs/TECHNICAL_SPIKE_PLAN_V1.md`, `docs/DATABASE_SCHEMA_V1.md`, `docs/OPERATING_ENGINE_V1.md`, `docs/COMMAND_TRACEABILITY_V1.md`, `docs/CENTRAL_MODULES_CATALOG_V1.md`, `docs/OWNERSHIP_TRACEABILITY_V1.md`, `docs/DOCUMENT_LIFECYCLE_V1.md`, `docs/DOMAIN_ERROR_CATALOG_V1.md`, `docs/DESIGN_SYSTEM.md`, and active acceptance/posting/inventory artifacts before taking action.