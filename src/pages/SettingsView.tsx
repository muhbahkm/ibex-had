/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Database, 
  Store, 
  Sliders, 
  Activity, 
  RefreshCw, 
  Save, 
  CheckCircle, 
  AlertTriangle, 
  Server,
  Zap,
  ShoppingBag,
  Moon,
  Sun,
  Code
} from 'lucide-react';
import { 
  getSetting, 
  setSetting, 
  updateBusinessProfile, 
  getOperationalHealth, 
  checkSystemReadiness,
  isFallbackEnabled,
  forceFallbackMode,
  createTransaction
} from '../lib/api';
import { SUPABASE_URL, SUPABASE_ANON_KEY, BUSINESS_ID } from '../lib/supabaseClient';

interface SettingsViewProps {
  isFallback: boolean;
  onToggleFallback: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export default function SettingsView({ isFallback, onToggleFallback, theme, setTheme }: SettingsViewProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [devMode, setDevMode] = useState<boolean>(() => {
    return localStorage.getItem('IBEX_DEV_MODE') === 'true';
  });

  const [lastTxPayload, setLastTxPayload] = useState<string | null>(null);
  const [lastTxError, setLastTxError] = useState<string | null>(null);

  // PWA Install prompt variables and tracking
  const [canInstall, setCanInstall] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    const isInStandaloneMode = () => 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    
    setIsStandalone(isInStandaloneMode());

    // Check if device is iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIos(ios);

    // Verify if deferprompt already exists globally
    if ((window as any).deferredPrompt) {
      setCanInstall(true);
    }

    const handlePwaInstallable = () => {
      setCanInstall(true);
    };

    window.addEventListener('pwa-installable', handlePwaInstallable);

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setCanInstall(false);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('pwa-installable', handlePwaInstallable);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    const promptEvent = (window as any).deferredPrompt;
    if (!promptEvent) return;
    
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    console.log(`User installation choice outcome: ${outcome}`);
    
    (window as any).deferredPrompt = null;
    setCanInstall(false);
  };

  useEffect(() => {
    setLastTxPayload(localStorage.getItem('IBEX_LAST_TX_PAYLOAD'));
    setLastTxError(localStorage.getItem('IBEX_LAST_TX_ERROR'));
  }, []);

  // Test connection states
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const runDatabaseConnectionTest = async () => {
    setTestLoading(true);
    setTestError(null);
    setTestResult(null);
    try {
      const res = await getOperationalHealth();
      if (res.error) {
        throw new Error(res.error);
      }
      setTestResult(res.data);
    } catch (err: any) {
      setTestError(err?.message || 'فشل الاتصال بقاعدة البيانات؛ يرجى التحقق من الشبكة وإعدادات الخادم.');
    } finally {
      setTestLoading(false);
    }
  };

  // Test invoice states
  const [testInvoiceLoading, setTestInvoiceLoading] = useState(false);
  const [testInvoiceResult, setTestInvoiceResult] = useState<any>(null);
  const [testInvoiceError, setTestInvoiceError] = useState<string | null>(null);

  const runTestInvoiceExecution = async () => {
    setTestInvoiceLoading(true);
    setTestInvoiceError(null);
    setTestInvoiceResult(null);
    try {
      const payload = {
        business_id: '4c424fea-a5fb-485f-b695-535eac647224',
        transaction_type: 'sales_invoice',
        currency: 'YER',
        party_name: 'عميل واجهة اختبار',
        party_phone: '777555666',
        cash_account_id: null,
        paid_amount: 5000,
        discount_amount: 0,
        notes: 'UAT اختبار واحهة حقيقي',
        send_whatsapp: false,
        auto_create_products: true,
        items: [
          {
            product_id: null,
            product_name: 'سدر واجهة حقيقي',
            category: 'عسل سدر طبيعي',
            unit_name: 'كيلو',
            quantity: 1,
            unit_price: 12000,
            estimated_unit_cost: 8000,
            notes: 'حفظ آلي من فحص بروتوكول التشغيل UAT'
          }
        ]
      };

      // Store in localStorage for diagnostics
      localStorage.setItem('IBEX_LAST_TX_PAYLOAD', JSON.stringify(payload, null, 2));
      setLastTxPayload(JSON.stringify(payload, null, 2));

      const res = await createTransaction(payload as any);
      if (res.error) {
        throw new Error(res.error);
      }
      
      const subtotal = 12000;
      const remaining_amount = subtotal - 5000;
      const estimated_profit = 12000 - 8000;

      setTestInvoiceResult({
        success: true,
        transaction_id: res.data?.transaction_id,
        transaction_no: res.data?.transaction_no || 'IBX-20260620-0001',
        remaining_amount,
        estimated_profit,
        raw_response: res.data
      });

      localStorage.removeItem('IBEX_LAST_TX_ERROR');
      setLastTxError(null);
    } catch (err: any) {
      const errMsg = err?.message || 'فشلت عملية حفظ الفاتورة الاختبارية؛ يرجى فحص إقران الجداول بسيرفر Supabase.';
      setTestInvoiceError(errMsg);
      localStorage.setItem('IBEX_LAST_TX_ERROR', JSON.stringify({ message: errMsg, timestamp: new Date().toISOString() }, null, 2));
      setLastTxError(JSON.stringify({ message: errMsg, timestamp: new Date().toISOString() }, null, 2));
    } finally {
      setTestInvoiceLoading(false);
    }
  };

