# IBEX HAD Accounting MCP v0.1

Private MCP operational layer for **باحكم للعسل / IBEX HAD**.

## Why this exists

ChatGPT must operate through domain tools, not through a general-purpose database connector. PostgreSQL remains the source of truth; the MCP server only exposes bounded accounting use cases.

```text
ChatGPT
   |
IBEX HAD Accounting MCP
   |
Accounting contracts / validation / idempotency / audit
   |
PostgreSQL (currently Neon)
```

## Safety model

- Reporting reads use the canonical **v2** reporting views.
- Customer/supplier statements are official only when every matching closure row has `verification_status = VERIFIED` and `difference = 0`.
- Currencies are never aggregated implicitly.
- Monetary values are accepted as decimal strings to avoid JavaScript floating-point writes.
- Every write requires a `request_key` and an approved operator (`محمد` or `أنس`).
- `WRITE_TOOLS_ENABLED=false` by default.
- Write tools never write financial tables directly. They call PostgreSQL functions that must implement atomic transactions, idempotency, audit logging, and post-write verification.

## v0.1 tools

Read:
- `system_health`
- `find_counterparty`
- `get_customer_statement`
- `get_supplier_statement`
- `get_receivables`
- `get_payables`
- `get_reporting_contract`

Write contracts:
- `create_counterparty`
- `record_sale`
- `record_purchase`
- `record_expense`
- `record_receipt`
- `record_payment`

The write contracts expect these PostgreSQL functions:

- `public.ibex_had_mcp_create_counterparty(jsonb)`
- `public.ibex_had_mcp_record_sale(jsonb)`
- `public.ibex_had_mcp_record_purchase(jsonb)`
- `public.ibex_had_mcp_record_expense(jsonb)`
- `public.ibex_had_mcp_record_receipt(jsonb)`
- `public.ibex_had_mcp_record_payment(jsonb)`

Until those functions have been built and tested on a temporary database branch, write tools should remain disabled.

## Local run

```bash
cd mcp-server
npm install
cp .env.example .env
# fill DATABASE_URL and MCP_BEARER_TOKEN
npm start
```

Health endpoint:

```text
GET /healthz
```

MCP endpoint:

```text
/mcp
```

## Production authentication

The bootstrap server supports a static bearer token so the transport can be tested immediately. Before broad production use with ChatGPT, replace this bootstrap mechanism with OAuth and scoped read/write authorization.

## Database contract rule

No production DDL or financial write functions should be applied directly from this branch without:

1. creating/testing on a temporary database branch,
2. validating real Bahkm-for-Honey scenarios,
3. reviewing the accounting effects,
4. explicit approval before applying to `main`.
