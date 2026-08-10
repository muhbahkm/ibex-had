/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Search, 
  DollarSign, 
  UserPlus, 
  ExternalLink, 
  RefreshCw,
  Phone,
  ArrowUpLeft,
  Calendar,
  AlertTriangle,
  UserX,
  CheckCircle2,
  MoreVertical,
  X,
  Edit2,
  Trash2,
  Ban,
  CheckCircle,
  Play,
  FileText,
  Badge,
  Sparkles,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, BUSINESS_ID } from '../lib/supabaseClient';
import { 
  getCustomerBalancesReport, 
  upsertCustomer, 
  updateCustomerStatus, 
  createTransaction,
  getCustomerDetail,
  generateCustomerStatementPdf,
  printHtmlElement,
  generatePdfFromHtml,
  openPrintPreview,
  searchCustomers
} from '../lib/api';
import { CURRENCY_LABELS, CurrencyType, TRANSACTION_LABELS } from '../types';
import { formatNumber, formatMoney, normalizeDigits, parseNormalizedFloat } from '../lib/numberUtils';

interface CustomersViewProps {
  onSelectCustomer: (id: string) => void;
  onPrefillTransaction: (data: any) => void;
}

export default function CustomersView({ onSelectCustomer, onPrefillTransaction }: CustomersViewProps) {
  // Local state
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyPositive, setOnlyPositive] = useState(false);
  
  // Notification Banners
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<{ title: string; desc?: string } | null>(null);

  // PDF statement loading state
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);

  // Dynamic Preferences state for statement generation
  const [showStatementPrefsModal, setShowStatementPrefsModal] = useState(false);
  const [prefsCustomerId, setPrefsCustomerId] = useState<string | null>(null);
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

  const handleGenerateCustomerStatementPdf = async (customerId: string, customOptions?: any) => {
    setLoadingPdfId(customerId);
    try {
      const activeOptions = customOptions || prefsForm;
      const { data, error } = await generateCustomerStatementPdf(customerId, activeOptions);
      if (error) {
        alert('تعذر إنشاء كشف الحساب: ' + error);
        return;
      }
      
      if (data === 'STATION_DOWNLOADED') {
        return;
      }

      const custObj = customers.find(c => c.customer_id === customerId);
      const custName = custObj ? custObj.customer_name : 'العميل';
      const todayStr = new Date().toISOString().slice(0, 10).replace(/[^0-9]/g, '');
      const formattedTitle = (activeOptions.reportTitle || 'كشف_حساب').trim().replace(/\s+/g, '_');
      const fileName = `statement-${custName}-${formattedTitle}-${todayStr}.pdf`;

      const webhookUrl = import.meta.env.VITE_PDF_RENDER_WEBHOOK_URL;
      if (webhookUrl) {
        await generatePdfFromHtml({
          html: data!,
          fileName,
          documentType: 'customer_statement',
          metadata: {
            customer_id: customerId,
            customer_name: custName,
            options: activeOptions
          }
        });
      } else {
        openPrintPreview(data!);
      }
    } catch (e: any) {
      alert('خطأ أثناء توليد المستند: ' + (e.message || JSON.stringify(e)));
    } finally {
      setLoadingPdfId(null);
    }
  };

  // Active Dropdown state (for card actions)
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // View modes: 'list' | 'add' | 'simple_entry'
  const [viewMode, setViewMode] = useState<'list' | 'add' | 'simple_entry'>('list');

  // Currently authenticated user
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
  }, []);

  // Opening Balance state inside CustomersView component
  const [hasOpeningBalance, setHasOpeningBalance] = useState(false);
  const [openingBalanceDirection, setOpeningBalanceDirection] = useState<'customer_owes_us' | 'we_owe_customer'>('customer_owes_us');
  const [openingBalanceAmount, setOpeningBalanceAmount] = useState('');
  const [openingBalanceCurrency, setOpeningBalanceCurrency] = useState<CurrencyType>('YER');
  const [openingBalanceDescription, setOpeningBalanceDescription] = useState('رصيد افتتاحي عند إضافة العميل');

  // Simple entry state
  const [entryType, setEntryType] = useState<'customer_debit' | 'customer_credit' | 'adjustment' | 'discount'>('customer_debit');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryCurrency, setEntryCurrency] = useState<CurrencyType>('YER');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 16)); // YYYY-MM-DDTHH:mm format

  // Autocomplete search inside simple_entry
  const [entrySearchQuery, setEntrySearchQuery] = useState('');
  const [entrySearchResults, setEntrySearchResults] = useState<any[]>([]);
  const [showEntryDropdown, setShowEntryDropdown] = useState(false);

  // Modals visibility toggles
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showFinancialDetailsModal, setShowFinancialDetailsModal] = useState(false);
  const [financialDetailsLoading, setFinancialDetailsLoading] = useState(false);
  const [financialDetailsData, setFinancialDetailsData] = useState<any>(null);
  const [financialDetailsError, setFinancialDetailsError] = useState<string | null>(null);

  // Selected customer buffers
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  // Modal form states
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    notes: '',
    is_active: true
  });

  const [receiptForm, setReceiptForm] = useState({
    amount: '',
    currency: 'YER' as CurrencyType,
    notes: 'سداد دفعة من الحساب'
  });

  // Load customer lists on trigger change
  useEffect(() => {
    loadCustomers();
  }, [onlyPositive]);

  // Click outside listener for the dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdownId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch and enrich customer rows
  const loadCustomers = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // 1. Get the balances report (passing false so we get all balances, then we'll filter locally if onlyPositive is true)
      const res = await getCustomerBalancesReport(false);
      if (res.error) throw new Error(res.error);

      // 2. Fetch all customers from the database directly for the current business
      const { data: rawRows, error: rawError } = await supabase
        .from('ibex_had_customers')
        .select('*')
        .eq('business_id', BUSINESS_ID);

      if (rawError) throw rawError;

      // 3. For every customer in rawRows, find their balance report row (by customer_id === id)
      // If found, merge it. If not, default to 0 balances.
      const enriched = (rawRows || []).map((raw: any) => {
        const balanceRow = (res.data || []).find((c: any) => c.customer_id === raw.id);
        return {
          customer_id: raw.id,
          customer_name: raw.display_name || raw.customer_name || 'زبون (غير محدد الاسم)',
          phone_number: raw.phone || raw.phone_number || '',
          notes: raw.notes || '',
          is_active: raw.is_active !== false,
          balance_yer: balanceRow ? Number(balanceRow.balance_yer || 0) : 0,
          balance_sar: balanceRow ? Number(balanceRow.balance_sar || 0) : 0,
          balance_usd: balanceRow ? Number(balanceRow.balance_usd || 0) : 0,
          last_transaction_date: balanceRow ? (balanceRow.last_transaction_at || balanceRow.last_transaction_date || null) : null
        };
      });

      // 4. Apply onlyPositive filter if active
      const finalCustomers = onlyPositive
        ? enriched.filter((c: any) => c.balance_yer > 0 || c.balance_sar > 0 || c.balance_usd > 0)
        : enriched;

      setCustomers(finalCustomers);
    } catch (err: any) {
      setErrorMessage('أخفق تحميل كشوف وملفات حساب العملاء: ' + (err?.message || 'خطأ'));
    } finally {
      setLoading(false);
    }
  };

  // Filter customers by local search input
  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase();
    const nameMatch = (c.customer_name || '').toLowerCase().includes(q);
    const phoneMatch = (c.phone_number || '').includes(q);
    return nameMatch || phoneMatch;
  });

  // Handle Add Customer Submission
  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navigator.onLine) {
      alert('لا يوجد اتصال بالإنترنت. لا يمكن حفظ العمليات المالية أو تعديل العملاء حتى يعود الاتصال.');
      return;
    }
    if (!customerForm.name.trim()) {
      alert('فضلا أدخل اسم العميل أولاً');
      return;
    }

    const amountVal = parseNormalizedFloat(openingBalanceAmount);
    if (hasOpeningBalance) {
      if (isNaN(amountVal) || amountVal <= 0) {
        alert('المبلغ الافتتاحي المدخل يجب أن يكون أكبر من الصفر');
        return;
      }
      if (!openingBalanceCurrency) {
        alert('الرجاء اختيار عملة الرصيد الافتتاحي');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await upsertCustomer({
        customer_name: customerForm.name.trim(),
        phone_number: customerForm.phone.trim() || undefined,
        notes: customerForm.notes.trim() || undefined,
        is_active: customerForm.is_active
      });

      if (res.error) throw new Error(res.error);

      const createdCustomer = res.data?.[0];
      if (!createdCustomer || !createdCustomer.id) {
        throw new Error('تم حفظ العميل لكن لم يتم التعرف على الرقم التعريفي للعميل.');
      }

      let openingBalanceFailed = false;
      let openingBalanceErrorMsg = '';

      if (hasOpeningBalance) {
        const { data: opData, error: opError } = await supabase.rpc('ibex_had_create_customer_opening_balance', {
          p_payload: {
            business_id: BUSINESS_ID,
            customer_id: createdCustomer.id,
            customer_name: createdCustomer.display_name || createdCustomer.customer_name || customerForm.name.trim(),
            customer_phone: createdCustomer.phone || customerForm.phone.trim() || null,
            balance_direction: openingBalanceDirection,
            amount: amountVal,
            currency: openingBalanceCurrency,
            description: openingBalanceDescription.trim() || 'رصيد افتتاحي عند إضافة العميل',
            created_by_user_id: currentUser?.id || null,
            created_by_email: currentUser?.email || null
          }
        });

        if (opError) {
          openingBalanceFailed = true;
          openingBalanceErrorMsg = opError.message || JSON.stringify(opError);
        }
      }

      // Reset values
      setCustomerForm({ name: '', phone: '', notes: '', is_active: true });
      setHasOpeningBalance(false);
      setOpeningBalanceAmount('');
      setOpeningBalanceDirection('customer_owes_us');
      setOpeningBalanceDescription('رصيد افتتاحي عند إضافة العميل');
      setViewMode('list');

      if (hasOpeningBalance) {
        if (openingBalanceFailed) {
          alert('تم إنشاء العميل، لكن فشل تسجيل الرصيد الافتتاحي. الخطأ: ' + openingBalanceErrorMsg);
          triggerSuccess('تم إنشاء العميل جزئياً', 'تم إنشاء العميل بنجاح ولكن تعذر تسجيل رصيده الافتتاحي.');
        } else {
          triggerSuccess('تم حفظ العميل وتسجيل الرصيد الافتتاحي بنجاح', `تم جرد العميل "${customerForm.name}" مع رصيده الافتتاحي بمبلغ ${formatNumber(amountVal)} ${openingBalanceCurrency}.`);
        }
      } else {
        triggerSuccess('تم حفظ العميل بنجاح', `تم إضافة العميل "${customerForm.name}" بنجاح.`);
      }

      await loadCustomers();
    } catch (err: any) {
      alert('فشل حفظ العميل الجديد: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Simple Entry Submission
  const handleSimpleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navigator.onLine) {
      alert('لا يوجد اتصال بالإنترنت. لا يمكن حفظ العمليات المالية أو تعديل العملاء حتى يعود الاتصال.');
      return;
    }
    if (!selectedCustomer) {
      alert('الرجاء اختيار عميل مالي موجود أولاً لقيد الحركة عليه.');
      return;
    }
    const amountVal = parseNormalizedFloat(entryAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('المبلغ المدخل للقيد يجب أن يكون أكبر من الصفر');
      return;
    }
    if (!entryCurrency) {
      alert('الرجاء تحديد عملة القيد المالي');
      return;
    }
    if (!entryDescription.trim()) {
      alert('البيان حقل إلزامي لضمان توثيق السبب والتحقق المحاسبي');
      return;
    }

    setLoading(true);
    try {
      const { data: entryData, error: entryError } = await supabase.rpc('ibex_had_create_simple_entry', {
        p_payload: {
          business_id: BUSINESS_ID,
          customer_id: selectedCustomer.customer_id || selectedCustomer.id,
          customer_name: selectedCustomer.customer_name || selectedCustomer.display_name,
          customer_phone: selectedCustomer.phone_number || selectedCustomer.phone || null,
          entry_type: entryType,
          amount: amountVal,
          currency: entryCurrency,
          description: entryDescription.trim(),
          entry_datetime: entryDate ? new Date(entryDate).toISOString() : new Date().toISOString(),
          created_by_user_id: currentUser?.id || null,
          created_by_email: currentUser?.email || null
        }
      });

      if (entryError) throw entryError;

      triggerSuccess('تم تسجيل القيد بنجاح', `تم قيد مبلغ ${formatNumber(amountVal)} ${entryCurrency} بنجاح لشأن العميل.`);
      
      // Reset State
      setEntryAmount('');
      setEntryDescription('');
      setEntryDate(new Date().toISOString().slice(0, 16));
      setSelectedCustomer(null);
      setEntrySearchQuery('');
      setViewMode('list');

      await loadCustomers();
    } catch (err: any) {
      alert('أخفق تسجيل القيد المالي الكلي: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Autocomplete Live Search function
  const handleEntrySearch = async (val: string) => {
    setEntrySearchQuery(val);
    if (!val.trim()) {
      setEntrySearchResults([]);
      setShowEntryDropdown(false);
      return;
    }
    try {
      const { data } = await searchCustomers(val.trim());
      setEntrySearchResults(data || []);
      setShowEntryDropdown(true);
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Edit Customer Submission
  const handleEditCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navigator.onLine) {
      alert('لا يوجد اتصال بالإنترنت. لا يمكن حفظ العمليات المالية أو تعديل العملاء حتى يعود الاتصال.');
      return;
    }
    if (!selectedCustomer) return;
    if (!customerForm.name.trim()) {
      alert('الاسم حقل إلزامي لضمان ضبط الدفاتر');
      return;
    }
    setLoading(true);
    try {
      const res = await upsertCustomer({
        id: selectedCustomer.customer_id,
        customer_name: customerForm.name.trim(),
        phone_number: customerForm.phone.trim() || undefined,
        notes: customerForm.notes.trim() || undefined,
        is_active: customerForm.is_active
      });

      if (res.error) throw new Error(res.error);

      setShowEditModal(false);
      setSelectedCustomer(null);
      triggerSuccess('تم تعديل سجلات العميل لتطابق البيان الحالي', `حفِظ الاسم والهاتف الجديد بنجاح.`);
      await loadCustomers();
    } catch (err: any) {
      alert('أخفق تحديث سجل العميل: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger quick cash receipt (سند قبض سريع) submission
  const handleReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navigator.onLine) {
      alert('لا يوجد اتصال بالإنترنت. لا يمكن حفظ العمليات المالية أو تعديل العملاء حتى يعود الاتصال.');
      return;
    }
    if (!selectedCustomer) return;
    const cleanAmount = parseNormalizedFloat(receiptForm.amount);
    if (cleanAmount <= 0) {
      alert('المبلغ المدخل يجب أن يكون أكبر من الصفر');
      return;
    }

    setLoading(true);
    try {
      const resolvedCustomerId = selectedCustomer.customer_id || selectedCustomer.id;
      const resolvedCustomerName = selectedCustomer.customer_name || selectedCustomer.display_name;
      const resolvedCustomerPhone = selectedCustomer.phone_number || selectedCustomer.phone || null;

      const payload = {
        business_id: '', // filled inside API
        transaction_type: 'receipt_voucher' as const,
        currency: receiptForm.currency,
        customer_id: resolvedCustomerId,
        party_name: resolvedCustomerName,
        party_phone: resolvedCustomerPhone,
        cash_account_id: null, // explicit null as required (no safe box locked in MVP)
        total_amount: cleanAmount,
        paid_amount: cleanAmount,
        discount_amount: 0,
        remaining_amount: 0,
        notes: receiptForm.notes || 'سداد آجل فوري سريع',
        send_whatsapp: true,
        auto_create_products: false,
        items: [{
          product_id: null,
          product_name: 'سند قبض مالي نقدي',
          category: 'سندات',
          unit_id: null,
          unit_name: 'قيد',
          quantity: 1,
          unit_price: cleanAmount,
          estimated_unit_cost: 0,
          notes: receiptForm.notes || 'سداد آجل فوري سريع'
        }]
      };

      const res = await createTransaction(payload);
      if (res.error) throw new Error(res.error);

      setShowReceiptModal(false);
      setReceiptForm({ amount: '', currency: 'YER', notes: 'سداد دفعة من الحساب' });
      triggerSuccess('✓ تم قيد وترحيل سند القبض النقدي', `تم سداد مبلغ ${formatNumber(cleanAmount)} ${receiptForm.currency} لحساب العميل وتعديل الذمة تلقائياً.`);
      await loadCustomers();
    } catch (err: any) {
      alert('أخفق حفظ سند القبض السريع: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Suspension flows
  const handleSuspendConfirm = async () => {
    if (!navigator.onLine) {
      alert('لا يوجد اتصال بالإنترنت. لا يمكن حفظ العمليات المالية أو تعديل العملاء حتى يعود الاتصال.');
      return;
    }
    if (!selectedCustomer) return;
    setLoading(true);
    try {
      const res = await updateCustomerStatus(selectedCustomer.customer_id, false);
      if (res.error) throw new Error(res.error);

      setShowSuspendModal(false);
      triggerSuccess('تم تعليق حساب العميل بنجاح', `تم تعليق العميل "${selectedCustomer.customer_name}" ومنع إنشاء سحوبات آجل جديدة.`);
      await loadCustomers();
    } catch (err: any) {
      alert('أخفق تعليق حساب العميل: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Activation flows
  const handleActivateConfirm = async () => {
    if (!navigator.onLine) {
      alert('لا يوجد اتصال بالإنترنت. لا يمكن حفظ العمليات المالية أو تعديل العملاء حتى يعود الاتصال.');
      return;
    }
    if (!selectedCustomer) return;
    setLoading(true);
    try {
      const res = await updateCustomerStatus(selectedCustomer.customer_id, true);
      if (res.error) throw new Error(res.error);

      setShowActivateModal(false);
      triggerSuccess('تم إعادة تفعيل العميل المالي', `حساب العميل "${selectedCustomer.customer_name}" عاد نشطاً ومتاحاً لمبيعات الآجل.`);
      await loadCustomers();
    } catch (err: any) {
      alert('أخفق إعادة تفعيل حساب العميل: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (c: any) => {
    setSelectedCustomer(c);
    setCustomerForm({
      name: c.customer_name,
      phone: c.phone_number || '',
      notes: c.notes || '',
      is_active: c.is_active
    });
    setShowEditModal(true);
    setActiveDropdownId(null);
  };

  const openReceiptModal = (c: any) => {
    setSelectedCustomer(c);
    setReceiptForm({
      amount: '',
      currency: 'YER',
      notes: `سداد دفعة من الرصيد والآجل - ${c.customer_name}`
    });
    setShowReceiptModal(true);
    setActiveDropdownId(null);
  };

  const openSuspendModal = (c: any) => {
    setSelectedCustomer(c);
    setShowSuspendModal(true);
    setActiveDropdownId(null);
  };

  const openActivateModal = (c: any) => {
    setSelectedCustomer(c);
    setShowActivateModal(true);
    setActiveDropdownId(null);
  };

  const openFinancialDetails = async (c: any) => {
    setSelectedCustomer(c);
    setShowFinancialDetailsModal(true);
    setFinancialDetailsLoading(true);
    setFinancialDetailsError(null);
    setFinancialDetailsData(null);
    setActiveDropdownId(null);
    try {
      const res = await getCustomerDetail(c.customer_id);
      if (res.error) throw new Error(res.error);
      setFinancialDetailsData(res.data);
    } catch (err: any) {
      setFinancialDetailsError(err.message || 'فشل جلب تفاصيل كشف حساب العميل');
    } finally {
      setFinancialDetailsLoading(false);
    }
  };

  const triggerSuccess = (title: string, desc?: string) => {
    setSuccessMessage({ title, desc });
    setTimeout(() => setSuccessMessage(null), 8500);
  };

  return (
    <div className="space-y-6 fade-in pb-12 text-right" dir="rtl">
      
      {/* Top Title Bar */}
      {viewMode === 'list' && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card-bg p-5 rounded-2xl border border-border-val shadow-sm gap-4 transition-colors duration-200">
          <div>
            <h2 className="text-xl font-black text-main-text flex items-center gap-2">
              <Users className="w-5 h-5 text-honey" />
              العملاء والذمم
            </h2>
            <p className="text-xs text-sec-text mt-1 text-right">إدارة العملاء، متابعة الأرصدة، كشف الحساب، وإجراءات التحصيل.</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Main action: Simple Journal Entry */}
            <button
              onClick={() => {
                setSelectedCustomer(null);
                setEntryType('customer_debit');
                setEntryAmount('');
                setEntryDescription('');
                setEntrySearchQuery('');
                setViewMode('simple_entry');
              }}
              className="flex-1 sm:flex-initial bg-honey hover:opacity-90 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer font-bold"
            >
              <FileText className="w-4 h-4 text-slate-950" />
              قيد مالي بسيط
            </button>

            {/* Main action: Add Customer */}
            <button
              onClick={() => {
                setCustomerForm({ name: '', phone: '', notes: '', is_active: true });
                setHasOpeningBalance(false);
                setOpeningBalanceAmount('');
                setOpeningBalanceDirection('customer_owes_us');
                setOpeningBalanceDescription('رصيد افتتاحي عند إضافة العميل');
                setViewMode('add');
              }}
              className="flex-1 sm:flex-initial bg-[#F4F1EA] hover:bg-[#E2D8C3] text-main-text border border-[#E5DEC9] font-black text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer font-bold"
            >
              <UserPlus className="w-4 h-4 text-honey" />
              إضافة عميل جديد
            </button>

            {/* Refresh Button */}
            <button
              onClick={loadCustomers}
              disabled={loading}
              className="bg-sec-bg border border-border-val text-main-text hover:bg-side-active p-2.5 rounded-xl cursor-pointer transition-colors"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-success-val/10 border border-success-val/30 p-4 rounded-xl text-xs text-success-val flex items-start gap-3 shadow-md"
        >
          <CheckCircle2 className="w-5 h-5 text-[#32D74B] shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold">{successMessage.title}</strong>
            {successMessage.desc && <span className="text-[11px] opacity-90 block mt-0.5">{successMessage.desc}</span>}
          </div>
        </motion.div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-danger-val/10 border border-danger-val/20 text-danger-val rounded-xl p-4 text-xs">
          {errorMessage}
        </div>
      )}

      {/* CUSTOM VIEW MODE RENDERING */}
      {viewMode === 'add' && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card-bg p-5 rounded-2xl border border-border-val shadow-sm gap-4">
            <div>
              <h2 className="text-xl font-black text-main-text flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-honey" />
                إضافة عميل جديد
              </h2>
              <p className="text-xs text-sec-text mt-1">تجهيز سجل مالي متكامل للعميل في كشوف حسابات مؤسسة باحكم.</p>
            </div>
            <button
              onClick={() => setViewMode('list')}
              className="bg-sec-bg border border-border-val text-main-text transition-all font-black hover:bg-side-active text-xs px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5"
            >
              ✕ العودة للقائمة
            </button>
          </div>

          {/* Form Card */}
          <div className="bg-card-bg border border-border-val rounded-2xl p-5 sm:p-7 shadow-sm space-y-6 max-w-2xl mx-auto">
            <h3 className="font-extrabold text-sm text-main-text border-b border-border-val pb-2.5">
              بيانات العميل الأساسية
            </h3>

            <form onSubmit={handleAddCustomerSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-sec-text mb-2 text-right">اسم العميل (ثنائي أو ثلاثي) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                    placeholder="مثال: صالح أحمد باحكم..."
                    className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-3 px-4 text-xs font-sans outline-none transition-all text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-sec-text mb-2 text-right">رقم الهاتف / الجوال (لإشعارات واتساب):</label>
                  <input
                    type="text"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: normalizeDigits(e.target.value) })}
                    placeholder="مثال: 777111222"
                    className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text font-mono rounded-xl py-3 px-4 text-xs outline-none transition-all text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-sec-text mb-2 text-right">ملاحظات وقيود اختيارية مع العميل:</label>
                <textarea
                  value={customerForm.notes}
                  onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                  placeholder="سكن العميل أو طبيعة عمله أو أي تفاصيل محاسبية أخرى..."
                  rows={3}
                  className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-3 px-4 text-xs outline-none transition-all text-right"
                />
              </div>

              <div className="flex items-center gap-2 pt-1 border-b border-border-val pb-4">
                <input
                  type="checkbox"
                  id="isActiveAddFormFull"
                  checked={customerForm.is_active}
                  onChange={(e) => setCustomerForm({ ...customerForm, is_active: e.target.checked })}
                  className="w-4 h-4 accent-honey cursor-pointer"
                />
                <label htmlFor="isActiveAddFormFull" className="text-xs text-sec-text cursor-pointer select-none font-bold">
                  حالة العميل: نشط حالياً مع سحب الذمم
                </label>
              </div>

              {/* Opening Balance Sector */}
              <div className="bg-soft-card border border-border-val/70 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="hasOpeningBalanceChecked"
                      checked={hasOpeningBalance}
                      onChange={(e) => setHasOpeningBalance(e.target.checked)}
                      className="w-4.5 h-4.5 accent-honey cursor-pointer"
                    />
                    <label htmlFor="hasOpeningBalanceChecked" className="text-xs font-black text-main-text cursor-pointer select-none">
                      لدى العميل رصيد افتتاحي
                    </label>
                  </div>
                  <span className="text-[10px] bg-honey/10 text-[#8F5500] border border-honey/20 px-2.5 py-1 rounded-md font-bold">
                    حركة مالية قيدية
                  </span>
                </div>

                <p className="text-[11px] text-sec-text leading-relaxed">
                  الرصيد الافتتاحي يُسجّل كحركة مالية في كشف حساب العميل، وليس كملاحظة فقط.
                </p>

                {hasOpeningBalance && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 pt-3 border-t border-border-val/50 overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-sec-text mb-2 text-right">اتجاه ونوع الرصيد:</label>
                        <select
                          value={openingBalanceDirection}
                          onChange={(e: any) => setOpeningBalanceDirection(e.target.value)}
                          className="w-full bg-[#FCFBFA] border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-3 text-xs font-bold outline-none"
                        >
                          <option value="customer_owes_us">عليه مبلغ لنا (مدين بالآجل)</option>
                          <option value="we_owe_customer">له مبلغ عندنا (دائن / رصيد مسبق الدفع)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-sec-text mb-2 text-right">المبلغ:</label>
                          <input
                            type="text"
                            required={hasOpeningBalance}
                            value={openingBalanceAmount}
                            onChange={(e) => setOpeningBalanceAmount(normalizeDigits(e.target.value))}
                            placeholder="0.00"
                            className="w-full bg-[#FCFBFA] border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-3 text-xs font-sans outline-none text-right font-black"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-sec-text mb-2 text-right">العملة:</label>
                          <select
                            value={openingBalanceCurrency}
                            onChange={(e: any) => setOpeningBalanceCurrency(e.target.value)}
                            className="w-full bg-[#FCFBFA] border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-2 text-xs font-bold outline-none"
                          >
                            <option value="YER">YER</option>
                            <option value="SAR">SAR</option>
                            <option value="USD">USD</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-sec-text mb-1.5 text-right">البيان المكتوب للحركة:</label>
                      <input
                        type="text"
                        value={openingBalanceDescription}
                        onChange={(e) => setOpeningBalanceDescription(e.target.value)}
                        placeholder="أدخل بيان الحركة الافتتاحية..."
                        className="w-full bg-[#FCFBFA] border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-3 text-xs outline-none"
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-val">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="px-5 py-3 bg-sec-bg border border-border-val text-main-text text-xs font-black rounded-xl cursor-pointer hover:bg-side-active transition-all"
                >
                  إلغاء وتراجع
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-honey hover:opacity-95 text-slate-950 text-xs font-black rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5 min-w-[120px]"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      إتمام وحفظ العميل
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewMode === 'simple_entry' && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card-bg p-5 rounded-2xl border border-border-val shadow-sm gap-4">
            <div>
              <h2 className="text-xl font-black text-main-text flex items-center gap-2">
                <FileText className="w-5 h-5 text-honey" />
                تسجيل قيد مالي بسيط
              </h2>
              <p className="text-xs text-sec-text mt-1">تقييد عمليات تسوية أو خصومات أو مديونيات أو تصحيح أرصدة بدون أصناف.</p>
            </div>
            <button
              onClick={() => {
                setSelectedCustomer(null);
                setViewMode('list');
              }}
              className="bg-sec-bg border border-border-val text-main-text transition-all font-black hover:bg-side-active text-xs px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5"
            >
              ✕ العودة للقائمة
            </button>
          </div>

          {/* Form Card */}
          <div className="bg-card-bg border border-border-val rounded-2xl p-5 sm:p-7 shadow-sm space-y-6 max-w-2xl mx-auto">
            
            <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl flex items-start gap-3">
              <Info className="w-5 h-5 text-honey shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#8F5500] leading-relaxed select-none">
                <strong>توجيه محاسبي:</strong> استخدم هذه الشاشة لتسجيل تسويات أو أرصدة أو قيود بسيطة لا تحتوي على أصناف. سيتم ترحيلها مباشرة كقيد مالي للعميل وتحديث كشف حسابه والذمة الحالية فوراً.
              </p>
            </div>

            <form onSubmit={handleSimpleEntrySubmit} className="space-y-6">
              {/* Customer Selector Slot */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-sec-text text-right">العميل المستهدف بالقيد المحاسبي <span className="text-red-500">*</span></label>
                
                {selectedCustomer ? (
                  <div className="bg-[#FAF8F3]/60 border border-[#EADCBF] p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-main-text">{selectedCustomer.customer_name || selectedCustomer.display_name}</h4>
                      <p className="text-[10px] text-sec-text mt-0.5 font-mono">{selectedCustomer.phone_number || selectedCustomer.phone || 'بدون هاتف'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setEntrySearchQuery('');
                      }}
                      className="text-xs text-red-500 hover:text-red-600 bg-red-100/10 hover:bg-red-100/30 font-bold px-3 py-1.5 rounded-lg"
                    >
                      تغيير العميل
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={entrySearchQuery}
                      onChange={(e) => handleEntrySearch(e.target.value)}
                      placeholder="ابحث باسم العميل أو رقم هاتفه لإسناد القيد مالي..."
                      className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text text-xs py-3 px-4 rounded-xl outline-none transition-all text-right"
                    />
                    
                    {/* Live Dropdown Results */}
                    {showEntryDropdown && entrySearchResults.length > 0 && (
                      <div className="absolute right-0 left-0 bg-card-bg border border-border-val rounded-xl shadow-2xl mt-1.5 p-1 z-45 max-h-56 overflow-y-auto text-right">
                        {entrySearchResults.map((customerObj: any) => (
                          <button
                            key={customerObj.customer_id || customerObj.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(customerObj);
                              setShowEntryDropdown(false);
                            }}
                            className="w-full text-right text-xs px-3.5 py-2.5 hover:bg-side-active rounded-lg transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <div>
                              <strong className="text-main-text">{customerObj.customer_name || customerObj.display_name}</strong>
                              <span className="text-[10px] text-sec-text block font-mono mt-0.5">{customerObj.phone_number || customerObj.phone || 'بلا هاتف'}</span>
                            </div>
                            <span className="text-[9px] bg-honey/10 text-[#8F5500] font-bold px-2 py-0.5 rounded">
                              اختر
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {showEntryDropdown && entrySearchResults.length === 0 && entrySearchQuery.trim() !== '' && (
                      <div className="absolute right-0 left-0 bg-card-bg border border-border-val rounded-xl shadow-2xl mt-1.5 p-4 text-center z-45 text-xs text-sec-text">
                        لا يوجد أي عملاء يطابقون اسم البحث.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Entry Definition Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-sec-text mb-2 text-right">نوع وأثر هذا القيد:</label>
                  <select
                    value={entryType}
                    onChange={(e: any) => setEntryType(e.target.value)}
                    className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-3 px-3 text-xs font-bold outline-none"
                  >
                    <option value="customer_debit">مديونية على العميل (+ يدين لنا بالمال)</option>
                    <option value="customer_credit">رصيد لصالح العميل (- خصومات أو دفع دائن)</option>
                    <option value="adjustment">تسوية مالي ذممي</option>
                    <option value="discount">تسجيل خصم مكتسب للعميل</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-sec-text mb-2 text-right font-sans">المبلغ:</label>
                    <input
                      type="text"
                      required
                      value={entryAmount}
                      onChange={(e) => setEntryAmount(normalizeDigits(e.target.value))}
                      placeholder="0.00"
                      className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-3 px-3 text-xs font-sans outline-none text-right font-black"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-sec-text mb-2 text-right">العملة:</label>
                    <select
                      value={entryCurrency}
                      onChange={(e: any) => setEntryCurrency(e.target.value)}
                      className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-3 px-2 text-xs font-bold outline-none"
                    >
                      <option value="YER">YER</option>
                      <option value="SAR">SAR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-sec-text mb-2 text-right font-sans">تاريخ وتوقيت العملية:</label>
                  <input
                    type="datetime-local"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-3 px-4 text-xs font-sans outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-sec-text mb-2 text-right">البيان والتفاصيل للحركة <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={entryDescription}
                    onChange={(e) => setEntryDescription(e.target.value)}
                    placeholder="مثال: خصم تسوية بضاعة مرتجعة..."
                    className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-3 px-4 text-xs outline-none transition-all text-right"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-val">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setViewMode('list');
                  }}
                  className="px-5 py-3 bg-sec-bg border border-border-val text-main-text text-xs font-black rounded-xl cursor-pointer hover:bg-side-active transition-all"
                >
                  إلغاء وتراجع
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-honey hover:opacity-95 text-slate-950 text-xs font-black rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5 min-w-[120px]"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      ترحيل القيد المالي
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <>
          {/* Search and Filters Drawer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-card-bg border border-border-val p-4 rounded-xl shadow-sm transition-colors duration-200">
        
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم العميل أو جواله..."
            className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text placeholder-sec-text/75 text-xs py-2.5 pl-3 pr-9 rounded-xl outline-none transition-all font-sans"
          />
          <Search className="w-4 h-4 text-sec-text absolute right-3 top-1/2 -translate-y-1/2" />
        </div>

        {/* Filter debt toggle checkbox */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="debtOnly"
            checked={onlyPositive}
            onChange={(e) => setOnlyPositive(e.target.checked)}
            className="w-4 h-4 accent-honey cursor-pointer rounded"
          />
          <label htmlFor="debtOnly" className="text-xs text-sec-text cursor-pointer font-bold select-none flex items-center gap-1.5 hover:text-main-text transition-colors">
            <UserX className="w-3.5 h-3.5 text-danger-val" />
            إظهار فقط العملاء المدينين (الذين بذمتهم ديون معلقة)
          </label>
        </div>

        {/* Total found badges */}
        <div className="text-left text-[11px] text-sec-text font-mono">
          إجمالي المسجلين بالبيان: <strong className="text-main-text bg-sec-bg px-2.5 py-1 rounded font-black text-xs border border-border-val/30">{filteredCustomers.length}</strong> عملاء
        </div>

      </div>

      {/* Main Grid View */}
      {loading && filteredCustomers.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-10 h-10 border-4 border-t-honey border-border-val rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-sec-text">جاري مزامنة ومطابقة حركات العملاء...</p>
        </div>
      ) : filteredCustomers.length > 0 ? (
        <div className="flex flex-col gap-3.5">
          {filteredCustomers.map((c, index) => {
            const hasYerDebt = Number(c.balance_yer || 0) > 0;
            const hasSarDebt = Number(c.balance_sar || 0) > 0;
            const hasUsdDebt = Number(c.balance_usd || 0) > 0;
            const isDebtor = hasYerDebt || hasSarDebt || hasUsdDebt;
            const isActive = c.is_active !== false;

            // Compute descriptive status badge:
            // 1. If not suspended vs suspended
            // 2. If debtor vs debt-free
            let statusLabel = 'نشط - خالص الذمة';
            let statusColorClass = 'bg-success-val/10 text-success-val border border-success-val/20';
            if (!isActive) {
              statusLabel = 'معلق الحساب';
              statusColorClass = 'bg-[#FAF8F3] text-sec-text border border-border-val';
            } else if (isDebtor) {
              statusLabel = 'مدين بالآجل';
              statusColorClass = 'bg-danger-val/10 text-danger-val border border-danger-val/20';
            }

            return (
              <div 
                key={`${c.customer_id}-${index}`}
                className={`bg-card-bg rounded-2xl p-4.5 border transition-all duration-200 shadow-sm hover:shadow-md relative flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isActive ? 'border-border-val hover:border-honey/40' : 'border-border-val/40 opacity-75 bg-[#FAF8F3]/50'
                }`}
              >
                
                {/* Right side: Customer basics card profile */}
                <div className="flex items-center gap-3.5 min-w-[245px]">
                  <div className={`w-11 h-11 rounded-xl bg-soft-card border border-[#EADCBF] flex items-center justify-center font-black text-sm shrink-0 ${
                    !isActive ? 'text-sec-text' : isDebtor ? 'text-danger-val bg-danger-val/5' : 'text-success-val bg-success-val/5'
                  }`}>
                    {c.customer_name?.charAt(0) || 'ع'}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`text-xs font-black text-main-text select-all ${!isActive ? 'line-through text-sec-text' : ''}`}>
                        {c.customer_name}
                      </h3>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${statusColorClass} shrink-0`}>
                        {statusLabel}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 text-[11px] text-sec-text flex-wrap">
                      <p className="select-all font-mono flex items-center gap-1">
                        <Phone className="w-3 h-3 text-honey" />
                        {c.phone_number || 'بدون هاتف'}
                      </p>
                      {c.last_transaction_date && (
                        <p className="flex items-center gap-1 text-[10px]">
                          <Calendar className="w-3 h-3 text-sec-text/60" />
                          <span>آخر قيد:</span>
                          <span className="font-mono">{new Date(c.last_transaction_date).toLocaleDateString('ar-YE-u-nu-latn')}</span>
                        </p>
                      )}
                    </div>

                    {c.notes && (
                      <p className="text-[10px] text-sec-text/80 bg-[#FAF8F3] border border-[#EADCBF]/60 rounded px-2 py-0.5 inline-block max-w-[280px] truncate" title={c.notes}>
                        <strong className="text-main-text text-[9px] ml-1">تنبيه:</strong>{c.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Middle section: Real-time Balances by currency */}
                <div className="flex items-center gap-1.5 md:gap-2.5 md:mx-auto shrink-0 py-0.5">
                  <div className="bg-[#FAF8F3]/60 border border-[#EADCBF]/60 rounded-xl p-1.5 px-2 text-center space-y-0.5 min-w-[80px] md:min-w-[88px]">
                    <span className="text-[8px] md:text-[9px] text-[#8F5500] font-black block">يمني YER</span>
                    <span className={`text-[11px] md:text-xs font-mono font-black block ${hasYerDebt ? 'text-danger-val' : 'text-success-val'}`}>
                      {formatNumber(c.balance_yer || 0)}
                    </span>
                  </div>
                  <div className="bg-[#FAF8F3]/60 border border-[#EADCBF]/60 rounded-xl p-1.5 px-2 text-center space-y-0.5 min-w-[80px] md:min-w-[88px]">
                    <span className="text-[8px] md:text-[9px] text-[#8F5500] font-black block">سعودي SAR</span>
                    <span className={`text-[11px] md:text-xs font-mono font-black block ${hasSarDebt ? 'text-danger-val' : 'text-success-val'}`}>
                      {formatNumber(c.balance_sar || 0)}
                    </span>
                  </div>
                  <div className="bg-[#FAF8F3]/60 border border-[#EADCBF]/60 rounded-xl p-1.5 px-2 text-center space-y-0.5 min-w-[80px] md:min-w-[88px]">
                    <span className="text-[8px] md:text-[9px] text-[#8F5500] font-black block">دولار USD</span>
                    <span className={`text-[11px] md:text-xs font-mono font-black block ${hasUsdDebt ? 'text-danger-val' : 'text-success-val'}`}>
                      {formatNumber(c.balance_usd || 0)}
                    </span>
                  </div>
                </div>

                {/* Left side: Quick Actions Dock */}
                <div className="flex items-center gap-2 shrink-0 md:justify-end self-end md:self-auto w-full md:w-auto pt-2 md:pt-0 border-t md:border-0 border-border-val/40">
                  
                  {/* Quick sand qabd (receipt voucher) button */}
                  <button
                    onClick={() => openReceiptModal(c)}
                    className="flex-1 md:flex-initial bg-success-val/10 hover:bg-success-val text-success-val hover:text-white border border-success-val/30 text-[11px] font-black py-2 px-4 rounded-xl transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    سند قبض
                  </button>

                  {/* Detail ledger (دفتر الحركة) button */}
                  <button
                    onClick={() => onSelectCustomer(c.customer_id)}
                    className="flex-1 md:flex-initial bg-[#F4F1EA] hover:bg-[#E2D8C3] text-main-text border border-[#E5DEC9] text-[11px] font-black py-2 px-4 rounded-xl transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <FileText className="w-3.5 h-3.5 text-honey" />
                    دفتر الحركة
                  </button>

                  {/* Actions Dropdown Trigger (More option) */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdownId(activeDropdownId === c.customer_id ? null : c.customer_id);
                        setSelectedCustomer(c);
                      }}
                      className="w-9 h-9 rounded-xl bg-[#FCFBFA] border border-[#EADCBF] text-main-text flex items-center justify-center hover:bg-side-active cursor-pointer shrink-0 transition-all active:scale-95"
                      title="المزيد من الإجراءات"
                    >
                      <MoreVertical className="w-4 h-4 text-sec-text" />
                    </button>

                    {/* Anchored floating dropdown menu */}
                    {activeDropdownId === c.customer_id && (
                      <div 
                        ref={dropdownRef}
                        className="absolute bottom-11 left-0 w-48 bg-card-bg border border-[#EADCBF] rounded-xl shadow-xl py-1.5 z-30 animate-slide-up text-right whitespace-nowrap"
                        style={{ transformOrigin: 'bottom left' }}
                      >
                        <button
                          onClick={() => {
                            openFinancialDetails(c);
                          }}
                          className="w-full text-right text-xs px-3 py-2 text-main-text hover:bg-side-active flex items-center gap-2 cursor-pointer"
                        >
                          <Info className="w-3.5 h-3.5 text-[#8F5500]" />
                          عرض التفاصيل المالية
                        </button>

                        <button
                          onClick={() => {
                            onSelectCustomer(c.customer_id);
                            setActiveDropdownId(null);
                          }}
                          className="w-full text-right text-xs px-3 py-2 text-main-text hover:bg-side-active flex items-center gap-2 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#8F5500]" />
                          كشف الحساب
                        </button>

                        <button
                          onClick={() => {
                            setPrefsCustomerId(c.customer_id);
                            // Pre-fill display title with customer name
                            setPrefsForm(prev => ({
                              ...prev,
                              reportTitle: `كشف حساب مالي - ${c.customer_name}`
                            }));
                            setShowStatementPrefsModal(true);
                            setActiveDropdownId(null);
                          }}
                          disabled={loadingPdfId !== null}
                          className="w-full text-right text-xs px-3 py-2 text-main-text hover:bg-side-active flex items-center gap-2 cursor-pointer disabled:opacity-50 font-bold text-honey"
                        >
                          <FileText className="w-3.5 h-3.5 text-honey animate-pulse" />
                          {loadingPdfId === c.customer_id ? 'جاري التوليد...' : 'كشف حساب PDF (باحكم)'}
                        </button>

                        {/* Credit Invoice (فاتورة آجل) prefill action */}
                        <button
                          onClick={() => {
                            if (!isActive) {
                              alert('الحساب معلق حالياً، يرجى تفعيله لإصدار آجل');
                              return;
                            }
                            onPrefillTransaction({
                              customer_id: c.customer_id,
                              party_name: c.customer_name,
                              party_phone: c.phone_number,
                              transaction_type: 'sales_invoice',
                              payment_method: 'credit',
                              paid_amount: 0,
                              cash_account_id: null
                            });
                          }}
                          className={`w-full text-right text-xs px-3 py-2 flex items-center gap-2 cursor-pointer ${
                            !isActive ? 'text-sec-text/50 line-through' : 'text-main-text hover:bg-side-active'
                          }`}
                        >
                          <ArrowUpLeft className="w-3.5 h-3.5 text-honey" />
                          إضافة فاتورة آجل
                        </button>

                         <button
                          onClick={() => openReceiptModal(c)}
                          className="w-full text-right text-xs px-3 py-2 text-main-text hover:bg-side-active flex items-center gap-2 cursor-pointer"
                        >
                          <DollarSign className="w-3.5 h-3.5 text-success-val" />
                          إضافة سند قبض سريع
                        </button>

                        <button
                          onClick={() => {
                            setSelectedCustomer({
                              ...c,
                              id: c.customer_id || c.id,
                              customer_id: c.customer_id || c.id,
                              customer_name: c.customer_name,
                              phone: c.phone_number || c.phone
                            });
                            setEntryType('customer_debit');
                            setEntryAmount('');
                            setEntryDescription('');
                            setEntrySearchQuery('');
                            setViewMode('simple_entry');
                            setActiveDropdownId(null);
                          }}
                          className="w-full text-right text-xs px-3 py-2 text-main-text hover:bg-side-active flex items-center gap-2 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-honey" />
                          قيد مالي بسيط
                        </button>

                        <button
                          onClick={() => openEditModal(c)}
                          className="w-full text-right text-xs px-3 py-2 text-main-text hover:bg-side-active flex items-center gap-2 cursor-pointer border-t border-border-val/50"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-honey" />
                          تعديل بيانات العميل
                        </button>

                        {isActive ? (
                          <button
                            onClick={() => openSuspendModal(c)}
                            className="w-full text-right text-xs px-3 py-2 text-danger-val hover:bg-danger-val/10 flex items-center gap-2 cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            تعليق الحساب
                          </button>
                        ) : (
                          <button
                            onClick={() => openActivateModal(c)}
                            className="w-full text-right text-xs px-3 py-2 text-success-val hover:bg-success-val/10 flex items-center gap-2 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" />
                            إعادة تفعيل الحساب
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 bg-card-bg rounded-2xl border border-border-val text-sec-text shadow-sm">
          <Users className="w-12 h-12 mx-auto text-sec-text/40 mb-3" />
          <p className="text-xs">لا يوجد عملاء يعادلون هذا البحث حالياً.</p>
        </div>
      )}
      </>)}

      {/* ==================================== MODAL DIALOGS ==================================== */}

      <AnimatePresence>
        {/* EDIT CUSTOMER MODAL */}
        {showEditModal && selectedCustomer && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card-bg border border-border-val rounded-[22px] w-[calc(100vw-24px)] sm:w-full max-w-md p-4 sm:p-6 shadow-2xl relative space-y-4 animate-slide-up text-right max-h-[calc(100vh-24px)] sm:max-h-[85vh] overflow-y-auto" 
              dir="rtl"
            >
              <div className="flex justify-between items-center pb-3 border-b border-border-val">
                <span className="font-black text-sm text-main-text flex items-center gap-1.5">
                  <Edit2 className="w-4 h-4 text-honey" />
                  تعديل بيانات العميل المحققة
                </span>
                <button onClick={() => setShowEditModal(false)} className="text-sec-text hover:text-main-text font-bold p-1">
                  ✕
                </button>
              </div>

              <form onSubmit={handleEditCustomerSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-sec-text mb-1.5 text-right">اسم العميل:</label>
                  <input
                    type="text"
                    required
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                    placeholder="اكتب اسم العميل الكامل..."
                    className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-4 text-xs outline-none transition-all text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-sec-text mb-1.5 text-right">رقم الهاتف / الجوال:</label>
                  <input
                    type="text"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: normalizeDigits(e.target.value) })}
                    placeholder="مثال: 777111222"
                    className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text font-mono rounded-xl py-2.5 px-4 text-xs outline-none transition-all text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-sec-text mb-1.5 text-right">ملاحظات العميل:</label>
                  <textarea
                    value={customerForm.notes}
                    onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                    placeholder="أدخل أي ملاحظات إدارية هنا..."
                    rows={2}
                    className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-4 text-xs outline-none transition-all text-right"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActiveEditForm"
                    checked={customerForm.is_active}
                    onChange={(e) => setCustomerForm({ ...customerForm, is_active: e.target.checked })}
                    className="w-4 h-4 accent-honey cursor-pointer"
                  />
                  <label htmlFor="isActiveEditForm" className="text-xs text-sec-text cursor-pointer select-none font-bold">
                    حالة العميل المالي: نشط ومتاح للترحيل
                  </label>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-border-val">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 bg-sec-bg hover:bg-side-active text-main-text rounded-xl text-xs font-bold transition-all border border-border-val/40 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-honey text-slate-950 rounded-xl text-xs font-black hover:bg-honey/90 transition-all cursor-pointer"
                  >
                    تعديل السجل
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* QUICK RECEIPT (سند قبض سريع) MODAL */}
        {showReceiptModal && selectedCustomer && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card-bg border border-border-val rounded-[22px] w-[calc(100vw-24px)] sm:w-full max-w-sm p-4 sm:p-6 shadow-2xl relative space-y-4 animate-slide-up text-right max-h-[calc(100vh-24px)] sm:max-h-[85vh] overflow-y-auto" 
              dir="rtl"
            >
              <div className="flex justify-between items-center pb-3 border-b border-[#2C2C2E]">
                <span className="font-black text-sm text-main-text flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-success-val" />
                  قيد سند قبض سريع للعميل
                </span>
                <button onClick={() => setShowReceiptModal(false)} className="text-sec-text hover:text-main-text font-bold p-1">
                  ✕
                </button>
              </div>

              <form onSubmit={handleReceiptSubmit} className="space-y-4">
                <div>
                  <span className="block text-[11px] text-sec-text">الجهة المسددة (العميل):</span>
                  <strong className="block text-sm text-main-text mt-1 select-all">{selectedCustomer.customer_name}</strong>
                </div>

                <div>
                  <label className="block text-xs font-bold text-sec-text mb-1">المبلغ المقبوض نقدًا:</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      autoFocus
                      placeholder="أدخل قيمة السداد (مثال: 50000)"
                      value={receiptForm.amount}
                      onChange={(e) => setReceiptForm({ ...receiptForm, amount: normalizeDigits(e.target.value) })}
                      className="w-full bg-soft-card border border-border-val focus:border-honey text-honey font-black text-xl font-mono py-2.5 px-4 rounded-xl outline-none text-center"
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-bold text-sec-text mb-1.5">العملة المقيدة بالسند:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {(['YER', 'SAR', 'USD'] as CurrencyType[]).map((cur) => (
                      <button
                        key={cur}
                        type="button"
                        onClick={() => setReceiptForm({ ...receiptForm, currency: cur })}
                        className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all text-center cursor-pointer ${
                          receiptForm.currency === cur 
                            ? 'bg-honey border-honey text-slate-950 font-black scale-102' 
                            : 'bg-soft-card border-border-val text-sec-text hover:text-main-text'
                        }`}
                      >
                        {CURRENCY_LABELS[cur]?.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-sec-text mb-1">بيان وملاحظة السند:</label>
                  <input
                    type="text"
                    value={receiptForm.notes}
                    onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                    placeholder="اكتب تفاصيل إضافية إن أردت..."
                    className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-4 text-xs outline-none transition-all text-right"
                  />
                </div>

                <div className="bg-success-val/5 border border-success-val/20 p-3 rounded-xl text-[10px] text-sec-text leading-relaxed">
                  💡 ترحيل هذا السند سريعاً لحساب العميل سيقوم بالخصم التلقائي من رصيد دينه بالعملة المحددة وإنجاز إشعار واتساب له مباشرة.
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-border-val">
                  <button
                    type="button"
                    onClick={() => setShowReceiptModal(false)}
                    className="px-4 py-2 bg-sec-bg hover:bg-side-active text-main-text rounded-xl text-xs font-bold transition-all border border-border-val/40 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-success-val text-white rounded-xl text-xs font-black hover:bg-opacity-90 transition-all cursor-pointer"
                  >
                    ترحيل وحفظ السند
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* SUSPEND CUSTOMER CONFIRMATION MODAL */}
        {showSuspendModal && selectedCustomer && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card-bg border border-border-val rounded-[22px] w-[calc(100vw-24px)] sm:w-full max-w-sm p-4 sm:p-5 shadow-2xl relative space-y-4 animate-slide-up text-right animate-shake max-h-[calc(100vh-24px)] sm:max-h-[85vh] overflow-y-auto" 
              dir="rtl"
            >
              <div className="flex items-center gap-2 text-danger-val pb-2 border-b border-border-val">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="font-black text-sm text-main-text">تأكيد تعليق حساب العميل الحسابي</h4>
              </div>

              <div className="space-y-3.5 py-1">
                <p className="text-xs text-main-text leading-relaxed">
                  هل أنت متأكد من تعليق حساب العميل:
                  <strong className="block text-sm text-honey mt-1 font-bold">"{selectedCustomer.customer_name}" ؟</strong>
                </p>

                <p className="text-xs text-sec-text bg-soft-card p-3 rounded-xl border border-border-val/50 leading-relaxed">
                  سيتم تعليق العميل ومنع إنشاء عمليات آجل جديدة له، دون حذف سجله أو عملياته السابقة.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border-val">
                <button
                  type="button"
                  onClick={() => setShowSuspendModal(false)}
                  className="px-4 py-2 bg-sec-bg hover:bg-side-active text-main-text rounded-xl text-xs font-bold transition-all border border-border-val/40 cursor-pointer"
                >
                  إلغاء التجميد
                </button>
                <button
                  type="button"
                  onClick={handleSuspendConfirm}
                  className="px-5 py-2 bg-danger-val hover:bg-opacity-95 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
                >
                  تأكيد تعليق العميل
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* ACTIVATE CUSTOMER CONFIRMATION MODAL */}
        {showActivateModal && selectedCustomer && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card-bg border border-border-val rounded-[22px] w-[calc(100vw-24px)] sm:w-full max-w-sm p-4 sm:p-5 shadow-2xl relative space-y-4 animate-slide-up text-right max-h-[calc(100vh-24px)] sm:max-h-[85vh] overflow-y-auto" 
              dir="rtl"
            >
              <div className="flex items-center gap-2 text-success-val pb-2 border-b border-border-val">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <h4 className="font-black text-sm text-main-text">إعادة تفعيل حساب العميل</h4>
              </div>

              <div className="space-y-3 py-1">
                <p className="text-xs text-main-text leading-relaxed">
                  هل ترغب في كسر التجميد وإعادة تفعيل العميل المالي:
                  <strong className="block text-sm text-honey mt-1 font-bold">"{selectedCustomer.customer_name}" ؟</strong>
                </p>

                <p className="text-xs text-sec-text bg-soft-card p-3 rounded-xl border border-border-val/50 leading-relaxed">
                  سيسمح هذا الإجراء مجدداً بالرسم والتقييد الآجل وإدراج مديونيات على حساب هذا الطرف بمسيرات الفواتير الفورية.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border-val">
                <button
                  type="button"
                  onClick={() => setShowActivateModal(false)}
                  className="px-4 py-2 bg-sec-bg hover:bg-side-active text-main-text rounded-xl text-xs font-bold transition-all border border-border-val/40 cursor-pointer"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={handleActivateConfirm}
                  className="px-5 py-2 bg-success-val hover:bg-opacity-95 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
                >
                  ✓ إعادة تفعيل العميل
                  </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* VIEW FINANCIAL DETAILS MODAL */}
        {showFinancialDetailsModal && selectedCustomer && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card-bg border border-[#2C2C2E] rounded-[22px] w-[calc(100vw-24px)] sm:w-full max-w-lg p-4 sm:p-6 shadow-2xl relative space-y-5 animate-slide-up text-right max-h-[calc(100vh-24px)] sm:max-h-[85vh] overflow-y-auto flex flex-col" 
              dir="rtl"
            >
              <div className="flex justify-between items-center pb-3 border-b border-border-val flex-shrink-0">
                <span className="font-black text-sm text-main-text flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-[#00E5FF]" />
                  الملف المالي المتكامل للعميل
                </span>
                <button onClick={() => setShowFinancialDetailsModal(false)} className="text-sec-text hover:text-main-text font-bold p-1">
                  ✕
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto flex-1 pr-1 pl-1">
                {financialDetailsLoading ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-10 h-10 border-4 border-t-[#00E5FF] border-[#2C2C2E] rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-sec-text">جاري تجميع المطابقات وموازنة الصناديق...</p>
                  </div>
                ) : financialDetailsError ? (
                  <div className="space-y-3 text-center py-6">
                    <div className="text-danger-val text-xs border border-danger-val/20 bg-danger-val/5 p-4 rounded-xl leading-relaxed">
                      تعذر تحميل كشف وملف حركة حساب العميل مالياً. يرجى مراجعة الاتصال وإعادة المحاولة.
                    </div>
                    
                    {/* Developer mode block */}
                    <div className="text-right">
                      <details className="cursor-pointer group">
                        <summary className="text-[10px] text-sec-text hover:text-honey font-bold select-none list-none flex items-center justify-center gap-1">
                          <span>عرض تفاصيل المطورين (Developer Mode)</span>
                          <span className="transition-transform group-open:rotate-180">▼</span>
                        </summary>
                        <pre className="bg-[#121212] text-left text-[10px] text-red-400 p-3 rounded-lg overflow-x-auto font-mono mt-2" dir="ltr">
                          {JSON.stringify(financialDetailsError, null, 2)}
                        </pre>
                      </details>
                    </div>
                  </div>
                ) : financialDetailsData ? (
                  <div className="space-y-4">
                    {/* Customer Info Card */}
                    <div className="bg-soft-card border border-border-val/50 p-4 rounded-xl space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-sm font-black text-white">{financialDetailsData.customer.customer_name}</h4>
                          <p className="text-xs text-sec-text font-mono mt-1 select-all">{financialDetailsData.customer.phone_number || 'بدون رقم جوال'}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          financialDetailsData.customer.is_active 
                            ? 'bg-green-600/10 text-[#32D74B] border-[#32D74B]/20' 
                            : 'bg-red-600/10 text-red-500 border-red-500/20'
                        }`}>
                          {financialDetailsData.customer.is_active ? 'نشط' : 'معلق'}
                        </span>
                      </div>
                      {financialDetailsData.customer.notes && (
                        <div className="bg-[#121212] p-2.5 rounded-lg text-[11px] text-sec-text border border-border-val/20">
                          <strong>ملاحظات العميل:</strong> {financialDetailsData.customer.notes}
                        </div>
                      )}
                    </div>

                    {/* Balances list per currency */}
                    <div className="space-y-2">
                      <h5 className="text-xs font-black text-sec-text">الأرصدة الحالية المستحقة:</h5>
                      <div className="grid grid-cols-3 gap-2.5">
                        {financialDetailsData.balances.map((b: any) => {
                          const isOwed = b.balance > 0;
                          return (
                            <div key={b.currency} className="bg-[#18181B] border border-border-val/60 p-3 rounded-xl text-center space-y-1">
                              <span className="text-[10px] text-sec-text block font-bold">رصيد {b.currency}_</span>
                              <strong className={`text-sm block font-mono font-black ${isOwed ? 'text-red-500' : 'text-green-500'}`}>
                                {formatNumber(b.balance)}
                              </strong>
                              <span className="text-[9px] text-sec-text/70 block">{b.currency === 'YER' ? 'ريال يمني' : b.currency === 'SAR' ? 'ريال سعودي' : 'دولار أمريكي'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Accounting KPIs summary */}
                    <div className="bg-soft-card border border-border-val/50 p-4 rounded-xl space-y-3.5 text-xs text-main-text">
                      <div className="flex justify-between items-center pb-2 border-b border-border-val/40">
                        <span className="text-sec-text">إجمالي عدد الحركات المالية:</span>
                        <strong className="font-mono text-[#00E5FF] font-bold">{formatNumber(financialDetailsData.ledger.length)}</strong>
                      </div>

                      {/* Last Operation details */}
                      <div className="space-y-1">
                        <span className="text-sec-text block">آخر حركة مسجلة بالحسـاب:</span>
                        {financialDetailsData.ledger.length > 0 ? (
                          <div className="bg-[#121212] p-2.5 rounded-lg border border-border-val/30 flex justify-between items-center text-[11px]">
                            <div>
                              <span className="font-bold text-white">
                                {TRANSACTION_LABELS[financialDetailsData.ledger[0].transaction_type as keyof typeof TRANSACTION_LABELS] || financialDetailsData.ledger[0].transaction_type}
                              </span>
                              <span className="text-sec-text mr-2 font-mono">
                                ({new Date(financialDetailsData.ledger[0].date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })})
                              </span>
                            </div>
                            <strong className={`font-mono font-black ${financialDetailsData.ledger[0].balance_impact > 0 ? 'text-red-500' : 'text-[#32D74B]'}`}>
                              {financialDetailsData.ledger[0].balance_impact > 0 ? `+${formatNumber(financialDetailsData.ledger[0].amount)}` : `-${formatNumber(financialDetailsData.ledger[0].amount)}`} {financialDetailsData.ledger[0].currency}
                            </strong>
                          </div>
                        ) : (
                          <span className="text-[11px] text-sec-text/60 italic font-bold">لا توجد حركات سابقة</span>
                        )}
                      </div>

                      {/* Last Receipt details */}
                      <div className="space-y-1">
                        <span className="text-sec-text block font-bold">آخر سند قبض مستلم (دائن):</span>
                        {(() => {
                          const lastRec = financialDetailsData.ledger.find((it: any) => it.transaction_type === 'receipt_voucher');
                          return lastRec ? (
                            <div className="bg-[#121212] p-2.5 rounded-lg border border-border-val/30 flex justify-between items-center text-[11px]">
                              <div>
                                <span className="font-bold text-[#32D74B]">سند قبض نقدي</span>
                                <span className="text-sec-text mr-2 font-mono">
                                  ({new Date(lastRec.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })})
                                </span>
                              </div>
                              <strong className="font-mono font-black text-[#32D74B]">
                                -{formatNumber(lastRec.amount)} {lastRec.currency}
                              </strong>
                            </div>
                          ) : (
                            <span className="text-[11px] text-sec-text/60 italic font-bold">لم يستلم أي دفعة مبيعات نقدية بعد</span>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Developer mode block */}
                    <div className="text-right pt-2">
                      <details className="cursor-pointer group">
                        <summary className="text-[10px] text-sec-text hover:text-[#00E5FF] font-bold select-none list-none flex items-center justify-center gap-1">
                          <span>عرض استجابة الخادم الخام (Developer JSON Output)</span>
                          <span className="transition-transform group-open:rotate-180">▼</span>
                        </summary>
                        <pre className="bg-[#121212] text-left text-[10px] text-green-400 p-3 rounded-lg overflow-x-auto font-mono mt-2 transition-all max-h-48" dir="ltr">
                          {JSON.stringify(financialDetailsData, null, 2)}
                        </pre>
                      </details>
                    </div>

                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-sec-text font-bold">تعذر تجميع تفاصيل العميل المطلوبة</div>
                )}
              </div>

              <div className="pt-3 border-t border-[#2C2C2E] flex justify-end flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowFinancialDetailsModal(false)}
                  className="px-5 py-2.5 bg-sec-bg hover:bg-side-active text-main-text rounded-xl text-xs font-bold transition-all border border-border-val/40 cursor-pointer"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {showStatementPrefsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white text-gray-900 border border-gray-200 rounded-2xl w-full max-w-xl shadow-2xl p-6 text-right space-y-4 my-8"
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
                    if (!prefsCustomerId) return;
                    setShowStatementPrefsModal(false);
                    await handleGenerateCustomerStatementPdf(prefsCustomerId, prefsForm);
                  }}
                  disabled={loadingPdfId !== null}
                  className="px-5 py-2.5 bg-honey hover:opacity-90 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4" />
                  {import.meta.env.VITE_PDF_RENDER_WEBHOOK_URL ? 'تنزيل PDF الحقيقي كملف' : 'معاينة وجاهزية الطباعة'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
