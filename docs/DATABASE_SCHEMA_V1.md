# IBEX 2.0 — Local Database Schema Blueprint V1

Status: **Design baseline — schema not yet implemented**

Source of truth when implementation starts: GitHub migrations and Drift table definitions. Production Supabase remains read-only during this redesign.

## Global conventions
- Primary keys: UUID text generated locally.
- Timestamps: UTC ISO-8601 values; UI converts to local time.
- Monetary values: signed INTEGER scaled by 10,000.
- Exchange rates: signed INTEGER scaled by 100,000,000.
- Quantities: signed INTEGER scaled by configurable unit precision; default internal quantity scale 1,000.
- Posted records are immutable; reversals create new records.
- All foreign keys enabled and enforced.
- All write-heavy business workflows use explicit database transactions.
- All user-facing numbers render with Latin digits only.

## Core identity and configuration
### businesses
- id
- code UNIQUE
- name
- legal_name nullable
- base_currency_id
- timezone
- is_active
- created_at
- updated_at

### users
- id
- business_id FK
- username UNIQUE per business
- display_name
- pin_hash nullable
- role_id
- is_active
- last_login_at nullable
- created_at
- updated_at

### roles
- id
- business_id FK
- name
- is_system
- created_at

### permissions
- id
- code UNIQUE
- description

### role_permissions
- role_id FK
- permission_id FK
- PRIMARY KEY(role_id, permission_id)

### currencies
- id
- code UNIQUE (YER, SAR, USD...)
- name
- symbol
- display_decimals
- is_active

### exchange_rates
- id
- business_id FK
- from_currency_id FK
- to_currency_id FK
- rate_scaled
- effective_at
- source
- created_by_user_id FK

## Parties
### customers
- id
- business_id FK
- code UNIQUE per business
- name
- phone nullable
- address nullable
- notes nullable
- credit_limit_scaled nullable
- is_active
- created_at
- updated_at

### suppliers
Same core pattern as customers, with supplier-specific code and notes.

## Products and units
### categories
- id
- business_id FK
- name
- parent_id nullable self-FK
- is_active

### units
- id
- business_id FK
- code
- name
- quantity_decimals
- is_active

### products
- id
- business_id FK
- sku nullable UNIQUE per business
- barcode nullable
- name
- category_id nullable FK
- base_unit_id FK
- track_stock
- allow_discount
- is_active
- created_at
- updated_at

### product_units
- id
- product_id FK
- unit_id FK
- conversion_factor_scaled
- is_default_sale_unit
- is_default_purchase_unit
- UNIQUE(product_id, unit_id)

### product_prices
- id
- product_id FK
- unit_id FK
- currency_id FK
- price_scaled
- price_type
- effective_from
- effective_to nullable

## Warehousing
### warehouses
- id
- business_id FK
- code UNIQUE per business
- name
- is_default
- is_active

### stock_movements
- id
- business_id FK
- warehouse_id FK
- movement_type
- reference_type
- reference_id
- status (draft, posted, reversed)
- movement_at
- posted_at nullable
- posted_by_user_id nullable FK
- reversal_of_id nullable self-FK
- notes nullable

### stock_movement_items
- id
- stock_movement_id FK
- product_id FK
- unit_id FK
- quantity_scaled
- base_quantity_scaled
- unit_cost_scaled
- total_cost_scaled
- source_line_type nullable
- source_line_id nullable

### inventory_balances
Materialized operational cache, rebuildable from movements.
- warehouse_id FK
- product_id FK
- quantity_scaled
- inventory_value_scaled
- wac_unit_cost_scaled
- updated_at
- PRIMARY KEY(warehouse_id, product_id)

### inventory_counts
- id
- business_id FK
- warehouse_id FK
- status
- counted_at
- posted_at nullable
- created_by_user_id FK

### inventory_count_items
- id
- inventory_count_id FK
- product_id FK
- system_quantity_scaled
- counted_quantity_scaled
- variance_quantity_scaled
- valuation_unit_cost_scaled

## Sales
### sales
- id
- business_id FK
- document_no UNIQUE per business
- customer_id nullable FK
- warehouse_id FK
- currency_id FK
- exchange_rate_scaled
- status (draft, posted, cancelled, reversed)
- sale_at
- subtotal_scaled
- discount_scaled
- tax_scaled
- total_scaled
- paid_scaled
- balance_scaled
- notes nullable
- created_by_user_id FK
- posted_by_user_id nullable FK
- posted_at nullable
- reversal_of_id nullable self-FK

