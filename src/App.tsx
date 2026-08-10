/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Database, 
  ShieldAlert, 
  Calendar,
  Clock,
  LogOut,
  CheckCircle2,
  AlertOctagon,
  Settings,
  HelpCircle,
  TrendingUp,
  Receipt,
  PlusCircle,
  Users,
  Wallet,
  Menu,
  LayoutDashboard,
  ShoppingBag,
  MessageSquare,
  BarChart3,
  Sparkles,
  Grid,
  ClipboardList,
  FolderOpen
} from 'lucide-react';
import { 
  isFallbackEnabled, 
  forceFallbackMode, 
  getWhatsappQueue,
  getSetting,
  setSetting
} from './lib/api';

// Supabase client and auth login screen
import { supabase } from './lib/supabaseClient';
import LoginScreen from './components/LoginScreen';

// Components
import Sidebar from './components/Sidebar';
import CustomerDetailModal from './components/CustomerDetailModal';
import TransactionDetailModal from './components/TransactionDetailModal';

// Pages/Views
import DashboardView from './pages/DashboardView';
import NewTransactionView from './pages/NewTransactionView';
import TransactionsView from './pages/TransactionsView';
import CustomersView from './pages/CustomersView';
import ProductsView from './pages/ProductsView';
import WhatsappQueueView from './pages/WhatsappQueueView';
import ReportsView from './pages/ReportsView';
import SettingsView from './pages/SettingsView';
import CustomerOrdersView from './pages/CustomerOrdersView';
import MediaLibraryView from './pages/MediaLibraryView';

import brandLogo from './assets/bahkm-honey-logo-header-ready.png';

