# IBEX 2.0 — Central Operating Engine V1

Status: **Accepted architectural direction — design before implementation**

## Purpose
IBEX 2.0 will use one central operational logic layer as the authoritative coordinator of business behavior. UI screens, repositories, and persistence adapters must not independently invent business rules.

Working name: **IBEX Operating Engine**.

The engine is the central place where business commands are validated, coordinated, posted, reversed, audited, and translated into accounting and inventory effects.

## Why this exists
A financial/inventory system becomes unsafe when sales, purchases, payments, stock, reports, and user actions each implement overlapping rules independently. The engine prevents rule duplication and makes behavior deterministic, testable, auditable, and reusable across Android, future desktop, sync, import, automation, and AI-assisted workflows.

## Core boundary
The engine sits between presentation/application entry points and persistence/infrastructure:

```text
UI / POS / Import / Sync / Automation
              |
              v
      IBEX Operating Engine
              |
      +-------+--------+--------+--------+
      |                |        |        |
 Accounting        Inventory  Parties  Cash
      |                |        |        |
      +-------+--------+--------+--------+
              |
       Repositories / UoW
              |
         Drift / SQLite
```

## Non-negotiable rule
No screen or feature may directly mutate financial, inventory, settlement, or posted-document truth in the database.

All such changes must go through an engine command/use-case that:
1. authorizes the action;
2. validates prerequisites and invariants;
3. calculates deterministic monetary and quantity effects;
4. opens one local database transaction;
5. writes the business document and its effects;
6. produces audit evidence;
7. commits atomically or rolls back completely.

## Engine domains

### 1. Sales Engine
Owns:
- draft validation;
- sale posting;
- cash/credit/partial payment composition;
- pricing/discount validation;
- customer exposure checks;
- stock availability check;
- sales return eligibility;
- sale reversal/cancellation workflow;
- references to original COGS.

It delegates accounting entries to Accounting Engine and stock effects to Inventory Engine within the same unit of work.

### 2. Purchase Engine
Owns:
- purchase posting;
- supplier payable/cash composition;
- receipt cost capture;
- purchase return eligibility;
- cost/value transfer to inventory;
- document state transitions.

### 3. Accounting Engine
Owns:
- chart-of-account mapping;
- journal generation;
- debit/credit balance invariant;
- base-currency translation;
- rounding policy;
- FX gain/loss realization;
- immutable posted entries;
- reversing/adjusting entries;
- period/open-close validation.

No other module may hand-write journal lines outside approved accounting interfaces.

### 4. Inventory Engine
Owns:
- all stock movements;
- moving weighted-average valuation;
- stock availability;
- transfers;
- inventory counts;
- adjustments;
- source-cost traceability;
- rebuildable inventory balance projections.

No feature may update `on_hand` or inventory value as an independent source of truth.

### 5. Settlement Engine
Owns:
- customer receipts;
- supplier payments;
- payment allocations;
- unapplied amounts/advances when explicitly supported;
- cross-currency allocation;
- realized FX difference;
- over-allocation prevention.

### 6. Cash & Treasury Engine
Owns:
- cash accounts;
- receipts/disbursements;
- shifts/open-close workflows;
- cash transfer;
- expected vs actual closing amount;
- cash-account to ledger-account mapping.

### 7. Party Balance Engine
Owns consistent customer/supplier balance derivation from posted documents, allocations, and journals. Cached balances are projections only and must be rebuildable.

### 8. Document Lifecycle Engine
Standard states:
- `draft`
- `ready`
- `posted`
- `partially_reversed` where applicable
- `reversed`
- `void` only for explicitly permitted non-posted or controlled cases

The lifecycle service owns allowed transitions. Posted truth is immutable.

### 9. Numbering Engine
Owns transaction-safe local document numbers. Number allocation must occur inside the same database transaction as final posting where required, and must never depend on reading `MAX(number) + 1` without concurrency control.

### 10. Authorization Policy Engine
Evaluates user role/permission and contextual rules before sensitive operations. UI visibility is not authorization.

### 11. Audit Engine
Records append-only operational events for sensitive actions, including actor, device/app instance, action, entity, entity id, timestamp, reason/context, and correlation id where appropriate.

### 12. Reversal & Correction Engine
Provides one consistent correction model across sales, purchases, cash, inventory, and accounting. It creates linked compensating records; it never hides or destroys posted history.

## Command model
External callers interact with explicit commands, for example:
- `PostSale`
- `ReturnSale`
- `PostPurchase`
- `ReturnPurchase`
- `ReceiveCustomerPayment`
- `PaySupplier`
- `TransferStock`
- `PostInventoryCount`
- `RecordExpense`
- `TransferCash`
- `ReverseDocument`
- `CloseCashShift`

