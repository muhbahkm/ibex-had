# IBEX 2.0 — Project State

Last updated: 2026-08-11

## Current Phase
**Architecture, V1 schema/domain freeze-candidate review, central ownership/traceability definition, and technical-spike preparation. No IBEX 2.0 application code has been started yet.**

## Completed
- Current legacy repository inspected.
- Legacy production Supabase project identified as `IBEX_26`.
- Existing schema and security posture reviewed in read-only mode.
- Production Supabase redesign boundary fixed as READ ONLY.
- Notion Product & Engineering Hub created.
- Product vision, architecture, database, accounting, inventory, POS, security, backup, sync, migration, testing, and roadmap areas created.
- Feature registry, architecture decision registry, and risk/open-question registry created in Notion.
- Project governance, continuity protocol, and design-language rules documented.
- User-approved visual reference recorded as the design direction for IBEX 2.0.
- Critical financial/storage decisions accepted for V1.
- V1 local database schema blueprint, posting matrix, inventory movement matrix, acceptance-test matrix, backup/restore contract, and encryption spike criteria written.
- Schema cross-review completed and **Freeze Candidate 1** produced.
- ADR-009 accepted: **IBEX Operating Engine** is the central authority for operational business logic.
- V1 Operating Engine architecture and initial state-changing command catalog documented.
- ADR-010 accepted: **Canonical Domain Modules** — one canonical owner for every recurring business concept/record.
- ADR-011 accepted: **Reusable Behavior Ownership** — one owner for every repeated business behavior/rule.
- V1 Central Modules Catalog and Reuse & Ownership Rules documented.
- V1 Command Traceability Matrix completed.
- V1 Ownership & Traceability Matrix completed.
- V1 Document Lifecycle & State Transition Contract completed.
- V1 Domain Error Catalog completed.

## Current Constraints
- Production Supabase: **READ ONLY**.
- GitHub: source of truth for executable code, migrations, schema, tests, domain contracts, ownership contracts, and project state.
- Notion: documentation, decisions, planning, execution journal, and traceability.
- Android first.
- Arabic RTL first.
- Latin digits only (`0-9`).
- Calm, premium, minimal visual system.
- Approved visual direction: soft neutral background, large rounded surfaces, restrained elevation, selective pastel KPI surfaces, thin clean charts, strong active-state accent, generous whitespace, and functional micro-motion.
- Noto Sans Arabic + Noto Sans are the preferred typography baseline pending implementation validation.
- No new phase starts until the previous phase gate is satisfied and regressions remain green.
- No UI, repository, import, sync, automation, report, dashboard, or future AI code may create a competing source of financial, inventory, settlement, document-lifecycle, permission, or canonical-record truth.

## Central Operating Engine
The architectural center of IBEX 2.0 is the **IBEX Operating Engine**, composed of focused domains/services for sales, purchases, accounting, inventory, settlements, cash/treasury, party balances, document lifecycle, numbering, authorization policy, audit, and reversal/correction.

State-changing behavior is represented as explicit commands such as `PostSale`, `PostPurchase`, `ReceiveCustomerPayment`, `PaySupplier`, `TransferStock`, `RecordExpense`, `ReverseDocument`, and `CloseCashShift`.

This is a coordinated architecture, not one giant file or god-class.

## Canonical module ownership
IBEX applies **Single Behavior, Single Source**:
- canonical records have one domain owner;
- repeated business behaviors have one behavior owner;
- canonical value objects have one implementation;
- presentation may have multiple projections but cannot redefine business truth;
- technical capabilities are reusable infrastructure and do not decide business validity.

## Schema Freeze Candidate 1 — Mandatory Additions
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
1. Update the detailed schema blueprint with every Freeze Candidate 1 addition and ownership mapping.
2. Cross-review every command against schema, accounting, inventory, lifecycle, domain errors, permissions, audit, and acceptance tests.
3. Resolve any inconsistencies found by that cross-review.
4. Produce the technical-spike implementation plan.
5. Validate encrypted SQLite implementation and Android Keystore strategy with a technical spike.
6. Validate Flutter thermal printer and barcode hardware compatibility on representative targets.
7. Review future-safe tax metadata without enabling tax behavior.
8. Complete detailed legacy-to-V2 migration mapping and reconciliation rules.
9. Validate the approved UI direction, Noto typography, RTL, Latin-digit formatting, and motion in the technical spike.

## Current Design Artifacts
- `docs/SCHEMA_DECISIONS_V1.md`
- `docs/DATABASE_SCHEMA_V1.md`
- `docs/SCHEMA_CROSS_REVIEW_V1.md`
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
1. Update `DATABASE_SCHEMA_V1.md` to match Freeze Candidate 1, lifecycle, error, and ownership contracts.
2. Perform the first full command/schema/owner/acceptance cross-review and publish findings.
3. Produce the technical-spike implementation plan and dependency-validation checklist.
4. Create an isolated spike branch only after documentation is internally consistent.
5. Validate Flutter + Drift + encrypted SQLite + Android Keystore + Noto typography + RTL + Latin digits + representative motion.
6. Validate printing/barcode constraints.
7. Review spike evidence and only then freeze the V1 schema/domain/ownership contracts and scaffold the full application.

## Resume Protocol
If continuing in a fresh conversation, use the key `IBEX2-CONTINUE`, then read `PROJECT_CONTEXT.md`, this file, `docs/DECISIONS.md`, `docs/OPERATING_ENGINE_V1.md`, `docs/COMMAND_CATALOG_V1.md`, `docs/COMMAND_TRACEABILITY_V1.md`, `docs/CENTRAL_MODULES_CATALOG_V1.md`, `docs/OWNERSHIP_TRACEABILITY_V1.md`, `docs/DOCUMENT_LIFECYCLE_V1.md`, `docs/DOMAIN_ERROR_CATALOG_V1.md`, `docs/DESIGN_SYSTEM.md`, and the active schema/acceptance artifacts before taking action.