export default function App() {
  // Auth Session States
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);

  // Helper to ensure a matching user profile exists in ibex_had_users with role 'admin'
  const ensureUserInDatabase = async (user: any) => {
    if (!user) return;
    try {
      const email = user.email;
      const uid = user.id;
      
      const { data: existingUser, error: checkError } = await supabase
        .from('ibex_had_users')
        .select('id, role')
        .eq('auth_user_id', uid)
        .maybeSingle();
        
      if (checkError) {
        console.warn('Error checking user in database:', checkError);
      }
      
      if (!existingUser) {
        console.log('User not found in ibex_had_users. Registering user profile...');
        const { error: insertError } = await supabase
          .from('ibex_had_users')
          .insert({
            business_id: '4c424fea-a5fb-485f-b695-535eac647224',
            auth_user_id: uid,
            full_name: user.user_metadata?.full_name || email?.split('@')[0] || 'مدير النظام',
            email: email || null,
            role: 'admin',
            is_active: true
          });
          
        if (insertError) {
          console.error('Failed to register user in ibex_had_users:', insertError);
        } else {
          console.log('User registered successfully in ibex_had_users');
        }
      } else {
        console.log('User already registered in ibex_had_users:', existingUser.id);
        if (existingUser.role !== 'admin') {
          await supabase
            .from('ibex_had_users')
            .update({ role: 'admin' })
            .eq('auth_user_id', uid);
        }
      }
    } catch (err) {
      console.error('ensureUserInDatabase failed:', err);
    }
  };

  // Initialize and subscribe to Auth states
  useEffect(() => {
    // Intercept uncaught fetch / network errors to prevent application crashes and frame interruption
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonMsg = event?.reason?.message || String(event?.reason || '');
      if (reasonMsg.toLowerCase().includes('fetch') || reasonMsg.toLowerCase().includes('failed to fetch') || reasonMsg.toLowerCase().includes('network')) {
        console.warn('Network fetch rejection intercepted gracefully:', event.reason);
        event.preventDefault(); // Squelch standard unhandled promise rejection error propagation
      }
    };

    const handleGlobalError = (event: ErrorEvent) => {
      const errorMsg = event?.message || '';
      if (errorMsg.toLowerCase().includes('fetch') || errorMsg.toLowerCase().includes('failed to fetch') || errorMsg.toLowerCase().includes('network')) {
        console.warn('Network fetch error intercepted gracefully:', event.error);
        event.preventDefault(); // Squelch standard error boundary trigger for transient network drops
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleGlobalError);

    // 1. Get initial active session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setCurrentUser(initialSession?.user || null);
      setLoadingAuth(false);
      if (initialSession?.user) {
        ensureUserInDatabase(initialSession.user);
      }
    }).catch(err => {
      console.error("Failed to fetch initial session:", err);
      setLoadingAuth(false);
    });

    // 2. Listen to state changes reactively
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setCurrentUser(currentSession?.user || null);
      setLoadingAuth(false);
      if (currentSession?.user) {
        ensureUserInDatabase(currentSession.user);
      }
    });

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleGlobalError);
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      setLoadingAuth(true);
      await supabase.auth.signOut();
      setSession(null);
      setCurrentUser(null);
    } catch (err) {
      console.error("Failed to sign out:", err);
    } finally {
      setLoadingAuth(false);
    }
  };

  // Navigation Routing selector state
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  
  // Real-time ticking clock state
  const [timeOffset, setTimeOffset] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  // More Actions menu modal state
  const [showMoreActionsMenu, setShowMoreActionsMenu] = useState<boolean>(false);
  
  // Theme selection state (light/dark)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('IBEX_THEME') as 'light' | 'dark') || 'light';
  });

  // Sync clock drift with container's precise NTP time via Date header
  useEffect(() => {
    const syncTimeWithServer = async () => {
      try {
        const start = Date.now();
        // Append Cache Buster to ensure we get a fresh, un-cached response indicating actual exact server time
        const response = await fetch('/index.html?_t=' + start, { method: 'GET' });
        const serverDateStr = response.headers.get('Date');
        if (serverDateStr) {
          const serverTime = new Date(serverDateStr).getTime();
          const latency = (Date.now() - start) / 2;
          const correctedServerTime = serverTime + latency;
          const calculatedOffset = correctedServerTime - Date.now();
          setTimeOffset(calculatedOffset);
        }
      } catch (err) {
        console.warn("Failed to synchronize with server NTP time, falling back to local system clock:", err);
      }
    };

    syncTimeWithServer();
  }, []);

  // Ticking hook with optional server-synced time offset
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date(Date.now() + timeOffset));
    }, 1000);
    return () => clearInterval(clockTimer);
  }, [timeOffset]);

  // Connection states (Supabase offline protection)
  const [isFallback, setIsFallback] = useState<boolean>(isFallbackEnabled());
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // WhatsApp count for Sidebar badges
  const [pendingWhatsappCount, setPendingWhatsappCount] = useState<number>(0);

  // Global overlay Modals state
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Success notifications banners
  const [flashMessage, setFlashMessage] = useState<{ text: string; sub?: string } | null>(null);

  // Prefilled transaction data state for cross-modular deep navigation
  const [prefilledTrxData, setPrefilledTrxData] = useState<any>(null);
  
  // Trigger table reloads inside children views
  const [refreshSeed, setRefreshSeed] = useState<number>(0);

  // Currency exchange rates relative to YER
  const [sarRate, setSarRate] = useState<number>(() => {
    const saved = localStorage.getItem('IBEX_SAR_RATE');
    return saved ? parseFloat(saved) : 410;
  });
  const [usdRate, setUsdRate] = useState<number>(() => {
    const saved = localStorage.getItem('IBEX_USD_RATE');
    return saved ? parseFloat(saved) : 1530;
  });
  const [isUpdatingRates, setIsUpdatingRates] = useState<boolean>(false);

  const [showRatesEditor, setShowRatesEditor] = useState<boolean>(false);
  const [sarInputVal, setSarInputVal] = useState<string>(sarRate.toString());
  const [usdInputVal, setUsdInputVal] = useState<string>(usdRate.toString());

  // Keep inputs in sync when system values load
  useEffect(() => {
    setSarInputVal(sarRate.toString());
  }, [sarRate]);

  useEffect(() => {
    setUsdInputVal(usdRate.toString());
  }, [usdRate]);

  // Sync exchange rates from DB when online
  useEffect(() => {
    const fetchRatesFromSettings = async () => {
      if (!isOnline || isFallback) return;
      try {
        const { data: sarVal } = await getSetting('sar_rate_to_yer');
        const { data: usdVal } = await getSetting('usd_rate_to_yer');
        if (sarVal) {
          const parsed = parseFloat(sarVal);
          if (!isNaN(parsed) && parsed > 0) {
            setSarRate(parsed);
            localStorage.setItem('IBEX_SAR_RATE', parsed.toString());
          }
        }
        if (usdVal) {
          const parsed = parseFloat(usdVal);
          if (!isNaN(parsed) && parsed > 0) {
            setUsdRate(parsed);
            localStorage.setItem('IBEX_USD_RATE', parsed.toString());
          }
        }
      } catch (e) {
        console.warn('Failed to load online exchange rates:', e);
      }
    };
    fetchRatesFromSettings();
  }, [isOnline, isFallback]);

  const handleSaveRates = async (newSar: number, newUsd: number) => {
    setIsUpdatingRates(true);
    setSarRate(newSar);
    setUsdRate(newUsd);
    localStorage.setItem('IBEX_SAR_RATE', newSar.toString());
    localStorage.setItem('IBEX_USD_RATE', newUsd.toString());

    // Dispatch custom event to notify listening views immediately
    window.dispatchEvent(new CustomEvent('ibex_rates_updated', { detail: { sarRate: newSar, usdRate: newUsd } }));

    if (isOnline && !isFallback) {
      try {
        await Promise.all([
          setSetting('sar_rate_to_yer', newSar.toString()),
          setSetting('usd_rate_to_yer', newUsd.toString())
        ]);
        triggerFlash('تم حفظ وتعميم أسعار الصرف بنجاح', 'تمت مزامنتها مع السيرفر السحابي.');
      } catch (e: any) {
        console.error('Failed to sync setting to supabase:', e);
        triggerFlash('تم حفظ أسعار الصرف محلياً', 'فشلت المزامنة مع السيرفر، تم الحفظ محلياً على الجوال.');
      }
    } else {
      triggerFlash('تم حفظ أسعار الصرف محلياً', 'سيتم استخدامها في تحويل فواتير النظام الحالية.');
    }
    setIsUpdatingRates(false);
  };

  // Sync theme with body element classes
  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
    } else {
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
    }
    localStorage.setItem('IBEX_THEME', theme);
  }, [theme]);

  // Poll whatsapp pending items for the badge count
  useEffect(() => {
    fetchPendingCount();
    const timer = setInterval(fetchPendingCount, 15000); // Poll every 15s
    return () => clearInterval(timer);
  }, [isFallback]);

  const fetchPendingCount = async () => {
    try {
      const res = await getWhatsappQueue();
      if (res.data) {
        const count = res.data.filter((msg: any) => msg.status === 'pending').length;
        setPendingWhatsappCount(count);
      }
    } catch {
      // Squelch errors quietly during poll
    }
  };

  const handleToggleFallback = () => {
    const nextMode = !isFallback;
    forceFallbackMode(nextMode);
    setIsFallback(nextMode);
    
    // Dispatch instant visual feedback
    triggerFlash(
      nextMode ? 'تم تفعيل وضع محاكاة الكاش التدريبي' : 'تم الالتزام والربط بقاعدة بيانات المتجر الحية',
      nextMode ? 'تقوم الآن بحفظ القيود داخلياً دون تعديل السيرفر' : 'يتم الحفظ والمطابقة مع سحابة Supabase'
    );
  };

  const triggerFlash = (text: string, sub?: string) => {
    setFlashMessage({ text, sub });
    setTimeout(() => setFlashMessage(null), 5000);
  };

  const handleTransactionCreated = (id: string, no: string) => {
    // Go to general transactions register
    setCurrentTab('transactions');
    setRefreshSeed(prev => prev + 1);
    
    // Instantly launch details view for printing/WhatsApping
    setSelectedTransactionId(id);

    triggerFlash(
      `تم إصدار وحفظ الفاتورة رقم ${no} بنجاح!`,
      `أدرجت القيود المالية والصندوق وصدر إشعار بانتظار واتساب.`
    );
  };

  // Render view controller based on chosen menu tab
  const renderViewContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardView 
            onSelectTrx={(id) => setSelectedTransactionId(id)}
            onSelectCustomer={(id) => setSelectedCustomerId(id)}
            onNavigateToTrx={() => setCurrentTab('new-trx')}
          />
        );
      
      case 'new-trx':
        return (
          <NewTransactionView 
            onSuccess={handleTransactionCreated}
            onCancel={() => {
              setCurrentTab('dashboard');
              setPrefilledTrxData(null);
            }}
            prefilledData={prefilledTrxData}
            clearPrefilledData={() => setPrefilledTrxData(null)}
            sarRate={sarRate}
            usdRate={usdRate}
          />
        );

      case 'transactions':
        return (
          <TransactionsView 
            onSelectTrx={(id) => setSelectedTransactionId(id)}
            refreshTrigger={refreshSeed}
          />
        );

      case 'customers':
        return (
          <CustomersView 
            onSelectCustomer={(id) => setSelectedCustomerId(id)}
            onPrefillTransaction={(data) => {
              setPrefilledTrxData(data);
              setCurrentTab('new-trx');
            }}
          />
        );

      case 'products':
        return <ProductsView />;

      case 'whatsapp':
        return <WhatsappQueueView />;

      case 'reports':
        return <ReportsView />;

      case 'settings':
        return (
          <SettingsView 
            isFallback={isFallback}
            onToggleFallback={handleToggleFallback}
            theme={theme}
            setTheme={setTheme}
          />
        );

      case 'orders':
        return (
          <CustomerOrdersView 
            onPrefillTransaction={(data) => {
              setPrefilledTrxData(data);
              setCurrentTab('new-trx');
            }}
          />
        );

      case 'media_library':
        return (
          <MediaLibraryView 
            currentUser={currentUser}
            onSelectCustomer={(id) => setSelectedCustomerId(id)}
            onSelectTrx={(id) => setSelectedTransactionId(id)}
          />
        );

      default:
        return (
          <div className="text-center py-24 text-sec-text">
            <h4 className="font-bold text-sm">شاشة قيد التأسيس البرمجي...</h4>
          </div>
        );
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center p-4 transition-colors duration-200" dir="rtl">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-honey/20 border-t-honey animate-spin" />
            <span className="absolute text-xl">🍯</span>
          </div>
          <div>
            <h3 className="text-sm font-black text-main-text">جاري تحميل الجلسة والنظام...</h3>
            <p className="text-[10.5px] text-sec-text mt-1">تأمين الربط السحابي الآمن لبوابة باحكم بالعسل.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={() => setLoadingAuth(false)} />;
  }

  return (
    <div className="min-h-screen bg-app-bg flex flex-col lg:flex-row text-right transition-colors duration-200" dir="rtl">
      
      {/* Sidebar navigation */}
      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          setRefreshSeed(prev => prev + 1);
        }}
        isFallback={isFallback}
        onToggleFallback={handleToggleFallback}
        pendingMsgCount={pendingWhatsappCount}
      />

      {/* Main Content Workspace viewport */}
      <main className="flex-1 w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl mx-auto min-h-screen bg-card-bg border-x border-border-val/60 px-4 py-6 space-y-6 transition-all duration-200 pb-32 shadow-2xl relative">
        
        {/* Universal Top-bar with clocks */}
        <header className="flex flex-col sm:flex-row justify-between items-center bg-card-bg border border-border-val px-6 py-4 rounded-2xl gap-4 transition-colors duration-200">
          <div className="flex items-center w-full sm:w-auto justify-center sm:justify-start">
            <img 
              src={brandLogo} 
              alt="باحكم للعسل - BAHKM FOR HONEY" 
              className="brandLogoFull"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Real-time clocks & network state info */}
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 text-xs w-full sm:w-auto">
            
            {/* UTC Real time Clock indicator */}
            <div className="bg-soft-card px-3.5 py-1.5 rounded-xl border border-border-val text-sec-text flex items-center gap-1.5 font-mono">
              <Clock className="w-3.5 h-3.5 text-honey" />
              <span>{currentTime.toLocaleTimeString('ar-YE-u-nu-latn', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>

            {/* Connection State Info (Visual indicator matching topbar) */}
            {!isOnline ? (
              <div 
                className="bg-red-500 text-white font-extrabold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-red-950/25"
                title="لا يوجد اتصال بالإنترنت"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                <span>غير متصل ⚠️</span>
              </div>
            ) : isFallback ? (
              <div 
                onClick={handleToggleFallback}
                className="bg-danger-val/10 border border-danger-val/25 text-danger-val font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer hover:bg-danger-val/15 active:scale-95 transition-all"
                title="اضغط للتوصيل الفعلي بـ Supabase"
              >
                <div className="w-2 h-2 rounded-full bg-danger-val animate-pulse" />
                <span>محاكي (أمينات محلية)</span>
              </div>
            ) : (
              <div 
                onClick={handleToggleFallback}
                className="bg-success-val/10 border border-success-val/25 text-success-val font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer hover:bg-success-val/15 active:scale-95 transition-all"
                title="اضغط لتغيير لوضع محلي للتدريب"
              >
                <div className="w-2 h-2 rounded-full bg-success-val animate-pulse" />
                <span>متصل مباشر</span>
              </div>
            )}

            {/* Active User session details and LogOut button */}
            {currentUser && (
              <div className="bg-soft-card px-3.5 py-1.5 rounded-xl border border-border-val text-main-text flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-honey animate-pulse" />
                <span className="font-extrabold max-w-[120px] truncate" title={currentUser.email}>
                  {currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0]}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mr-1.5 p-1 hover:bg-danger-val/10 rounded-lg text-sec-text hover:text-danger-val transition-colors cursor-pointer flex items-center justify-center"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

          </div>
        </header>

        {/* Global Offline Waring Banner */}
        {!isOnline && (
          <div className="bg-gradient-to-r from-red-600 to-red-500 text-white font-bold p-4 rounded-xl text-xs flex items-start gap-3 shadow-lg select-none">
            <span className="text-base shrink-0 mt-0.5">⚠️</span>
            <div className="space-y-1">
              <strong className="block font-black text-white">لا يوجد اتصال بالإنترنت. لا يمكن حفظ العمليات المالية حتى يعود الاتصال.</strong>
              <span className="text-[10px] text-red-100 block">يمكنكم تصفح الأقسام المفتوحة، لكن يمنع تعديل العملاء أو تسجيل عمليات البيع أو إصدار سندات حتى تتصل بالشبكة.</span>
            </div>
          </div>
        )}

        {/* Global Flash Announcement message banner overlay */}
        {flashMessage && (
          <div className="bg-success-val/10 border border-success-val/35 p-4 rounded-xl text-xs text-success-val flex items-start gap-3 shadow-lg select-none fade-in">
            <CheckCircle2 className="w-5 h-5 text-[#32D74B] shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">{flashMessage.text}</strong>
              {flashMessage.sub && <span className="text-[11px] text-[#98989D]/90 block mt-0.5">{flashMessage.sub}</span>}
            </div>
          </div>
        )}

        {/* Currency Conversion Rates Manager Card */}
        <div id="currency-exchange-card" className="bg-white border border-border-val rounded-2xl p-4 shadow-sm transition-all duration-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            
            {/* Rates Description Info */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-soft-card border border-border-val/50 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-honey animate-pulse" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-main-text">تحويل العملات اليومي المباشر</h3>
                <p className="text-[10.5px] sm:text-xs text-sec-text leading-relaxed font-semibold">
                  تعديل ومزامنة أسعار الصرف لتحويل أسعار المنتجات تلقائياً بين السعودي والدولار واليمني بداخل الفواتير.
                </p>
              </div>
            </div>

            {/* Quick Rates Info view & Toggle edit button */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto mt-2 md:mt-0 font-mono text-xs justify-start md:justify-end">
              <div className="bg-white border border-border-val px-3 py-1.5 rounded-xl flex items-center gap-1 text-main-text">
                <span className="text-[10px] font-sans font-black text-sec-text">🇸🇦 السعودي:</span>
                <strong className="text-honey font-black text-sm">{sarRate}</strong>
                <span className="text-[10px] font-sans text-sec-text/80 font-bold">يمني</span>
              </div>
              <div className="bg-white border border-border-val px-3 py-1.5 rounded-xl flex items-center gap-1 text-main-text">
                <span className="text-[10px] font-sans font-black text-sec-text">🇺🇸 الدولار:</span>
                <strong className="text-honey font-black text-sm">{usdRate}</strong>
                <span className="text-[10px] font-sans text-sec-text/80 font-bold">يمني</span>
              </div>
              
              <button
                type="button"
                onClick={() => setShowRatesEditor(!showRatesEditor)}
                className="bg-white hover:bg-soft-card border border-border-val text-main-text px-3 py-1.5 rounded-xl flex items-center gap-1 font-sans font-black text-xs cursor-pointer active:scale-95 transition-all outline-none"
              >
                <Settings className="w-3.5 h-3.5 text-sec-text" />
                <span>{showRatesEditor ? 'إغلاق ✕' : 'تعديل الصرف ⚙️'}</span>
              </button>
            </div>

          </div>

          {/* Collapsible Input Form */}
          {showRatesEditor && (
            <div className="mt-4 pt-4 border-t border-border-val/70 fade-in space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                
                {/* Saudi Exchange Rate Input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] font-black">
                    <span className="text-main-text">🇸🇦 ريال سعودي مقابل يمني اليوم:</span>
                    <span className="text-honey font-mono text-[10px]">1 SAR = {sarInputVal || '0'} YER</span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={sarInputVal}
                    onChange={(e) => setSarInputVal(e.target.value)}
                    className="w-full bg-white border border-border-val rounded-xl py-2 px-3 text-xs sm:text-sm font-black font-mono text-main-text focus:border-honey outline-none"
                    placeholder="مثال: 410"
                  />
                </div>

                {/* USD Exchange Rate Input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] font-black">
                    <span className="text-main-text">🇺🇸 دولار أمريكي مقابل يمني اليوم:</span>
                    <span className="text-honey font-mono text-[10px]">1 USD = {usdInputVal || '0'} YER</span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={usdInputVal}
                    onChange={(e) => setUsdInputVal(e.target.value)}
                    className="w-full bg-white border border-border-val rounded-xl py-2 px-3 text-xs sm:text-sm font-black font-mono text-main-text focus:border-honey outline-none"
                    placeholder="مثال: 1530"
                  />
                </div>

                {/* Actions Panel */}
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const sarNum = parseFloat(sarInputVal);
                      const usdNum = parseFloat(usdInputVal);
                      if (isNaN(sarNum) || sarNum <= 0) {
                        alert('يرجى إدخال سعر صرف بالريال السعودي صحيح أكبر من الصفر');
                        return;
                      }
                      if (isNaN(usdNum) || usdNum <= 0) {
                        alert('يرجى إدخال سعر صرف بالدولار الأمريكي صحيح أكبر من الصفر');
                        return;
                      }
                      handleSaveRates(sarNum, usdNum);
                      setShowRatesEditor(false);
                    }}
                    disabled={isUpdatingRates}
                    className="flex-1 bg-[#B07000] hover:bg-[#8F5B00] text-white font-black py-2.5 px-4 rounded-xl text-xs flex justify-center items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isUpdatingRates ? 'جاري الحفظ...' : 'اعتماد الصرف ونشره 💾'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSarInputVal(sarRate.toString());
                      setUsdInputVal(usdRate.toString());
                      setShowRatesEditor(false);
                    }}
                    className="bg-gray-200/80 hover:bg-gray-300/80 text-gray-800 font-black py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Selected Screen viewport */}
        <div className="fade-in">
          {renderViewContent()}
        </div>

      </main>



      {/* Global Customer Statement Ledger Modal */}
      {selectedCustomerId && (
        <CustomerDetailModal 
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
        />
      )}

      {/* Global Transaction Details Modal */}
      {selectedTransactionId && (
        <TransactionDetailModal 
          transactionId={selectedTransactionId}
          onClose={() => setSelectedTransactionId(null)}
          onTransactionCancelled={() => {
            setRefreshSeed(prev => prev + 1);
          }}
        />
      )}

      {/* Persistently Sticky Executive Bottom Action Dock/Bar */}
      <div className="fixed bottom-0 left-1/2 lg:left-[calc(50%-8rem)] -translate-x-1/2 w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl z-40 bg-card-bg border-t border-border-val pt-2 px-4 pb-3 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] flex justify-around items-center gap-2 select-none transition-all duration-200">
        
        {/* ACTION 1: New Transaction (Amber highlight) */}
        <button
          id="btn-bottom-new-trx"
          onClick={() => {
            setCurrentTab('new-trx');
            setShowMoreActionsMenu(false);
          }}
          className={`flex-1 max-w-[124px] flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 cursor-pointer ${
            currentTab === 'new-trx'
              ? 'bg-amber-600 text-white font-black shadow-md shadow-amber-600/20 scale-105'
              : 'text-sec-text hover:text-honey hover:bg-honey/10'
          }`}
        >
          <PlusCircle className={`w-[22px] h-[22px] ${currentTab === 'new-trx' ? 'text-white' : 'text-honey'}`} />
          <span className="text-[10px] font-black mt-1">عملية جديدة</span>
        </button>

        {/* ACTION 2: Customers & Debts (Users) */}
        <button
          id="btn-bottom-customers"
          onClick={() => {
            setCurrentTab('customers');
            setShowMoreActionsMenu(false);
          }}
          className={`flex-1 max-w-[124px] flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 cursor-pointer ${
            currentTab === 'customers'
              ? 'bg-side-active text-side-active-text font-black border-b-2 border-honey'
              : 'text-sec-text hover:text-main-text hover:bg-side-active'
          }`}
        >
          <Users className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-bold mt-1">العملاء والذمم</span>
        </button>

        {/* ACTION 3: Customer Orders (ClipboardList) */}
        <button
          id="btn-bottom-orders"
          onClick={() => {
            setCurrentTab('orders');
            setShowMoreActionsMenu(false);
          }}
          className={`flex-1 max-w-[124px] flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 cursor-pointer ${
            currentTab === 'orders'
              ? 'bg-side-active text-honey font-black border-b-2 border-honey'
              : 'text-sec-text hover:text-main-text hover:bg-side-active'
          }`}
        >
          <ClipboardList className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-bold mt-1">طلبات العملاء</span>
        </button>

        {/* ACTION 4: More executive options */}
        <button
          id="btn-bottom-more-options"
          onClick={() => setShowMoreActionsMenu(prev => !prev)}
          className={`flex-1 max-w-[124px] flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 cursor-pointer ${
            showMoreActionsMenu
              ? 'bg-side-active text-honey font-black shadow-inner scale-105'
              : 'text-sec-text hover:text-main-text hover:bg-side-active'
          }`}
        >
          <Grid className={`w-[22px] h-[22px] ${showMoreActionsMenu ? 'text-honey animate-pulse' : ''}`} />
          <span className="text-[10px] font-bold mt-1">خيارات أكثر</span>
        </button>

      </div>

      {/* Additional Executive Options Panel (Action 4 Modal Popup) */}
      {showMoreActionsMenu && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 transition-all duration-200" onClick={() => setShowMoreActionsMenu(false)}>
          <div 
            className="w-full max-w-lg bg-card-bg border border-border-val rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl relative overflow-hidden space-y-5 animate-slide-up text-right"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Header decor */}
            <div className="flex justify-between items-center pb-3 border-b border-border-val">
              <div>
                <h3 className="text-sm font-black text-main-text flex items-center gap-1.5">
                  <span className="text-honey">🍯</span>
                  أدوات باحكم للعسل التنفيذية المفصلة
                </h3>
                <p className="text-[10px] text-sec-text mt-0.5">انتقل للأقسام الإضافية واطلب التقارير أو راجع إرساليات الواتساب.</p>
              </div>
              <button 
                onClick={() => setShowMoreActionsMenu(false)}
                className="w-8 h-8 rounded-full border border-border-val text-sec-text font-black text-xs flex items-center justify-center hover:bg-side-active transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Grid menu */}
            <div className="grid grid-cols-2 gap-3 pb-3">
              
              {/* Op 0: Customer Orders */}
              <button
                onClick={() => {
                  setCurrentTab('orders');
                  setShowMoreActionsMenu(false);
                }}
                className={`p-4 rounded-2xl border text-right flex flex-col justify-between h-24 hover:border-honey/60 hover:bg-honey/15 transition-all cursor-pointer ${
                  currentTab === 'orders' ? 'bg-side-active border-honey text-honey font-black' : 'bg-soft-card border-border-val/75 text-main-text'
                }`}
              >
                <ClipboardList className="w-6 h-6 text-honey" />
                <div>
                  <span className="text-xs font-black block text-main-text">طلبات العملاء ومتابعتها</span>
                  <span className="text-[9px] text-sec-text block">سحب وتجهيز طلبات الواتساب والهاتف</span>
                </div>
              </button>

              {/* Op 1: Dashboard */}
              <button
                onClick={() => {
                  setCurrentTab('dashboard');
                  setShowMoreActionsMenu(false);
                }}
                className={`p-4 rounded-2xl border text-right flex flex-col justify-between h-24 hover:border-honey/60 hover:bg-honey/15 transition-all cursor-pointer ${
                  currentTab === 'dashboard' ? 'bg-side-active border-honey text-honey font-black' : 'bg-soft-card border-border-val/75 text-main-text'
                }`}
              >
                <LayoutDashboard className="w-6 h-6 text-honey" />
                <div>
                  <span className="text-xs font-black block text-main-text">لوحة مراقبة التدفقات</span>
                  <span className="text-[9px] text-sec-text block">ملخصات المبيعات والذمم اليوم</span>
                </div>
              </button>

              {/* Op 2: Register of txs */}
              <button
                onClick={() => {
                  setCurrentTab('transactions');
                  setShowMoreActionsMenu(false);
                }}
                className={`p-4 rounded-2xl border text-right flex flex-col justify-between h-24 hover:border-honey/60 hover:bg-honey/15 transition-all cursor-pointer ${
                  currentTab === 'transactions' ? 'bg-side-active border-honey text-honey font-black' : 'bg-soft-card border-border-val/75 text-main-text'
                }`}
              >
                <Receipt className="w-6 h-6 text-honey" />
                <div>
                  <span className="text-xs font-black block text-main-text">العمليات والتذاكر</span>
                  <span className="text-[9px] text-sec-text block">مراجعة وإلغاء القيود والفواتير</span>
                </div>
              </button>

              {/* Op 3: Products / Honey varieties */}
              <button
                onClick={() => {
                  setCurrentTab('products');
                  setShowMoreActionsMenu(false);
                }}
                className={`p-4 rounded-2xl border text-right flex flex-col justify-between h-24 hover:border-honey/60 hover:bg-honey/15 transition-all cursor-pointer ${
                  currentTab === 'products' ? 'bg-side-active border-honey text-honey font-black' : 'bg-soft-card border-border-val/75 text-main-text'
                }`}
              >
                <ShoppingBag className="w-6 h-6 text-honey" />
                <div>
                  <span className="text-xs font-black block text-main-text">أصناف ومنتجات العسل</span>
                  <span className="text-[9px] text-sec-text block">إضافة وتعديل أسعار الكيلو</span>
                </div>
              </button>

              {/* Op 4: Whatsapp queue */}
              <button
                onClick={() => {
                  setCurrentTab('whatsapp');
                  setShowMoreActionsMenu(false);
                }}
                className={`p-4 rounded-2xl border text-right flex flex-col justify-between h-24 hover:border-honey/60 hover:bg-honey/15 transition-all cursor-pointer relative ${
                  currentTab === 'whatsapp' ? 'bg-side-active border-honey text-honey font-black' : 'bg-soft-card border-border-val/75 text-main-text'
                }`}
              >
                <MessageSquare className="w-6 h-6 text-honey" />
                {pendingWhatsappCount > 0 && (
                  <span className="absolute left-3 top-3 bg-danger-val text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-bounce">
                    {pendingWhatsappCount}
                  </span>
                )}
                <div>
                  <span className="text-xs font-black block text-main-text">طابور إشعارات المبيعات</span>
                  <span className="text-[9px] text-sec-text block">إرسال الفواتير للعملاء آلياً</span>
                </div>
              </button>

              {/* Op 5: Reports */}
              <button
                onClick={() => {
                  setCurrentTab('reports');
                  setShowMoreActionsMenu(false);
                }}
                className={`p-4 rounded-2xl border text-right flex flex-col justify-between h-24 hover:border-honey/60 hover:bg-honey/15 transition-all cursor-pointer ${
                  currentTab === 'reports' ? 'bg-side-active border-honey text-honey font-black' : 'bg-soft-card border-border-val/75 text-main-text'
                }`}
              >
                <BarChart3 className="w-6 h-6 text-honey" />
                <div>
                  <span className="text-xs font-black block text-main-text">التقارير والأرباح اليومية</span>
                  <span className="text-[9px] text-sec-text block">مراقبة الهوامش والربح والبحث</span>
                </div>
              </button>

              {/* Op 6: Settings */}
              <button
                onClick={() => {
                  setCurrentTab('settings');
                  setShowMoreActionsMenu(false);
                }}
                className={`p-4 rounded-2xl border text-right flex flex-col justify-between h-24 hover:border-honey/60 hover:bg-honey/15 transition-all cursor-pointer ${
                  currentTab === 'settings' ? 'bg-side-active border-honey text-honey font-black' : 'bg-soft-card border-border-val/75 text-main-text'
                }`}
              >
                <Settings className="w-6 h-6 text-honey" />
                <div>
                  <span className="text-xs font-black block text-main-text">تهيئة وضبط النظام</span>
                  <span className="text-[9px] text-sec-text block">إيقاف أو تشغيل الفواتير ومحاكاته</span>
                </div>
              </button>

              {/* Op 7: Media and Documents Library */}
              <button
                onClick={() => {
                  setCurrentTab('media_library');
                  setShowMoreActionsMenu(false);
                }}
                className={`p-4 rounded-2xl border text-right flex flex-col justify-between h-24 hover:border-honey/60 hover:bg-honey/15 transition-all cursor-pointer ${
                  currentTab === 'media_library' ? 'bg-side-active border-honey text-honey font-black' : 'bg-soft-card border-border-val/75 text-main-text'
                }`}
              >
                <FolderOpen className="w-6 h-6 text-honey" />
                <div>
                  <span className="text-xs font-black block text-main-text">مكتبة المستندات والوسائط</span>
                  <span className="text-[9px] text-sec-text block">أرشفة وحفظ الفواتير والسندات رقمياً</span>
                </div>
              </button>

            </div>

            {/* Close button */}
            <button
              onClick={() => setShowMoreActionsMenu(false)}
              className="w-full py-3 rounded-xl bg-sec-bg hover:bg-side-active border border-border-val text-xs text-main-text font-black transition-all text-center cursor-pointer"
            >
              إلغاء وإغلاق القائمة
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
