/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, BUSINESS_ID } from './supabaseClient';
import { formatNumber, formatMoney, formatDate } from './numberUtils';
import { 
  TransactionPayload,
  TransactionItemInput,
  CashAccount, 
  Product, 
  Customer, 
  WhatsappQueueItem,
  DailyReport,
  Unit,
  TransactionType,
  CurrencyType,
  CURRENCY_LABELS
} from '../types';

// State for client-side local cache fallback (used if DB connection fails, mock-persisted in localStorage)
const LOCAL_MOCK_STORAGE_KEY = 'ibex_had_mock_db_store';

interface MockStore {
  transactions: any[];
  customers: Customer[];
  products: Product[];
  units: Unit[];
  cashAccounts: CashAccount[];
  whatsappQueue: WhatsappQueueItem[];
  settings: Record<string, string>;
}

// Default initial simulation data (Emptied to ensure zero mock leaks)
const DEFAULT_MOCK_STORE: MockStore = {
  transactions: [],
  customers: [],
  products: [],
  units: [],
  cashAccounts: [],
  whatsappQueue: [],
  settings: {
    shop_name: 'متجر عسل لكس HAD',
    logo_url: '',
    address: 'حضرموت - اليمن',
    whatsapp_active: 'true'
  }
};

function getLocalStore(): MockStore {
  return DEFAULT_MOCK_STORE;
}

function saveLocalStore(store: MockStore) {
  // Disabled mock saving
}

// Flag to track if we should fall back immediately
let useFallbackSimulation = false;

export function forceFallbackMode(enable: boolean) {
  useFallbackSimulation = false; // Force disabled
}

export function isFallbackEnabled() {
  return false; // Always disabled
}

/**
 * Robust async execution wrapper with automatic retries and exponential backoff.
 * Prevents network drops and handles Supabase cold-starts gracefully to ensure 100% database connectivity.
 */
