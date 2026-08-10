# IBEX 2.0 — Project State

Last updated: 2026-08-10

## Current Phase
**Architecture and V1 schema definition. No IBEX 2.0 application code has been started yet.**

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

## Current Constraints
- Production Supabase: **READ ONLY**.
- GitHub: source of truth for executable code, migrations, schema, tests, and project state.
- Notion: documentation, decisions, planning, execution journal, and traceability.
- Android first.
- Arabic RTL first.
- Latin digits only (`0-9`).
- Calm, premium, minimal visual system.
- Noto Sans Arabic + Noto Sans are the preferred typography baseline pending implementation validation.
- No new phase starts until the previous phase gate is satisfied and regressions remain green.

## Remaining Critical Gates Before Schema Freeze
1. Validate encrypted SQLite implementation and Android Keystore strategy with a technical spike.
2. Validate Flutter thermal printer and barcode hardware compatibility on representative targets.
3. Review future-safe tax metadata without enabling tax behavior.
4. Complete detailed legacy-to-V2 migration mapping and reconciliation rules.
5. Review every schema table against posting, inventory, backup, audit, and acceptance matrices.
6. Resolve any inconsistencies found by that review.

## Current Design Artifacts
- `docs/SCHEMA_DECISIONS_V1.md`
- `docs/DATABASE_SCHEMA_V1.md`
- `docs/POSTING_MATRIX_V1.md`
- `docs/INVENTORY_MOVEMENT_MATRIX_V1.md`
- `docs/ACCEPTANCE_TEST_MATRIX_V1.md`

## Next Planned Work
1. Perform schema cross-review and produce the first freeze candidate.
2. Write legacy migration mapping without modifying production data.
3. Define database migration/versioning policy for Drift.
4. Define backup-file format and restore validation contract.
5. Define authentication/local-key lifecycle and encryption spike acceptance criteria.
6. Validate Flutter + Drift + encrypted SQLite + Noto typography in a minimal non-production proof-of-concept branch.
7. Only after those gates pass, scaffold the full application foundation.

## Resume Protocol
If continuing in a fresh conversation, use the key `IBEX2-CONTINUE`, then read `PROJECT_CONTEXT.md`, this file, `docs/DECISIONS.md`, and the active schema/acceptance artifacts before taking action.
