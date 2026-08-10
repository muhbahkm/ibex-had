# IBEX 2.0 — Decision Index

This file is the repository-side index of architectural and product decisions. Detailed decision discussion is maintained in Notion and mirrored here when it changes executable behavior.

## Accepted
- ADR-001 — Local-First is the runtime source of truth.
- Production Supabase is read-only during IBEX 2.0 redesign.
- GitHub is the single source of truth for code/schema/executable project state.
- Notion is the documentation, decision, and planning ledger.
- Arabic-first RTL.
- Latin digits `0-9` only in all rendered outputs.
- Sequential phase-gated implementation.
- Every implemented behavior/schema/logic change must be documented.

## Proposed / Pending Finalization
- ADR-002 — Flutter as primary client platform.
- ADR-003 — SQLite + Drift persistence stack.
- ADR-004 — Double-entry accounting core.
- ADR-005 — Weighted Average Cost inventory valuation for V1.
- ADR-006 — Scaled integer / fixed-scale money representation.
- ADR-007 — Posted business documents are immutable.
- ADR-008 — Negative stock disabled by default.
- Typography — Noto Sans Arabic + Noto Sans.

## Must Be Decided Before Schema Freeze
- Money scale and rounding rules per currency.
- FX gain/loss rules.
- Database encryption and Android Keystore strategy.
- Negative-stock manager override policy.
- V1 tax requirements.
- Thermal printer integration baseline.
