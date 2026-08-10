# IBEX 2.0 — Project State

Last updated: 2026-08-10

## Current Phase
**Architecture, V1 schema freeze-candidate review, and technical-spike preparation. No IBEX 2.0 application code has been started yet.**

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

## Current Constraints
- Production Supabase: **READ ONLY**.
- GitHub: source of truth for executable code, migrations, schema, tests, and project state.
- Notion: documentation, decisions, planning, execution journal, and traceability.
- Android first.
- Arabic RTL first.
- Latin digits only (`0-9`).
- Calm, premium, minimal visual system.
- Approved visual direction: soft neutral background, large rounded surfaces, restrained elevation, selective pastel KPI surfaces, thin clean charts, strong active-state accent, generous whitespace, and functional micro-motion.
- Noto Sans Arabic + Noto Sans are the preferred typography baseline pending implementation validation.
- No new phase starts until the previous phase gate is satisfied and regressions remain green.

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
2. Map acceptance scenarios to concrete tables/services and invariants.
3. Validate encrypted SQLite implementation and Android Keystore strategy with a technical spike.
4. Validate Flutter thermal printer and barcode hardware compatibility on representative targets.
5. Review future-safe tax metadata without enabling tax behavior.
6. Complete detailed legacy-to-V2 migration mapping and reconciliation rules.
7. Validate the approved UI direction, Noto typography, RTL, Latin-digit formatting, and motion in the technical spike.

## Current Design Artifacts
- `docs/SCHEMA_DECISIONS_V1.md`
- `docs/DATABASE_SCHEMA_V1.md`
- `docs/SCHEMA_CROSS_REVIEW_V1.md`
- `docs/POSTING_MATRIX_V1.md`
- `docs/INVENTORY_MOVEMENT_MATRIX_V1.md`
- `docs/ACCEPTANCE_TEST_MATRIX_V1.md`
- `docs/BACKUP_RESTORE_CONTRACT_V1.md`
- `docs/ENCRYPTION_SPIKE_CRITERIA.md`
- `docs/DESIGN_SYSTEM.md`

## Next Planned Work
1. Update `DATABASE_SCHEMA_V1.md` to incorporate all Freeze Candidate 1 changes.
2. Produce an acceptance-to-schema traceability matrix.
3. Produce the technical-spike implementation plan.
4. Create an isolated spike branch only after documentation is internally consistent.
5. Validate Flutter + Drift + encrypted SQLite + Android Keystore + Noto typography + RTL + Latin digits + representative motion.
6. Validate printing/barcode constraints.
7. Review spike evidence and only then freeze the V1 schema and scaffold the full application.

## Resume Protocol
If continuing in a fresh conversation, use the key `IBEX2-CONTINUE`, then read `PROJECT_CONTEXT.md`, this file, `docs/DECISIONS.md`, `docs/DESIGN_SYSTEM.md`, `docs/SCHEMA_CROSS_REVIEW_V1.md`, and the active schema/acceptance artifacts before taking action.
