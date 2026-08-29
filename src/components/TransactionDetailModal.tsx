import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileText, 
  Calendar, 
  User, 
  Printer, 
  AlertOctagon, 
  CheckCircle2, 
  BadgeAlert, 
  DollarSign, 
  Layers,
  FolderOpen,
  Eye,
  Download
} from 'lucide-react';
import { 
  getTransactionDetail, 
  cancelTransaction, 
  downloadTransactionPdf, 
  normalizeTransactionForUi,
  getMediaForEntity,
  getMediaPublicUrl,
  getMediaSignedUrl
} from '../lib/api';
import { formatNumber } from '../lib/numberUtils';

interface TransactionDetailModalProps {
  transactionId: string | null;
  onClose: () => void;
  onTransactionCancelled?: () => void;
}

export default function TransactionDetailModal({ transactionId, onClose, onTransactionCancelled }: TransactionDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txData, setTxData] = useState<any>(null);
  const [normalized, setNormalized] = useState<any>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Cancellation action states
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (transactionId) {
      loadDetails();
      loadAttachments();
    }
  }, [transactionId]);

  const [attachments, setAttachments] = useState<any[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  const loadAttachments = async () => {
    if (!transactionId) return;
    setLoadingAttachments(true);
    try {
      const res = await getMediaForEntity('transaction', transactionId);
      if (res.data) {
        setAttachments(res.data);
      }
    } catch (err) {
      console.error('Error fetching transaction attachments:', err);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const handlePreviewAttachment = async (doc: any) => {
    try {
      const url = await getMediaSignedUrl(doc.file_path, doc.storage_bucket);
      const lowerType = doc.mime_type?.toLowerCase() || '';
      if (lowerType.includes('image') || lowerType.includes('png') || lowerType.includes('jpg') || lowerType.includes('jpeg') || lowerType.includes('webp')) {
        // Create a clean new popup tab to view image
        const previewWindow = window.open('', '_blank');
        if (previewWindow) {
          previewWindow.document.write(`
            <html>
              <head>
                <title>${doc.title}</title>
                <style>
                  body { margin: 0; background: #0f172a; display: flex; justify-content: center; align-items: center; height: 100vh; }
                  img { max-width: 95%; max-height: 95%; border-radius: 8px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.4); }
                </style>
              </head>
              <body>
                <img src="${url}" referrerPolicy="no-referrer" />
              </body>
            </html>
          `);
        }
      } else {
        window.open(url, '_blank');
      }
    } catch (err: any) {
      alert('حدث خطأ أثناء محاولة معاينة الملف: ' + err.message);
    }
  };

  const handleDownloadAttachment = async (doc: any) => {
    try {
      const url = await getMediaSignedUrl(doc.file_path, doc.storage_bucket);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.file_name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('حدث خطأ أثناء محاولة تحميل الملف: ' + err.message);
    }
  };

  const loadDetails = async () => {
    if (!transactionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getTransactionDetail(transactionId);
      if (res.error) throw new Error(res.error);
      
      const details = Array.isArray(res.data) ? res.data[0] : res.data;
      setTxData(details);
      
      if (details) {
        const norm = normalizeTransactionForUi(details);
        setNormalized(norm);
      }
    } catch (err: any) {
      setError(err.message || 'فشل تحميل تفاصيل العملية');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!transactionId) return;
    setLoadingPdf(true);
    try {
      const res = await downloadTransactionPdf(transactionId);
      if (res.error) {
        alert(res.error);
      }
    } catch (err: any) {
      alert('فشل طباعة المستند: ' + err.message);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionId) return;
    if (!cancelReason.trim()) {
      alert('يرجى إدخال سبب الإلغاء للاستمرار.');
      return;
    }

    setCancelling(true);
    try {
      // Call cancel RPC
      const res = await cancelTransaction(transactionId, cancelReason.trim());
      if (res.error) {
        throw new Error(res.error);
      }

      alert('تم إلغاء العملية المالية بنجاح وعكس رصيدها.');
      setShowCancelConfirm(false);
      setCancelReason('');
      
      // Reload details from server to ensure fresh state
      await loadDetails();
      
      // Trigger callback to reload outer views
      if (onTransactionCancelled) {
        onTransactionCancelled();
      }
    } catch (err: any) {
      alert('فشل إلغاء العملية: ' + err.message);
    } finally {
      setCancelling(false);
    }
  };

  if (!transactionId) return null;

  // Resolve transaction type human labels
  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'sales_invoice': return 'فاتورة مبيعات 🛒';
      case 'receipt_voucher': return 'سند قبض 📥';
      case 'payment_voucher': return 'سند صرف 📤';
      case 'simple_entry': return 'قيد بسيط 📝';
      default: return type || 'عملية مالية';
    }
  };

  const transactionObj = txData?.transaction || txData || {};
  const status = transactionObj.transaction_status || 'active';
  const reason = transactionObj.cancel_reason || '';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white border border-border-val rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-border-val/70 bg-gray-50 flex items-center justify-between">
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="text-right">
            <h3 className="text-sm font-black text-main-text">تفاصيل العملية المالية</h3>
            <p className="text-[10px] font-mono text-sec-text mt-0.5">رقم المرجع: {normalized?.transaction_no || 'بدون'}</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-right">
          
          {loading && (
            <div className="py-12 text-center text-xs font-bold text-sec-text">
              <span className="inline-block animate-spin mr-2">⏳</span> جاري جلب تفاصيل العملية والمطابقة المباشرة...
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-xs font-bold">
              {error}
            </div>
          )}

          {!loading && normalized && (
            <>
              {/* Status Header Block */}
              <div className={`p-4 rounded-xl border ${
                status === 'cancelled' 
                  ? 'bg-red-50/70 border-red-200 text-red-900' 
                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              } flex items-center justify-between`}>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider block opacity-75">حالة السند</span>
                  <span className="text-xs font-black mt-0.5 block">
                    {status === 'cancelled' ? 'ملغي ومسترجع ✕' : 'نشط ومعتمد ✓'}
                  </span>
                </div>
                {status === 'cancelled' ? (
                  <BadgeAlert className="w-5 h-5 text-red-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
              </div>

              {/* Cancel Reason Display */}
              {status === 'cancelled' && reason && (
                <div className="bg-red-50 border border-red-100 p-3 rounded-xl space-y-1">
                  <span className="text-[10px] font-black text-red-700 block">سبب الإلغاء المسجل:</span>
                  <p className="text-xs font-bold text-red-900 leading-relaxed">
                    {reason}
                  </p>
                </div>
              )}

              {/* Main Fields Card */}
              <div className="bg-white border border-border-val rounded-2xl p-4.5 space-y-3.5 text-xs">
                
                <div className="flex justify-between items-center pb-2.5 border-b border-border-val/40">
                  <span className="text-sec-text font-bold">نوع المستند:</span>
                  <span className="bg-honey/10 text-honey font-black px-2.5 py-0.5 rounded-lg border border-honey/20">
                    {getTransactionTypeLabel(normalized.transaction_type)}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2.5 border-b border-border-val/40">
                  <span className="text-sec-text font-bold">اسم الحساب/الطرف الثاني:</span>
                  <span className="text-main-text font-black text-sm">{normalized.customer_name}</span>
                </div>

                {normalized.customer_phone && (
                  <div className="flex justify-between items-center pb-2.5 border-b border-border-val/40">
                    <span className="text-sec-text font-bold">رقم الجوال:</span>
                    <span className="text-main-text font-mono font-bold select-all">{normalized.customer_phone}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pb-2.5 border-b border-border-val/40">
                  <span className="text-sec-text font-bold">التاريخ والوقت:</span>
                  <span className="text-main-text font-mono font-bold">
                    {normalized.transaction_datetime ? new Date(normalized.transaction_datetime).toLocaleString('ar-SA') : 'غير محدد'}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2.5 border-b border-border-val/40">
                  <span className="text-sec-text font-bold">المبلغ الإجمالي:</span>
                  <span className="text-emerald-700 font-black text-base font-mono">
                    {formatNumber(normalized.total_amount)} {normalized.currency}
                  </span>
                </div>

                {normalized.notes && (
                  <div className="pt-2 text-right">
                    <span className="text-sec-text font-bold block mb-1">البيان/الملاحظات:</span>
                    <p className="bg-gray-50 p-3 rounded-xl border border-border-val text-main-text font-bold whitespace-pre-wrap leading-relaxed">
                      {normalized.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Items Table if available */}
              {normalized.items && normalized.items.length > 0 && (
                <div className="space-y-2 text-right">
                  <span className="text-[11px] font-black text-sec-text block">الأصناف المدرجة بالسند:</span>
                  <div className="border border-border-val rounded-xl overflow-hidden text-[11px]">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-border-val font-black text-sec-text">
                          <th className="p-2 text-right">الصنف</th>
                          <th className="p-2 text-center">الكمية</th>
                          <th className="p-2 text-left">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-val/50 font-bold">
                        {normalized.items.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="p-2 text-main-text">{item.product_name} <span className="text-[10px] text-sec-text">({item.unit_name})</span></td>
                            <td className="p-2 text-center font-mono">{item.quantity}</td>
                            <td className="p-2 text-left font-mono text-emerald-700">{formatNumber(item.line_total)} {normalized.currency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Transaction Attachments Section */}
              <div className="bg-gray-50 border border-border-val/70 rounded-xl p-3.5 space-y-3 text-right">
                <div className="flex items-center justify-between border-b border-border-val/45 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-honey" />
                    <span className="text-[11px] font-black text-main-text">المرفقات والوثائق المصورة للعملية</span>
                  </div>
                  <span className="text-[10px] text-sec-text font-bold font-mono bg-white border border-border-val/60 px-1.5 py-0.5 rounded-md">
                    {attachments.length} مرفق
                  </span>
                </div>

                {loadingAttachments ? (
                  <div className="flex items-center justify-center py-4 gap-1.5 text-xs text-sec-text">
                    <div className="w-3.5 h-3.5 border-2 border-honey border-t-transparent rounded-full animate-spin" />
                    <span>جاري جلب المرفقات...</span>
                  </div>
                ) : attachments.length === 0 ? (
                  <p className="text-[10px] text-sec-text text-center py-2">
                    لا توجد مرفقات مصورة (كإيصالات تحويل أو فواتير) مرتبطة بهذه العملية حالياً.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((doc) => (
                      <div 
                        key={doc.id} 
                        className="bg-white border border-border-val/70 rounded-lg p-2.5 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-1.5">
                          <h5 className="font-bold text-main-text truncate max-w-[180px]" title={doc.title}>
                            {doc.title}
                          </h5>
                          <span className="text-[9px] text-sec-text font-mono block mt-0.5" dir="ltr">
                            {doc.file_name} ({parseFloat((doc.file_size / 1024).toFixed(1))} KB)
                          </span>
                        </div>

                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handlePreviewAttachment(doc)}
                            className="bg-honey/10 hover:bg-honey/20 text-honey font-black text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-0.5 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>معاينة</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadAttachment(doc)}
                            className="bg-gray-50 hover:bg-gray-100 border border-border-val/60 text-main-text p-1.5 rounded-lg cursor-pointer"
                            title="تحميل"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dynamic Operations & Cancellation Actions */}
              <div className="space-y-4 pt-2 border-t border-border-val/40">
                
                {/* Print and Main operations bar */}
                {!showCancelConfirm && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handlePrintPdf}
                      disabled={loadingPdf}
                      className="flex-1 bg-honey hover:bg-honey-hover text-white font-black py-2.5 px-4 rounded-xl text-xs flex justify-center items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-xs"
                    >
                      <Printer className="w-4 h-4" />
                      <span>{loadingPdf ? 'جاري التوليد والطباعة...' : 'طباعة مستند PDF 🖨️'}</span>
                    </button>

                    {status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowCancelConfirm(true);
                          setCancelReason('');
                        }}
                        className="bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <AlertOctagon className="w-4 h-4" />
                        <span>إلغاء السند</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Elegant, Non-intrusive Inline Confirmation Card for Cancellation */}
                {showCancelConfirm && (
                  <form onSubmit={handleCancelSubmit} className="bg-red-50/60 border border-red-200 rounded-2xl p-4.5 space-y-4 shadow-inner text-right fade-in">
                    <div className="flex items-start gap-2.5">
                      <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-black text-red-950">إلغاء العملية وعكس الأثر المالي</h4>
                        <p className="text-[10.5px] text-red-800 mt-1 leading-relaxed font-semibold">
                          تحذير: سيتم إلغاء السند المالي تمامًا وعكس قيمته من رصيد العميل والصندوق. هذا الإجراء آمن وغير قابل للتراجع وسيتم الاحتفاظ به في سجل التتبع المالي دون حذف فيزيائي.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-red-950">سبب إلغاء العملية المالية (مطلوب) *:</label>
                      <input
                        type="text"
                        required
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="w-full bg-white border border-red-200 rounded-xl py-2 px-3 text-xs font-bold text-main-text focus:border-red-500 outline-none"
                        placeholder="يرجى كتابة سبب الإلغاء بالتفصيل..."
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={!cancelReason.trim() || cancelling}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-black py-2 px-3 rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        {cancelling ? 'جاري الإلغاء المالي...' : 'تأكيد إلغاء السند وعكس الأثر 💾'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCancelConfirm(false);
                          setCancelReason('');
                        }}
                        className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        تراجع
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
}
