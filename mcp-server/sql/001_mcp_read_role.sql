-- IBEX HAD Accounting MCP v0.1 — production read role
-- Run on the production/main database as an owner/admin.
-- This grants only the objects required by the read-only MCP surface.

GRANT CONNECT ON DATABASE neondb TO ibex_mcp;
GRANT USAGE ON SCHEMA public TO ibex_mcp;

GRANT SELECT ON
    public.ibex_had_customers,
    public.ibex_had_customer_ledger,
    public.ibex_had_customer_balances,
    public.ibex_had_counterparty_roles_v2,
    public.ibex_had_transactions
TO ibex_mcp;

-- Explicitly keep write privileges absent from core financial tables.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON
    public.ibex_had_customers,
    public.ibex_had_customer_ledger,
    public.ibex_had_transactions,
    public.ibex_had_payments,
    public.ibex_had_cash_movements,
    public.ibex_had_cash_accounts,
    public.ibex_had_operation_requests
FROM ibex_mcp;
