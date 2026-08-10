# IBEX 2.0 — Project State

Last updated: 2026-08-10

## Current Phase
**Architecture, V1 schema/domain freeze-candidate review, and technical-spike preparation. No IBEX 2.0 application code has been started yet.**

## Completed
- Current legacy repository inspected.
- Legacy production Supabase project identified as `IBEX_26`.
- Existing schema and security posture reviewed in read-only mode.
- Production Supabase redesign boundary fixed as READ ONLY.
- Notion Product & Engineering Hub created.
- Product vision, architecture, database, accounting, inventory, POS, security, backup, sync, migration, testing, and roadmap areas created.
- Feature registry created in Notion.
- Architecture decision registry created in Notion.
- Risk/open-question registry created in Notion.
- Project governance, continuity protocol, and design-language rules documented.
- User-approved visual reference recorded as the design direction for IBEX 2.0.
- Critical financial/storage decisions accepted for V1:
  - double-entry accounting core;
  - moving weighted-average inventory valuation;
  - scaled-integer money storage with 4-decimal internal scale;
  - 8-decimal scaled exchange rates;
  - half-away-from-zero monetary rounding;
  - realized FX gain/loss on settlement;
  - posted-document immutability;
  - negative stock disabled in V1;
  - encrypted local database requirement.
- V1 local database schema blueprint written.
- V1 accounting posting matrix written.
- V1 inventory movement matrix written.
- V1 acceptance-test matrix written.
- V1 backup/restore contract written.
- V1 encryption spike acceptance criteria written.
- Schema cross-review completed and **Freeze Candidate 1** produced.
- **ADR-009 accepted: IBEX Operating Engine** is the central authority for operational business logic.
- V1 Operating Engine architecture documented.
- Initial V1 state-changing command catalog documented.

## Current Constraints
- Production Supabase: **READ ONLY**.
- GitHub: source of truth for executable code, migrations, schema, tests, domain contracts, and project state.
- Notion: documentation, decisions, planning, execution journal, and traceability.
- Android first.
- Arabic RTL first.
- Latin digits only (`0-9`).
- Calm, premium, minimal visual system.
- Approved visual direction: soft neutral background, large rounded surfaces, restrained elevation, selective pastel KPI surfaces, thin clean charts, strong active-state accent, generous whitespace, and functional micro-motion.
- Noto Sans Arabic + Noto Sans are the preferred typography baseline pending implementation validation.
- No new phase starts until the previous phase gate is satisfied and regressions remain green.
- No UI, repository, import, sync, automation, or future AI code may bypass the Operating Engine for financial, inventory, settlement, or posted-document truth.

## Central Operating Engine
The architectural center of IBEX 2.0 is now the **IBEX Operating Engine**, composed of focused domains/services for:
- sales;
- purchases;
- accounting;
- inventory;
- settlements;
- cash/treasury;
- party balances;
- document lifecycle;
- numbering;
- authorization policy;
- audit;
- reversal/correction.

State-changing behavior is represented as explicit commands such as `PostSale`, `PostPurchase`, `ReceiveCustomerPayment`, `PaySupplier`, `TransferStock`, `RecordExpense`, `ReverseDocument`, and `CloseCashShift`.

This is a coordinated architecture, not one giant file or god-class.

## Schema Freeze Candidate 1 — Mandatory Additions
The cross-review made the following mandatory before implementation freeze:
1. rebuildable `inventory_balances` cache;
2. explicit `payment_allocations` ledger;
3. cash-account to accounting-ledger mapping;
4. line-level original COGS retention on sales;
5. line-level receipt-cost retention on purchases;
6. explicit reversal/return source links;
7. transactional local document sequence table;
8. migration mapping/reconciliation tables for legacy import tooling;
9. append-only audit-log scope;
10. transaction/base-currency snapshots on posted financial records.

## Remaining Critical Gates Before Full Scaffold
1. Update the detailed schema blueprint with every Freeze Candidate 1 addition.
2. Produce `COMMAND_TRACEABILITY_V1.md` mapping every state-changing command to permissions, tables, accounting effects, stock effects, audit, reversal, and acceptance scenarios.
3. Produce a document-state transition matrix and domain error catalog.
4. Validate encrypted SQLite implementation and Android Keystore strategy with a technical spike.
5. Validate Flutter thermal printer and barcode hardware compatibility on representative targets.
6. Review future-safe tax metadata without enabling tax behavior.
7. Complete detailed legacy-to-V2 migration mapping and reconciliation rules.
8. Validate the approved UI direction, Noto typography, RTL, Latin-digit formatting, and motion in the technical spike.

## Current Design Artifacts
- `docs/SCHEMA_DECISIONS_V1.md`
- `docs/DATABASE_SCHEMA_V1.md`
- `docs/SCHEMA_CROSS_REVIEW_V1.md`
- `docs/OPERATING_ENGINE_V1.md`
- `docs/COMMAND_CATALOG_V1.md`
- `docs/POSTING_MATRIX_V1.md`
- `docs/INVENTORY_MOVEMENT_MATRIX_V1.md`
- `docs/ACCEPTANCE_TEST_MATRIX_V1.md`
- `docs/BACKUP_RESTORE_CONTRACT_V1.md`
- `docs/ENCRYPTION_SPIKE_CRITERIA.md`
- `docs/DESIGN_SYSTEM.md`

## Next Planned Work
1. Update `DATABASE_SCHEMA_V1.md` to incorporate all Freeze Candidate 1 changes.
2. Produce command-to-schema/accounting/inventory/permission traceability.
3. Produce document lifecycle/state-transition and domain-error contracts.
4. Cross-review all commands against schema, posting matrix, inventory movement matrix, and acceptance tests.
5. Produce the technical-spike implementation plan.
6. Create an isolated spike branch only after documentation is internally consistent.
7. Validate Flutter + Drift + encrypted SQLite + Android Keystore + Noto typography + RTL + Latin digits + representative motion.
8. Validate printing/barcode constraints.
9. Review spike evidence and only then freeze the V1 schema/domain contracts and scaffold the full application.

## Resume Protocol
If continuing in a fresh conversation, use the key `IBEX2-CONTINUE`, then read `PROJECT_CONTEXT.md`, this file, `docs/DECISIONS.md`, `docs/OPERATING_ENGINE_V1.md`, `docs/COMMAND_CATALOG_V1.md`, `docs/DESIGN_SYSTEM.md`, `docs/SCHEMA_CROSS_REVIEW_V1.md`, and the active schema/acceptance artifacts before taking action.
