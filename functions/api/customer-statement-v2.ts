import { getBusinessId, getSql, json } from '../_lib/db';

export async function onRequestGet(context: any) {
  try {
    const sql = getSql(context.env || {});
    const businessId = getBusinessId(context.env || {});
    const url = new URL(context.request.url);
    const query = (url.searchParams.get('q') || '').trim();

    if (!query) return json({ ok: false, error: 'Missing q' }, 400);

    const customers = await sql`
      select id, display_name, phone, is_active
      from ibex_had_customers
      where business_id = ${businessId}
        and (display_name ilike ${'%' + query + '%'} or coalesce(phone,'') ilike ${'%' + query + '%'})
      order by is_active desc, display_name asc
      limit 10
    `;

    if (!customers.length) return json({ ok: true, matches: [], statement: [] });

    const selected = customers[0];
    const statement = await sql`
      select entry_datetime, entry_type, currency, amount, balance_after, description, notes
      from ibex_had_customer_ledger
      where business_id = ${businessId} and customer_id = ${selected.id}
      order by entry_datetime asc, created_at asc
    `;

    return json({ ok: true, customer: selected, matches: customers, statement });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Customer statement failed' }, 500);
  }
}
