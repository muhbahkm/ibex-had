import { getBusinessId, getSql, json } from '../_lib/db';

export async function onRequestGet(context: any) {
  try {
    const sql = getSql(context.env || {});
    const businessId = getBusinessId(context.env || {});
    const url = new URL(context.request.url);
    const id = (url.searchParams.get('id') || '').trim();
    if (!id) return json({ ok: false, error: 'Missing document id' }, 400);

    const rows = await sql`
      select id, transaction_no, transaction_type, transaction_datetime, currency,
             party_name, party_phone, subtotal_amount, discount_amount, total_amount,
             paid_amount, remaining_amount, notes, transaction_status
      from ibex_had_transactions
      where business_id = ${businessId} and id = ${id}
      limit 1
    `;
    if (!rows.length) return json({ ok: false, error: 'Document not found' }, 404);

    const items = await sql`
      select product_name_snapshot, unit_name_snapshot, quantity, unit_price, line_total, notes
      from ibex_had_transaction_items
      where business_id = ${businessId} and transaction_id = ${id}
      order by created_at asc
    `;

    return json({ ok: true, document: rows[0], items });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Failed to load printable document' }, 500);
  }
}