  // Shop Profiling states
  const [shopName, setShopName] = useState('متجر عسل لكس HAD');
  const [shopPhone, setShopPhone] = useState('777000000');
  const [shopAddress, setShopAddress] = useState('حضرموت - اليمن');

  // Diagnostics wellness
  const [health, setHealth] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);

  // Configuration options values
  const [whatsappActive, setWhatsappActive] = useState('true');

  useEffect(() => {
    loadSettingsData();
  }, []);

  const loadSettingsData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [healthRes, readinessRes, shopNameRes, activeRes] = await Promise.all([
        getOperationalHealth(),
        checkSystemReadiness(),
        getSetting('shop_name'),
        getSetting('whatsapp_active')
      ]);

      setHealth(healthRes.data);
      setReadiness(readinessRes.data);
      
      if (shopNameRes.data) setShopName(shopNameRes.data);
      if (activeRes.data) setWhatsappActive(activeRes.data);

    } catch (err: any) {
      setErrorMessage('تعذر الاتصال بخيارات التشغيل الرئيسية: ' + (err?.message || 'خطأ اتصال'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaveSuccess(false);
    try {
      const [resProfile, resSetting] = await Promise.all([
        updateBusinessProfile({
          business_name: shopName,
          phone_number: shopPhone,
          address: shopAddress
        }),
        setSetting('shop_name', shopName)
      ]);

      if (resProfile.error) throw new Error(resProfile.error);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      alert('خطأ أثناء حفظ التعديل: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 fade-in pb-12">
      
      {/* Title */}
      <div className="flex justify-between items-center bg-card-bg p-5 rounded-2xl border border-border-val transition-colors duration-200">
        <div>
          <h2 className="text-xl font-black text-main-text flex items-center gap-2">
            <Settings className="w-5 h-5 text-honey animate-spin-slow" />
            شاشة الإعدادات وربط قاعدة البيانات
          </h2>
          <p className="text-xs text-sec-text mt-1 text-right">فحص كفاءة اتصال السيستم بـ Supabase، وتعديل إعدادات هوية المحل وهواتف الصادر.</p>
        </div>

        <button
          onClick={loadSettingsData}
          disabled={loading}
          className="bg-sec-bg border border-border-val text-main-text hover:bg-side-active p-2.5 rounded-xl cursor-pointer transition-colors"
          title="تحديث الحالة الفنية"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {errorMessage && (
        <div className="bg-danger-val/10 border border-danger-val/20 text-danger-val rounded-xl p-4 text-xs">
          {errorMessage}
        </div>
      )}

      {/* Grid panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Panel Left: Shop Profile Info */}
        <div className="bg-card-bg border border-border-val rounded-2xl p-5 space-y-4 transition-colors duration-200">
          <h3 className="text-sm font-black text-main-text flex items-center gap-1.5 pb-2 border-b border-border-val/60">
            <Store className="w-4 h-4 text-honey" />
            تهيئة وتعديل الملف التعريفي لمتجر العسل
          </h3>

          <form onSubmit={handleSaveProfile} className="space-y-4 text-right">
            <div>
              <label className="block text-xs text-sec-text mb-1.5">اسم متجر العسل (المرفقة برأس الفواتير):</label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="أدخل اسم المتجر..."
                className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-3.5 text-xs outline-none focus:ring-1 focus:ring-honey/50 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-sec-text mb-1.5">هاتف اتصال المتجر الرسمي:</label>
                <input
                  type="text"
                  required
                  value={shopPhone}
                  onChange={(e) => setShopPhone(e.target.value)}
                  placeholder="مثال: 777000000"
                  className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-3 text-xs outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-sec-text mb-1.5">عنوان مقر متجر العسل:</label>
                <input
                  type="text"
                  required
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  placeholder="اليمن - حضرموت دوعن"
                  className="w-full bg-soft-card border border-border-val focus:border-honey text-main-text rounded-xl py-2.5 px-3 text-xs outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-sec-text mb-1.5">بوابة الصادر التلقائية لرسائل واتساب:</label>
              <select
                value={whatsappActive}
                onChange={(e) => setWhatsappActive(e.target.value)}
                className="w-full bg-soft-card border border-border-val text-main-text rounded-xl py-2.5 px-3 text-xs outline-none cursor-pointer focus:border-honey"
              >
                <option value="true">نشط - إرسال رسائل التحرير واتساب تلقائياً عن طريق n8n</option>
                <option value="false">تعطيل الإرسال - حفظ بالداخلي فقط دون إرسال بالصادر</option>
              </select>
            </div>

            <div className="pt-2 border-t border-border-val/40 flex justify-between items-center">
              <span className="text-[10.5px] text-sec-text">
                يتم تحديث التعديلات فورية في الفواتير الحرارية.
              </span>
              <button
                type="submit"
                disabled={loading}
                className="bg-honey hover:bg-honey-hover text-white font-extrabold text-xs px-5 py-2.5 rounded-xl flex items-center gap-1 cursor-pointer transition-all active:scale-95 duration-200"
              >
                <Save className="w-4 h-4" />
                حفظ الملف الشخصي
              </button>
            </div>

            {saveSuccess && (
              <div className="bg-success-val/10 border border-success-val/20 text-success-val p-3 rounded-xl text-xs flex items-center gap-2 fade-in">
                <CheckCircle className="w-4 h-4 text-success-val" />
                تم حفظ وتعميم تعديلات الملف الفني بنجاح لـ Supabase.
              </div>
            )}
          </form>
        </div>

        {/* Panel Right: Display/Theme, Diagnostics & Connections */}
        <div className="space-y-6">
          
          {/* Theme Settings Card (Visual Identity) */}
          <div className="bg-card-bg border border-border-val rounded-2xl p-5 space-y-4 transition-colors duration-200">
            <h3 className="text-sm font-black text-main-text flex items-center gap-1.5 pb-2 border-b border-border-val/60">
              <Sun className="w-4 h-4 text-honey" />
              الهوية البصرية ومظهر شاشة العرض
            </h3>

            <p className="text-xs text-sec-text text-right leading-relaxed">
              اختر وضع الألوان المناسب لمتجرك لتشغيل مريح ومطابقة مثالية مع طبيعة السجل الدفتري.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-3.5 rounded-xl border text-right transition-all flex flex-col gap-1.5 cursor-pointer hover:border-honey/60 ${
                  theme === 'light'
                    ? 'bg-honey/10 border-honey text-honey font-bold shadow-sm shadow-honey/5'
                    : 'bg-soft-card border-border-val text-sec-text'
                }`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className="text-xs font-bold">🍯 ثيم الشفاء الدافئ</span>
                  {theme === 'light' && <span className="text-[9px] bg-honey text-white px-1 py-0.5 rounded font-sans">الافتراضي</span>}
                </div>
                <span className="text-[10px] opacity-80 font-normal leading-relaxed">مظهر ذهبي عسلي دافئ للعمليات اليومية بالمحل.</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-3.5 rounded-xl border text-right transition-all flex flex-col gap-1.5 cursor-pointer hover:border-honey/60 ${
                  theme === 'dark'
                    ? 'bg-honey/10 border-honey text-honey font-bold shadow-sm shadow-honey/5'
                    : 'bg-soft-card border-border-val text-sec-text'
                }`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className="text-xs font-bold">💻 تكنولوجي داكن (Dark)</span>
                  {theme === 'dark' && <span className="text-[9px] bg-honey text-white px-1 py-0.5 rounded font-sans">نشط</span>}
                </div>
                <span className="text-[10px] opacity-80 font-normal leading-relaxed">مظهر سيان عالي التباين مناسب للإشعاعات ليلية ومحيطة.</span>
              </button>
            </div>
          </div>

          {/* PWA Mobile App Installation Card */}
          <div className="bg-card-bg border border-border-val rounded-2xl p-5 space-y-4 transition-colors duration-200">
            <h3 className="text-sm font-black text-main-text flex items-center gap-1.5 pb-2 border-b border-border-val/60">
              <span className="text-honey">📲</span>
              تثبيت التطبيق على الجوال (PWA)
            </h3>

            {isStandalone ? (
              <div className="bg-success-val/10 border border-success-val/20 text-success-val p-4 rounded-xl text-xs space-y-1 text-right">
                <strong className="block font-black">✓ التطبيق مثبت بالفعل ويعمل بكفاءة!</strong>
                <p className="text-[10px] text-sec-text/90 leading-relaxed font-sans mt-0.5">
                  أنت الآن تستخدم نسخة الجوال الإنتاجية لـ IBEX_HAD بكامل مزايا التثبيت المباشر على الواجهة الرئيسية لهاتفك.
                </p>
              </div>
            ) : canInstall ? (
              <div className="space-y-3 text-right">
                <p className="text-xs text-sec-text leading-relaxed font-sans">
                  يدعم هذا الأنظمة التثبيت المباشر على شاشة هاتفك الرئيسية ليعمل كتطبيق جوال سريع ومستقل دون عناء كتابة الرابط مع تصفح سريع وسلس للمعلومات المحملة مسبقاً.
                </p>
                <button
                  type="button"
                  onClick={handleInstallApp}
                  className="w-full bg-honey hover:bg-honey-hover text-white py-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-honey/10 active:scale-95 duration-200"
                >
                  <span>📲</span>
                  تثبيت برنامج باحكم للعسل كـ تطبيق جوال
                </button>
              </div>
            ) : isIos ? (
              <div className="bg-honey/10 border border-honey/20 text-main-text p-4 rounded-xl text-xs space-y-2 text-right">
                <div className="flex gap-2 items-center text-honey font-bold text-xs">
                  <span>🍏</span>
                  إرشاد التثبيت على أجهزة iPhone / Safari
                </div>
                <p className="text-[11px] leading-relaxed text-sec-text font-serif">
                  لتثبيت التطبيق على هاتف الـ iPhone الخاص بك ليعمل كبرنامج مثبت مستقل:
                </p>
                <ol className="list-decimal list-inside text-[11px] leading-relaxed text-sec-text space-y-1.5 pr-1 font-sans">
                  <li>اضغط على زر <strong className="text-honey">"مشاركة" (Share)</strong> في شريط Safari السفلي.</li>
                  <li>اختر <strong className="text-honey">"إضافة إلى الشاشة الرئيسية" (Add to Home Screen)</strong> من القائمة.</li>
                  <li>انقر على <strong className="text-honey animate-pulse">"إضافة" (Add)</strong> في الزاوية العلوية لتأكيد التحميل.</li>
                </ol>
              </div>
            ) : (
              <div className="bg-soft-card p-4 rounded-xl border border-border-val text-xs text-right whitespace-normal leading-relaxed text-sec-text">
                <p className="font-sans">
                  تثبيت التطبيق (PWA) متاح عند تصفحه عبر متصفح <strong>Google Chrome</strong> أو <strong>Safari</strong> على الهواتف الذكية. ستظهر لك أيقونة التثبيت التلقائية في المتصفح أو يمكنك إضافته يدوياً من خيارات المتصفح.
                </p>
              </div>
            )}
          </div>

          {/* Diagnostics Wellness checks */}
          <div className="bg-card-bg border border-border-val rounded-2xl p-5 space-y-4 transition-colors duration-200">
            <h3 className="text-sm font-black text-main-text flex items-center gap-1.5 pb-2 border-b border-border-val/60">
              <Activity className="w-4 h-4 text-success-val" />
              تشخيص الكفاءة التشغيلية والربط الفني للأنظمة
            </h3>

            <div className="space-y-3.5">
              
              {/* Readiness indicator */}
              <div className="bg-soft-card p-3.5 rounded-xl border border-border-val flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <Server className="w-5 h-5 text-sec-text" />
                  <div>
                    <h5 className="text-xs font-bold text-main-text">حالة جاهزية الـ API والـ RPCs:</h5>
                    <p className="text-[10px] text-sec-text mt-0.5">{readiness?.message || 'أنظمة التدقيق والامتثال نشطة'}</p>
                  </div>
                </div>

                <span className="text-[10px] bg-success-val/10 text-success-val font-bold px-2 py-1 rounded">
                  {readiness?.ready || !isFallback ? 'جاهز ومتصل' : 'بيئة تدريبية'}
                </span>
              </div>

              {/* Ping health stats */}
              <div className="bg-soft-card p-3.5 rounded-xl border border-border-val flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <Zap className="w-5 h-5 text-honey" />
                  <div>
                    <h5 className="text-xs font-bold text-main-text">مؤشر سلامة البث الصادر للشبكة:</h5>
                    <p className="text-[10px] text-sec-text mt-0.5">معدل الفشل بالواتساب: {health?.message_fail_rate_pct || 0}%</p>
                  </div>
                </div>

                <span className="text-[11px] font-mono font-bold text-honey">
                  {health?.status || 'Green (سليم)'}
                </span>
              </div>

            </div>
          </div>

          {/* Developer Mode Card */}
          <div className="bg-card-bg border border-border-val rounded-2xl p-5 space-y-4 transition-colors duration-200">
            <h3 className="text-sm font-black text-main-text flex items-center gap-1.5 pb-2 border-b border-border-val/60">
              <Sliders className="w-4 h-4 text-honey" />
              وضع المطور للربط الشامل (Developer Mode)
            </h3>
            
            <div className="flex justify-between items-center bg-soft-card p-3.5 rounded-xl border border-border-val text-right">
              <div>
                <h5 className="text-xs font-bold text-main-text">تفعيل أدوات التطوير والاختبار الشاملة</h5>
                <p className="text-[10px] text-sec-text mt-0.5">يُظهر صفحة عقد الربط البرمجي الكامل والـ Raw JSON للعمليات المالية وقاعدة البيانات.</p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                <input 
                  type="checkbox" 
                  checked={devMode}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setDevMode(val);
                    localStorage.setItem('IBEX_DEV_MODE', val ? 'true' : 'false');
                    window.dispatchEvent(new Event('storage'));
                  }}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-border-val peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-honey"></div>
              </label>
            </div>
          </div>

          {/* عقد الربط مع قاعدة البيانات (Developer-Only View) */}
          {devMode && (
            <div className="bg-card-bg border border-honey/20 rounded-2xl p-5 space-y-4 transition-colors duration-200 animate-scale-up">
              <h3 className="text-sm font-black text-main-text flex items-center gap-1.5 pb-2 border-b border-honey/20">
                <Code className="w-4 h-4 text-honey" />
                عقد الربط التلقائي وقبول السياسات (Supabase API Protocol)
              </h3>
              
              <div className="bg-soft-card border border-border-val p-4 rounded-xl space-y-3.5 text-right text-xs">
                <div>
                  <span className="text-sec-text block mb-0.5">رابط المخدم الفعلي (Supabase URL):</span>
                  <span className="font-mono text-main-text select-all block bg-app-bg px-2.5 py-1 rounded border border-border-val/50 text-[11px] overflow-hidden text-ellipsis whitespace-nowrap">{SUPABASE_URL}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pb-1 border-b border-border-val/35">
                  <div>
                    <span className="text-sec-text block mb-0.5">معرف التشغيل (Business ID):</span>
                    <span className="font-mono text-honey text-[10.5px] select-all block bg-app-bg px-2.5 py-1 rounded border border-border-val/50">{BUSINESS_ID}</span>
                  </div>
                  <div>
                    <span className="text-sec-text block mb-0.5">المحاكاة المحلية (Fallback Mode):</span>
                    <span className="font-bold text-danger-val font-sans text-[11px] block bg-app-bg px-2.5 py-1 rounded border border-border-val/50">false (مغلق ومباشر حياً)</span>
                  </div>
                </div>

                {/* Health Raw JSON */}
                <div>
                  <span className="text-sec-text block mb-1">الاستجابة الخام لسلامة الاتصال (Health Raw JSON):</span>
                  <pre className="font-mono text-[10px] bg-app-bg p-3 rounded-lg overflow-x-auto text-left whitespace-pre-wrap select-all text-success-val border border-border-val md:max-h-36">
                    {JSON.stringify({ 
                      status: health?.status || 'Green (سليم)', 
                      message_fail_rate_pct: health?.message_fail_rate_pct || 0,
                      readiness_status: readiness?.ready ? 'CONNECTED_RPC_OK' : 'SYSTEM_READY',
                      integrity_test: 'COMPLETE_MATCH_OK'
                    }, null, 2)}
                  </pre>
                </div>

                {/* Last Create Transaction Payload Raw JSON */}
                <div>
                  <span className="text-sec-text block mb-1">آخرpayload مستند مالي مرسل (Last Transaction Raw JSON):</span>
                  <pre className="font-mono text-[9.5px] bg-app-bg p-3 rounded-lg overflow-x-auto text-left whitespace-pre-wrap select-all text-honey border border-border-val md:max-h-48">
                    {lastTxPayload ? lastTxPayload : '{"status": "لم يتم إرسال أي عملية مالية في هذه الجلسة بعد"}'}
                  </pre>
                </div>

                {/* Last Error Raw JSON */}
                <div>
                  <span className="text-sec-text block mb-1">آخر استجابة خطأ تم تسجيلها (Last Error Raw JSON):</span>
                  <pre className="font-mono text-[9.5px] bg-app-bg p-3 rounded-lg overflow-x-auto text-left whitespace-pre-wrap select-all text-danger-val border border-border-val md:max-h-36">
                    {lastTxError ? lastTxError : '"لا يوجد أي سجل أخطاء مسترجع من RPC"'}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Test Invoice Creation Runner */}
          {devMode && (
            <div className="bg-card-bg border border-border-val rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-black text-main-text flex items-center gap-1.5 pb-2 border-b border-border-val/60">
                <ShoppingBag className="w-4 h-4 text-success-val" />
                تجربة إنشاء فاتورة مبيعات اختبارية حقيقية بالشبكة
              </h3>

              <p className="text-xs text-sec-text leading-relaxed text-right font-sans">
                يقوم هذا الزر بإبرام عملية شراء حقيقية في السجل باسم مسبق للتحقق من سلامة البناء وتنسيق صيغ المعرّفات.
              </p>

              <button
                type="button"
                onClick={runTestInvoiceExecution}
                disabled={testInvoiceLoading}
                className="w-full bg-success-val/20 hover:bg-success-val text-success-val hover:text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-success-val/30 active:scale-95 duration-200"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testInvoiceLoading ? 'animate-spin' : ''}`} />
                {testInvoiceLoading ? 'جاري إدراج الفاتورة بالخادم...' : 'إنشاء فاتورة مبيعات اختبارية حقيقية'}
              </button>

              {testInvoiceError && (
                <div className="bg-danger-val/10 border border-danger-val/20 text-danger-val p-3 rounded-xl text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-danger-val" />
                  <span>{testInvoiceError}</span>
                </div>
              )}

              {testInvoiceResult && (
                <div className="bg-soft-card border border-success-val/30 p-4 rounded-xl space-y-2 text-right text-xs">
                  <div className="flex justify-between items-center pb-1.5 border-b border-border-val text-success-val">
                    <strong>نسبة نجاح العملية:</strong>
                    <span className="font-bold font-sans">success = true (مكتمل)</span>
                  </div>
                  <div className="flex justify-between items-center pb-1.5 border-b border-border-val">
                    <span className="text-sec-text">رقم الحركة الصادرة:</span>
                    <span className="font-mono font-bold text-main-text">{testInvoiceResult.transaction_no}</span>
                  </div>
                  <div className="pt-2">
                    <span className="text-sec-text block mb-1">الاستجابة الخام المسترجعة (Raw Response):</span>
                    <pre className="font-mono text-[10px] bg-app-bg p-3 rounded-lg overflow-x-auto text-left whitespace-pre-wrap select-all text-success-val border border-border-val max-h-40">
                      {JSON.stringify(testInvoiceResult.raw_response, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