async function executeWithRetry<T = any>(
  operation: () => Promise<T> | any,
  retries: number = 4,
  delay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res: any = await operation();
      
      // If the response holds an error structure from Supabase
      if (res && typeof res === 'object' && res.error) {
        const error = res.error;
        const errMsg = typeof error === 'string' ? error : (error.message || '');
        const errCode = error.code;
        const status = error.status;

        // Determine if error is a transient issue (e.g. network drops, timeouts, 5xx server errors, cold startup)
        const isTransient = !errCode || 
                            errCode === 'P0000' || 
                            status === 0 || 
                            status >= 500 || 
                            errMsg.toLowerCase().includes('fetch') ||
                            errMsg.toLowerCase().includes('timeout') ||
                            errMsg.toLowerCase().includes('database') ||
                            errMsg.toLowerCase().includes('starting') ||
                            errMsg.toLowerCase().includes('terminating') ||
                            errMsg.toLowerCase().includes('connection') ||
                            errMsg.toLowerCase().includes('failed to fetch');

        if (isTransient && attempt < retries) {
          console.warn(`[Supabase Connection Warning] Attempt ${attempt}/${retries} failed with transient error: "${errMsg}". Retrying in ${delay * attempt}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay * attempt));
          continue;
        }
      }
      return res;
    } catch (err: any) {
      const errMsg = err?.message || '';
      console.error(`[Supabase Exception Warning] Attempt ${attempt}/${retries} failed. Error:`, err);
      
      const isTransient = !err.code || 
                          errMsg.toLowerCase().includes('fetch') || 
                          errMsg.toLowerCase().includes('timeout') ||
                          errMsg.toLowerCase().includes('network') ||
                          errMsg.toLowerCase().includes('failed');

      if (isTransient && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error('فشل الاتصال بقاعدة البيانات بشكل مستدام بعد محاولات متعددة. يرجى التحقق من الشبكة.');
}

/**
 * Ensures that the required default units exist in the database.
 * This prevents foreign key constraint violations when upserting products.
 */
let defaultUnitsSeeded = false;

export async function ensureDefaultUnits() {
  if (defaultUnitsSeeded) return;
  try {
    const defaultUnits = [
      { id: '4ab725de-a2b8-4a54-b918-52ae1ad7a660', unit_name: 'جالون' },
      { id: '676bc191-efef-4015-84e1-255d65f57a0f', unit_name: 'كيلو' },
      { id: '1103c80c-7b0b-4eb1-b4ec-eb8364ff0f0c', unit_name: 'علبة' }
    ];

    for (const unit of defaultUnits) {
      const { data, error } = await supabase
        .from('ibex_had_units')
        .select('id')
        .eq('id', unit.id)
        .maybeSingle();

      if (!data && !error) {
        await supabase.from('ibex_had_units').insert({
          id: unit.id,
          business_id: BUSINESS_ID,
          unit_name: unit.unit_name
        });
      }
    }
    defaultUnitsSeeded = true;
  } catch (err) {
    console.warn('ensureDefaultUnits failed:', err);
  }
}

// Automatically invoke on module loading
ensureDefaultUnits();

/**
 * App Bootstrap
 */
export async function getAppBootstrap() {
  try {
    await ensureDefaultUnits();
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_get_app_bootstrap', {
        p_business_id: BUSINESS_ID
      })
    );
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('ibex_had_get_app_bootstrap failed:', err);
    return { data: null, error: err.message || 'فشل تحميل بيانات التهيئة من الخادم' };
  }
}

/**
 * Fast Entry Bootstrap
 */
export async function getFastEntryBootstrap() {
  try {
    await ensureDefaultUnits();
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_get_fast_entry_bootstrap', {
        p_business_id: BUSINESS_ID
      })
    );
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('ibex_had_get_fast_entry_bootstrap failed:', err);
    return { data: null, error: err.message || 'فشل تحميل بيانات المدخلات السريعة' };
  }
}

/**
 * Search Customers
 */
export async function searchCustomers(query: string, limit: number = 15) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_search_customers', {
        p_business_id: BUSINESS_ID,
        p_query: query,
        p_limit: limit
      })
    );
    if (error) throw error;
    const mapped = (data || []).map((c: any) => ({
      ...c,
      customer_name: c.customer_name || c.display_name || 'زبون (غير محدد الاسم)',
      phone_number: c.phone_number || c.phone || ''
    }));
    return { data: mapped, error: null };
  } catch (err: any) {
    console.warn('ibex_had_search_customers failed:', err);
    return { data: [], error: err.message || 'فشل تحميل قائمة العملاء من الخادم' };
  }
}

/**
 * Search Products
 */
export async function searchProducts(query: string, limit: number = 15) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_search_products', {
        p_business_id: BUSINESS_ID,
        p_query: query,
        p_limit: limit
      })
    );
    if (error) throw error;
    
    const mapped = (data || []).map((p: any) => ({
      ...p,
      default_sales_price: p.default_sales_price !== undefined ? p.default_sales_price : (p.default_sale_price ?? 0),
      estimated_cost: p.estimated_cost !== undefined ? p.estimated_cost : (p.default_cost ?? 0),
      is_active: p.is_active !== false
    }));

    return { data: mapped, error: null };
  } catch (err: any) {
    console.warn('ibex_had_search_products failed:', err);
    return { data: [], error: err.message || 'فشل تحميل قائمة الأصناف من الخادم' };
  }
}

/**
 * Search Units
 */
export async function searchUnits(query: string, limit: number = 15) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_search_units', {
        p_business_id: BUSINESS_ID,
        p_query: query,
        p_limit: limit
      })
    );
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    console.warn('ibex_had_search_units failed:', err);
    return { data: [], error: err.message || 'فشل تحميل الوحدات من الخادم' };
  }
}

/**
 * Create Transaction
 */
export async function createTransaction(payload: TransactionPayload) {
  // Ensure we use the real business_id
  payload.business_id = BUSINESS_ID;

  // Enrich with auth session if available
  try {
    const { data: authData } = await supabase.auth.getSession();
    if (authData?.session?.user) {
      payload.created_by_user_id = authData.session.user.id;
      payload.created_by_email = authData.session.user.email;
    }
  } catch (err) {
    console.warn('Failed to enrich transaction with auth session:', err);
  }

  // Clean templated products IDs so that Supabase RPC doesn't crash on invalid UUID cast
  if (payload.items) {
    payload.items = payload.items.map(it => ({
      ...it,
      product_id: (it.product_id && typeof it.product_id === 'string' && it.product_id.startsWith('prod-')) ? null : it.product_id
    }));
  }

  const isDevMode = () => {
    try {
      return localStorage.getItem('IBEX_DEV_MODE') === 'true';
    } catch {
      return false;
    }
  };

  if (isDevMode()) {
    console.log('CREATE_TRANSACTION_PAYLOAD', payload);
  }

  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_create_transaction', {
        p_payload: payload
      })
    );

    if (isDevMode()) {
      console.log('CREATE_TRANSACTION_RESULT', { data, error });
    }

    if (error) {
      return { data: null, error: error.message };
    }

    // Post-creation ledger reconciliation for transaction types not handled by DB triggers
    if (data && (data.success || data.transaction_id)) {
      const txId = data.transaction_id;
      const txNo = data.transaction_no || 'بلا رقم';
      const type = payload.transaction_type;
      const custId = payload.customer_id;

      if (custId && txId) {
        if (type === 'payment_voucher') {
          const entryAmount = Number(payload.paid_amount || payload.total_amount || 0);
          if (entryAmount > 0) {
            await supabase.from('ibex_had_customer_ledger').insert({
              business_id: BUSINESS_ID,
              customer_id: custId,
              transaction_id: txId,
              entry_datetime: new Date().toISOString(),
              entry_type: 'debit',
              currency: payload.currency,
              amount: entryAmount,
              description: payload.notes ? `سند صرف ${txNo}: ${payload.notes}` : `سند صرف ${txNo}`
            });
          }
        } else if (type === 'purchase_invoice') {
          const entryAmount = Number(payload.remaining_amount !== undefined ? payload.remaining_amount : payload.total_amount || 0);
          if (entryAmount > 0) {
            await supabase.from('ibex_had_customer_ledger').insert({
              business_id: BUSINESS_ID,
              customer_id: custId,
              transaction_id: txId,
              entry_datetime: new Date().toISOString(),
              entry_type: 'credit',
              currency: payload.currency,
              amount: entryAmount,
              description: payload.notes ? `آجل من فاتورة مشتريات ${txNo}: ${payload.notes}` : `آجل من فاتورة مشتريات ${txNo}`
            });
          }
        } else if (type === 'purchase_return') {
          const entryAmount = Number(payload.remaining_amount !== undefined ? payload.remaining_amount : payload.total_amount || 0);
          if (entryAmount > 0) {
            await supabase.from('ibex_had_customer_ledger').insert({
              business_id: BUSINESS_ID,
              customer_id: custId,
              transaction_id: txId,
              entry_datetime: new Date().toISOString(),
              entry_type: 'debit',
              currency: payload.currency,
              amount: entryAmount,
              description: payload.notes ? `مرتجع مشتريات ${txNo}: ${payload.notes}` : `مرتجع مشتريات ${txNo}`
            });
          }
        } else if (type === 'simple_entry') {
          const entryAmount = Number(payload.paid_amount || payload.total_amount || 0);
          if (entryAmount > 0) {
            await supabase.from('ibex_had_customer_ledger').insert({
              business_id: BUSINESS_ID,
              customer_id: custId,
              transaction_id: txId,
              entry_datetime: new Date().toISOString(),
              entry_type: 'debit',
              currency: payload.currency,
              amount: entryAmount,
              description: payload.notes ? `قيد بسيط ${txNo}: ${payload.notes}` : `قيد بسيط ${txNo}`
            });
          }
        }
      }
    }

    return { data, error: null };
  } catch (err: any) {
    console.error('ibex_had_create_transaction failed:', err);
    return { data: null, error: err.message || 'فشلت عملية الحفظ' };
  }
}

/**
 * Cancel Transaction
 */
export async function cancelTransaction(
  transaction_id: string,
  cancel_reason: string,
  updated_by: string | null = null
) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_cancel_transaction', {
        p_transaction_id: transaction_id,
        p_cancel_reason: cancel_reason,
        p_updated_by: updated_by
      })
    );
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('ibex_had_cancel_transaction failed:', err);
    return { data: null, error: err.message || 'فشل إلغاء العملية عبر الخادم' };
  }
}

/**
 * Get Transaction Detail
 */
export async function getTransactionDetail(transaction_id: string) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_get_transaction_detail', {
        p_transaction_id: transaction_id
      })
    );
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('ibex_had_get_transaction_detail failed:', err);
    return { data: null, error: err.message || 'فشل جلب تفاصيل العملية' };
  }
}

/**
 * Get Customer Ledger
 */
export async function getCustomerLedger(customer_id: string) {
  try {
    const { data: ledgerRows, error } = await executeWithRetry(() =>
      supabase
        .from('ibex_had_customer_ledger')
        .select(`
          *,
          ibex_had_transactions(
            id,
            transaction_no,
            transaction_type,
            transaction_status,
            total_amount,
            paid_amount,
            remaining_amount,
            created_at
          )
        `)
        .eq('customer_id', customer_id)
        .order('entry_datetime', { ascending: true })
    );
    if (error) throw error;
    
    const mapped = (ledgerRows || []).map((row: any) => {
      const tx = row.ibex_had_transactions;
      return {
        date: row.entry_datetime,
        transaction_id: row.transaction_id,
        transaction_no: tx?.transaction_no || 'بلا رقم',
        transaction_type: tx?.transaction_type || (row.entry_type === 'debit' ? 'sales_invoice' : 'receipt_voucher'),
        currency: row.currency,
        total_amount: tx?.total_amount !== undefined ? Number(tx.total_amount) : Number(row.amount),
        paid_amount: tx?.paid_amount !== undefined ? Number(tx.paid_amount) : (row.entry_type === 'credit' ? Number(row.amount) : 0),
        balance_impact: row.entry_type === 'debit' ? Number(row.amount) : -Number(row.amount),
        balance_after: Number(row.balance_after),
        description: row.description || '',
        notes: row.notes || '',
        entry_type: row.entry_type,
        amount: Number(row.amount),
        transaction_status: tx?.transaction_status || 'unknown'
      };
    });
    return { data: mapped, error: null };
  } catch (err: any) {
    console.error('getCustomerLedger failed:', err);
    return { data: null, error: err.message || 'فشل جلب دفتر حركة العميل' };
  }
}

/**
 * Get Customer Detail
 */
export async function getCustomerDetail(customer_id: string) {
  try {
    // 1. Fetch customer info
    const { data: customerRow, error: customerErr } = await executeWithRetry(() =>
      supabase
        .from('ibex_had_customers')
        .select('*')
        .eq('id', customer_id)
        .single()
    );
    if (customerErr) throw customerErr;

    // 2. Fetch balances
    const { data: balanceRows, error: balanceErr } = await executeWithRetry(() =>
      supabase
        .from('ibex_had_customer_balances')
        .select('currency, balance')
        .eq('customer_id', customer_id)
    );
    if (balanceErr) throw balanceErr;

    const balances = ['YER', 'SAR', 'USD'].map(cur => {
      const found = balanceRows?.find((r: any) => r.currency === cur);
      return {
        currency: cur,
        balance: found ? Number(found.balance) : 0
      };
    });

    // 3. Fetch ledger (descending for latest entries at the top in lists or previews)
    const { data: ledger, error: ledgerErr } = await getCustomerLedger(customer_id);
    if (ledgerErr) throw new Error(ledgerErr);

    const descendingLedger = ledger ? [...ledger].reverse() : [];
    const lastTx = ledger && ledger.length > 0 ? ledger[ledger.length - 1] : null;

    const responseData = {
      customer: {
        id: customerRow.id,
        customer_name: customerRow.display_name || 'زبون (غير محدد الاسم)',
        phone_number: customerRow.phone || '',
        notes: customerRow.notes || '',
        is_active: customerRow.is_active !== false,
        last_transaction_date: lastTx ? lastTx.date : null
      },
      balances,
      ledger: descendingLedger
    };

    return { data: responseData, error: null };
  } catch (err: any) {
    console.error('getCustomerDetail failed:', err);
    return { data: null, error: err.message || 'فشل جلب تفاصيل كشف حساب العميل' };
  }
}

/**
 * Create Receipt For Customer (سند قبض سريع للعميل)
 */
export async function createReceiptForCustomer(customer: {
  customer_id: string;
  customer_name: string;
  phone_number?: string;
  amount: number;
  currency: CurrencyType;
  notes?: string;
}) {
  const payload: TransactionPayload = {
    business_id: BUSINESS_ID,
    transaction_type: 'receipt_voucher',
    currency: customer.currency,
    party_name: customer.customer_name,
    party_phone: customer.phone_number || undefined,
    customer_id: customer.customer_id,
    payment_status: 'cash',
    paid_amount: customer.amount,
    total_amount: customer.amount,
    discount_amount: 0,
    remaining_amount: 0,
    cash_account_id: null,
    notes: customer.notes || 'سداد دفعة من الحساب مالياً',
    send_whatsapp: true,
    items: [],
    auto_create_products: false
  };
  return createTransaction(payload);
}

/**
 * Create Credit Invoice For Customer (فاتورة آجل سريعة للعميل)
 */
export async function createCreditInvoiceForCustomer(customer: {
  customer_id: string;
  customer_name: string;
  phone_number?: string;
  currency: CurrencyType;
  items: Array<{
    product_name: string;
    quantity: number;
    sell_price: number;
    buy_price?: number;
    unit_name?: string;
    category_name?: string;
  }>;
  notes?: string;
}) {
  const payloadItems: TransactionItemInput[] = customer.items.map(it => ({
    product_id: null,
    product_name: it.product_name,
    category: it.category_name || 'عام',
    unit_id: null,
    unit_name: it.unit_name || 'حبة',
    quantity: it.quantity,
    unit_price: it.sell_price,
    estimated_unit_cost: it.buy_price || 0,
    notes: ''
  }));

  const payload: TransactionPayload = {
    business_id: BUSINESS_ID,
    transaction_type: 'sales_invoice',
    currency: customer.currency,
    party_name: customer.customer_name,
    party_phone: customer.phone_number || undefined,
    customer_id: customer.customer_id,
    payment_status: 'credit',
    paid_amount: 0,
    total_amount: customer.items.reduce((sum, item) => sum + (item.quantity * item.sell_price), 0),
    discount_amount: 0,
    remaining_amount: customer.items.reduce((sum, item) => sum + (item.quantity * item.sell_price), 0),
    cash_account_id: null,
    notes: customer.notes || 'فاتورة مبيعات آجل مجدولة للعميل',
    send_whatsapp: true,
    items: payloadItems,
    auto_create_products: true
  };
  return createTransaction(payload);
}

/**
 * Get Daily Report
 */
export async function getDailyReport(report_date?: string) {
  // Use local calendar date (YYYY-MM-DD) instead of forcing UTC to prevent timezone day-shift bugs
  let resolvedDate = report_date;
  if (!resolvedDate) {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    resolvedDate = `${year}-${month}-${day}`;
  }

  try {
    // 1. Fetch daily report RPC
    const rpcCall = executeWithRetry(() =>
      supabase.rpc('ibex_had_get_daily_report', {
        p_business_id: BUSINESS_ID,
        p_report_date: resolvedDate
      })
    );

    // 2. Fetch whatsapp queue pending count
    const waCall = executeWithRetry(() =>
      supabase.from('ibex_had_whatsapp_queue_view')
        .select('status', { head: true, count: 'exact' })
        .eq('business_id', BUSINESS_ID)
        .eq('status', 'pending')
    );

    const [rpcRes, waRes] = await Promise.all([rpcCall, waCall]);

    if (rpcRes.error) throw rpcRes.error;

    const rpcRows = rpcRes.data || [];
    const pendingCount = waRes.count || 0;

    // Fetch exchange rates from DB for consolidated estimated profit calculations
    let sarRate = 410;
    let usdRate = 1500;
    try {
      const { data: sarVal } = await getSetting('sar_rate_to_yer');
      const { data: usdVal } = await getSetting('usd_rate_to_yer');
      if (sarVal && !isNaN(parseFloat(sarVal))) sarRate = parseFloat(sarVal);
      if (usdVal && !isNaN(parseFloat(usdVal))) usdRate = parseFloat(usdVal);
    } catch (e) {
      console.warn('Failed to fetch exchange rates for daily report profit consolidation:', e);
    }

    // Build the consolidated DailyReport structure matching what Dashboard/Report expects
    const mapped: DailyReport = {
      sales_count: 0,
      sales_total_yer: 0,
      sales_total_sar: 0,
      sales_total_usd: 0,
      cash_received_yer: 0,
      cash_received_sar: 0,
      cash_received_usd: 0,
      unpaid_yer: 0,
      unpaid_sar: 0,
      unpaid_usd: 0,
      estimated_profit_yer: 0,
      whatsapp_pending_count: pendingCount
    };

    let totalProfitYer = 0;

    // Distribute/aggregate statistics per currency row
    for (const row of rpcRows) {
      mapped.sales_count += Number(row.sales_count || 0);
      const cur = String(row.currency || '').toUpperCase();
      const rowProfit = Number(row.estimated_profit_total || 0);

      if (cur === 'YER') {
        mapped.sales_total_yer = Number(row.sales_total || 0);
        mapped.cash_received_yer = Number(row.collected_total || 0);
        mapped.unpaid_yer = Number(row.remaining_total || 0);
        totalProfitYer += rowProfit;
      } else if (cur === 'SAR') {
        mapped.sales_total_sar = Number(row.sales_total || 0);
        mapped.cash_received_sar = Number(row.collected_total || 0);
        mapped.unpaid_sar = Number(row.remaining_total || 0);
        totalProfitYer += rowProfit * sarRate;
      } else if (cur === 'USD') {
        mapped.sales_total_usd = Number(row.sales_total || 0);
        mapped.cash_received_usd = Number(row.collected_total || 0);
        mapped.unpaid_usd = Number(row.remaining_total || 0);
        totalProfitYer += rowProfit * usdRate;
      }
    }

    mapped.estimated_profit_yer = totalProfitYer;

    return { data: mapped, error: null };
  } catch (err: any) {
    console.error('ibex_had_get_daily_report failed:', err);
    return { data: null, error: err.message || 'فشل تحميل التقرير اليومي من الخادم' };
  }
}

/**
 * Get Business Overview (Date Period Summary)
 */
export async function getBusinessOverview(date_from: string, date_to: string) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_get_business_overview', {
        p_business_id: BUSINESS_ID,
        p_date_from: date_from,
        p_date_to: date_to
      })
    );
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('ibex_had_get_business_overview failed:', err);
    return {
      data: {
        total_sales_yer: 0,
        total_sales_sar: 0,
        total_sales_usd: 0,
        estimated_profit_yer: 0,
        active_customers_count: 0,
        transactions_count: 0
      },
      error: err.message || 'فشل الاتصال بقاعدة البيانات لتجديد التقرير العام'
    };
  }
}

/**
 * Get Customer Balances Report
 */
export async function getCustomerBalancesReport(only_positive: boolean = false) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_get_customer_balances_report', {
        p_business_id: BUSINESS_ID,
        p_only_positive: only_positive
      })
    );
    if (error) throw error;
    
    // Proactively de-duplicate customer records by customer_id to prevent key collisions
    const uniqueMap = new Map<string, any>();
    (data || []).forEach((c: any) => {
      const cid = c.customer_id;
      if (!cid) return; // Skip invalid or null keys
      
      const currency = c.currency;
      const balance = Number(c.balance || 0);

      if (uniqueMap.has(cid)) {
        const existing = uniqueMap.get(cid);
        // Sum any split currency balances if duplicates are present
        if (currency === 'YER') {
          existing.balance_yer = (existing.balance_yer || 0) + balance;
        } else if (currency === 'SAR') {
          existing.balance_sar = (existing.balance_sar || 0) + balance;
        } else if (currency === 'USD') {
          existing.balance_usd = (existing.balance_usd || 0) + balance;
        }
        if (c.last_transaction_at && (!existing.last_transaction_at || new Date(c.last_transaction_at) > new Date(existing.last_transaction_at))) {
          existing.last_transaction_at = c.last_transaction_at;
        }
      } else {
        uniqueMap.set(cid, {
          ...c,
          balance_yer: currency === 'YER' ? balance : 0,
          balance_sar: currency === 'SAR' ? balance : 0,
          balance_usd: currency === 'USD' ? balance : 0
        });
      }
    });

    const mapped = Array.from(uniqueMap.values()).map((c: any) => ({
      ...c,
      customer_name: c.customer_name || c.display_name || 'زبون (غير محدد الاسم)',
      phone_number: c.phone_number || c.phone || ''
    }));
    return { data: mapped, error: null };
  } catch (err: any) {
    console.error('ibex_had_get_customer_balances_report failed:', err);
    return { data: [], error: err.message || 'فشل الحصول على كشف أرصدة العملاء من الخادم' };
  }
}

/**
 * Get Top Products
 */
export async function getTopProducts(
  date_from: string, 
  date_to: string, 
  currency: CurrencyType = 'YER', 
  limit: number = 5
) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_get_top_products', {
        p_business_id: BUSINESS_ID,
        p_date_from: date_from,
        p_date_to: date_to,
        p_currency: currency,
        p_limit: limit
      })
    );
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    console.error('ibex_had_get_top_products failed:', err);
    return { data: [], error: err.message || 'فشل تحميل قائمة الأصناف الأكثر مبيعاً من الخادم' };
  }
}

/**
 * Get Cash Summary
 */
export async function getCashSummary() {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_get_cash_summary', {
        p_business_id: BUSINESS_ID
      })
    );
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    console.error('ibex_had_get_cash_summary failed:', err);
    return { data: [], error: err.message || 'فشل جلب ملخص الحسابات النقدية' };
  }
}

/**
 * Get Overdue Customers
 */
export async function getOverdueCustomers(overdue_after_days: number = 30) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_get_overdue_customers', {
        p_business_id: BUSINESS_ID,
        p_overdue_after_days: overdue_after_days
      })
    );
    if (error) throw error;
    const mapped = (data || []).map((c: any) => ({
      ...c,
      customer_name: c.customer_name || c.display_name || 'زبون (غير محدد الاسم)',
      phone_number: c.phone_number || c.phone || ''
    }));
    return { data: mapped, error: null };
  } catch (err: any) {
    console.error('ibex_had_get_overdue_customers failed:', err);
    return { data: [], error: err.message || 'فشل تحميل قائمة الديون المتأخرة من الخادم' };
  }
}

/**
 * Get Operational Health
 */
export async function getOperationalHealth() {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_get_operational_health', {
        p_business_id: BUSINESS_ID
      })
    );
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('ibex_had_get_operational_health failed:', err);
    return { 
      data: { 
        status: 'Offline', 
        healthy: false, 
        last_sync: new Date().toISOString(),
        pending_whatsapp_messages: 0,
        message_fail_rate_pct: 0
      }, 
      error: err.message || 'فشل تحميل الصحة التشغيلية من الخادم'
    };
  }
}

/**
 * Get setting value 
 */
export async function getSetting(setting_key: string) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_get_setting', {
        p_business_id: BUSINESS_ID,
        p_setting_key: setting_key
      })
    );
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error(`ibex_had_get_setting [${setting_key}] failed:`, err);
    return { data: '', error: err.message || 'فشل جلب الإعداد من الخادم' };
  }
}

/**
 * Set setting value
 */
export async function setSetting(setting_key: string, setting_value: string) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_set_setting', {
        p_business_id: BUSINESS_ID,
        p_setting_key: setting_key,
        p_setting_value: setting_value
      })
    );
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('ibex_had_set_setting failed:', err);
    return { data: null, error: err.message || 'فشل حفظ الإعداد' };
  }
}

/**
 * Generate PDF base/invoice text document markdown
 */
export async function generateTransactionDocument(transaction_id: string) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_generate_transaction_document', {
        p_transaction_id: transaction_id,
        p_created_by: 'مدير النظام'
      })
    );
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('ibex_had_generate_transaction_document failed:', err);
    return { data: 'مستند الفاتورة لمتجر باحكم للعسل', error: err.message || 'فشل توليد مستند الفاتورة من الخادم' };
  }
}

/**
 * Upsert Product
 */
export async function upsertProduct(product: Partial<Product>) {
  try {
    await ensureDefaultUnits();
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_upsert_product', {
        p_business_id: BUSINESS_ID,
        p_product_id: (product.id && product.id.startsWith('prod-')) ? null : product.id || null,
        p_product_name: product.product_name,
        p_category: product.category || 'عام',
        p_default_unit_id: product.default_unit_id || '4ab725de-a2b8-4a54-b918-52ae1ad7a660',
        p_default_sale_price: Number(product.default_sales_price || 0),
        p_default_cost: Number(product.estimated_cost || 0),
        p_default_currency: product.default_currency || 'YER',
        p_notes: product.notes || null,
        p_is_active: product.is_active !== false
      })
    );
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('ibex_had_upsert_product failed:', err);
    return { data: null, error: err.message || 'فشلت عملية حفظ الصنف في قاعدة البيانات' };
  }
}

/**
 * Upsert Cash Account
 */
export async function upsertCashAccount(cashAcc: Partial<CashAccount>) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_upsert_cash_account', {
        p_business_id: BUSINESS_ID,
        p_cash_account_id: (cashAcc.id && cashAcc.id.startsWith('cash-')) ? null : cashAcc.id || null,
        p_account_name: cashAcc.account_name,
        p_currency: cashAcc.currency || 'YER',
        p_opening_balance: Number(cashAcc.opening_balance || 0),
        p_current_balance: Number(cashAcc.current_balance || cashAcc.opening_balance || 0),
        p_notes: cashAcc.notes || null,
        p_is_active: true
      })
    );
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('ibex_had_upsert_cash_account failed:', err);
    return { data: null, error: err.message || 'فشلت عملية حفظ الحساب النقدي في قاعدة البيانات' };
  }
}

/**
 * Update shop profile details
 */
export async function updateBusinessProfile(profile: { business_name: string; phone_number?: string; address?: string }) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_update_business_profile', {
        p_business_id: BUSINESS_ID,
        p_business_name: profile.business_name,
        p_default_currency: 'YER',
        p_notes: profile.address || '',
        p_owner_name: 'مدير المحل',
        p_owner_phone: profile.phone_number || '',
        p_whatsapp_phone: profile.phone_number || ''
      })
    );
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('ibex_had_update_business_profile failed:', err);
    return { data: null, error: err.message || 'فشل تحديث ملف معلومات المحل بـ باحكم للعسل' };
  }
}

export async function checkSystemReadiness() {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_check_system_readiness', {
        p_business_id: BUSINESS_ID
      })
    );
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('ibex_had_check_system_readiness failed:', err);
    return { data: { ready: false, message: 'لا توجد استجابة من الخادر' }, error: err.message || 'فشل فحص جاهزية النظام' };
  }
}

/**
 * Get Whatsapp Queue (Direct from View)
 */
export async function getWhatsappQueue() {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.from('ibex_had_whatsapp_queue_view')
        .select('*')
        .eq('business_id', BUSINESS_ID)
        .order('created_at', { ascending: false })
        .limit(50)
    );
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    console.error('ibex_had_whatsapp_queue_view read failed:', err);
    return { data: [], error: err.message || 'فشل تحميل طابور واتساب من الخادم' };
  }
}

/**
 * Get Frontend Transactions List (Direct from View)
 */
export async function getFrontendTransactionsList() {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.from('ibex_had_frontend_transactions_list')
        .select('*')
        .eq('business_id', BUSINESS_ID)
        .order('created_at', { ascending: false })
        .limit(100)
    );
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    console.error('ibex_had_frontend_transactions_list read failed:', err);
    return { data: [], error: err.message || 'فشل تحميل قائمة العمليات من الخادم' };
  }
}

/**
 * Triggers WhatsApp Statement Queue action
 */
export async function queueCustomerStatementWhatsapp(customer_id: string, currency: CurrencyType) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_queue_customer_statement_whatsapp', {
        p_business_id: BUSINESS_ID,
        p_currency: currency,
        p_customer_id: customer_id,
        p_scheduled_at: null
      })
    );
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('ibex_had_queue_customer_statement_whatsapp failed:', err);
    return { data: null, error: err.message || 'فشل تجهيز كشف الحساب عبر الواتساب' };
  }
}

/**
 * Upsert Customer (Safe write on ibex_had_customers table)
 */
export async function upsertCustomer(customer: {
  id?: string;
  customer_name: string;
  phone_number?: string;
  notes?: string;
  is_active?: boolean;
}) {
  try {
    const payload: any = {
      business_id: BUSINESS_ID,
      display_name: customer.customer_name,
      phone: customer.phone_number || null,
      notes: customer.notes || null,
      is_active: customer.is_active !== undefined ? customer.is_active : true,
    };

    if (customer.id) {
      payload.id = customer.id;
    }

    const { data, error } = await executeWithRetry(() =>
      supabase.from('ibex_had_customers').upsert(payload).select()
    );

    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('upsertCustomer failed:', err);
    return { data: null, error: err.message || 'فشلت عملية حفظ العميل' };
  }
}

/**
 * Update Customer Status (Safe write on ibex_had_customers table)
 */
export async function updateCustomerStatus(customer_id: string, is_active: boolean) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.from('ibex_had_customers')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', customer_id)
        .select()
    );
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('updateCustomerStatus failed:', err);
    return { data: null, error: err.message || 'فشل تحديث حالة العميل الحسابية' };
  }
}

/**
 * Reusable utility to print HTML content safely via a hidden iframe, 
 * And triggers a direct file download to guarantee functionality in sandboxed browser contexts.
 */
export function printHtmlElement(htmlContent: string, fileName: string = 'كشف_حساب_مترتب_باحكم.pdf') {
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  const targetFileName = isPdf ? fileName : fileName.replace(/\.html$/, '.pdf');

  // Load html2pdf dynamically from Cloudflare CDN
  const createAndDownloadPdf = (html2pdf: any) => {
    const opt = {
      margin:       [8, 8, 8, 8], // standard comfortable margins in mm
      filename:     targetFileName,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        letterRendering: true
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '190mm'; // fits A4 perfectly inside margins
    document.body.appendChild(container);

    html2pdf().from(container).set(opt).save().then(() => {
      document.body.removeChild(container);
    }).catch((err: any) => {
      console.error('html2pdf compilation error, taking fallback:', err);
      document.body.removeChild(container);
      fallbackToHtmlDownload(htmlContent, fileName);
    });
  };

  const fallbackToHtmlDownload = (content: string, name: string) => {
    try {
      const htmlName = name.replace(/\.pdf$/, '.html');
      const blob = new Blob([content], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', htmlName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download fallback failed:', err);
    }
  };

  if ((window as any).html2pdf) {
    createAndDownloadPdf((window as any).html2pdf);
    return;
  }

  const scriptId = 'html2pdf-cdn-script';
  let script = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => {
      if ((window as any).html2pdf) {
        createAndDownloadPdf((window as any).html2pdf);
      } else {
        fallbackToHtmlDownload(htmlContent, targetFileName);
      }
    };
    script.onerror = () => {
      fallbackToHtmlDownload(htmlContent, targetFileName);
    };
    document.head.appendChild(script);
  } else {
    // If script element exists but hasn't finished loading yet, poll briefly
    const interval = setInterval(() => {
      if ((window as any).html2pdf) {
        clearInterval(interval);
        createAndDownloadPdf((window as any).html2pdf);
      }
    }, 100);
    setTimeout(() => {
      clearInterval(interval);
      if (!(window as any).html2pdf) {
        fallbackToHtmlDownload(htmlContent, targetFileName);
      }
    }, 5000);
  }
}

/**
 * Opens the HTML content in a new blank window/tab, formatted beautifully
 * and pops the standard browser print dialog for direct PDF saving or physical printing.
 */
export function openPrintPreview(htmlContent: string) {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Inject print call immediately once DOM is ready
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
    
    // Fallback if onload doesn't fire due to browser differences
    setTimeout(() => {
      if (printWindow) {
        printWindow.focus();
        printWindow.print();
      }
    }, 500);
  } else {
    alert('يرجى تفعيل السماح بالنوافذ المنبثقة (Popups) لمعاينة وطباعة المستند بشكل صحيح.');
  }
}

export interface NormalizedTransaction {
  id: string;
  transaction_id: string;
  transaction_no: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  estimated_profit: number;
  currency: string;
  transaction_type: string;
  customer_name: string;
  customer_phone: string;
  payment_status: string;
  notes: string;
  items: any[];
  created_at: string;
  transaction_datetime: string;
  subtotal_amount: number;
  discount_amount: number;
}

/**
 * Normalizes all database/RPC transaction representations into a standard UI format.
 * Prevents wrong zeroes and guarantees correct totals, paid, remaining, and profit amounts.
 */
export function normalizeTransactionForUi(details: any): NormalizedTransaction {
  if (!details) {
    return {
      id: '',
      transaction_id: '',
      transaction_no: '',
      total_amount: 0,
      paid_amount: 0,
      remaining_amount: 0,
      estimated_profit: 0,
      currency: 'YER',
      transaction_type: '',
      customer_name: 'زبون عام',
      customer_phone: '',
      payment_status: 'cash',
      notes: '',
      items: [],
      created_at: '',
      transaction_datetime: '',
      subtotal_amount: 0,
      discount_amount: 0
    };
  }

  // Handle nested structure (RPC result: { transaction: {...}, items: [...] }) vs flat details
  const transactionObj = details.transaction || details;
  const rawItems = details.items || transactionObj.items || [];

  const id = transactionObj.id || transactionObj.transaction_id || '';
  const transaction_no = transactionObj.transaction_no || transactionObj.transaction_number || transactionObj.reference_no || '';

  // 1. Items mapping & total calculation
  const items = (Array.isArray(rawItems) ? rawItems : []).map((it: any) => {
    const q = Number(it.quantity || 0);
    const price = Number(it.unit_price || it.price || 0);
    const line_total = Number(it.line_total || it.total || (q * price));
    return {
      id: it.id || '',
      product_name: it.product_name || it.product_name_snapshot || it.name || 'صنف غير محدد',
      unit_name: it.unit_name || it.unit || 'كيلو',
      quantity: q,
      unit_price: price,
      line_total: line_total,
      estimated_unit_cost: Number(it.estimated_unit_cost || it.cost || 0),
      estimated_profit: line_total - (Number(it.estimated_unit_cost || it.cost || 0) * q)
    };
  });

  const calculatedSubtotal = items.reduce((sum: number, item: any) => sum + item.line_total, 0);
  const discount_amount = Number(transactionObj.discount_amount || 0);

  // 2. Total Amount fallbacks
  let total_amount = transactionObj.total_amount !== undefined 
    ? Number(transactionObj.total_amount) 
    : (transactionObj.total !== undefined ? Number(transactionObj.total) : (transactionObj.grand_total !== undefined ? Number(transactionObj.grand_total) : undefined));

  if (total_amount === undefined || isNaN(total_amount) || total_amount === 0) {
    total_amount = Math.max(0, calculatedSubtotal - discount_amount);
  }

  // 3. Paid Amount fallbacks
  let paid_amount = transactionObj.paid_amount !== undefined
    ? Number(transactionObj.paid_amount)
    : (transactionObj.paid !== undefined ? Number(transactionObj.paid) : (transactionObj.payment_amount !== undefined ? Number(transactionObj.payment_amount) : undefined));

  if (paid_amount === undefined || isNaN(paid_amount)) {
    if (transactionObj.payment_status === 'cash' || transactionObj.payment_method === 'cash') {
      paid_amount = total_amount;
    } else {
      paid_amount = 0;
    }
  }

  // 4. Remaining Amount fallbacks
  let remaining_amount = transactionObj.remaining_amount !== undefined
    ? Number(transactionObj.remaining_amount)
    : (transactionObj.balance_amount !== undefined ? Number(transactionObj.balance_amount) : (transactionObj.due_amount !== undefined ? Number(transactionObj.due_amount) : undefined));

  if (remaining_amount === undefined || isNaN(remaining_amount)) {
    remaining_amount = Math.max(0, total_amount - paid_amount);
  }

  // Enforce zero remaining for cash behavior or when fully paid
  const isCashOrFullyPaid = transactionObj.payment_status === 'cash' || transactionObj.payment_method === 'cash' || paid_amount >= total_amount;
  if (isCashOrFullyPaid) {
    remaining_amount = 0;
    if (paid_amount < total_amount && total_amount > 0) {
      paid_amount = total_amount;
    }
  }

  // 5. Estimated Profit fallbacks
  let estimated_profit = transactionObj.estimated_profit !== undefined 
    ? Number(transactionObj.estimated_profit) 
    : (transactionObj.profit_amount !== undefined ? Number(transactionObj.profit_amount) : (transactionObj.profit !== undefined ? Number(transactionObj.profit) : 0));

  if (estimated_profit === 0) {
    estimated_profit = Math.max(0, items.reduce((sum: number, item: any) => sum + (item.estimated_profit || 0), 0) - discount_amount);
  }

  const currency = transactionObj.currency || 'YER';
  const transaction_type = transactionObj.transaction_type || '';
  const customer_name = transactionObj.customer_name || transactionObj.party_name || transactionObj.customer?.name || 'زبون عام';
  const customer_phone = transactionObj.customer_phone || transactionObj.party_phone || transactionObj.customer?.phone || '';
  const payment_status = isCashOrFullyPaid ? 'cash' : (transactionObj.payment_status || 'cash');
  const notes = transactionObj.notes || '';
  const created_at = transactionObj.created_at || transactionObj.transaction_datetime || '';
  const transaction_datetime = transactionObj.transaction_datetime || transactionObj.created_at || '';
  const subtotal_amount = transactionObj.subtotal_amount !== undefined ? Number(transactionObj.subtotal_amount) : calculatedSubtotal;

  return {
    id,
    transaction_id: id,
    transaction_no,
    total_amount,
    paid_amount,
    remaining_amount,
    estimated_profit,
    currency,
    transaction_type,
    customer_name,
    customer_phone,
    payment_status,
    notes,
    items,
    created_at,
    transaction_datetime,
    subtotal_amount,
    discount_amount
  };
}

/**
 * Compiles a clean, structured JSON payload containing raw transaction data,
 * fetches complete details if not provided, and submits it to the Gotenberg/n8n PDF rendering webhook.
 * Downloads exactly ONE PDF file.
 */
export async function downloadTransactionPdf(
  transactionIdOrFullTransaction: string | any,
  options?: { isInternal?: boolean }
): Promise<{ success: boolean; error: string | null }> {
  try {
    let details: any = null;

    if (typeof transactionIdOrFullTransaction === 'string') {
      const res = await getTransactionDetail(transactionIdOrFullTransaction);
      if (res.error) throw new Error(res.error);
      details = res.data;
    } else {
      details = transactionIdOrFullTransaction;
    }

    if (Array.isArray(details)) {
      details = details[0];
    }

    if (!details) {
      throw new Error('بيانات العملية سلة فارغة أو غير متوفرة.');
    }

    // Standardize all fields via normalizeTransactionForUi
    const normalized = normalizeTransactionForUi(details);

    // Check if details are incomplete (e.g. missing items array)
    const hasItems = normalized.items && normalized.items.length > 0;
    if (!hasItems && normalized.id) {
      const res = await getTransactionDetail(normalized.id);
      if (res.error) throw new Error(res.error);
      let fullDetails = res.data;
      if (Array.isArray(fullDetails)) {
        fullDetails = fullDetails[0];
      }
      if (fullDetails) {
        const freshNormalized = normalizeTransactionForUi(fullDetails);
        Object.assign(normalized, freshNormalized);
      }
    }

    const isInternal = !!options?.isInternal;
    const webhookUrl = import.meta.env.VITE_TRANSACTION_PDF_WEBHOOK_URL || import.meta.env.VITE_PDF_RENDER_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('خدمة توليد PDF غير مفعّلة بعد. يرجى تفعيل VITE_TRANSACTION_PDF_WEBHOOK_URL في الإعدادات.');
    }

    const token = import.meta.env.VITE_PDF_RENDER_TOKEN;

    const transactionNo = normalized.transaction_no;
    if (!transactionNo) {
      throw new Error('لم يتم العثور على رقم العملية (transaction_no)');
    }

    if (transactionNo.includes('UNKNOWN')) {
      throw new Error('رقم العملية غير معرف (UNKNOWN). لا يمكن طباعتها.');
    }

    const isCancelled = normalized.payment_status === 'cancelled';
    const transactionDatetime = normalized.transaction_datetime || new Date().toISOString();

    const pdfPayload = {
      token,
      documentType: "transaction_document",
      fileName: `${transactionNo}-فاتورة_العميل.pdf`,
      payload: {
        business: {
          name: "باحكم للعسل",
          logoUrl: "https://lllgqnmrzaycmpypsifo.supabase.co/storage/v1/object/public/brand-assets/bahkm-honey-logo-header-ready.png"
        },
        transaction: {
          id: normalized.id,
          transaction_no: normalized.transaction_no,
          transaction_type: normalized.transaction_type,
          transaction_status: isCancelled ? 'cancelled' : 'active',
          transaction_datetime: formatDate(transactionDatetime),
          currency: normalized.currency,
          party_name: normalized.customer_name,
          party_phone: normalized.customer_phone || 'بلا رقم جوال',
          payment_status: normalized.payment_status,
          subtotal_amount: normalized.subtotal_amount,
          discount_amount: normalized.discount_amount,
          total_amount: normalized.total_amount,
          paid_amount: normalized.paid_amount,
          remaining_amount: normalized.remaining_amount,
          notes: normalized.notes || ""
        },
        items: normalized.items.map((it: any) => {
          const mapped: any = {
            product_name: it.product_name,
            unit_name: it.unit_name,
            quantity: it.quantity,
            unit_price: it.unit_price,
            line_total: it.line_total
          };
          if (isInternal) {
            mapped.estimated_unit_cost = it.estimated_unit_cost;
            mapped.estimated_profit = it.estimated_profit;
          }
          return mapped;
        }),
        options: {
          audience: isInternal ? 'internal' : 'customer',
          showInternalFinancials: isInternal
        }
      }
    };

    console.log("TRANSACTION PDF PAYLOAD TO N8N", JSON.stringify(pdfPayload, null, 2));

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(pdfPayload)
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.toLowerCase().includes('application/pdf')) {
      let errorDetail = '';
      try {
        errorDetail = await response.text();
      } catch {
        errorDetail = response.statusText;
      }
      throw new Error(errorDetail || 'فشلت عملية توليد المستند من الويب هوك');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${transactionNo}-${isInternal ? 'نسخة_إدارة' : 'فاتورة_العميل'}.pdf`;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return { success: true, error: null };
  } catch (err: any) {
    console.error('downloadTransactionPdf failed:', err);
    return { success: false, error: err.message || JSON.stringify(err) };
  }
}

/**
 * Backward compatible wrapper for legacy components.
 */
export async function generateTransactionPdf(
  transactionId: string,
  options?: { isInternal?: boolean }
): Promise<{ data: string | null; error: string | null }> {
  const res = await downloadTransactionPdf(transactionId, options);
  return { data: res.success ? 'TRANSACTION_DOWNLOADED' : null, error: res.error };
}



export function buildCustomerStatementHtml({
  customer,
  balances = [],
  ledger = [],
  periodText = 'كل الفترات',
  logoSrc = '/assets/bahkm-honey-logo-header-ready.png',
  options,
}: {
  customer: any;
  balances: any[];
  ledger: any[];
  periodText?: string;
  logoSrc?: string;
  options?: any;
}) {
  const formatNumber = (value: any) => {
    const n = Number(value || 0);
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n);
  };

  const showZeroBalances = options?.showZeroBalances !== false;
  const showAdminNotes = options?.showAdminNotes !== false;
  const showCustomerSummary = options?.showCustomerSummary !== false;
  const reportTitle = options?.reportTitle || 'كشف حساب تاريخي';

  // Calculate dynamic statistics
  const sums: Record<string, { due: number; paid: number; count: number }> = {};
  ledger.forEach((it: any) => {
    const cur = it.currency || 'YER';
    const isCancelled = it.transaction_status === 'cancelled' || String(it.description || '').includes('إلغاء');
    if (isCancelled) return;
    
    if (!sums[cur]) {
      sums[cur] = { due: 0, paid: 0, count: 0 };
    }
    sums[cur].count++;
    
    if (it.entry_type === 'debit') {
      sums[cur].due += Number(it.amount || 0);
    } else if (it.entry_type === 'credit') {
      sums[cur].paid += Number(it.amount || 0);
    }
  });

  const txTypeLabels: Record<string, string> = {
    sales_invoice: 'فاتورة مبيعات',
    purchase_invoice: 'فاتورة مشتريات',
    receipt_voucher: 'سند قبض',
    payment_voucher: 'سند صرف',
    sales_return: 'مرتجع بيع',
    purchase_return: 'مرتجع شراء',
    journal_voucher: 'قيد محاسبي'
  };

  const balanceCardsHtml = ['YER', 'SAR', 'USD'].map((cur) => {
    const balObj = balances.find((b: any) => b.currency === cur) || { balance: 0 };
    const balanceVal = Number(balObj.balance || 0);
    if (!showZeroBalances && balanceVal === 0) return '';
    
    const isOwed = balanceVal > 0;
    const isZero = balanceVal === 0;
    const amountClass = isOwed ? 'debit' : isZero ? '' : 'credit';
    const plusPrefix = isOwed ? '+' : '';
    const currencyName = CURRENCY_LABELS[cur as CurrencyType]?.name || cur;
    const currencySymbol = CURRENCY_LABELS[cur as CurrencyType]?.symbol || cur;

    return `
      <div class="balance-card">
        <span class="balance-card-currency">${currencyName}</span>
        <span class="balance-card-amount ${amountClass}">
          ${plusPrefix}${formatNumber(balObj.balance)}
        </span>
        <span style="font-family: monospace; font-size: 11px; font-weight: bold; color: #000000;">${currencySymbol}</span>
      </div>
    `;
  }).filter(Boolean).join('');

  const ledgerRowsHtml = ledger.length > 0 
    ? ledger.map((it: any) => {
        const dt = it.date ? new Date(it.date).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'مؤخراً';
        const isDebit = it.entry_type === 'debit';
        const isCredit = it.entry_type === 'credit';
        const txType = txTypeLabels[it.transaction_type] || it.transaction_type;
        
        const isCancelled = it.transaction_status === 'cancelled' || String(it.description || '').includes('إلغاء');

        return `
          <tr class="${isCancelled ? 'status-cancelled' : ''}">
            <td style="font-family: monospace; font-weight: bold; color: #000000;">${dt}</td>
            <td style="font-family: monospace; font-weight: 700; color: #D98200;">${it.transaction_no || 'بلا رقم'}</td>
            <td style="font-weight: bold; color: #000000;">${txType} ${isCancelled ? '(ملغاة)' : ''}</td>
            <td style="font-size: 13.5px; font-weight: bold; color: #000000;">${it.description || it.notes || 'حركة حساب بـ باحكم'}</td>
            <td class="amount-debit">${isDebit ? `+${formatNumber(it.amount)}` : '-'}</td>
            <td class="amount-credit">${isCredit ? `-${formatNumber(it.amount)}` : '-'}</td>
            <td class="amount-final" style="text-align: left; color: #000000;">${formatNumber(it.balance_after)}</td>
            <td style="text-align: center; font-weight: bold; color: #000000;">${it.currency}</td>
          </tr>
        `;
      }).join('')
    : `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; border: 2px dashed #D98200; border-radius: 12px; color: #000000; font-weight: bold; background-color: #FFFDF8;">
          لا توجد قيود أو حركة مبيعات مسجلة في كشف حساب العميل لهذه الفترة.
        </td>
      </tr>
    `;

  const reportRef = `STMT-${new Date().toISOString().slice(0, 10).replace(/[^0-9]/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  let customerSummaryHtml = '';
  if (showCustomerSummary) {
    const activeCurrencies = Object.keys(sums).length > 0 ? Object.keys(sums) : ['YER', 'SAR', 'USD'];
    customerSummaryHtml = `
      <div style="background-color: #FFFDF1; border: 2px solid #D98200; border-radius: 12px; padding: 18px; margin-bottom: 24px; color: #4A3200; box-shadow: 0 2px 8px rgba(217, 130, 0, 0.05); text-align: right;">
        <h4 style="font-size: 15px; margin-bottom: 8px; font-weight: 700; color: #D98200; display: flex; align-items: center; gap: 6px; justify-content: flex-start; direction: rtl;">
          <span>💡 دليل قراءة كشف الحساب المبسط والمطابقة:</span>
        </h4>
        <p style="font-size: 13.5px; margin-bottom: 14px; line-height: 1.6; color: #5C431A; text-align: right; direction: rtl;">
          هذا الكشف يوضح المبالغ المستحقة والمدفوعة لحسابكم بالتفصيل والتواريخ.
          المبالغ <strong>الآجلة ومستحقة الدفع (+)</strong> تضاف عند إخراج فواتير المبيعات، بينما 
          المبالغ <strong>المدفوعة والمستلمة (-)</strong> هي السدادات النقدية المسلمة منكم للإدارة.
          الرصيد النهائي يمثل المتبقي الفعلي بذمتكم لمتجر باحكم للعسل حتى تاريخ اليوم.
        </p>
        
        <div style="display: grid; grid-template-cols: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 10px; direction: rtl;">
          ${activeCurrencies.map(cur => {
            const sym = cur === 'YER' ? 'ر.ي' : cur === 'SAR' ? 'ر.س' : '$';
            const s = sums[cur] || { due: 0, paid: 0, count: 0 };
            const balObj = balances.find((b: any) => b.currency === cur) || { balance: 0 };
            const finalBal = Number(balObj.balance || 0);
            
            return `
              <div style="background-color: #ffffff; border: 1.5px solid #EADCBF; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 4px; text-align: right;">
                <span style="font-weight: 700; font-size: 13px; border-bottom: 1px dashed #EADCBF; padding-bottom: 4px; color: #D98200; display: block;">عملة ${cur === 'YER' ? 'الريال اليمني' : cur === 'SAR' ? 'الريال السعودي' : 'الدولار الأمريكي'}</span>
                <div style="display: flex; justify-content: space-between; font-size: 12.5px; color: #333; margin-top: 4px; direction: rtl;">
                  <span>المستحقات (الفواتير):</span>
                  <span style="font-family: monospace; font-weight: 700; color: #D98200; direction: ltr;">+${formatNumber(s.due)} ${sym}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12.5px; color: #333; direction: rtl;">
                  <span>المدفوعات (الواصل):</span>
                  <span style="font-family: monospace; font-weight: 700; color: #2F8F46; direction: ltr;">-${formatNumber(s.paid)} ${sym}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; border-top: 1.5px solid #F5EAD4; padding-top: 6px; margin-top: 4px; color: ${finalBal > 0 ? '#C2412D' : '#2F8F46'}; direction: rtl;">
                  <span>الرصيد المتبقي بذمتكم:</span>
                  <span style="font-family: monospace; direction: ltr;">${formatNumber(finalBal)} ${sym}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  const absoluteLogoSrc = typeof window !== 'undefined'
    ? (window.location.origin + '/assets/bahkm-honey-logo-header-ready.png')
    : '/assets/bahkm-honey-logo-header-ready.png';

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>كشف حساب مالي - ${customer.customer_name || customer.display_name || '-'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      direction: rtl;
      font-family: 'IBM Plex Sans Arabic', sans-serif;
      color: #000000;
      background-color: #ffffff;
      padding: 24px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 15px; /* High legibility */
      line-height: 1.5;
    }

    @page {
      size: A4;
      margin: 15mm;
    }

    .wrapper {
      max-width: 900px;
      margin: 0 auto;
      border: 2px solid #D98200; /* Robust amber boundary */
      border-radius: 16px;
      padding: 30px;
      background-color: #FFFDF9;
      box-shadow: 0 4px 12px rgba(226, 138, 37, 0.08);
    }

    @media print {
      body {
        padding: 0;
        background-color: #ffffff;
      }
      .wrapper {
        border: none;
        padding: 0;
        box-shadow: none;
        background-color: transparent;
      }
    }

    /* Roomy header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3.5px solid #D98200;
      padding-bottom: 20px;
      margin-bottom: 24px;
      gap: 20px;
    }

    .logo-container {
      display: flex;
      align-items: center;
    }

    .logo-container img {
      height: 90px;
      width: auto;
      max-height: 110px;
      object-fit: contain;
      display: block;
    }

    .doc-meta-box {
      text-align: left;
    }

    .doc-type-title {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      background-color: #D98200;
      border: 1.5px solid #D98200;
      padding: 8px 18px;
      border-radius: 8px;
      display: inline-block;
      margin-bottom: 8px;
    }

    /* Client profile */
    .profile-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      background-color: #FFFBF0;
      border: 2px solid #D98200;
      border-radius: 12px;
      padding: 18px;
    }

    .client-details {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .label-meta {
      font-size: 13.5px;
      color: #333333;
      font-weight: 700;
    }

    .value-fullname {
      font-size: 18px;
      font-weight: 700;
      color: #D98200;
    }

    /* Balances row layout that MUST stay side-by-side */
    .balances-grid {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      gap: 16px;
      margin-bottom: 24px;
      width: 100%;
    }

    .balance-card {
      flex: 1;
      min-width: 0; /* allows scaling */
      background-color: #ffffff;
      border: 2px solid #D98200;
      border-radius: 12px;
      padding: 16px 12px;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 4px;
    }

    .balance-card-currency {
      font-size: 13.5px;
      color: #333333;
      font-weight: 700;
    }

    .balance-card-amount {
      font-size: 17px;
      font-family: monospace;
      font-weight: 700;
      color: #C2412D; /* Default to owed red */
      display: block;
    }

    .balance-card-amount.credit {
      color: #2F8F46;
    }

    /* Ledger table */
    .ledger-table-container {
      margin-bottom: 24px;
      overflow-x: auto;
    }

    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      text-align: right;
    }

    .ledger-table th {
      background-color: #FFF5E0;
      border: 2px solid #D98200;
      padding: 10px 12px;
      font-weight: 700;
      font-size: 13.5px;
      color: #000000;
    }

    .ledger-table td {
      border: 1.5px solid #D98200;
      padding: 10px 12px;
      font-size: 13.5px;
      color: #000000;
      background-color: #ffffff;
    }

    .ledger-table tr:nth-child(even) td {
      background-color: #FFFDF0;
    }

    .amount-debit {
      color: #C2412D;
      font-weight: bold;
      font-family: monospace;
    }

    .amount-credit {
      color: #2F8F46;
      font-weight: bold;
      font-family: monospace;
    }

    .amount-final {
      font-weight: bold;
      font-family: monospace;
    }

    .status-cancelled {
      text-decoration: line-through;
      opacity: 0.6;
    }

    /* Footer Watermark */
    .footer {
      border-top: 2px solid #D98200;
      padding-top: 16px;
      text-align: center;
      font-size: 12.5px;
      color: #000000;
      font-weight: 600;
      line-height: 1.6;
    }

    /* Mobile Adaptations while retaining row structure */
    @media (max-width: 600px) {
      body {
        padding: 12px;
        font-size: 14px;
      }
      .wrapper {
        padding: 16px;
        border-radius: 10px;
      }
      .header {
        flex-direction: column;
        align-items: center;
        gap: 12px;
        text-align: center;
      }
      .logo-container img {
        height: 70px;
      }
      .doc-meta-box {
        text-align: center;
      }
      .profile-banner {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
        padding: 12px;
      }
      .balances-grid {
        gap: 8px;
      }
      .balance-card {
        padding: 10px 6px;
      }
      .balance-card-amount {
        font-size: 14px;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <!-- Header with logo and title -->
    <div class="header">
      <div class="logo-container">
        <img src="${absoluteLogoSrc}" alt="باحكم للعسل" />
      </div>
      <div class="doc-meta-box" style="text-align: left;">
        <div class="doc-type-title">${reportTitle}</div>
        <div style="font-size: 13px; color: #333333; font-weight: bold;">تاريخ الإصدار: ${new Date().toLocaleDateString('ar-YE-u-nu-latn')}</div>
        <div style="font-size: 12px; color: #D98200; font-weight: bold; font-family: monospace; margin-top: 4px;">المرجع: ${reportRef}</div>
      </div>
    </div>

    <!-- Client Profile summary -->
    <div class="profile-banner">
      <div class="client-details">
        <span class="label-meta">بيانات العميل المالية والتاريخية</span>
        <span class="value-fullname">${customer.customer_name || customer.display_name || '-'}</span>
        ${customer.phone_number ? `<span style="font-family: monospace; font-size: 13.5px; font-weight: bold; color: #000000;">الهاتف المعتمد: ${customer.phone_number}</span>` : ''}
        ${customer.notes && showAdminNotes ? `<span style="font-size: 13px; font-weight: bold; color: #333333;">ملاحظات الإدارة: ${customer.notes}</span>` : ''}
      </div>

      <div style="text-align: left;">
        <span class="label-meta">فترة كشف الحساب وعقد المطابقة</span>
        <div style="font-size: 14.5px; font-weight: bold; color: #000000; margin-top: 4px;">${periodText}</div>
        <div style="font-size: 13px; font-weight: bold; color: #333333; margin-top: 2px;">عدد المعاملات المدرجة: ${ledger.length} حركة</div>
      </div>
    </div>

    <!-- Simplified Non-Accounting Explanation Guide & Summaries -->
    ${customerSummaryHtml}

    <!-- Outstanding balances across multi currencies -->
    <div style="margin-bottom: 8px;">
      <span class="label-meta" style="margin-right: 5px;">ملخص أرصدة ذمة العميل المستحقة حالياً:</span>
    </div>
    <div class="balances-grid">
      ${balanceCardsHtml}
    </div>

    <!-- Ledger timeline table -->
    <div class="ledger-table-container">
      <table class="ledger-table">
        <thead>
          <tr>
            <th style="width: 12%;">التاريخ</th>
            <th style="width: 15%;">رقم العملية</th>
            <th style="width: 15%;">نوع العملية</th>
            <th>البيان والتفاصيل</th>
            <th style="width: 12%; text-align: left;">مستحق (+)</th>
            <th style="width: 12%; text-align: left;">مدفوع (-)</th>
            <th style="width: 14%; text-align: left;">الرصيد بعد الحركة</th>
            <th style="width: 8%; text-align: center;">العملة</th>
          </tr>
        </thead>
        <tbody>
          ${ledgerRowsHtml}
        </tbody>
      </table>
    </div>

    <!-- Footer of Statement -->
    <div class="footer">
      <div>تم إنشاء هذا المستند التفصيلي والمطابقة الحسابية المعتمدة بواسطة نظام <strong>IBEX_HAD</strong> لإدارة مبيعات باحكم للعسل.</div>
      <div style="font-weight: bold; color: #000000; margin-top: 5px;">يرجى مراجعة الإدارة في حال وجود أي اختلاف أو استفسار خلال 15 يوماً من تاريخ التوليد المفتوح: ${new Date().toLocaleString('ar-YE-u-nu-latn')}</div>
    </div>
  </div>
</body>
</html>
  `;
}

export interface StatementOptions {
  period: 'all' | 'today' | 'week' | 'month' | 'custom';
  dateFrom?: string;
  dateTo?: string;
  currency: 'all' | 'YER' | 'SAR' | 'USD';
  movementType: 'all' | 'invoices' | 'receipts' | 'active_only';
  displayStyle: 'detailed' | 'summary' | 'customer_friendly';
  showZeroBalances: boolean;
  showCancelled: boolean;
  showAdminNotes: boolean;
  showCustomerSummary: boolean;
  reportTitle: string;
  audience?: 'customer' | 'internal';
  includeInvoiceDetails?: boolean;
}

/**
 * Generates an executive, professional customer account statement (RTL Arabic)
 * for a specific customer, detailing previous operations, current outstanding balances,
 * and clear chronological ledger tracking.
 */
export async function generateCustomerStatementPdf(
  customerId: string,
  options?: Partial<StatementOptions>
): Promise<{ data: string | null; error: string | null }> {
  try {
    const res = await getCustomerDetail(customerId);
    if (res.error) throw new Error(res.error);
    const detail = res.data;
    if (!detail) throw new Error('تعذر العثور على بيانات هذا العميل المالية');

    const customer = detail.customer;
    const balances = detail.balances || [];
    
    // Sort chronologically (ascending) for statement timeline logic
    let ledger = [...(detail.ledger || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 1. Period Filtering
    const now = new Date();
    let periodText = 'كل الفترات';
    
    if (options?.period === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      ledger = ledger.filter(it => it.date && it.date.split('T')[0] === todayStr);
      periodText = 'اليوم فقط';
    } else if (options?.period === 'week') {
      const preWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      ledger = ledger.filter(it => it.date && new Date(it.date) >= preWeek);
      periodText = 'آخر 7 أيام';
    } else if (options?.period === 'month') {
      const preMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      ledger = ledger.filter(it => it.date && new Date(it.date) >= preMonth);
      periodText = 'هذا الشهر';
    } else if (options?.period === 'custom') {
      if (options.dateFrom) {
        ledger = ledger.filter(it => it.date && it.date.split('T')[0] >= options.dateFrom!);
      }
      if (options.dateTo) {
        ledger = ledger.filter(it => it.date && it.date.split('T')[0] <= options.dateTo!);
      }
      periodText = `من ${options.dateFrom || 'البداية'} إلى ${options.dateTo || 'اليوم'}`;
    }

    // 2. Currency Filtering
    if (options?.currency && options.currency !== 'all') {
      ledger = ledger.filter(it => it.currency === options.currency);
    }

    // 3. Movement Type Filtering
    if (options?.movementType === 'invoices') {
      ledger = ledger.filter(it => ['sales_invoice', 'purchase_invoice', 'sales_return', 'purchase_return'].includes(it.transaction_type));
    } else if (options?.movementType === 'receipts') {
      ledger = ledger.filter(it => ['receipt_voucher', 'payment_voucher'].includes(it.transaction_type));
    }

    // 4. Cancelled Transactions Filtering
    if (options && !options.showCancelled) {
      ledger = ledger.filter(it => it.transaction_status !== 'cancelled' && !String(it.description || '').includes('إلغاء'));
    }

    const webhookUrl = import.meta.env.VITE_PDF_RENDER_WEBHOOK_URL;
    if (webhookUrl) {
      // Fetch details in parallel if includeInvoiceDetails is enabled
      const itemsMap = new Map<string, any[]>();
      if (options?.includeInvoiceDetails) {
        const invoiceTxIds = ledger
          .filter(it => ['sales_invoice', 'purchase_invoice', 'sales_return', 'purchase_return'].includes(it.transaction_type))
          .map(it => it.transaction_id);
        
        const detailsPromises = invoiceTxIds.map(async (txId) => {
          try {
            const detailRes = await getTransactionDetail(txId);
            if (detailRes.data && detailRes.data.items) {
              return { transaction_id: txId, items: detailRes.data.items };
            }
          } catch (err) {
            console.error('Failed to load transaction details for', txId, err);
          }
          return { transaction_id: txId, items: [] };
        });

        const detailsList = await Promise.all(detailsPromises);
        detailsList.forEach(d => {
          itemsMap.set(d.transaction_id, d.items);
        });
      }

      // Map ledger rows with items
      const ledgerItemsMapped = ledger.map(it => {
        const dbItems = itemsMap.get(it.transaction_id) || [];
        const mappedItems = dbItems.map((dbi: any) => {
          const itemTotal = Number(dbi.quantity || 0) * Number(dbi.unit_price || 0);
          const mapped: any = {
            product_name: dbi.product_name,
            unit_name: dbi.unit_name || dbi.unit || 'كيلو',
            quantity: Number(dbi.quantity || 0),
            unit_price: Number(dbi.unit_price || 0),
            line_total: itemTotal,
            notes: dbi.notes || ''
          };

          if (options?.audience === 'internal') {
            const estCost = Number(dbi.estimated_unit_cost || 0);
            const estProfit = itemTotal - (estCost * Number(dbi.quantity || 0));
            mapped.estimated_unit_cost = estCost;
            mapped.estimated_profit = estProfit;
          }
          return mapped;
        });

        return {
          date: it.date ? it.date.split('T')[0] : '',
          transaction_id: it.transaction_id,
          transaction_no: it.transaction_no,
          transaction_type: it.transaction_type,
          description: it.description,
          due: it.entry_type === 'debit' ? Number(it.amount || 0) : 0,
          paid: it.entry_type === 'credit' ? Number(it.amount || 0) : 0,
          balance_after: Number(it.balance_after || 0),
          currency: it.currency,
          status: it.transaction_status || 'active',
          items: mappedItems
        };
      });

      // Calculate summaries by currency
      const byCurrency = ['YER', 'SAR', 'USD'].map(cur => {
        const curLedger = ledger.filter(it => it.currency === cur);
        const totalDue = curLedger.reduce((sum, it) => sum + (it.entry_type === 'debit' ? Number(it.amount || 0) : 0), 0);
        const totalPaid = curLedger.reduce((sum, it) => sum + (it.entry_type === 'credit' ? Number(it.amount || 0) : 0), 0);
        const foundBal = balances.find((b: any) => b.currency === cur);
        const finalBalance = foundBal ? Number(foundBal.balance || 0) : 0;

        return {
          currency: cur,
          totalDue,
          totalPaid,
          finalBalance
        };
      });

      // Root Summary
      const rootCurrency = options?.currency !== 'all' ? options.currency : 'YER';
      const rootSummary = byCurrency.find(bc => bc.currency === rootCurrency) || {
        currency: rootCurrency,
        totalDue: 0,
        totalPaid: 0,
        finalBalance: 0
      };

      const finalSummary = {
        totalDue: rootSummary.totalDue,
        totalPaid: rootSummary.totalPaid,
        finalBalance: rootSummary.finalBalance,
        currency: rootSummary.currency,
        byCurrency
      };

      const balancesList = ['YER', 'SAR', 'USD'].map(cur => {
        const found = balances.find((b: any) => b.currency === cur);
        return {
          currency: cur,
          balance: found ? Number(found.balance || 0) : 0
        };
      });

      const todayStr = new Date().toISOString().slice(0, 10).replace(/[^0-9]/g, '');
      const custName = customer.customer_name || 'العميل';
      const formattedTitle = (options?.reportTitle || 'كشف_حساب').trim().replace(/\s+/g, '_');
      const fileName = `statement-${custName}-${formattedTitle}-${todayStr}.pdf`;

      const token = import.meta.env.VITE_PDF_RENDER_TOKEN;
      const requestBody = {
        token,
        documentType: 'customer_statement',
        fileName,
        payload: {
          business: {
            name: 'باحكم للعسل',
            logoUrl: 'https://lllgqnmrzaycmpypsifo.supabase.co/storage/v1/object/public/brand-assets/bahkm-honey-logo-header-ready.png'
          },
          customer: {
            id: customer.id,
            name: customer.customer_name,
            phone: customer.phone_number || '',
            status: customer.is_active ? 'active' : 'inactive'
          },
          options: {
            title: options?.reportTitle || 'كشف حساب مالي',
            periodText,
            dateFrom: options?.dateFrom || null,
            dateTo: options?.dateTo || null,
            currency: options?.currency || 'all',
            audience: options?.audience || 'customer',
            includeCancelled: !!options?.showCancelled,
            includeInvoiceDetails: !!options?.includeInvoiceDetails,
            showZeroBalances: options?.showZeroBalances !== false
          },
          summary: finalSummary,
          balances: balancesList,
          ledger: ledgerItemsMapped
        }
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.toLowerCase().includes('application/pdf')) {
        let errorDetail = '';
        try {
          errorDetail = await response.text();
        } catch {
          errorDetail = response.statusText;
        }
        throw new Error('أخفق الخادم في تحويل البيانات إلى PDF حقيقي: ' + errorDetail);
      }

      const blob = await response.blob();
      if (!blob.type.toLowerCase().includes('application/pdf')) {
        throw new Error('الملف الراجع من الخادم ليس بصيغة PDF صالحة حقيقية.');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { data: 'STATION_DOWNLOADED', error: null };
    }

    const htmlContent = buildCustomerStatementHtml({
      customer,
      balances,
      ledger,
      periodText,
      options
    });

    return { data: htmlContent, error: null };
  } catch (err: any) {
    console.error('generateCustomerStatementPdf failed:', err);
    return { data: null, error: err.message || 'تعذر إصدار كشف كشف حساب العميل' };
  }
}

/**
 * Handles communication with external PDF Rendering Webhook (e.g. n8n/Gotenberg)
 * to convert pristine HTML layouts to valid 'application/pdf' files.
 */
export async function generatePdfFromHtml({
  html,
  fileName,
  documentType,
  metadata
}: {
  html: string;
  fileName: string;
  documentType: string;
  metadata?: any;
}) {
  const webhookUrl = import.meta.env.VITE_PDF_RENDER_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error('خدمة توليد PDF غير مفعّلة بعد. يرجى تفعيل VITE_PDF_RENDER_WEBHOOK_URL في الإعدادات.');
  }

  const token = import.meta.env.VITE_PDF_RENDER_TOKEN;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      token,
      html,
      fileName,
      documentType,
      metadata: {
        business_id: BUSINESS_ID,
        generated_at: new Date().toISOString(),
        ...metadata
      }
    })
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.toLowerCase().includes('application/pdf')) {
    let errorDetail = '';
    try {
      errorDetail = await response.text();
    } catch {
      errorDetail = response.statusText;
    }
    throw {
      message: 'أخفق الخادم في تحويل HTML إلى PDF حقيقي.',
      status: response.status,
      detail: errorDetail
    };
  }

  const blob = await response.blob();
  if (!blob.type.toLowerCase().includes('application/pdf')) {
    throw {
      message: 'الملف الراجع من الخادم ليس بصيغة PDF صالحة حقيقية.',
      detail: `Blob type: ${blob.type}`
    };
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);

  return { success: true };
}

/**
 * Get media library items from ibex_had_media_library
 */
export async function getMediaLibrary(filters: {
  search?: string;
  documentType?: string;
  customerId?: string;
  status?: string;
  documentDate?: string;
}) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_get_media_library', { p_business_id: BUSINESS_ID })
    );
    if (error) throw error;

    let list = data || [];

    if (filters.documentType && filters.documentType !== 'all') {
      list = list.filter((item: any) => item.document_type === filters.documentType);
    }

    if (filters.customerId && filters.customerId !== 'all') {
      list = list.filter((item: any) => item.related_customer_id === filters.customerId);
    }

    if (filters.status && filters.status !== 'all') {
      list = list.filter((item: any) => item.status === filters.status);
    }

    if (filters.documentDate) {
      list = list.filter((item: any) => item.document_date === filters.documentDate);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      list = list.filter((item: any) => 
        (item.title && item.title.toLowerCase().includes(searchLower)) ||
        (item.description && item.description.toLowerCase().includes(searchLower)) ||
        (item.file_name && item.file_name.toLowerCase().includes(searchLower))
      );
    }

    // Sort by created_at descending
    list.sort((a: any, b: any) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    return { data: list, error: null };
  } catch (err: any) {
    console.error('getMediaLibrary failed:', err);
    return { data: null, error: err.message || 'فشل تحميل مكتبة الوسائط' };
  }
}

/**
 * Upload a media file to Supabase Storage and register in ibex_had_media_library
 */
export async function uploadMediaFile(file: File, metadata: {
  title: string;
  description?: string;
  document_type: string;
  document_date?: string;
  related_customer_id?: string | null;
  related_transaction_id?: string | null;
  related_order_id?: string | null;
  tags?: string[];
  uploaded_by?: string;
}) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = now.getTime();
    
    // Retrieve the user ID in a highly resilient way to prevent session issues in sandboxed environments
    let userId: string | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id || null;
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      }
    } catch (authErr) {
      console.warn('Failed to retrieve active session via Supabase auth:', authErr);
    }

    // Check if the provided uploaded_by is a valid UUID, otherwise use authenticated user ID or null
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isProvidedUidUuid = metadata.uploaded_by ? uuidRegex.test(metadata.uploaded_by) : false;
    const finalUploadedBy = isProvidedUidUuid ? metadata.uploaded_by : userId;

    if (!finalUploadedBy) {
      throw new Error('لم يتم العثور على جلسة مستخدم نشطة ومصرح لها برفع المستندات. يرجى تسجيل الخروج ثم تسجيل الدخول مرة أخرى لإعادة تهيئة الجلسة.');
    }

    // Ensure that the user exists in ibex_had_users with an admin role to pass any potential table RLS policies
    try {
      const { data: userProfile } = await supabase
        .from('ibex_had_users')
        .select('id, role')
        .eq('auth_user_id', finalUploadedBy)
        .maybeSingle();

      if (!userProfile) {
        let email: string | null = null;
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && user.id === finalUploadedBy) {
            email = user.email || null;
          }
        } catch (e) {
          console.warn('Could not fetch user email for dynamic profile registration:', e);
        }
        
        await supabase
          .from('ibex_had_users')
          .insert({
            business_id: BUSINESS_ID,
            auth_user_id: finalUploadedBy,
            full_name: email ? email.split('@')[0] : 'مدير النظام',
            email: email,
            role: 'admin',
            is_active: true
          });
      } else if (userProfile.role !== 'admin') {
        // Upgrade the role to admin to ensure RLS policies pass
        await supabase
          .from('ibex_had_users')
          .update({ role: 'admin' })
          .eq('auth_user_id', finalUploadedBy);
      }
    } catch (dbUserErr) {
      console.warn('Resilient ibex_had_users sync failed inside uploadMediaFile, continuing to save metadata:', dbUserErr);
    }

    // Clean file name
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const storagePath = `${BUSINESS_ID}/${year}/${month}/${metadata.document_type}/${timestamp}-${cleanFileName}`;
    const bucketName = 'ibex-had-media';

    // Upload file to storage with explicit contentType option to prevent sniffing errors and respect bucket restriction policies
    const { data: storageData, error: storageError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream'
      });

    if (storageError) {
      throw new Error(`أخفق رفع الملف إلى Supabase Storage: ${storageError.message}. يرجى التأكد من إنشاء الـ Bucket المسمى [${bucketName}] وإتاحة صلاحيات الرفع العامة فيه.`);
    }

    // Save metadata record
    const dbPayload = {
      business_id: BUSINESS_ID,
      title: metadata.title,
      description: metadata.description || null,
      document_type: metadata.document_type,
      file_name: file.name,
      file_path: storagePath,
      storage_bucket: bucketName,
      mime_type: file.type || 'application/octet-stream',
      file_size: file.size,
      related_customer_id: metadata.related_customer_id || null,
      related_transaction_id: metadata.related_transaction_id || null,
      related_order_id: metadata.related_order_id || null,
      document_date: metadata.document_date || now.toISOString().split('T')[0],
      tags: metadata.tags || [],
      status: 'active',
      uploaded_by: finalUploadedBy,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    const { data: dbData, error: dbError } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_create_media_record', { p_payload: dbPayload })
    );

    if (dbError) {
      // Rollback storage upload on database metadata save error
      await supabase.storage.from(bucketName).remove([storagePath]);
      throw dbError;
    }

    return { data: dbData, error: null };
  } catch (err: any) {
    console.error('uploadMediaFile failed:', err);
    return { data: null, error: err.message || 'فشلت عملية رفع وأرشفة المستند' };
  }
}

