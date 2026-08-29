import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Receipt, 
  ClipboardList, 
  Tag, 
  ExternalLink, 
  Image as ImageIcon, 
  Archive, 
  Trash2, 
  XCircle, 
  CheckCircle, 
  RefreshCw, 
  Edit, 
  Plus, 
  Download, 
  ChevronDown, 
  File, 
  Folder, 
  Eye, 
  AlertCircle,
  HelpCircle,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getMediaLibrary, 
  uploadMediaFile, 
  updateMediaMetadata, 
  updateMediaStatus, 
  getMediaPublicUrl,
  getMediaSignedUrl,
  getFrontendTransactionsList,
  searchCustomers
} from '../lib/api';
import { supabase } from '../lib/supabaseClient';

// Helper to format file sizes nicely
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 بكسل';
  const k = 1024;
  const sizes = ['بايت', 'كيلوبايت', 'ميغابايت', 'جيغابايت'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Document types translated to Arabic
export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
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

// Colors for each document type badge
export const DOCUMENT_TYPE_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  invoice_image: { bg: 'bg-amber-500/10', text: 'text-amber-700', border: 'border-amber-500/20' },
  receipt_voucher_image: { bg: 'bg-emerald-500/10', text: 'text-emerald-700', border: 'border-emerald-500/20' },
  payment_voucher_image: { bg: 'bg-red-500/10', text: 'text-red-700', border: 'border-red-500/20' },
  rent_contract: { bg: 'bg-blue-500/10', text: 'text-blue-700', border: 'border-blue-500/20' },
  old_statement: { bg: 'bg-purple-500/10', text: 'text-purple-700', border: 'border-purple-500/20' },
  supplier_invoice: { bg: 'bg-orange-500/10', text: 'text-orange-700', border: 'border-orange-500/20' },
  transfer_receipt: { bg: 'bg-teal-500/10', text: 'text-teal-700', border: 'border-teal-500/20' },
  customer_document: { bg: 'bg-indigo-500/10', text: 'text-indigo-700', border: 'border-indigo-500/20' },
  internal_document: { bg: 'bg-slate-500/10', text: 'text-slate-700', border: 'border-slate-500/20' },
  other: { bg: 'bg-gray-500/10', text: 'text-gray-700', border: 'border-gray-500/20' }
};

interface MediaLibraryViewProps {
  currentUser?: any;
  onSelectCustomer?: (id: string) => void;
  onSelectTrx?: (id: string) => void;
}

