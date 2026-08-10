# IBEX 2.0 — Reuse & Ownership Rules V1

Status: **Architecture baseline**

## ADR-010 — Canonical Domain Modules
Every recurring business concept or record has exactly one canonical domain owner.

A customer shown in POS, customer list, receipt collection, reports, and dashboard is the same canonical customer concept. Screens may use different read projections, but they may not define competing business models or rules.

## ADR-011 — Reusable Behavior Ownership
Every business rule or behavior used by more than one feature must have exactly one owner module.

Examples:
- money rounding → MoneyModule;
- exchange conversion → CurrencyFxModule;
- stock sufficiency → StockAvailabilityModule;
- document state transitions → DocumentLifecycleModule;
- payment allocation → PaymentAllocationModule;
- permissions → PermissionModule;
- numbering → NumberingModule;
- reversal → ReversalModule.

## Non-negotiable implementation rules
1. No copy/paste business logic between screens.
2. No financial calculation inside widgets.
3. No direct financial/inventory repository mutation from UI.
4. No feature-specific duplicate of a shared validation rule.
5. No report/dashboard-specific reconstruction of business truth when a canonical query/service exists.
6. No generic `utils` module may become the hidden owner of domain behavior.
7. Shared UI components may share interaction and presentation, not hidden business policy.
8. Canonical value objects must be reused rather than recreated as raw primitives with inconsistent rules.
9. Import, sync, automation, and future AI must invoke the same application/domain contracts as human-driven UI actions.
10. A rule change is implemented once in its owner module and covered by regression tests for every consuming workflow.

## Reuse decision test
Before implementing repeated code, answer:
- Is this the same business concept?
- Is this the same invariant?
- Is this the same calculation?
- Is this the same state transition?
- Is this the same permission decision?
- Is this only the same visual pattern?

If the answer is business/domain sameness, centralize it in the canonical owner.
If the answer is only visual sameness, reuse a presentation component without moving domain rules into it.

## Anti-pattern examples
### Wrong
POS calculates invoice totals, Sales screen recalculates totals, and Reports calculates them again.

### Correct
All use the same Money/Posting rules; each view receives an appropriate query projection.

### Wrong
Customer deletion rules live in the Customer screen button handler.

### Correct
Customer lifecycle policy is enforced by CustomerModule regardless of caller.

### Wrong
A hidden button is treated as authorization.

### Correct
UI visibility is convenience; Operating Engine authorization is the real boundary.

## Testing requirement
Every central behavior module requires:
- unit tests for its invariants;
- boundary and rounding tests when numerical;
- negative-path tests;
- integration tests through at least one Operating Engine command;
- regression tests for each critical consuming workflow.

## Review gate
A feature cannot be marked complete if it duplicates an existing owner module behavior or introduces a second source of truth for a canonical record.
