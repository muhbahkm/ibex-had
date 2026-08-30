import { getBusinessId, getSql, json } from '../_lib/db';

export async function onRequestGet(context: any) {
  try {
    const sql = getSql(context.env || {});
    const businessId = getBusinessId(context.env || {});
    const url = new URL(context.request.url);
    const requestedLimit = Number(url.searchParams.get('limit') || 30);
    const limit = Math.min(Math.max(requestedLimit, 1), 100);

    const rows = await sql`
      select
        id,
        transaction_no,
        transaction_type,
        transaction_status,
        transaction_datetime,
        currency,
        customer_id,
        party_name,
        party_phone,
        payment_status,
        subtotal_amount,
        discount_amount,
        total_amount,
        paid_amount,
        remaining_amount,
        estimated_profit,
        notes,
        created_by,
        created_at
      from ibex_had_transactions
      where business_id = ${businessId}
      order by transaction_datetime desc, created_at desc
      limit ${limit}
    `;

    return json({ ok: true, documents: rows });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Failed to load documents' }, 500);
  }
}
