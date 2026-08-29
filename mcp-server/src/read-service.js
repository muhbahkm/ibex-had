import { sql } from './db.js';
import { config } from './config.js';

const REQUIRED_VIEWS = Object.freeze([
  'public.ibex_had_customer_statement_entries_v2',
  'public.ibex_had_customer_statement_closure_v2',
  'public.ibex_had_supplier_statement_entries_v2',
  'public.ibex_had_supplier_statement_closure_v2',
  'public.ibex_had_receivables_summary_v2',
  'public.ibex_had_payables_summary_v2',
  'public.ibex_had_historical_reconciliation_gaps_v2',
  'public.ibex_had_counterparty_roles_v2',
  'public.ibex_had_reporting_contracts'
]);

const WRITE_FUNCTIONS = Object.freeze([
  'public.ibex_had_mcp_create_counterparty(jsonb)',
  'public.ibex_had_mcp_record_sale(jsonb)',
  'public.ibex_had_mcp_record_purchase(jsonb)',
  'public.ibex_had_mcp_record_expense(jsonb)',
  'public.ibex_had_mcp_record_receipt(jsonb)',
  'public.ibex_had_mcp_record_payment(jsonb)'
]);

function businessScope(row) {
  const value = row?.business_id;
  return value === undefined || value === null || value === config.businessId;
}

function partyIdMatches(row, partyId) {
  return [
    row?.customer_id,
    row?.supplier_id,
    row?.counterparty_id,
    row?.party_id,
    row?.id
  ].some((value) => value === partyId);
}

function extractDate(row) {
  return row?.entry_datetime || row?.transaction_date || row?.date || row?.created_at || null;
}

function inPeriod(row, periodFrom, periodTo) {
  if (!periodFrom && !periodTo) return true;
  const value = extractDate(row);
  if (!value) return true;
  const date = String(value).slice(0, 10);
  if (periodFrom && date < periodFrom) return false;
  if (periodTo && date > periodTo) return false;
  return true;
}

function isZeroDecimal(value) {
  if (value === null || value === undefined) return false;
  return /^[-+]?0+(?:\.0+)?$/.test(String(value).trim());
}

function closureVerified(row) {
  return row?.verification_status === 'VERIFIED' && isZeroDecimal(row?.difference);
}

export async function healthSnapshot() {
  const [db] = await sql`
    select
      current_database() as database_name,
      current_user as database_user,
      current_setting('server_version') as postgres_version,
      now()::text as database_time
  `;

  const views = [];
  for (const view of REQUIRED_VIEWS) {
    const [row] = await sql`select to_regclass(${view})::text as object_name`;
    views.push({ name: view, exists: Boolean(row?.object_name) });
  }

  const writeFunctions = [];
  for (const fn of WRITE_FUNCTIONS) {
    const [row] = await sql`select to_regprocedure(${fn})::text as function_name`;
    writeFunctions.push({ name: fn, exists: Boolean(row?.function_name) });
  }

  return {
    database: db,
    business_id: config.businessId,
    neon_project_id: config.neonProjectId,
    reporting_v2_ready: views.every((item) => item.exists),
    required_views: views,
    write_contract_ready: writeFunctions.every((item) => item.exists),
    write_functions: writeFunctions,
    write_tools_enabled: config.writeToolsEnabled
  };
}

export async function findCounterparties(query, limit = 10) {
  const pattern = `%${query}%`;
  const rows = await sql`
    select to_jsonb(r) as row
    from public.ibex_had_counterparty_roles_v2 r
    where coalesce(to_jsonb(r)->>'business_id', ${config.businessId}) = ${config.businessId}
      and to_jsonb(r)::text ilike ${pattern}
    limit ${limit}
  `;

  return rows.map(({ row }) => row).filter(businessScope);
}

async function customerStatementRows(partyId) {
  const entries = await sql`
    select to_jsonb(e) as row
    from public.ibex_had_customer_statement_entries_v2 e
    where coalesce(to_jsonb(e)->>'business_id', ${config.businessId}) = ${config.businessId}
      and (
        to_jsonb(e)->>'customer_id' = ${partyId}
        or to_jsonb(e)->>'counterparty_id' = ${partyId}
        or to_jsonb(e)->>'party_id' = ${partyId}
      )
  `;

  const closure = await sql`
    select to_jsonb(c) as row
    from public.ibex_had_customer_statement_closure_v2 c
    where coalesce(to_jsonb(c)->>'business_id', ${config.businessId}) = ${config.businessId}
      and (
        to_jsonb(c)->>'customer_id' = ${partyId}
        or to_jsonb(c)->>'counterparty_id' = ${partyId}
        or to_jsonb(c)->>'party_id' = ${partyId}
      )
  `;

  return {
    entries: entries.map(({ row }) => row),
    closure: closure.map(({ row }) => row)
  };
}

