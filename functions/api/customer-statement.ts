import { getBusinessId, getSql, json } from '../_lib/db';

export async function onRequestGet(context: any) {
  try {
    const sql = getSql(context.env || {});
    const businessId = getBusinessId(context.env || {});
    const url = new URL(context.request.url);
    const customerId = url.searchParams.get('customer_id');
    const query = (url.searchParams.get('q') || '').trim();

    let customerRows: any[] = [];

    if (customerId) {
      customerRows = await sql`
        select id, display_name, phone, is_active
        from ibex_had_customers
        where business_id = ${businessId} and id = ${customerId}
        limit 1
      `;
    } else if (query) {
      const like = `%${query}%`;
      customerRows = await sql`
        select id, display_name, phone, is_active
        from ibex_had_customers
        where business_id = ${businessId}
          and (display_name ilike ${like} or coalesce(phone, '') ilike ${like})
        order by is_active desc, display_name asc
        limit 10
      `;
    } else {
      return json({ ok: false, error: 'customer_id or q is required' }, 400);
    }

    if (!customerRows.length) {
      return json({ ok: false, error: 'Customer not found' }, 404);
    }

    if (!customerId && customerRows.length > 1) {
      return json({ ok: true, matches: customerRows, requires_selection: true });
    }

    const customer = customerRows[0];
    const ledger = await sql`
      select
        id,
        entry_datetime,
        entry_type,
        currency,
        amount,
        balance_after,
        description,
        notes,
        transaction_id,
        payment_id
      from ibex_had_customer_ledger
      where business_id = ${businessId}
        and customer_id = ${customer.id}
      order by entry_datetime asc, created_at asc
    `;

    const balances = await sql`
      select distinct on (currency)
        currency,
        balance_after,
        entry_datetime
      from ibex_had_customer_ledger
      where business_id = ${businessId}
        and customer_id = ${customer.id}
        and balance_after is not null
      order by currency, entry_datetime desc, created_at desc
    `;

    return json({
      ok: true,
      customer,
      balances,
      ledger
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Failed to load customer statement' }, 500);
  }
}
