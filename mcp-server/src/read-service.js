import { sql } from './db.js';
import { config } from './config.js';

const REQUIRED_OBJECTS = Object.freeze([
  'public.ibex_had_customer_ledger',
  'public.ibex_had_customer_balances',
  'public.ibex_had_counterparty_roles_v2',
  'public.ibex_had_customers'
]);

const WRITE_FUNCTIONS = Object.freeze([
  'public.ibex_had_mcp_create_counterparty(jsonb)',
  'public.ibex_had_mcp_record_sale(jsonb)',
  'public.ibex_had_mcp_record_purchase(jsonb)',
  'public.ibex_had_mcp_record_expense(jsonb)',
  'public.ibex_had_mcp_record_receipt(jsonb)',
  'public.ibex_had_mcp_record_payment(jsonb)'
]);

function inPeriod(row, periodFrom, periodTo) {
  if (!periodFrom && !periodTo) return true;
  const value = row?.entry_datetime;
  if (!value) return true;
  const date = String(value).slice(0, 10);
  if (periodFrom && date < periodFrom) return false;
  if (periodTo && date > periodTo) return false;
  return true;
}

function normalizeMoney(value) {
  if (value === null || value === undefined) return '0';
  return String(value);
}

export async function healthSnapshot() {
  const [db] = await sql`
    select
      current_database() as database_name,
      current_user as database_user,
      current_setting('server_version') as postgres_version,
      now()::text as database_time
  `;

  const objects = [];
  for (const objectName of REQUIRED_OBJECTS) {
    const [row] = await sql`select to_regclass(${objectName})::text as object_name`;
    objects.push({ name: objectName, exists: Boolean(row?.object_name) });
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
    reporting_ready: objects.every((item) => item.exists),
    accounting_source: 'ibex_had_customer_ledger',
    closure_source: 'ibex_had_customer_balances',
    required_objects: objects,
    write_contract_ready: writeFunctions.every((item) => item.exists),
    write_functions: writeFunctions,
    write_tools_enabled: config.writeToolsEnabled
  };
}

export async function findCounterparties(query, limit = 10) {
  const pattern = `%${query}%`;
  return sql`
    select
      r.business_id,
      r.customer_id as counterparty_id,
      r.customer_id as party_id,
      r.display_name,
      r.phone,
      r.has_customer_activity,
      r.has_supplier_activity,
      r.has_positive_balance,
      r.has_negative_balance,
      r.counterparty_role
    from public.ibex_had_counterparty_roles_v2 r
    where r.business_id = ${config.businessId}::uuid
      and (
        r.display_name ilike ${pattern}
        or coalesce(r.phone, '') ilike ${pattern}
      )
    order by
      case when r.display_name = ${query} then 0 else 1 end,
      r.display_name
    limit ${limit}
  `;
}

async function getPartyMeta(partyId) {
  const [row] = await sql`
    select
      c.id as counterparty_id,
      c.display_name,
      c.phone,
      r.counterparty_role,
      r.has_customer_activity,
      r.has_supplier_activity
    from public.ibex_had_customers c
    left join public.ibex_had_counterparty_roles_v2 r
      on r.business_id = c.business_id
     and r.customer_id = c.id
    where c.business_id = ${config.businessId}::uuid
      and c.id = ${partyId}::uuid
    limit 1
  `;
  return row || null;
}

async function getLedgerEntries(partyId, currency) {
  return sql`
    select
      l.id as entry_id,
      l.business_id,
      l.customer_id as counterparty_id,
      l.entry_datetime,
      l.entry_type::text as entry_type,
      l.currency::text as currency,
      l.amount,
      case
        when l.entry_type::text = 'debit' then l.amount
        when l.entry_type::text = 'credit' then -l.amount
        when l.entry_type::text = 'adjustment' then l.amount
        else 0::numeric
      end as net_effect,
      l.balance_after as stored_balance_after,
      sum(
        case
          when l.entry_type::text = 'debit' then l.amount
          when l.entry_type::text = 'credit' then -l.amount
          when l.entry_type::text = 'adjustment' then l.amount
          else 0::numeric
        end
      ) over (
        partition by l.business_id, l.customer_id, l.currency
        order by l.entry_datetime, l.created_at, l.id
        rows between unbounded preceding and current row
      ) as balance_after,
      l.description,
      l.notes,
      l.transaction_id,
      l.payment_id,
      t.transaction_no,
      t.transaction_type::text as transaction_type,
      t.transaction_status::text as transaction_status
    from public.ibex_had_customer_ledger l
    left join public.ibex_had_transactions t on t.id = l.transaction_id
    where l.business_id = ${config.businessId}::uuid
      and l.customer_id = ${partyId}::uuid
      and (${currency || null}::text is null or l.currency::text = ${currency || null}::text)
    order by l.entry_datetime, l.created_at, l.id
  `;
}

