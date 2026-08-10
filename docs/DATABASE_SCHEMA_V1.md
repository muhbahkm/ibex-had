# IBEX 2.0 — Local Database Schema Blueprint V1

Status: **Freeze Candidate 2 — design contract, not yet implemented**

Source of truth when implementation starts: GitHub migrations + Drift table definitions + executable domain tests. Production Supabase remains strictly read-only during this redesign.

## Global conventions
- Primary keys: UUID text generated locally.
- Timestamps: UTC ISO-8601; business date stored separately where legally/operationally meaningful.
- Monetary values: signed INTEGER scaled by 10,000.
- Exchange rates: signed INTEGER scaled by 100,000,000.
- Quantities: signed INTEGER; default internal quantity scale 1,000 unless unit policy requires otherwise.
- Posted financial/inventory documents are immutable.
- Corrections are new linked compensating documents/entries/movements.
- Foreign keys enabled and enforced.
- Financial/inventory state-changing commands execute inside one explicit DB transaction.
- All rendered digits use Latin `0-9`.
- No UI/report/dashboard/import/sync layer owns canonical balances or posting logic.
- Transaction currency + base currency snapshots are frozen on every posted financial record.

## Core identity and configuration
### businesses
- id PK
- code UNIQUE
- name
- legal_name nullable
- base_currency_id FK
- timezone
- is_active
- created_at
- updated_at

### users
- id PK
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
- id PK
- business_id FK
- name
- is_system
- created_at

### permissions
- id PK
- code UNIQUE
- description

### role_permissions
- role_id FK
- permission_id FK
- PRIMARY KEY(role_id, permission_id)

### currencies
- id PK
- code UNIQUE
- name
- symbol
- display_decimals
- is_active

### exchange_rates
- id PK
- business_id FK
- from_currency_id FK
- to_currency_id FK
- rate_scaled
- effective_at
- source
- created_by_user_id FK
- UNIQUE(business_id, from_currency_id, to_currency_id, effective_at)

## Transactional document numbering
### document_sequences
Canonical owner: NumberingModule.
- id PK
- business_id FK
- document_type
- prefix
- fiscal_scope nullable
- next_value INTEGER
- padding INTEGER
- updated_at
- UNIQUE(business_id, document_type, fiscal_scope)

Rules:
- allocation occurs inside the same transaction as document creation/posting where required;
- no UI-generated authoritative sequence numbers;
- future sync may add device ranges, but V1 remains single-local-authority.

## Parties
### customers
- id PK
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
Same canonical pattern as customers with supplier-specific code/notes.

## Products and units
### categories
- id PK
- business_id FK
- name
- parent_id nullable self-FK
- is_active

### units
- id PK
- business_id FK
- code
- name
- quantity_decimals
- is_active
- UNIQUE(business_id, code)

### products
- id PK
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
- id PK
- product_id FK
- unit_id FK
- conversion_factor_scaled
- is_default_sale_unit
- is_default_purchase_unit
- UNIQUE(product_id, unit_id)

### product_prices
- id PK
- product_id FK
- unit_id FK
- currency_id FK
- price_scaled
- price_type
- effective_from
- effective_to nullable

## Warehousing
### warehouses
- id PK
- business_id FK
- code UNIQUE per business
- name
- is_default
- is_active

### stock_movements
Canonical source for inventory truth.
- id PK
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
- operation_id nullable
- notes nullable

### stock_movement_items
- id PK
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
Rebuildable projection/cache only; never independent truth.
- warehouse_id FK
- product_id FK
- quantity_scaled
- inventory_value_scaled
- wac_unit_cost_scaled
- updated_at
- PRIMARY KEY(warehouse_id, product_id)

### inventory_counts
- id PK
- business_id FK
- warehouse_id FK
- document_no UNIQUE per business
- status (draft, submitted, approved, posted, reversed)
- counted_at
- submitted_at nullable
- approved_at nullable
- posted_at nullable
- created_by_user_id FK
- approved_by_user_id nullable FK
- posted_by_user_id nullable FK
- reversal_of_id nullable self-FK

### inventory_count_items
- id PK
- inventory_count_id FK
- product_id FK
- system_quantity_scaled
- counted_quantity_scaled
- variance_quantity_scaled
- valuation_unit_cost_scaled