export default function MediaLibraryView({ currentUser, onSelectCustomer, onSelectTrx }: MediaLibraryViewProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [unfilteredDocuments, setUnfilteredDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active'); // active, archived, cancelled, all
  const [filterDate, setFilterDate] = useState('');

  // Dropdown data
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [transactionsList, setTransactionsList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; title: string; type: string } | null>(null);

  // Upload Form state
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    document_type: 'invoice_image',
    document_date: new Date().toISOString().split('T')[0],
    related_customer_id: '',
    related_transaction_id: '',
    related_order_id: '',
    tags: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Form state
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    document_type: 'invoice_image',
    document_date: '',
    related_customer_id: '',
    related_transaction_id: '',
    related_order_id: '',
    tags: '',
    status: 'active'
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Auto search customers for dropdown in form
  const [custSearchQuery, setCustSearchQuery] = useState('');
  const [searchedCustomers, setSearchedCustomers] = useState<any[]>([]);

  useEffect(() => {
    loadDocuments();
    loadDropdownData();
  }, [searchQuery, filterType, filterCustomer, filterStatus, filterDate]);

  const loadDocuments = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [res, unfilteredRes] = await Promise.all([
        getMediaLibrary({
          search: searchQuery,
          documentType: filterType,
          customerId: filterCustomer,
          status: filterStatus,
          documentDate: filterDate
        }),
        getMediaLibrary({})
      ]);

      if (res.error) {
        throw new Error(res.error);
      }
      if (unfilteredRes.error) {
        throw new Error(unfilteredRes.error);
      }

      setDocuments(res.data || []);
      setUnfilteredDocuments(unfilteredRes.data || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل جلب قائمة المستندات والوسائط');
    } finally {
      setLoading(false);
    }
  };

  const loadDropdownData = async () => {
    try {
      // 1. Get recent transactions for linking
      const trxRes = await getFrontendTransactionsList();
      if (trxRes.data) {
        setTransactionsList(trxRes.data);
      }

      // 2. Load top customers for dropdown filters
      const { data: custData } = await supabase.from('ibex_had_customers')
        .select('id, display_name')
        .order('display_name', { ascending: true })
        .limit(200);
      
      if (custData) {
        setCustomersList(custData.map(c => ({
          id: c.id,
          customer_name: c.display_name
        })));
      }

      // 3. Load active customer orders for linking
      const { data: orderData } = await supabase.from('ibex_had_orders')
        .select('id, order_no, customer_name')
        .order('created_at', { ascending: false })
        .limit(100);

      if (orderData) {
        setOrdersList(orderData);
      }
    } catch (err) {
      console.error('Error loading dropdown references:', err);
    }
  };

  // Autocomplete search for customers in form
  useEffect(() => {
    const fetchCustomers = async () => {
      if (!custSearchQuery.trim()) {
        setSearchedCustomers([]);
        return;
      }
      try {
        const res = await searchCustomers(custSearchQuery, 10);
        setSearchedCustomers(res.data || []);
      } catch (err) {
        console.error('Customer lookup error:', err);
      }
    };

    const delayDebounce = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(delayDebounce);
  }, [custSearchQuery]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Limit file size to 10MB
      if (file.size > 10 * 1024 * 1024) {
        alert('حجم الملف كبير جداً! الحد الأقصى المسموح به هو 10 ميغابايت.');
        return;
      }
      setSelectedFile(file);
      // Auto fill title if empty
      if (!uploadForm.title) {
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setUploadForm(prev => ({ ...prev, title: nameWithoutExt }));
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('يرجى اختيار ملف مستند لرفعه أولاً.');
      return;
    }
    if (!uploadForm.title.trim()) {
      alert('يرجى إدخال عنوان للمستند.');
      return;
    }

    setUploading(true);
    try {
      // Split tags by comma
      const tagsArray = uploadForm.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const res = await uploadMediaFile(selectedFile, {
        title: uploadForm.title,
        description: uploadForm.description,
        document_type: uploadForm.document_type,
        document_date: uploadForm.document_date,
        related_customer_id: uploadForm.related_customer_id || null,
        related_transaction_id: uploadForm.related_transaction_id || null,
        related_order_id: uploadForm.related_order_id || null,
        tags: tagsArray,
        uploaded_by: currentUser?.id || undefined
      });

      if (res.error) {
        throw new Error(res.error);
      }

      alert('تم رفع المستند وتسجيل بياناته بنجاح ✓');
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setUploadForm({
        title: '',
        description: '',
        document_type: 'invoice_image',
        document_date: new Date().toISOString().split('T')[0],
        related_customer_id: '',
        related_transaction_id: '',
        related_order_id: '',
        tags: '',
      });
      loadDocuments();
    } catch (err: any) {
      alert('حدث خطأ أثناء الرفع: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleOpenEdit = (doc: any) => {
    setSelectedDoc(doc);
    setEditForm({
      title: doc.title,
      description: doc.description || '',
      document_type: doc.document_type,
      document_date: doc.document_date || '',
      related_customer_id: doc.related_customer_id || '',
      related_transaction_id: doc.related_transaction_id || '',
      related_order_id: doc.related_order_id || '',
      tags: Array.isArray(doc.tags) ? doc.tags.join(', ') : '',
      status: doc.status || 'active'
    });
    setCustSearchQuery('');
    setSearchedCustomers([]);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;
    if (!editForm.title.trim()) {
      alert('عنوان المستند مطلوب.');
      return;
    }

    setSavingEdit(true);
    try {
      const tagsArray = editForm.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const res = await updateMediaMetadata(selectedDoc.id, {
        title: editForm.title,
        description: editForm.description,
        document_type: editForm.document_type,
        document_date: editForm.document_date,
        related_customer_id: editForm.related_customer_id || null,
        related_transaction_id: editForm.related_transaction_id || null,
        related_order_id: editForm.related_order_id || null,
        tags: tagsArray,
        status: editForm.status
      });

      if (res.error) throw new Error(res.error);

      alert('تم تحديث بيانات المستند بنجاح ✓');
      setIsEditModalOpen(false);
      setSelectedDoc(null);
      loadDocuments();
    } catch (err: any) {
      alert('فشل حفظ التعديلات: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: 'active' | 'archived' | 'cancelled') => {
    const statusLabel = status === 'archived' ? 'أرشفة' : status === 'cancelled' ? 'إلغاء' : 'استعادة';
    const confirmAction = window.confirm(`هل أنت متأكد من إجراء (${statusLabel}) على هذا المستند؟`);
    if (!confirmAction) return;

    try {
      const res = await updateMediaStatus(id, status);
      if (res.error) throw new Error(res.error);
      alert(`تمت عملية الـ ${statusLabel} بنجاح ✓`);
      loadDocuments();
    } catch (err: any) {
      alert('أخفق تحديث حالة المستند: ' + err.message);
    }
  };

  const handlePreview = async (doc: any) => {
    try {
      const url = await getMediaSignedUrl(doc.file_path, doc.storage_bucket);
      const lowerType = doc.mime_type?.toLowerCase() || '';
      
      if (lowerType.includes('image') || lowerType.includes('png') || lowerType.includes('jpg') || lowerType.includes('jpeg') || lowerType.includes('webp')) {
        setPreviewMedia({
          url,
          title: doc.title,
          type: 'image'
        });
      } else {
        // PDF or other documents open directly in a new tab safely
        window.open(url, '_blank');
      }
    } catch (err: any) {
      alert('حدث خطأ أثناء محاولة معاينة الملف: ' + err.message);
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      const url = await getMediaSignedUrl(doc.file_path, doc.storage_bucket);
      // Create direct download trigger
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

  return (
    <div className="space-y-6 fade-in pb-20 max-w-7xl mx-auto text-right" dir="rtl">
      {/* 1. Header Hero Panel */}
      <div className="bg-card-bg border border-border-val rounded-2xl p-5 sm:p-6 shadow-sm relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1.5 z-10 max-w-2xl">
          <h2 className="text-xl font-black text-main-text flex items-center gap-2.5">
            <span className="p-2 bg-honey/10 text-honey rounded-xl">
              <FolderOpen className="w-5 h-5" />
            </span>
            مكتبة المستندات والوسائط الرقمية
          </h2>
          <p className="text-xs text-sec-text leading-relaxed">
            قسم أرشفة الفواتير المصورة وعقود العمل والتحويلات المالية وعقود الإيجار الخاصة بالمتجر بأمان وسرية تامة على سحابة Supabase Storage.
          </p>
        </div>
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="bg-honey hover:bg-honey-hover text-white font-black text-xs px-5 py-3 rounded-xl flex items-center gap-2 cursor-pointer transition-all duration-200 shadow-sm self-stretch md:self-auto justify-center"
        >
          <Upload className="w-4 h-4" />
          أرشفة مستند جديد
        </button>
      </div>

      {/* 2. Stats quick summaries */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card-bg border border-border-val/70 p-4 rounded-xl flex flex-col justify-between h-20">
          <span className="text-[10px] text-sec-text font-bold">إجمالي المستندات المؤرشفة</span>
          <span className="text-lg font-black text-main-text">{unfilteredDocuments.length} مستند</span>
        </div>
        <div className="bg-card-bg border border-border-val/70 p-4 rounded-xl flex flex-col justify-between h-20">
          <span className="text-[10px] text-sec-text font-bold">نشط ومتاح حالياً</span>
          <span className="text-lg font-black text-emerald-600">
            {unfilteredDocuments.filter(d => d.status === 'active').length} مستند
          </span>
        </div>
        <div className="bg-card-bg border border-border-val/70 p-4 rounded-xl flex flex-col justify-between h-20">
          <span className="text-[10px] text-sec-text font-bold">في الأرشيف والمجمدة</span>
          <span className="text-lg font-black text-amber-600">
            {unfilteredDocuments.filter(d => d.status === 'archived').length} مستند
          </span>
        </div>
        <div className="bg-card-bg border border-border-val/70 p-4 rounded-xl flex flex-col justify-between h-20">
          <span className="text-[10px] text-sec-text font-bold">الملفات الملغاة</span>
          <span className="text-lg font-black text-red-500">
            {unfilteredDocuments.filter(d => d.status === 'cancelled').length} مستند
          </span>
        </div>
      </div>

      {/* 3. Search and Filters Box */}
      <div className="bg-card-bg border border-border-val rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2.5 border-b border-border-val/40">
          <Filter className="w-4 h-4 text-honey" />
          <h3 className="text-xs font-black text-main-text">تصفية وفرز ملفات الأرشيف</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Text Search */}
          <div className="relative col-span-1 lg:col-span-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالعنوان، الملاحظات، أو اسم الملف..."
              className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text placeholder-sec-text/75 text-xs py-2.5 pl-3 pr-9 rounded-xl outline-none transition-colors"
            />
            <Search className="w-4 h-4 text-sec-text absolute right-3 top-1/2 -translate-y-1/2" />
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-soft-card border border-border-val text-main-text text-xs py-2.5 px-3 rounded-xl outline-none focus:border-honey"
            >
              <option value="all">كل الأنواع</option>
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, value]) => (
                <option key={key} value={key}>{value}</option>
              ))}
            </select>
          </div>

          {/* Customer Filter */}
          <div>
            <select
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              className="w-full bg-soft-card border border-border-val text-main-text text-xs py-2.5 px-3 rounded-xl outline-none focus:border-honey"
            >
              <option value="all">كل العملاء</option>
              {customersList.map(c => (
                <option key={c.id} value={c.id}>{c.customer_name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-soft-card border border-border-val text-main-text text-xs py-2.5 px-3 rounded-xl outline-none focus:border-honey"
            >
              <option value="all">كل الحالات</option>
              <option value="active">نشط ومستعرض</option>
              <option value="archived">مؤرشف مجمد</option>
              <option value="cancelled">ملغي</option>
            </select>
          </div>
        </div>

        {/* Date Filter & Clear filters */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-sec-text font-bold">تاريخ المستند:</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-soft-card border border-border-val text-main-text text-xs py-1.5 px-2.5 rounded-lg focus:border-honey outline-none font-mono"
            />
            {filterDate && (
              <button 
                onClick={() => setFilterDate('')}
                className="text-[10px] text-red-500 hover:underline"
              >
                مسح التاريخ
              </button>
            )}
          </div>

          <button
            onClick={() => {
              setSearchQuery('');
              setFilterType('all');
              setFilterCustomer('all');
              setFilterStatus('active');
              setFilterDate('');
            }}
            className="text-xs text-honey font-bold hover:underline cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            تصفير الفلاتر وإعادة جلب القائمة
          </button>
        </div>
      </div>

      {/* 4. Document Cards List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 bg-card-bg border border-border-val rounded-2xl">
          <div className="w-10 h-10 border-4 border-honey border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-sec-text font-bold">جاري تحميل قائمة الملفات المؤرشفة من السحابة...</p>
        </div>
      ) : errorMessage ? (
        <div className="bg-danger-val/10 border border-danger-val/20 text-danger-val rounded-xl p-5 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="font-black">خطأ في الاتصال بقاعدة البيانات:</p>
            <p className="opacity-90">{errorMessage}</p>
            <p className="text-[10px] opacity-80 pt-1">تنبيه: تتطلب هذه الميزة جدول قاعدة البيانات [ibex_had_media_library] بالإضافة لـ Storage Bucket مسمى [ibex-had-media].</p>
          </div>
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-card-bg border border-border-val rounded-2xl py-20 px-4 text-center flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-soft-card border border-border-val/50 rounded-full text-sec-text">
            <FileText className="w-10 h-10 opacity-40" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-black text-main-text">لا توجد وثائق مؤرشفة</h4>
            <p className="text-xs text-sec-text max-w-md mx-auto leading-relaxed">
              لم نجد أي ملف مطابق للبحث أو الفلاتر المحددة. قم برفع أول إيصال، فاتورة مصورة أو عقد إيجار الآن لبدء أرشيفك الرقمي.
            </p>
          </div>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-honey/10 text-honey hover:bg-honey/20 border border-honey/20 font-black text-xs px-4 py-2.5 rounded-xl transition-all"
          >
            أرشفة أول مستند الآن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const isImage = doc.mime_type?.startsWith('image/');
            const typeColor = DOCUMENT_TYPE_COLORS[doc.document_type] || DOCUMENT_TYPE_COLORS.other;
            
            return (
              <motion.div
                layout
                key={doc.id}
                className="bg-card-bg border border-border-val/80 hover:border-honey/40 rounded-2xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-all group duration-200 relative"
              >
                <div>
                  {/* Header info */}
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-lg border font-black ${typeColor.bg} ${typeColor.text} ${typeColor.border}`}>
                      {DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}
                    </span>

                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      doc.status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                        : doc.status === 'archived'
                        ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        : 'bg-red-500/10 text-red-500 border border-red-500/20'
                    }`}>
                      {doc.status === 'active' ? 'نشط' : doc.status === 'archived' ? 'مؤرشف' : 'ملغي'}
                    </span>
                  </div>

                  {/* Title & file name */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-main-text leading-snug group-hover:text-honey transition-colors">
                      {doc.title}
                    </h3>
                    <p className="text-[10px] text-sec-text/80 font-mono flex items-center gap-1" dir="ltr">
                      <File className="w-3 h-3 text-sec-text" />
                      <span className="truncate max-w-[200px]">{doc.file_name}</span>
                      <span>({formatFileSize(doc.file_size)})</span>
                    </p>
                  </div>

                  {/* Description / Notes */}
                  {doc.description && (
                    <p className="text-xs text-sec-text/90 bg-soft-card p-2.5 rounded-xl border border-border-val/50 my-2.5 leading-relaxed">
                      {doc.description}
                    </p>
                  )}

                  {/* Connections: Customers, transactions, orders */}
                  <div className="space-y-1.5 py-2.5 border-t border-b border-border-val/40 my-3">
                    {doc.related_customer_id && (
                      <div className="flex items-center gap-1.5 text-xs text-sec-text">
                        <User className="w-3.5 h-3.5 text-honey" />
                        <span className="font-bold">مرتبط بالعميل:</span>
                        <button
                          onClick={() => onSelectCustomer && onSelectCustomer(doc.related_customer_id)}
                          className="text-honey hover:underline font-black text-[11px]"
                        >
                          {customersList.find(c => c.id === doc.related_customer_id)?.customer_name || 'تصفح ملف العميل'}
                        </button>
                      </div>
                    )}

                    {doc.related_transaction_id && (
                      <div className="flex items-center gap-1.5 text-xs text-sec-text">
                        <Receipt className="w-3.5 h-3.5 text-honey" />
                        <span className="font-bold">مرتبط بالعملية:</span>
                        <button
                          onClick={() => onSelectTrx && onSelectTrx(doc.related_transaction_id)}
                          className="text-honey hover:underline font-mono font-black text-[11px]"
                        >
                          #{doc.related_transaction_id.substring(0, 8)}...
                        </button>
                      </div>
                    )}

                    {doc.related_order_id && (
                      <div className="flex items-center gap-1.5 text-xs text-sec-text">
                        <ClipboardList className="w-3.5 h-3.5 text-honey" />
                        <span className="font-bold">مرتبط بالطلب:</span>
                        <span className="font-mono text-main-text text-[11px] font-bold">
                          #{ordersList.find(o => o.id === doc.related_order_id)?.order_no || 'تفاصيل الطلبية'}
                        </span>
                      </div>
                    )}

                    {!doc.related_customer_id && !doc.related_transaction_id && !doc.related_order_id && (
                      <span className="text-[10px] text-sec-text/70 block">غير مرتبط بجهة مالية مباشرة (مستند عام)</span>
                    )}
                  </div>

                  {/* Tags */}
                  {Array.isArray(doc.tags) && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {doc.tags.map((tag: string, i: number) => (
                        <span key={i} className="text-[10px] bg-sec-bg border border-border-val/50 text-sec-text px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5">
                          <Tag className="w-2.5 h-2.5 opacity-60" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Dates & Actions */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-[10px] text-sec-text/80 font-bold border-t border-border-val/20 pt-2.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      تاريخ المستند: {new Date(doc.document_date).toLocaleDateString('ar-YE')}
                    </span>
                    <span>رفع: {new Date(doc.created_at).toLocaleDateString('ar-YE')}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    <button
                      onClick={() => handlePreview(doc)}
                      className="bg-honey/10 hover:bg-honey/20 text-honey font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all col-span-2"
                      title="معاينة الملف المؤرشف"
                    >
                      {isImage ? <Eye className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                      <span>معاينة</span>
                    </button>

                    <button
                      onClick={() => handleDownload(doc)}
                      className="bg-sec-bg hover:bg-side-active text-main-text border border-border-val/60 font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all"
                      title="تحميل الملف للجهاز"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleOpenEdit(doc)}
                      className="bg-sec-bg hover:bg-side-active text-main-text border border-border-val/60 font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all"
                      title="تعديل بيانات المستند"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Archive Toggle Row */}
                  <div className="flex gap-1 justify-end pt-1">
                    {doc.status !== 'active' && (
                      <button
                        onClick={() => handleStatusUpdate(doc.id, 'active')}
                        className="text-[10px] font-black text-emerald-600 hover:underline flex items-center gap-0.5"
                      >
                        <CheckCircle className="w-3 h-3" />
                        تنشيط الملف
                      </button>
                    )}

                    {doc.status === 'active' && (
                      <button
                        onClick={() => handleStatusUpdate(doc.id, 'archived')}
                        className="text-[10px] font-black text-amber-600 hover:underline flex items-center gap-0.5"
                      >
                        <Archive className="w-3 h-3" />
                        نقل للأرشيف
                      </button>
                    )}

                    {doc.status !== 'cancelled' && (
                      <button
                        onClick={() => handleStatusUpdate(doc.id, 'cancelled')}
                        className="text-[10px] font-black text-red-500 hover:underline flex items-center gap-0.5 mr-2"
                      >
                        <XCircle className="w-3 h-3" />
                        إلغاء المستند
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 5. UPLOAD MEDIA MODAL */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-card-bg border border-border-val rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden text-right space-y-4"
              dir="rtl"
            >
              <div className="flex justify-between items-center pb-3 border-b border-border-val">
                <h3 className="text-sm font-black text-main-text flex items-center gap-2">
                  <Upload className="w-4 h-4 text-honey" />
                  أرشفة ورفع مستند جديد للسحابة
                </h3>
                <button
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setSelectedFile(null);
                  }}
                  className="w-8 h-8 rounded-full border border-border-val text-sec-text hover:bg-side-active transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
                {/* File Upload Zone */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border-val/80 hover:border-honey/60 bg-soft-card rounded-2xl p-6 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center space-y-2.5"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    className="hidden"
                  />
                  
                  {selectedFile ? (
                    <div className="space-y-1">
                      <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                      <p className="font-black text-main-text select-all">{selectedFile.name}</p>
                      <p className="text-[10px] text-sec-text">حجم الملف: {formatFileSize(selectedFile.size)}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-10 h-10 text-honey opacity-85 mx-auto animate-bounce" />
                      <p className="font-bold text-main-text">اسحب ملف هنا أو انقر للتصفح والرفع</p>
                      <p className="text-[10px] text-sec-text leading-relaxed">يدعم الصور بجميع أنواعها وملفات الـ PDF بحد أقصى 10 ميغابايت.</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Document Title */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-sec-text">عنوان المستند أو الوثيقة *</label>
                    <input
                      type="text"
                      required
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                      placeholder="مثال: عقد إيجار المحل 2026، إيصال تحويل رقم 22"
                      className="w-full bg-soft-card border border-border-val rounded-xl py-2.5 px-3 text-main-text focus:border-honey outline-none"
                    />
                  </div>

                  {/* Document Type */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-sec-text">تصنيف/نوع المستند *</label>
                    <select
                      value={uploadForm.document_type}
                      onChange={(e) => setUploadForm({ ...uploadForm, document_type: e.target.value })}
                      className="w-full bg-soft-card border border-border-val rounded-xl py-2.5 px-3 text-main-text focus:border-honey outline-none font-semibold"
                    >
                      {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, value]) => (
                        <option key={key} value={key}>{value}</option>
                      ))}
                    </select>
                  </div>

                  {/* Document Date */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-sec-text">تاريخ تحرير المستند *</label>
                    <input
                      type="date"
                      required
                      value={uploadForm.document_date}
                      onChange={(e) => setUploadForm({ ...uploadForm, document_date: e.target.value })}
                      className="w-full bg-soft-card border border-border-val rounded-xl py-2.5 px-3 text-main-text focus:border-honey outline-none font-mono"
                    />
                  </div>

                  {/* Tags */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-sec-text">وسوم مميزة (Tags) اختيارية</label>
                    <input
                      type="text"
                      value={uploadForm.tags}
                      onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                      placeholder="افصل بين الكلمات بفاصلة (مثال: عاجل، باحكم، معلق)"
                      className="w-full bg-soft-card border border-border-val rounded-xl py-2.5 px-3 text-main-text focus:border-honey outline-none"
                    />
                  </div>
                </div>

                {/* Linking Relations Section */}
                <div className="bg-soft-card p-4 rounded-xl border border-border-val/50 space-y-3">
                  <span className="font-black text-main-text block border-b border-border-val/45 pb-1 text-[11px]">ربط المستند بأطراف أو عمليات داخلية (اختياري)</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Link Customer */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-sec-text flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        ربط بالعميل
                      </label>
                      <select
                        value={uploadForm.related_customer_id}
                        onChange={(e) => setUploadForm({ ...uploadForm, related_customer_id: e.target.value })}
                        className="w-full bg-white border border-border-val rounded-xl py-2 px-2.5 text-main-text focus:border-honey outline-none font-semibold"
                      >
                        <option value="">لا يوجد ارتباط</option>
                        {customersList.map(c => (
                          <option key={c.id} value={c.id}>{c.customer_name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Link Transaction */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-sec-text flex items-center gap-1">
                        <Receipt className="w-3.5 h-3.5" />
                        ربط بعملية مالية
                      </label>
                      <select
                        value={uploadForm.related_transaction_id}
                        onChange={(e) => setUploadForm({ ...uploadForm, related_transaction_id: e.target.value })}
                        className="w-full bg-white border border-border-val rounded-xl py-2 px-2.5 text-main-text focus:border-honey outline-none font-mono font-bold"
                      >
                        <option value="">لا يوجد ارتباط</option>
                        {transactionsList.map(tx => (
                          <option key={tx.id} value={tx.id}>
                            #{tx.id.substring(0, 8)}... ({tx.total_amount} {tx.currency})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Link Order */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-sec-text flex items-center gap-1">
                        <ClipboardList className="w-3.5 h-3.5" />
                        ربط بطلب عميل
                      </label>
                      <select
                        value={uploadForm.related_order_id}
                        onChange={(e) => setUploadForm({ ...uploadForm, related_order_id: e.target.value })}
                        className="w-full bg-white border border-border-val rounded-xl py-2 px-2.5 text-main-text focus:border-honey outline-none font-mono font-bold"
                      >
                        <option value="">لا يوجد ارتباط</option>
                        {ordersList.map(o => (
                          <option key={o.id} value={o.id}>
                            رقم: {o.order_no} ({o.customer_name || 'بدون اسم'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Description / Notes */}
                <div className="space-y-1.5">
                  <label className="font-bold text-sec-text">ملاحظات وشرح المستند</label>
                  <textarea
                    rows={2.5}
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                    placeholder="اكتب تفاصيل أو ملاحظات هامة لتسهيل البحث عن المستند لاحقاً..."
                    className="w-full bg-soft-card border border-border-val rounded-xl py-2 px-3 text-main-text focus:border-honey outline-none"
                  />
                </div>

                {/* Actions Row */}
                <div className="flex gap-2.5 pt-3 border-t border-border-val justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUploadModalOpen(false);
                      setSelectedFile(null);
                    }}
                    className="px-5 py-2.5 bg-sec-bg hover:bg-side-active text-main-text rounded-xl font-bold transition-all border border-border-val/40 cursor-pointer"
                  >
                    إلغاء التراجع
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-6 py-2.5 bg-honey hover:bg-honey-hover text-white rounded-xl font-black transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {uploading && <div className="w-3.5 h-3.5 border-2 border-t-transparent border-white rounded-full animate-spin" />}
                    <span>تأكيد الرفع والأرشفة</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. EDIT MEDIA MODAL */}
      <AnimatePresence>
        {isEditModalOpen && selectedDoc && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-card-bg border border-border-val rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden text-right space-y-4"
              dir="rtl"
            >
              <div className="flex justify-between items-center pb-3 border-b border-border-val">
                <h3 className="text-sm font-black text-main-text flex items-center gap-2">
                  <Edit className="w-4 h-4 text-honey" />
                  تعديل بيانات وأرشفة مستند: {selectedDoc.title}
                </h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-8 h-8 rounded-full border border-border-val text-sec-text hover:bg-side-active transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Document Title */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-sec-text">عنوان المستند أو الوثيقة *</label>
                    <input
                      type="text"
                      required
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full bg-soft-card border border-border-val rounded-xl py-2.5 px-3 text-main-text focus:border-honey outline-none"
                    />
                  </div>

                  {/* Document Type */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-sec-text">تصنيف/نوع المستند *</label>
                    <select
                      value={editForm.document_type}
                      onChange={(e) => setEditForm({ ...editForm, document_type: e.target.value })}
                      className="w-full bg-soft-card border border-border-val rounded-xl py-2.5 px-3 text-main-text focus:border-honey outline-none font-semibold"
                    >
                      {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, value]) => (
                        <option key={key} value={key}>{value}</option>
                      ))}
                    </select>
                  </div>

                  {/* Document Date */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-sec-text">تاريخ تحرير المستند *</label>
                    <input
                      type="date"
                      required
                      value={editForm.document_date}
                      onChange={(e) => setEditForm({ ...editForm, document_date: e.target.value })}
                      className="w-full bg-soft-card border border-border-val rounded-xl py-2.5 px-3 text-main-text focus:border-honey outline-none font-mono"
                    />
                  </div>

                  {/* Tags */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-sec-text">وسوم مميزة (Tags)</label>
                    <input
                      type="text"
                      value={editForm.tags}
                      onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                      className="w-full bg-soft-card border border-border-val rounded-xl py-2.5 px-3 text-main-text focus:border-honey outline-none"
                    />
                  </div>

                  {/* Status */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-sec-text">حالة المستند</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="w-full bg-soft-card border border-border-val rounded-xl py-2.5 px-3 text-main-text focus:border-honey outline-none font-semibold"
                    >
                      <option value="active">نشط ومتاح</option>
                      <option value="archived">مؤرشف ومجمد</option>
                      <option value="cancelled">ملغي ومحجوب</option>
                    </select>
                  </div>
                </div>

                {/* Linking Relations Section */}
                <div className="bg-soft-card p-4 rounded-xl border border-border-val/50 space-y-3">
                  <span className="font-black text-main-text block border-b border-border-val/45 pb-1 text-[11px]">تعديل روابط الجهات والأطراف المرتبطة</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Link Customer */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-sec-text flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        ربط بالعميل
                      </label>
                      <select
                        value={editForm.related_customer_id}
                        onChange={(e) => setEditForm({ ...editForm, related_customer_id: e.target.value })}
                        className="w-full bg-white border border-border-val rounded-xl py-2 px-2.5 text-main-text focus:border-honey outline-none font-semibold"
                      >
                        <option value="">لا يوجد ارتباط</option>
                        {customersList.map(c => (
                          <option key={c.id} value={c.id}>{c.customer_name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Link Transaction */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-sec-text flex items-center gap-1">
                        <Receipt className="w-3.5 h-3.5" />
                        ربط بعملية مالية
                      </label>
                      <select
                        value={editForm.related_transaction_id}
                        onChange={(e) => setEditForm({ ...editForm, related_transaction_id: e.target.value })}
                        className="w-full bg-white border border-border-val rounded-xl py-2 px-2.5 text-main-text focus:border-honey outline-none font-mono font-bold"
                      >
                        <option value="">لا يوجد ارتباط</option>
                        {transactionsList.map(tx => (
                          <option key={tx.id} value={tx.id}>
                            #{tx.id.substring(0, 8)}... ({tx.total_amount} {tx.currency})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Link Order */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-sec-text flex items-center gap-1">
                        <ClipboardList className="w-3.5 h-3.5" />
                        ربط بطلب عميل
                      </label>
                      <select
                        value={editForm.related_order_id}
                        onChange={(e) => setEditForm({ ...editForm, related_order_id: e.target.value })}
                        className="w-full bg-white border border-border-val rounded-xl py-2 px-2.5 text-main-text focus:border-honey outline-none font-mono font-bold"
                      >
                        <option value="">لا يوجد ارتباط</option>
                        {ordersList.map(o => (
                          <option key={o.id} value={o.id}>
                            رقم: {o.order_no} ({o.customer_name || 'بدون اسم'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Description / Notes */}
                <div className="space-y-1.5">
                  <label className="font-bold text-sec-text">ملاحظات وشرح المستند</label>
                  <textarea
                    rows={2.5}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full bg-soft-card border border-border-val rounded-xl py-2 px-3 text-main-text focus:border-honey outline-none"
                  />
                </div>

                {/* Actions Row */}
                <div className="flex gap-2.5 pt-3 border-t border-border-val justify-end">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-5 py-2.5 bg-sec-bg hover:bg-side-active text-main-text rounded-xl font-bold transition-all border border-border-val/40 cursor-pointer"
                  >
                    إلغاء وتراجع
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-6 py-2.5 bg-honey hover:bg-honey-hover text-white rounded-xl font-black transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingEdit && <div className="w-3.5 h-3.5 border-2 border-t-transparent border-white rounded-full animate-spin" />}
                    <span>تحديث البيانات وحفظ الأرشفة</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. IMAGE FULL PREVIEW MODAL */}
      <AnimatePresence>
        {previewMedia && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-4 overflow-auto">
            <div className="relative max-w-4xl w-full flex flex-col space-y-4">
              <div className="flex justify-between items-center text-white">
                <h4 className="text-sm font-black truncate">{previewMedia.title}</h4>
                <div className="flex gap-2.5">
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = previewMedia.url;
                      link.target = '_blank';
                      link.download = previewMedia.title;
                      link.click();
                    }}
                    className="bg-white/15 text-white hover:bg-white/25 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    تحميل الملف
                  </button>
                  <button
                    onClick={() => setPreviewMedia(null)}
                    className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-2 flex items-center justify-center max-h-[80vh] overflow-hidden">
                <img
                  src={previewMedia.url}
                  alt={previewMedia.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
                />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
