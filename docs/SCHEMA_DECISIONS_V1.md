# IBEX 2.0 — Critical Schema Decisions V1

Status: **Accepted for V1 schema design**

These decisions are executable constraints for the new local-first Android application. They do not modify the legacy production Supabase project.

## 1. Money representation
- Never use floating-point types for persisted monetary values.
- Persist monetary amounts as signed 64-bit integers using a fixed internal scale of **4 decimal places** (`amount_scaled = amount × 10,000`).
- UI display precision is currency-specific:
  - YER: 0 decimals by default.
  - SAR: 2 decimals.
  - USD: 2 decimals.
- Internal scale is intentionally higher than display precision to support allocations, discounts, weighted-cost calculations, and FX conversion without repeated precision loss.
- Before a posted document is finalized, all displayed/payable totals are rounded to the currency display precision and then converted to the internal 4-decimal representation.

## 2. Rounding policy
- Monetary rounding mode: **half away from zero**.
- Rounding is explicit at posting boundaries, invoice line totals where required, settlement allocation boundaries, and report presentation.
- Intermediate calculations should retain the 4-decimal internal scale whenever possible.
- No UI component may independently invent a rounding rule; rounding belongs to shared domain utilities and posting services.

## 3. Exchange-rate representation
- Store exchange rates as signed 64-bit scaled integers with **8 decimal places**.
- Every posted cross-currency transaction stores the exact exchange rate used at posting time.
- Historical documents are never recalculated using a newer exchange rate.
- Every financial document records transaction currency and base-currency equivalent.

## 4. FX gain/loss policy
- Realized FX gain/loss is recognized when a receivable/payable is settled using a different effective exchange rate from the original posted transaction.
- The realized difference posts automatically to dedicated FX gain/loss accounts.
- Unrealized revaluation of open balances is **out of scope for V1**.
- Cross-currency payment is not allowed until the posting service can generate a balanced base-currency journal entry and preserve the original-currency allocation trail.

## 5. Inventory valuation
- V1 valuation method: **Moving Weighted Average Cost (WAC)** per product and warehouse.
- Purchase receipt: recalculates WAC from existing on-hand quantity/value plus incoming quantity/value.
- Sale: COGS uses the current WAC at the moment of posting.
- Sales return: restores inventory at the original sale COGS when the source sale line is known.
- Purchase return: removes inventory at the original purchase receipt cost when the source purchase line is known.
- Warehouse transfer: carries the source warehouse unit cost; transfer itself does not create profit/loss.
- Positive inventory adjustment requires an explicit valuation cost; negative adjustment uses current WAC unless tied to a traceable source movement.

## 6. Negative stock
- Negative stock is **disabled by default and in V1 core behavior**.
- A posted outbound movement must fail atomically if available stock is insufficient.
- Draft documents may temporarily contain requested quantities above availability, but cannot post.
- Manager override is deferred until a later release and must be a separately audited feature if introduced.

## 7. Posted-document immutability
- Posted sales, purchases, receipts, payments, stock movements, and journal entries are immutable.
- Correction is performed through reversal, return, cancellation workflow, or adjustment document as appropriate.
- Hard deletion of posted financial or stock records is forbidden.

## 8. Database encryption
- The production mobile database must be encrypted at rest.
- Architecture target: Drift over SQLite with an encrypted SQLite build supported by the current `sqlite3` integration.
- The database encryption key must not be hard-coded, committed to GitHub, logged, or stored in plain preferences.
- Android key protection must use the platform keystore as the root of trust for wrapping/protecting local key material.
- Exact package-level implementation is gated behind an encryption spike and device test before application scaffold is considered production-ready.

## 9. Tax
- V1 core domain must be tax-ready, but tax calculation is **disabled by default** until business/legal requirements are explicitly approved.
- Schema may reserve tax metadata fields where they avoid destructive future migrations, but no tax liability is generated in V1 without a documented rule set.

## 10. Numeric display rule
- All rendered digits must be Latin `0-9`.
- Arabic, Eastern-Arabic, Persian, or Hindi digit glyph substitution is prohibited across UI, reports, PDFs, printed receipts, QR-adjacent text, and exports.

## 11. Safety invariant
No feature may bypass these rules by writing directly to persistence. Financial and stock changes must go through domain/application services that validate invariants and perform atomic database transactions.
