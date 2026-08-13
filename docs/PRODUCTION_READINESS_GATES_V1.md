# IBEX 2.0 — Production Readiness Gates V1

Status: **Normative release gate**

IBEX must not be described as production-ready until every required gate below is evidenced and green. A green emulator or unit-test suite alone is not sufficient.

## P0 — Financial and inventory truth
- Double-entry journal balance is validated for every posted financial command.
- Posted documents are immutable; corrections use explicit return/reversal commands.
- Stock movements and accounting effects commit atomically with the business document.
- Negative stock is blocked at posting unless a future explicit policy changes this.
- Moving weighted average cost is deterministic and tested for purchases, sales, transfers and returns.
- Idempotency protects every write command from duplicate truth.
- Visible document numbering is transaction-scoped and rollback-safe.

## P0 — Local persistence and migrations
- App-private SQLite is encrypted at rest.
- Database key is generated from OS secure storage and never embedded in source, logs, backups or analytics.
- Correct-key reopen, wrong-key rejection and corrupted-backup refusal are tested.
- Every released schema migration is upgrade-tested from supported historical versions.
- Backup → destroy database → restore → reconciliation is green on Android.

## P0 — Authorization and agent safety
- Every state-changing command passes an application authorization boundary before the Operating Engine.
- Permissions are business-scoped and deny by default.
- The conversational Agent may call only registered typed commands.
- Read queries cannot mutate operational truth.
- Draft approval is fingerprint/version bound; material edits invalidate prior approval.
- The Agent never writes accounting, inventory, cash or ledger tables directly.

## P0 — Currency correctness
- No synthetic FX provider is present in release builds.
- FX rates are business-configured, date/effective-time scoped and snapshotted on posted documents.
- Base-currency transactions require exact rate 1.00000000.
- Every preview shows transaction currency, base currency and applied rate when they differ.

## P0 — Android release security
- Release application ID/versioning are fixed.
- Release signing uses externally protected secrets; no signing key is committed.
- Android backup policy excludes secure-storage/database key material and follows the documented database-backup policy.
- Debug/test flags, spike seed data and failure injectors are absent from release behavior.
- Min/target SDK and permissions are explicitly reviewed.

## P0 — Real-device qualification
- Representative low/mid-range physical Android devices pass install, first-run, process-death, reboot and upgrade tests.
- Secure-key persistence is verified across process death/reboot/app upgrade.
- Encrypted database reopen and backup/restore are verified on physical hardware.
- Offline operation is verified with network disabled.
- Long-running transaction and interruption scenarios do not produce partial truth.

## P1 — Product UX and accessibility
- Arabic RTL is consistent across supported screens.
- User-visible numerals use Latin 0-9 as the product convention.
- Destructive/financial actions present explicit preview and confirmation.
- Ambiguous customer/product/supplier matches require disambiguation instead of guessing.
- Empty, loading, error and recovery states are usable on representative screen sizes.

## P1 — Operational completeness for V1
Required release commands: PostSale, PostPurchase, ReceiveCustomerPayment, PaySupplier, TransferStock, PostSaleReturn, PostPurchaseReturn, RecordExpense, ReverseDocument where applicable, backup/restore and core read reports.

Required V1 read views: customer balances, supplier balances, inventory balances/movements, sales, purchases, cash/settlement summaries and journal/audit trace.

## P1 — Quality evidence
- `flutter analyze` has zero issues.
- All unit/integration/widget tests are green on the release candidate SHA.
- Android emulator runtime gate is green on the same release candidate SHA.
- Release APK/AAB build succeeds from a pinned dependency/toolchain workflow.
- No high/critical dependency or source security finding remains unresolved.
- Performance baseline is recorded for startup, common reads and representative posting operations.

## Release declaration rule
Only after all P0 gates and the agreed V1 P1 gates are evidenced on a single release-candidate commit may the project state say **Production Ready**. Until then use **Prototype**, **Spike**, **Alpha**, **Beta**, or **Release Candidate** as appropriate.
