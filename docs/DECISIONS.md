# IBEX 2.0 — Decision Index

This file is the repository-side index of architectural and product decisions. Detailed discussion is maintained in Notion and mirrored here when it changes executable behavior.

## Accepted
- ADR-001 — Local-First is the runtime source of truth.
- Production Supabase is read-only during IBEX 2.0 redesign.
- GitHub is the single source of truth for code/schema/executable project state.
- Notion is the documentation, decision, and planning ledger.
- Arabic-first RTL.
- Latin digits `0-9` only in all rendered outputs.
- Sequential phase-gated implementation.
- Every implemented behavior/schema/logic change must be documented.
- ADR-004 — Double-entry accounting core for V1.
- ADR-005 — Moving Weighted Average Cost per product/warehouse for V1.
- ADR-006 — Persist money as signed 64-bit scaled integers; internal money scale = 4 decimals.
- Monetary rounding mode = half away from zero; centralized in domain utilities.
- Exchange rates stored as scaled integers with 8 decimal places and frozen on posted documents.
- Realized FX gain/loss recognized at settlement; unrealized revaluation is outside V1.
- ADR-007 — Posted business documents are immutable; correction by reversal/return/adjustment.
- ADR-008 — Negative stock disabled in V1 posting; no manager override in V1.
- Tax-ready schema, but tax calculation disabled by default until explicit rules are approved.
- Production local database must be encrypted at rest; key material protected through Android platform keystore strategy after a validated implementation spike.
- ADR-009 — **IBEX Operating Engine** is the central authority for operational business logic. UI, repositories, sync, import, automation, and future AI may not bypass it for financial, inventory, settlement, or posted-document writes.
- Operational logic is composed of focused domain engines/services rather than a single god-class or giant business-logic file.
- Every state-changing operational action is expressed as an explicit command with permission, invariants, atomic transaction boundary, audit evidence, and reversal/correction behavior where applicable.

## Proposed / Pending Implementation Validation
- ADR-002 — Flutter as primary client platform.
- ADR-003 — SQLite + Drift persistence stack.
- Typography — Noto Sans Arabic + Noto Sans.
- Encrypted SQLite implementation details and exact package configuration.
- Thermal printer and barcode hardware compatibility baseline.

## V1 Architecture / Schema Design References
- `docs/SCHEMA_DECISIONS_V1.md`
- `docs/DATABASE_SCHEMA_V1.md`
- `docs/OPERATING_ENGINE_V1.md`
- `docs/COMMAND_CATALOG_V1.md`
- `docs/POSTING_MATRIX_V1.md`
- `docs/INVENTORY_MOVEMENT_MATRIX_V1.md`
- `docs/ACCEPTANCE_TEST_MATRIX_V1.md`

## Remaining Gates Before Schema / Domain Freeze
- Complete command-to-schema/accounting/inventory/permission traceability.
- Validate encrypted SQLite spike on representative Android devices.
- Validate thermal printer and barcode hardware strategy.
- Review tax-ready fields for future-safe compatibility.
- Complete legacy migration mapping and reconciliation rules.
- Perform structured review of the V1 schema blueprint against every acceptance scenario and Operating Engine command.