async function getBalances(partyId, currency) {
  return sql`
    select
      b.business_id,
      b.customer_id as counterparty_id,
      b.display_name,
      b.phone,
      b.currency::text as currency,
      b.balance
    from public.ibex_had_customer_balances b
    where b.business_id = ${config.businessId}::uuid
      and b.customer_id = ${partyId}::uuid
      and (${currency || null}::text is null or b.currency::text = ${currency || null}::text)
    order by b.currency
  `;
}

async function buildStatement({ partyId, currency, periodFrom, periodTo, kind }) {
  const [party, allEntries, balances] = await Promise.all([
    getPartyMeta(partyId),
    getLedgerEntries(partyId, currency),
    getBalances(partyId, currency)
  ]);

  if (!party) {
    return {
      statement_type: kind,
      party_id: partyId,
      verification_status: 'NOT_FOUND',
      official_statement_allowed: false,
      entries: [],
      closure: [],
      warning: 'الطرف غير موجود في النشاط المحدد.'
    };
  }

  const entries = allEntries.filter((row) => inPeriod(row, periodFrom, periodTo));

  const closure = balances.map((row) => ({
    business_id: row.business_id,
    counterparty_id: row.counterparty_id,
    customer_id: row.counterparty_id,
    supplier_id: row.counterparty_id,
    currency: row.currency,
    ending_balance: normalizeMoney(row.balance),
    difference: '0',
    verification_status: 'VERIFIED',
    balance_semantics:
      Number(row.balance) > 0
        ? 'RECEIVABLE'
        : Number(row.balance) < 0
          ? 'PAYABLE'
          : 'SETTLED'
  }));

  const hasAdjustment = allEntries.some((row) => row.entry_type === 'adjustment');
  const verified = closure.length > 0 && !hasAdjustment;

  return {
    statement_type: kind,
    party_id: partyId,
    party,
    currency: currency || null,
    period: { from: periodFrom || null, to: periodTo || null },
    verification_status: verified ? 'VERIFIED' : closure.length ? 'NEEDS_REVIEW' : 'NO_BALANCE',
    official_statement_allowed: verified,
    closure,
    entries,
    warning: hasAdjustment
      ? 'يحتوي الدفتر على قيد adjustment؛ يلزم مراجعة بشرية قبل إصدار كشف رسمي.'
      : closure.length
        ? null
        : 'لا يوجد رصيد حاكم في ibex_had_customer_balances لهذا الطرف/العملة.'
  };
}

export async function getCustomerStatement(args) {
  return buildStatement({ ...args, kind: 'customer' });
}

export async function getSupplierStatement(args) {
  return buildStatement({ ...args, kind: 'supplier' });
}

export async function getReceivables({ currency, limit = 100 }) {
  return sql`
    select
      b.business_id,
      b.customer_id as counterparty_id,
      b.display_name,
      b.phone,
      b.currency::text as currency,
      b.balance as amount_due_to_business,
      r.counterparty_role,
      'VERIFIED'::text as verification_status
    from public.ibex_had_customer_balances b
    left join public.ibex_had_counterparty_roles_v2 r
      on r.business_id = b.business_id
     and r.customer_id = b.customer_id
    where b.business_id = ${config.businessId}::uuid
      and b.balance > 0
      and (${currency || null}::text is null or b.currency::text = ${currency || null}::text)
    order by b.balance desc
    limit ${limit}
  `;
}

export async function getPayables({ currency, limit = 100 }) {
  return sql`
    select
      b.business_id,
      b.customer_id as counterparty_id,
      b.display_name,
      b.phone,
      b.currency::text as currency,
      abs(b.balance) as amount_due_to_counterparty,
      r.counterparty_role,
      'VERIFIED'::text as verification_status
    from public.ibex_had_customer_balances b
    left join public.ibex_had_counterparty_roles_v2 r
      on r.business_id = b.business_id
     and r.customer_id = b.customer_id
    where b.business_id = ${config.businessId}::uuid
      and b.balance < 0
      and (${currency || null}::text is null or b.currency::text = ${currency || null}::text)
    order by abs(b.balance) desc
    limit ${limit}
  `;
}

export async function getReportingContract() {
  return [{
    business_id: config.businessId,
    contract_name: 'IBEX_HAD_LEDGER_CONTRACT_V1',
    contract_version: '1.0',
    accounting_source: 'public.ibex_had_customer_ledger',
    closure_source: 'public.ibex_had_customer_balances',
    counterparty_source: 'public.ibex_had_counterparty_roles_v2',
    balance_semantics: 'positive=receivable; negative=payable; zero=settled',
    currency_rule: 'YER/SAR/USD are always separated',
    official_statement_rule: 'closure comes from customer_balances; adjustment entries require review'
  }];
}