## Sales
### sales
- id PK
- business_id FK
- document_no UNIQUE per business
- customer_id nullable FK
- warehouse_id FK
- currency_id FK
- exchange_rate_scaled
- base_currency_id FK
- status (draft, posted, reversed)
- sale_at
- business_date
- subtotal_scaled
- discount_scaled
- tax_scaled
- total_scaled
- total_base_scaled
- paid_scaled
- paid_base_scaled
- balance_scaled
- balance_base_scaled
- notes nullable
- created_by_user_id FK
- posted_by_user_id nullable FK
- posted_at nullable
- reversal_of_id nullable self-FK
- return_of_id nullable self-FK
- journal_entry_id nullable FK
- stock_movement_id nullable FK
- operation_id nullable UNIQUE

### sale_items
- id PK
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
- net_base_scaled
- cogs_unit_cost_scaled
- cogs_total_scaled
- cogs_total_base_scaled
- source_sale_item_id nullable self-FK

### sales_returns
Implemented as dedicated linked commercial documents or a typed sale document; exact physical-table choice may be finalized in implementation, but canonical contract requires source sale + source line links, immutable posting, accounting reversal semantics, and stock-in movement.

## Purchases
### purchases
- id PK
- business_id FK
- document_no UNIQUE per business
- supplier_id FK
- warehouse_id FK
- currency_id FK
- exchange_rate_scaled
- base_currency_id FK
- status (draft, posted, reversed)
- purchase_at
- business_date
- subtotal_scaled
- discount_scaled
- tax_scaled
- total_scaled
- total_base_scaled
- paid_scaled
- paid_base_scaled
- balance_scaled
- balance_base_scaled
- notes nullable
- created_by_user_id FK
- posted_by_user_id nullable FK
- posted_at nullable
- reversal_of_id nullable self-FK
- return_of_id nullable self-FK
- journal_entry_id nullable FK
- stock_movement_id nullable FK
- operation_id nullable UNIQUE

### purchase_items
- id PK
- purchase_id FK
- product_id FK
- unit_id FK
- quantity_scaled
- base_quantity_scaled
- unit_cost_scaled
- unit_cost_base_scaled
- gross_scaled
- discount_scaled
- tax_scaled
- net_scaled
- net_base_scaled
- receipt_unit_cost_scaled
- receipt_total_cost_scaled
- source_purchase_item_id nullable self-FK

### purchase_returns
Same lifecycle principles as sales returns: explicit source links, immutable posting, stock-out movement, and compensating accounting entry.

## Cash and settlement
### cash_accounts
- id PK
- business_id FK
- code UNIQUE per business
- name
- account_type (cash, bank, wallet)
- currency_id FK
- ledger_account_id FK NOT NULL
- is_active

### payments
- id PK
- business_id FK
- payment_no UNIQUE per business
- direction (in, out)
- party_type nullable
- party_id nullable
- cash_account_id FK
- currency_id FK
- exchange_rate_scaled
- base_currency_id FK
- amount_scaled
- base_amount_scaled
- status (draft, posted, reversed)
- payment_at
- business_date
- notes nullable
- created_by_user_id FK
- posted_by_user_id nullable FK
- posted_at nullable
- reversal_of_id nullable self-FK
- journal_entry_id nullable FK
- operation_id nullable UNIQUE

### payment_allocations
Canonical settlement ledger; allocation is explicit, auditable, and reversible through compensating allocation records or linked reversal payment.
- id PK
- payment_id FK
- target_type
- target_id
- target_currency_id FK
- allocated_amount_scaled
- target_amount_scaled
- target_base_amount_scaled
- realized_fx_difference_scaled
- created_at
- source_allocation_id nullable self-FK
- is_reversal

## Accounting
### accounts
- id PK
- business_id FK
- code UNIQUE per business
- name
- account_type (asset, liability, equity, revenue, expense)
- parent_id nullable self-FK
- currency_mode
- is_postable
- is_active

### journal_entries
- id PK
- business_id FK
- entry_no UNIQUE per business
- entry_at
- business_date
- source_type
- source_id
- base_currency_id FK
- status (draft, posted, reversed)
- description
- posted_by_user_id nullable FK
- posted_at nullable
- reversal_of_id nullable self-FK
- operation_id nullable UNIQUE

### journal_lines
- id PK
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

Invariant: for every posted entry, `sum(base_debit_scaled) == sum(base_credit_scaled)`.

## Expenses
### expense_categories
- id PK
- business_id FK
- name
- ledger_account_id FK
- is_active

