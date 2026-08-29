import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import postgres from "postgres";
import { z } from "zod";

const BUSINESS_ID = "4c424fea-a5fb-485f-b695-535eac647224";
const NEON_PROJECT_ID = "misty-fog-32976945";

interface Env {
  DATABASE_URL?: string;
  MCP_BEARER_TOKEN: string;
  HYPERDRIVE?: { connectionString: string };
}

const currencySchema = z.enum(["YER", "SAR", "USD"]);
const uuidSchema = z.string().uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function connectionString(env: Env): string {
  const value = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
  if (!value) throw new Error("Database connection is not configured.");
  return value;
}

function database(env: Env) {
  return postgres(connectionString(env), {
    max: 5,
    fetch_types: false,
    prepare: true,
    ssl: env.HYPERDRIVE ? undefined : "require",
    connection: { application_name: "ibex-had-accounting-mcp-worker-v1" }
  });
}

function success(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ ok: true, data }, null, 2) }],
    structuredContent: { ok: true, data }
  };
}

function failure(message: string, code = "database_error") {
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: { code, message } }, null, 2) }],
    structuredContent: { ok: false, error: { code, message } }
  };
}

function numeric(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function ledgerEffect(entryType: string, amount: unknown): number {
  const value = numeric(amount);
  if (entryType === "credit") return -value;
  if (entryType === "debit" || entryType === "adjustment") return value;
  return 0;
}

function createServer(env: Env) {
  const server = new McpServer({ name: "ibex-had-accounting", version: "0.2.0-cf" });

  server.registerTool("system_health", {
    description: "تحقق من اتصال PostgreSQL ومن وجود طبقة القراءة المحاسبية الحاكمة دون تعديل أي بيانات.",
    inputSchema: {}
  }, async () => {
    const sql = database(env);
    try {
      const [db] = await sql`select current_database() as database_name, current_user as database_user, current_setting('server_version') as postgres_version, now()::text as database_time`;
      const required = [
        "public.ibex_had_customers",
        "public.ibex_had_customer_ledger",
        "public.ibex_had_customer_balances",
        "public.ibex_had_counterparty_roles_v2"
      ];
      const objects = [];
      for (const name of required) {
        const [row] = await sql`select to_regclass(${name})::text as object_name`;
        objects.push({ name, exists: Boolean(row?.object_name) });
      }
      return success({
        database: db,
        business_id: BUSINESS_ID,
        neon_project_id: NEON_PROJECT_ID,
        accounting_read_layer_ready: objects.every((x) => x.exists),
        objects,
        balance_semantics: "positive=receivable, negative=payable, zero=settled"
      });
    } catch (error) {
      return failure(error instanceof Error ? error.message : "Database error");
    } finally {
      await sql.end({ timeout: 2 });
    }
  });

  server.registerTool("find_counterparty", {
    description: "ابحث عن طرف مالي بالاسم أو الهاتف، مع إظهار UUID والدور والرصيد الحالي لكل عملة.",
    inputSchema: { query: z.string().min(2).max(120), limit: z.number().int().min(1).max(25).default(10) }
  }, async ({ query, limit }) => {
    const sql = database(env);
    try {
      const pattern = `%${query}%`;
      const rows = await sql`
        select
          c.id as counterparty_id,
          c.display_name,
          c.phone,
          coalesce(r.counterparty_role, 'UNKNOWN') as counterparty_role,
          coalesce(r.has_customer_activity, false) as has_customer_activity,
          coalesce(r.has_supplier_activity, false) as has_supplier_activity,
          coalesce(
            jsonb_agg(
              jsonb_build_object('currency', b.currency, 'balance', b.balance)
              order by b.currency
            ) filter (where b.currency is not null),
            '[]'::jsonb
          ) as balances
        from public.ibex_had_customers c
        left join public.ibex_had_counterparty_roles_v2 r
          on r.business_id = c.business_id and r.customer_id = c.id
        left join public.ibex_had_customer_balances b
          on b.business_id = c.business_id and b.customer_id = c.id
        where c.business_id = ${BUSINESS_ID}
          and (c.display_name ilike ${pattern} or coalesce(c.phone, '') ilike ${pattern})
        group by c.id, c.display_name, c.phone, r.counterparty_role, r.has_customer_activity, r.has_supplier_activity
        order by c.display_name
        limit ${limit}
      `;
      return success(rows);
    } catch (error) {
      return failure(error instanceof Error ? error.message : "Database error");
    } finally {
      await sql.end({ timeout: 2 });
    }
  });

  const registerStatement = (toolName: "get_customer_statement" | "get_supplier_statement", kind: "customer" | "supplier") => {
    server.registerTool(toolName, {
      description: kind === "customer"
        ? "كشف حساب طرف من دفتر customer_ledger الحاكم مع مطابقة الرصيد الحالي في customer_balances."
        : "كشف حساب مورد من نفس دفتر الأطراف الحاكم مع مطابقة الرصيد الحالي في customer_balances.",
      inputSchema: {
        party_id: uuidSchema,
        currency: currencySchema.optional(),
        period_from: dateSchema.optional(),
        period_to: dateSchema.optional()
      }
    }, async ({ party_id, currency, period_from, period_to }) => {
      const sql = database(env);
      try {
        const [party] = await sql`
          select c.id as counterparty_id, c.display_name, c.phone,
                 coalesce(r.counterparty_role, 'UNKNOWN') as counterparty_role
          from public.ibex_had_customers c
          left join public.ibex_had_counterparty_roles_v2 r
            on r.business_id = c.business_id and r.customer_id = c.id
          where c.business_id = ${BUSINESS_ID} and c.id = ${party_id}
          limit 1
        `;
        if (!party) return failure("Counterparty not found", "not_found");

        const entries = await sql`
          select
            l.id as entry_id,
            l.entry_datetime,
            l.entry_type::text as entry_type,
            l.currency::text as currency,
            l.amount,
            l.balance_after as stored_balance_after,
            l.description,
            l.notes,
            l.transaction_id,
            l.payment_id
          from public.ibex_had_customer_ledger l
          where l.business_id = ${BUSINESS_ID}
            and l.customer_id = ${party_id}
          order by l.entry_datetime, l.created_at, l.id
        `;

        const currentBalances = await sql`
          select currency::text as currency, balance
          from public.ibex_had_customer_balances
          where business_id = ${BUSINESS_ID} and customer_id = ${party_id}
          order by currency
        `;

        const running = new Map<string, number>();
        const normalized = entries.map((row) => {
          const curr = String(row.currency);
          const effect = ledgerEffect(String(row.entry_type), row.amount);
          const next = (running.get(curr) ?? 0) + effect;
          running.set(curr, next);
          return { ...row, debit: effect > 0 ? effect : 0, credit: effect < 0 ? Math.abs(effect) : 0, calculated_balance_after: next };
        });

        const from = period_from ?? null;
        const to = period_to ?? null;
        const openingByCurrency = new Map<string, number>();
        for (const row of normalized) {
          const date = String(row.entry_datetime ?? "").slice(0, 10);
          if (from && date && date < from) {
            openingByCurrency.set(String(row.currency), numeric(row.calculated_balance_after));
          }
        }

        const filtered = normalized.filter((row) => {
          if (currency && row.currency !== currency) return false;
          const date = String(row.entry_datetime ?? "").slice(0, 10);
          if (from && date && date < from) return false;
          if (to && date && date > to) return false;
          return true;
        });

        const relevantCurrencies = currency
          ? [currency]
          : Array.from(new Set([...normalized.map((r) => String(r.currency)), ...currentBalances.map((r) => String(r.currency))]));

        const closure = relevantCurrencies.map((curr) => {
          const balanceRow = currentBalances.find((r) => String(r.currency) === curr);
          const calculatedCurrent = running.get(curr) ?? 0;
          const authoritativeCurrent = balanceRow ? numeric(balanceRow.balance) : 0;
          const difference = calculatedCurrent - authoritativeCurrent;
          const periodEntries = filtered.filter((r) => String(r.currency) === curr);
          const openingBalance = from ? (openingByCurrency.get(curr) ?? 0) : 0;
          const periodNet = periodEntries.reduce((sum, r) => sum + ledgerEffect(String(r.entry_type), r.amount), 0);
          return {
            currency: curr,
            opening_balance: openingBalance,
            period_net: periodNet,
            period_closing_balance: openingBalance + periodNet,
            current_authoritative_balance: authoritativeCurrent,
            current_calculated_balance: calculatedCurrent,
            difference,
            verification_status: Math.abs(difference) < 0.000001 ? "VERIFIED" : "MISMATCH"
          };
        });

        const verified = closure.length > 0 && closure.every((r) => r.verification_status === "VERIFIED");
        return success({
          statement_type: kind,
          party,
          period: { from, to },
          currency: currency ?? null,
          verification_status: verified ? "VERIFIED" : "NEEDS_REVIEW",
          official_statement_allowed: verified,
          closure,
          entries: filtered,
          warning: verified ? null : "يوجد فرق بين مجموع دفتر الطرف والرصيد الحاكم؛ لا يصدر كشف رسمي قبل المراجعة."
        });
      } catch (error) {
        return failure(error instanceof Error ? error.message : "Database error");
      } finally {
        await sql.end({ timeout: 2 });
      }
    });
  };

  registerStatement("get_customer_statement", "customer");
  registerStatement("get_supplier_statement", "supplier");

  const registerSummary = (toolName: "get_receivables" | "get_payables", sign: "positive" | "negative") => {
    server.registerTool(toolName, {
      description: sign === "positive" ? "اعرض الأرصدة الموجبة: مبالغ مستحقة لصالح باحكم للعسل." : "اعرض الأرصدة السالبة: مبالغ مستحقة على باحكم للعسل.",
      inputSchema: { currency: currencySchema.optional(), limit: z.number().int().min(1).max(500).default(100) }
    }, async ({ currency, limit }) => {
      const sql = database(env);
      try {
        const rows = sign === "positive"
          ? await sql`
              select b.customer_id as counterparty_id, b.display_name, b.phone, b.currency::text as currency,
                     b.balance as amount, coalesce(r.counterparty_role, 'UNKNOWN') as counterparty_role
              from public.ibex_had_customer_balances b
              left join public.ibex_had_counterparty_roles_v2 r
                on r.business_id = b.business_id and r.customer_id = b.customer_id
              where b.business_id = ${BUSINESS_ID} and b.balance > 0
              order by b.balance desc
              limit ${limit}
            `
          : await sql`
              select b.customer_id as counterparty_id, b.display_name, b.phone, b.currency::text as currency,
                     abs(b.balance) as amount, b.balance as signed_balance,
                     coalesce(r.counterparty_role, 'UNKNOWN') as counterparty_role
              from public.ibex_had_customer_balances b
              left join public.ibex_had_counterparty_roles_v2 r
                on r.business_id = b.business_id and r.customer_id = b.customer_id
              where b.business_id = ${BUSINESS_ID} and b.balance < 0
              order by abs(b.balance) desc
              limit ${limit}
            `;
        return success(currency ? rows.filter((r) => r.currency === currency) : rows);
      } catch (error) {
        return failure(error instanceof Error ? error.message : "Database error");
      } finally {
        await sql.end({ timeout: 2 });
      }
    });
  };

  registerSummary("get_receivables", "positive");
  registerSummary("get_payables", "negative");

  server.registerTool("get_reporting_contract", {
    description: "اقرأ عقد القراءة المحاسبي الحاكم للنسخة الحالية من MCP.",
    inputSchema: {}
  }, async () => success({
    contract_name: "IBEX_HAD_ACCOUNTING_READ_V1",
    contract_version: "1.0",
    business_id: BUSINESS_ID,
    canonical_entries_source: "public.ibex_had_customer_ledger",
    canonical_balance_source: "public.ibex_had_customer_balances",
    counterparty_role_source: "public.ibex_had_counterparty_roles_v2",
    balance_semantics: "positive balance = receivable; negative balance = payable; zero = settled",
    currency_rule: "Currencies are never aggregated together",
    write_access: false
  }));

  return server;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") {
      return Response.json({ ok: true, service: "ibex-had-accounting-mcp", mode: "read-only", version: "0.2.0-cf" });
    }
    if (url.pathname !== "/mcp") return new Response("Not found", { status: 404 });
    if (!env.MCP_BEARER_TOKEN || request.headers.get("authorization") !== `Bearer ${env.MCP_BEARER_TOKEN}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json", "www-authenticate": "Bearer realm=\"IBEX HAD MCP\"" }
      });
    }
    return createMcpHandler(() => createServer(env))(request, env, ctx);
  }
} satisfies ExportedHandler<Env>;
