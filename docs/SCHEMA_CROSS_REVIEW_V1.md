# IBEX 2.0 — Schema Cross-Review V1

Status: **Freeze Candidate 1 — documentation only, not yet implemented**

This review cross-checks the V1 local schema against accounting posting, inventory movement, backup/restore, auditability, migration, and acceptance scenarios. Production Supabase remains read-only.

## Review outcome
The current schema direction is coherent enough to proceed to a technical spike, but several implementation constraints are now mandatory and must be enforced in Drift migrations and domain services.

## 1. Global invariants
Every business table that can participate in sync, audit, or migration must include stable UUID identity. Posted financial and stock records must be immutable. Foreign keys must be enabled. All posting workflows must be atomic transactions.

Required shared fields where applicable:
- `id`
- `business_id`
- `created_at`
- `updated_at`
- `created_by_user_id`
- `status`
- `source_type`
- `source_id`
- `reversal_of_id` / equivalent link where reversal semantics apply

## 2. Money and currency review
Accepted persistence rules:
- money: signed 64-bit integer, scale 10,000;
- FX rate: signed 64-bit integer, scale 100,000,000;
- no REAL/DOUBLE persisted financial truth;
- exact transaction currency and base-currency equivalent captured at posting;
- historical rate never recalculated after posting.

Schema consequence:
Every posted financial document must retain:
- transaction currency id;
- exchange rate used;
- transaction amount(s);
- base amount(s);
- currency display precision snapshot or deterministic currency reference.

## 3. Sales review
`sales` and `sale_items` require enough state to support:
- cash, credit, and partial settlement;
- immutable posting;
- linked return quantities;
- original COGS retention per sale line;
- original unit conversion snapshot;
- original sale price and discounts;
- document numbering and audit trail.

Mandatory line-level fields include:
- product_id
- unit_id
- quantity_scaled
- base_quantity_scaled
- unit_price_scaled
- gross_scaled
- discount_scaled
- net_scaled
- cogs_unit_scaled
- cogs_total_scaled
- source_stock_movement_item_id nullable but strongly recommended after posting

## 4. Purchase review
`purchases` and `purchase_items` must retain receipt cost snapshots to support purchase returns and WAC traceability.

Mandatory line-level fields:
- product_id
- unit_id
- quantity_scaled
- base_quantity_scaled
- unit_cost_scaled
- total_cost_scaled
- source_stock_movement_item_id after posting

## 5. Inventory review
Stock truth is movement-based. No direct product quantity mutation is authoritative.

Required entities:
- warehouses
- stock_movements
- stock_movement_items
- inventory_counts
- inventory_count_items
- optional rebuildable balance cache

`stock_movement_items` must retain:
- product_id
- warehouse_id or movement-side warehouse reference
- direction/type
- quantity_scaled
- unit_cost_scaled
- total_value_scaled
- source_document_type
- source_document_id
- source_document_line_id

Transfer must preserve exact value across source and destination legs.

## 6. WAC review
Moving weighted average requires either:
1. deterministic recomputation from movement ledger, or
2. a cache/snapshot that is strictly rebuildable from the ledger.

Recommended V1 approach:
- movement ledger is authoritative;
- maintain `inventory_balances` as a derived cache for interactive performance;
- every stock-posting transaction updates both movement ledger and cache atomically;
- tests must prove cache rebuild equals cached values.

Suggested cache fields:
- business_id
- warehouse_id
- product_id
- quantity_scaled
- inventory_value_scaled
- wac_scaled
- updated_at

Unique key: `(business_id, warehouse_id, product_id)`.

## 7. Accounting review
Accounting truth is journal-based.

Required entities:
- accounts
- journal_entries
- journal_lines
- fiscal_periods optional for V1 if period locking is deferred, but schema should be future-safe.

`journal_entries` must include source document linkage and posting status.
`journal_lines` must retain currency/base values and dimensional links where needed.

Mandatory invariant:
For every posted entry, sum(debit_base_scaled) == sum(credit_base_scaled).