Commands contain intent and validated input, not database implementation details.

## Result model
Every command returns a structured result containing as applicable:
- command/correlation id;
- primary document id and number;
- status;
- generated stock movement ids;
- journal entry id;
- payment/allocation ids;
- warnings that do not invalidate posting;
- deterministic domain error when rejected.

## Domain error contract
Use stable machine-readable codes plus Arabic human-readable messages. Examples:
- `STOCK_INSUFFICIENT`
- `DOCUMENT_ALREADY_POSTED`
- `DOCUMENT_ALREADY_REVERSED`
- `PAYMENT_OVER_ALLOCATION`
- `PERMISSION_DENIED`
- `ACCOUNT_MAPPING_MISSING`
- `JOURNAL_UNBALANCED`
- `CURRENCY_RATE_REQUIRED`
- `PERIOD_CLOSED`

UI does not infer financial meaning from raw database exceptions.

## Transaction boundary
For a sale, one atomic unit of work includes at minimum:
1. validate sale and permissions;
2. reserve/final-check stock;
3. allocate local document number;
4. persist posted sale header/lines;
5. persist payments and allocations;
6. create stock movement;
7. calculate and retain line COGS;
8. generate balanced journal;
9. update rebuildable projections/caches;
10. append audit event;
11. commit.

Any failure rolls all steps back.

## Determinism rules
- no current exchange rate may alter an already-posted document;
- no floating-point persisted financial truth;
- shared rounding utility only;
- same command input + same relevant state must produce the same financial result;
- time-dependent behavior receives an injected clock rather than reading system time throughout domain code;
- ID generation and numbering are injectable/testable services.

## Central relationship model
The engine explicitly coordinates these relationships:

```text
Business Document
   |-- Party (customer/supplier)
   |-- Currency + frozen FX rate
   |-- Lines
   |     |-- Product
   |     |-- Unit conversion
   |     |-- Price/Cost
   |     `-- Original cost trace
   |-- Payments
   |     `-- Allocations
   |-- Stock Movement
   |-- Journal Entry
   |-- Reversal/Return links
   `-- Audit Events
```

## Projections vs source of truth
The following may exist for speed but are not authoritative:
- inventory balance cache;
- customer/supplier balance cache;
- dashboard KPIs;
- daily aggregates;
- search indexes;
- sync state projections.

They must be rebuildable from authoritative posted records.

## Integration boundaries
### UI
Can query view/read models and submit commands. Cannot perform financial writes directly.

### Legacy import
Must submit validated import/migration services or controlled opening-balance commands; it cannot bypass invariants by bulk inserting posted operational truth.

### Future sync
Sync transports authoritative records/commands and conflict metadata; it does not duplicate business logic in the network layer.

### Future AI
AI may propose commands or explain data. It never receives a privileged direct-write path around the Operating Engine.

## Suggested Flutter package structure
```text
lib/
  core/
    operating_engine/
      engine.dart
      command_bus.dart
      unit_of_work.dart
      domain_clock.dart
      domain_errors.dart
      correlation.dart
  domain/
    accounting/
    inventory/
    sales/
    purchases/
    settlement/
    treasury/
    parties/
    documents/
    audit/
  application/
    commands/
    queries/
  infrastructure/
    database/
    repositories/
    security/
```

This is a logical boundary, not a requirement to create one giant file or god-class. The Operating Engine is a coordinated architecture composed of focused services.

## Anti-patterns prohibited
- one giant `api.dart` or `business_logic.dart` containing all logic;
- UI widgets calculating ledger entries;
- repositories deciding business policy;
- direct stock quantity mutation;
- direct posted journal edits;
- duplicated rounding/FX logic;
- background sync applying changes without domain validation;
- catch-all service with hundreds of unrelated methods.

## Testing requirement
Each command must have domain/integration tests covering:
- happy path;
- authorization failure;
- invariant failure;
- duplicate/retry behavior where relevant;
- transaction rollback at injected failure points;
- exact accounting effect;
- exact inventory effect;
- reversal/return behavior;
- audit generation.

## Idempotency and retries
Commands that can be retried by UI, import, or future sync should accept a unique operation/correlation id and prevent duplicate posting when the same operation is replayed.

## Exit criteria before implementation
Before coding this engine, we must complete:
1. command catalog V1;
2. command-to-table traceability;
3. command-to-accounting posting traceability;
4. command-to-stock movement traceability;
5. state transition matrix;
6. domain error catalog;
7. permission matrix;
8. atomicity/rollback test matrix.

Only then should the first engine interfaces be implemented.