/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  ShieldAlert,
  Database
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isFallback: boolean;
  onToggleFallback: () => void;
  pendingMsgCount: number;
}

export default function Sidebar({ currentTab, setCurrentTab, isFallback, onToggleFallback, pendingMsgCount }: SidebarProps) {
  return (
    <aside className="hidden lg:flex w-64 bg-side-bg border-l border-border-val flex-col justify-between h-screen sticky top-0 text-main-text z-20 transition-colors duration-200">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-border-val flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-honey text-white flex items-center justify-center font-bold text-lg shadow-md shadow-honey/10">
              🍯
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-honey">باحكم للعسل</h1>
              <p className="text-[10px] text-sec-text">مبيعات عسل وقيود مالية يومية</p>
            </div>
          </div>
        </div>
      </div>

      {/* Database/Sync Status Indicator footer */}
      <div className="p-4 border-t border-border-val bg-soft-card">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-sec-text">حالة اتصال النظام:</span>
          {isFallback ? (
            <span className="text-danger-val flex items-center gap-1 font-bold bg-danger-val/10 px-2 py-0.5 rounded-md">
              <ShieldAlert className="w-3.5 h-3.5" />
              محاكاة محليـة
            </span>
          ) : (
            <span className="text-success-val flex items-center gap-1 font-bold bg-success-val/10 px-2 py-0.5 rounded-md">
              <Database className="w-3.5 h-3.5 text-success-val" />
              متصل مباشر
            </span>
          )}
        </div>


      </div>
    </aside>
  );
}
