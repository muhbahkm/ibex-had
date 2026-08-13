# IBEX 2.0 — Inventory Movement Matrix V1

Status: **Design baseline**

## Movement types
- PURCHASE_RECEIPT
- PURCHASE_RETURN
- SALE_ISSUE
- SALE_RETURN
- TRANSFER_OUT
- TRANSFER_IN
- COUNT_ADJUSTMENT_IN
- COUNT_ADJUSTMENT_OUT
- OPENING_BALANCE
- REVERSAL

## Rules by event

### Purchase receipt
- Direction: IN
- Quantity: base-unit quantity received
- Valuation: actual capitalized incoming cost
- WAC effect: recalculate moving weighted average
- Reference: purchase + purchase line

### Purchase return
- Direction: OUT
- Valuation: original purchase receipt unit cost when source is known
- WAC effect: remove returned quantity/value; recalculate remaining WAC if needed
- Reference: purchase return + original purchase line

### Sale issue
- Direction: OUT
- Valuation: current WAC at posting time
- WAC effect: quantity/value decreases, unit WAC for remaining stock does not change merely because of sale
- Must fail if resulting available quantity would be negative
- Reference: sale + sale line

### Sales return
- Direction: IN
- Valuation: original sale COGS unit cost when source sale line is known
- WAC effect: returned value rejoins inventory and WAC is recalculated from existing value + returned value
- Reference: sales return + original sale line

### Warehouse transfer
Two linked movements inside one atomic operation:
1. TRANSFER_OUT at source warehouse using source WAC.
2. TRANSFER_IN at destination warehouse carrying the exact transferred inventory value.
No profit or loss is created by transfer.

### Inventory count shortage
- Direction: OUT
- Quantity: system quantity minus counted quantity
- Valuation: current WAC
- Requires count document, reason, and user identity

### Inventory count surplus
- Direction: IN
- Quantity: counted quantity minus system quantity
- Valuation: explicit approved valuation cost; if policy permits, current WAC may be proposed but must be visible before posting

### Opening balance
- Direction: IN
- Valuation: explicit opening unit cost
- Allowed only during controlled setup/migration workflow

### Reversal
- Exact opposite quantity and inventory value of source movement
- Links to original movement
- Does not mutate or delete original row

## Inventory balance cache
`inventory_balances` is a rebuildable cache, not the historical source of truth.
Source of truth is the sequence of posted stock movement items.

For each warehouse/product cache:
- quantity_scaled
- inventory_value_scaled
- wac_unit_cost_scaled

Any cache inconsistency must be recoverable by replaying posted movements.

## WAC formula
On incoming valued movement:

`new_value = old_value + incoming_value`

`new_quantity = old_quantity + incoming_quantity`

`new_wac = new_value / new_quantity`

The implementation must use scaled-integer safe arithmetic and the shared rounding policy; no binary floating point.

## Posting invariants
1. Outbound quantity cannot make available stock negative.
2. A stock-tracked product must have a warehouse on every posted stock-affecting document.
3. Base-unit conversion is fixed and stored on each posted line so later unit-definition changes cannot rewrite history.
4. Movement value and quantity must be signed consistently with movement direction.
5. Every stock movement must identify its source business document or approved manual adjustment.
6. Reversal is append-only and traceable.
7. Transfers must commit source OUT and destination IN atomically.
