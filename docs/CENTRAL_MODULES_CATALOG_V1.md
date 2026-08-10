# IBEX 2.0 — Central Modules Catalog V1

Status: **Architecture baseline**

## Purpose
IBEX 2.0 uses one canonical owner for every business concept, repeated behavior, repeated record, repeated query projection, and repeated technical capability. Multiple screens may display or invoke the same thing, but they must not independently redefine its rules.

## Core rule
**Single Behavior, Single Source.**

If the same business record, rule, operation, calculation, validation, formatter, or lifecycle behavior appears in more than one feature or presentation, it must have one canonical owner module.

A UI may request an action and display a projection. It may not become the source of business truth.

---

## Module classes

### 1. Canonical Domain Modules
Own business identity, invariants, canonical models, domain-specific commands and queries.

#### Party domain
- `CustomerModule`
- `SupplierModule`
- `UserModule`
- `RolePermissionModule`

#### Catalog domain
- `ProductModule`
- `CategoryModule`
- `UnitModule`
- `PricingModule`

#### Location / stock domain
- `WarehouseModule`
- `InventoryModule`
- `InventoryCountModule`

#### Commercial documents
- `SalesModule`
- `PurchaseModule`
- `SalesReturnModule`
- `PurchaseReturnModule`

#### Financial domain
- `AccountingModule`
- `CashTreasuryModule`
- `SettlementModule`
- `ExpenseModule`
- `CurrencyFxModule`

#### Control domain
- `DocumentLifecycleModule`
- `DocumentNumberingModule`
- `AuthorizationModule`
- `AuditModule`
- `ReversalCorrectionModule`

---

### 2. Reusable Behavior Modules
These own behavior that appears across multiple domains or screens.

#### `MoneyModule`
Owns:
- scaled-integer arithmetic;
- currency-aware rounding;
- comparison;
- allocation;
- base-currency conversion;
- Latin-digit formatting contract for rendered amounts.

No screen may implement its own financial rounding or money arithmetic.

#### `QuantityModule`
Owns:
- quantity scale;
- unit conversions;
- precision validation;
- comparison and stock sufficiency helpers.

#### `FxModule`
Owns:
- exchange-rate representation;
- conversion;
- frozen rate snapshots;
- realized FX gain/loss calculation rules.

#### `PostingModule`
Owns:
- conversion of approved business events into balanced journal-entry proposals;
- posting validation;
- posting references and idempotency guards.

#### `StockAvailabilityModule`
Owns:
- available quantity calculation;
- outbound sufficiency validation;
- warehouse-specific availability;
- reservation policy if introduced later.

#### `PaymentAllocationModule`
Owns:
- allocation of receipts/payments to receivables/payables;
- prevention of invalid over-allocation;
- partial settlement rules;
- cross-currency settlement handoff to FX rules.

#### `DocumentLifecycleModule`
Owns:
- draft / approved / posted / reversed / cancelled states where applicable;
- allowed transitions;
- immutable-after-post rules;
- correction route selection.

#### `NumberingModule`
Owns transactional local document numbering, collision prevention, prefix policy, and future multi-device reconciliation strategy.

#### `PermissionModule`
Owns command authorization. UI visibility may use permission queries, but hidden buttons are never a security boundary.

#### `AuditModule`
Owns append-only audit evidence for sensitive commands and state transitions.

#### `ReversalModule`
Owns correction by linked compensating records instead of destructive edits.

---

### 3. Canonical Value Objects
These concepts must have one implementation and cannot be recreated as ad-hoc primitives throughout features.

- `Money`
- `CurrencyCode`
- `ExchangeRate`
- `Quantity`
- `UnitCode`
- `DocumentNumber`
- `DocumentStatus`
- `PostingStatus`
- `BusinessDate`
- `UtcTimestamp`
- `EntityId`
- `OperationId`
- `DeviceId`

Rules:
- persisted values must follow schema numeric policies;
- parsing/formatting happens through shared utilities;
- domain validation is centralized;
- UI strings are not canonical domain values.

---

## Canonical record ownership

