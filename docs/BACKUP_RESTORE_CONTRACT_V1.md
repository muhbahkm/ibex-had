# IBEX 2.0 — Backup & Restore Contract V1

Status: **Design baseline**

## Goal
A backup must be a verifiable, encrypted, versioned representation of the local business database that can be restored safely on a clean compatible installation.

## Backup package contents
- encrypted database payload;
- manifest JSON;
- schema version;
- app version/build number;
- business id and business code;
- created_at UTC;
- device/app instance id;
- checksum/hash of encrypted payload;
- encryption-format version;
- optional human-readable backup label.

## Security rules
- Backup payload must be encrypted before leaving app-private storage.
- Backup password/key material must never be committed to GitHub or logged.
- The database-at-rest key and backup encryption key must not be treated as interchangeable by default.
- Restore must authenticate/decrypt and verify integrity before replacing any active database.

## Restore sequence
1. Select backup file.
2. Parse manifest without trusting user-supplied metadata beyond validation.
3. Verify supported backup format and schema compatibility.
4. Verify checksum/integrity.
5. Decrypt to temporary app-private location.
6. Open restored database in isolation.
7. Run `PRAGMA integrity_check` or equivalent integrity validation.
8. Validate required schema version and critical tables.
9. Run domain sanity checks:
   - posted journals balanced;
   - no invalid foreign keys;
   - inventory balance cache can be rebuilt;
   - core business row exists;
10. Create a safety backup of current database unless this is a clean install.
11. Atomically switch active database.
12. Re-open application services and run smoke validation.
13. Delete temporary plaintext/decrypted artifacts securely as supported by platform storage semantics.

## Failure behavior
Any failure before step 11 leaves the active database unchanged.
A failed restore must produce a clear error code and audit/log event without leaking encryption secrets or sensitive data.

## Compatibility policy
- Same schema version: direct restore after validation.
- Older supported schema: restore into temporary database, then run tested Drift migrations before activation.
- Newer unsupported schema: reject restore and instruct user to update application.
- Unknown/corrupt format: reject before touching active database.

## Acceptance criteria
A known test dataset restored on a clean device must reproduce:
- document counts/numbers;
- customer/supplier balances;
- inventory quantity/value;
- cash balances;
- journal/trial-balance totals;
- settings required for operation;
- schema version.

The restored system must pass the applicable scenarios in `ACCEPTANCE_TEST_MATRIX_V1.md`.
