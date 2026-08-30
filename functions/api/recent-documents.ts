import { getBusinessId, getSql, json } from '../_lib/db';

export async function onRequestGet(context: any) {
  try {
    const sql = getSql(context.env || {});
    const businessId = getBusinessId(context.env || {});
    const rows = await sql`
      select id, transaction_no, transaction_type, transaction_datetime,
             currency, party_name, total_amount, paid_amount, remaining_amount,
             transaction_status, notes
      from ibex_had_transactions
      where business_id = ${businessId}
      order by transaction_datetime desc, created_at desc
      limit 30
    `;

    return json({ ok: true, documents: rows });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Failed to load documents' }, 500);
  }
}
