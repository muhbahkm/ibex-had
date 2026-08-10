# IBEX 2.0 — Technical Spike Plan V1

Status: **Ready to execute after documentation sync**

## Objective
Validate the risky platform choices before scaffolding the production Android application.

The spike is disposable evidence code. It must not touch production Supabase and must not be treated as production architecture until its gates pass.

## Spike scope
1. Flutter Android shell.
2. Drift + SQLite local persistence.
3. Encrypted SQLite implementation candidate.
4. Android Keystore-backed key protection strategy.
5. Schema migration under encryption.
6. Backup + restore of encrypted DB.
7. Noto Sans Arabic / Noto Sans typography.
8. Arabic RTL layout.
9. Latin digits only across representative widgets.
10. Approved calm/premium visual direction.
11. Representative functional motion.
12. Barcode scanning baseline.
13. Thermal printer baseline.
14. Core Money/Quantity/FX value-object tests.
15. Minimal Operating Engine command path demonstration.

## Isolation rules
- branch: `spike/android-foundation-v1` after current governance work is reviewed;
- no production Supabase writes;
- no migration of production data;
- no secrets committed;
- spike DB uses synthetic fixtures only;
- no merge to `main` merely because UI runs.

## Minimal vertical slice
Implement one synthetic `PostSale` demonstration against local fixtures only:
- one product;
- one warehouse;
- one customer;
- one cash account;
- one currency;
- one sale line;
- one payment.

The command must prove:
- authorization hook;
- Money arithmetic;
- stock sufficiency check;
- one transaction boundary;
- sale row;
- stock movement;
- journal entry balancing;
- payment allocation;
- operation id;
- audit record;
- rollback on injected failure.

This is not a full POS implementation.

## Encryption gate
Must prove:
- encrypted DB file is unreadable as plaintext SQLite;
- key is not hardcoded;
- key survives valid app restart path;
- wrong key fails safely;
- app reinstall/key-loss behavior is understood and documented;
- migration succeeds on encrypted DB;
- backup/restore succeeds to a controlled destination;
- logs expose no secret key material.

## UI gate
Representative home/detail/form screens must prove:
- Arabic RTL correctness;
- Latin digits `0-9` only;
- Noto typography suitability;
- approved low-clutter/premium surface language;
- responsive mobile navigation;
- no important action hidden behind excessive motion;
- reduced-motion behavior where supported.

## Hardware gate
### Barcode
Validate at least camera scanning and a clean abstraction for future hardware scanner input.

### Thermal printing
Validate representative 58mm/80mm output strategy, Arabic shaping, Latin digits, receipt alignment, and failure handling. Exact printer fleet support remains a deployment concern.

## Performance gate
With synthetic data:
- cold DB open time measured;
- representative customer/product search measured;
- transaction posting measured;
- list scrolling checked for jank;
- encryption overhead recorded.

No hard production SLA is frozen by this spike; evidence informs later targets.

## Test evidence required
- unit tests for Money rounding and FX conversion;
- DB test for foreign keys + transaction rollback;
- domain test for balanced journal entry;
- inventory test for insufficient stock rejection;
- idempotency test for duplicate operation id;
- backup/restore verification test or repeatable manual procedure;
- screenshots/video notes for UI direction;
- printer/barcode evidence notes.

## Exit criteria
Spike passes only when:
1. encrypted Drift/SQLite path is technically viable;
2. key-management failure modes are documented;
3. migration and restore work;
4. one local Operating Engine command proves atomic multi-domain posting;
5. core domain invariants pass tests;
6. UI direction is validated on Android;
7. barcode and printing strategies are viable enough for V1 planning;
8. findings are documented in GitHub + Notion;
9. failures and compromises are explicitly recorded.

## After the spike
If passed:
- accept/adjust ADR-002 and ADR-003;
- freeze exact local DB/encryption implementation;
- close remaining physical schema choices;
- produce V1 Domain/Schema Freeze;
- scaffold the production application in a clean branch.

If failed:
- do not scaffold production;
- record the failed assumption;
- evaluate the next candidate implementation with a new spike.
