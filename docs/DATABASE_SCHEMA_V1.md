# IBEX 2.0 — Local Database Schema Blueprint V1

Status: **Freeze Candidate 2 — physical schema decisions closed, implementation not started**

Source of truth when implementation starts: GitHub migrations and Drift table definitions. Production Supabase remains read-only during this redesign.

## Global conventions
- Primary keys: UUID text generated locally.
- Timestamps: UTC ISO-8601 values; UI converts to local time.
- Monetary values: signed INTEGER scaled by 10,000.
- Exchange/tax rates: signed INTEGER scaled by 100,000,000.
- Quantities: signed INTEGER scaled by 1,000,000.
- Posted records are immutable; reversals/returns create new linked records.
- All foreign keys are enabled and enforced.
- All financial/stock workflows execute inside explicit database transactions.
- All user-facing numbers render with Latin digits only.
- UUID is canonical identity; human document numbers are separate immutable business identifiers after posting.

## Core identity and configuration
### businesses
- id
- code UNIQUE
- name
- legal_name nullable
- base_currency_id FK
- timezone
- tax_registration_no nullable
- tax_enabled boolean default false
- is_active
- created_at
- updated_at

### users
- id
- business_id FK
- username UNIQUE per business
- display_name
- pin_hash nullable
- role_id FK
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
- code UNIQUE
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

### document_sequences
Application-owned visible business numbering.
- id
- business_id FK
- document_type
- scope_key
- prefix
- next_value INTEGER
- padding INTEGER default 6
- updated_at
- UNIQUE(business_id, document_type, scope_key)

Default V1 scope: Gregorian year. Example: `SAL-2026-000001`.

## Parties
### customers
- id
- business_id FK
- code UNIQUE per business
- name
- phone nullable
- address nullable
- notes nullable
- tax_registration_no nullable
- credit_limit_scaled nullable
- is_active
- created_at
- updated_at

### suppliers
- id
- business_id FK
- code UNIQUE per business
- name
- phone nullable
- address nullable
- notes nullable
- tax_registration_no nullable
- is_active
- created_at
- updated_at

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
- allowed_decimals INTEGER CHECK 0..6
- display_decimals INTEGER CHECK 0..6 and <= allowed_decimals
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
- conversion_factor_scaled INTEGER scale 1e6
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
One warehouse per movement header.
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
Rebuildable operational cache derived from posted stock movements.
- warehouse_id FK
- product_id FK
- quantity_scaled
- inventory_value_scaled
- wac_unit_cost_scaled
- updated_at
- PRIMARY KEY(warehouse_id, product_id)

### stock_transfers
Canonical business document for warehouse transfer.
- id
- business_id FK
- document_no UNIQUE per business
- source_warehouse_id FK
- destination_warehouse_id FK
- status (draft, posted, reversed)
- transfer_at
- source_movement_id nullable FK
- destination_movement_id nullable FK
- created_by_user_id FK
- posted_by_user_id nullable FK
- posted_at nullable
- reversal_of_id nullable self-FK
- notes nullable

Constraint: source_warehouse_id != destination_warehouse_id.

### stock_transfer_items
- id
- stock_transfer_id FK
- product_id FK
- unit_id FK
- quantity_scaled
- base_quantity_scaled
- transferred_unit_cost_scaled
- transferred_total_cost_scaled

Posting creates two stock movements atomically: `TRANSFER_OUT` and `TRANSFER_IN`, both linked to the same transfer document.

