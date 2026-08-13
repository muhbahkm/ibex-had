# IBEX 2.0 — Domain Error Catalog V1

Status: **Architecture baseline**

## Principle
Domain errors are stable machine-readable outcomes owned by domain/application logic. UI translates them into concise Arabic messages. Database exceptions, raw SQLite text, or stack traces must not become user-facing business errors.

## Error shape
Recommended conceptual contract:
- `code`
- `category`
- `message_key`
- `field` optional
- `entity_id` optional
- `details` structured and non-sensitive
- `retryable`
- `operation_id` where relevant

## Core categories
- `validation`
- `authorization`
- `lifecycle`
- `inventory`
- `accounting`
- `settlement`
- `currency_fx`
- `cash`
- `conflict`
- `integrity`
- `backup_restore`
- `migration`
- `infrastructure`

## V1 stable codes

### Validation
- `VAL_REQUIRED_FIELD`
- `VAL_INVALID_MONEY`
- `VAL_INVALID_QUANTITY`
- `VAL_INVALID_DATE`
- `VAL_INVALID_UNIT_CONVERSION`
- `VAL_INVALID_DOCUMENT_TOTAL`
- `VAL_INVALID_CURRENCY`

### Authorization
- `AUTH_NOT_SIGNED_IN`
- `AUTH_COMMAND_FORBIDDEN`
- `AUTH_ROLE_DISABLED`
- `AUTH_USER_DISABLED`

### Lifecycle
- `DOC_NOT_DRAFT`
- `DOC_ALREADY_POSTED`
- `DOC_ALREADY_REVERSED`
- `DOC_CANCELLED`
- `DOC_INVALID_TRANSITION`
- `DOC_POSTED_IMMUTABLE`
- `DOC_RETURN_EXCEEDS_ELIGIBLE`

### Inventory
- `INV_INSUFFICIENT_STOCK`
- `INV_WAREHOUSE_INACTIVE`
- `INV_PRODUCT_NOT_STOCKED`
- `INV_COUNT_NOT_APPROVED`
- `INV_MISSING_VALUATION_COST`
- `INV_PROJECTION_OUT_OF_SYNC`

### Accounting
- `ACC_ENTRY_UNBALANCED`
- `ACC_ACCOUNT_MISSING`
- `ACC_ACCOUNT_INACTIVE`
- `ACC_PERIOD_CLOSED` reserved for future period controls
- `ACC_POSTING_MAPPING_MISSING`
- `ACC_DUPLICATE_POSTING`

### Settlement
- `SETTLEMENT_OVER_ALLOCATION`
- `SETTLEMENT_INVALID_OPEN_ITEM`
- `SETTLEMENT_PAYMENT_ALREADY_REVERSED`
- `SETTLEMENT_UNALLOCATED_AMOUNT_INVALID`

### Currency / FX
- `FX_RATE_MISSING`
- `FX_RATE_INVALID`
- `FX_CROSS_CURRENCY_NOT_ALLOWED`
- `FX_RECONCILIATION_FAILED`

### Cash
- `CASH_ACCOUNT_INACTIVE`
- `CASH_SHIFT_ALREADY_OPEN`
- `CASH_SHIFT_NOT_OPEN`
- `CASH_SHIFT_ALREADY_CLOSED`
- `CASH_TRANSFER_SAME_ACCOUNT`

### Conflict / idempotency
- `CONFLICT_STALE_VERSION`
- `CONFLICT_OPERATION_ALREADY_APPLIED`
- `CONFLICT_DOCUMENT_NUMBER`

### Integrity
- `INTEGRITY_FOREIGN_KEY`
- `INTEGRITY_CANONICAL_PROJECTION_MISMATCH`
- `INTEGRITY_DATABASE_CORRUPT`
- `INTEGRITY_UNEXPECTED_STATE`

### Backup / restore
- `BACKUP_CREATE_FAILED`
- `BACKUP_INVALID_FORMAT`
- `BACKUP_INTEGRITY_FAILED`
- `BACKUP_DECRYPT_FAILED`
- `RESTORE_SCHEMA_UNSUPPORTED`
- `RESTORE_VALIDATION_FAILED`

### Migration
- `MIGRATION_SOURCE_UNSUPPORTED`
- `MIGRATION_MAPPING_MISSING`
- `MIGRATION_RECONCILIATION_FAILED`
- `MIGRATION_DUPLICATE_SOURCE_RECORD`

## UX rules
- User-facing Arabic text is mapped from stable codes.
- Errors must say what happened and, where safe, what the user can do next.
- Financial failures must never imply success if the transaction rolled back.
- When an operation fails atomically, UI returns to a consistent state and may preserve the draft input for correction.
- Numeric values in messages use Latin digits only.

## Logging rules
Operational logs may include code, operation id, entity ids and safe structured context. Never log PINs, encryption keys, backup passwords, secret tokens, or unnecessary sensitive customer data.

## Testing gate
Each state-changing command must enumerate expected domain-error codes. Tests assert both that the command fails with the correct code and that no partial accounting/stock/cash writes survive the failure.
