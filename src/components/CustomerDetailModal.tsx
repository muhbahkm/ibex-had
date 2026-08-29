import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Phone, 
  BookOpen, 
  MessageSquare, 
  Calendar, 
  AlertCircle,
  FileText,
  Eye,
  Download,
  ExternalLink,
  FolderOpen
} from 'lucide-react';
import { 
  getCustomerDetail, 
  queueCustomerStatementWhatsapp, 
  generateCustomerStatementPdf, 
  printHtmlElement, 
  generatePdfFromHtml, 
  openPrintPreview,
  getMediaForEntity,
  getMediaPublicUrl,
  getMediaSignedUrl
} from '../lib/api';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  invoice_image: 'فاتورة مصورة',
  receipt_voucher_image: 'سند قبض مصور',
  payment_voucher_image: 'سند صرف مصور',
  rent_contract: 'عقد إيجار',
  old_statement: 'كشف حساب قديم',
  supplier_invoice: 'فاتورة مورد',
  transfer_receipt: 'إيصال تحويل',
  customer_document: 'مستند عميل',
  internal_document: 'مستند داخلي',
  other: 'أخرى'
};
import { CURRENCY_LABELS, TRANSACTION_LABELS, CurrencyType } from '../types';
import { formatNumber } from '../lib/numberUtils';

interface CustomerDetailModalProps {
  customerId: string | null;
  onClose: () => void;
}