### inventory_counts
- id
- business_id FK
- document_no UNIQUE per business
- warehouse_id FK
- status (draft, submitted, approved, posted, reversed)
- counted_at
- posted_at nullable
- created_by_user_id FK
- posted_by_user_id nullable FK

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
- base_currency_id FK snapshot
- exchange_rate_scaled
- status (draft, posted, reversed)
- sale_at
- subtotal_scaled
- discount_scaled
- tax_mode (disabled, exclusive, inclusive) default disabled
- tax_total_scaled default 0
- total_scaled
- base_total_scaled
- paid_scaled
- balance_scaled
- stock_movement_id nullable FK
- journal_entry_id nullable FK
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
- tax_code_snapshot nullable
- tax_rate_scaled nullable
- tax_amount_scaled default 0
- price_includes_tax boolean default false
- net_scaled
- cogs_unit_cost_scaled
- cogs_total_scaled

### sales_returns
Dedicated immutable return document.
- id
- business_id FK
- document_no UNIQUE per business
- source_sale_id FK
- customer_id nullable FK
- warehouse_id FK
- currency_id FK
- base_currency_id FK snapshot
- exchange_rate_scaled
- status (draft, posted, reversed)
- return_at
- subtotal_scaled
- discount_scaled
- tax_mode (disabled, exclusive, inclusive) default disabled
- tax_total_scaled default 0
- total_scaled
- base_total_scaled
- stock_movement_id nullable FK
- journal_entry_id nullable FK
- created_by_user_id FK
- posted_by_user_id nullable FK
- posted_at nullable
- reversal_of_id nullable self-FK
- notes nullable

### sales_return_items
- id
- sales_return_id FK
- source_sale_item_id FK
- product_id FK
- unit_id FK
- quantity_scaled
- base_quantity_scaled
- unit_price_scaled
- gross_scaled
- discount_scaled
- tax_code_snapshot nullable
- tax_rate_scaled nullable
- tax_amount_scaled default 0
- price_includes_tax boolean default false
- net_scaled
- original_cogs_unit_cost_scaled
- original_cogs_total_scaled

Rule: cumulative posted returned quantity per source sale line may not exceed the original posted quantity.

## Purchases
### purchases
- id
- business_id FK
- document_no UNIQUE per business
- supplier_id nullable FK
- warehouse_id FK
- currency_id FK
- base_currency_id FK snapshot
- exchange_rate_scaled
- status (draft, posted, reversed)
- purchase_at
- subtotal_scaled
- discount_scaled
- tax_mode (disabled, exclusive, inclusive) default disabled
- tax_total_scaled default 0
- total_scaled
- base_total_scaled
- paid_scaled
- balance_scaled
- stock_movement_id nullable FK
- journal_entry_id nullable FK
- created_by_user_id FK
- posted_by_user_id nullable FK
- posted_at nullable
- reversal_of_id nullable self-FK
- notes nullable

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
- tax_code_snapshot nullable
- tax_rate_scaled nullable
- tax_amount_scaled default 0
- price_includes_tax boolean default false
- net_scaled
- receipt_unit_cost_scaled
- receipt_total_cost_scaled

### purchase_returns
Dedicated immutable return document.
- id
- business_id FK
- document_no UNIQUE per business
- source_purchase_id FK
- supplier_id nullable FK
- warehouse_id FK
- currency_id FK
- base_currency_id FK snapshot
- exchange_rate_scaled
- status (draft, posted, reversed)
- return_at
- subtotal_scaled
- discount_scaled
- tax_mode (disabled, exclusive, inclusive) default disabled
- tax_total_scaled default 0
- total_scaled
- base_total_scaled
- stock_movement_id nullable FK
- journal_entry_id nullable FK
- created_by_user_id FK
- posted_by_user_id nullable FK
- posted_at nullable
- reversal_of_id nullable self-FK
- notes nullable

### purchase_return_items
- id
- purchase_return_id FK
- source_purchase_item_id FK
- product_id FK
- unit_id FK
- quantity_scaled
- base_quantity_scaled
- unit_cost_scaled
- gross_scaled
- discount_scaled
- tax_code_snapshot nullable
- tax_rate_scaled nullable
- tax_amount_scaled default 0
- price_includes_tax boolean default false
- net_scaled
- original_receipt_unit_cost_scaled
- original_receipt_total_cost_scaled

