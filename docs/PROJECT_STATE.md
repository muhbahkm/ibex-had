# IBEX 2.0 — Project State

Last updated: 2026-08-11

## Current Phase
**V1 Domain/Schema Freeze Candidate 2 and isolated technical-spike readiness. No production IBEX 2.0 application scaffold has been started yet.**

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

## Freeze Candidate 2 Additions Now Incorporated
- `document_sequences`.
- `operation_log`.
- explicit base-currency snapshot fields.
- commercial-document links to journal entries and stock movements.
- explicit reversal/return source links.
- sale-line COGS snapshots.
- purchase receipt-cost snapshots.
- explicit `payment_allocations` settlement ledger.
- mandatory cash-account -> ledger-account mapping.
- append-only audit contract with operation correlation.
- legacy import run/mapping/reconciliation support.

## Full Cross-Review Result
No architecture-blocking contradiction remains in the current V1 direction. Remaining items are controlled implementation/physical-schema validation gates:
1. final physical representation of sales/purchase returns;
2. exact stock-transfer physical representation across two warehouses;
3. exact tax-ready metadata fields while tax behavior remains disabled;
4. exact quantity precision policy by unit category;
5. document prefix/fiscal sequencing conventions;
6. encrypted SQLite + Android Keystore implementation validation;
7. thermal printer and barcode viability;
8. UI direction validation on representative Android targets.

## Technical Spike
The next executable work is an isolated disposable spike, not the production scaffold.

Planned validation:
- Flutter Android;
- Drift + SQLite;
- encrypted SQLite candidate;
- Android Keystore key protection;
- encrypted migration + backup/restore;
- Money/Quantity/FX value objects;
- minimal local `PostSale` vertical slice proving authorization, stock validation, sale + journal + stock + payment/allocation + audit under one transaction and rollback;
- Noto + RTL + Latin digits + approved motion/design language;
- barcode baseline;
- 58mm/80mm thermal print baseline;
- performance evidence.

Target branch after governance review: `spike/android-foundation-v1`.

## Current Design Artifacts
- `docs/DATABASE_SCHEMA_V1.md`
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

## Next Planned Work
1. Mirror Freeze Candidate 2 and spike plan in Notion.
2. Review/open governance PR status before branch transition.
3. Close the five remaining physical-schema clarifications or explicitly carry them into spike evidence where appropriate.
4. Create isolated spike branch.
5. Execute the technical spike with synthetic data only.
6. Document every result/failure in GitHub + Notion.
7. Only if the spike passes: accept exact Flutter/Drift/encryption choices and issue final V1 Domain/Schema Freeze.
8. Only after final freeze: scaffold the production IBEX 2.0 Android application.

## Resume Protocol
Use `IBEX2-CONTINUE` in a new conversation, then read `PROJECT_CONTEXT.md`, this file, `docs/DECISIONS.md`, `docs/FULL_CROSS_REVIEW_V1.md`, `docs/TECHNICAL_SPIKE_PLAN_V1.md`, `docs/DATABASE_SCHEMA_V1.md`, `docs/OPERATING_ENGINE_V1.md`, `docs/COMMAND_TRACEABILITY_V1.md`, `docs/CENTRAL_MODULES_CATALOG_V1.md`, `docs/OWNERSHIP_TRACEABILITY_V1.md`, `docs/DOCUMENT_LIFECYCLE_V1.md`, `docs/DOMAIN_ERROR_CATALOG_V1.md`, `docs/DESIGN_SYSTEM.md`, and active acceptance/posting/inventory artifacts before taking action.
