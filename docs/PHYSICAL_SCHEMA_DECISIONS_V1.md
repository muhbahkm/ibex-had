# IBEX 2.0 — Physical Schema Decisions V1

Status: **Accepted for Freeze Candidate 2**

Purpose: close the remaining physical-schema decisions before migration v1 and the Android technical spike. These decisions do not alter the accepted Operating Engine architecture; they make its persistence contract explicit.

## Decision 1 — Sales and purchase returns use dedicated immutable return documents

### Chosen model
Use dedicated tables:
- `sales_returns`
- `sales_return_items`
- `purchase_returns`
- `purchase_return_items`

Each return header links to its source commercial document when known. Each return line links to the exact source line when known.

### Required links
Sales return:
- `source_sale_id`
- `sales_return_items.source_sale_item_id`

Purchase return:
- `source_purchase_id`
- `purchase_return_items.source_purchase_item_id`

### Rules
- A return never edits the original posted sale/purchase.
- A posted return is itself immutable.
- Returned quantity is validated against previously posted returns for the same source line.
- Return posting creates compensating inventory and accounting effects in one transaction.
- A return may be unlinked only for explicitly approved exceptional workflows; V1 default is source-linked.

### Why this model
It keeps audit semantics explicit, avoids polymorphic foreign-key ambiguity, keeps sale/purchase rules strongly typed, and remains compatible with the central Reversal/Correction module.

---

## Decision 2 — Warehouse transfer is one business document with two canonical stock movements

### Chosen model
Use:
- `stock_transfers`
- `stock_transfer_items`

A posted transfer generates exactly two stock-movement headers inside one database transaction:
1. `TRANSFER_OUT` for `source_warehouse_id`
2. `TRANSFER_IN` for `destination_warehouse_id`

Both movement headers reference the same `stock_transfer_id`.

### Cost rule
- Source quantity is relieved at the source warehouse carrying cost at posting time.
- Destination quantity is received with the exact transferred total carrying value.
- No profit or loss is created merely by moving inventory between warehouses.
- Transfer-specific freight/cost capitalization is outside V1 unless explicitly approved later.

### Rules
- Source and destination warehouses must differ.
- Source stock must be sufficient before posting.
- Both movement headers and all items commit or roll back together.
- Transfer reversal creates compensating movements; it never edits the original movements.

---

## Decision 3 — Tax-ready metadata is stored, tax behavior remains disabled

### Business configuration
Add to `businesses`:
- `tax_registration_no` nullable
- `tax_enabled` boolean default false

### Party metadata
Add to `customers` / `suppliers`:
- `tax_registration_no` nullable

### Posted commercial document snapshots
For sales, purchases, and their returns:
- `tax_mode` (`disabled`, `exclusive`, `inclusive`) default `disabled`
- `tax_total_scaled` default 0

For each commercial line:
- `tax_code_snapshot` nullable
- `tax_rate_scaled` nullable, rate scale = 1e8
- `tax_amount_scaled` default 0
- `price_includes_tax` boolean default false

### Rules
- While `businesses.tax_enabled = false`, posting requires tax amounts to be zero and tax mode to be `disabled`.
- No tax engine, legal invoice claim, filing logic, or jurisdiction-specific calculation is part of V1.
- Snapshot fields exist only to avoid destructive schema redesign when explicit tax rules are approved later.

---

## Decision 4 — Quantity storage uses one fixed internal scale; units control allowed/display precision

### Chosen representation
All canonical quantity integers use a fixed scale of **1,000,000 (1e6)**.

Examples:
- `1` unit => `1000000`
- `1.5` kg => `1500000`
- `0.125` kg => `125000`

### Unit metadata
`units` owns:
- `allowed_decimals` integer, range 0..6
- `display_decimals` integer, range 0..6 and `display_decimals <= allowed_decimals`

### Conversion factors
`product_units.conversion_factor_scaled` also uses scale 1e6.

### Rules
- Domain `Quantity` validates that entered precision does not exceed the selected unit's `allowed_decimals`.
- Arithmetic uses scaled integers only; no binary floating-point quantity math in canonical business logic.
- Base quantity is calculated centrally and persisted for posted stock-affecting lines.
- V1 default unit templates may use 0 decimals for pieces and 3 decimals for common weight/volume units, but the schema supports up to 6.

---

## Decision 5 — Visible document numbers use an application-owned transactional sequence, not SQLite row IDs

### Chosen model
Use `document_sequences` keyed by:
- `business_id`
- `document_type`
- `scope_key`

Fields:
- `prefix`
- `next_value`
- `padding`
- `updated_at`

Unique key:
- `(business_id, document_type, scope_key)`

### Default scope
V1 default is annual scope using Gregorian year as `scope_key`, e.g. `2026`. This is a presentation/business numbering scope only and is not described as a statutory fiscal sequence.

### Default prefixes
- Sale: `SAL`
- Purchase: `PUR`
- Sales return: `SRT`
- Purchase return: `PRT`
- Customer receipt: `RCT`
- Supplier payment: `PAY`
- Expense: `EXP`
- Stock transfer: `STX`
- Inventory count/adjustment: `CNT`
- Journal entry: `JRN`

Default format:
`{PREFIX}-{YYYY}-{SEQUENCE}`

Example:
`SAL-2026-000001`

### Rules
- Number allocation occurs inside the same application transaction that creates/posts the document.
- A rolled-back transaction does not commit the sequence increment.
- Visible document numbers are immutable after posting.
- UUID remains the canonical entity identifier; document number is a human/business identifier.
- `AUTOINCREMENT` / table row IDs are not used as the visible business document sequence.
- Future multi-device synchronization may replace local annual sequencing with device/site-aware allocation, without changing canonical UUID identity.

---

## Cross-cutting movement creation rules
Every stock/accounting-affecting command follows this order:
1. validate command contract and operation id;
2. authorize;
3. load canonical source records;
4. validate lifecycle and business invariants;
5. calculate Money / Quantity / FX effects through central modules;
6. build accounting and inventory proposals in memory;
7. enter one database transaction;
8. allocate visible document number if needed;
9. persist canonical document and lines;
10. persist stock movement(s);
11. persist journal entry/lines;
12. persist settlement/allocation effects if any;
13. persist operation log and audit evidence;
14. update rebuildable projections/caches;
15. commit once.

Any failure before commit rolls back the complete operation.

## Freeze impact
These decisions close the five physical-schema clarifications listed in `FULL_CROSS_REVIEW_V1.md`. Remaining gates are implementation validation (encryption, Drift migrations, Android UI/typography, printing/barcode, performance) and legacy reconciliation validation.