async function supplierStatementRows(partyId) {
  const entries = await sql`
    select to_jsonb(e) as row
    from public.ibex_had_supplier_statement_entries_v2 e
    where coalesce(to_jsonb(e)->>'business_id', ${config.businessId}) = ${config.businessId}
      and (
        to_jsonb(e)->>'supplier_id' = ${partyId}
        or to_jsonb(e)->>'counterparty_id' = ${partyId}
        or to_jsonb(e)->>'party_id' = ${partyId}
      )
  `;

  const closure = await sql`
    select to_jsonb(c) as row
    from public.ibex_had_supplier_statement_closure_v2 c
    where coalesce(to_jsonb(c)->>'business_id', ${config.businessId}) = ${config.businessId}
      and (
        to_jsonb(c)->>'supplier_id' = ${partyId}
        or to_jsonb(c)->>'counterparty_id' = ${partyId}
        or to_jsonb(c)->>'party_id' = ${partyId}
      )
  `;

  return {
    entries: entries.map(({ row }) => row),
    closure: closure.map(({ row }) => row)
  };
}

function normalizeStatement({ entries, closure }, { partyId, currency, periodFrom, periodTo, kind }) {
  const scopedEntries = entries
    .filter(businessScope)
    .filter((row) => partyIdMatches(row, partyId))
    .filter((row) => !currency || row?.currency === currency)
    .filter((row) => inPeriod(row, periodFrom, periodTo))
    .sort((a, b) => String(extractDate(a) || '').localeCompare(String(extractDate(b) || '')));

  const scopedClosure = closure
    .filter(businessScope)
    .filter((row) => partyIdMatches(row, partyId))
    .filter((row) => !currency || row?.currency === currency);

  const verified = scopedClosure.length > 0 && scopedClosure.every(closureVerified);

  return {
    statement_type: kind,
    party_id: partyId,
    currency: currency || null,
    period: { from: periodFrom || null, to: periodTo || null },
    verification_status: verified ? 'VERIFIED' : 'NEEDS_REVIEW',
    official_statement_allowed: verified,
    closure: scopedClosure,
    entries: scopedEntries,
    warning: verified
      ? null
      : 'لا يجوز إصدار كشف رسمي من هذه النتيجة حتى تكون جميع صفوف الإقفال VERIFIED و difference = 0.'
  };
}

export async function getCustomerStatement(args) {
  const raw = await customerStatementRows(args.partyId);
  return normalizeStatement(raw, { ...args, kind: 'customer' });
}

export async function getSupplierStatement(args) {
  const raw = await supplierStatementRows(args.partyId);
  return normalizeStatement(raw, { ...args, kind: 'supplier' });
}

export async function getReceivables({ currency, limit = 100 }) {
  const rows = await sql`
    select to_jsonb(v) as row
    from public.ibex_had_receivables_summary_v2 v
    where coalesce(to_jsonb(v)->>'business_id', ${config.businessId}) = ${config.businessId}
    limit ${limit}
  `;

  return rows
    .map(({ row }) => row)
    .filter(businessScope)
    .filter((row) => !currency || row?.currency === currency);
}

export async function getPayables({ currency, limit = 100 }) {
  const rows = await sql`
    select to_jsonb(v) as row
    from public.ibex_had_payables_summary_v2 v
    where coalesce(to_jsonb(v)->>'business_id', ${config.businessId}) = ${config.businessId}
    limit ${limit}
  `;

  return rows
    .map(({ row }) => row)
    .filter(businessScope)
    .filter((row) => !currency || row?.currency === currency);
}

export async function getReportingContract() {
  const rows = await sql`
    select to_jsonb(c) as row
    from public.ibex_had_reporting_contracts c
    where coalesce(to_jsonb(c)->>'business_id', ${config.businessId}) = ${config.businessId}
  `;

  return rows.map(({ row }) => row).filter(businessScope);
}
