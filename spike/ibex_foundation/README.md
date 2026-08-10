# IBEX 2.0 — Foundation Spike Package

This package is disposable validation code for `spike/android-foundation-v1`. It is not the production app scaffold.

## Implemented in this first slice
- `Money` scaled integer contract (`1e4`).
- `Quantity` scaled integer contract (`1e6`).
- `ExchangeRate` scaled integer contract (`1e8`).
- half-away-from-zero integer rounding.
- Latin-digit-only numeric parsing at domain boundaries.
- canonical visible document-number formatter.
- Android secure-storage-backed database-key candidate.
- unit tests for core numeric/formatting invariants.

## Dependency baseline validated before commit
- Drift `2.34.3`.
- sqlite3 `3.5.0` using version 3 build hooks; legacy `sqlite3_flutter_libs` / `sqlcipher_flutter_libs` are intentionally not used.
- flutter_secure_storage `10.3.1` as the current Android secure key-storage candidate.
- path_provider `2.1.6`.
- uuid `4.6.0`.

## Hard rules
- No production Supabase writes.
- No production data.
- Do not promote this package to production until device tests pass.
- Database encryption wiring is not yet accepted; only the key-storage abstraction/candidate is present.

## Next executable slice
1. Generate/validate the Android host project on a current Flutter stable toolchain.
2. Add Drift database tables required by the minimal `PostSale` vertical slice.
3. Select and wire the sqlite3 v3 encryption provider in the spike only.
4. Add transaction/idempotency/document-sequence tests.
5. Run on representative Android hardware and record evidence.
