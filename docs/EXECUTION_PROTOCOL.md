# IBEX 2.0 — Execution Protocol

## Principle
IBEX 2.0 is a financial system. Delivery must be sequential, reviewable, testable, and reversible. Speed never overrides correctness or auditability.

## Phase Gate
A phase may advance only when all items below are satisfied:
- Scope and acceptance criteria documented.
- Data model impact understood.
- Relevant ADRs accepted or explicitly marked as temporary.
- Implementation isolated in a branch.
- Unit and integration tests cover critical invariants.
- Build/lint/test pipeline passes.
- Manual functional checklist passes on target Android device/emulator.
- No unresolved Critical defects.
- Documentation is synchronized with implementation.
- Handoff state updated in `docs/PROJECT_STATE.md`.

## Change Classes
### Class A — Financial/Data Critical
Examples: journal logic, balances, stock valuation, currency conversion, migrations, backup/restore.
Requires explicit acceptance criteria, tests, data migration/rollback analysis, and review before merge.

### Class B — Operational Logic
Examples: sale workflow, purchase workflow, customer settlement, permissions.
Requires functional tests and regression review.

### Class C — Presentation
Examples: spacing, typography, animation, non-semantic UI refinements.
Must still preserve accessibility, RTL, Latin-digit formatting, and workflow speed.

## Branch Strategy
- `main`: accepted source of truth only.
- `docs/*`: documentation/governance changes.
- `feat/*`: new product features.
- `fix/*`: defect correction.
- `refactor/*`: behavior-preserving architectural work.
- `migration/*`: schema/data migration work.

## Definition of Done
A feature is not Done because the screen exists. It is Done when:
1. Behavior matches specification.
2. Persistence is correct.
3. Accounting and inventory side effects are correct where applicable.
4. Failure cases are handled.
5. Tests pass.
6. Documentation is updated.
7. The project state handoff reflects the change.

## Production Supabase Rule
The current Supabase production project is inspection-only. No write operation, SQL mutation, migration, RLS change, function change, schema change, storage mutation, or data update is permitted during IBEX 2.0 development unless a separate explicit production-change authorization is given by the owner.
