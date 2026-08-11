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
- ADR-010 — **Canonical Domain Modules:** every recurring business concept or record has exactly one canonical owner module. Different screens may use different projections, but may not define competing truth or duplicated lifecycle rules.
- ADR-011 — **Reusable Behavior Ownership:** every repeated business rule, calculation, validation, state transition, permission decision, numbering rule, stock rule, settlement rule, or formatting contract has exactly one owner module.
- Shared presentation components may reuse interaction/visual patterns, but domain policy may not be hidden inside shared widgets.
- Import, sync, automation, reports, dashboards, and future AI must consume the same canonical domain/application contracts rather than reimplementing business logic.
- ADR-012 — **Dedicated immutable return documents:** sales and purchase returns use dedicated return header/item tables linked to the original document and original lines; posting creates compensating effects and never edits posted source truth.
- ADR-013 — **Warehouse transfer document + paired movements:** one `stock_transfers` document creates one source `TRANSFER_OUT` movement and one destination `TRANSFER_IN` movement atomically, carrying the same inventory value.
- ADR-014 — **Tax-ready but tax-disabled V1:** store only future-safe tax registration and posted snapshot metadata; while tax is disabled all tax amounts remain zero and no jurisdiction-specific tax engine runs.
- ADR-015 — **Fixed quantity scale:** canonical quantities and conversion factors use signed 64-bit scaled integers at scale 1e6; unit metadata controls allowed/display precision from 0 to 6 decimals.
- ADR-016 — **Application-owned document numbering:** visible document numbers come from transactional `document_sequences` scoped by business/document type/year, while UUID remains canonical identity. SQLite row IDs/AUTOINCREMENT are not business document numbers.
- ADR-017 — **Conversational Operating Agent / Chat-first UI:** the primary IBEX interaction surface is conversational, with typed operational cards and natural-language commands. The agent may interpret, resolve, plan, draft, and explain, but it may never bypass the Command Catalog or IBEX Operating Engine and may never write accounting, inventory, settlement, numbering, audit, or posted-document truth directly.
- ADR-017 requires **draft → preview → explicit approval → typed post command** for material state changes by default. Any material change invalidates prior approval.
- IBEX is Chat-first, not Chat-only: deterministic/manual views remain available for browsing and fallback, and core operation must remain possible when an AI provider is unavailable.

## Proposed / Pending Implementation Validation
- ADR-002 — Flutter as primary client platform.
- ADR-003 — SQLite + Drift persistence stack.
- Typography — Noto Sans Arabic + Noto Sans.
- Encrypted SQLite implementation details and exact package configuration.
- Thermal printer and barcode hardware compatibility baseline.
- Exact AI model/provider strategy, local-vs-cloud routing, conversation retention, and privacy policy.

## V1 Architecture / Schema Design References
- `docs/SCHEMA_DECISIONS_V1.md`
- `docs/PHYSICAL_SCHEMA_DECISIONS_V1.md`
- `docs/DATABASE_SCHEMA_V1.md`
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
- `docs/CONVERSATIONAL_OPERATING_AGENT_V1.md`

## Remaining Gates Before Schema / Domain Freeze
- Validate encrypted SQLite spike on representative Android devices.
- Validate Drift migrations against the encrypted database.
- Validate backup/restore round trip.
- Validate thermal printer and barcode hardware strategy.
- Complete legacy migration mapping and reconciliation validation.
- Validate the accepted schema/domain contracts with executable critical-path tests.
- Define and test the first bounded conversational draft flow without granting the AI any direct mutation authority.

The five former physical-schema clarifications (returns, transfers, tax-ready metadata, quantity precision, document numbering) are closed for V1 by ADR-012 through ADR-016.