# IBEX 2.0 — Operating Command Catalog V1

Status: **Draft for review before engine implementation**

This catalog defines the initial commands that may change operational truth. Queries/read models are separate and must not mutate state.

## Sales
- `CreateSaleDraft`
- `UpdateSaleDraft`
- `DeleteSaleDraft`
- `PostSale`
- `ReturnSale`
- `ReverseSale`

## Purchases
- `CreatePurchaseDraft`
- `UpdatePurchaseDraft`
- `DeletePurchaseDraft`
- `PostPurchase`
- `ReturnPurchase`
- `ReversePurchase`

## Customer settlements
- `ReceiveCustomerPayment`
- `AllocateCustomerPayment`
- `ReverseCustomerReceipt`

## Supplier settlements
- `PaySupplier`
- `AllocateSupplierPayment`
- `ReverseSupplierPayment`

## Cash / treasury
- `OpenCashShift`
- `CloseCashShift`
- `RecordCashReceipt`
- `RecordCashDisbursement`
- `TransferCash`
- `RecordExpense`
- `ReverseCashDocument`

## Inventory
- `TransferStock`
- `StartInventoryCount`
- `SubmitInventoryCount`
- `ApproveInventoryAdjustment`
- `PostInventoryAdjustment`
- `ReverseInventoryAdjustment`

## Master data
Master-data commands are mutable but do not post financial truth directly:
- `CreateCustomer`
- `UpdateCustomer`
- `DeactivateCustomer`
- `CreateSupplier`
- `UpdateSupplier`
- `DeactivateSupplier`
- `CreateProduct`
- `UpdateProduct`
- `DeactivateProduct`
- `CreateUnit`
- `UpdateUnit`
- `CreateWarehouse`
- `UpdateWarehouse`
- `CreateCashAccount`
- `UpdateCashAccount`
- `SetExchangeRate`

## Users & access
- `CreateUser`
- `UpdateUser`
- `DisableUser`
- `AssignRole`
- `GrantRolePermission`
- `RevokeRolePermission`
- `ChangeLocalPin`

## System / lifecycle
- `InitializeBusiness`
- `UpdateBusinessSettings`
- `CreateBackup`
- `RestoreBackup`
- `ImportLegacyData`
- `RebuildInventoryProjection`
- `RebuildPartyBalanceProjection`
- `RebuildDashboardProjection`

## Rules
1. Every command has a stable name and versioned input contract when needed.
2. Every posted command has a correlation/operation id.
3. Commands that change financial/stock truth execute through the central Operating Engine.
4. A command may call multiple domain services but owns one application-level transaction boundary.
5. UI widgets do not chain low-level database writes to simulate a command.
6. Every command must map to permissions, tables, accounting effects, inventory effects, audit events, and acceptance tests before implementation.

## Next artifact
Create `COMMAND_TRACEABILITY_V1.md` with columns/concepts:
- Command
- Required permission
- Preconditions
- Tables read
- Tables written
- Accounting effect
- Inventory effect
- Party/cash effect
- Audit event
- Reversal command
- Acceptance scenarios