Rule: cumulative posted returned quantity per source purchase line may not exceed the original posted quantity.

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
- base_currency_id FK snapshot
- exchange_rate_scaled
- amount_scaled
- base_amount_scaled
- status (posted, reversed)
- payment_at
- journal_entry_id nullable FK
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
- status (posted, reversed)
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
- base_currency_id FK snapshot
- exchange_rate_scaled
- amount_scaled
- base_amount_scaled
- expense_at
- status (posted, reversed)
- notes nullable
- journal_entry_id nullable FK
- reversal_of_id nullable self-FK

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
- status (open, closed)

## Idempotency, audit, and local system state
### operation_log
- operation_id PRIMARY KEY
- business_id FK
- command_name
- entity_type nullable
- entity_id nullable
- status
- result_json nullable
- started_at
- completed_at nullable

A successful operation id cannot be applied twice.

### audit_logs
Append-only by application contract.
- id
- business_id FK
- user_id nullable FK
- operation_id nullable
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

## Legacy migration and reconciliation
### legacy_import_runs
- id
- source_system
- started_at
- completed_at nullable
- status
- source_fingerprint nullable
- notes nullable

### legacy_id_map
- import_run_id FK
- legacy_entity_type
- legacy_id
- new_entity_type
- new_entity_id
- PRIMARY KEY(import_run_id, legacy_entity_type, legacy_id)

### legacy_reconciliation
- id
- import_run_id FK
- metric_code
- source_value_scaled nullable
- target_value_scaled nullable
- difference_scaled nullable
- status
- details_json nullable

## Tax-disabled invariant for V1
While `businesses.tax_enabled = false`:
- document `tax_mode` must equal `disabled`;
- document `tax_total_scaled` must equal 0;
- line `tax_amount_scaled` must equal 0;
- no jurisdiction-specific tax calculation is executed.

## Quantity invariant for V1
- Canonical quantity scale = 1e6 everywhere.
- Unit `allowed_decimals` controls accepted input precision.
- Unit `display_decimals` controls presentation only.
- Canonical stock/accounting logic never uses binary floating point for quantity or money.

## Document numbering invariant
Visible numbers are allocated by `document_sequences` inside the same application transaction as document creation/posting. UUID remains canonical identity. SQLite row IDs/AUTOINCREMENT are not the business numbering source.

Default prefixes:
- SAL sale
- PUR purchase
- SRT sales return
- PRT purchase return
- RCT customer receipt
- PAY supplier payment
- EXP expense
- STX stock transfer
- CNT inventory count/adjustment
- JRN journal entry

## Required indexes
At minimum:
- every FK used in common joins
- sales(business_id, sale_at)
- sales(customer_id, status)
- sales_returns(source_sale_id, status)
- purchases(supplier_id, status)
- purchase_returns(source_purchase_id, status)
- stock_movements(warehouse_id, movement_at)
- stock_movement_items(product_id)
- stock_transfers(business_id, transfer_at)
- journal_entries(business_id, entry_at)
- journal_lines(account_id)
- payments(party_type, party_id, payment_at)
- payment_allocations(target_type, target_id)
- products(business_id, name)
- products(barcode)
- operation_log(business_id, command_name)

## Schema freeze gates
Migration `v1` remains blocked until:
1. encryption + Android Keystore spike passes;
2. Drift migration behavior under encryption passes;
3. backup/restore round trip passes;
4. critical command/domain tests pass on the spike schema;
5. legacy migration reconciliation rules are validated;
6. thermal printing and barcode constraints are validated for the target Android baseline;
7. UI spike confirms Noto typography, RTL, Latin digits, and approved motion/design direction.

Physical representation of returns, stock transfers, tax-ready metadata, quantity precision, and visible document numbering is now closed by `PHYSICAL_SCHEMA_DECISIONS_V1.md`.