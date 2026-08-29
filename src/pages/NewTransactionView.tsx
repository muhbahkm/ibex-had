/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  User, 
  Phone, 
  ShoppingBag, 
  Settings, 
  DollarSign, 
  CheckCircle, 
  AlertTriangle,
  Receipt,
  ArrowRight,
  MessageSquare,
  HelpCircle,
  FileText,
  Loader2
} from 'lucide-react';
import { 
  getAppBootstrap, 
  getFastEntryBootstrap, 
  searchCustomers, 
  searchProducts, 
  searchUnits, 
  createTransaction,
  isFallbackEnabled,
  getCashSummary,
  downloadTransactionPdf,
  getTransactionDetail,
  normalizeTransactionForUi
} from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { parseProductUnitsAndNotes } from '../lib/unitUtils';
import { 
  TRANSACTION_LABELS, 
  CurrencyType, 
  TransactionType, 
  TransactionItemInput, 
  TransactionPayload, 
  CashAccount,
  Product,
  Unit
} from '../types';
import AutocompleteInput from '../components/AutocompleteInput';
import { formatNumber, formatMoney, normalizeDigits, parseNormalizedFloat, convertCurrency } from '../lib/numberUtils';

interface NewTransactionViewProps {
  onSuccess: (id: string, no: string) => void;
  onCancel: () => void;
  prefilledData?: {
    customer_id?: string | null;
    party_name?: string;
    party_phone?: string;
    transaction_type?: TransactionType;
    payment_method?: 'cash' | 'credit' | 'partial';
    paid_amount?: number;
    cash_account_id?: string | null;
    voucher_amount?: number;
    currency?: CurrencyType;
    items?: any[];
    notes?: string;
    converted_order_id?: string;
  } | null;
  clearPrefilledData?: () => void;
  sarRate?: number;
  usdRate?: number;
}

