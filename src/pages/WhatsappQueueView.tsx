/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Search,
  ExternalLink,
  Smartphone,
  Send
} from 'lucide-react';
import { getWhatsappQueue } from '../lib/api';
import { WhatsappQueueItem } from '../types';

export default function WhatsappQueueView() {
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<WhatsappQueueItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await getWhatsappQueue();
      setQueue(res.data || []);
    } catch (err: any) {
      setErrorMessage('تعذر جرد طابور رسائل الواتساب: ' + (err?.message || 'خطأ'));
    } finally {
      setLoading(false);
    }
  };

  const filteredQueue = queue.filter(item => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      (item.recipient_name || '').toLowerCase().includes(q) ||
      (item.recipient_phone || '').includes(q) ||
      (item.message_body || '').toLowerCase().includes(q);
    
    if (filterStatus === 'all') return matchesSearch;
    return matchesSearch && item.status === filterStatus;
  });

  return (
    <div className="space-y-6 fade-in pb-12 text-right">
      
      {/* Header Info */}
      <div className="flex justify-between items-center bg-card-bg p-5 rounded-2xl border border-border-val shadow-sm transition-colors duration-200">
        <div>
          <h2 className="text-xl font-black text-main-text flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-honey" />
            طابور رسائل وإشعارات الواتساب (HAD Queue)
          </h2>
          <p className="text-xs text-sec-text mt-1 text-right">رصد وإدارة الرسائل التلقائية المعلقة وسندات الحساب الجاري إعدادها للإرسال الفعلي عبر n8n.</p>
        </div>

        <button
          onClick={loadQueue}
          disabled={loading}
          className="bg-sec-bg border border-border-val text-main-text hover:bg-side-active p-2.5 rounded-xl cursor-pointer transition-colors"
          title="تحديث القائمة"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {errorMessage && (
        <div className="bg-danger-val/10 border border-danger-val/20 text-danger-val rounded-xl p-4 text-xs">
          {errorMessage}
        </div>
      )}

      {/* Filter and Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-card-bg border border-border-val p-4 rounded-xl shadow-sm transition-colors duration-200">
        
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالنص، العميل، رقم الهاتف..."
            className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text placeholder-sec-text/75 text-xs py-2.5 pl-3 pr-9 rounded-xl outline-none transition-colors"
          />
          <Search className="w-4 h-4 text-sec-text absolute right-3 top-1/2 -translate-y-1/2" />
        </div>

        {/* Status selection */}
        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full bg-soft-card border border-border-val text-main-text rounded-xl text-xs py-2.5 px-3 outline-none focus:border-honey transition-colors"
          >
            <option value="all">جميع حالات الإرسال (الكل)</option>
            <option value="pending">قيد الانتظار بالتلقائي (pending)</option>
            <option value="sent">تم الإرسال بنجاح للمستلم (sent)</option>
            <option value="failed">أخفق الإرسال (failed)</option>
          </select>
        </div>

        {/* Total stats */}
        <div className="text-left text-[11px] text-sec-text font-mono">
          إجمالي الإشعارات بالطابور: <span className="text-main-text bg-sec-bg border border-border-val/30 px-2.5 py-1 rounded font-black text-xs">{filteredQueue.length}</span> رسائل.
        </div>

      </div>

      {/* Main Table view of Whatsapp Queue */}
      <div className="bg-card-bg border border-border-val rounded-2xl overflow-hidden p-5 shadow-sm transition-colors duration-200">
        {loading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-t-honey border-border-val rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-sec-text">جاري تحميل كشوف طابور الواتساب المصفاة من قاعدة البيانات...</p>
          </div>
        ) : filteredQueue.length > 0 ? (
          <div className="space-y-4">
            {filteredQueue.map((msg, idx) => {
              const isPending = msg.status === 'pending';
              const isSent = msg.status === 'sent';
              
              return (
                <div 
                  key={`${msg.id || 'msg'}-${idx}`}
                  className="bg-soft-card border border-border-val p-4 rounded-xl hover:border-honey/40 transition-colors space-y-3"
                >
                  {/* Message Metadata Header */}
                  <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-border-val/40">
                    <div className="flex items-center gap-2">
                      <span className="p-1 px-2.5 bg-sec-bg border border-border-val text-main-text text-[10px] font-black rounded-lg font-mono">
                        {msg.message_type || 'صيانة المبيعات'}
                      </span>
                      
                      <div className="flex items-center gap-1.5 text-xs font-black text-main-text">
                        <span>{msg.recipient_name || 'زبون عام'}</span>
                        <span className="text-[11px] text-sec-text font-mono font-normal">({msg.recipient_phone})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Created date */}
                      <span className="text-[10.5px] font-mono text-sec-text flex items-center gap-1 font-bold">
                        <Clock className="w-3.5 h-3.5 text-sec-text/70" />
                        {new Date(msg.created_at).toLocaleString('ar-YE-u-nu-latn')}
                      </span>

                      {/* Status badge */}
                      {isSent ? (
                        <span className="bg-success-val/10 border border-success-val/20 text-success-val text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          تم الإرسال لـ n8n
                        </span>
                      ) : isPending ? (
                        <span className="bg-warning-val/10 border border-warning-val/20 text-warning-val text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                          <Clock className="w-3 h-3" />
                          بانتظار الصادر
                        </span>
                      ) : (
                        <span className="bg-danger-val/10 border border-danger-val/20 text-danger-val text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          أخفق الربط
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Message Text Block */}
                  <p className="text-xs text-main-text leading-relaxed select-all bg-card-bg p-3 rounded-lg border border-border-val/50 font-mono whitespace-pre-wrap text-right">
                    {msg.message_body}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-sec-text font-semibold">
                    <span className="flex items-center gap-1 text-[10px]">
                      <Smartphone className="w-3.5 h-3.5 text-honey" />
                      بوابة هاتف العميل: <strong className="text-main-text font-mono select-all font-bold">{msg.recipient_phone}</strong>
                    </span>

                    {msg.transaction_id && (
                      <span className="text-[10.5px] text-honey font-bold">
                        معرف العملية المرتبط: <strong className="font-mono text-xs text-main-text font-black">{String(msg.transaction_id).slice(0, 8)}</strong>
                      </span>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-card-bg border border-border-val rounded-2xl text-sec-text shadow-sm">
            <MessageSquare className="w-12 h-12 mx-auto text-sec-text/40 mb-3" />
            <p className="text-xs">طابور رسائل الواتساب الصادرة والواردة فارغ تماماً حالياً.</p>
          </div>
        )}
      </div>

    </div>
  );
}