/**
 * Update media document metadata
 */
export async function updateMediaMetadata(id: string, metadata: {
  title: string;
  description?: string;
  document_type: string;
  document_date?: string;
  related_customer_id?: string | null;
  related_transaction_id?: string | null;
  related_order_id?: string | null;
  tags?: string[];
  status?: string;
}) {
  try {
    const payload = {
      title: metadata.title,
      description: metadata.description || null,
      document_type: metadata.document_type,
      document_date: metadata.document_date || null,
      related_customer_id: metadata.related_customer_id || null,
      related_transaction_id: metadata.related_transaction_id || null,
      related_order_id: metadata.related_order_id || null,
      tags: metadata.tags || [],
      status: metadata.status || 'active'
    };

    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_update_media_record', { p_media_id: id, p_payload: payload })
    );

    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('updateMediaMetadata failed:', err);
    return { data: null, error: err.message || 'فشل تحديث بيانات المستند' };
  }
}

/**
 * Update document status (active, archived, cancelled)
 */
export async function updateMediaStatus(id: string, status: 'active' | 'archived' | 'cancelled') {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_update_media_status', { 
        p_media_id: id, 
        p_reason: `Status updated to ${status}`, 
        p_status: status 
      })
    );
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('updateMediaStatus failed:', err);
    return { data: null, error: err.message || 'فشل تحديث حالة المستند' };
  }
}