export default function CustomerDetailModal({ customerId, onClose }: CustomerDetailModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF statement download state
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Dynamic Preferences state for statement generation
  const [showStatementPrefsModal, setShowStatementPrefsModal] = useState(false);
  const [prefsForm, setPrefsForm] = useState({
    period: 'all' as 'all' | 'today' | 'week' | 'month' | 'custom',
    dateFrom: '',
    dateTo: '',
    currency: 'all' as 'all' | 'YER' | 'SAR' | 'USD',
    movementType: 'all' as 'all' | 'invoices' | 'receipts' | 'active_only',
    displayStyle: 'detailed' as 'detailed' | 'summary' | 'customer_friendly',
    showZeroBalances: true,
    showCancelled: true,
    showAdminNotes: true,
    showCustomerSummary: true,
    reportTitle: 'كشف حساب مالي ومطابقة',
    audience: 'customer' as 'customer' | 'internal',
    includeInvoiceDetails: true
  });

  // Pre-fill statement title when data is loaded
  useEffect(() => {
    if (data?.customer?.customer_name) {
      setPrefsForm(p => ({
        ...p,
        reportTitle: `كشف حساب مالي - ${data.customer.customer_name}`
      }));
    }
  }, [data]);

  const handlePrintStatementPdf = async (customOptions?: any) => {
    if (!customerId) return;
    setLoadingPdf(true);
    try {
      const activeOptions = customOptions || prefsForm;
      const { data: pdfData, error: pdfError } = await generateCustomerStatementPdf(customerId, activeOptions);
      if (pdfError) {
        alert('أخفق تحميل كشف الحساب: ' + pdfError);
        return;
      }
      
      if (pdfData === 'STATION_DOWNLOADED') {
        return;
      }

      const custName = data?.customer?.customer_name || 'العميل';
      const todayStr = new Date().toISOString().slice(0, 10).replace(/[^0-9]/g, '');
      const formattedTitle = (activeOptions.reportTitle || 'كشف_حساب').trim().replace(/\s+/g, '_');
      const fileName = `statement-${custName}-${formattedTitle}-${todayStr}.pdf`;

      const webhookUrl = import.meta.env.VITE_PDF_RENDER_WEBHOOK_URL;
      if (webhookUrl) {
        await generatePdfFromHtml({
          html: pdfData!,
          fileName,
          documentType: 'customer_statement',
          metadata: {
            customer_id: customerId,
            customer_name: custName,
            options: activeOptions
          }
        });
      } else {
        openPrintPreview(pdfData!);
      }
    } catch (e: any) {
      alert('خطأ أثناء توليد المستند: ' + (e.message || JSON.stringify(e)));
    } finally {
      setLoadingPdf(false);
    }
  };

  // Statement sending states
  const [sendingCurrency, setSendingCurrency] = useState<CurrencyType>('YER');
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendingLoader, setSendingLoader] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    loadCustomer();
    loadCustomerMedia();
  }, [customerId]);

  const [customerMedia, setCustomerMedia] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  const loadCustomerMedia = async () => {
    if (!customerId) return;
    setLoadingMedia(true);
    try {
      const res = await getMediaForEntity('customer', customerId);
      if (res.data) {
        setCustomerMedia(res.data);
      }
    } catch (err) {
      console.error('Error fetching customer media:', err);
    } finally {
      setLoadingMedia(false);
    }
  };

  const handlePreviewMedia = async (doc: any) => {
    try {
      const url = await getMediaSignedUrl(doc.file_path, doc.storage_bucket);
      const lowerType = doc.mime_type?.toLowerCase() || '';
      if (lowerType.includes('image') || lowerType.includes('png') || lowerType.includes('jpg') || lowerType.includes('jpeg') || lowerType.includes('webp')) {
        // Open image in a beautiful centered floating preview
        const previewWindow = window.open('', '_blank');
        if (previewWindow) {
          previewWindow.document.write(`
            <html>
              <head>
                <title>${doc.title}</title>
                <style>
                  body { margin: 0; background: #0b0f19; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; }
                  img { max-width: 95%; max-height: 95%; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); }
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

  const handleDownloadMedia = async (doc: any) => {
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

  const loadCustomer = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCustomerDetail(customerId!);
      if (res.error) throw new Error(res.error);
      setData(res.data);
    } catch (err: any) {
      setError(err?.message || 'خطأ في جلب بيانات حركة حساب العميل');
    } finally {
      setLoading(false);
    }
  };

  const handleSendStatement = async () => {
    setSendingLoader(true);
    setSendSuccess(false);
    try {
      const { data: qData, error } = await queueCustomerStatementWhatsapp(customerId!, sendingCurrency);
      if (error) {
        alert('أخفق إرسال كشف الحساب: ' + error);
      } else {
        setSendSuccess(true);
        setTimeout(() => setSendSuccess(false), 5000);
      }
    } catch (err: any) {
      alert('خطأ في العملية: ' + err.message);
    } finally {
      setSendingLoader(false);
    }
  };

  if (!customerId) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-[#FCFBFA] border border-[#E9E1D2] rounded-[22px] w-[calc(100vw-24px)] sm:w-full max-w-4xl max-h-[calc(100vh-24px)] sm:max-h-[90vh] flex flex-col shadow-2xl animate-slide-up overflow-hidden text-right"
        dir="rtl"
        style={{ paddingBottom: 'calc(4px + env(safe-area-inset-bottom))' }}
      >
        
        {/* Responsive Header */}
        <div className="p-4 sm:p-5 border-b border-[#EADCBF] bg-[#F8F5EE]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Header left-right layouts for mobile compatibility */}
            <div className="flex items-start justify-between w-full sm:w-auto">
              <div className="flex items-start gap-2.5">
                <User className="w-5 h-5 text-honey shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <h2 className="text-xs sm:text-sm font-black text-main-text leading-tight">
                    كشف الحساب الموحد
                  </h2>
                  <p className="text-xs text-honey font-black font-sans leading-tight">
                    للعميل: <span className="select-all block sm:inline">{data?.customer?.customer_name || '...'}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="text-sec-text hover:text-main-text bg-[#FCFBFA] hover:bg-[#F3ECE0] border border-[#EADCBF] p-2 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4 text-main-text" />
              </button>
            </div>

            {/* Print/Download Button is responsive button below on Mobile, inline on Desktop */}
            <div className="w-full sm:w-auto">
              <button
                onClick={() => setShowStatementPrefsModal(true)}
                disabled={loadingPdf || !data}
                className="w-full sm:w-auto bg-[#D98200] hover:bg-[#C27500] text-white text-xs px-4 py-2.5 sm:py-2 font-black rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-amber-700/10 disabled:opacity-50 transition-all min-h-[44px] sm:min-h-0"
              >
                <FileText className="w-4 h-4" />
                {loadingPdf ? 'جاري التحضير...' : 'خيارات كشف PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* Modal body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-10 h-10 border-4 border-t-honey border-[#EADCBF] rounded-full animate-spin mx-auto" />
              <p className="text-xs text-sec-text">جاري تجميع حركات دفتر الحساب ومطابقة الأرصدة...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-danger-val border border-danger-val/30 bg-danger-val/5 rounded-2xl max-w-md mx-auto space-y-4">
              <AlertCircle className="w-10 h-10 mx-auto" />
              <p className="text-xs font-bold">{error}</p>
              <button 
                onClick={loadCustomer}
                className="bg-danger-val hover:bg-opacity-90 text-white text-xs px-4 py-2 rounded-xl font-bold cursor-pointer"
              >
                إعادة تجميع السجلات
              </button>
            </div>
          ) : data ? (
            <div className="space-y-6">
              
              {/* Profile card and Quick Statement dispatcher */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* Visual profile details */}
                <div className="bg-[#F8F5EE] border border-[#EADCBF] p-4 sm:p-5 rounded-2xl md:col-span-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-honey/10 border border-honey/20 flex items-center justify-center font-black text-lg text-honey shrink-0">
                      {data.customer?.customer_name?.charAt(0) || 'ع'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-main-text select-all truncate">{data.customer?.customer_name}</h4>
                      <p className="text-xs text-sec-text mt-0.5 flex items-center gap-1 font-mono select-all truncate">
                        <Phone className="w-3.5 h-3.5 text-honey shrink-0" />
                        {data.phone_number || data.customer?.phone_number || 'بدون رقم هاتف مضاف'}
                      </p>
                    </div>
                  </div>
                  {data.customer?.notes && (
                    <div className="text-xs text-sec-text bg-[#FCFBFA] p-2.5 rounded-xl border border-[#EADCBF] break-words">
                      <strong className="text-main-text">ملاحظات الطرف:</strong> {data.customer.notes}
                    </div>
                  )}
                  {data.customer?.last_transaction_date && (
                    <div className="text-[11px] text-sec-text flex items-center gap-1.5 font-bold">
                      <Calendar className="w-3.5 h-3.5 text-[#8F5500] shrink-0" />
                      <span>تاريخ آخر قيد:</span>
                      <span className="font-mono text-main-text">{new Date(data.customer.last_transaction_date).toLocaleDateString('ar-YE-u-nu-latn')}</span>
                    </div>
                  )}
                </div>

                {/* Balances panel list */}
                <div className="bg-[#F8F5EE] border border-[#EADCBF] p-4 sm:p-5 rounded-2xl md:col-span-2 space-y-3.5">
                  <div className="flex justify-between items-center pb-2 border-b border-[#EADCBF]">
                    <h4 className="text-xs text-sec-text font-black">المبالغ والأرصدة المستحقة بذمة العميل حالياً</h4>
                    <span className="text-[10px] font-black text-[#D98200] bg-honey/10 px-2 py-0.5 rounded-md border border-honey/20">باقي آجل</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {['YER', 'SAR', 'USD'].map((cur) => {
                      const balObj = (data.balances || []).find((b: any) => b.currency === cur) || { balance: 0 };
                      const isOwed = balObj.balance > 0;
                      return (
                        <div key={cur} className="bg-[#FCFBFA] p-3 rounded-xl border border-[#EADCBF] text-center space-y-1 min-w-0">
                          <span className="text-[11px] text-sec-text block font-bold">{CURRENCY_LABELS[cur as CurrencyType]?.name}</span>
                          <span className={`text-sm sm:text-md font-mono font-black block mt-1 truncate ${isOwed ? 'text-danger-val' : 'text-success-val'}`}>
                            {isOwed ? '+' : ''}{formatNumber(balObj.balance)} 
                          </span>
                          <span className="text-[9px] text-[#98989D] font-mono block">{CURRENCY_LABELS[cur as CurrencyType]?.symbol}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Whatsapp accounting statement block form */}
              <div className="bg-honey/15 border border-honey/35 p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
                <div className="flex items-start sm:items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-honey shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <h5 className="text-xs font-black text-main-text">تجهيز وإرسال كشف حساب بالواتساب للعميل</h5>
                    <p className="text-[11px] text-sec-text mt-0.5 leading-relaxed">يقوم هذا الإجراء بتركيب كشف بأرصدة ذمة المبيعات والآجل وإضافتها لطابور رسائل واتساب للعميل تلقائياً.</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0 select-none">
                  <select
                    value={sendingCurrency}
                    onChange={(e) => setSendingCurrency(e.target.value as CurrencyType)}
                    className="bg-[#FCFBFA] border border-[#EADCBF] text-main-text rounded-xl text-xs px-3 py-2.5 sm:py-2 outline-none font-bold cursor-pointer min-h-[44px] sm:min-h-0"
                  >
                    <option value="YER">ريال يمني (YER)</option>
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleSendStatement}
                    disabled={sendingLoader}
                    className="bg-honey text-slate-950 hover:bg-opacity-95 text-xs font-black px-4 py-2.5 sm:py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0 shadow-sm min-h-[44px] sm:min-h-0"
                  >
                    {sendingLoader && <div className="w-3 h-3 border-2 border-t-transparent border-slate-950 rounded-full animate-spin" />}
                    {sendSuccess ? '✓ تم تجهيز الإشعار !' : 'تجهيز وإرسال بالواتساب'}
                  </button>
                </div>
              </div>

              {/* Transactions Ledger movement history */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-honey shrink-0" />
                    <h4 className="text-xs font-black text-main-text">دفتر الحركة للحساب المالي الموحد للعميل في النظام</h4>
                  </div>
                  <span className="block sm:hidden text-[10px] text-[#A66E00] bg-amber-50 border border-amber-200 rounded px-2.5 py-1 text-center font-bold animate-pulse">
                    ↔ يرجى التمرير يمنياً ويساراً لمشاهدة جميع أعمدة الحركة
                  </span>
                </div>

                {data.ledger && data.ledger.length > 0 ? (
                  <div className="overflow-x-auto border border-[#EADCBF] rounded-xl bg-[#FCFBFA] -webkit-overflow-scrolling-touch">
                    <table className="w-full text-right text-xs border-collapse" style={{ minWidth: '820px' }}>
                      <thead>
                        <tr className="bg-[#F8F5EE] text-sec-text font-black border-b border-[#EADCBF]">
                          <th className="p-3 text-right">التاريخ</th>
                          <th className="p-3 text-right">رقم العملية</th>
                          <th className="p-3 text-right">نوع العملية</th>
                          <th className="p-3 text-right">الوصف والبيان</th>
                          <th className="p-3 text-right font-mono text-danger-val">مدين (+)</th>
                          <th className="p-3 text-right font-mono text-success-val">دائن (-)</th>
                          <th className="p-3 text-right font-mono text-[#8F5500]">الرصيد المتبقي</th>
                          <th className="p-3 text-right font-mono">العملة</th>
                          <th className="p-3 text-right">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EADCBF]/40">
                        {data.ledger.map((it: any, idx: number) => {
                          const dateStr = it.date ? new Date(it.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          }) : 'مؤخراً';
                          
                          const isDebit = it.entry_type === 'debit';
                          const isCredit = it.entry_type === 'credit';
                          const isCancelled = it.transaction_status === 'cancelled' || String(it.description || '').includes('إلغاء');

                          return (
                            <tr key={idx} className="hover:bg-[#FDFCF9] even:bg-[#FAF8F3]/50 transition-all">
                              <td className="p-3 font-mono text-sec-text">{dateStr}</td>
                              <td className="p-3 font-mono text-honey font-bold select-all">{it.transaction_no || 'بلا رقم'}</td>
                              <td className="p-3 text-main-text font-black">
                                {TRANSACTION_LABELS[it.transaction_type as keyof typeof TRANSACTION_LABELS] || it.transaction_type}
                              </td>
                              <td className="p-3 text-sec-text text-[11px] max-w-[180px] truncate" title={it.description || it.notes}>
                                {it.description || it.notes || 'حركة حساب جارية'}
                              </td>
                              <td className="p-3 font-mono text-danger-val font-bold">
                                {isDebit ? `+${formatNumber(it.amount)}` : '-'}
                              </td>
                              <td className="p-3 font-mono text-success-val font-bold">
                                {isCredit ? `-${formatNumber(it.amount)}` : '-'}
                              </td>
                              <td className="p-3 font-mono font-black text-main-text">
                                {formatNumber(it.balance_after)}
                              </td>
                              <td className="p-3 font-mono text-xs text-main-text font-bold">{it.currency}</td>
                              <td className="p-1.5">
                                {isCancelled ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-100 text-red-600 font-bold border border-red-200">
                                    ملغي
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-green-100 text-green-700 font-bold border border-green-200">
                                    نشط
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-[#F8F5EE] p-12 rounded-xl border border-[#EADCBF] text-center">
                    <p className="text-xs text-sec-text font-bold">لا توجد حركة مالية مسجلة لهذا العميل حالياً.</p>
                  </div>
                )}
              </div>

              {/* Customer Documents Section */}
              <div className="bg-[#FAF8F3] border border-[#EADCBF] rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#EADCBF] pb-2.5">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-[#D98200]" />
                    <h4 className="text-xs font-black text-main-text">مستندات ووثائق العميل المؤرشفة رقمياً</h4>
                  </div>
                  <span className="text-[10px] text-sec-text font-bold">
                    {customerMedia.length} ملف نشط
                  </span>
                </div>

                {loadingMedia ? (
                  <div className="flex items-center justify-center py-6 gap-2">
                    <div className="w-4 h-4 border-2 border-[#D98200] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[11px] text-sec-text">جاري تحميل وثائق العميل...</span>
                  </div>
                ) : customerMedia.length === 0 ? (
                  <p className="text-[11px] text-sec-text text-center py-3 bg-[#FCFBFA] border border-[#EADCBF]/50 rounded-xl">
                    لا توجد مستندات مرفوعة ومخصصة لهذا العميل حالياً. يمكنك أرشفة فواتير وسندات العميل من خلال <strong>"مكتبة الوسائط"</strong> بالخيارات الإضافية.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {customerMedia.map((doc) => (
                      <div 
                        key={doc.id} 
                        className="bg-[#FCFBFA] border border-[#EADCBF] rounded-xl p-3 flex flex-col justify-between hover:shadow-xs hover:border-[#D98200]/40 transition-all duration-150"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-[9px] font-black text-honey px-1.5 py-0.5 bg-[#FAF5E6] border border-[#F5E6CC] rounded-md">
                              {DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}
                            </span>
                            <span className="text-[9px] font-mono text-sec-text">
                              {new Date(doc.document_date).toLocaleDateString('ar-YE')}
                            </span>
                          </div>
                          <h5 className="text-[11px] font-black text-main-text mt-1.5 truncate" title={doc.title}>
                            {doc.title}
                          </h5>
                          {doc.description && (
                            <p className="text-[10px] text-sec-text mt-1 bg-[#FAF8F3] p-1.5 rounded border border-[#EADCBF]/30 leading-relaxed truncate">
                              {doc.description}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-[#EADCBF]/30 justify-end">
                          <button
                            onClick={() => handlePreviewMedia(doc)}
                            className="bg-honey/10 hover:bg-honey/20 text-honey font-black text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            <span>معاينة</span>
                          </button>
                          <button
                            onClick={() => handleDownloadMedia(doc)}
                            className="bg-[#FAF8F3] border border-[#EADCBF] text-main-text font-bold text-[10px] px-2 py-1 rounded-lg flex items-center justify-center cursor-pointer hover:bg-[#F3ECE0]"
                            title="تحميل الملف"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="text-center py-12 text-sec-text font-bold">لا تتوفر تفاصيل مالية دقيقة للعميل المطلوب.</div>
          )}
        </div>

        {/* Footer actions */}
        <div className="pt-3 pb-4 px-4 sm:px-6 border-t border-[#EADCBF] flex justify-end bg-[#F8F5EE] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-[#FCFBFA] hover:bg-[#F3ECE0] text-main-text rounded-xl text-xs font-black transition-all border border-[#EADCBF] cursor-pointer min-h-[44px] sm:min-h-0"
          >
            إغلاق كشف الحركة
          </button>
        </div>

      </div>

      {/* Advanced Statement Options Modal */}
      {showStatementPrefsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] overflow-y-auto">
          <div
            className="bg-white text-gray-900 border border-gray-200 rounded-2xl w-full max-w-xl shadow-2xl p-6 text-right space-y-4 my-8 animate-scale-up"
            dir="rtl"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-base font-black text-honey flex items-center gap-2">
                <FileText className="w-5 h-5 text-honey" />
                تخصيص كشف الحساب المالي المتقدم
              </h3>
              <button
                onClick={() => setShowStatementPrefsModal(false)}
                className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-1.5 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1 text-right">
              {/* Report Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 block">عنوان كشف الحساب المطبوع</label>
                <input
                  type="text"
                  value={prefsForm.reportTitle}
                  onChange={(e) => setPrefsForm(p => ({ ...p, reportTitle: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:border-honey focus:outline-none"
                  placeholder="كشف حساب مالي ومطابقة"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Period selection */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 block">الفترة المالية</label>
                  <select
                    value={prefsForm.period}
                    onChange={(e: any) => setPrefsForm(p => ({ ...p, period: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:border-honey focus:outline-none bg-white font-bold"
                  >
                    <option value="all">كل الفترات التاريخية</option>
                    <option value="today">اليوم فقط</option>
                    <option value="week">آخر 7 أيام</option>
                    <option value="month">آخر 30 يوماً</option>
                    <option value="custom">فترة مخصصة</option>
                  </select>
                </div>

                {/* Currency Selection */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 block">فلترة العملة</label>
                  <select
                    value={prefsForm.currency}
                    onChange={(e: any) => setPrefsForm(p => ({ ...p, currency: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:border-honey focus:outline-none bg-white font-bold"
                  >
                    <option value="all">كل عملات الحساب</option>
                    <option value="YER">الريال اليمني (YER)</option>
                    <option value="SAR">الريال السعودي (SAR)</option>
                    <option value="USD">الدولار الأمريكي (USD)</option>
                  </select>
                </div>
              </div>

              {/* Custom Dates if period is custom */}
              {prefsForm.period === 'custom' && (
                <div className="grid grid-cols-2 gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-amber-800 block">من تاريخ</label>
                    <input
                      type="date"
                      value={prefsForm.dateFrom}
                      onChange={(e) => setPrefsForm(p => ({ ...p, dateFrom: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-honey bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-amber-800 block">إلى تاريخ</label>
                    <input
                      type="date"
                      value={prefsForm.dateTo}
                      onChange={(e) => setPrefsForm(p => ({ ...p, dateTo: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-honey bg-white"
                    />
                  </div>
                </div>
              )}

               {/* Movement type selection */}
              <div className="grid grid-cols-2 gap-3 pb-2 border-b border-gray-100">
                <div className="space-y-1 text-right">
                  <label className="text-xs font-bold text-gray-600 block">نوع حركة القيود المالية</label>
                  <select
                    value={prefsForm.movementType}
                    onChange={(e: any) => setPrefsForm(p => ({ ...p, movementType: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:border-honey focus:outline-none bg-white font-bold"
                  >
                    <option value="all">كل المعاملات (فواتير، سندات، مرتجعات)</option>
                    <option value="invoices">الفواتير والمبيعات الآجلة فقط</option>
                    <option value="receipts">سندات القبض والدفعات النقدية فقط</option>
                  </select>
                </div>

                <div className="space-y-1 text-right">
                  <label className="text-xs font-bold text-gray-600 block">نوع النسخة المطبوعة</label>
                  <select
                    value={prefsForm.audience}
                    onChange={(e: any) => setPrefsForm(p => ({ ...p, audience: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:border-honey focus:outline-none bg-white font-bold"
                  >
                    <option value="customer">نسخة للعميل (تخفي التكلفة والأرباح)</option>
                    <option value="internal">نسخة داخلية (مع الأرباح والتكلفة التقريبية)</option>
                  </select>
                </div>
              </div>

              {/* Preferences Checkboxes */}
              <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl space-y-2.5">
                <span className="text-xs font-black text-gray-700 block mb-1">تفاصيل ومظهر المستند للعميل:</span>
                
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-gray-600 select-none">
                  <input
                    type="checkbox"
                    checked={prefsForm.includeInvoiceDetails}
                    onChange={(e) => setPrefsForm(p => ({ ...p, includeInvoiceDetails: e.target.checked }))}
                    className="rounded border-gray-300 text-honey focus:ring-honey w-4 h-4 cursor-pointer"
                  />
                  <span className="text-honey font-black">إظهار تفاصيل الفواتير (البنود والسلع) داخل كشف الحساب</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-gray-600 select-none">
                  <input
                    type="checkbox"
                    checked={prefsForm.showCustomerSummary}
                    onChange={(e) => setPrefsForm(p => ({ ...p, showCustomerSummary: e.target.checked }))}
                    className="rounded border-gray-300 text-honey focus:ring-honey w-4 h-4 cursor-pointer"
                  />
                  <span>إظهار دليل القراءة المبسط للعميل والملخص الإحصائي</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-gray-600 select-none">
                  <input
                    type="checkbox"
                    checked={prefsForm.showZeroBalances}
                    onChange={(e) => setPrefsForm(p => ({ ...p, showZeroBalances: e.target.checked }))}
                    className="rounded border-gray-300 text-honey focus:ring-honey w-4 h-4 cursor-pointer"
                  />
                  <span>إظهار العملات ذات الأرصدة الصفرية</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-gray-600 select-none">
                  <input
                    type="checkbox"
                    checked={prefsForm.showCancelled}
                    onChange={(e) => setPrefsForm(p => ({ ...p, showCancelled: e.target.checked }))}
                    className="rounded border-gray-300 text-honey focus:ring-honey w-4 h-4 cursor-pointer"
                  />
                  <span>العرض والاحتساب للقيود والمعاملات الملغاة</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-gray-600 select-none">
                  <input
                    type="checkbox"
                    checked={prefsForm.showAdminNotes}
                    onChange={(e) => setPrefsForm(p => ({ ...p, showAdminNotes: e.target.checked }))}
                    className="rounded border-gray-300 text-honey focus:ring-honey w-4 h-4 cursor-pointer"
                  />
                  <span>تصدير ملاحظات الإدارة السرية للعميل</span>
                </label>
              </div>

              {/* Warning / Fallback Notice banner */}
              {!import.meta.env.VITE_PDF_RENDER_WEBHOOK_URL && (
                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 leading-relaxed space-y-1">
                  <strong className="text-amber-800 flex items-center gap-1.5 font-black text-[13px]">
                    <span>⚠️ وضع المعاينة والطباعة المؤقت نشط</span>
                  </strong>
                  <p className="font-bold text-amber-700/90 text-[11px] leading-normal text-right">
                    تنبيه: خدمة توليد ملفات PDF المباشرة عبر الويب هوك غير مفعّلة في البيئة الحالية. عند اختيار زر معاينة الطباعة بالأسفل، سنقوم بفتح صفحة الكشف الاحترافي في نافذة جديدة، ويمكنك حفظ الملف بصيغة PDF حقيقية باستخدام خيار الطباعة بالمتصفح (Print &gt; Save as PDF).
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowStatementPrefsModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black rounded-xl transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowStatementPrefsModal(false);
                  await handlePrintStatementPdf(prefsForm);
                }}
                disabled={loadingPdf}
                className="px-5 py-2.5 bg-honey hover:opacity-90 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                {import.meta.env.VITE_PDF_RENDER_WEBHOOK_URL ? 'تنزيل PDF الحقيقي كملف' : 'معاينة وجاهزية الطباعة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