## 8. Receivables/payables review
Customer and supplier balance must not be stored as manually editable truth.

Recommended model:
- customer/supplier balance is derived from journals and/or immutable allocation ledgers;
- payment allocations explicitly link settlements to open documents;
- advance/unallocated amounts require a deliberate rule, never silent over-allocation.

Required entities:
- payments
- payment_allocations

Allocation fields should retain:
- payment_id
- target_document_type
- target_document_id
- allocated_amount_scaled
- allocated_base_scaled
- realized_fx_gain_loss_scaled where applicable

## 9. Cash review
Cash/bank/wallet accounts must map to accounting accounts and support separate operational identity.

Recommended entity:
`cash_accounts`
- id
- business_id
- name
- type
- currency_id
- ledger_account_id
- is_active

Cash balance is derived from posted journal/payment movement, not an independently editable number.

## 10. Reversal and return review
All reversal-capable documents require explicit linkage.

Rules:
- original remains unchanged;
- reversal/return is a new document;
- repeated reversal beyond eligible amount is blocked;
- partial returns track prior returned quantity/value.

Schema must support:
- `reversal_of_id`
- `return_of_document_id`
- `return_of_line_id`
- cumulative eligibility checks via queries/services.

## 11. Audit review
A dedicated append-only audit log is required for high-risk events:
- login/logout
- failed PIN/biometric attempts where appropriate
- posting
- reversal
- restore
- backup export
- permission change
- user activation/deactivation
- settings changes affecting accounting/inventory behavior

Audit logs must not contain secrets, PINs, database keys, or full sensitive payloads unnecessarily.

## 12. Backup/restore review
The schema must expose a single integer schema version through Drift migration state and backup manifest metadata.

Restore validation must check:
- foreign key integrity;
- balanced posted journals;
- rebuildable inventory cache;
- core business row;
- document number uniqueness;
- supported schema version.

## 13. Legacy migration review
Legacy import must never directly reuse legacy primary keys as the only identity assumption. Maintain mapping tables during import.

Suggested temporary/import entities:
- migration_runs
- migration_id_map
- migration_errors
- migration_reconciliation

These may be excluded from normal UI but retained for audit if production migration occurs.

## 14. Tax readiness review
V1 tax calculation remains disabled. Schema may include nullable tax metadata on documents/lines only if it avoids destructive migration later. No tax journal entry may be created unless a future tax ADR is accepted.

## 15. Document numbering
Every transactional document requires deterministic local numbering independent of network availability.

Recommended fields:
- document_no
- sequence_key
- sequence_value

A local sequence table should reserve numbers transactionally. Sync must never rewrite a posted local document number silently.

## 16. Time handling
Persist timestamps in UTC. Persist business timezone in configuration. Operational date must be derived consistently using business timezone, especially for daily reports and shift close.

## 17. Delete policy
- master data: soft-deactivate where practical;
- drafts: may be hard-deleted only if no downstream posted references exist;
- posted financial/stock documents: never hard-delete;
- audit: append-only, retention policy future ADR.

## 18. Freeze Candidate 1 additions
The following are now mandatory additions/clarifications to the schema blueprint before implementation:
- `inventory_balances` rebuildable cache;
- explicit `payment_allocations`;
- explicit cash-account-to-ledger-account mapping;
- line-level original COGS on sales;
- line-level original receipt cost on purchases;
- reversal/return source links;
- transactional local document sequences;
- migration mapping/reconciliation tables for legacy import tooling;
- append-only audit log scope;
- base and transaction currency snapshots on posted financial records.

## 19. Gate result
**Schema Freeze Candidate 1 is conditionally accepted for technical-spike work.**

It is not yet implementation-frozen. Before full scaffold:
1. encrypted Drift/SQLite spike must pass;
2. hardware/printing compatibility baseline must be validated;
3. schema blueprint must be updated to include all additions above;
4. acceptance tests must map to concrete tables/services;
5. no production Supabase writes are permitted.
