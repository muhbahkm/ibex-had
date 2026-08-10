# IBEX 2.0 — Document Lifecycle & State Transition Contract V1

Status: **Architecture baseline**

## Principle
Document status is domain truth, not a UI label. Every transition is owned by `DocumentLifecycleModule`, authorized by command policy, audited, and enforced inside the same transaction as the business operation where applicable.

## Canonical statuses
Use only statuses that have domain meaning. V1 baseline:
- `draft`
- `submitted` where approval workflow exists
- `approved` where approval is separate from posting
- `posted`
- `cancelled` for non-posted documents only unless a domain-specific cancellation creates compensating records
- `reversed` for posted records fully compensated by linked reversal
- `partially_returned` / `returned` only where commercial return lifecycle requires it

Do not use ambiguous statuses such as `done`, `complete`, `closed` for accounting documents.

## Core transition rules

### Draft commercial document
`draft -> posted`
- allowed only through the explicit posting command;
- all posting invariants validated;
- document number finalized transactionally;
- related journal/stock/settlement effects commit atomically.

`draft -> cancelled/deleted`
- only if no posted effects exist;
- deletion may be allowed for pure draft records according to retention policy;
- audit policy decides whether deleted drafts leave an audit event.

### Posted commercial document
`posted -> reversed`
- never by status update alone;
- requires linked compensating document/movements/journal entries;
- original rows remain immutable.

`posted -> partially_returned -> returned`
- driven by linked return documents;
- eligible return quantity/value is calculated from source minus prior posted returns;
- original sale/purchase remains posted and immutable.

### Inventory count
`draft -> submitted -> approved -> posted`
- count entry can change only before submit according to permissions;
- approval does not change stock;
- posting creates the inventory adjustment atomically;
- after posting the count snapshot is immutable.

### Cash shift
`open -> closed`
- one active shift per configured user/cash account scope unless policy explicitly allows otherwise;
- close stores expected, counted and variance snapshots;
- reopening is not a simple status rollback and requires a governed correction workflow.

## Transition authority
Only commands can transition domain states. Repositories may persist a requested transition but do not decide whether it is valid.

## Immutability boundary
For posted truth, fields affecting value, quantity, party, account, currency, FX rate, warehouse, document date, or linked source are immutable. Presentation-only metadata may be editable only when explicitly classified as non-financial and audited if sensitive.

## Concurrency / idempotency
A posting transition must protect against duplicate execution:
- stable `operation_id`;
- re-check current status inside transaction;
- unique constraints where practical;
- repeated delivery of the same command must not duplicate stock, journal, cash, or settlement effects.

## Reversal linkage
Every reversible posted document must expose:
- `reversal_of_id` or equivalent source link;
- reversal timestamp;
- actor;
- reason code / notes where required;
- correlation between source business document and compensating journal/stock/payment records.

## UI contract
UI may render available actions based on lifecycle queries, but command execution revalidates the transition. A hidden action is not an authorization or lifecycle guarantee.

## Acceptance rules
Automated tests must cover:
- every allowed transition;
- every forbidden transition;
- duplicate posting attempt;
- posting after cancellation;
- direct edit of posted value fields;
- double reversal;
- over-return;
- rollback when a downstream write fails.
