# IBEX 2.0 — Ownership & Traceability Matrix V1

Status: **Architecture baseline**

## Purpose
This document binds canonical records, reusable behaviors, queries/projections, and infrastructure capabilities to one owner each. It prevents duplicate business truth and gives implementation reviewers a concrete ownership map.

## Canonical records

| Canonical record / concept | Owner module | Primary persistence | Typical projections / consumers | Mutation path |
|---|---|---|---|---|
| Business | Business/Settings domain | `businesses` | app bootstrap, settings | Operating Engine command |
| User | UserModule | `users` | session, settings, audit actor | user commands |
| Role / Permission | RolePermissionModule | `roles`, `permissions`, `role_permissions` | permission queries | access commands |
| Customer | CustomerModule | `customers` | POS selector, customer list, statement, dashboard | customer commands |
| Supplier | SupplierModule | `suppliers` | purchase selector, supplier statement | supplier commands |
| Product | ProductModule | `products` | POS, purchases, inventory, reports | product commands |
| Category | CategoryModule | `categories` | catalog filters | category commands |
| Unit / Product Unit | UnitModule | `units`, `product_units` | quantity entry, selectors | unit/product commands |
| Price | PricingModule | `product_prices` | POS price projection | pricing commands |
| Warehouse | WarehouseModule | `warehouses` | stock selectors, reports | warehouse commands |
| Sale | SalesModule | `sales`, `sale_items` | POS receipt, sales list, customer history | sales commands |
| Sales Return | SalesReturnModule | sales-return tables | return list, source-sale history | return commands |
| Purchase | PurchaseModule | `purchases`, `purchase_items` | purchases list, supplier history | purchase commands |
| Purchase Return | PurchaseReturnModule | purchase-return tables | return list | return commands |
| Stock Movement | InventoryModule | `stock_movements`, `stock_movement_items` | stock ledger, item history | inventory/commerce commands |
| Inventory Balance Cache | InventoryModule | `inventory_balances` | availability, dashboard | derived only from canonical movements |
| Inventory Count | InventoryCountModule | `inventory_counts`, `inventory_count_items` | count workflow | count commands |
| Cash Account | CashTreasuryModule | cash-account tables | POS payment, treasury views | cash-account commands |
| Cash Shift | CashTreasuryModule | cash-shift tables | cashier state, shift reports | shift commands |
| Payment | SettlementModule | payment tables | receipt/payment views | settlement commands |
| Payment Allocation | PaymentAllocationModule | `payment_allocations` | statements/open-item views | allocation commands |
| Account | AccountingModule | accounts table | accounting screens | accounting setup commands |
| Journal Entry / Line | AccountingModule | `journal_entries`, `journal_lines` | ledger, trial balance, reports | generated only by posting paths |
| Exchange Rate | CurrencyFxModule | `exchange_rates` | posting snapshots, FX screens | `SetExchangeRate` |
| Document Number | NumberingModule | document sequence table | all posted documents | transactional numbering service |
| Audit Event | AuditModule | append-only audit table | admin/audit views | audit service only |
| Backup Package | BackupService | external encrypted package | backup history metadata | backup command |
| Legacy Mapping | MigrationModule | migration mapping/reconciliation tables | migration reports | import workflow |

## Reusable behavior ownership

| Behavior | Owner | Forbidden duplication locations |
|---|---|---|
| Money arithmetic / rounding | MoneyModule | UI, reports, repository SQL snippets |
| Quantity precision / unit conversion | QuantityModule | POS widgets, inventory screen logic |
| FX conversion / realized gain-loss | CurrencyFxModule / Fx behavior | settlements UI, reports |
| Stock sufficiency | StockAvailabilityModule | POS, transfer screen, purchase return UI |
| WAC valuation | InventoryModule | reports, sales UI, repository ad-hoc calculations |
| Accounting proposal/posting | PostingModule + AccountingModule | sales/purchase UI |
| Payment allocation | PaymentAllocationModule | customer/supplier screen code |
| Document state transition | DocumentLifecycleModule | widget/button state code |
| Number generation | NumberingModule | each feature independently |
| Permission decision | AuthorizationModule | route/UI-only checks |
| Audit evidence | AuditModule | feature-specific logging as business truth |
| Reversal/correction | ReversalModule | direct record edits/deletes |
| Latin-digit rendering | shared formatting/presentation policy | individual screen custom conversions |

## Query / projection ownership
Read models may be optimized, but must declare canonical sources.

| Projection | Owner query service | Canonical sources |
|---|---|---|
| `CustomerPosProjection` | CustomerQueryService | customers + approved balance/price/credit views |
| `CustomerStatementProjection` | PartyBalanceQueryService | canonical journals/settlements/open items |
| `SupplierStatementProjection` | PartyBalanceQueryService | journals/settlements/open items |
| `ProductPosProjection` | ProductQueryService | products, prices, units, inventory balance projection |
| `SaleListProjection` | SalesQueryService | sales + customer summary |
| `SaleDetailProjection` | SalesQueryService | sale header/items + linked effects |
| `InventoryOnHandProjection` | InventoryQueryService | inventory_balances rebuilt from stock movements |
| `StockLedgerProjection` | InventoryQueryService | stock movements/items |
| `DashboardSalesProjection` | AnalyticsQueryService | posted sales only |
| `DashboardCashProjection` | AnalyticsQueryService | canonical cash/journal truth |
| `TrialBalanceProjection` | AccountingQueryService | journal lines |
| `ProfitLossProjection` | AccountingQueryService | journal lines + account classifications |

## Infrastructure ownership
Capabilities are centralized but cannot decide business validity.

- Database transactions — `DatabaseTransactionRunner`
- UUID / operation id — `UuidService`
- clock / UTC — `ClockService`
- local DB encryption — `EncryptionService` + `SecureKeyService`
- backup/restore — `BackupService`, `RestoreService`
- thermal printing — `PrintService`
- barcode/QR — `BarcodeService`
- file/export — `FileStorageService`, `ExportService`
- diagnostic logs — `LoggerService`

## Review rule
If a PR introduces a new record, calculation, validation, status rule, permission rule, projection, or technical capability used by more than one feature, the PR must either:
1. map it to an existing owner in this document; or
2. introduce and document a new owner through an ADR/update.

No `utils` or `helpers` module may become an unowned dumping ground for business rules.

## Freeze gate
Before full scaffold:
- every V1 table maps to one canonical owner or clearly derived owner;
- every command in `COMMAND_CATALOG_V1.md` maps to owner modules;
- every acceptance test maps to commands and owner behaviors;
- no UI-owned financial/stock/lifecycle/permission logic remains in the design;
- query projections declare canonical source truth.
