/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Receipt, 
  Filter, 
  Calendar, 
  Trash2, 
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ExternalLink,
  FileText,
  Loader2,
  MoreHorizontal
} from 'lucide-react';
import { getFrontendTransactionsList, downloadTransactionPdf } from '../lib/api';
import { TRANSACTION_LABELS, CURRENCY_LABELS, CurrencyType, TransactionType } from '../types';
import { formatNumber, formatMoney, normalizeDigits } from '../lib/numberUtils';

interface TransactionsViewProps {
  onSelectTrx: (id: string) => void;
  refreshTrigger?: number;
}

export default function TransactionsView({ onSelectTrx, refreshTrigger }: TransactionsViewProps) {
  const [loading, setLoading] = useState(false);
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);

  const handleTransactionPdfPrint = async (txId: string) => {
    if (loadingPdfId) return;
    setLoadingPdfId(txId);
    try {
      const { success, error } = await downloadTransactionPdf(txId);
      if (error) {
        alert('تعذر إنشاء ملف PDF الخاص بالعملية: ' + error);
      }
    } catch (err: any) {
      alert('حدث خطأ أثناء طباعة PDF: ' + err.message);
    } finally {
      setLoadingPdfId(null);
    }
  };

  // Filters inputs State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCurrency, setFilterCurrency] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');

  useEffect(() => {
    loadTransactions();
  }, [refreshTrigger]);

  // Apply filters whenever inputs change
  useEffect(() => {
    let result = [...rawTransactions];

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
          (t.transaction_no || '').toLowerCase().includes(q) ||
          (t.party_name || '').toLowerCase().includes(q) ||
          (t.party_phone || '').includes(q)
      );
    }

    if (filterType !== 'all') {
      result = result.filter(t => t.transaction_type === filterType);
    }

    if (filterCurrency !== 'all') {
      result = result.filter(t => t.currency === filterCurrency);
    }

    if (filterStatus !== 'all') {
      result = result.filter(t => t.status === filterStatus);
    }

    if (filterDate !== '') {
      result = result.filter(t => t.created_at?.startsWith(filterDate));
    }

    setFilteredTransactions(result);
  }, [searchQuery, filterType, filterCurrency, filterStatus, filterDate, rawTransactions]);

  const loadTransactions = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await getFrontendTransactionsList();
      if (error) throw new Error(error);
      setRawTransactions(data || []);
      setFilteredTransactions(data || []);
    } catch (err: any) {
      setErrorMessage('تعذر تحميل سجل المعاملات اليومية: ' + (err?.message || 'خطأ اتصال'));
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setFilterCurrency('all');
    setFilterStatus('all');
    setFilterDate('');
  };

  return (
    <div className="space-y-6 fade-in pb-12">
      
      {/* Title */}
      <div className="flex justify-between items-center bg-card-bg p-5 rounded-2xl border border-border-val shadow-sm transition-colors duration-200">
        <div>
          <h2 className="text-xl font-black text-main-text flex items-center gap-2">
            <Receipt className="w-5 h-5 text-honey" />
            سجل العمليات اليومية العام لقسم المعاملات
          </h2>
          <p className="text-xs text-sec-text mt-1 text-right">متابعة الفواتير والقيود والسندات النشطة والملغاة وتصدير مستنداتها المعتمدة.</p>
        </div>

        <button
          onClick={loadTransactions}
          disabled={loading}
          className="bg-sec-bg border border-border-val text-main-text hover:bg-side-active p-2.5 rounded-xl cursor-pointer transition-colors"
          title="تحديث الجدول"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {errorMessage && (
        <div className="bg-danger-val/10 border border-danger-val/20 text-danger-val rounded-xl p-4 text-xs">
          {errorMessage}
        </div>
      )}

      {/* Multi-Filter Bar panel */}
      <div className="bg-card-bg border border-border-val rounded-2xl p-5 space-y-4 shadow-sm transition-colors duration-200">
        <div className="flex items-center gap-2 text-xs font-black text-honey pb-2 border-b border-border-val/60">
          <SlidersHorizontal className="w-4 h-4 text-honey" />
          تصفية وفلترة القيود والمستندات المالية
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
          
          {/* Quick query Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الفاتورة، العميل..."
              className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text placeholder-sec-text/75 text-xs py-2.5 pl-3 pr-9 rounded-xl outline-none transition-colors"
            />
            <Search className="w-3.5 h-3.5 text-sec-text absolute right-3 top-1/2 -translate-y-1/2" />
          </div>

          {/* Op type selection */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-soft-card border border-border-val text-main-text rounded-xl text-xs py-2 px-3 outline-none focus:border-honey transition-all"
          >
            <option value="all">جميع أنواع العمليات</option>
            {Object.entries(TRANSACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v} ({k})</option>
            ))}
          </select>

          {/* Currency selection */}
          <select
            value={filterCurrency}
            onChange={(e) => setFilterCurrency(e.target.value)}
            className="bg-soft-card border border-border-val text-main-text rounded-xl text-xs py-2 px-3 outline-none focus:border-honey transition-all"
          >
            <option value="all">جميع العملات (YER/SAR/USD)</option>
            <option value="YER">ريال يمني YER</option>
            <option value="SAR">ريال سعودي SAR</option>
            <option value="USD">دولار أمريكي USD</option>
          </select>

          {/* State check */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-soft-card border border-border-val text-main-text rounded-xl text-xs py-2 px-3 outline-none focus:border-honey transition-all"
          >
            <option value="all">حالة العملية (الكل)</option>
            <option value="active">نشطة ومقيدة</option>
            <option value="cancelled">ملغاة ومفسوخة</option>
          </select>

          {/* Specific date selection */}
          <div className="relative">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text text-xs py-2.5 px-3 rounded-xl outline-none transition-all"
            />
          </div>

        </div>

        {/* Clear filter triggers */}
        {(searchQuery || filterType !== 'all' || filterCurrency !== 'all' || filterStatus !== 'all' || filterDate) && (
          <div className="flex justify-end pt-2">
            <button
              onClick={clearFilters}
              className="text-xs text-danger-val font-bold hover:underline cursor-pointer"
            >
              إلغاء وضع الفلترة الحالي وعرض كل المستندات
            </button>
          </div>
        )}

      </div>

      {/* Main ledger journal table */}
      <div className="bg-card-bg border border-border-val rounded-2xl p-5 overflow-hidden shadow-sm transition-colors duration-200">
        {loading ? (
          <div className="text-center py-16">
            <div className="w-10 h-10 border-4 border-t-honey border-border-val rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-sec-text">جاري تحميل ومطابقة كشوف العمليات المضمونة...</p>
          </div>
        ) : filteredTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="text-sec-text border-b border-border-val pb-2 text-right">
                  <th className="py-3 px-3 font-bold">رقم القيد</th>
                  <th className="py-3 px-3 font-bold">تاريخ القيد</th>
                  <th className="py-3 px-3 font-bold">نوع العملية</th>
                  <th className="py-3 px-3 font-bold">العميل</th>
                  <th className="py-3 px-3 font-bold">المجموع المالي</th>
                  <th className="py-3 px-3 font-bold">المدفوع نقداً</th>
                  <th className="py-3 px-3 font-bold">باقي الآجل</th>
                  <th className="py-3 px-3 font-bold">حالة العملية</th>
                  <th className="py-3 px-3 text-center font-bold">تفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-val/40">
                {filteredTransactions.map((tx, idx) => {
                  const remaining = Number(tx.total_amount) - Number(tx.paid_amount);
                  const isCancelled = tx.status === 'cancelled';
                  return (
                    <tr key={`${tx.id || 'tx'}-${idx}`} className="hover:bg-table-hover transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-honey select-all">{tx.transaction_no}</td>
                      <td className="py-3 px-3 font-mono text-sec-text">
                        {tx.created_at ? new Date(tx.created_at).toLocaleDateString('ar-YE-u-nu-latn') : 'مؤخراً'}
                      </td>
                      <td className="py-3 px-3 font-extrabold text-main-text">
                        {TRANSACTION_LABELS[tx.transaction_type as keyof typeof TRANSACTION_LABELS] || tx.transaction_type}
                      </td>
                      <td className="py-3 px-3 text-sec-text">{tx.party_name || 'زبون عام'}</td>
                      <td className="py-3 px-3 font-mono font-black text-main-text select-all">
                        {formatMoney(tx.total_amount, tx.currency)}
                      </td>
                      <td className="py-3 px-3 font-mono text-success-val font-bold">
                        {formatMoney(tx.paid_amount, tx.currency)}
                      </td>
                      <td className={`py-3 px-3 font-mono ${remaining > 0 ? 'text-danger-val font-extrabold' : 'text-sec-text'}`}>
                        {remaining > 0 ? formatMoney(remaining, tx.currency) : 'خالص كاش'}
                      </td>
                      <td className="py-3 px-3">
                        {isCancelled ? (
                          <span className="text-danger-val bg-danger-val/10 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold">ملغاة ومفسوخة</span>
                        ) : remaining <= 0 ? (
                          <span className="text-success-val bg-success-val/10 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold">خالص بنجاح</span>
                        ) : tx.paid_amount > 0 ? (
                          <span className="text-warning-val bg-warning-val/10 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold">مسدد جزئي</span>
                        ) : (
                          <span className="text-danger-val bg-danger-val/10 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold">آجل بالكامل</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex gap-1.5 justify-center">
                          <button
                            onClick={() => onSelectTrx(tx.id)}
                            className="bg-[#FFF8E7] hover:bg-[#FFF1CC] text-honey border border-honey/20 px-3 py-1 rounded-lg text-xs cursor-pointer transition-all inline-flex items-center gap-1.5 font-bold"
                            title="عرض تفاصيل العملية وإجراءاتها"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                            <span>التفاصيل والإجراءات</span>
                          </button>
                          
                          <button
                            onClick={() => handleTransactionPdfPrint(tx.id)}
                            disabled={loadingPdfId !== null}
                            className="bg-sec-bg border border-border-val hover:bg-side-active hover:text-honey text-main-text px-3 py-1 rounded-lg text-xs cursor-pointer transition-all inline-flex items-center gap-1.5 font-bold disabled:opacity-50"
                            title="طباعة وتحميل مستند PDF"
                          >
                            {loadingPdfId === tx.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-honey" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-honey" />
                            )}
                            تحميل فاتورة PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 text-sec-text space-y-2">
            <p className="text-xs">لا تتوفر أي معاملات أو فواتير مطابقة للخيارات المدخلة.</p>
            <button
              onClick={clearFilters}
              className="text-honey hover:underline text-xs font-bold"
            >
              اضغط لإلغاء جميع الفلاتر وعرض الكل
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
