# IBEX 2.0 — Full Architecture Cross-Review V1

Status: **Freeze Candidate 2 — physical-schema clarifications closed**

## Scope
Cross-review of Operating Engine, command catalog, central ownership, schema, document lifecycle, domain errors, accounting posting, inventory movement, settlement, audit, and acceptance contracts.

## Review result
No design-blocking contradiction remains in the current V1 direction. The five previously open physical-schema clarifications are now closed by ADR-012 through ADR-016 and `PHYSICAL_SCHEMA_DECISIONS_V1.md`. Remaining gates are executable implementation validation, not unresolved domain/schema ownership.

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
15. Canonical quantity uses one fixed 1e6 scale with per-unit allowed/display precision.
16. Tax behavior is disabled by default even though future-safe metadata exists.

## Command path validation
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
Atomically finalizes the sale, stock-out movement, COGS snapshot, balanced journal entry, optional payment/allocation, operation log, and audit evidence.

### PostPurchase
Atomically finalizes the purchase, stock-in movement, receipt cost/WAC impact, supplier liability/cash effect, journal entry, operation log, and audit evidence.

### ReceiveCustomerPayment / PaySupplier
Preserves payment currency, base value, allocations, realized FX difference, cash-account ledger mapping, journal entry, audit, and reversal linkage.

### Sales/Purchase Return
Uses dedicated immutable return documents linked to source headers and source lines. Posting creates compensating stock/accounting effects and validates cumulative returned quantity against the original posted line.

### TransferStock
Uses one `stock_transfers` business document and two stock movement headers in one application transaction: source `TRANSFER_OUT` and destination `TRANSFER_IN`. The transferred carrying value is preserved; no transfer profit/loss is created merely by moving inventory.

### InventoryAdjustment
Requires count lifecycle discipline, approval where configured, valuation snapshot, movement, accounting effect when value changes, and audit.

### CloseCashShift
Compares expected vs actual cash from canonical cash movement truth and records approved difference treatment explicitly rather than silently overwriting balances.

## Ownership conflict review
No duplicate canonical ownership accepted. In particular:
- Money arithmetic -> MoneyModule
- Quantity arithmetic/precision -> QuantityModule
- FX -> CurrencyFx/FxModule
- posting -> Accounting/PostingModule
- stock availability -> Inventory/StockAvailabilityModule
- settlement allocation -> Settlement/PaymentAllocationModule
- numbering -> NumberingModule
- lifecycle -> DocumentLifecycleModule
- authorization -> Authorization/PermissionModule
- audit -> AuditModule
- reversal -> ReversalCorrectionModule

## Closed physical-schema decisions
1. **Returns** — dedicated immutable sales/purchase return tables linked to source documents and lines.
2. **Transfers** — one transfer document + paired source/destination stock movement headers in one transaction.
3. **Tax-ready metadata** — registration and posted snapshot fields only; tax engine remains disabled.
4. **Quantity precision** — fixed canonical scale 1e6; units control allowed/display decimals 0..6.
5. **Document numbering** — application-owned transactional sequence table; UUID remains canonical identity; default annual human format such as `SAL-2026-000001`.

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
- legacy import run, mapping, and reconciliation structures;
- explicit transfer document and paired movement model;
- explicit return document/line model;
- fixed quantity precision contract;
- tax-disabled future metadata contract.

## Remaining implementation-validation gates
- encrypted SQLite + Android Keystore spike;
- Drift migration behavior under encryption;
- backup/restore validation;
- Noto/RTL/Latin-digit visual spike;
- thermal printer compatibility;
- barcode scanning/printing compatibility;
- representative Android performance;
- executable domain tests for critical financial/inventory invariants;
- legacy migration reconciliation validation.

## Freeze Candidate 2 conclusion
Architecture, ownership, physical schema, and domain contracts are now internally aligned enough to begin the isolated Android technical spike. The production application scaffold remains blocked until the spike passes.