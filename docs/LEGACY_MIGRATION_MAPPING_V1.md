# IBEX 2.0 — Legacy Migration Mapping V1

Status: **Baseline mapping; source-field verification required before import implementation**

The legacy production Supabase project remains READ ONLY. Migration tooling will extract, validate, transform, and import into a separate IBEX 2.0 local database. It must never mutate legacy production records.

## Legacy sources identified
- `ibex_had_businesses`
- `ibex_had_users`
- `ibex_had_customers`
- `ibex_had_units`
- `ibex_had_products`
- `ibex_had_cash_accounts`
- `ibex_had_transactions`
- `ibex_had_transaction_items`
- `ibex_had_payments`
- `ibex_had_customer_ledger`
- `ibex_had_settings`
- `ibex_had_audit_logs`
- legacy order/media/automation tables as optional non-core sources

## Mapping strategy

### Business
Legacy `ibex_had_businesses` → V2 `businesses`
- preserve stable legacy id in migration metadata;
- create new V2 UUID unless a deliberate compatibility decision requires reuse;
- map business code/name/default currency/timezone where available.

### Users
Legacy `ibex_had_users` → V2 `users` + roles
- do not migrate plaintext credentials or obsolete auth secrets;
- map identity/display data only after verification;
- assign V2 roles through an explicit role-mapping table.

### Customers
Legacy `ibex_had_customers` → V2 `customers`
- preserve customer name, phone, address, notes, active state where available;
- legacy balance columns are not accepted as financial truth without reconciliation against transaction/ledger history.

### Units
Legacy `ibex_had_units` → V2 `units`
- map names/codes;
- verify unit precision;
- product conversion rules must be rebuilt explicitly in `product_units` where legacy structure is insufficient.

### Products
Legacy `ibex_had_products` → V2 `products` + `product_units` + `product_prices`
- map product identity, SKU/barcode/name, active state;
- legacy quantity fields are not imported as final stock truth unless reconciled;
- derive opening stock from an approved migration snapshot and valuation report.

### Cash accounts
Legacy `ibex_had_cash_accounts` → V2 `cash_accounts`
- map account identity, currency, active state;
- opening balance is created as a controlled opening-balance transaction, never by editing a current-balance field.

### Transactions
Legacy `ibex_had_transactions` + `ibex_had_transaction_items` → V2 document history where supported.

Migration modes must be selectable:
1. **Opening-state migration** — import master data + approved opening balances only.
2. **Historical migration** — reconstruct eligible historical sales/purchases/payments when source data is sufficiently consistent.

Historical migration is optional and cannot block V1 go-live if opening-state reconciliation is safer.

### Payments
Legacy `ibex_had_payments` → V2 `payments` + `payment_allocations`
- map only when party/document linkage is unambiguous;
- ambiguous allocations are reported, not guessed.

### Customer ledger
Legacy `ibex_had_customer_ledger` is a reconciliation source, not automatically the destination model.
- compare derived V2 customer balances against approved legacy balances at cutover;
- discrepancies require a reconciliation report and explicit opening adjustment decision.

### Settings
Legacy `ibex_had_settings` → selected V2 `app_settings`
- migrate only supported settings;
- UI/theme/runtime settings are reviewed individually rather than bulk-copied.

### Audit history
Legacy audit data is retained as legacy archive/reference unless a legal/business need requires import.
- V2 audit logs begin independently at cutover.

## Required migration metadata
Every imported V2 row that originates from legacy data should be traceable during migration through:
- legacy_source_table
- legacy_source_id
- migration_batch_id
- imported_at

These fields may live in a dedicated migration mapping table instead of every domain table.

## Reconciliation gates
Before migration is accepted, produce a report comparing:
- customer count and approved receivable balances;
- supplier count/balances where applicable;
- product count;
- stock quantity and value by warehouse/product;
- cash/bank/wallet opening balances;
- transaction counts for any historically migrated document type;
- base-currency trial-balance opening totals.

## Error policy
- Never silently coerce invalid UUIDs, dates, currencies, or amounts.
- Never silently infer missing customer/supplier links in financial history.
- Every rejected/ambiguous source row goes to a migration exception report.
- Migration is repeatable and idempotent by batch into a fresh test database.
- Production legacy remains untouched.

## Final verification work still required
Before coding the importer, read the exact legacy schema and sample source rows in read-only mode and replace this baseline with field-level source → target mapping and transformation rules.