### sale_items
- id
- sale_id FK
- product_id FK
- unit_id FK
- quantity_scaled
- base_quantity_scaled
- unit_price_scaled
- gross_scaled
- discount_scaled
- tax_scaled
- net_scaled
- cogs_unit_cost_scaled
- cogs_total_scaled

### sales_returns
Use a separate document linked to original sale where possible; schema mirrors sale financial metadata and points to source_sale_id.

## Purchases
### purchases
Mirrors sales with supplier_id, warehouse_id, currency, rate, totals, payment state, posting metadata.

### purchase_items
- id
- purchase_id FK
- product_id FK
- unit_id FK
- quantity_scaled
- base_quantity_scaled
- unit_cost_scaled
- gross_scaled
- discount_scaled
- tax_scaled
- net_scaled

### purchase_returns
Separate immutable document linked to source purchase where possible.

## Cash and settlement
### cash_accounts
- id
- business_id FK
- code UNIQUE per business
- name
- account_type (cash, bank, wallet)
- currency_id FK
- ledger_account_id FK
- is_active

### payments
- id
- business_id FK
- payment_no UNIQUE per business
- direction (in, out)
- party_type nullable
- party_id nullable
- cash_account_id FK
- currency_id FK
- exchange_rate_scaled
- amount_scaled
- base_amount_scaled
- status
- payment_at
- notes nullable
- created_by_user_id FK
- posted_at nullable
- reversal_of_id nullable self-FK

### payment_allocations
- id
- payment_id FK
- target_type
- target_id
- allocated_amount_scaled
- target_currency_id FK
- target_amount_scaled
- realized_fx_difference_scaled

## Accounting
### accounts
- id
- business_id FK
- code UNIQUE per business
- name
- account_type (asset, liability, equity, revenue, expense)
- parent_id nullable self-FK
- currency_mode
- is_postable
- is_active

### journal_entries
- id
- business_id FK
- entry_no UNIQUE per business
- entry_at
- source_type
- source_id
- status (draft, posted, reversed)
- description
- posted_by_user_id nullable FK
- posted_at nullable
- reversal_of_id nullable self-FK

### journal_lines
- id
- journal_entry_id FK
- account_id FK
- party_type nullable
- party_id nullable
- currency_id FK
- exchange_rate_scaled
- debit_scaled
- credit_scaled
- base_debit_scaled
- base_credit_scaled
- description nullable

Invariant: sum(base_debit_scaled) = sum(base_credit_scaled) for every posted entry.

## Expenses
### expense_categories
- id
- business_id FK
- name
- ledger_account_id FK
- is_active

### expenses
- id
- business_id FK
- expense_no UNIQUE per business
- category_id FK
- cash_account_id FK
- currency_id FK
- exchange_rate_scaled
- amount_scaled
- base_amount_scaled
- expense_at
- status
- notes nullable
- journal_entry_id nullable FK

## Shifts / cash closing
### shifts
- id
- business_id FK
- user_id FK
- cash_account_id FK
- opened_at
- opening_balance_scaled
- closed_at nullable
- expected_closing_scaled nullable
- actual_closing_scaled nullable
- difference_scaled nullable
- status

## Audit and local system state
### audit_logs
- id
- business_id FK
- user_id nullable FK
- entity_type
- entity_id
- action
- occurred_at
- metadata_json

### app_settings
- business_id FK
- key
- value_json
- updated_at
- PRIMARY KEY(business_id, key)

### schema_metadata
- key PRIMARY KEY
- value

### sync_outbox
Reserved for future synchronization; not active in V1 runtime.
- id
- entity_type
- entity_id
- operation
- payload_json
- created_at
- sync_status

## Required indexes
At minimum:
- every FK used in common joins
- sales(business_id, sale_at)
- sales(customer_id, status)
- purchases(supplier_id, status)
- stock_movements(warehouse_id, movement_at)
- stock_movement_items(product_id)
- journal_entries(business_id, entry_at)
- journal_lines(account_id)
- payments(party_type, party_id, payment_at)
- products(business_id, name)
- products(barcode)

## Schema freeze gates
This blueprint cannot become migration `v1` until:
1. Posting matrix is complete.
2. Inventory movement matrix is complete.
3. Acceptance scenarios pass on paper for all core flows.
4. Encryption spike is validated on target Android devices.
5. Tax fields are reviewed for harmless future compatibility.
6. Legacy migration mapping is documented.
