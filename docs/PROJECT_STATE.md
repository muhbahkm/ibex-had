# IBEX 2.0 — Project State

Last updated: 2026-08-10

## Current Phase
**Documentation, architecture, and product governance. No IBEX 2.0 application code has been started yet.**

## Completed
- Current legacy repository inspected.
- Legacy production Supabase project identified as `IBEX_26`.
- Existing schema and security posture reviewed in read-only mode.
- Notion Product & Engineering Hub created.
- Product vision, architecture, database, accounting, inventory, POS, security, backup, sync, migration, testing, and roadmap areas created.
- Feature registry created in Notion.
- Architecture decision registry created in Notion.
- Risk/open-question registry created in Notion.
- ADR baseline includes Local-First, Flutter proposal, SQLite + Drift proposal, double-entry accounting proposal, weighted average inventory proposal, money representation question, immutable posted documents, and negative-stock policy question.

## Current Constraints
- Production Supabase: **READ ONLY**.
- GitHub: source of truth for executable code and schema.
- Notion: documentation and decision history.
- Android first.
- Arabic RTL first.
- Latin digits only (`0-9`).
- Calm, premium, minimal visual system.
- Noto family preferred; exact typography ADR pending.

## Open Critical Decisions Before Schema Freeze
1. Money storage representation and scale per currency.
2. Rounding rules.
3. Inventory valuation: weighted average vs FIFO.
4. Cross-currency settlement and FX differences.
5. Local database encryption implementation and key management.
6. Negative-stock override policy.
7. Tax requirements for V1.
8. Thermal printer and barcode hardware compatibility.

## Next Planned Work
1. Finalize design-system ADR and typography decision.
2. Finalize financial numeric policy.
3. Build detailed local schema specification table-by-table.
4. Define accounting posting matrix for each business transaction.
5. Define inventory movement matrix.
6. Write acceptance scenarios and invariants.
7. Freeze V1 domain model.
8. Only then scaffold the new Flutter application.

## Resume Protocol
If continuing in a fresh conversation, use the key `IBEX2-CONTINUE`, then read `PROJECT_CONTEXT.md` and all files referenced there before taking action.
