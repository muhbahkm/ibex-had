# IBEX 2.0 — Acceptance Test Matrix V1

Status: **Required before schema freeze and before phase completion**

These scenarios define what must be provably correct before implementation is accepted.

## A. Sales

### A1 Cash sale
Given stock exists and a cash account is open,
When a cash sale posts,
Then:
- sale becomes posted once only;
- stock decreases by sold base quantity;
- cash increases by sale total;
- revenue is credited;
- COGS is debited;
- inventory asset is credited by exact COGS;
- journal balances exactly;
- all parts commit atomically.

### A2 Credit sale
- A/R increases by sale total.
- no cash movement occurs.
- stock and COGS post exactly once.

### A3 Partial payment sale
- cash receives exact paid amount;
- A/R receives exact remainder;
- cash + A/R equals sale total after currency/base conversion rules;
- no unallocated rounding residue is silently discarded.

### A4 Insufficient stock
Attempting to post a sale above available quantity must fail with no partial document, stock, payment, or journal writes.

### A5 Sales return
When linked to original sale line:
- returned quantity cannot exceed eligible sold-minus-prior-returned quantity;
- inventory returns at original COGS;
- revenue/refund/A/R correction posts correctly;
- source sale remains immutable.

## B. Purchases

### B1 Cash purchase
- inventory quantity/value increase;
- WAC recalculates correctly;
- cash decreases;
- journal balances.

### B2 Credit purchase
- inventory increases;
- A/P increases;
- no cash movement.

### B3 Purchase return
- return cannot exceed eligible receipt quantity;
- inventory is removed using original receipt cost where traceable;
- supplier balance or cash recovery is correct.

## C. Weighted Average Cost

### C1 Two receipts at different costs
Example:
- opening: 10 units × 100 = 1,000
- receipt: 10 units × 200 = 2,000
Expected:
- quantity = 20
- value = 3,000
- WAC = 150

### C2 Sale after WAC update
After C1, selling 4 units must:
- reduce quantity to 16;
- post COGS = 600;
- leave inventory value = 2,400;
- preserve WAC = 150 absent another incoming valued movement.

### C3 Return at original COGS
If an earlier sale was posted at a different WAC, return must use that original sale-line COGS and then recalculate current WAC from the returned value.

## D. Inventory transfer
A transfer of 5 units:
- source loses 5;
- destination gains 5;
- exact inventory value is preserved across the pair;
- no revenue, expense, gain, or loss is generated;
- both sides commit atomically.

## E. Inventory count
### E1 Shortage
- system 20, counted 18 → outbound adjustment 2;
- inventory loss posts using current WAC;
- reason/user/count document are auditable.

### E2 Surplus
- system 20, counted 22 → inbound adjustment 2;
- approved valuation cost is required before posting.

## F. Customer and supplier settlement
### F1 Customer receipt same currency
- cash increases;
- A/R decreases by exact allocated amount;
- balance cannot be over-allocated without an explicit advance-credit rule.

### F2 Supplier payment same currency
- A/P decreases;
- cash decreases.

### F3 Realized FX difference
Given a receivable posted using rate R1 and settled using rate R2,
Then the preserved carrying amount and settlement base amount must reconcile through FX Gain or FX Loss, with the journal exactly balanced.

## G. Money and rounding
### G1 Latin digits
All UI, PDF, receipt, and export test snapshots contain Latin digits `0-9` only.

### G2 No binary float persistence
Schema inspection must show INTEGER-based persisted money/rates/quantities according to policy; no REAL column may be used for financial truth.

### G3 Rounding determinism
The same input must produce identical persisted results across repeated executions and supported Android devices.

## H. Immutability and reversal
### H1 Posted document edit rejected
Direct business edit of posted sale/purchase/payment/stock/journal record must be blocked.

### H2 Reversal
Reversal creates a new linked document/movement/entry and never deletes original history.

### H3 Double reversal protection
A document already fully reversed cannot be reversed again without an explicitly supported compensating workflow.

## I. Atomicity and failure
For every posting workflow inject failure at:
- document save;
- stock movement;
- payment allocation;
- journal generation;
- final status update.

Expected: either the complete operation commits or database state remains exactly as before the attempt.

## J. Backup and restore
A backup produced from a known dataset must restore into a clean install and reproduce:
- row counts;
- posted document numbers;
- customer/supplier balances;
- inventory quantities/values;
- cash balances;
- trial balance totals;
- schema version.

Corrupted or incompatible backups must be rejected before destructive restore.

## K. Migration
Legacy import must provide reconciliation reports for:
- customers;
- suppliers where applicable;
- inventory quantities/value;
- open receivables/payables;
- cash opening balances;
- transaction counts selected for migration.

No legacy production data is altered by migration testing.

## Phase gate
A module is not considered complete until its applicable scenarios are automated where feasible, manually verified where hardware/UI is involved, documented in Notion, and all prior phase regression tests remain green.
