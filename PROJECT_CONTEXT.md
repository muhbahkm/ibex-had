# IBEX 2.0 — Project Context

## Purpose
IBEX 2.0 is the next-generation Android-first business, accounting, inventory, sales, purchasing, cash, and reporting application derived from the current IBEX experience but rebuilt with a new Local-First architecture.

## Non-Negotiable Rules
1. **Production Supabase is READ-ONLY for this project work.** Do not create, alter, migrate, delete, or otherwise mutate production Supabase unless the owner explicitly authorizes a separate production change later.
2. **GitHub is the single source of truth for code, schema definitions, architecture, migrations, implementation notes, and executable project state.**
3. **Notion is the documentation and decision log.** Every architectural decision, implemented feature, behavior change, schema change, test gate, and release milestone must be documented there.
4. Development proceeds sequentially. A phase is not considered complete until prior phases are reviewed, tested, and accepted.
5. Financial and inventory logic must be deterministic, auditable, testable, and reversible. No destructive edits of posted accounting records.
6. The app must remain usable without internet for all critical V1 workflows.
7. Existing IBEX/Supabase is a reference and migration source only during the redesign.

## Current Product Direction
- Platform: Android first.
- Client: Flutter is the proposed primary platform, pending final hardware compatibility validation.
- Local DB: SQLite + Drift is proposed.
- Runtime source of truth: local database on device.
- Cloud/sync: future phase, not a V1 runtime dependency.
- Accounting: double-entry core.
- Inventory: stock movement ledger, not direct quantity mutation.
- Multi-currency: YER, SAR, USD designed from the start.

## UI/UX Rules
- Arabic-first RTL interface.
- All numeric digits shown to users must be Latin digits: `0-9` only.
- No Eastern Arabic/Indic digits in UI, reports, receipts, exports, or formatted values.
- Visual style: calm, formal, premium, minimal, operationally efficient.
- Avoid visual clutter, excessive cards, excessive borders, or decorative noise.
- Use motion intentionally for hierarchy, state changes, navigation, and feedback; never as decoration that slows work.
- Navigation must be predictable, shallow where possible, and optimized for frequent daily operations.
- Typography should use the Noto family unless a later ADR replaces it after platform review. Candidate for Arabic UI: **Noto Sans Arabic**; Latin/numeric companion: **Noto Sans**.

## Engineering Workflow
Every substantial implementation follows this gate:
1. Requirement documented.
2. ADR created/updated if architecture or behavior changes.
3. Data impact reviewed.
4. Implementation branch created.
5. Tests added/updated.
6. Local build/tests pass.
7. Functional acceptance checklist passes.
8. Documentation updated in Notion and repository.
9. PR reviewed.
10. Merge to `main` only after acceptance.

## Continuity Across ChatGPT Conversations
A new ChatGPT conversation must begin by reading this file and the files listed below before proposing or implementing changes:
- `PROJECT_CONTEXT.md`
- `docs/PROJECT_STATE.md`
- `docs/DECISIONS.md`
- `docs/EXECUTION_PROTOCOL.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/DATA_SAFETY.md`

Use the phrase **`IBEX2-CONTINUE`** in a new conversation as the project continuity key. The assistant should then read the repository context files and relevant Notion project hub before continuing.

## Production Safety
Production Supabase is currently used by the existing published application. Treat it as a live production system. Inspection is allowed; mutation is prohibited without an explicit, separate approval.