| Record / Concept | Canonical owner | Typical consumers |
|---|---|---|
| Customer | CustomerModule | POS, Customers, Collections, Reports, Dashboard |
| Supplier | SupplierModule | Purchases, Payments, Reports |
| Product | ProductModule | POS, Purchases, Inventory, Reports |
| Unit | UnitModule | Product setup, POS, Purchases, Inventory |
| Warehouse | WarehouseModule | Inventory, Sales, Purchases, Transfers |
| Sale | SalesModule | POS, Sales list, Customer history, Reports |
| Purchase | PurchaseModule | Purchases, Supplier history, Reports |
| Payment | SettlementModule | Sales, Purchases, Cash, Customer/Supplier statements |
| Cash account | CashTreasuryModule | POS, Expenses, Settlements, Reports |
| Journal entry | AccountingModule | All posted financial operations, accounting reports |
| Stock movement | InventoryModule | Sales, Purchases, Returns, Transfers, Counts |
| Exchange rate | CurrencyFxModule | Sales, Purchases, Payments, Reports |
| Audit event | AuditModule | Admin, compliance, troubleshooting |

---

## Presentation reuse
Presentation components may be shared only when they represent the same interaction contract.

Candidate shared presentation components:
- Customer selector
- Supplier selector
- Product selector
- Warehouse selector
- Currency selector
- Money field
- Quantity field
- Date/time field
- Document status badge
- Document summary header
- Empty state
- Loading / failure state
- Confirmation sheet
- Search/filter shell

A shared component must not contain domain rules that belong to a domain/behavior module.

Example:
- Product selector may display stock and price.
- It may not decide whether a sale can post with insufficient stock.
- That decision belongs to `StockAvailabilityModule` / Operating Engine.

---

## Query / Projection rule
The canonical record is not the same thing as every view model.

One canonical model may have multiple read projections:
- `CustomerSummaryProjection`
- `CustomerStatementProjection`
- `CustomerPosProjection`
- `SaleListProjection`
- `SaleDetailProjection`
- `DashboardSalesProjection`

Read projections may optimize presentation, but they must be derived from canonical stored truth and shared query services.

No dashboard or report may maintain a competing financial truth.

---

## Technical capability modules
These are infrastructure-level reusable services and remain separate from domain rules:
- `DatabaseTransactionRunner`
- `ClockService`
- `UuidService`
- `EncryptionService`
- `SecureKeyService`
- `BackupService`
- `RestoreService`
- `PrintService`
- `BarcodeService`
- `FileStorageService`
- `ExportService`
- `LoggerService`

They provide capabilities; they do not decide business validity.

---

## Interaction with IBEX Operating Engine

```text
UI / Import / Sync / Automation / Future AI
                    |
                    v
             Command / Query
                    |
                    v
          IBEX Operating Engine
                    |
       +------------+-------------+
       |            |             |
       v            v             v
  Domain Module  Behavior Module  Policy Module
       |            |             |
       +------------+-------------+
                    |
                    v
            Repository Ports
                    |
                    v
             Local Database
```

The Operating Engine coordinates. Canonical modules own rules. Repositories persist. UI renders.

---

## Dependency rules
1. Presentation can depend on application/query contracts and presentation components.
2. Presentation cannot write repositories directly for business operations.
3. Domain modules cannot depend on Flutter widgets.
4. Domain modules cannot depend on Supabase.
5. Domain rules cannot be duplicated in reports, dashboards, import code, sync code, or AI code.
6. Infrastructure implements ports defined by upper layers.
7. Cross-domain behavior goes through explicit orchestration rather than hidden circular dependencies.

---

## Duplication detection rule
During review, any of the following appearing twice triggers an architecture review:
- the same financial formula;
- the same validation rule;
- the same status-transition rule;
- the same stock-availability rule;
- the same permission decision;
- the same document-number generation rule;
- the same money/FX rounding logic;
- the same payment-allocation logic;
- two representations claiming to be canonical for the same business record.

The default remediation is to extract ownership to the correct central module, not create a generic `utils` dumping ground.

---

## V1 implementation mapping target
When Flutter implementation begins, preferred conceptual layout:

```text
lib/
  core/
    value_objects/
    infrastructure/
    presentation/
  operating_engine/
  domains/
    customers/
    suppliers/
    products/
    inventory/
    sales/
    purchases/
    accounting/
    settlements/
    cash/
    currency_fx/
    documents/
    authorization/
    audit/
  features/
    dashboard/
    pos/
    sales/
    purchases/
    inventory/
    customers/
    suppliers/
    accounting/
    reports/
    settings/
```

Exact folder names remain implementation details; ownership boundaries are architectural requirements.

---

## Exit criteria before full scaffold
- every V1 canonical record has one owner module;
- every repeated state-changing behavior has one owner module;
- shared value objects are enumerated;
- every Operating Engine command maps to owner modules;
- no command requires UI-owned business logic;
- query projections are distinguished from canonical models;
- ownership is traceable to schema tables and acceptance tests.