export default function NewTransactionView({ 
  onSuccess, 
  onCancel,
  prefilledData,
  clearPrefilledData,
  sarRate = 410,
  usdRate = 1530
}: NewTransactionViewProps) {
  // Bootstrap caches
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  
  // Transaction Header
  const [transactionType, setTransactionType] = useState<TransactionType>('sales_invoice');
  const [currency, setCurrency] = useState<CurrencyType>('YER');
  
  // Party Detail
  const [partyName, setPartyName] = useState('زبون عام');
  const [partyPhone, setPartyPhone] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [convertedOrderId, setConvertedOrderId] = useState<string | null>(null);

  // Prefill hook
  useEffect(() => {
    if (prefilledData) {
      if (prefilledData.customer_id) {
        setSelectedCustomerId(prefilledData.customer_id);
      }
      if (prefilledData.party_name) {
        setPartyName(prefilledData.party_name);
      }
      if (prefilledData.party_phone !== undefined) {
        setPartyPhone(prefilledData.party_phone || '');
      }
      if (prefilledData.transaction_type) {
        setTransactionType(prefilledData.transaction_type);
      }
      if (prefilledData.currency) {
        setCurrency(prefilledData.currency);
      }
      if (prefilledData.payment_method) {
        setPaymentMethod(prefilledData.payment_method);
      }
      if (prefilledData.paid_amount !== undefined) {
        setPaidAmount(prefilledData.paid_amount);
      }
      if (prefilledData.cash_account_id !== undefined) {
        setCashAccountId(prefilledData.cash_account_id || '');
      }
      if (prefilledData.voucher_amount !== undefined) {
        setVoucherAmount(prefilledData.voucher_amount);
      }
      if (prefilledData.items && Array.isArray(prefilledData.items)) {
        setItems(prefilledData.items);
      }
      if (prefilledData.notes) {
        setNotes(prefilledData.notes);
      }
      if (prefilledData.converted_order_id) {
        setConvertedOrderId(prefilledData.converted_order_id);
      }

      if (clearPrefilledData) {
        clearPrefilledData();
      }
    }
  }, [prefilledData, cashAccounts]);

  // Financial terms
  const [cashAccountId, setCashAccountId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'partial'>('cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [sendWhatsapp, setSendWhatsapp] = useState(true);

  // Voucher amount (specifically for receipt/payment vouchers and simple entries)
  const [voucherAmount, setVoucherAmount] = useState<number>(0);

  // Dynamic type categories for flawless responsive views
  const isInvoiceType = ['sales_invoice', 'sales_return', 'purchase_invoice', 'purchase_return'].includes(transactionType);
  const isVoucherType = ['receipt_voucher', 'payment_voucher'].includes(transactionType);
  const isSimpleEntry = transactionType === 'simple_entry';

  // Items List
  const [items, setItems] = useState<TransactionItemInput[]>([
    {
      product_id: null,
      product_name: '',
      category: 'عام',
      unit_id: null,
      unit_name: 'كيلو',
      quantity: 1,
      unit_price: 0,
      estimated_unit_cost: 0,
      notes: ''
    }
  ]);

  // State for current user session details
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    }).catch(err => {
      console.warn('Failed to fetch user in NewTransactionView:', err);
    });
  }, []);

  // UI state
  const [savingLoading, setSavingLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastSavedTransaction, setLastSavedTransaction] = useState<any | null>(null);
  const [successData, setSuccessData] = useState<{
    id: string;
    no: string;
    total: number;
    paid: number;
    remaining: number;
    profit: number;
    currency: string;
    createdBy?: string;
  } | null>(null);

  const [loadingSuccessPdf, setLoadingSuccessPdf] = useState(false);

  const handlePrintSuccessPdf = async () => {
    if (!lastSavedTransaction) return;
    setLoadingSuccessPdf(true);
    try {
      const { success, error: pdfError } = await downloadTransactionPdf(lastSavedTransaction);
      if (pdfError) {
        alert('أخفق توليد الفاتورة والطباعة: ' + pdfError);
      }
    } catch (e: any) {
      alert('خطأ آلي عند توليد PDF: ' + e.message);
    } finally {
      setLoadingSuccessPdf(false);
    }
  };

  const handleResetForm = () => {
    setItems([
      {
        product_id: null,
        product_name: '',
        category: 'عام',
        unit_id: null,
        unit_name: 'كيلو',
        quantity: 1,
        unit_price: 0,
        estimated_unit_cost: 0,
        notes: ''
      }
    ]);
    setPartyName('زبون عام');
    setPartyPhone('');
    setSelectedCustomerId(null);
    setPaidAmount(0);
    setDiscountAmount(0);
    setPaymentMethod('cash');
    setNotes('');
    setSendWhatsapp(true);
    setSuccessData(null);
    setLastSavedTransaction(null);
    setVoucherAmount(0);
  };

  // Switch labels and default states when transaction type changes
  useEffect(() => {
    setFormError(null);
    
    // Auto populate party names for pristine user experience
    if (transactionType === 'sales_invoice' || transactionType === 'sales_return') {
      if (partyName === 'زبون عام' || partyName === 'مورد عام' || partyName === 'عميل مسدد' || partyName === 'مستفيد الصرف' || partyName === 'الحساب المعني') {
        setPartyName('زبون عام');
      }
      setPaymentMethod('cash');
    } else if (transactionType === 'purchase_invoice' || transactionType === 'purchase_return') {
      if (partyName === 'زبون عام' || partyName === 'مورد عام' || partyName === 'عميل مسدد' || partyName === 'مستفيد الصرف' || partyName === 'الحساب المعني') {
        setPartyName('مورد عام');
      }
      setPaymentMethod('cash');
    } else if (transactionType === 'receipt_voucher') {
      if (partyName === 'زبون عام' || partyName === 'مورد عام' || partyName === 'عميل مسدد' || partyName === 'مستفيد الصرف' || partyName === 'الحساب المعني') {
        setPartyName('عميل مسدد');
      }
      setPaymentMethod('cash');
    } else if (transactionType === 'payment_voucher') {
      if (partyName === 'زبون عام' || partyName === 'مورد عام' || partyName === 'عميل مسدد' || partyName === 'مستفيد الصرف' || partyName === 'الحساب المعني') {
        setPartyName('مستفيد الصرف');
      }
      setPaymentMethod('cash');
    } else if (transactionType === 'simple_entry') {
      if (partyName === 'زبون عام' || partyName === 'مورد عام' || partyName === 'عميل مسدد' || partyName === 'مستفيد الصرف' || partyName === 'الحساب المعني') {
        setPartyName('الحساب المعني');
      }
      setPaymentMethod('cash');
    }
  }, [transactionType]);

  // Fetch configs on boot
  useEffect(() => {
    loadBootstrap();
  }, []);

  const loadBootstrap = async () => {
    try {
      const [res, cashRes] = await Promise.all([
        getAppBootstrap(),
        getCashSummary()
      ]);

      let accounts: CashAccount[] = [];
      if (cashRes && cashRes.data && cashRes.data.length > 0) {
        accounts = cashRes.data;
      } else if (res && res.data && res.data.cash_accounts) {
        accounts = res.data.cash_accounts;
      }

      // Deduplicate accounts list based on id to prevent key uniqueness issues
      const uniqueAccounts: CashAccount[] = [];
      const seenIds = new Set<string>();
      for (const acc of accounts) {
        if (acc && acc.id && !seenIds.has(acc.id)) {
          seenIds.add(acc.id);
          uniqueAccounts.push(acc);
        }
      }

      setCashAccounts(uniqueAccounts);

      if (res && res.data) {
        setCategories(res.data.categories || []);
        setUnits(res.data.default_units || []);
      }
      
      // Auto-select first cash account matching chosen currency YER on load
      const yerAcc = accounts.find((a: any) => a.currency === 'YER');
      if (yerAcc) {
        setCashAccountId(yerAcc.id);
      } else if (accounts.length > 0) {
        setCashAccountId(accounts[0].id);
      }
    } catch (err) {
      console.error('Failed to bootstrap form configs', err);
    }
  };

  // Adjust account when currency changes
  useEffect(() => {
    if (paymentMethod === 'credit') {
      setCashAccountId('');
      return;
    }
    const matched = cashAccounts.find(a => a.currency === currency);
    if (matched) {
      setCashAccountId(matched.id);
    } else if (cashAccounts.length > 0) {
      setCashAccountId(cashAccounts[0].id);
    }
  }, [currency, cashAccounts, paymentMethod]);

  // Recalculate dynamic financial variables
  const subtotal = isInvoiceType 
    ? items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0)
    : Number(voucherAmount || 0);

  const total = isInvoiceType 
    ? Math.max(0, subtotal - discountAmount)
    : Number(voucherAmount || 0);

  const remaining = isInvoiceType 
    ? Math.max(0, total - paidAmount)
    : 0; // Vouchers and Simple entries clear right away in context

  const estimatedProfit = isInvoiceType 
    ? items.reduce((sum, item) => {
        const lineRevenue = Number(item.quantity) * Number(item.unit_price);
        const lineCost = Number(item.quantity) * Number(item.estimated_unit_cost || 0);
        return sum + (lineRevenue - lineCost);
      }, 0) - discountAmount
    : 0;

  // Rule: Always show customer section to keep info visible and consistent
  const shouldShowCustomerSection = true;

  // Auto adjusting paid amount and cash account ID based on payment method
  useEffect(() => {
    if (paymentMethod === 'cash') {
      setPaidAmount(total);
      // Auto-select first matching cash account for currency if none chosen or currently empty
      const matched = cashAccounts.find(a => a.currency === currency);
      if (matched) {
        setCashAccountId(matched.id);
      }
    } else if (paymentMethod === 'credit') {
      setPaidAmount(0);
      setCashAccountId(''); // Credit must clear cash account ID
    } else if (paymentMethod === 'partial') {
      // Auto-select first matching cash account for currency if none chosen and paid amount > 0
      if (!cashAccountId && paidAmount > 0) {
        const matched = cashAccounts.find(a => a.currency === currency);
        if (matched) {
          setCashAccountId(matched.id);
        }
      }
    }
  }, [paymentMethod, total, currency, cashAccounts]);

  // Adjust payment method if paid_amount is edited
  const handlePaidAmountChange = (val: number) => {
    setPaidAmount(val);
    if (val >= total && total > 0) {
      setPaymentMethod('cash');
    } else if (val === 0) {
      setPaymentMethod('credit');
    } else {
      setPaymentMethod('partial');
    }
  };

  // Autocomplete searches
  const handleCustomerSearch = async (query: string) => {
    const res = await searchCustomers(query, 10);
    return res.data || [];
  };

  const handleProductSearch = async (query: string) => {
    const res = await searchProducts(query, 10);
    return res.data || [];
  };

  const handleUnitSearch = async (query: string) => {
    const res = await searchUnits(query, 5);
    return res.data || [];
  };

  // Customer Select handlers
  const handleSelectCustomer = (cust: any) => {
    if (cust.is_new_entry) {
      setPartyName(cust.value);
      setSelectedCustomerId(null);
    } else {
      setPartyName(cust.customer_name);
      setPartyPhone(cust.phone_number || '');
      setSelectedCustomerId(cust.id);
    }
  };

  // Item management
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        product_id: null,
        product_name: '',
        category: 'عام',
        unit_id: null,
        unit_name: 'كيلو',
        quantity: 1,
        unit_price: 0,
        estimated_unit_cost: 0,
        notes: ''
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemPropertyChange = (index: number, field: keyof TransactionItemInput, value: any) => {
    setItems(
      items.map((it, idx) => {
        if (idx === index) {
          const updated = { ...it, [field]: value };
          // For purchases, the purchase price itself is the estimated cost
          if (['purchase_invoice', 'purchase_return'].includes(transactionType) && field === 'unit_price') {
            updated.estimated_unit_cost = Number(value);
          }
          return updated;
        }
        return it;
      })
    );
  };

  const handleSelectProduct = (index: number, prod: any) => {
    if (prod.is_new_entry) {
      handleItemPropertyChange(index, 'product_name', prod.value);
      handleItemPropertyChange(index, 'product_id', null);
    } else {
      setItems(
        items.map((it, idx) => {
          if (idx === index) {
            const prodCurrency = prod.default_currency || 'YER';
            
            // Raw prices in the product's default currency
            const rawSalesPrice = Number(prod.default_sales_price || 0);
            const rawEstimatedCost = Number(prod.estimated_cost || 0);

            // Converted prices to invoice's currency
            const convertedSalesPrice = convertCurrency(rawSalesPrice, prodCurrency, currency, sarRate, usdRate);
            const convertedEstimatedCost = convertCurrency(rawEstimatedCost, prodCurrency, currency, sarRate, usdRate);

            const isPurchase = ['purchase_invoice', 'purchase_return'].includes(transactionType);
            const basePrice = isPurchase ? convertedEstimatedCost : convertedSalesPrice;

            // Get product units
            const { units, gallon_weight_kg } = parseProductUnitsAndNotes(prod.notes, prod.default_unit_name || 'جالون');
            const enabledUnits = units.filter(u => u.enabled !== false);
            
            // Find default unit
            const defaultUnit = enabledUnits.find(u => u.is_default) || enabledUnits.find(u => u.is_base_unit) || enabledUnits[0] || {
              unit_name: prod.default_unit_name || 'جالون',
              conversion_factor: 1,
              is_base_unit: true,
              is_default: true
            };

            const trueBasePrice = defaultUnit.conversion_factor > 0 ? basePrice / defaultUnit.conversion_factor : basePrice;
            const trueBaseCost = defaultUnit.conversion_factor > 0 ? convertedEstimatedCost / defaultUnit.conversion_factor : convertedEstimatedCost;

            const calculatedUnitPrice = trueBasePrice * defaultUnit.conversion_factor;
            const calculatedCostPrice = trueBaseCost * defaultUnit.conversion_factor;

            console.log("UNIT PRICE CALC", {
              product: prod,
              selectedUnit: defaultUnit,
              baseSalePrice: trueBasePrice,
              conversionFactor: defaultUnit.conversion_factor,
              calculatedUnitPrice
            });

            return {
              ...it,
              product_id: prod.id,
              product_name: prod.product_name,
              category: prod.category || 'سدر',
              unit_name: defaultUnit.unit_name,
              unit_id: null,
              conversion_factor: defaultUnit.conversion_factor,
              all_units: enabledUnits,
              base_unit_name: prod.default_unit_name || 'جالون',
              base_sale_price: trueBasePrice,
              base_cost_price: trueBaseCost,
              unit_price: Math.round(calculatedUnitPrice * 100) / 100,
              estimated_unit_cost: Math.round(calculatedCostPrice * 100) / 100,
              gallon_weight_kg: gallon_weight_kg || 6.7
            };
          }
          return it;
        })
      );
    }
  };

  const handleSelectUnitForItem = (index: number, unitName: string) => {
    setItems(prevItems => prevItems.map((it, idx) => {
      if (idx !== index) return it;
      
      const chosenUnit = it.all_units?.find(u => u.unit_name === unitName);
      if (!chosenUnit) {
        // If not found in product units, just change unit_name
        return { ...it, unit_name: unitName, conversion_factor: 1 };
      }
      
      const basePrice = it.base_sale_price ?? it.unit_price;
      const baseCost = it.base_cost_price ?? it.estimated_unit_cost;
      
      const calculatedUnitPrice = basePrice * chosenUnit.conversion_factor;
      const calculatedCostPrice = baseCost * chosenUnit.conversion_factor;

      console.log("UNIT PRICE CALC", {
        product: { id: it.product_id, name: it.product_name },
        selectedUnit: chosenUnit,
        baseSalePrice: basePrice,
        conversionFactor: chosenUnit.conversion_factor,
        calculatedUnitPrice
      });

      return {
        ...it,
        unit_name: chosenUnit.unit_name,
        conversion_factor: chosenUnit.conversion_factor,
        unit_price: Math.round(calculatedUnitPrice * 100) / 100,
        estimated_unit_cost: Math.round(calculatedCostPrice * 100) / 100
      };
    }));
  };

  // Submit Handler
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingLoading) return;
    setFormError(null);

    // Prevent Saving when Offline
    if (!navigator.onLine) {
      setFormError('لا يوجد اتصال بالإنترنت. لا يمكن حفظ العمليات المالية حتى يعود الاتصال.');
      return;
    }

    // Save all items in the items list
    const itemsToSave = items;

    // 1. Validation according to transaction type & payment status
    if (isInvoiceType) {
      if (itemsToSave.some(it => !it.product_name.trim())) {
        setFormError('يرجى تحديد أو إدخال أسماء السلع لجميع البنود بالفاتورة.');
        return;
      }

      if (itemsToSave.some(it => Number(it.quantity) <= 0 || Number(it.unit_price) < 0)) {
        setFormError('يرجى التأكد من إدخال كمية وأسعار صحيحة أكبر من الصفر.');
        return;
      }
    } else {
      // Vouchers & simple entries
      if (Number(voucherAmount) <= 0) {
        setFormError('يرجى إدخال قيمة مالية صحيحة للسند أو القيد أكبر من صفر.');
        return;
      }
    }

    // Debt check
    const isDebt = paymentMethod === 'credit' || paymentMethod === 'partial';
    
    if (isDebt && isInvoiceType) {
      if (!partyPhone.trim()) {
        setFormError('لا يمكن تسجيل عملية آجل أو جزئي بدون رقم جوال للعميل لتوثيق حركة الديون.');
        return;
      }
      const isGeneric = partyName === 'زبون عام' || partyName === 'مورد عام' || !partyName.trim();
      if (isGeneric) {
        setFormError('يرجى كتابة اسم العميل المخصص بدلاً من "زبون عام" لتوثيق الذمم المتبقية.');
        return;
      }
    }

    setSavingLoading(true);

    try {
      // Enforce cash_account_id to null for modern simplified MVP
      const resolvedCashAccountId = null;

      // Construct appropriate payload dynamically
      let payloadItems: any[] = [];
      if (isInvoiceType) {
        payloadItems = itemsToSave.map(it => {
          const isNewProduct = !it.product_id || (typeof it.product_id === 'string' && it.product_id.startsWith('prod-'));
          const qty = Number(it.quantity);
          const price = Number(it.unit_price);
          return {
            ...it,
            product_id: isNewProduct ? null : it.product_id,
            product_name: it.product_name,
            product_name_snapshot: isNewProduct ? it.product_name : undefined,
            quantity: qty,
            unit_price: price,
            line_total: Math.round(qty * price * 100) / 100,
            estimated_unit_cost: Number(it.estimated_unit_cost || 0),
            unit_name: it.unit_name || 'جالون',
            conversion_factor: it.conversion_factor ?? 1,
            base_unit_name: it.base_unit_name || 'جالون',
            gallon_weight_kg: it.gallon_weight_kg ?? 6.7
          };
        });
      } else {
        // Build synthetic single transaction line for voucher mapping to keep server schema 100% happy
        const descMatch = transactionType === 'receipt_voucher'
          ? 'سند قبض مالي نقدي'
          : transactionType === 'payment_voucher'
          ? 'سند صرف مصروفات نقدية'
          : 'قيد تسوية مالي بسيط';

        payloadItems = [{
          product_id: null,
          product_name: descMatch,
          category: 'سندات',
          unit_id: null,
          unit_name: 'قيد',
          quantity: 1,
          unit_price: Number(voucherAmount || 0),
          estimated_unit_cost: transactionType === 'payment_voucher' ? Number(voucherAmount || 0) : 0,
          notes: notes || ''
        }];
      }

      const payload: TransactionPayload = {
        business_id: '4c424fea-a5fb-485f-b695-535eac647224',
        transaction_type: transactionType,
        currency,
        party_name: partyName || undefined,
        party_phone: partyPhone || undefined,
        customer_id: selectedCustomerId || undefined,
        cash_account_id: resolvedCashAccountId,
        payment_status: isInvoiceType ? paymentMethod : 'cash',
        total_amount: total,
        paid_amount: isInvoiceType 
          ? (paymentMethod === 'cash' ? total : Number(paidAmount || 0)) 
          : Number(voucherAmount || 0),
        discount_amount: isInvoiceType ? Number(discountAmount || 0) : 0,
        remaining_amount: isInvoiceType 
          ? (paymentMethod === 'cash' ? 0 : (paymentMethod === 'credit' ? total : Math.max(0, total - Number(paidAmount || 0)))) 
          : 0,
        notes: notes || '',
        send_whatsapp: sendWhatsapp,
        auto_create_products: true,
        items: payloadItems
      };

      const res = await createTransaction(payload);
      if (res.error) {
        // Humanize potential errors
        let errMsg = res.error;
        if (typeof errMsg === 'string' && errMsg.toLowerCase().includes('requires customer_id')) {
          errMsg = 'لا يمكن تسجيل عملية آجل أو جزئي بدون رقم جوال أو تحديد العميل لضمان إطار الضمانات.';
        }
        setFormError(errMsg);
      } else if (res.data) {
        const transId = res.data.transaction_id;
        const transNo = res.data.transaction_no;

        // Auto convert order status if prefilled from Customer Orders
        if (convertedOrderId) {
          try {
            await supabase.rpc('ibex_had_mark_customer_order_converted', {
              p_order_id: convertedOrderId,
              p_transaction_id: transId
            });
            await supabase.rpc('ibex_had_update_customer_order_status', {
              p_order_id: convertedOrderId,
              p_status: 'completed',
              p_note: 'تم تحويل الطلب بنجاح إلى فاتورة مبيعات',
              p_converted_transaction_id: transId
            });
          } catch (rpcErr) {
            console.error('Failed to mark order as converted:', rpcErr);
          }
        }

        let fullDetail = null;
        try {
          const detailRes = await getTransactionDetail(transId);
          if (detailRes && detailRes.data) {
            fullDetail = Array.isArray(detailRes.data) ? detailRes.data[0] : detailRes.data;
          }
        } catch (detailErr) {
          console.error("Failed to fetch full detail immediately after creation", detailErr);
        }

        if (!fullDetail) {
          fullDetail = {
            id: transId,
            transaction_id: transId,
            transaction_no: transNo,
            transaction_type: transactionType,
            currency: currency,
            customer_name: partyName,
            customer_phone: partyPhone,
            payment_status: isInvoiceType ? paymentMethod : 'cash',
            total_amount: total,
            paid_amount: isInvoiceType ? (paymentMethod === 'cash' ? total : Number(paidAmount || 0)) : Number(voucherAmount || 0),
            discount_amount: isInvoiceType ? Number(discountAmount || 0) : 0,
            remaining_amount: isInvoiceType ? (paymentMethod === 'cash' ? 0 : (paymentMethod === 'credit' ? total : Math.max(0, total - Number(paidAmount || 0)))) : 0,
            notes: notes || '',
            items: payloadItems.map(pi => ({
              product_name: pi.product_name,
              unit_name: pi.unit_name,
              quantity: pi.quantity,
              unit_price: pi.unit_price,
              line_total: Number(pi.quantity || 0) * Number(pi.unit_price || 0)
            }))
          };
        }

        const normalized = normalizeTransactionForUi(fullDetail);

        setLastSavedTransaction(fullDetail);

        setSuccessData({
          id: transId,
          no: normalized.transaction_no,
          total: normalized.total_amount,
          paid: normalized.paid_amount,
          remaining: normalized.remaining_amount,
          profit: normalized.estimated_profit,
          currency: normalized.currency,
          createdBy: fullDetail?.created_by_email || fullDetail?.created_by || currentUser?.email || 'غير محدد'
        });
      }
    } catch (err: any) {
      setFormError(err?.message || 'أخفقت عملية الحفظ للبيانات المالية.');
    } finally {
      setSavingLoading(false);
    }
  };

  return (
    <div className="space-y-6 fade-in pb-16">
      
      {/* Success Modal Overlay */}
      {successData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in text-right overflow-y-auto">
          <div className="bg-card-bg border border-border-val max-w-sm w-[calc(100vw-24px)] sm:w-full rounded-[22px] p-5 sm:p-6 space-y-5 shadow-2xl relative text-main-text transition-colors duration-200 max-h-[calc(100vh-24px)] overflow-y-auto">
            
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-success-val/15 text-success-val rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black text-main-text">تم حفظ العملية بنجاح</h3>
              <p className="text-[11px] text-sec-text">تم تدوين القيد المالي بنجاح في دفاتر باحكم.</p>
            </div>

            <div className="bg-soft-card rounded-xl border border-border-val p-4 text-xs space-y-2.5">
              <div className="flex justify-between items-center pb-1.5 border-b border-border-val/40">
                <span className="text-sec-text">رقم العملية (transaction_no):</span>
                <span className="font-mono font-bold text-main-text text-sm">{successData.no}</span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-border-val/40">
                <span className="text-sec-text">الإجمالي الكلي:</span>
                <span className="font-mono font-bold text-honey">{formatMoney(successData.total, successData.currency)}</span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-border-val/40">
                <span className="text-sec-text">المبلغ المدفوع:</span>
                <span className="font-mono font-bold text-success-val">{formatMoney(successData.paid, successData.currency)}</span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-border-val/40">
                <span className="text-sec-text">المستحق المتبقي:</span>
                <span className={`font-mono font-bold ${successData.remaining > 0 ? 'text-danger-val' : 'text-sec-text'}`}>
                  {formatMoney(successData.remaining, successData.currency)}
                </span>
              </div>
              {successData.profit > 0 && (
                <div className="flex justify-between items-center pt-1">
                  <span className="text-sec-text">صافي هامش الأرباح:</span>
                   <span className="font-mono text-success-val font-bold">+{formatMoney(successData.profit, 'YER')}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1.5 border-t border-border-val/20">
                <span className="text-sec-text">تمت بواسطة:</span>
                <span className="font-mono font-bold text-main-text">{successData.createdBy || 'غير محدد'}</span>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={handleResetForm}
                className="w-full bg-sec-bg border border-border-val text-main-text hover:bg-side-active py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 text-honey" />
                تسجيل عملية جديدة
              </button>
            </div>

            <div className="pt-2 border-t border-border-val/20">
              <button
                type="button"
                onClick={handlePrintSuccessPdf}
                disabled={loadingSuccessPdf || !lastSavedTransaction}
                className="w-full bg-gradient-to-r from-[#D98200] to-[#E28A25] text-white hover:opacity-95 py-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer text-center flex items-center justify-center gap-2 active:scale-95 shadow-md shadow-amber-950/25 disabled:opacity-50 font-bold"
              >
                {loadingSuccessPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {loadingSuccessPdf ? 'جاري تحضير PDF...' : 'طباعة فاتورة PDF'}
              </button>
            </div>

          </div>
        </div>
      )}
      
      {/* Header breadcrumb */}
      <div className="flex items-center gap-3 bg-card-bg/60 p-3 sm:p-4 rounded-2xl border border-border-val/50 shadow-sm">
        <button 
          type="button"
          onClick={onCancel}
          className="p-2 bg-card-bg hover:bg-side-active border border-border-val text-sec-text hover:text-main-text rounded-xl cursor-pointer transition-colors"
        >
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <div>
          <h2 className="text-base sm:text-lg font-black text-main-text">مبيعات باحكم للعسل</h2>
          <p className="text-[10px] sm:text-xs text-sec-text mt-0.5 text-right">تسجيل سريع ومتابعة الذمم</p>
        </div>
      </div>

      <form onSubmit={handleSaveTransaction} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Details Panel (Left cols-2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section 1: Type & Currency selectors - Always visible */}
          <div className="bg-card-bg border border-[#E8DDCC] rounded-2xl p-4 space-y-4 shadow-sm">
            <h3 className="text-xs sm:text-sm font-black text-honey pb-1.5 border-b border-border-val/60">١. تصنيف ونوع القيد المالي والعملة</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Op Type */}
              <div>
                <label className="block text-xs text-[#231A0B] mb-1 font-black">نوع العملية المالية والمستند:</label>
                <select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value as TransactionType)}
                  className="w-full bg-[#FFFDF8] border border-[#E8DDCC] focus:border-honey text-[#1E1A14] rounded-xl py-2.5 px-3 text-xs sm:text-sm font-black outline-none transition-all"
                >
                  <option value="sales_invoice">فاتورة مبيعات (sales_invoice)</option>
                  <option value="purchase_invoice">فاتورة مشتريات (purchase_invoice)</option>
                  <option value="receipt_voucher">سند قبض نقدي (receipt_voucher)</option>
                  <option value="payment_voucher">سند صرف نقدي (payment_voucher)</option>
                  <option value="sales_return">مرتجع مبيعات (sales_return)</option>
                  <option value="purchase_return">مرتجع مشتريات (purchase_return)</option>
                  <option value="simple_entry">قيد بسيط مستقل (simple_entry)</option>
                </select>
              </div>

              {/* Currency choices */}
              <div>
                <label className="block text-xs text-[#231A0B] mb-1 font-black">العملة المستهدفة بالعملية:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['YER', 'SAR', 'USD'] as CurrencyType[]).map((cur) => {
                    const isSelected = currency === cur;
                    const labelsMap = { YER: 'ريال يمني', SAR: 'ريال سعودي', USD: 'دولار أمريكي' };
                    return (
                      <button
                        key={cur}
                        type="button"
                        onClick={() => {
                          if (cur !== currency) {
                            const updatedItems = items.map(it => {
                              if (!it.product_id) return it;
                              const newPrice = convertCurrency(Number(it.unit_price || 0), currency, cur, sarRate, usdRate);
                              const newCost = convertCurrency(Number(it.estimated_unit_cost || 0), currency, cur, sarRate, usdRate);
                              return {
                                ...it,
                                unit_price: Math.round(newPrice * 100) / 100,
                                estimated_unit_cost: Math.round(newCost * 100) / 100
                              };
                            });
                            setItems(updatedItems);
                          }
                          setCurrency(cur);
                        }}
                        className={`py-2 px-1 text-center font-black text-xs rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-honey/10 text-honey border-[#E8DDCC]'
                            : 'bg-soft-card text-sec-text border-border-val hover:bg-side-active'
                        }`}
                      >
                        {cur}
                        <span className="block text-[8px] font-bold text-sec-text mt-0.5">{labelsMap[cur]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* Section 2: Product Items or Voucher Single-Amount Input Form */}
          {isInvoiceType ? (
            <div className="bg-card-bg border border-border-val rounded-2xl p-4 space-y-4">
              <div className="flex justify-between items-center pb-1.5 border-b border-border-val/60">
                <h3 className="text-xs sm:text-sm font-black text-honey flex items-center gap-1.5">
                  <span>🍯</span>
                  {['sales_invoice', 'sales_return'].includes(transactionType)
                    ? '٢. تفاصيل وبنود أصناف العسل المباعة والعبوات'
                    : '٢. تفاصيل وأصناف مقتنيات العسل المشتراة من المورد'}
                </h3>
                
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="bg-sec-bg hover:bg-side-active text-xs font-black text-main-text py-1.5 px-3 rounded-lg border border-border-val flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-honey" />
                  إضافة بند جديد
                </button>
              </div>

              <div className="space-y-4">
                {items.map((item, index) => {

                  return (
                    <div 
                      key={index} 
                      className="p-4 bg-white border border-[#E8DDCC]/85 rounded-2xl space-y-3.5 relative shadow-sm hover:shadow-md transition-all duration-200"
                    >
                      {/* Delete icon - Only if items count > 1 */}
                      {items.length > 1 && (
                        <button
                           type="button"
                           onClick={() => handleRemoveItem(index)}
                           className="absolute left-3 top-3 text-danger-val hover:bg-danger-val/10 p-1.5 rounded-lg border border-transparent hover:border-danger-val/20 transition-all cursor-pointer z-10"
                           title="حذف هذا السطر"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Product Name (Search) on Top */}
                      <div className="space-y-1">
                        <label className="block text-[11px] text-[#8A8276] font-bold">اسم صنف العسل المطلـوب:</label>
                        <AutocompleteInput
                          placeholder="ابحث بالنقر واكتب اسم العسل (مثال: سدر دوعني)..."
                          onSearch={handleProductSearch}
                          onSelect={(prod) => handleSelectProduct(index, prod)}
                          getDisplayValue={(p) => p.product_name}
                          getSecondaryDisplayValue={(p) => {
                            const pCur = p.default_currency || 'YER';
                            const pPrice = p.default_sales_price || 0;
                            if (pCur !== currency) {
                              const convPrice = convertCurrency(pPrice, pCur, currency, sarRate, usdRate);
                              return `${formatMoney(pPrice, pCur)} (يعادل ~${formatMoney(Math.round(convPrice), currency)}) - ${p.category || 'عام'}`;
                            }
                            return `${formatMoney(pPrice, pCur)} - ${p.category || 'عام'}`;
                          }}
                          idAttribute="id"
                          initialValue={item.product_name}
                          allowCustomEntry={true}
                          onCustomEntryChange={(val) => handleItemPropertyChange(index, 'product_name', val)}
                          icon={<ShoppingBag className="w-4 h-4 text-honey" />}
                          inputClassName="w-full bg-[#FFFDF8] border border-[#E8DDCC] hover:border-[#d9cca8] focus:border-honey text-[#1E1A14] placeholder-[#8A8276] rounded-xl py-2.5 px-10 text-xs sm:text-sm outline-none transition-all font-semibold"
                          dropdownClassName="absolute z-50 w-full mt-2 bg-white border border-[#E8DDCC] rounded-xl shadow-2xl max-h-64 overflow-y-auto"
                        />
                      </div>

                      {/* Quantity & Unit in one row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-[#8A8276] font-bold">الكمية المطلوبة:</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.quantity}
                            onChange={(e) => handleItemPropertyChange(index, 'quantity', parseNormalizedFloat(e.target.value))}
                            className="w-full bg-[#FFFDF8] border border-[#E8DDCC] focus:border-honey text-[#1E1A14] rounded-xl py-2 px-3 text-xs sm:text-sm font-mono outline-none transition-all text-center font-bold"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-[11px] text-[#8A8276] font-bold">الوحدة المقاسة:</label>
                          {item.all_units && item.all_units.length > 0 ? (
                            <div className="relative">
                              <select
                                value={item.unit_name}
                                onChange={(e) => handleSelectUnitForItem(index, e.target.value)}
                                className="w-full bg-[#FFFDF8] border border-[#E8DDCC] hover:border-[#d9cca8] focus:border-honey text-[#1E1A14] rounded-xl py-2 px-3 text-xs outline-none transition-all font-semibold text-center h-[38px] appearance-none cursor-pointer"
                              >
                                {item.all_units.map((u: any) => (
                                  <option key={u.unit_name} value={u.unit_name}>
                                    {u.unit_name} (×{u.conversion_factor})
                                  </option>
                                ))}
                              </select>
                              <div className="absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none text-sec-text">
                                <HelpCircle className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          ) : (
                            <AutocompleteInput
                              placeholder="مثال: كيلو، ربع..."
                              onSearch={handleUnitSearch}
                              onSelect={(u) => {
                                if (u.is_new_entry) {
                                  handleItemPropertyChange(index, 'unit_name', u.value);
                                  handleItemPropertyChange(index, 'unit_id', null);
                                } else {
                                  handleItemPropertyChange(index, 'unit_name', u.unit_name);
                                  handleItemPropertyChange(index, 'unit_id', u.id);
                                }
                              }}
                              getDisplayValue={(u) => u.unit_name}
                              idAttribute="id"
                              initialValue={item.unit_name}
                              allowCustomEntry={true}
                              onCustomEntryChange={(val) => handleItemPropertyChange(index, 'unit_name', val)}
                              icon={<HelpCircle className="w-3.5 h-3.5 text-[#8A8276]" />}
                              inputClassName="w-full bg-[#FFFDF8] border border-[#E8DDCC] hover:border-[#d9cca8] focus:border-honey text-[#1E1A14] placeholder-[#8A8276] rounded-xl py-2.5 px-10 text-xs outline-none transition-all font-semibold text-center"
                              dropdownClassName="absolute z-50 w-full mt-2 bg-white border border-[#E8DDCC] rounded-xl shadow-2xl max-h-64 overflow-y-auto"
                            />
                          )}
                          
                          {item.product_id && (!item.all_units || item.all_units.length <= 1) && (
                            <div className="mt-1 text-[9px] text-[#b45309] bg-[#fef3c7] border border-[#fde68a] px-2 py-1 rounded-lg flex items-center gap-1 font-bold">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              لا توجد وحدات مخصصة لهذا الصنف، تم استخدام وحدة الأساس.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Sell Price & Estimated Cost in one row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-[#8A8276] font-bold">
                            {['purchase_invoice', 'purchase_return'].includes(transactionType)
                              ? 'سعر الشراء الفعلي:'
                              : 'سعر البيع المقترح / المفرد:'}
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.unit_price}
                            onChange={(e) => handleItemPropertyChange(index, 'unit_price', parseNormalizedFloat(e.target.value))}
                            className="w-full bg-[#FFFDF8] border border-[#E8DDCC] focus:border-honey text-[#1E1A14] rounded-xl py-2 px-3 text-xs sm:text-sm font-mono outline-none transition-all text-center font-black text-honey"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-[#8A8276] font-bold">
                            {['purchase_invoice', 'purchase_return'].includes(transactionType)
                              ? 'عبوة تكملة (مكافئ):'
                              : 'التكلفة التقديرية (اختيارية):'}
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder={['purchase_invoice', 'purchase_return'].includes(transactionType) ? '' : 'لحساب الأرباح...'}
                            value={item.estimated_unit_cost || ''}
                            onChange={(e) => handleItemPropertyChange(index, 'estimated_unit_cost', parseNormalizedFloat(e.target.value))}
                            disabled={['purchase_invoice', 'purchase_return'].includes(transactionType)}
                            className="w-full bg-[#FFFDF8] border border-[#E8DDCC] focus:border-honey text-[#1E1A14] rounded-xl py-2 px-3 text-xs sm:text-sm font-mono outline-none transition-all text-center placeholder-[#8A8276]/55 disabled:opacity-45"
                          />
                        </div>
                      </div>

                      {/* Total Item summary at bottom */}
                      <div className="flex justify-between items-center text-xs text-[#8A8276] pt-2 border-t border-[#E8DDCC]/35 font-semibold">
                        <div className="text-[11px]">
                          {Number(item.estimated_unit_cost) > 0 && !['purchase_invoice', 'purchase_return'].includes(transactionType) && (
                            <div className="flex flex-col gap-0.5">
                              <span>التكلفة الكلية للسلعة: <span className="font-mono text-[#1E1A14]">{formatNumber(Number(item.quantity) * Number(item.estimated_unit_cost))} {currency}</span></span>
                              <span className="text-emerald-700 font-bold">الربح التقديري المتوقع: <span className="font-mono font-black text-emerald-800">+{formatNumber((Number(item.unit_price) - Number(item.estimated_unit_cost)) * Number(item.quantity))} {currency}</span></span>
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-[#1E1A14]">
                          {['purchase_invoice', 'purchase_return'].includes(transactionType) ? 'إجمالي توريد البند:' : 'إجمالي البند:'} <span className="font-mono text-sm text-honey font-black">{formatNumber(Number(item.quantity) * Number(item.unit_price))}</span> {currency}
                        </span>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-card-bg border border-border-val rounded-2xl p-6 space-y-5 animate-fade-in text-right">
              <div className="pb-2 border-b border-border-val/60">
                <h3 className="text-xs font-bold text-honey flex items-center gap-1.5">
                  <span className="text-base">💳</span>
                  {transactionType === 'receipt_voucher'
                    ? '٢. قيمة ومبلغ سند القبض المالي النقدي الكاش'
                    : transactionType === 'payment_voucher'
                    ? '٢. قيمة ومبلغ سند الصرف والنقد المدفوع'
                    : '٢. قيمة القيد المالي الكلي للتسوية'}
                </h3>
              </div>

              <div className="p-8 bg-soft-card border border-border-val/95 rounded-2xl flex flex-col items-center justify-center space-y-4">
                <label className="text-xs text-sec-text font-black text-right">
                  {transactionType === 'receipt_voucher'
                    ? 'المبلغ المقبوض المستلم نقداً:'
                    : transactionType === 'payment_voucher'
                    ? 'المبلغ المصروف المأخوذ نقداً من الخزينة:'
                    : 'قيمة المذكرة أو قيد التسوية الجديد:'}
                </label>

                <div className="relative w-full max-w-sm">
                  <input
                    id="voucher-amount-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="أدخل القيمة المالية..."
                    value={voucherAmount || ''}
                    onChange={(e) => setVoucherAmount(parseNormalizedFloat(e.target.value))}
                    className="w-full text-center bg-app-bg border-2 border-border-val hover:border-honey/40 focus:border-honey text-3xl font-black font-mono text-honey rounded-full py-4.5 px-8 outline-none transition-all placeholder:text-border-val/60 shadow-inner"
                  />
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-xs font-black text-honey py-1 px-3.5 bg-honey/10 border border-honey/20 rounded-full">
                    {currency}
                  </div>
                </div>

                <div className="text-[11px] text-sec-text text-center max-w-md leading-relaxed space-y-1 pt-1">
                  <p className="font-bold text-main-text">
                    {transactionType === 'receipt_voucher'
                      ? '✓ سيقوم هذا السند بزيادة balance الخزينة المستهدفة وتسجيل دفعة دائنة لحساب العميل.'
                      : transactionType === 'payment_voucher'
                      ? '✓ سيقوم هذا السند بخصم هذا المبلغ من رصيد الخزينة المستهدفة وتسجيله كخرج مالي (مصروفات).'
                      : '✓ سيتم تدوين القيد المالي بسجلات اليومية المستقلة لمطابقة الدفاتر بشكل مباشر.'}
                  </p>
                  <p className="text-[10px] text-border-val/70">
                    ملاحظة: الصناديق متجاوبة وتحدث كشوف الحركات فور الحفظ.
                  </p>
                </div>
              </div>
            </div>
          )}



        </div>

        {/* Customer & Pricing sidebar layouts (Right col-1) */}
        <div className="space-y-4">
          
          {/* Section 3: Customer profile assignment */}
          {shouldShowCustomerSection && (
            <div className="bg-card-bg border border-border-val rounded-2xl p-4 space-y-4 animate-fade-in shadow-sm">
              <h3 className="text-xs font-black text-honey pb-1.5 border-b border-border-val/60 flex items-center gap-1.5">
                <span>👤</span>
                {['sales_invoice', 'sales_return'].includes(transactionType)
                  ? '٣. ملف العميل وهاتف الاتصال'
                  : transactionType === 'receipt_voucher'
                  ? '٣. ملف العميل المسدد للدفعة وهاتفه'
                  : ['purchase_invoice', 'purchase_return'].includes(transactionType)
                  ? '٣. ملف المورد وسجل الهاتف'
                  : '٣. الحساب والجهة المعنية بالصرف والقيد'}
              </h3>
              
              {/* Customer Search Autocomplete */}
              <div>
                <label className="block text-[11px] text-sec-text mb-1 font-semibold">
                  {['sales_invoice', 'sales_return', 'receipt_voucher'].includes(transactionType)
                    ? 'ابحث بالاسم أو رقم جوال العميل:'
                    : ['purchase_invoice', 'purchase_return'].includes(transactionType)
                    ? 'ابحث بالاسم أو هاتف المورد المعني:'
                    : 'اسم المستلم / الطرف المعني بالعملية:'}
                </label>
                <AutocompleteInput
                  placeholder={
                    ['sales_invoice', 'sales_return', 'receipt_voucher'].includes(transactionType)
                      ? 'اكتب اسم العميل (أو اكتب زبون عام)...'
                      : ['purchase_invoice', 'purchase_return'].includes(transactionType)
                      ? 'اكتب اسم المورد (أو مورد عام)...'
                      : 'اكتب اسم المستلم / الطرف المستفيد...'
                  }
                  onSearch={handleCustomerSearch}
                  onSelect={handleSelectCustomer}
                  getDisplayValue={(c) => c.customer_name}
                  getSecondaryDisplayValue={(c) => c.phone_number ? `هاتف: ${c.phone_number}` : undefined}
                  idAttribute="id"
                  initialValue={partyName}
                  allowCustomEntry={true}
                  onCustomEntryChange={(val) => {
                     setPartyName(val);
                     setSelectedCustomerId(null);
                  }}
                  icon={<User className="w-4 h-4 text-honey" />}
                  inputClassName="w-full bg-[#FFFDF8] border border-[#E8DDCC] hover:border-[#d9cca8] focus:border-honey text-[#1E1A14] placeholder-[#8A8276] rounded-xl py-2.5 px-10 text-xs outline-none transition-all font-semibold"
                  dropdownClassName="absolute z-50 w-full mt-2 bg-white border border-[#E8DDCC] rounded-xl shadow-2xl max-h-64 overflow-y-auto"
                />
              </div>

              {/* Customer Phone */}
              <div>
                <label className="block text-[11px] text-sec-text mb-1 font-semibold">
                  {['sales_invoice', 'sales_return', 'receipt_voucher'].includes(transactionType)
                    ? 'رقم هاتف/جوال العميل (مهم للآجل والديون):'
                    : ['purchase_invoice', 'purchase_return'].includes(transactionType)
                    ? 'رقم هاتف/جوال المورد المعتمد بالملف:'
                    : 'رقم هاتف المستفيد / الطرف الآخر:'}
                </label>
                <input
                  type="text"
                  value={partyPhone}
                  onChange={(e) => setPartyPhone(normalizeDigits(e.target.value))}
                  placeholder="أدخل هاتف العميل (مثال: 777000000)..."
                  className="w-full bg-[#FFFDF8] border border-[#E8DDCC] focus:border-honey text-[#1E1A14] rounded-xl py-2 px-3 text-xs font-mono outline-none transition-all"
                />
              </div>

              {partyName === 'زبون عام' && ['sales_invoice', 'sales_return'].includes(transactionType) && (
                <div className="text-[10px] text-amber-600 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg leading-relaxed text-right">
                  ملاحظة: زبون عام مناسب فقط للفواتير المدفوعة نقداً (كاش). إذا كانت الآجل، يرجى كتابة اسم العميل ورقم جواله لفتح قيد مالي صحيح لمتابعة الديون والضمانات.
                </div>
              )}

              {partyName === 'مورد عام' && ['purchase_invoice', 'purchase_return'].includes(transactionType) && (
                <div className="text-[10px] text-amber-600 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg leading-relaxed text-right">
                  تنبيه: لتسجيل حساب التوريد كآجل ديون على المحل للمورد، يرجى إدخال اسم المورد المخصص لتوثيق حركة المديونية بدقة.
                </div>
              )}
            </div>
          )}

          {/* Section 4: Money details & Payments */}
          <div className="bg-card-bg border border-border-val rounded-2xl p-4 space-y-4">
            <h3 className="text-xs font-black text-honey pb-1.5 border-b border-border-val/60 flex items-center gap-1.5">
              <span>🏦</span>
              {isInvoiceType ? '٤. السداد وتأكيد الحفظ' : '٤. تفاصيل السند وتأكيد الحفظ'}
            </h3>

            {/* Cash Account matcher - Hidden for simplified MVP */}
            <div className="hidden" aria-hidden="true">
              <label className="block text-xs text-sec-text mb-1.5 font-semibold">حساب صندوق خزينة السداد المستلم:</label>
              <select
                value={cashAccountId}
                onChange={(e) => setCashAccountId(e.target.value)}
                className="w-full bg-soft-card border border-[#E8DDCC] text-main-text rounded-xl py-2 px-3 text-xs outline-none focus:border-honey transition-all font-semibold"
              >
                <option value="">-- اختر الصندوق المالي لتسديد المبلغ --</option>
                {cashAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    📦 {acc.account_name} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>

            {/* Payment method selection - Only for Invoices - Always visible */}
            {isInvoiceType && (
              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-black text-[#231A0B]">طريقة تسديد الفاتورة:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cash', label: 'نقدي كامل' },
                    { id: 'credit', label: 'آجل كامل' },
                    { id: 'partial', label: 'دفع جزئي' }
                  ].map((m) => {
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as any)}
                        className={`py-2 px-1 text-center text-xs font-black rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]'
                            : 'bg-[#FFFDF8] text-[#8A8276] border-[#E8DDCC] hover:bg-side-active hover:text-main-text'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Calculations & Summary Card */}
            <div className="bg-white rounded-xl border border-border-val p-4 space-y-3.5 text-xs">
              {isInvoiceType ? (
                <div className="space-y-3">
                  {/* Subtotal displays */}
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-sec-text font-semibold">المجموع الفرعي للسلع والعبوات:</span>
                    <span className="font-mono font-black text-main-text text-sm">{formatMoney(subtotal, currency)}</span>
                  </div>

                  {/* Discount Entry */}
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-honey font-black">خصم مسموح به (خصم نقدي):</span>
                    <div className="relative w-28 sm:w-32">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(parseNormalizedFloat(e.target.value))}
                        className="w-full bg-white border border-border-val focus:border-honey text-main-text rounded-xl py-1.5 px-3 font-mono text-center outline-none text-xs sm:text-sm font-black"
                      />
                    </div>
                  </div>

                  <div className="border-t border-border-val/70 my-2 pt-2" />

                  {/* Grand Total */}
                  <div className="flex justify-between items-center text-xs sm:text-sm font-black">
                    <span className="text-main-text text-sm font-black">الإجمالي الكلي النهائي بالفاتورة:</span>
                    <span className="font-mono text-base text-honey font-black">{formatMoney(total, currency)}</span>
                  </div>

                  {/* Paid input (Fully selectable & editable directly to optimize quick save) */}
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-success-val font-black">المبلغ المدفوع الكاش فعلياً:</span>
                    <div className="relative w-28 sm:w-32">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={paidAmount}
                        onChange={(e) => handlePaidAmountChange(parseNormalizedFloat(e.target.value))}
                        className="w-full bg-white border border-border-val focus:border-success-val text-success-val rounded-xl py-1.5 px-3 font-mono text-xs sm:text-sm text-center outline-none font-black"
                        placeholder="أدخل المدفوع..."
                      />
                    </div>
                  </div>

                  {/* Remaining debt */}
                  <div className="flex justify-between items-center text-xs sm:text-sm border-b border-border-val/70 pb-2">
                    <span className="text-danger-val font-black">المستحق المتأخر بالذمة لليوم:</span>
                    <span className="font-mono text-danger-val font-black text-sm">{formatMoney(remaining, currency)}</span>
                  </div>

                  {/* Profit summary */}
                  {['sales_invoice', 'sales_return'].includes(transactionType) && estimatedProfit > 0 && (
                    <div className="flex justify-between items-center text-[11px] text-sec-text pt-1.5 font-bold">
                      <span>صافي أرباح الفاتورة التقريبية للنشاط:</span>
                      <span className="text-[#10B981] font-mono font-black">+{formatMoney(estimatedProfit, 'YER')}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-sec-text font-bold">مبلغ السند الكلي:</span>
                    <span className="font-mono text-honey text-base font-black">{formatMoney(total, currency)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-sec-text pt-2 border-t border-border-val/70">
                    <span>جهة السداد المتأثرة:</span>
                    <span className="font-black text-main-text text-xs sm:text-sm">{partyName || 'حساب نقدي مبسط'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Send Whatsapp toggle checkbox - Always visible */}
            <div className="flex items-center gap-2 pt-2 border-t border-border-val/50">
              <input
                type="checkbox"
                id="send_wa"
                checked={sendWhatsapp}
                onChange={(e) => setSendWhatsapp(e.target.checked)}
                className="w-4 h-4 accent-honey cursor-pointer"
              />
              <label htmlFor="send_wa" className="text-xs text-[#231A0B] font-black cursor-pointer flex items-center gap-1 leading-snug">
                <MessageSquare className="w-3.5 h-3.5 text-[#10B981]" />
                {['sales_invoice', 'sales_return', 'receipt_voucher'].includes(transactionType)
                  ? 'إرسال تفاصيل الفاتورة الفورية واتساب للعميل'
                  : ['purchase_invoice', 'purchase_return'].includes(transactionType)
                  ? 'إرسال إشعار التوريد الفوري للمورد واتساب'
                  : 'إرسال إشعار السند الفوري تلقائياً بالواتساب'}
              </label>
            </div>

            {/* Shop Notes - Always visible */}
            <div>
              <label className="block text-xs text-[#231A0B] mb-1 font-black">بيان وملاحظات مكملة للعملية:</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أدخل أي تفاصيل إضافية للبيان والضبط المالي..."
                rows={2}
                className="w-full bg-[#FFFDF8] border border-[#E8DDCC] hover:border-[#D0BF9F] text-[#1E1A14] rounded-xl py-2 px-3 text-xs outline-none focus:border-honey font-semibold"
              />
            </div>

          </div>

          {/* Form error warning panels */}
          {formError && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 p-4 rounded-xl text-xs text-danger-val flex items-start gap-2.5 fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Combined primary trigger buttons */}
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-[#F9F6F0] border border-[#E8DDCC]/70 hover:bg-side-active py-3 text-xs font-bold rounded-xl text-[#8E8678] hover:text-[#1E1A14] transition-all cursor-pointer text-center"
            >
              إلغاء التعديل
            </button>

            <button
               type="submit"
               disabled={savingLoading}
               className="flex-1 bg-[#D97706] hover:bg-[#B45309] text-white font-extrabold py-3 text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-md shadow-honey/15"
            >
              {savingLoading ? (
                <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {savingLoading ? 'جاري الحفظ والترحيل...' : sendWhatsapp ? 'حفظ وإرسال واتساب' : 'حفظ العملية'}
            </button>
          </div>

        </div>

      </form>
    </div>
  );
}
