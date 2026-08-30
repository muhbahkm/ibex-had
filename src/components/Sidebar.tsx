/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Database,
  FileText,
  Home,
  Printer,
  Receipt,
  ShieldAlert,
  BarChart3,
  PlusCircle
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isFallback: boolean;
  onToggleFallback: () => void;
  pendingMsgCount: number;
}

const navItems = [
  { id: 'dashboard', label: 'الرئيسية', icon: Home },
  { id: 'new-trx', label: 'إنشاء مستند', icon: PlusCircle },
  { id: 'transactions', label: 'الفواتير والسندات', icon: Receipt },
  { id: 'reports', label: 'التقارير', icon: BarChart3 },
];

export default function Sidebar({ currentTab, setCurrentTab, isFallback }: SidebarProps) {
  return (
    <aside className="hidden lg:flex w-64 bg-side-bg border-l border-border-val flex-col justify-between h-screen sticky top-0 text-main-text z-20 transition-colors duration-200">
      <div>
        <div className="p-6 border-b border-border-val">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-honey text-white flex items-center justify-center font-bold text-lg shadow-md shadow-honey/10">
              🍯
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-honey">باحكم للعسل</h1>
              <p className="text-[10px] text-sec-text">الفواتير · السندات · التقارير · الطباعة</p>
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all cursor-pointer ${
                  active
                    ? 'bg-honey text-white font-black shadow-sm'
                    : 'text-main-text hover:bg-soft-card font-bold'
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mx-4 mt-4 p-4 rounded-2xl border border-border-val bg-soft-card">
          <div className="flex items-center gap-2 mb-2">
            <Printer className="w-4 h-4 text-honey" />
            <span className="text-xs font-black">الطباعة</span>
          </div>
          <p className="text-[10.5px] leading-5 text-sec-text">
            افتح أي فاتورة أو سند من «الفواتير والسندات» للطباعة أو تنزيل PDF.
          </p>
        </div>
      </div>

      <div className="p-4 border-t border-border-val bg-soft-card">
        <div className="flex items-center justify-between text-xs">
          <span className="text-sec-text">حالة النظام</span>
          {isFallback ? (
            <span className="text-danger-val flex items-center gap-1 font-bold bg-danger-val/10 px-2 py-1 rounded-md">
              <ShieldAlert className="w-3.5 h-3.5" />
              محلي
            </span>
          ) : (
            <span className="text-success-val flex items-center gap-1 font-bold bg-success-val/10 px-2 py-1 rounded-md">
              <Database className="w-3.5 h-3.5" />
              متصل
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
