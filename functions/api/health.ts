import { getBusinessId, getSql, json } from '../_lib/db';

export async function onRequestGet(context: any) {
  try {
    const sql = getSql(context.env || {});
    const businessId = getBusinessId(context.env || {});
    const rows = await sql`
      select id, business_name, business_code
      from ibex_had_businesses
      where id = ${businessId}
      limit 1
    `;

    if (!rows.length) {
      return json({ ok: false, error: 'Business not found' }, 404);
    }

    return json({
      ok: true,
      database: 'connected',
      business: rows[0]
    });
  } catch (error: any) {
    return json({
      ok: false,
      error: error?.message || 'Database connection failed'
    }, 500);
  }
}
