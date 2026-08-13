# IBEX 2.0 — Command Traceability Matrix V1

Status: **Architecture baseline — required before domain/schema freeze**

## Purpose
Every state-changing command must have one explicit owner path from intent to persistence. This matrix binds commands to permissions, canonical owner modules, persistence, financial/stock effects, audit evidence, correction path, and acceptance tests.

## Cross-cutting rules
- UI never writes business truth directly.
- All posted financial/stock commands go through `IBEX Operating Engine`.
- Every posted command carries `operation_id`, actor, device/app instance, and UTC timestamp.
- Any command that touches accounting, stock, settlement, or posted documents is atomic.
- Posted records are immutable; correction is by linked reversal/return/adjustment.
- Permission checks occur inside the application/domain command path, not only in UI visibility.

## Sales

| Command | Owner | Permission | Core reads | Core writes | Accounting | Inventory | Party/Cash | Audit | Correction | Acceptance |
|---|---|---|---|---|---|---|---|---|---|---|
| `CreateSaleDraft` | SalesModule | `sales.create` | products, product_prices, customers, warehouses, currencies | sales, sale_items | none | none | none | draft-created | `DeleteSaleDraft` | draft CRUD |
| `UpdateSaleDraft` | SalesModule | `sales.edit_draft` | sale, product/unit/customer data | sales, sale_items | none | none | none | draft-updated | restore/update draft | draft CRUD |
| `DeleteSaleDraft` | SalesModule | `sales.delete_draft` | sale status | sales, sale_items | none | none | none | draft-deleted | none | draft deletion |
| `PostSale` | SalesModule + Operating Engine | `sales.post` | sales/items, product/unit, inventory_balances, prices, customer, accounts, exchange_rates, cash accounts | sales, stock_movements/items, inventory_balances, journal_entries/lines, payments/payment_allocations when paid, audit_logs | Revenue, A/R or Cash, COGS, Inventory | outbound movement at stored COGS | customer balance and/or cash | sale-posted | `ReturnSale` / `ReverseSale` | A1-A4, C2, G, H, I |
| `ReturnSale` | SalesReturnModule | `sales.return` | source sale/items, prior returns, original COGS, stock | sales_returns/items, stock movements, journals, settlement adjustment as needed | reverse revenue/receivable/cash and COGS effect | inbound at original sale COGS | refund or A/R correction | sale-return-posted | reverse return if supported | A5, C3, H |
| `ReverseSale` | ReversalModule | `sales.reverse` | source posted sale and all linked effects | linked compensating document/movements/journals | exact compensating accounting | exact compensating stock where allowed | compensating party/cash | sale-reversed | no destructive delete | H2-H3 |

## Purchases

| Command | Owner | Permission | Core reads | Core writes | Accounting | Inventory | Party/Cash | Audit | Correction | Acceptance |
|---|---|---|---|---|---|---|---|---|---|---|
| `PostPurchase` | PurchaseModule + Operating Engine | `purchases.post` | purchase/items, supplier, warehouse, product/unit, cash/accounts, FX | purchases, stock movements/items, inventory_balances, journals, payments/allocations when paid | Inventory/expense as applicable, A/P or Cash | inbound and WAC recalculation | supplier balance and/or cash | purchase-posted | `ReturnPurchase` / `ReversePurchase` | B1-B2, C1, G-I |
| `ReturnPurchase` | PurchaseReturnModule | `purchases.return` | source receipt/items, prior returns, original receipt cost | purchase_returns, stock movements, journals, settlement adjustments | reduce inventory/AP or recover cash | outbound at traceable source cost | supplier/cash correction | purchase-return-posted | reverse return if supported | B3, H |
| `ReversePurchase` | ReversalModule | `purchases.reverse` | source posted purchase and linked effects | compensating records | compensating accounting | compensating stock | compensating supplier/cash | purchase-reversed | none destructive | H2-H3 |

Draft create/update/delete commands for purchases follow the same ownership pattern as sales drafts and do not change accounting or stock truth.

## Customer settlement

| Command | Owner | Permission | Core reads | Core writes | Accounting | Inventory | Party/Cash | Audit | Correction | Acceptance |
|---|---|---|---|---|---|---|---|---|---|---|
| `ReceiveCustomerPayment` | SettlementModule | `receipts.create` | customer open items, cash account, currency/FX | payments, payment_allocations, journals, audit | Dr Cash / Cr A/R plus FX gain/loss if needed | none | cash up, customer receivable down | customer-receipt-posted | `ReverseCustomerReceipt` | F1, F3, G-I |
| `AllocateCustomerPayment` | PaymentAllocationModule | `receipts.allocate` | unallocated payment, receivables | payment_allocations | no new cash; accounting only if model requires allocation-side realization | none | allocation only | receipt-allocated | deallocate/reverse under policy | F1, F3 |
| `ReverseCustomerReceipt` | ReversalModule | `receipts.reverse` | original receipt/allocations/journal | compensating payment/journal/allocation state | inverse original | none | cash down, A/R restored | receipt-reversed | none destructive | H2-H3 |

## Supplier settlement

