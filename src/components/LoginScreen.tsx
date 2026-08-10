import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Lock, Mail, AlertCircle, Sparkles } from 'lucide-react';
import brandLogo from '../assets/bahkm-honey-logo-header-ready.png';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('الرجاء إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        console.error('Login error:', error);
        // Clean Arabic messages for common errors
        if (error.message.includes('Invalid login credentials')) {
          setErrorMsg('خطأ في البريد الإلكتروني أو كلمة المرور. يرجى التحقق وإعادة المحاولة.');
        } else if (error.message.includes('Email not confirmed')) {
          setErrorMsg('لم يتم تأكيد الحساب بعد. يرجى التحقق من بريدك الإلكتروني لتنشيط الحساب.');
        } else {
          setErrorMsg(error.message || 'فشل تسجيل الدخول. يرجى المحاولة مرة أخرى.');
        }
      } else if (data.session) {
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error('Unhandled login error:', err);
      setErrorMsg(err.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center px-4 py-12 transition-colors duration-200" dir="rtl">
      <div className="w-full max-w-md bg-card-bg border border-border-val rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden transition-all duration-200">
        
        {/* Decorative Top glow */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-honey to-yellow-400" />
        
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="p-3 bg-white rounded-xl border border-border-val">
            <img 
              src={brandLogo} 
              alt="باحكم للعسل" 
              className="h-16 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-xl font-black text-main-text flex items-center justify-center gap-1.5">
              <span>تسجيل الدخول للنظام</span>
              <Sparkles className="w-4 h-4 text-honey animate-pulse" />
            </h1>
            <p className="text-xs text-sec-text mt-1 font-semibold">
              بوابة باحكم للعسل والمبيعات والقيود المالية اليومية
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-danger-val/10 border border-danger-val/30 rounded-xl p-3 text-danger-val text-xs font-bold flex items-start gap-2.5 animate-pulse">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-right">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-main-text block block-right">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sec-text">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                className="w-full bg-soft-card border border-border-val rounded-xl py-3.5 pr-10 pl-4 text-xs font-black text-main-text focus:border-honey outline-none transition-colors duration-150 font-mono text-left"
                autoComplete="email"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-main-text block block-right">
              كلمة المرور
            </label>
            <div className="relative">
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sec-text">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-soft-card border border-border-val rounded-xl py-3.5 pr-10 pl-4 text-xs font-black text-main-text focus:border-honey outline-none transition-colors duration-150 font-mono text-left"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-honey hover:bg-honey-hover text-white font-black py-3.5 px-6 rounded-2xl text-xs flex justify-center items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>جاري تسجيل الدخول...</span>
              </>
            ) : (
              <span>دخول النظام الآمن 🍯</span>
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-border-val/30">
          <p className="text-[10px] text-sec-text font-semibold">
            جميع الحقوق محفوظة لشركة باحكم للعسل © ٢٠٢٦
          </p>
        </div>

      </div>
    </div>
  );
}
