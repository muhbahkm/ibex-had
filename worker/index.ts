import { neon } from '@neondatabase/serverless';

interface Env {
  DATABASE_URL: string;
  IBEX_BUSINESS_ID?: string;
  ASSETS: Fetcher;
}

const DEFAULT_BUSINESS_ID = '4c424fea-a5fb-485f-b695-535eac647224';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function getSql(env: Env) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }
  return neon(env.DATABASE_URL);
}

async function handleApi(request: Request, env: Env) {
  const url = new URL(request.url);

  if (url.pathname === '/api/ping') {
    return json({ ok: true, worker: 'ibex-had', runtime: 'cloudflare-workers' });
  }

  if (url.pathname === '/api/health') {
    try {
      const sql = getSql(env);
      const businessId = env.IBEX_BUSINESS_ID || DEFAULT_BUSINESS_ID;
      const rows = await sql`
        select id, business_name, business_code
        from ibex_had_businesses
        where id = ${businessId}
        limit 1
      `;

      if (!rows.length) {
        return json({ ok: false, database: 'connected', error: 'Business not found' }, 404);
      }

      return json({ ok: true, database: 'connected', business: rows[0] });
    } catch (error: any) {
      return json({ ok: false, database: 'error', error: error?.message || 'Database connection failed' }, 500);
    }
  }

  if (url.pathname === '/api/documents' && request.method === 'GET') {
    try {
      const sql = getSql(env);
      const businessId = env.IBEX_BUSINESS_ID || DEFAULT_BUSINESS_ID;
      const rows = await sql`
        select id, transaction_no, transaction_type, transaction_datetime,
               currency, party_name, total_amount, paid_amount, remaining_amount,
               transaction_status, notes
        from ibex_had_transactions
        where business_id = ${businessId}
          and transaction_status <> 'cancelled'
        order by transaction_datetime desc, created_at desc
        limit 50
      `;
      return json({ ok: true, data: rows });
    } catch (error: any) {
      return json({ ok: false, error: error?.message || 'Failed to load documents' }, 500);
    }
  }

  if (url.pathname === '/api/customer-statement' && request.method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) return json({ ok: false, error: 'q is required' }, 400);

    try {
      const sql = getSql(env);
      const businessId = env.IBEX_BUSINESS_ID || DEFAULT_BUSINESS_ID;
      const customers = await sql`
        select id, display_name, phone
        from ibex_had_customers
        where business_id = ${businessId}
          and is_active = true
          and (display_name ilike ${'%' + q + '%'} or coalesce(phone, '') ilike ${'%' + q + '%'})
        order by display_name
        limit 10
      `;

      if (!customers.length) return json({ ok: true, customer: null, entries: [] });

      const customer = customers[0];
      const entries = await sql`
        select id, entry_datetime, entry_type, currency, amount, balance_after,
               description, notes, transaction_id, payment_id
        from ibex_had_customer_ledger
        where business_id = ${businessId}
          and customer_id = ${customer.id}
        order by entry_datetime asc, created_at asc
      `;

      return json({ ok: true, customer, entries });
    } catch (error: any) {
      return json({ ok: false, error: error?.message || 'Failed to load customer statement' }, 500);
    }
  }

  return json({ ok: false, error: 'API route not found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
