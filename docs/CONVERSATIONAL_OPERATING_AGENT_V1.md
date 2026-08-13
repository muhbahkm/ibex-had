# IBEX 2.0 — Conversational Operating Agent V1

Status: Accepted product/architecture direction
Date: 2026-08-11
Decision: ADR-017

## Product Principle
IBEX 2.0 is **Chat-first, not Chat-only**. The primary user experience is a conversational operating interface similar in interaction style to modern AI chat products, while deterministic business views remain available for browsing, verification, reporting, and specialist workflows.

The user should normally describe the intended business action in natural Arabic rather than navigate through a deep ERP menu tree.

Example:

> أنشئ فاتورة مبيعات لصنف السدر عبوة كيلو، الكمية 1، السعر 500 ريال سعودي، على حساب محمد عبدالله باحكم.

IBEX must interpret the request, resolve the referenced entities, create a **draft**, render a structured preview card, and require an explicit approval step before posting any financial/inventory truth.

## Non-Negotiable Authority Boundary
The AI agent is **not** an accounting engine, inventory engine, database writer, or permission authority.

It may:
- understand conversational intent;
- preserve conversational context;
- search/read permitted business data;
- resolve customers, products, units, warehouses, currencies, accounts, and documents;
- ask targeted clarification when resolution is ambiguous or invalid;
- prepare explicit application commands;
- create or update reversible drafts through approved application contracts;
- present previews, warnings, alternatives, and explanations;
- submit an approved command to the IBEX Operating Engine.

It may not:
- write accounting, stock, settlement, payment, posted-document, numbering, or audit truth directly;
- bypass permissions or lifecycle rules;
- invent a customer/product/unit/currency when resolution is ambiguous;
- invent prices, FX rates, balances, historical base currency, tax rules, or accounting policy;
- execute an unregistered state-changing capability outside the Command Catalog;
- edit immutable posted truth.

## Canonical Flow

User / UI
→ Conversation Orchestrator
→ Intent Interpreter
→ Entity Resolver
→ Action Planner
→ Draft Command
→ Operating Engine validation
→ Draft/Preview projection
→ Explicit user approval
→ Post/Commit Command
→ Operating Engine
→ Canonical domain owners
→ One local database transaction
→ accounting + inventory + settlement + audit truth
→ result card / conversational response

## Agent Components

### 1. Conversation Orchestrator
Owns conversation state, references such as "محمد" or "الفاتورة السابقة", pending questions, and the currently presented draft. It does not own domain truth.

### 2. Intent Interpreter
Maps natural-language requests to a bounded intent such as:
- create sale draft;
- create purchase draft;
- receive customer payment draft;
- pay supplier draft;
- record expense draft;
- transfer stock draft;
- reverse document request;
- query balance;
- query inventory;
- query report.

### 3. Entity Resolver
Resolves user language to canonical IDs. Resolution must return one of:
- exact match;
- ranked candidates requiring user choice;
- no match;
- invalid relationship (for example a unit not permitted for the product).

The resolver may never silently choose among materially ambiguous entities.

### 4. Action Planner
Builds only commands registered in the Command Catalog. It is not allowed to generate SQL or arbitrary mutation instructions.

### 5. Confirmation Layer
Every material financial/inventory state change is previewed as a structured draft card before posting unless an explicit future policy marks the command as safe for direct execution. V1 defaults to confirmation-required.

### 6. IBEX Operating Engine
Remains the only authority for permission checks, invariants, money/quantity/FX rules, stock availability, accounting proposals, numbering, lifecycle transitions, atomic commit, idempotency, and audit evidence.

## Draft Lifecycle
A conversational request that would change operational truth follows:

`interpreted → resolving → draft_ready → awaiting_approval → approved → posting → posted`

Alternative terminal/side states:

`needs_clarification`, `rejected`, `cancelled`, `expired`, `posting_failed`.

A draft is reversible and is not accounting or inventory truth. A posted document remains immutable under ADR-007.

## Approval Contract
Approval must bind to a specific immutable draft version or draft hash. If any material field changes after preview — customer, product, unit, quantity, price, currency, warehouse, payment mode, account, FX rate, or totals — prior approval is invalidated and a new preview is required.

Conversational phrases such as "اعتمدها" may trigger approval, but the application must resolve them against exactly one currently pending draft and then call a typed approval/post command. The language model itself does not directly commit the document.

## Structured Conversational Cards
Chat responses may contain typed cards such as:
- Sale Draft Card
- Purchase Draft Card
- Payment Draft Card
- Expense Draft Card
- Stock Transfer Draft Card
- Customer Balance Card
- Inventory Availability Card
- Report Result Card
- Ambiguity/Selection Card
- Validation Error Card

Cards are projections of application/domain state. Buttons and conversational replies must call the same command contracts.

## Context Safety
Conversational references may be used only when the context is sufficiently unique. Example:

1. User: "كم على محمد عبدالله باحكم؟"
2. IBEX resolves customer ID and displays the balance.
3. User: "سجل منه 500 سعودي."

The agent may reuse the resolved customer because the referent is explicit in the active context, but must still preview the payment draft and show customer, currency, amount, target account, and date before posting.

## Offline / Local-First Rule
The conversational UI must not make core ERP operation dependent on a cloud model. The architecture must support:
- deterministic/manual operation without AI;
- local database as runtime source of truth;
- optional model providers behind an adapter;
- graceful fallback to forms/search when AI is unavailable;
- no cloud model receiving secrets or unrestricted database access.

Exact on-device/cloud model strategy remains a separate implementation decision.

## UI Direction
Primary shell:
- conversation surface as the central workspace;
- persistent composer at the bottom;
- typed operational cards inside the conversation;
- lightweight sidebar/navigation for new conversation, sales, purchases, customers, suppliers, inventory, cash, reports, and settings;
- traditional searchable data views remain available, but they do not become alternate owners of domain behavior.

Design constraints remain Arabic RTL, Latin digits 0-9, calm/premium/minimal visual language, large touch targets, and restrained functional motion.

## Security and Audit
For every AI-assisted mutation, audit evidence should preserve at minimum:
- operation ID;
- user ID;
- command name;
- draft ID/version;
- resolved entity IDs;
- approval event;
- final result entity ID;
- timestamps;
- whether the command originated from conversation, direct UI action, import, sync, or automation.

Raw private conversation text does not automatically become permanent audit data; retention policy is a separate privacy decision.

## Testing Requirements
Before production acceptance, tests must prove:
- ambiguous entity resolution cannot auto-post;
- invalid product/unit relationships block draft readiness;
- material draft changes invalidate approval;
- replayed approval/post remains idempotent;
- expired/cancelled drafts cannot post;
- agent cannot invoke unregistered commands;
- Operating Engine rejects invalid commands regardless of agent output;
- chat button and typed conversational approval produce identical canonical effects;
- model/provider unavailability does not corrupt or block existing local truth.

## Consequence
The presentation architecture and Command Catalog must now treat the **Conversational Operating Agent** as the primary interaction channel. This changes UI planning, but does **not** weaken any existing Operating Engine, schema, accounting, inventory, permission, lifecycle, encryption, or phase-gate invariant.