/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Calendar, 
  RefreshCw, 
  TrendingUp, 
  UserCheck, 
  DollarSign, 
  ShoppingBag,
  TrendingDown,
  ArrowUpLeft,
  PieChart,
  UserX,
  FileSpreadsheet
} from 'lucide-react';
import { 
  getBusinessOverview, 
  getDailyReport, 
  getTopProducts, 
  getCustomerBalancesReport, 
  getOverdueCustomers 
} from '../lib/api';
import { CurrencyType, CURRENCY_LABELS } from '../types';
import { formatNumber, formatMoney, normalizeDigits } from '../lib/numberUtils';

export default function ReportsView() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Date selectors (Default 30 days window)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Analytics states
  const [overview, setOverview] = useState<any>(null);
  const [dailyStats, setDailyStats] = useState<any>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [debtors, setDebtors] = useState<any[]>([]);
  const [overdue, setOverdue] = useState<any[]>([]);

  useEffect(() => {
    loadReports();
  }, [dateFrom, dateTo]);

  const loadReports = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [overviewRes, dailyRes, topRes, debtsRes, overdueRes] = await Promise.all([
        getBusinessOverview(dateFrom, dateTo),
        getDailyReport(dateTo), // Daily stats for the 'to' date
        getTopProducts(dateFrom, dateTo, 'YER', 10),
        getCustomerBalancesReport(true), // Debtors only
        getOverdueCustomers(30)
      ]);

      setOverview(overviewRes.data);
      setDailyStats(dailyRes.data);
      setTopProducts(topRes.data || []);
      setDebtors((debtsRes.data || []).slice(0, 10)); // Top 10 in lists
      setOverdue((overdueRes.data || []).slice(0, 10));
    } catch (err: any) {
      setErrorMessage('تعذر معالجة وتوليد الرخص الإحصائية: ' + (err?.message || 'خطأ'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 fade-in pb-12 text-right">
      
      {/* Title */}
      <div className="flex justify-between items-center bg-card-bg p-5 rounded-2xl border border-border-val shadow-sm transition-colors duration-200">
        <div>
          <h2 className="text-xl font-black text-main-text flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-honey" />
            شاشة التقارير والتحليلات البيانية الذكية
          </h2>
          <p className="text-xs text-sec-text mt-1 text-right">مراقبة الأداء الربحي، جرد الذمم والديون المتبقية، وتحليل الأصناف الرائجة.</p>
        </div>

        <button
          onClick={loadReports}
          disabled={loading}
          className="bg-sec-bg border border-border-val text-main-text hover:bg-side-active p-2.5 rounded-xl cursor-pointer transition-colors"
          title="تحديث البيانات"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {errorMessage && (
        <div className="bg-danger-val/10 border border-danger-val/20 text-danger-val rounded-xl p-4 text-xs">
          {errorMessage}
        </div>
      )}

      {/* Date Period Selector */}
      <div className="bg-card-bg border border-border-val rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm transition-colors duration-200">
        <div className="flex items-center gap-2 text-xs font-bold text-honey">
          <Calendar className="w-4 h-4 text-honey" />
          تحديد المدى الزمني للتقارير الاستقصائية:
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs text-sec-text w-full sm:w-auto">
            <span>من تاريخ:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-soft-card border border-border-val focus:border-honey text-main-text text-xs px-3 py-2 rounded-xl outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-sec-text w-full sm:w-auto">
            <span>إلى تاريخ:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-soft-card border border-border-val focus:border-honey text-main-text text-xs px-3 py-2 rounded-xl outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 bg-card-bg border border-border-val rounded-2xl shadow-sm">
          <div className="w-10 h-10 border-4 border-t-honey border-border-val rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-sec-text">جاري تجميع البيانات المالية التاريخية للمبيعات والربحية...</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Section 1: Overview Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Total Revenue YER */}
            <div className="bg-card-bg border border-border-val p-5 rounded-2xl shadow-sm transition-colors duration-200">
              <span className="text-[11px] text-sec-text block font-bold">إجمالي إيراد المبيعات (يمني)</span>
              <div className="text-xl font-mono font-black text-honey mt-3">
                {formatNumber(overview?.total_sales_yer || 0)} <span className="text-xs font-sans text-main-text">ر.ي</span>
              </div>
              <p className="text-[10px] text-sec-text mt-1.5 border-t border-border-val/50 pt-1.5 font-mono">
                {formatNumber(overview?.total_sales_sar || 0)} SAR / {formatNumber(overview?.total_sales_usd || 0)} USD
              </p>
            </div>

            {/* Total Profit */}
            <div className="bg-card-bg border border-border-val p-5 rounded-2xl shadow-sm transition-colors duration-200">
              <span className="text-[11px] text-success-val block font-bold">صافي أرباح مبيعات العسل التقديري</span>
              <div className="text-xl font-mono font-black text-success-val mt-3 font-black">
                +{formatNumber(overview?.estimated_profit_yer || 0)} <span className="text-xs font-sans text-main-text">ر.ي</span>
              </div>
              <p className="text-[9.5px] text-sec-text mt-1.5 border-t border-border-val/50 pt-1.5 leading-snug">
                احتسابات فورية تعتمد على خصم تكلفة الشراء من سعر مبيع الصنف.
              </p>
            </div>

            {/* Invoices Count */}
            <div className="bg-card-bg border border-border-val p-5 rounded-2xl shadow-sm transition-colors duration-200">
              <span className="text-[11px] text-sec-text block font-bold">حجم الفواتير والمعاملات بالفترة</span>
              <div className="text-3xl font-mono font-black text-main-text mt-2">
                {Number(overview?.transactions_count || 0)}
              </div>
              <p className="text-[9.5px] text-sec-text mt-1">مبيعات ومشتريات وسندات في الدفتر</p>
            </div>

            {/* Active Customers */}
            <div className="bg-card-bg border border-border-val p-5 rounded-2xl shadow-sm transition-colors duration-200">
              <span className="text-[11px] text-sec-text block font-bold">العملاء النشيطون المسجلون</span>
              <div className="text-3xl font-mono font-black text-main-text mt-2">
                {Number(overview?.active_customers_count || 0)}
              </div>
              <p className="text-[9.5px] text-sec-text mt-1">أعضاء المحفظة التجارية الدائمين</p>
            </div>

          </div>

          {/* Section 2: Detailed reports (Top sold products, list of debtors) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Top Honey sales chart simulation */}
            <div className="bg-card-bg border border-border-val p-5 rounded-2xl space-y-4 shadow-sm transition-colors duration-200">
              <h3 className="text-sm font-black text-main-text flex items-center gap-1.5 pb-2 border-b border-border-val/60">
                <ShoppingBag className="w-4 h-4 text-honey" />
                تقرير جرد السلع والأصناف الأكثر مبيعاً ورواجاً
              </h3>

              {topProducts.length > 0 ? (
                <div className="space-y-3 font-semibold">
                  {topProducts.map((p, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs text-main-text">
                        <span className="font-bold">{idx + 1}. {p.product_name}</span>
                        <span className="font-mono text-honey font-black">{p.total_quantity || p.quantity || 0} كجم</span>
                      </div>
                      
                      {/* Bar progress graph simulation */}
                      <div className="w-full h-2 bg-soft-card rounded-full overflow-hidden border border-border-val/50">
                        <div 
                          className="h-full rounded-full bg-honey" 
                          style={{ width: `${Math.min(100, Math.max(12, (p.total_raw_percentage || (10 - idx) * 10)))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-xs text-sec-text">لا توجد بيانات متاحة لعرض أصناف العسل المبيعة.</div>
              )}
            </div>

            {/* Customer debts statistics */}
            <div className="bg-card-bg border border-border-val p-5 rounded-2xl space-y-4 shadow-sm transition-colors duration-200">
              <h3 className="text-sm font-black text-main-text flex items-center gap-1.5 pb-2 border-b border-border-val/60">
                <UserX className="w-4 h-4 text-danger-val" />
                أبرز كشوف العملاء أصحاب الذمم والمديونيات العالية
              </h3>

              {debtors.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="text-sec-text border-b border-border-val pb-2 font-bold">
                        <th className="py-2">الاسم</th>
                        <th className="py-2 text-danger-val">آجل متبقي (يمني)</th>
                        <th className="py-2 font-mono">سعودي SAR</th>
                        <th className="py-2 font-mono">دولار USD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-val/40 font-mono text-xs">
                      {debtors.map((c, idx) => (
                        <tr key={`${c.customer_id}-${idx}`} className="hover:bg-table-hover transition-colors">
                          <td className="py-2 px-1 text-main-text font-sans font-extrabold">{c.customer_name}</td>
                          <td className="py-2 text-danger-val font-black">{formatNumber(c.balance_yer || 0)} YER</td>
                          <td className="py-2 text-main-text font-bold">{formatNumber(c.balance_sar || 0)}</td>
                          <td className="py-2 text-main-text font-bold">{formatNumber(c.balance_usd || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-xs text-sec-text">لا يتوفر عملاء مدينون حالياً بالفحوصات الجردية.</div>
              )}
            </div>

          </div>

          {/* Section 3: Daily financial recap (Report for specific custom day) */}
          <div className="bg-card-bg border border-border-val p-5 rounded-2xl space-y-4 shadow-sm transition-colors duration-200">
            <h3 className="text-sm font-black text-main-text flex items-center gap-1.5 pb-2 border-b border-border-val/60">
              <FileSpreadsheet className="w-4 h-4 text-success-val" />
              تقرير الحركات المالية التفصيلي لليوم المالي المحدد: ({dateTo})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="bg-soft-card p-4 rounded-xl border border-border-val">
                <span className="text-[10px] text-sec-text block font-bold">مجموع مبيعات اليوم المالي:</span>
                <strong className="text-md font-mono text-honey mt-1 block font-black">
                  {formatNumber(dailyStats?.sales_total_yer || 0)} YER
                </strong>
                <p className="text-[9.5px] text-sec-text mt-1 space-y-0.5">
                  <span>{formatNumber(dailyStats?.sales_total_sar || 0)} SAR</span>
                  <span className="block">{formatNumber(dailyStats?.sales_total_usd || 0)} USD</span>
                </p>
              </div>

              <div className="bg-soft-card p-4 rounded-xl border border-border-val">
                <span className="text-[10px] text-success-val block font-bold">مقبوضات كاش الصناديق:</span>
                <strong className="text-md font-mono text-success-val mt-1 block font-black">
                  {formatNumber(dailyStats?.cash_received_yer || 0)} YER
                </strong>
                <p className="text-[9.5px] text-sec-text mt-1 space-y-0.5">
                  <span>{formatNumber(dailyStats?.cash_received_sar || 0)} SAR</span>
                  <span className="block">{formatNumber(dailyStats?.cash_received_usd || 0)} USD</span>
                </p>
              </div>

              <div className="bg-soft-card p-4 rounded-xl border border-border-val font-semibold">
                <span className="text-[10px] text-danger-val block font-bold">ديون الآجل الجديد بالفاتورة:</span>
                <strong className="text-md font-mono text-danger-val mt-1 block font-black">
                  {formatNumber(dailyStats?.unpaid_yer || 0)} YER
                </strong>
                <p className="text-[9.5px] text-sec-text mt-1 space-y-0.5">
                  <span>{formatNumber(dailyStats?.unpaid_sar || 0)} SAR</span>
                  <span className="block">{formatNumber(dailyStats?.unpaid_usd || 0)} USD</span>
                </p>
              </div>

            </div>
          </div>

        </div>
      )}

    </div>
  );
}
