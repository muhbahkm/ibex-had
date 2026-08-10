# IBEX 2.0 — Android Foundation Spike Scope

Status: **Executable validation branch — synthetic data only**

This branch is not the production application scaffold. Its purpose is to prove or reject implementation choices before final V1 Domain/Schema Freeze.

## Hard boundaries
- Production Supabase remains **READ ONLY** and is not used by the spike runtime.
- No production customer/business data is copied into the spike.
- GitHub is the code/schema/test source of truth.
- Every result/failure that changes a decision must be documented in GitHub and Notion.

## Required validation slices
1. Flutter Android boot and architecture boundaries.
2. Drift + SQLite schema generation and migration.
3. Encrypted SQLite candidate and Android Keystore key handling.
4. Backup -> destroy local DB -> restore -> reconciliation round trip.
5. `Money`, `Quantity`, and `ExchangeRate` scaled-integer value objects.
6. `PostSale` vertical slice through Operating Engine.
7. Return document quantity ceiling and compensating effects.
8. Stock transfer paired `TRANSFER_OUT` / `TRANSFER_IN` in one transaction.
9. Transactional visible document sequence including rollback test.
10. Operation-id idempotency test.
11. Journal balance invariant test.
12. Negative-stock rejection test.
13. Noto Sans Arabic + RTL + Latin digits validation.
14. Approved calm/premium/minimal visual direction and functional motion.
15. Barcode baseline.
16. 58mm/80mm thermal print baseline.
17. Representative Android performance measurements.

## Movement persistence rules under test
### Return
Dedicated immutable return header/items linked to original header/lines. No source mutation.

### Stock transfer
One business transfer document creates exactly two posted stock movement headers inside the same DB transaction, preserving total carrying value.

### Quantity
Canonical scale 1e6. Unit metadata controls allowed/display decimals.

### Tax
Tax behavior disabled. Tax amounts must remain zero while `tax_enabled=false`.

### Document numbering
Application-owned `document_sequences`; default annual visible format such as `SAL-2026-000001`; UUID remains canonical identity. Sequence increment must roll back when the containing business transaction rolls back.

## Exit rule
The spike passes only when critical tests are reproducible and evidence is recorded. Passing the spike allows the project to issue final V1 Domain/Schema Freeze; it does not automatically authorize production data migration or Supabase writes.