### expenses
- id PK
- business_id FK
- expense_no UNIQUE per business
- category_id FK
- cash_account_id FK
- currency_id FK
- exchange_rate_scaled
- base_currency_id FK
- amount_scaled
- base_amount_scaled
- expense_at
- business_date
- status (draft, posted, reversed)
- notes nullable
- journal_entry_id nullable FK
- reversal_of_id nullable self-FK
- operation_id nullable UNIQUE

## Shifts / cash closing
### shifts
- id PK
- business_id FK
- user_id FK
- cash_account_id FK
- opened_at
- opening_balance_scaled
- closed_at nullable
- expected_closing_scaled nullable
- actual_closing_scaled nullable
- difference_scaled nullable
- status (open, closed, reversed where supported)
- close_operation_id nullable UNIQUE

## Audit and local system state
### audit_logs
Append-only canonical audit evidence.
- id PK
- business_id FK
- user_id nullable FK
- operation_id nullable
- command_name
- entity_type
- entity_id
- action
- occurred_at
- metadata_json
- previous_hash nullable
- record_hash nullable

Rules:
- application code has no update/delete command for audit rows;
- sensitive commands emit audit in the same transaction when feasible;
- audit does not replace domain tables as truth.

### app_settings
- business_id FK
- key
- value_json
- updated_at
- PRIMARY KEY(business_id, key)

### schema_metadata
- key PRIMARY KEY
- value

### operation_log
Idempotency/correlation registry for state-changing commands.
- operation_id PK
- command_name
- business_id FK
- status
- created_at
- completed_at nullable
- result_entity_type nullable
- result_entity_id nullable

### sync_outbox
Reserved for future synchronization; inactive in V1 runtime.
- id PK
- operation_id nullable
- entity_type
- entity_id
- operation
- payload_json
- created_at
- sync_status

## Legacy migration and reconciliation
These tables are import-tooling support, not operational truth.

### legacy_import_runs
- id PK
- source_system
- started_at
- completed_at nullable
- status
- source_fingerprint
- notes nullable

### legacy_entity_map
- id PK
- import_run_id FK
- entity_type
- legacy_id
- new_id
- mapping_status
- UNIQUE(import_run_id, entity_type, legacy_id)

### legacy_reconciliation
- id PK
- import_run_id FK
- metric_code
- legacy_value_scaled nullable
- new_value_scaled nullable
- variance_scaled nullable
- status
- details_json nullable

## Required indexes
At minimum:
- all FK columns used in operational joins;
- sales(business_id, sale_at), sales(customer_id, status), sales(operation_id);
- purchases(business_id, purchase_at), purchases(supplier_id, status), purchases(operation_id);
- stock_movements(warehouse_id, movement_at), stock_movements(reference_type, reference_id);
- stock_movement_items(product_id);
- inventory_balances(product_id, warehouse_id);
- journal_entries(business_id, entry_at), journal_entries(source_type, source_id);
- journal_lines(account_id), journal_lines(party_type, party_id);
- payments(party_type, party_id, payment_at), payments(operation_id);
- payment_allocations(payment_id), payment_allocations(target_type, target_id);
- products(business_id, name), products(barcode);
- audit_logs(business_id, occurred_at), audit_logs(operation_id);
- legacy_entity_map(import_run_id, entity_type, legacy_id).

## Canonical ownership constraints
- AccountingModule owns journal entries/lines and accounting invariants.
- InventoryModule owns stock movements/items and rebuildable inventory projections.
- SettlementModule owns payments and payment allocations.
- NumberingModule owns document_sequences.
- AuditModule owns append-only audit records.
- ReversalCorrectionModule owns reversal/correction linkage rules.
- UI/report/query projections never write canonical financial or inventory truth.

## Freeze Candidate 2 gates
This blueprint may become migration `v1` only after:
1. Command traceability has no unmapped state-changing V1 command.
2. Ownership traceability has no competing canonical owner.
3. Document lifecycle and domain-error contracts match the schema.
4. Posting and inventory movement matrices match all posted commands.
5. Acceptance scenarios cover cash, credit, partial settlement, return, reversal, stock transfer, inventory adjustment, expense, and FX settlement.
6. Encryption/Keystore spike passes on representative Android devices.
7. Printer/barcode spike confirms chosen hardware strategy.
8. Tax-ready metadata review closes without enabling tax behavior.
9. Legacy migration/reconciliation mapping is complete enough to protect existing balances.
10. Full architecture cross-review finds no critical contradiction.
