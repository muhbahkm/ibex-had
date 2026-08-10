# IBEX 2.0 — Data Safety Policy

## Production Boundary
The current Supabase project used by the published legacy IBEX application is a live production dependency.

During IBEX 2.0 redesign:
- Allowed: read-only inspection, schema review, query review, migration planning, data mapping analysis.
- Prohibited without explicit owner approval: INSERT, UPDATE, DELETE, DDL, migration execution, RLS changes, function changes, trigger changes, storage mutations, auth changes, secrets rotation, or destructive tests.

## Source of Truth
- GitHub `main`: authoritative code, schema definitions, migrations, tests, architecture documents, and implementation state.
- Notion: authoritative product documentation, decision history, acceptance records, risks, and planning notes.
- Runtime local SQLite files: user/business data only; never source-controlled.

## Financial Safety Invariants
- Posted accounting documents are immutable.
- Corrections use reversal/adjustment/return flows.
- Journal entries must balance.
- Stock movements must have traceable source/reason.
- Migrations must be versioned and tested against representative copies, never directly invented against production.
- Backup restoration must be tested before release.

## Database Development Rule
The new local database is defined as code in the repository. Schema changes require:
1. specification update
2. migration definition
3. migration test
4. backward/forward compatibility review when applicable
5. documentation update

## Secrets
No private production credentials, service-role keys, database passwords, signing keys, or recovery secrets may be committed to GitHub.
