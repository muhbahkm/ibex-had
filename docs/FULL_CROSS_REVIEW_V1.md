# IBEX 2.0 — Full Architecture Cross-Review V1

Status: **Freeze Candidate 2 review artifact**

## Scope
Cross-review of Operating Engine, command catalog, central ownership, schema, document lifecycle, domain errors, accounting posting, inventory movement, settlement, audit, and acceptance contracts.

## Review result
No design-blocking contradiction was found in the current V1 direction after promoting the schema to Freeze Candidate 2. Remaining items are implementation-validation gates, not unresolved ownership conflicts.

## Verified invariants
1. Every financial/inventory state change enters through an explicit Operating Engine command.
2. Canonical records have one owner module.
3. UI/reports/dashboard/query projections cannot create competing truth.
4. Posted documents are immutable.
5. Reversal/correction uses linked compensating records.
6. Journal entries must balance in base currency.
7. Negative stock is rejected for V1 outbound posting.
8. Inventory balance is a rebuildable projection from stock movements.
9. Payment allocations are explicit and auditable.
10. FX rates and base-currency snapshots are frozen on posted records.
11. Document numbering has a transactional canonical owner.
12. Audit evidence is append-only by application contract.
13. Operation IDs provide the basis for idempotency/correlation.
14. Legacy import uses mapping + reconciliation rather than direct blind copying.

## Command path validation
Expected command execution path:

```text
Caller
  -> Command Contract
  -> Authorization
  -> Operating Engine
  -> Domain/Behavior Owners
  -> Validate invariants
  -> Build accounting/inventory/settlement effects
  -> Single DB transaction
  -> Canonical records + audit + operation result
  -> Projection refresh/invalidation
```

No presentation layer is authorized to bypass this path for posted truth.

## High-risk flows reviewed
### PostSale
Must atomically create/finalize sale, stock-out movement, COGS snapshot, balanced journal entry, optional payment/allocation, operation log, and audit evidence.

### PostPurchase
Must atomically create/finalize purchase, stock-in movement, receipt cost/WAC impact, supplier liability/cash effect, journal entry, operation log, and audit evidence.

### ReceiveCustomerPayment / PaySupplier
Must preserve payment currency, base value, allocations, realized FX difference, cash account ledger mapping, journal entry, audit, and reversal linkage.

### Return / Reverse
Must never mutate posted source truth. Source document/lines are referenced explicitly; compensating stock/accounting/settlement effects are created.

### TransferStock
Must produce paired source-out + destination-in effects under one command transaction or an equivalent balanced transfer representation. Net business inventory value must remain consistent except for explicitly modeled transfer-cost rules.

### InventoryAdjustment
Requires count lifecycle discipline, approval where configured, valuation snapshot, movement, accounting effect when value changes, and audit.

### CloseCashShift
Must compare expected vs actual cash from canonical cash movement truth and record approved difference treatment explicitly rather than silently overwriting balances.

## Ownership conflict review
No duplicate canonical ownership accepted. In particular:
- Money arithmetic -> MoneyModule
- FX -> CurrencyFx/FxModule
- posting -> Accounting/PostingModule
- stock availability -> Inventory/StockAvailabilityModule
- settlement allocation -> Settlement/PaymentAllocationModule
- numbering -> NumberingModule
- lifecycle -> DocumentLifecycleModule
- authorization -> Authorization/PermissionModule
- audit -> AuditModule
- reversal -> ReversalCorrectionModule

Shared UI components may format or request actions but never own these rules.

## Schema gaps closed in Freeze Candidate 2
- transactional `document_sequences`;
- `operation_log` for idempotency/correlation;
- base-currency snapshots on posted financial documents;
- explicit journal/stock references from commercial documents;
- explicit source/reversal/return links;
- retained COGS and purchase receipt cost snapshots;
- explicit payment allocation ledger;
- mandatory cash-to-ledger mapping;
- append-only audit contract;
- legacy import run, mapping, and reconciliation structures.

## Remaining non-blocking design clarifications before migration v1
1. Final physical representation of sales/purchase returns: dedicated tables vs typed commercial-document tables. Domain contract is already fixed.
2. Exact tax-ready metadata fields, with tax behavior disabled.
3. Exact transfer stock physical representation if one movement header cannot cleanly represent two warehouses.
4. Exact quantity precision policy by unit category.
5. Exact local fiscal/document prefix conventions.

These must be resolved before migration v1 but do not change the accepted architecture.

## Implementation-validation gates
- encrypted SQLite + Android Keystore spike;
- Drift migration behavior under encryption;
- backup/restore validation;
- Noto/RTL/Latin-digit visual spike;
- thermal printer compatibility;
- barcode scanning/printing compatibility;
- representative Android performance;
- domain tests for critical financial/inventory invariants.

## Freeze Candidate 2 conclusion
Architecture, ownership, and schema are internally aligned enough to begin an isolated technical spike. Full application scaffold remains blocked until the spike passes and the remaining physical-schema clarifications are closed.
