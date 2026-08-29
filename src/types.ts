/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CurrencyType = 'YER' | 'SAR' | 'USD';

export const CURRENCY_LABELS: Record<CurrencyType, { name: string; symbol: string }> = {
  YER: { name: 'ريال يمني', symbol: 'ر.ي' },
  SAR: { name: 'ريال سعودي', symbol: 'ر.س' },
  USD: { name: 'دولار أمريكي', symbol: '$' },
};

export type TransactionType =
  | 'sales_invoice'
  | 'purchase_invoice'
  | 'receipt_voucher'
  | 'payment_voucher'
  | 'sales_return'
  | 'purchase_return'
  | 'simple_entry';

export const TRANSACTION_LABELS: Record<TransactionType, string> = {
  sales_invoice: 'فاتورة مبيعات',
  purchase_invoice: 'فاتورة مشتريات',
  receipt_voucher: 'سند قبض',
  payment_voucher: 'سند صرف',
  sales_return: 'مرتجع مبيعات',
  purchase_return: 'مرتجع مشتريات',
  simple_entry: 'قيد مالي بسيط',
};

export interface TransactionItemInput {
  product_id: string | null;
  product_name: string;
  category: string;
  unit_id: string | null;
  unit_name: string;
  quantity: number;
  unit_price: number;
  estimated_unit_cost: number;
  notes: string;
  conversion_factor?: number;
  base_unit_name?: string;
  all_units?: any[];
  base_sale_price?: number;
  base_cost_price?: number;
}

export interface TransactionPayload {
  business_id: string;
  transaction_type: TransactionType;
  currency: CurrencyType;
  party_name?: string;
  party_phone?: string;
  customer_id?: string;
  payment_status?: string;
  total_amount?: number;
  remaining_amount?: number;
  cash_account_id: string | null;
  paid_amount: number;
  discount_amount: number;
  notes: string;
  send_whatsapp: boolean;
  auto_create_products: boolean;
  items: TransactionItemInput[];
  created_by_user_id?: string;
  created_by_email?: string;
}

export interface CashAccount {
  id: string;
  account_name: string;
  currency: CurrencyType;
  opening_balance: number;
  current_balance: number;
  notes?: string;
}

export interface Unit {
  id: string;
  unit_name: string;
  notes?: string;
}

export interface Product {
  id: string;
  product_name: string;
  category: string;
  default_unit_id?: string | null;
  default_unit_name?: string | null;
  default_sales_price?: number;
  estimated_cost?: number;
  default_currency?: CurrencyType;
  notes?: string;
  is_active?: boolean;
}

export interface Customer {
  id: string;
  customer_name: string;
  phone_number: string;
  balance_yer?: number;
  balance_sar?: number;
  balance_usd?: number;
  last_transaction_date?: string;
  notes?: string;
}

export interface WhatsappQueueItem {
  id: string;
  message_type: string;
  recipient_phone: string;
  recipient_name: string;
  message_body: string;
  transaction_id?: string;
  status: string;
  created_at: string;
}

export interface DailyReport {
  sales_count: number;
  sales_total_yer: number;
  sales_total_sar: number;
  sales_total_usd: number;
  cash_received_yer: number;
  cash_received_sar: number;
  cash_received_usd: number;
  unpaid_yer: number;
  unpaid_sar: number;
  unpaid_usd: number;
  estimated_profit_yer: number;
  whatsapp_pending_count: number;
}
