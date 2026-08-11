# IBEX 2.0 — Project State

Last updated: 2026-08-11

## Current Phase
**Executable Android/domain spike is green on Foundation + Android Runtime at the same tested head; production hardening is active. Production application is NOT production-approved.**

## Current Executable Evidence
- Accepted executable head: `31e3d8ab44986b6f62ac0f33cae8166afad33191`.
- Foundation run `31514943699`: success (Drift generation, analyzer, full Flutter tests, encrypted migration through schema v13).
- Android Runtime run `31514943707`: success (debug APK, artifact publication, KVM emulator, encrypted persistence integration test).
- Schema target is currently v13, including authorization tables and persisted `fx_rates`.
- Sales, purchases, customer receipts, supplier payments, stock transfers, sales returns, purchase returns, operational drafts/read queries and core encrypted backup/restore are executable spike slices.
- Authorization infrastructure exists but must be enforced on every state-changing application/Operating Engine entry point before production approval.
- Persisted FX infrastructure exists, but synthetic/default FX behavior must be removed from production runtime and posting previews must bind to business-configured date-scoped rate snapshots.

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
- Same-head Foundation + Android Runtime continuation gate proven green on 2026-08-11.

## Current Constraints
- Production Supabase: **READ ONLY**.
- Android first.
- Local-first runtime.
- Arabic RTL first.
- Latin digits only (`0-9`).
- Calm/premium/minimal design language.
- Noto Sans Arabic + Noto Sans baseline pending representative-device validation.
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
The isolated spike has progressed beyond the original minimum PostSale validation into executable domain/runtime slices. It remains the hardening vehicle until the remaining production gates are closed.

Validated so far:
- Flutter Android build path;
- Drift + SQLite + sqlite3mc encrypted runtime;
- secure-storage-backed key flow in the tested emulator lifecycle;
- encrypted migrations through schema v13;
- encrypted backup/restore round trip;
- Money/Quantity/FX value objects;
- atomic/idempotent sales and purchase flows;
- customer receipt and supplier payment flows;
- stock-transfer paired movement transaction behavior;
- immutable sales/purchase returns and quantity ceilings;
- transactional document-sequence rollback behavior;
- Chat-first Arabic RTL prototype and typed sale draft lifecycle;
- persisted authorization and FX schema foundations.

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

## Remaining Production-Hardening Gates
1. Enforce authorization/permissions before every state-changing command reaches mutation logic.
2. Replace synthetic/default FX with persisted business-configured, date-scoped rates and bind the exact rate snapshot into previews/posts.
3. Complete purchase-return edge-case and rollback coverage.
4. Add expense/cash movement engine.
5. Add reversal/correction commands for posted documents.
6. Add production read models/reports.
7. Route purchases/payments/transfers/returns through typed conversational drafts/cards with explicit approval.
8. Make document date/year allocation use deterministic business calendar/timezone policy.
9. Validate encryption, Keystore/secure-storage, process-kill, reboot/upgrade/reinstall behavior on representative physical Android devices.
10. Create production Android host, harden manifest/backup policy, configure release signing, and prove signed release builds.
11. Disable spike seed data and synthetic defaults from production runtime.
12. Add production backup/restore UX with destructive confirmation and reconciliation.
13. Complete security/privacy/dependency hardening and representative release smoke/performance testing.
14. Validate thermal printing + barcode hardware baseline and representative-device UX/performance.
15. Complete legacy migration mapping/reconciliation validation before any separately authorized import.
16. Confirm no known P0/P1 defects before declaring production readiness.

## Resume Protocol
Use `IBEX2-CONTINUE` in a new conversation, then read `spike/CURRENT_HANDOFF.md`, `PROJECT_CONTEXT.md`, this file, `docs/DECISIONS.md`, `spike/SPIKE_EXECUTION_LOG.md`, and the active acceptance/posting/inventory artifacts before taking action. Production Supabase remains read-only.