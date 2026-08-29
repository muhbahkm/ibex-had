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

function isVerified(row: Record<string, unknown>): boolean {
  const difference = String(row.difference ?? "").trim();
  return row.verification_status === "VERIFIED" && /^[-+]?0+(?:\.0+)?$/.test(difference);
}

function createServer(env: Env) {
  const server = new McpServer({ name: "ibex-had-accounting", version: "0.1.0-cf" });

  server.registerTool("system_health", {
    description: "تحقق من اتصال PostgreSQL ومن وجود طبقة التقارير v2 دون تعديل أي بيانات.",
    inputSchema: {}
  }, async () => {
    const sql = database(env);
    try {
      const [db] = await sql`select current_database() as database_name, current_user as database_user, current_setting('server_version') as postgres_version, now()::text as database_time`;
      const required = [
        "public.ibex_had_customer_statement_entries_v2",
        "public.ibex_had_customer_statement_closure_v2",
        "public.ibex_had_supplier_statement_entries_v2",
        "public.ibex_had_supplier_statement_closure_v2",
        "public.ibex_had_receivables_summary_v2",
        "public.ibex_had_payables_summary_v2",
        "public.ibex_had_counterparty_roles_v2",
        "public.ibex_had_reporting_contracts"
      ];
      const objects = [];
      for (const name of required) {
        const [row] = await sql`select to_regclass(${name})::text as object_name`;
        objects.push({ name, exists: Boolean(row?.object_name) });
      }
      return success({ database: db, business_id: BUSINESS_ID, neon_project_id: NEON_PROJECT_ID, reporting_v2_ready: objects.every((x) => x.exists), objects });
    } catch (error) {
      return failure(error instanceof Error ? error.message : "Database error");
    } finally {
      await sql.end({ timeout: 2 });
    }
  });

  server.registerTool("find_counterparty", {
    description: "ابحث عن عميل أو مورد في طبقة أدوار الأطراف v2.",
    inputSchema: { query: z.string().min(2).max(120), limit: z.number().int().min(1).max(25).default(10) }
  }, async ({ query, limit }) => {
    const sql = database(env);
    try {
      const pattern = `%${query}%`;
      const rows = await sql`select to_jsonb(r) as row from public.ibex_had_counterparty_roles_v2 r where coalesce(to_jsonb(r)->>'business_id', ${BUSINESS_ID}) = ${BUSINESS_ID} and to_jsonb(r)::text ilike ${pattern} limit ${limit}`;
      return success(rows.map((x) => x.row));
    } catch (error) {
      return failure(error instanceof Error ? error.message : "Database error");
    } finally {
      await sql.end({ timeout: 2 });
    }
  });

  const registerStatement = (toolName: "get_customer_statement" | "get_supplier_statement", kind: "customer" | "supplier") => {
    server.registerTool(toolName, {
      description: kind === "customer" ? "كشف حساب عميل من طبقة v2 مع تحقق VERIFIED." : "كشف حساب مورد من طبقة v2 مع تحقق VERIFIED.",
      inputSchema: { party_id: uuidSchema, currency: currencySchema.optional(), period_from: dateSchema.optional(), period_to: dateSchema.optional() }
    }, async ({ party_id, currency, period_from, period_to }) => {
      const sql = database(env);
      const entriesView = kind === "customer" ? "ibex_had_customer_statement_entries_v2" : "ibex_had_supplier_statement_entries_v2";
      const closureView = kind === "customer" ? "ibex_had_customer_statement_closure_v2" : "ibex_had_supplier_statement_closure_v2";
      const partyKey = kind === "customer" ? "customer_id" : "supplier_id";
      try {
        const entries = await sql.unsafe(`select to_jsonb(v) as row from public.${entriesView} v where coalesce(to_jsonb(v)->>'business_id', $1) = $1 and (to_jsonb(v)->>'${partyKey}' = $2 or to_jsonb(v)->>'counterparty_id' = $2 or to_jsonb(v)->>'party_id' = $2)`, [BUSINESS_ID, party_id]);
        const closures = await sql.unsafe(`select to_jsonb(v) as row from public.${closureView} v where coalesce(to_jsonb(v)->>'business_id', $1) = $1 and (to_jsonb(v)->>'${partyKey}' = $2 or to_jsonb(v)->>'counterparty_id' = $2 or to_jsonb(v)->>'party_id' = $2)`, [BUSINESS_ID, party_id]);
        const entryRows = entries.map((x) => x.row as Record<string, unknown>).filter((row) => !currency || row.currency === currency).filter((row) => {
          const date = String(row.entry_datetime ?? row.transaction_date ?? row.date ?? row.created_at ?? "").slice(0, 10);
          if (period_from && date && date < period_from) return false;
          if (period_to && date && date > period_to) return false;
          return true;
        });
        const closureRows = closures.map((x) => x.row as Record<string, unknown>).filter((row) => !currency || row.currency === currency);
        const verified = closureRows.length > 0 && closureRows.every(isVerified);
        return success({ statement_type: kind, party_id, currency: currency ?? null, verification_status: verified ? "VERIFIED" : "NEEDS_REVIEW", official_statement_allowed: verified, closure: closureRows, entries: entryRows, warning: verified ? null : "لا يجوز إصدار كشف رسمي حتى تكون صفوف الإقفال VERIFIED و difference = 0." });
      } catch (error) {
        return failure(error instanceof Error ? error.message : "Database error");
      } finally {
        await sql.end({ timeout: 2 });
      }
    });
  };

  registerStatement("get_customer_statement", "customer");
  registerStatement("get_supplier_statement", "supplier");

  const registerSummary = (toolName: "get_receivables" | "get_payables", view: "ibex_had_receivables_summary_v2" | "ibex_had_payables_summary_v2") => {
    server.registerTool(toolName, {
      description: toolName === "get_receivables" ? "اعرض من لنا عليهم من v2." : "اعرض من علينا لهم من v2.",
      inputSchema: { currency: currencySchema.optional(), limit: z.number().int().min(1).max(500).default(100) }
    }, async ({ currency, limit }) => {
      const sql = database(env);
      try {
        const rows = await sql.unsafe(`select to_jsonb(v) as row from public.${view} v where coalesce(to_jsonb(v)->>'business_id', $1) = $1 limit $2`, [BUSINESS_ID, limit]);
        return success(rows.map((x) => x.row as Record<string, unknown>).filter((row) => !currency || row.currency === currency));
      } catch (error) {
        return failure(error instanceof Error ? error.message : "Database error");
      } finally {
        await sql.end({ timeout: 2 });
      }
    });
  };

  registerSummary("get_receivables", "ibex_had_receivables_summary_v2");
  registerSummary("get_payables", "ibex_had_payables_summary_v2");

  server.registerTool("get_reporting_contract", {
    description: "اقرأ عقد التقارير الحاكم من قاعدة باحكم للعسل.",
    inputSchema: {}
  }, async () => {
    const sql = database(env);
    try {
      const rows = await sql`select to_jsonb(v) as row from public.ibex_had_reporting_contracts v where coalesce(to_jsonb(v)->>'business_id', ${BUSINESS_ID}) = ${BUSINESS_ID}`;
      return success(rows.map((x) => x.row));
    } catch (error) {
      return failure(error instanceof Error ? error.message : "Database error");
    } finally {
      await sql.end({ timeout: 2 });
    }
  });

  return server;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") return Response.json({ ok: true, service: "ibex-had-accounting-mcp", mode: "read-only", version: "0.1.0-cf" });
    if (url.pathname !== "/mcp") return new Response("Not found", { status: 404 });
    if (!env.MCP_BEARER_TOKEN || request.headers.get("authorization") !== `Bearer ${env.MCP_BEARER_TOKEN}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json", "www-authenticate": "Bearer realm=\"IBEX HAD MCP\"" } });
    }
    return createMcpHandler(() => createServer(env))(request, env, ctx);
  }
} satisfies ExportedHandler<Env>;
