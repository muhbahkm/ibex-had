/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Receipt, 
  MessageSquare, 
  Wallet, 
  TrendingUp, 
  UserX, 
  Sparkles, 
  ArrowLeft,
  RefreshCw,
  ShoppingBag,
  Bell,
  CheckCircle,
  Database,
  Loader2
} from 'lucide-react';
import { 
  getDailyReport, 
  getCashSummary, 
  getFrontendTransactionsList, 
  getOverdueCustomers, 
  getTopProducts,
  downloadTransactionPdf
} from '../lib/api';
import { TRANSACTION_LABELS, CURRENCY_LABELS, CurrencyType } from '../types';
import { formatNumber, formatMoney } from '../lib/numberUtils';

interface DashboardViewProps {
  onNavigateToTrx: () => void;
  onSelectTrx: (id: string) => void;
  onSelectCustomer: (id: string) => void;
}

export default function DashboardView({ onNavigateToTrx, onSelectTrx, onSelectCustomer }: DashboardViewProps) {
  const [loading, setLoading] = useState(false);
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [cashSummary, setCashSummary] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [overdueCustomers, setOverdueCustomers] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [dailyRes, txsRes, overdueRes, topRes] = await Promise.all([
        getDailyReport(),
        getFrontendTransactionsList(),
        getOverdueCustomers(30),
        getTopProducts(
          new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
          new Date().toISOString().split('T')[0]
        )
      ]);

      if (dailyRes.error) console.warn('Daily report read error:', dailyRes.error);
      if (txsRes.error) console.warn('Transactions read error:', txsRes.error);
      if (overdueRes.error) console.warn('Overdue clients read error:', overdueRes.error);
      if (topRes.error) console.warn('Top products read error:', topRes.error);

      setDailyReport(dailyRes.data);
      setRecentTransactions((txsRes.data || []).slice(0, 10)); // Top 10
      setOverdueCustomers((overdueRes.data || []).slice(0, 5)); // Top 5
      setTopProducts(topRes.data || []);
    } catch (err: any) {
      setErrorMessage('حدث خطأ أثناء تحميل بيانات لوحة التحكّم.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Safe formatter helper
  const formatAmt = (val: any) => formatNumber(val);

  return (
    <div className="space-y-6 fade-in pb-12">
      
      {/* Alert Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-main-text flex items-center gap-2">
            لوحة الإدارة اليومية لـ باحكم للعسل
          </h2>
          <p className="text-xs text-sec-text mt-1.5">مراقبة المقبوض والمبيعات اليومية وتحديد الزبائن على الآجل لتوليد الفواتير الفورية.</p>
        </div>

        <div className="flex gap-2 shrink-0 self-stretch md:self-auto">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="py-2.5 px-3 rounded-xl border border-border-val hover:bg-side-active text-main-text flex items-center justify-center cursor-pointer transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-danger-val/10 border border-danger-val/20 text-danger-val rounded-xl p-4 text-xs">
          {errorMessage}
        </div>
      )}

      {/* Primary KPI Section */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        
        {/* KPI: مبيعات اليوم */}
        <div id="kpi-sales-today" className="bg-[#FFFDF3] rounded-2xl p-4 border border-[#EADCBF] shadow-sm relative overflow-hidden transition-all duration-200">
          <span className="text-[11px] text-[#8F5500] block font-black">مبيعات اليوم (المجموع)</span>
          <div className="text-lg md:text-xl font-mono font-black text-[#5E4E36] mt-2 select-all">
            {formatAmt(dailyReport?.sales_total_yer || 0)} <span className="text-[10px] font-sans text-[#5E4E36]/80 font-bold">ر.ي</span>
          </div>
          <div className="text-[10px] text-[#5E4E36] font-mono mt-1 space-y-0.5">
            <div><strong className="text-[#8F5500] font-black">{formatAmt(dailyReport?.sales_total_sar || 0)}</strong> SAR</div>
            <div><strong className="text-[#8F5500] font-black">{formatAmt(dailyReport?.sales_total_usd || 0)}</strong> USD</div>
          </div>
          <div className="absolute left-1.5 bottom-1.5 text-[#8F5500]/10 pointer-events-none">
            <ShoppingBag className="w-10 h-10" />
          </div>
        </div>
 
        {/* KPI: المقبوض اليوم */}
        <div id="kpi-cash-received" className="bg-[#F8FDF6] rounded-2xl p-4 border border-[#D0EBC1] shadow-sm relative overflow-hidden transition-all duration-200">
          <span className="text-[11px] text-[#15803D] block font-black">المقبوض كاش اليوم</span>
          <div className="text-lg md:text-xl font-mono font-black text-[#3F5932] mt-2 select-all">
            {formatAmt(dailyReport?.cash_received_yer || 0)} <span className="text-[10px] font-sans text-[#3F5932]/80 font-bold">ر.ي</span>
          </div>
          <div className="text-[10px] text-[#3F5932] font-mono mt-1 space-y-0.5">
            <div><strong className="text-[#15803D] font-black">{formatAmt(dailyReport?.cash_received_sar || 0)}</strong> SAR</div>
            <div><strong className="text-[#15803D] font-black">{formatAmt(dailyReport?.cash_received_usd || 0)}</strong> USD</div>
          </div>
          <div className="absolute left-1.5 bottom-1.5 text-[#15803D]/10 pointer-events-none">
            <Wallet className="w-10 h-10" />
          </div>
        </div>
 
        {/* KPI: الآجل اليوم */}
        <div id="kpi-debt-today" className="bg-[#FFF9F9] rounded-2xl p-4 border border-[#F5D2D2] shadow-sm relative overflow-hidden transition-all duration-200">
          <span className="text-[11px] text-[#BE123C] block font-black">آجل المبيعات اليوم</span>
          <div className="text-lg md:text-xl font-mono font-black text-[#6F4747] mt-2 select-all">
            {formatAmt(dailyReport?.unpaid_yer || 0)} <span className="text-[10px] font-sans text-[#6F4747]/80 font-bold">ر.ي</span>
          </div>
          <div className="text-[10px] text-[#6F4747] font-mono mt-1 space-y-0.5">
            <div><strong className="text-[#BE123C] font-black">{formatAmt(dailyReport?.unpaid_sar || 0)}</strong> SAR</div>
            <div><strong className="text-[#BE123C] font-black">{formatAmt(dailyReport?.unpaid_usd || 0)}</strong> USD</div>
          </div>
          <div className="absolute left-1.5 bottom-1.5 text-[#BE123C]/10 pointer-events-none">
            <UserX className="w-10 h-10" />
          </div>
        </div>
 
        {/* KPI: الربح التقريبي */}
        <div id="kpi-profit-margin" className="bg-[#F4FDF9] rounded-2xl p-4 border border-[#C2EEDF] shadow-sm relative overflow-hidden transition-all duration-200">
          <span className="text-[11px] text-[#0F766E] block font-black">هامش الربح التقديري</span>
          <div className="text-md md:text-lg font-mono font-black text-[#2E5B51] mt-2 mb-1 select-all">
            +{formatAmt(dailyReport?.estimated_profit_yer || 0)} <span className="text-[10px] font-sans text-[#2E5B51]/80 font-bold">ر.ي</span>
          </div>
          <span className="text-[9.5px] text-[#2E5B51]/85 leading-tight block mt-1 border-t border-[#C2EEDF] pt-1 font-black">
            محتسب تلقائياً بخصم تكاليف المدخلات.
          </span>
          <div className="absolute left-1.5 bottom-1.5 text-[#0F766E]/10 pointer-events-none">
            <TrendingUp className="w-10 h-10" />
          </div>
        </div>
 
        {/* KPI: عدد العمليات */}
        <div id="kpi-invoice-count" className="bg-[#FAFAFA] rounded-2xl p-4 border border-[#E5E5E5] shadow-sm relative overflow-hidden transition-all duration-200">
          <span className="text-[11px] text-[#171717] block font-black">إجمالي الفواتير اليوم</span>
          <div className="text-3xl font-mono font-black text-[#171717] mt-1.5 select-all">
            {dailyReport?.sales_count || 0}
          </div>
          <span className="text-[9.5px] text-[#525252] block mt-1 font-semibold">عمليات القيود المسجلة</span>
          <div className="absolute left-1.5 bottom-1.5 text-[#171717]/10 pointer-events-none">
            <Receipt className="w-10 h-10" />
          </div>
        </div>
 
        {/* KPI: رسائل واتساب معلقة */}
        <div id="kpi-whatsapp-pending" className="bg-[#FDF9F4] rounded-2xl p-4 border border-[#EFE1CE] shadow-sm relative overflow-hidden transition-all duration-200">
          <span className="text-[11px] text-[#075E54] block font-black">بانتظار الإرسال واتساب</span>
          <div className="text-3xl font-mono font-black text-[#075E54] mt-1.5 select-all">
            {dailyReport?.whatsapp_pending_count || 0}
          </div>
          <span className="text-[9.5px] text-[#35534F] block mt-1 font-semibold">رسائل معلقة بالتلقائي</span>
          <div className="absolute left-1.5 bottom-1.5 text-[#075E54]/10 pointer-events-none">
            <MessageSquare className="w-10 h-10" />
          </div>
        </div>
 
      </div>

      {/* Main Grid: Left layout (Recent Transactions), Right layouts (Debtors & Top Honey) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Transactions List on left (cols-2) */}
        <div className="lg:col-span-2 bg-card-bg border border-border-val rounded-2xl p-5 space-y-4 shadow-sm transition-all duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-border-val/60">
            <h3 className="text-sm font-black text-main-text flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-honey" />
              آخر الفواتير والقيود المالية المسجلة باليومية
            </h3>
            <span className="text-[10px] text-sec-text">آخر 10 قيود</span>
          </div>

          <div className="overflow-x-auto">
            {recentTransactions.length > 0 ? (
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="text-sec-text border-b border-border-val/60 pb-2">
                    <th className="py-2.5 px-2 font-bold">رقم القيد</th>
                    <th className="py-2.5 px-2 font-bold">نوع العملية</th>
                    <th className="py-2.5 px-2 font-bold">العميل</th>
                    <th className="py-2.5 px-2 font-bold">المجموع</th>
                    <th className="py-2.5 px-2 font-bold">حالة السداد</th>
                    <th className="py-2.5 px-2 font-bold">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-val/40">
                  {recentTransactions.map((tx: any, idx: number) => {
                    const remaining = Number(tx.total_amount) - Number(tx.paid_amount);
                    const isCancelled = tx.status === 'cancelled';
                    return (
                      <tr key={`${tx.id || 'tx'}-${idx}`} className="hover:bg-table-hover transition-colors">
                        <td className="py-2.5 px-2 font-mono text-honey font-bold select-all">{tx.transaction_no}</td>
                        <td className="py-2.5 px-2 text-main-text font-medium">
                          {TRANSACTION_LABELS[tx.transaction_type as keyof typeof TRANSACTION_LABELS] || tx.transaction_type}
                        </td>
                        <td className="py-2.5 px-2 text-sec-text max-w-[120px] truncate">
                          <div>{tx.party_name || 'عام'}</div>
                          {(tx.created_by_email || tx.created_by || tx.created_by_user || tx.user_id) && (
                            <div className="text-[9px] text-[#A06000] font-black max-w-[120px] truncate mt-0.5" title={tx.created_by_email || tx.created_by || tx.created_by_user || tx.user_id}>
                              بواسطة: {(tx.created_by_email || tx.created_by || tx.created_by_user || tx.user_id).includes('@') ? (tx.created_by_email || tx.created_by || tx.created_by_user || tx.user_id).split('@')[0] : (tx.created_by_email || tx.created_by || tx.created_by_user || tx.user_id)}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-main-text font-black">
                          {formatMoney(tx.total_amount, tx.currency)}
                        </td>
                        <td className="py-2.5 px-2">
                          {isCancelled ? (
                            <span className="text-danger-val bg-danger-val/10 px-2.5 py-0.5 rounded text-[10px] font-extrabold">ملغاة</span>
                          ) : remaining <= 0 ? (
                            <span className="text-success-val bg-success-val/10 px-2.5 py-0.5 rounded text-[10px] font-extrabold">خالص كاش</span>
                          ) : tx.paid_amount > 0 ? (
                            <span className="text-warning-val bg-warning-val/10 px-2.5 py-0.5 rounded text-[10px] font-extrabold">مسدد جزئي</span>
                          ) : (
                            <span className="text-danger-val bg-danger-val/10 px-2.5 py-0.5 rounded text-[10px] font-extrabold">آجل بالكامل</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            onClick={async () => {
                              if (loadingPdfId) return;
                              setLoadingPdfId(tx.id);
                              try {
                                const { success, error } = await downloadTransactionPdf(tx.id);
                                if (error) {
                                  alert('حدث خطأ أثناء تحميل الفاتورة: ' + error);
                                }
                              } catch (pdfErr: any) {
                                alert('خطأ في تحميل PDF: ' + pdfErr.message);
                              } finally {
                                setLoadingPdfId(null);
                              }
                            }}
                            disabled={loadingPdfId !== null}
                            className="text-honey hover:underline text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            {loadingPdfId === tx.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-honey" />
                            ) : null}
                            تحميل PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12 text-sec-text">لا توجد فواتير مسجلة اليوم مسبقاً.</div>
            )}
          </div>
        </div>

        {/* Overdue Debtors & Top Sold on Right */}
        <div className="space-y-6">
          
          {/* Overdue Debtors list */}
          <div className="bg-card-bg border border-border-val rounded-2xl p-5 space-y-4 shadow-sm transition-all duration-200">
            <h3 className="text-sm font-black text-main-text flex items-center gap-1.5 pb-2 border-b border-border-val/60">
              <UserX className="w-4 h-4 text-danger-val" />
              العملاء المتأخرون بالسداد (الآجل المستحق)
            </h3>

            {overdueCustomers.length > 0 ? (
              <div className="space-y-3">
                {overdueCustomers.map((cust: any, idx: number) => (
                  <div 
                    key={`${cust.customer_id || 'cust'}-${idx}`}
                    onClick={() => onSelectCustomer(cust.customer_id)}
                    className="p-3 bg-soft-card border border-border-val rounded-xl hover:border-honey/40 hover:bg-table-hover cursor-pointer transition-all flex justify-between items-center"
                  >
                    <div>
                      <h4 className="text-xs text-main-text font-extrabold">{cust.customer_name}</h4>
                      <p className="text-[10px] text-sec-text mt-0.5">أخر دفعة من {cust.days_since_last_tx || '30'} يوماً</p>
                    </div>
                    <div className="text-left">
                      <span className="text-xs font-mono font-black text-danger-val block">
                        {formatMoney(cust.total_due_yer || 0, 'ر.ي')}
                      </span>
                      {cust.total_due_sar > 0 && <span className="text-[9px] font-mono text-sec-text block">{formatMoney(cust.total_due_sar, 'SAR')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-sec-text">لا توجد ذمم أو ديون متأخرة بالملونة حالياً.</div>
            )}
          </div>

          {/* Top Honey Items Sold */}
          <div className="bg-card-bg border border-border-val rounded-2xl p-5 space-y-4 shadow-sm transition-all duration-200">
            <h3 className="text-sm font-black text-main-text flex items-center gap-1.5 pb-2 border-b border-border-val/60">
              <TrendingUp className="w-4 h-4 text-success-val" />
              أصناف العسل الأكثر مبيعاً (آخر ٣٠ يوم)
            </h3>

            {topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((p: any, idx: number) => (
                  <div key={`${p.product_id || p.id || 'top'}-${idx}`} className="flex items-center justify-between text-xs text-main-text p-2.5 bg-soft-card rounded-xl border border-border-val/50 hover:bg-table-hover transition-colors duration-200">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-sec-bg rounded flex items-center justify-center font-black font-mono text-[10px] text-honey border border-border-val/30">
                        {idx + 1}
                      </span>
                      <span className="font-bold">{p.product_name}</span>
                    </div>
                    <div className="text-left font-mono text-sec-text text-[11px]">
                      مبيعات: <strong className="text-main-text font-black">{formatNumber(p.total_quantity || p.quantity || 0)}</strong> كيلو
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-sec-text">لا توجد بيانات أصناف مبيع في هذه الفترة.</div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
