import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  ClipboardList, 
  PlusCircle, 
  Search, 
  Clock, 
  User, 
  Phone, 
  Filter, 
  Edit2, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  ChevronLeft, 
  X, 
  MessageSquare, 
  AlertOctagon,
  ArrowRight,
  MoreHorizontal,
  RotateCcw
} from 'lucide-react';
import { searchCustomers } from '../lib/api';

const BUSINESS_ID = '4c424fea-a5fb-485f-b695-535eac647224';

interface CustomerOrdersViewProps {
  onPrefillTransaction?: (data: any) => void;
}

export default function CustomerOrdersView({ onPrefillTransaction }: CustomerOrdersViewProps) {
  // Session details
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
  }, []);

  // View mode state: 'list' | 'create' | 'edit' | 'details'
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit' | 'details'>('list');

  // UI state
  const [orders, setOrders] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter and search query
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected order for view details or editing
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Actions UI States
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'cancel_order' | 'reopen_order' | 'change_status';
    targetStatus?: string;
    title: string;
    impactDescription: string;
  } | null>(null);
  const [actionReason, setActionReason] = useState('');

  // Simple Form states
  const [formSource, setFormSource] = useState('whatsapp');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formOrderText, setFormOrderText] = useState('');
  const [formPriority, setFormPriority] = useState('normal');
  const [formNotes, setFormNotes] = useState('');

  // Customer Autocomplete states
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Constants mapping tags and status
  const STATUS_LABELS: Record<string, string> = {
    new: 'طلب جديد',
    in_progress: 'قيد المتابعة',
    waiting_customer: 'بانتظار العميل',
    ready: 'جاهز للاستلام',
    completed: 'جاهز ومكتمل',
    cancelled: 'طلب ملغي',
  };

  const PRIORITY_LABELS: Record<string, string> = {
    normal: 'عادي',
    important: 'مهم',
    urgent: '🚨 عاجل جداً',
  };

  const SOURCE_LABELS: Record<string, string> = {
    whatsapp: 'واتساب',
    manual: 'يدوي',
    phone: 'اتصال هاتفي',
    instagram: 'إنستغرام',
    other: 'أخرى',
  };

  // Fetch summary and list
  const loadSummaryData = async () => {
    try {
      setLoadingSummary(true);
      const { data, error } = await supabase.rpc('ibex_had_get_customer_orders_summary', {
        p_business_id: BUSINESS_ID
      });
      if (error) throw error;
      setSummary(data || null);
    } catch (err: any) {
      console.error('Failed to load orders summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadOrdersList = async () => {
    try {
      setLoadingList(true);
      setErrorMsg(null);
      const mappedStatus = activeTab === 'all' ? null : activeTab;
      
      const { data, error } = await supabase.rpc('ibex_had_get_customer_orders', {
        p_business_id: BUSINESS_ID,
        p_status: mappedStatus,
        p_search: searchQuery.trim() || null,
        p_limit: 100,
        p_offset: 0
      });

      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      console.error('Failed to fetch customer orders:', err);
      setErrorMsg('حدث خطأ أثناء تحميل الطلبات من الخادم السحابي.');
    } finally {
      setLoadingList(false);
    }
  };

  // Load effects
  useEffect(() => {
    loadSummaryData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrdersList();
    }, 300); // debounce input queries
    return () => clearTimeout(timer);
  }, [activeTab, searchQuery]);

  // Handle live customer searching
  const handleCustomerNameChange = async (name: string) => {
    setFormCustomerName(name);
    if (name.trim().length > 0) {
      try {
        const { data } = await searchCustomers(name.trim());
        setCustomerResults(data || []);
        setShowCustomerDropdown(true);
      } catch (err) {
        setCustomerResults([]);
      }
    } else {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
    }
  };

  // Helper flash alerts
  const triggerSuccessAlert = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Enter Create New form
  const handleOpenNewOrder = () => {
    setFormSource('whatsapp');
    setFormCustomerName('');
    setFormCustomerPhone('');
    setFormOrderText('');
    setFormPriority('normal');
    setFormNotes('');
    setCustomerResults([]);
    setShowCustomerDropdown(false);
    setViewMode('create');
  };

  // Enter Edit Form loaded with DB values
  const handleOpenEditOrder = (order: any) => {
    setFormSource(order.source || 'whatsapp');
    setFormCustomerName(order.customer_name || '');
    setFormCustomerPhone(order.customer_phone || '');
    setFormOrderText(order.order_text || '');
    setFormPriority(order.priority || 'normal');
    setFormNotes(order.notes || '');
    setCustomerResults([]);
    setShowCustomerDropdown(false);
    setViewMode('edit');
  };

  // Submit unified Create or Update order form
  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) {
      alert('الرجاء كتابة اسم العميل أولاً');
      return;
    }
    if (!formOrderText.trim()) {
      alert('الرجاء الصاق أو كتابة نص رسالة العميل واردة واتساب');
      return;
    }

    try {
      const orderPayload = {
        business_id: BUSINESS_ID,
        source: formSource,
        customer_name: formCustomerName.trim(),
        customer_phone: formCustomerPhone.trim() || null,
        order_text: formOrderText.trim(),
        priority: formPriority,
        notes: formNotes.trim() || null,
        created_by_user_id: currentUser?.id || null,
        created_by_email: currentUser?.email || null,
        items: [] // Sent empty list as requested to avoid nested components complex forms
      };

      if (viewMode === 'edit' && selectedOrder) {
        const { error } = await supabase.rpc('ibex_had_update_customer_order', {
          p_order_id: selectedOrder.id,
          p_payload: orderPayload
        });
        if (error) throw error;
        triggerSuccessAlert('تم تحديث الطلب بنجاح 🍯');
      } else {
        const { error } = await supabase.rpc('ibex_had_create_customer_order', {
          p_payload: orderPayload
        });
        if (error) throw error;
        triggerSuccessAlert('تم تسجيل طلب المبيعات من رسالة العميل بنجاح 🍯');
      }

      setViewMode('list');
      loadSummaryData();
      loadOrdersList();
    } catch (err: any) {
      console.error('Save order failure:', err);
      alert('حدث خطأ أثناء حفظ الطلبية وسحب الخادم: ' + (err.message || 'فشلت الاستجابة'));
    }
  };

  // Open details viewer for selected order
  const handleOpenOrderDetail = (order: any) => {
    setSelectedOrder(order);
    setViewMode('details');
  };

  // Quick State Updates with fallback
  const handleChangeStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase.rpc('ibex_had_update_customer_order_status', {
        p_order_id: orderId,
        p_status: newStatus, p_note: `تم تحديث جاهزية الطلبية إلى ${STATUS_LABELS[newStatus]}`,
        p_converted_transaction_id: null
      });

      if (error) throw error;
      triggerSuccessAlert(`تم تعديل حالة الطلبية بنجاح إلى [${STATUS_LABELS[newStatus]}]`);

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
      loadOrdersList();
      loadSummaryData();
    } catch (err: any) {
      alert('فشل عملية تغيير الحالة: ' + err.message);
    }
  };

  // Secure Actions Layer Execution
  const handleExecuteOrderAction = async () => {
    if (!confirmAction) return;
    if (!actionReason.trim()) {
      alert('يرجى كتابة سبب الإجراء للاستمرار.');
      return;
    }

    try {
      let targetStatus = '';
      if (confirmAction.type === 'cancel_order') {
        targetStatus = 'cancelled';
      } else if (confirmAction.type === 'reopen_order') {
        targetStatus = 'in_progress';
      } else if (confirmAction.type === 'change_status' && confirmAction.targetStatus) {
        targetStatus = confirmAction.targetStatus;
      }

      const { error } = await supabase.rpc('ibex_had_update_customer_order_status', {
        p_order_id: selectedOrder.id,
        p_status: targetStatus,
        p_note: `[إجراء]: ${confirmAction.title} - السبب: ${actionReason}`,
        p_converted_transaction_id: null
      });

      if (error) throw error;
      triggerSuccessAlert(`تم تنفيذ الإجراء بنجاح: ${confirmAction.title}`);

      setSelectedOrder({ 
        ...selectedOrder, 
        status: targetStatus,
        notes: (selectedOrder.notes ? selectedOrder.notes + '\n' : '') + `[إجراء]: ${confirmAction.title} - السبب: ${actionReason}`
      });

      setConfirmAction(null);
      setActionReason('');
      setShowActionsMenu(false);

      loadOrdersList();
      loadSummaryData();
    } catch (err: any) {
      alert('فشل تنفيذ الإجراء: ' + err.message);
    }
  };

  const handleCancelOrder = async (order: any) => {
    setConfirmAction({
      type: 'cancel_order',
      title: 'إلغاء الطلب بالكامل',
      impactDescription: 'سيتم إلغاء هذا الطلب وتغيير حالته إلى ملغي، مع تسجيل سبب الإلغاء.'
    });
    setActionReason('');
  };

  // Styled badges classes
  const getPriorityBadgeClass = (priority: string) => {
    switch(priority) {
      case 'urgent': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'important': return 'bg-amber-500/10 text-[#C17C00] border-amber-500/20';
      default: return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch(status) {
      case 'new': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'in_progress': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'waiting_customer': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'ready': return 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/25';
      case 'completed': return 'bg-gray-100 text-gray-500 border-gray-200';
      case 'cancelled': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  return (
    <div className="space-y-6" dir="rtl" id="customer-orders-viewport">
      
      {/* 1. Header with custom description */}
      {viewMode === 'list' && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card-bg border border-border-val p-5 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#FFFBF0] border border-[#F5E6CC] flex items-center justify-center shrink-0">
              <ClipboardList className="w-6 h-6 text-honey" />
            </div>
            <div>
              <h2 className="text-lg font-black text-main-text leading-tight">طلبات العملاء</h2>
              <p className="text-xs text-sec-text mt-0.5">احفظ رسائل واتساب الواردة من العملاء وتابع إنجازها.</p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleOpenNewOrder}
            className="w-full sm:w-auto bg-honey hover:bg-honey-hover text-white font-black py-3 px-5 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md shadow-honey/15"
          >
            <PlusCircle className="w-4 h-4" />
            <span>طلب جديد</span>
          </button>
        </div>
      )}

      {/* Action Flash Updates Success Message */}
      {successMsg && (
        <div className="bg-success-val/15 border border-success-val/30 rounded-xl p-3.5 text-success-val text-xs font-bold flex items-center gap-2.5 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-success-val" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 2. Main list layout */}
      {viewMode === 'list' && (
        <>
          {/* Filters & Searches */}
          <div className="bg-card-bg border border-border-val rounded-2xl p-4 space-y-4">
            
            {/* Search Input */}
            <div className="relative">
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sec-text">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                className="w-full bg-soft-card border border-border-val rounded-xl py-2.5 pr-10 pl-4 text-xs font-semibold text-main-text focus:border-honey outline-none transition-colors text-right"
                placeholder="البحث باسم العميل، رقم الجوال، نص الرسالة، أو رقم الطلب..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Tabs selection */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[11px] text-sec-text font-black pl-1.5 shrink-0 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                تصفية:
              </span>
              {[
                { id: 'all', name: 'الكل' },
                { id: 'new', name: 'جديدة' },
                { id: 'in_progress', name: 'قيد المتابعة' },
                { id: 'completed', name: 'منجزة' },
                { id: 'cancelled', name: 'ملغاة' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-honey text-white font-black'
                      : 'bg-soft-card text-main-text border border-border-val hover:bg-gray-100'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>

          </div>

          {/* Orders Listings Viewport */}
          {loadingList ? (
            <div className="flex flex-col items-center justify-center py-20 bg-card-bg rounded-2xl border border-border-val">
              <div className="w-10 h-10 border-4 border-honey/20 border-t-honey rounded-full animate-spin mb-3" />
              <p className="text-xs text-sec-text font-bold">جاري مزامنة وسحب كشف طلبات العملاء...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-card-bg rounded-2xl border border-border-val text-center p-6">
              <div className="text-4xl mb-3">📦</div>
              <h4 className="text-xs font-black text-main-text">لا توجد أي رسائل طلبات مطابقة</h4>
              <p className="text-[11px] text-sec-text mt-1 max-w-sm font-semibold">ابدأ بتسجيل طلب جديد لحفظ رغبات المشتري ومتابعتها.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orders.map((order, idx) => (
                <div 
                  key={`${order.id}-${idx}`}
                  className="bg-white border border-border-val rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-0.5">
                        <span className="font-mono text-[9px] font-black text-sec-text block">{order.order_no}</span>
                        <h3 className="text-xs font-black text-main-text flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-honey shrink-0" />
                          <span>{order.customer_name || 'عميل غير محدد'}</span>
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className={`text-[9.5px] px-2 py-0.5 rounded-full border ${getStatusBadgeClass(order.status)} font-black`}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                        {order.priority && (
                          <span className={`text-[9.5px] px-2 py-0.5 rounded-full border ${getPriorityBadgeClass(order.priority)} font-bold`}>
                            {PRIORITY_LABELS[order.priority] || order.priority}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Phone number */}
                    {order.customer_phone && (
                      <div className="flex items-center gap-1.5 text-xs text-sec-text font-mono font-medium">
                        <Phone className="w-3.5 h-3.5 text-sec-text shrink-0" />
                        <span>{order.customer_phone}</span>
                      </div>
                    )}

                    {/* Copied WhatsApp Message (Summarized to 2 or 3 lines) */}
                    {order.order_text && (
                      <div className="bg-soft-card p-3 rounded-xl border border-border-val/55 text-right">
                        <span className="text-[9.5px] text-sec-text font-black block mb-1">رسالة الوكيل/العميل:</span>
                        <p className="text-xs text-main-text font-medium leading-relaxed max-h-[72px] overflow-hidden line-clamp-3 whitespace-pre-wrap">
                          {order.order_text}
                        </p>
                      </div>
                    )}

                    {/* Extra properties */}
                    <div className="flex flex-wrap items-center justify-between text-[10px] text-sec-text pt-2 border-t border-border-val/20">
                      <span className="bg-[#FAF5E6] text-honey font-bold px-1.5 py-0.5 rounded text-[9.5px] border border-[#F5E6CC]/40">
                        مستلم عبر: {SOURCE_LABELS[order.source] || order.source}
                      </span>
                      <span className="font-mono text-[9px]">
                        أُنشئ: {new Date(order.created_at).toLocaleDateString('ar-YE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                  </div>

                  {/* Simplified Actions Grid */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border-val/30">
                    <button
                      type="button"
                      onClick={() => handleOpenOrderDetail(order)}
                      className="bg-honey/10 hover:bg-honey hover:text-white text-honey text-xs font-black py-2 rounded-xl transition-all cursor-pointer flex justify-center items-center gap-1"
                    >
                      <span>فتح</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeStatus(order.id, 'completed')}
                      className="bg-[#10B981]/10 hover:bg-[#10B981] hover:text-white text-[#10B981] text-xs font-bold py-2 rounded-xl transition-all cursor-pointer"
                    >
                      <span>تم الإنجاز</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelOrder(order)}
                      className="bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 text-xs font-bold py-2 rounded-xl transition-all cursor-pointer"
                    >
                      <span>إلغاء</span>
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 3. SIMPLIFIED FORM SCREEN (CREATE / EDIT) */}
      {(viewMode === 'create' || viewMode === 'edit') && (
        <div className="bg-card-bg border border-border-val rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-border-val pb-3">
            <div className="flex items-center gap-2.5">
              <ClipboardList className="w-5 h-5 text-honey" />
              <h3 className="text-sm font-black text-main-text">
                {viewMode === 'edit' ? `تعديل الطلبية: ${selectedOrder?.order_no}` : 'تسجيل طلبية واتساب جديدة'}
              </h3>
            </div>
            <button
              onClick={() => {
                setViewMode(viewMode === 'edit' ? 'details' : 'list');
              }}
              className="text-sec-text hover:text-main-text text-xs font-black flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              <span>إغلاق التراجع</span>
            </button>
          </div>

          <form onSubmit={handleSaveOrder} className="space-y-4 text-right">
            
            {/* Input Row 1: Source & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-main-text">قناة استلام الطلب</label>
                <select
                  className="w-full bg-soft-card border border-border-val rounded-xl py-2.5 px-3 text-xs font-semibold text-main-text focus:border-honey outline-none appearance-none"
                  value={formSource}
                  onChange={(e) => setFormSource(e.target.value)}
                >
                  <option value="whatsapp">واتساب (WhatsApp)</option>
                  <option value="phone">اتصال هاتفي مباشر</option>
                  <option value="manual">يدوي / ورقي</option>
                  <option value="instagram">انستجرام / تواصل اجتماعي</option>
                  <option value="other">أخرى</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-main-text">أولوية المتابعة</label>
                <select
                  className="w-full bg-soft-card border border-border-val rounded-xl py-2.5 px-3 text-xs font-semibold text-main-text focus:border-honey outline-none appearance-none"
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                >
                  <option value="normal">عادي</option>
                  <option value="important">مهم ومستعجل</option>
                  <option value="urgent">عاجل وطارئ جداً 🚨</option>
                </select>
              </div>
            </div>

            {/* Input Row 2: Customer Name with Dropdown Autocomplete & Phone Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 relative">
                <label className="text-xs font-black text-main-text">اسم العميل (مطلوب)</label>
                <input
                  type="text"
                  required
                  className="w-full bg-soft-card border border-border-val rounded-xl py-2.5 px-3 text-xs font-semibold text-main-text focus:border-honey outline-none text-right"
                  placeholder="مثال: صالح محمد اليماني (أو ابحث عن عميل موجود)..."
                  value={formCustomerName}
                  onChange={(e) => handleCustomerNameChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 250)}
                />

                {/* Autocomplete dropdown selection */}
                {showCustomerDropdown && customerResults.length > 0 && (
                  <div className="absolute right-0 left-0 bg-white border border-border-val rounded-xl shadow-lg z-30 mt-1 max-h-40 overflow-y-auto text-right">
                    {customerResults.map((c, i) => (
                      <div
                        key={`${c.id || i}`}
                        onMouseDown={() => {
                          setFormCustomerName(c.customer_name);
                          setFormCustomerPhone(c.phone_number || '');
                          setShowCustomerDropdown(false);
                        }}
                        className="p-2.5 text-xs hover:bg-honey/10 cursor-pointer text-main-text font-black border-b border-gray-50 flex justify-between items-center"
                      >
                        <span className="text-honey">{c.customer_name}</span>
                        {c.phone_number && (
                          <span className="text-sec-text font-mono text-[10px]">{c.phone_number}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-main-text">رقم جوال العميل</label>
                <input
                  type="tel"
                  className="w-full bg-soft-card border border-border-val rounded-xl py-2.5 px-3 text-xs font-mono font-bold text-main-text focus:border-honey outline-none text-left"
                  placeholder="770000000"
                  value={formCustomerPhone}
                  onChange={(e) => setFormCustomerPhone(e.target.value)}
                />
              </div>
            </div>

            {/* Input Row 3: Whatsapp Raw Message Text Area */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-main-text flex justify-between items-center">
                <span>نص رسالة العميل الكاملة (المنسوخة من واتساب)</span>
                <span className="text-[10px] text-sec-text">الصق الرسالة كلياً كما وردت</span>
              </label>
              <textarea
                required
                className="w-full bg-soft-card border border-border-val rounded-xl py-3 px-3.5 text-xs font-medium text-main-text focus:border-honey outline-none"
                rows={7}
                placeholder="الصق هنا رسالة العميل كما وصلت في واتساب..."
                value={formOrderText}
                onChange={(e) => setFormOrderText(e.target.value)}
              />
            </div>

            {/* Input Row 4: Notes and internal description */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-main-text">ملاحظة داخلية للمتابعة (اختياري)</label>
              <input
                type="text"
                className="w-full bg-soft-card border border-border-val rounded-xl py-2.5 px-3 text-xs font-semibold text-main-text focus:border-honey outline-none"
                placeholder="توصيل مع باص الرويشان، تغليف كرتوني ممتاز، الخ..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>

            {/* Save controllers */}
            <div className="flex gap-3 pt-4 border-t border-border-val/40">
              <button
                type="submit"
                className="flex-grow bg-honey hover:bg-honey-hover text-white font-black py-3 rounded-xl text-xs flex justify-center items-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <span>حفظ ومزامنة الطلب 🍯</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode(viewMode === 'edit' ? 'details' : 'list');
                }}
                className="bg-gray-100 hover:bg-gray-200 text-main-text font-bold px-6 py-3 rounded-xl text-xs transition-colors cursor-pointer"
              >
                إلغاء التراجع
              </button>
            </div>

          </form>
        </div>
      )}

      {/* 4. SIMPLIFIED DETAILS SCREEN (VIEW MODE) */}
      {viewMode === 'details' && selectedOrder && (
        <div className="bg-card-bg border border-border-val rounded-2xl p-6 space-y-6">
          
          {/* Back Action Header */}
          <div className="flex items-center justify-between border-b border-border-val pb-3.5">
            <button
              onClick={() => setViewMode('list')}
              className="text-honey hover:text-honey-hover font-black text-xs flex items-center gap-1.5 cursor-pointer bg-honey/5 px-3 py-2 rounded-xl"
            >
              <ArrowRight className="w-4 h-4" />
              <span>رجوع لطلبات العملاء</span>
            </button>
            <span className="font-mono text-xs font-black text-sec-text">رقم الطلب: {selectedOrder.order_no}</span>
          </div>

          {/* Unified Properties Grid */}
          <div className="bg-white border border-border-val/70 rounded-2xl p-4.5 space-y-3.5 text-xs text-right">
            
            <div className="flex justify-between items-center pb-2.5 border-b border-border-val/30">
              <span className="text-sec-text font-bold">اسم العميل:</span>
              <span className="text-main-text font-black text-sm">{selectedOrder.customer_name || 'عام'}</span>
            </div>

            {selectedOrder.customer_phone && (
              <div className="flex justify-between items-center pb-2.5 border-b border-border-val/30">
                <span className="text-sec-text font-bold">رقم الجوال:</span>
                <div className="flex items-center gap-2">
                  <a href={`tel:${selectedOrder.customer_phone}`} className="text-honey font-mono font-black border border-border-val/40 px-2 py-0.5 rounded-md hover:underline">
                    {selectedOrder.customer_phone}
                  </a>
                  <a 
                    href={`https://wa.me/${selectedOrder.customer_phone.replace(/\+/g, '').replace(/^00/, '')}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-md text-[10px]"
                  >
                    مراسلة واتساب 📱
                  </a>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pb-2.5 border-b border-border-val/30">
              <span className="text-sec-text font-bold">قناة الاستلام:</span>
              <span className="bg-soft-card border border-border-val px-2.5 py-0.5 rounded-lg text-[10.5px] text-main-text font-black">
                {SOURCE_LABELS[selectedOrder.source] || selectedOrder.source}
              </span>
            </div>

            <div className="flex justify-between items-center pb-2.5 border-b border-border-val/30">
              <span className="text-sec-text font-bold">درجة الأولوية:</span>
              <span className={`px-2.5 py-0.5 rounded-lg text-[10.5px] border font-black ${getPriorityBadgeClass(selectedOrder.priority)}`}>
                {PRIORITY_LABELS[selectedOrder.priority] || selectedOrder.priority}
              </span>
            </div>

            <div className="flex justify-between items-center pb-2.5 border-b border-border-val/30">
              <span className="text-sec-text font-bold">حالة الطلبية:</span>
              <span className={`px-2.5 py-0.5 rounded-lg text-[10.5px] border font-black ${getStatusBadgeClass(selectedOrder.status)}`}>
                {STATUS_LABELS[selectedOrder.status] || selectedOrder.status}
              </span>
            </div>

            <div className="flex justify-between items-center pb-2.5 border-b border-border-val/30">
              <span className="text-sec-text font-bold">تاريخ الإنشاء والتسجيل:</span>
              <span className="font-mono font-bold text-main-text">
                {new Date(selectedOrder.created_at).toLocaleDateString('ar-YE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {selectedOrder.created_by_email && (
              <div className="flex justify-between items-center pb-2.5 border-b border-[#FAF5E6]">
                <span className="text-sec-text font-bold">مدخل الطلبية:</span>
                <span className="font-bold text-sec-text">
                  {selectedOrder.created_by_email}
                </span>
              </div>
            )}

            {selectedOrder.notes && (
              <div className="py-2">
                <span className="text-sec-text font-bold block mb-1">الملاحظات الداخلية للمتابعة:</span>
                <p className="bg-[#FFFDF7] p-3 rounded-xl border border-border-val mt-0.5 text-main-text font-bold leading-relaxed">
                  {selectedOrder.notes}
                </p>
              </div>
            )}

            {selectedOrder.order_text && (
              <div className="py-2.5">
                <span className="text-sec-text font-black block mb-1.5 text-xs">نص رسالة العميل المسحوبة (واتساب):</span>
                <p className="bg-[#FAF5E6] p-4 rounded-xl border border-[#F5E6CC] text-[#633B00] font-semibold whitespace-pre-wrap leading-relaxed select-all text-xs">
                  {selectedOrder.order_text}
                </p>
              </div>
            )}

          </div>

          {/* Unified Actions Interface */}
          <div className="bg-soft-card p-4 rounded-2xl border border-border-val/60 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-sec-text">لوحة التحكم السريعة بالطلب:</span>
              <button
                type="button"
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                className="bg-white hover:bg-gray-50 text-main-text border border-border-val px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
              >
                <MoreHorizontal className="w-3.5 h-3.5 text-honey animate-pulse" />
                <span>إجراءات الطلب</span>
              </button>
            </div>

            {/* Actions list dropdown drawer */}
            {showActionsMenu && !confirmAction && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-val/40 fade-in">
                {/* 1. Reopen if completed/cancelled */}
                {(selectedOrder.status === 'completed' || selectedOrder.status === 'cancelled') ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmAction({
                        type: 'reopen_order',
                        title: 'إعادة فتح هذا الطلب ماليًا/تشغيليًا',
                        impactDescription: 'سيتم سحب الطلب من قائمة المنتهية وإعادته لوضع [قيد المتابعة] لتتمكن من العمل عليه من جديد.'
                      });
                      setActionReason('');
                    }}
                    className="p-2.5 rounded-xl border border-amber-300 bg-amber-500/10 text-amber-700 font-black text-xs text-center flex items-center justify-center gap-1 hover:bg-amber-500 hover:text-white transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>إعادة فتح الطلب</span>
                  </button>
                ) : (
                  <>
                    {/* 2. Move to Completed */}
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmAction({
                          type: 'change_status',
                          targetStatus: 'completed',
                          title: 'وسم الطلب كـ [جاهز ومكتمل]',
                          impactDescription: 'تأكيد إنجاز وتجهيز الطلب للعميل، سيتم نقل الطلبية لقسم الأرشيف المكتمل.'
                        });
                        setActionReason('');
                      }}
                      className="p-2.5 rounded-xl border border-emerald-300 bg-emerald-500/10 text-emerald-700 font-black text-xs text-center flex items-center justify-center gap-1 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>قيد الإكمال (تم)</span>
                    </button>

                    {/* 3. Edit details */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditOrder(selectedOrder)}
                      className="p-2.5 rounded-xl border border-gray-300 bg-gray-50 text-main-text font-black text-xs text-center flex items-center justify-center gap-1 hover:bg-gray-200 transition-all cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-honey" />
                      <span>تعديل التفاصيل</span>
                    </button>
                  </>
                )}

                {/* 4. Cancel (Always available unless already cancelled) */}
                {selectedOrder.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => handleCancelOrder(selectedOrder)}
                    className="p-2.5 rounded-xl border border-red-300 bg-red-500/10 text-red-600 font-black text-xs text-center flex items-center justify-center gap-1 hover:bg-red-600 hover:text-white transition-all cursor-pointer col-span-2"
                  >
                    <AlertOctagon className="w-3.5 h-3.5" />
                    <span>إلغاء هذا الطلب</span>
                  </button>
                )}
              </div>
            )}

            {/* Elegant, Non-intrusive Inline Confirmation Card for Sensitive Actions */}
            {confirmAction && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4.5 space-y-4 shadow-inner text-right fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertOctagon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-amber-900">{confirmAction.title}</h4>
                    <p className="text-[10.5px] text-amber-800/90 mt-1 leading-relaxed font-semibold">
                      {confirmAction.impactDescription}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-amber-950">سبب التغيير أو التراجع (مطلوب للتتبع) *:</label>
                  <input
                    type="text"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    className="w-full bg-white border border-amber-200 rounded-xl py-2 px-3 text-xs font-bold text-main-text focus:border-amber-500 outline-none"
                    placeholder="اكتب هنا سبب تغيير الحالة بوضوح..."
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleExecuteOrderAction}
                    disabled={!actionReason.trim() || loadingList}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-black py-2 px-3 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    تأكيد الإجراء 💾
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmAction(null);
                      setActionReason('');
                    }}
                    className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    تراجع
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