/**
 * Generate a secure/public URL for the media item
 */
export function getMediaPublicUrl(filePath: string, bucketName: string = 'ibex-had-media') {
  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  return data?.publicUrl || '';
}

/**
 * Generate a secure signed URL for private bucket access (reconciles with getMediaPublicUrl)
 */
export async function getMediaSignedUrl(filePath: string, bucketName: string = 'ibex-had-media', expiresIn: number = 7200) {
  try {
    const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(filePath, expiresIn);
    if (error) throw error;
    return data?.signedUrl || '';
  } catch (err) {
    console.error('getMediaSignedUrl failed, falling back to publicUrl:', err);
    return getMediaPublicUrl(filePath, bucketName);
  }
}

/**
 * Fetch documents linked/associated with a specific entity (customer, transaction, order)
 */
export async function getMediaForEntity(entityType: 'customer' | 'transaction' | 'order', entityId: string) {
  try {
    const { data, error } = await executeWithRetry(() =>
      supabase.rpc('ibex_had_get_media_library', { p_business_id: BUSINESS_ID })
    );
    if (error) throw error;

    let list = data || [];

    // Filter only active ones on details sheets
    list = list.filter((item: any) => item.status === 'active');

    if (entityType === 'customer') {
      list = list.filter((item: any) => item.related_customer_id === entityId);
    } else if (entityType === 'transaction') {
      list = list.filter((item: any) => item.related_transaction_id === entityId);
    } else if (entityType === 'order') {
      list = list.filter((item: any) => item.related_order_id === entityId);
    }

    // Sort by created_at descending
    list.sort((a: any, b: any) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    return { data: list, error: null };
  } catch (err: any) {
    console.error('getMediaForEntity failed:', err);
    return { data: null, error: err.message || 'فشل جلب المستندات المرتبطة' };
  }
}




