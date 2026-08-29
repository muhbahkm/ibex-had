/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Check, 
  X, 
  Trash2, 
  Edit, 
  RefreshCw,
  Tag,
  Scale,
  Save,
  AlertCircle,
  ArrowRight,
  HelpCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { searchProducts, upsertProduct } from '../lib/api';
import { Product, CurrencyType } from '../types';
import { formatNumber, formatMoney, normalizeDigits, parseNormalizedFloat } from '../lib/numberUtils';
import { 
  parseProductUnitsAndNotes, 
  serializeProductUnitsAndNotes, 
  SaleUnit,
  PricingMode,
  generateLocalId,
  getDefaultUnitsForGallon,
  getDefaultUnitsForWeightMode,
  getDefaultUnitsForPiece,
  getDefaultUnitsForWeight
} from '../lib/unitUtils';

export default function ProductsView() {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Standalone full view form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [savingLoader, setSavingLoader] = useState(false);
  
  // Custom form states for base-unit/weight structure
  const [pricingMode, setPricingMode] = useState<PricingMode>('gallon');
  const [baseSalePrice, setBaseSalePrice] = useState<number>(0);
  const [baseCostPrice, setBaseCostPrice] = useState<number>(0);
  const [gallonWeightKg, setGallonWeightKg] = useState<number>(6.7);
  const [saleUnits, setSaleUnits] = useState<SaleUnit[]>([]);
  
  const [formData, setFormData] = useState<Partial<Product>>({
    id: undefined,
    product_name: '',
    category: 'سدر',
    default_unit_name: 'جالون',
    default_currency: 'YER',
    notes: ''
  });

  useEffect(() => {
    loadProducts();
  }, [query]);

  const loadProducts = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await searchProducts(query, 50);
      setProducts(res.data || []);
    } catch (err: any) {
      setErrorMessage('أخفق تحميل كتالوج الأصناف: ' + (err?.message || 'خطأ اتصال'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setFormData({
      id: undefined,
      product_name: '',
      category: 'سدر',
      default_unit_name: 'جالون',
      default_currency: 'YER',
      notes: ''
    });
    setPricingMode('gallon');
    setBaseSalePrice(0);
    setBaseCostPrice(0);
    setGallonWeightKg(6.7);
    setSaleUnits(getDefaultUnitsForGallon(6.7));
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenEdit = (p: Product) => {
    const { units, notes: remainNotes, gallon_weight_kg, pricing_mode } = parseProductUnitsAndNotes(p.notes, p.default_unit_name || 'جالون');
    
    setFormData({ 
      ...p, 
      notes: remainNotes 
    });
    setPricingMode(pricing_mode);
    setGallonWeightKg(gallon_weight_kg || 6.7);
    
    // Compute base price depending on what was default
    const defaultUnit = units.find(u => u.is_default) || units.find(u => u.is_base_unit) || units[0];
    const defaultFactor = defaultUnit ? defaultUnit.conversion_factor : 1;
    
    const calculatedBasePrice = defaultFactor > 0 ? (p.default_sales_price || 0) / defaultFactor : (p.default_sales_price || 0);
    const calculatedBaseCost = defaultFactor > 0 ? (p.estimated_cost || 0) / defaultFactor : (p.estimated_cost || 0);
    
    setBaseSalePrice(calculatedBasePrice);
    setBaseCostPrice(calculatedBaseCost);
    setSaleUnits(units);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePricingModeChange = (mode: PricingMode) => {
    setPricingMode(mode);
    if (mode === 'gallon') {
      setFormData(prev => ({ ...prev, default_unit_name: 'جالون' }));
      setGallonWeightKg(6.7);
      setSaleUnits(getDefaultUnitsForGallon(6.7));
    } else if (mode === 'weight') {
      setFormData(prev => ({ ...prev, default_unit_name: 'كيلو' }));
      setGallonWeightKg(1);
      setSaleUnits(getDefaultUnitsForWeightMode());
    } else {
      const baseName = 'علبة';
      setFormData(prev => ({ ...prev, default_unit_name: baseName }));
      setGallonWeightKg(1);
      setSaleUnits(getDefaultUnitsForPiece(baseName));
    }
  };

  const handleBaseUnitNameChange = (name: string) => {
    setFormData(prev => ({ ...prev, default_unit_name: name }));
    setSaleUnits(prev => prev.map(u => u.is_base_unit ? { ...u, unit_name: name } : u));
  };

  // Convert old kg products to Gallon-based
  const convertOldProductToGallon = () => {
    setPricingMode('gallon');
    setGallonWeightKg(6.7);
    // Keep the current sales price as Kilo price, and compute Gallon price
    const currentKiloPrice = baseSalePrice; 
    const currentKiloCost = baseCostPrice;
    
    // Gallon price = kilo price * 6.7
    const newGallonPrice = currentKiloPrice * 6.7;
    const newGallonCost = currentKiloCost * 6.7;
    
    setBaseSalePrice(newGallonPrice);
    setBaseCostPrice(newGallonCost);
    
    setSaleUnits(getDefaultUnitsForGallon(6.7));
    setFormData(prev => ({
      ...prev,
      default_unit_name: 'جالون'
    }));
  };

  // Recalculate conversion factors when gallonWeightKg changes
  useEffect(() => {
    if (!isFormOpen) return;
    if (pricingMode !== 'gallon') return;
    setSaleUnits(prev => {
      return prev.map(u => {
        let factor = u.conversion_factor;
        if (u.unit_name === 'جالون') {
          factor = 1;
        } else if (u.unit_name === 'كيلو' || u.kg_amount === 1) {
          factor = Number((1 / gallonWeightKg).toFixed(6));
        } else if (u.unit_name === 'نصف كيلو' || u.kg_amount === 0.5) {
          factor = Number((0.5 / gallonWeightKg).toFixed(6));
        } else if (u.unit_name === 'ربع كيلو' || u.kg_amount === 0.25) {
          factor = Number((0.25 / gallonWeightKg).toFixed(6));
        }
        return {
          ...u,
          conversion_factor: factor
        };
      });
    });
  }, [gallonWeightKg, isFormOpen, pricingMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_name?.trim()) {
      alert('يرجى إدخال اسم صنف العسل أولاً.');
      return;
    }
    
    const activeDefaultUnit = saleUnits.find(u => u.is_default && u.enabled) || saleUnits.find(u => u.enabled) || saleUnits[0];
    if (!activeDefaultUnit) {
      alert('يرجى تمثيل وتفعيل وحدة واحدة على الأقل للبيع وتحديدها كافتراضية.');
      return;
    }

    setSavingLoader(true);
    try {
      const serializedNotes = serializeProductUnitsAndNotes(saleUnits, formData.notes || '', gallonWeightKg, pricingMode);
      
      // Save default sales price corresponding to default sale unit
      const calculatedDefaultPrice = baseSalePrice * activeDefaultUnit.conversion_factor;
      const calculatedDefaultCost = baseCostPrice * activeDefaultUnit.conversion_factor;

      const finalProduct = {
        ...formData,
        default_unit_name: activeDefaultUnit.unit_name,
        default_sales_price: Math.round(calculatedDefaultPrice * 100) / 100,
        estimated_cost: Math.round(calculatedDefaultCost * 100) / 100,
        notes: serializedNotes
      };

      const { error } = await upsertProduct(finalProduct);
      if (error) {
        alert('أخفقت عملية حفظ الصنف: ' + error);
      } else {
        setIsFormOpen(false);
        await loadProducts();
      }
    } catch (err: any) {
      alert('حدث خطأ غير متوقع: ' + err.message);
    } finally {
      setSavingLoader(false);
    }
  };

  const handleToggleProductActive = async (p: Product) => {
    const newActiveState = !p.is_active;
    
    if (!newActiveState) {
      const confirmDeactivate = window.confirm(`هل أنت متأكد من تعطيل هذا الصنف (${p.product_name})؟ سيتم منع استخدامه في الفواتير الجديدة دون المساس بالفواتير والتقارير السابقة.`);
      if (!confirmDeactivate) return;
    }
    
    setLoading(true);
    try {
      const { error } = await upsertProduct({
        ...p,
        is_active: newActiveState
      });
      if (error) {
        alert('أخفق تحديث حالة الصنف: ' + error);
      } else {
        alert(newActiveState ? 'تم تنشيط الصنف بنجاح ✓' : 'تم تعطيل الصنف بنجاح لمنع تخريب التقارير السابقة. ✓');
        await loadProducts();
      }
    } catch (err: any) {
      alert('حدث خطأ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // If Form View is active, render the dedicated Full-View page layout instead of the grid list!
  if (isFormOpen) {
    return (
      <div className="space-y-6 fade-in pb-16 max-w-5xl mx-auto text-right">
        
        {/* Form Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card-bg p-5 rounded-2xl border border-border-val shadow-sm transition-colors duration-200">
          <div>
            <button 
              onClick={() => setIsFormOpen(false)}
              className="flex items-center gap-2 text-xs text-sec-text hover:text-honey transition-colors mb-2 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة إلى الكاتلوج والدليل</span>
            </button>
            <h2 className="text-xl font-black text-main-text flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-honey" />
              {formData.id ? 'تعديل بيانات صنف عسل مقيد' : 'إضافة نوع عسل تجاري جديد'}
            </h2>
            <p className="text-xs text-sec-text mt-1">تأسيس وضبط الصنف وأسعاره بأساس وحدة الجالون والوزن والوحدات المشتقة.</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsFormOpen(false)}
              className="bg-sec-bg hover:bg-side-active text-xs px-4 py-2.5 rounded-xl text-main-text font-bold cursor-pointer transition-colors border border-border-val"
            >
              تراجع
            </button>
            <button
              onClick={handleSubmit}
              disabled={savingLoader}
              className="bg-honey hover:bg-honey-hover text-white font-black text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 duration-200 shadow-sm"
            >
              {savingLoader && <div className="w-3.5 h-3.5 border-2 border-t-transparent border-white rounded-full animate-spin" />}
              <Save className="w-4 h-4" />
              حفظ وتثبيت الصنف
            </button>
          </div>
        </div>

        {/* Form Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Right/Major Column: Product details and weight */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Section 1: Product details */}
            <div className="bg-card-bg border border-border-val p-6 rounded-2xl shadow-sm space-y-4">
              <div className="border-b border-border-val pb-3 flex items-center gap-2">
                <Tag className="w-4 h-4 text-honey" />
                <h3 className="text-sm font-black text-main-text">القسم الأول: بيانات صنف العسل</h3>
              </div>

              <div>
                <label className="block text-xs text-sec-text mb-1.5 font-bold">اسم الصنف (مثال: عسل سدر دوعني مصفى):</label>
                <input
                  type="text"
                  required
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  placeholder="أدخل اسم نوع العسل بالتفصيل..."
                  className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-3.5 text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-sec-text mb-1.5 font-bold">تحت تصنيف مخصص:</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="سدر، سلام، سمر، زهور..."
                    className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-3 text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-sec-text mb-1.5 font-bold">العملة الافتراضية للبيع:</label>
                  <select
                    value={formData.default_currency}
                    onChange={(e) => setFormData({ ...formData, default_currency: e.target.value as CurrencyType })}
                    className="w-full bg-soft-card border border-border-val text-main-text rounded-xl py-2.5 px-2 text-xs outline-none cursor-pointer"
                  >
                    <option value="YER">ريال يمني YER</option>
                    <option value="SAR">ريال سعودي SAR</option>
                    <option value="USD">دولار أمريكي USD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-sec-text mb-1 font-bold">وصف أو ملاحظات الصنف:</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="بلد المنشأ، نقاوة العسل، محتوى الشمع أو التبلور..."
                  rows={2}
                  className="w-full bg-soft-card border border-border-val text-main-text text-xs py-2 px-3 rounded-xl outline-none"
                />
              </div>
            </div>

            {/* Section 2: Pricing / Measurement Mode */}
            <div className="bg-card-bg border border-border-val p-6 rounded-2xl shadow-sm space-y-4">
              <div className="border-b border-border-val pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-honey" />
                  <h3 className="text-sm font-black text-main-text">القسم الثاني: طريقة التسعير ونمط القياس</h3>
                </div>
                {pricingMode !== 'gallon' && (
                  <button
                    type="button"
                    onClick={convertOldProductToGallon}
                    className="text-[10px] bg-honey/10 text-honey hover:bg-honey/20 px-3 py-1 rounded-lg font-black transition-colors"
                  >
                    تحويل الصنف إلى أساس الجالون (وزن 6.7 كيلو)
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs text-sec-text mb-2 font-bold">طريقة التسعير / نمط القياس لبيع هذا المنتج:</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePricingModeChange('gallon')}
                    className={`py-3 px-2 rounded-xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      pricingMode === 'gallon'
                        ? 'border-honey bg-honey/10 text-honey shadow-sm'
                        : 'border-border-val bg-soft-card text-sec-text hover:border-honey/40'
                    }`}
                  >
                    <span className="text-xs">عسل بالجالون</span>
                    <span className="text-[9px] font-normal text-sec-text/80">وزن 6.7 كجم والوحدات المشتقة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePricingModeChange('weight')}
                    className={`py-3 px-2 rounded-xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      pricingMode === 'weight'
                        ? 'border-honey bg-honey/10 text-honey shadow-sm'
                        : 'border-border-val bg-soft-card text-sec-text hover:border-honey/40'
                    }`}
                  >
                    <span className="text-xs">منتج بالوزن</span>
                    <span className="text-[9px] font-normal text-sec-text/80">وحدة الأساس كيلو مع المشتقات</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePricingModeChange('piece')}
                    className={`py-3 px-2 rounded-xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      pricingMode === 'piece'
                        ? 'border-honey bg-honey/10 text-honey shadow-sm'
                        : 'border-border-val bg-soft-card text-sec-text hover:border-honey/40'
                    }`}
                  >
                    <span className="text-xs">منتج بالقطعة / العلبة</span>
                    <span className="text-[9px] font-normal text-sec-text/80">علبة أو قطعة منفردة غير مشتقة للوزن</span>
                  </button>
                </div>
              </div>

              {/* Conditional Fields based on pricingMode */}
              {pricingMode === 'gallon' && (
                <div className="space-y-4 pt-2">
                  <div className="bg-honey/5 border border-honey/20 rounded-xl p-3 text-xs leading-relaxed text-[#854d0e]">
                    الجالون هو وحدة القياس الأساسية لوزن العسل، ويتم احتساب جميع الأوزان والوحدات المشتقة (كيلو، نصف كيلو، ربع كيلو) بناءً على عدد الكيلوات في الجالون المحدد لهذا الصنف.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-sec-text mb-1.5 font-bold">وزن الجالون (كجم):</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        required
                        value={gallonWeightKg}
                        onChange={(e) => setGallonWeightKg(parseNormalizedFloat(e.target.value))}
                        className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-3.5 text-xs outline-none font-mono"
                      />
                      <span className="text-[9px] text-sec-text mt-1 block">الافتراضي هو 6.7 كيلو للجالون.</span>
                    </div>

                    <div>
                      <label className="block text-xs text-sec-text mb-1.5 font-bold">سعر بيع الجالون الكامل:</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={baseSalePrice || ''}
                        onChange={(e) => setBaseSalePrice(parseNormalizedFloat(e.target.value))}
                        className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-3.5 text-xs outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-sec-text mb-1.5 font-bold">تكلفة شراء الجالون الكامل:</label>
                      <input
                        type="number"
                        min="0"
                        value={baseCostPrice || ''}
                        onChange={(e) => setBaseCostPrice(parseNormalizedFloat(e.target.value))}
                        className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-3.5 text-xs outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {pricingMode === 'weight' && (
                <div className="space-y-4 pt-2">
                  <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl p-3 text-xs leading-relaxed text-[#1e40af]">
                    هذا المنتج يُباع بالوزن بأساس وحدة الكيلوجرام. يتم اشتقاق أسعار الوحدات الصغرى (نصف كيلو، ربع كيلو، 100 جرام) تلقائياً من سعر الكيلو.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-sec-text mb-1.5 font-bold">سعر بيع الكيلو:</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={baseSalePrice || ''}
                        onChange={(e) => setBaseSalePrice(parseNormalizedFloat(e.target.value))}
                        className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-3.5 text-xs outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-sec-text mb-1.5 font-bold">تكلفة شراء الكيلو:</label>
                      <input
                        type="number"
                        min="0"
                        value={baseCostPrice || ''}
                        onChange={(e) => setBaseCostPrice(parseNormalizedFloat(e.target.value))}
                        className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-3.5 text-xs outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {pricingMode === 'piece' && (
                <div className="space-y-4 pt-2">
                  <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-3 text-xs leading-relaxed text-[#166534]">
                    هذا المنتج يُباع بالقطعة أو بالعلبة الجاهزة كقطعة منفردة (مثال: علبة عسل صغيرة، قرص شمع، إلخ).
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-sec-text mb-1.5 font-bold">اسم وحدة الأساس (علبة / قطعة):</label>
                      <input
                        type="text"
                        required
                        value={formData.default_unit_name || 'علبة'}
                        onChange={(e) => handleBaseUnitNameChange(e.target.value)}
                        className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-3.5 text-xs outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-sec-text mb-1.5 font-bold">سعر بيع الوحدة:</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={baseSalePrice || ''}
                        onChange={(e) => setBaseSalePrice(parseNormalizedFloat(e.target.value))}
                        className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-3.5 text-xs outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-sec-text mb-1.5 font-bold">تكلفة شراء الوحدة:</label>
                      <input
                        type="number"
                        min="0"
                        value={baseCostPrice || ''}
                        onChange={(e) => setBaseCostPrice(parseNormalizedFloat(e.target.value))}
                        className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-3.5 text-xs outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Left Column: Units list and computed values */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Section 3: Sale units list */}
            <div className="bg-card-bg border border-border-val p-6 rounded-2xl shadow-sm space-y-4">
              <div className="border-b border-border-val pb-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-honey" />
                  <h3 className="text-sm font-black text-main-text">القسم الثالث: وحدات وتوزيع الأسعار</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (pricingMode === 'gallon') {
                      setSaleUnits(getDefaultUnitsForGallon(gallonWeightKg));
                    } else if (pricingMode === 'weight') {
                      setSaleUnits(getDefaultUnitsForWeightMode());
                    } else {
                      setSaleUnits(getDefaultUnitsForPiece(formData.default_unit_name || 'علبة'));
                    }
                  }}
                  className="text-[10px] text-honey hover:underline font-bold"
                >
                  إعادة ضبط للوحدات الافتراضية
                </button>
              </div>

              <p className="text-[11px] text-sec-text leading-relaxed">
                {pricingMode === 'gallon' 
                  ? `تظهر هنا أسعار الوحدات المشتقة والتكلفة المحسوبة تلقائياً وبدقة بناءً على وزن الجالون (${gallonWeightKg} كجم). يمكنك تمكينها للبيع أو اختيار الافتراضي منها للبيع السريع.`
                  : pricingMode === 'weight'
                  ? 'تظهر هنا أسعار الوحدات المشتقة والتكلفة المحسوبة تلقائياً وبدقة بناءً على الكيلو جرام. يمكنك تمكينها للبيع أو اختيار الافتراضي منها للبيع السريع.'
                  : 'تظهر هنا وحدات بيع هذا المنتج وأسعارها وتكاليفها. يمكنك تمكينها للبيع أو اختيار الافتراضي منها للبيع السريع.'}
              </p>

              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {saleUnits.map((unit, index) => {
                  const calculatedPrice = baseSalePrice * unit.conversion_factor;
                  const calculatedCost = baseCostPrice * unit.conversion_factor;
                  const calculatedProfit = calculatedPrice - calculatedCost;

                  return (
                    <div 
                      key={unit.localId || `unit-${index}`}
                      className={`border p-3.5 rounded-xl flex flex-col gap-3 transition-all ${
                        unit.enabled 
                          ? 'bg-soft-card border-border-val/60 shadow-sm' 
                          : 'bg-sec-bg/50 border-border-val/30 opacity-60'
                      }`}
                    >
                      {/* Name & Toggle controls */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={unit.enabled !== false}
                            onChange={(e) => {
                              const updated = [...saleUnits];
                              updated[index].enabled = e.target.checked;
                              // If disabled and was default, set another default
                              if (!e.target.checked && unit.is_default) {
                                updated[index].is_default = false;
                                const firstEnabled = updated.find(u => u.enabled);
                                if (firstEnabled) firstEnabled.is_default = true;
                              }
                              setSaleUnits(updated);
                            }}
                            className="w-4 h-4 accent-honey cursor-pointer"
                          />
                          
                          {unit.is_base_unit ? (
                            <span className="text-xs font-black text-honey bg-honey/10 px-2.5 py-0.5 rounded-md">
                              {unit.unit_name} (وحدة الأساس)
                            </span>
                          ) : (
                            <input
                              type="text"
                              value={unit.unit_name}
                              onChange={(e) => {
                                const updated = [...saleUnits];
                                updated[index].unit_name = e.target.value;
                                setSaleUnits(updated);
                              }}
                              className="bg-card-bg border border-border-val/60 text-xs font-bold text-main-text rounded-lg px-2 py-0.5 w-28 outline-none focus:border-honey"
                            />
                          )}
                        </div>

                        {unit.enabled && (
                          <label className="flex items-center gap-1.5 text-xs text-sec-text cursor-pointer select-none font-bold">
                            <input
                              type="radio"
                              name="default_sale_unit"
                              checked={unit.is_default}
                              onChange={() => {
                                setSaleUnits(prev => prev.map((u, i) => ({
                                  ...u,
                                  is_default: i === index
                                })));
                              }}
                              className="w-3.5 h-3.5 accent-honey cursor-pointer"
                            />
                            الوحدة الافتراضية
                          </label>
                        )}
                      </div>

                      {/* Math fields */}
                      <div className="grid grid-cols-3 gap-2 text-xs border-t border-border-val/20 pt-2 font-mono">
                        <div>
                          <span className="text-[10px] text-sec-text block">عامل الوزن:</span>
                          {unit.is_base_unit ? (
                            <span className="font-bold block mt-0.5 text-main-text">1.000</span>
                          ) : (
                            <input
                              type="text"
                              value={unit.conversion_factor}
                              onChange={(e) => {
                                const val = parseNormalizedFloat(normalizeDigits(e.target.value));
                                const updated = [...saleUnits];
                                updated[index].conversion_factor = isNaN(val) ? 0 : val;
                                setSaleUnits(updated);
                              }}
                              className="bg-card-bg border border-border-val/60 font-bold text-main-text rounded-md px-1 py-0.5 w-full text-center outline-none focus:border-honey"
                            />
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] text-sec-text block">سعر الوحدة:</span>
                          <span className="font-bold text-honey block mt-1">
                            {formatMoney(calculatedPrice, formData.default_currency || 'YER')}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-sec-text block">التكلفة والربح:</span>
                          <span className="font-bold text-sec-text/70 block mt-0.5 text-[10px]">
                            تكلفة: {formatNumber(calculatedCost)}
                          </span>
                          {calculatedProfit > 0 && (
                            <span className="font-black text-emerald-600 block text-[9px]">
                              ربح: +{formatNumber(calculatedProfit)}
                            </span>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  setSaleUnits(prev => [
                    ...prev,
                    { unit_name: 'وحدة مخصصة جديدة', conversion_factor: 1, is_base_unit: false, is_default: false, enabled: true }
                  ]);
                }}
                className="w-full py-2 border border-dashed border-border-val hover:border-honey text-sec-text hover:text-honey text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                إضافة وحدة بيع مخصصة يدوياً
              </button>
            </div>

          </div>

        </div>

        {/* Action Buttons Footer */}
        <div className="flex gap-3 justify-end pt-5 border-t border-border-val/60">
          <button
            type="button"
            onClick={() => setIsFormOpen(false)}
            className="bg-sec-bg hover:bg-side-active text-xs px-6 py-3 rounded-xl text-main-text font-bold cursor-pointer transition-colors border border-border-val"
          >
            تراجع وإلغاء
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={savingLoader}
            className="bg-honey hover:bg-honey-hover text-white font-black text-xs px-8 py-3 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 duration-200 shadow-md"
          >
            {savingLoader && <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />}
            <Save className="w-4 h-4" />
            حفظ وتثبيت الصنف بالملف
          </button>
        </div>

      </div>
    );
  }

  // STANDARD PRODUCTS GRID LIST VIEW
  return (
    <div className="space-y-6 fade-in pb-12 text-right">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card-bg p-5 rounded-2xl border border-border-val shadow-sm transition-colors duration-200">
        <div>
          <h2 className="text-xl font-black text-main-text flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-honey" />
            كتالوج ودليل أنواع العسل التجاري
          </h2>
          <p className="text-xs text-sec-text mt-1">كتالوج مرجعي لتسهيل وتسريع عمليات إدخال الفواتير والمبيعات اليومية بأساس الجالون.</p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="bg-honey hover:bg-honey-hover text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 select-none shadow-sm"
        >
          <Plus className="w-4 h-4 text-white font-bold" />
          إضافة صنف عسل جديد
        </button>
      </div>

      {/* Query search form */}
      <div className="flex items-center gap-3 bg-card-bg border border-border-val p-4 rounded-xl shadow-sm transition-colors duration-200">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث باسم نوع العسل أو بالتصنيف المخصص..."
            className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text placeholder-sec-text/75 text-xs py-2.5 pl-3 pr-9 rounded-xl outline-none transition-colors text-right"
          />
          <Search className="w-4 h-4 text-sec-text absolute right-3 top-1/2 -translate-y-1/2" />
        </div>

        <button 
          onClick={loadProducts}
          className="bg-sec-bg hover:bg-side-active p-2.5 rounded-xl text-main-text border border-border-val cursor-pointer transition-colors"
          title="إعادة جلب الأصناف"
        >
          <RefreshCw className="w-4 h-4 text-sec-text" />
        </button>
      </div>

      {errorMessage && (
        <div className="bg-danger-val/10 border border-danger-val/20 text-danger-val rounded-xl p-4 text-xs flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" />
          {errorMessage}
        </div>
      )}

      {/* Main catalogue grid lists */}
      {loading ? (
        <div className="text-center py-20">
          <div className="w-10 h-10 border-4 border-t-honey border-border-val rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-sec-text">جاري فحص وتصفح ملفات وأوعية العسل...</p>
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p, idx) => {
            const { units, notes: displayNotes, gallon_weight_kg, pricing_mode } = parseProductUnitsAndNotes(p.notes, p.default_unit_name || 'جالون');
            
            return (
              <div 
                key={`${p.id || 'prod'}-${idx}`}
                className="bg-card-bg border border-border-val p-5 rounded-2xl flex flex-col justify-between hover:border-honey/40 transition-all duration-200 relative group shadow-sm hover:shadow-md"
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    {p.is_active === false ? (
                      <span className="text-[9px] bg-red-500/10 border border-red-500/20 text-red-600 px-2 py-0.5 rounded-md font-black">
                        معطل مؤقتاً
                      </span>
                    ) : (
                      <span className="text-[9px] bg-sec-bg border border-border-val/60 text-sec-text px-2 py-0.5 rounded-md font-black">
                        {p.category || 'عسل طبيعي'}
                      </span>
                    )}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleToggleProductActive(p)}
                        className={`p-1 bg-soft-card rounded-lg border border-transparent hover:border-border-val/60 transition-all cursor-pointer opacity-80 group-hover:opacity-100 ${
                          p.is_active === false 
                            ? 'text-emerald-500 hover:text-emerald-600' 
                            : 'text-red-400 hover:text-red-500'
                        }`}
                        title={p.is_active === false ? "تنشيط الصنف" : "تعطيل الصنف المالي"}
                      >
                        {p.is_active === false ? <CheckCircle className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="text-sec-text hover:text-honey p-1 bg-soft-card rounded-lg border border-transparent hover:border-border-val/60 transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                        title="تعديل بيانات الصنف"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-black text-main-text mb-2 leading-snug">{p.product_name}</h3>
                  {displayNotes ? (
                    <p className="text-[10px] text-sec-text line-clamp-2 leading-relaxed mb-4">{displayNotes}</p>
                  ) : null}
                </div>

                {/* Pricing values */}
                <div className="pt-3 border-t border-border-val/50 mt-4 space-y-1.5 font-mono">
                  <div className="flex justify-between text-xs">
                    <span className="text-sec-text font-sans">نمط القياس:</span>
                    <strong className="text-honey font-black">
                      {pricing_mode === 'gallon' ? 'عسل بالجالون' : pricing_mode === 'weight' ? 'منتج بالوزن' : 'قطعة / علبة'}
                    </strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-sec-text font-sans font-bold">سعر الوحدة الافتراضية:</span>
                    <strong className="text-honey font-black">{formatMoney(Number(p.default_sales_price || 0), p.default_currency || 'YER')}</strong>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-sec-text font-sans">التكلفة الافتراضية:</span>
                    <span className="text-sec-text/60 font-bold">{formatMoney(Number(p.estimated_cost || 0), p.default_currency || 'YER')}</span>
                  </div>
                  
                  {/* Gallon weight if available */}
                  {pricing_mode === 'gallon' && (
                    <div className="flex justify-between text-[10px] text-sec-text/70 font-sans border-t border-border-val/20 pt-1">
                      <span>وزن الجالون المقدر:</span>
                      <span className="font-bold text-honey">{gallon_weight_kg || 6.7} كيلو جرام</span>
                    </div>
                  )}
                  <div className={`flex justify-between text-[10px] text-sec-text/70 font-sans ${pricing_mode !== 'gallon' ? 'border-t border-border-val/20 pt-1' : ''}`}>
                    <span>الوحدة القياسية الافتراضية:</span>
                    <span className="font-bold text-success-val">{p.default_unit_name || 'جالون'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 bg-card-bg rounded-2xl border border-border-val text-sec-text shadow-sm">
          <ShoppingBag className="w-12 h-12 mx-auto text-sec-text/40 mb-3" />
          <p className="text-xs">دليل الكاتلوج فارغ. يرجى الضغط على زر الإضافة لتأسيس قائمة أصناف عسل المتجر.</p>
        </div>
      )}

    </div>
  );
}
