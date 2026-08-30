/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  FileDown,
  FileText,
  Loader2,
  Printer,
  Receipt,
  RefreshCw,
  WalletCards
} from 'lucide-react';
import { downloadTransactionPdf, getFrontendTransactionsList } from '../lib/api';
import { TRANSACTION_LABELS } from '../types';
import { formatNumber } from '../lib/numberUtils';

interface DashboardViewProps {
  onNavigateToTrx: () => void;
  onSelectTrx: (id: string) => void;
  onSelectCustomer: (id: string) => void;
}

export default function DashboardView({ onNavigateToTrx, onSelectTrx }: DashboardViewProps) {
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await getFrontendTransactionsList();
      if (res.error) throw new Error(res.error);
      setRecentTransactions((res.data || []).slice(0, 8));
    } catch (error: any) {
      console.error(error);
      setErrorMessage('تعذر تحميل آخر المستندات. يمكنك الاستمرار في إنشاء مستند جديد ثم المحاولة لاحقاً.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePdf = async (tx: any) => {
    if (!tx?.id) return;
    setLoadingPdfId(tx.id);
    try {
      const result = await downloadTransactionPdf(tx);
      if (result?.error) alert('تعذر إنشاء ملف PDF: ' + result.error);
    } catch (error: any) {
      alert('تعذر إنشاء ملف PDF: ' + (error?.message || 'خطأ غير معروف'));
    } finally {
      setLoadingPdfId(null);
    }
  };

  const actions = [
    {
      title: 'فاتورة بيع',
      description: 'إنشاء فاتورة نقدية أو آجلة وإضافة الأصناف والكميات.',
      icon: FileText,
      onClick: onNavigateToTrx,
      accent: 'text-emerald-700 bg-emerald-50 border-emerald-100'
    },
    {
      title: 'سند قبض',
      description: 'افتح شاشة المستندات واختر «سند قبض» لتسجيل التحصيل.',
      icon: Receipt,
      onClick: onNavigateToTrx,
      accent: 'text-blue-700 bg-blue-50 border-blue-100'
    },
    {
      title: 'سند صرف',
      description: 'افتح شاشة المستندات واختر «سند صرف» لتسجيل المدفوعات.',
      icon: WalletCards,
      onClick: onNavigateToTrx,
      accent: 'text-rose-700 bg-rose-50 border-rose-100'
    },
    {
      title: 'التقارير والطباعة',
      description: 'راجع المستندات السابقة ثم اطبع أو نزّل PDF مباشرة.',
      icon: Printer,
      onClick: () => document.getElementById('recent-documents')?.scrollIntoView({ behavior: 'smooth' }),
      accent: 'text-amber-700 bg-amber-50 border-amber-100'
    }
  ];

  return (
    <div className="space-y-7 fade-in pb-10">
      <section className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-main-text">مركز المستندات المالية</h2>
          <p className="text-xs text-sec-text mt-1.5 leading-6">
            شاشة تشغيل مختصرة لإنشاء الفواتير والسندات ومراجعتها وطباعتها.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="shrink-0 w-10 h-10 rounded-xl border border-border-val bg-card-bg text-sec-text hover:text-honey hover:bg-soft-card flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
          title="تحديث"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.title}
              type="button"
              onClick={action.onClick}
              className="group text-right bg-card-bg border border-border-val rounded-2xl p-5 hover:border-honey/50 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${action.accent}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <ArrowLeft className="w-4 h-4 text-sec-text group-hover:text-honey group-hover:-translate-x-1 transition-all" />
              </div>
              <h3 className="text-base font-black text-main-text mt-5">{action.title}</h3>
              <p className="text-[11px] text-sec-text mt-1.5 leading-5">{action.description}</p>
            </button>
          );
        })}
      </section>

      <section id="recent-documents" className="bg-card-bg border border-border-val rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border-val flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-main-text">آخر الفواتير والسندات</h3>
            <p className="text-[10px] text-sec-text mt-1">افتح أي مستند للمراجعة أو استخدم زر PDF للطباعة.</p>
          </div>
          <BarChart3 className="w-5 h-5 text-honey" />
        </div>

        {errorMessage && (
          <div className="m-4 p-3 rounded-xl bg-danger-val/10 border border-danger-val/20 text-danger-val text-xs">
            {errorMessage}
          </div>
        )}

        {loading && recentTransactions.length === 0 ? (
          <div className="py-14 flex items-center justify-center text-sec-text text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            جاري تحميل المستندات...
          </div>
        ) : recentTransactions.length === 0 ? (
          <div className="py-14 text-center text-sec-text text-xs">لا توجد مستندات لعرضها حالياً.</div>
        ) : (
          <div className="divide-y divide-border-val/60">
            {recentTransactions.map((tx: any, index: number) => (
              <div key={`${tx.id || 'tx'}-${index}`} className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-soft-card/60 transition-colors">
                <button
                  type="button"
                  onClick={() => tx.id && onSelectTrx(tx.id)}
                  className="flex-1 min-w-0 text-right cursor-pointer"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-black text-honey">{tx.transaction_no || '—'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-soft-card border border-border-val text-sec-text font-bold">
                      {TRANSACTION_LABELS[tx.transaction_type as keyof typeof TRANSACTION_LABELS] || tx.transaction_type || 'مستند'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="font-bold text-main-text">{tx.party_name || 'عام'}</span>
                    <span className="font-mono text-main-text">
                      {formatNumber(tx.total_amount || 0)} {tx.currency || ''}
                    </span>
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => tx.id && onSelectTrx(tx.id)}
                    className="px-3 py-2 rounded-lg border border-border-val text-[10px] font-black text-main-text hover:bg-soft-card transition-colors cursor-pointer"
                  >
                    فتح
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePdf(tx)}
                    disabled={loadingPdfId === tx.id}
                    className="px-3 py-2 rounded-lg bg-honey text-white text-[10px] font-black flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                  >
                    {loadingPdfId === tx.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