| Command | Owner | Permission | Core reads | Core writes | Accounting | Inventory | Party/Cash | Audit | Correction | Acceptance |
|---|---|---|---|---|---|---|---|---|---|---|
| `PaySupplier` | SettlementModule | `payments.create` | supplier open items, cash account, FX | payments, allocations, journals | Dr A/P / Cr Cash plus FX gain/loss if needed | none | cash down, payable down | supplier-payment-posted | `ReverseSupplierPayment` | F2-F3, G-I |
| `AllocateSupplierPayment` | PaymentAllocationModule | `payments.allocate` | unallocated supplier payment, payables | payment_allocations | allocation-specific realization only if required | none | allocation only | supplier-payment-allocated | reverse allocation | F2-F3 |
| `ReverseSupplierPayment` | ReversalModule | `payments.reverse` | original payment/allocations | compensating records | inverse original | none | cash restored, payable restored | supplier-payment-reversed | none destructive | H2-H3 |

## Cash / treasury

| Command | Owner | Permission | Main effect | Accounting | Audit / correction |
|---|---|---|---|---|---|
| `OpenCashShift` | CashTreasuryModule | `cash.shift.open` | create active shift snapshot | normally none | open event; no duplicate open shift |
| `CloseCashShift` | CashTreasuryModule | `cash.shift.close` | expected vs counted cash, variance | variance posts only via explicit approved rule | close event; reopening requires governed workflow |
| `RecordCashReceipt` | CashTreasuryModule | `cash.receipt.create` | cash inflow not tied to customer settlement | mapped debit/credit accounts required | reversible cash document |
| `RecordCashDisbursement` | CashTreasuryModule | `cash.disbursement.create` | cash outflow | mapped debit/credit accounts required | reversible cash document |
| `TransferCash` | CashTreasuryModule | `cash.transfer` | source cash down / destination cash up | balanced cash-to-cash transfer | atomic; reversible transfer |
| `RecordExpense` | ExpenseModule | `expenses.create` | cash/AP expense | Dr Expense / Cr Cash or Payable | `ReverseCashDocument` |

## Inventory

| Command | Owner | Permission | Reads | Writes | Accounting | Stock | Audit / correction | Acceptance |
|---|---|---|---|---|---|---|---|---|
| `TransferStock` | InventoryModule | `inventory.transfer` | source availability/WAC, destination warehouse | paired stock movements/items, inventory_balances | normally none; inventory asset value preserved | source - / destination + same value | transfer-posted / reverse transfer | D, G-I |
| `StartInventoryCount` | InventoryCountModule | `inventory.count.start` | warehouse/product snapshot | inventory_counts/items | none | none yet | count-started | E |
| `SubmitInventoryCount` | InventoryCountModule | `inventory.count.submit` | count items | count status/snapshot | none | none yet | count-submitted | E |
| `ApproveInventoryAdjustment` | InventoryCountModule | `inventory.count.approve` | variances, valuation | approval metadata | none until post | none until post | adjustment-approved | E |
| `PostInventoryAdjustment` | InventoryModule | `inventory.adjust.post` | approved variance, WAC / valuation | stock movement/items, inventory_balances, journal | inventory gain/loss accounts | +/- variance | adjustment-posted / `ReverseInventoryAdjustment` | E, G-I |
| `ReverseInventoryAdjustment` | ReversalModule | `inventory.adjust.reverse` | source adjustment | compensating movement/journal | inverse | inverse | adjustment-reversed | H |

## Master data ownership
Master-data commands do not directly post financial truth. They still require canonical owners, permission checks, validation and audit for sensitive changes.

- Customers: `CustomerModule`
- Suppliers: `SupplierModule`
- Products/categories/units/prices: `ProductModule`, `CategoryModule`, `UnitModule`, `PricingModule`
- Warehouses: `WarehouseModule`
- Cash accounts: `CashTreasuryModule`
- Exchange rates: `CurrencyFxModule`
- Users/roles/permissions: `UserModule`, `RolePermissionModule`, `AuthorizationModule`

Deactivation is preferred over hard deletion when records are already referenced.

## System commands
- `InitializeBusiness` — creates baseline business configuration and required system accounts atomically.
- `CreateBackup` — `BackupService`; read-only against active DB, produces encrypted/versioned package.
- `RestoreBackup` — `RestoreService`; validates in isolation before atomic activation.
- `ImportLegacyData` — migration/import boundary; never mutates legacy production source.
- `RebuildInventoryProjection` — rebuilds cache from canonical stock movements; cannot alter canonical movement history.
- `RebuildPartyBalanceProjection` — rebuilds derived balances from canonical settlements/journals.
- `RebuildDashboardProjection` — rebuilds analytics only; cannot become a competing financial truth.

## Freeze gate
No command is implementation-ready until:
1. its owner module is fixed;
2. permission code is fixed;
3. preconditions and domain errors are enumerated;
4. exact tables/ports are mapped;
5. accounting and stock effects are deterministic;
6. reversal/correction route is defined;
7. audit evidence is defined;
8. acceptance scenarios exist;
9. atomicity test exists for multi-write commands.
