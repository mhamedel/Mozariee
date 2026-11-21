import { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  Sprout,
  User as UserIcon,
  UserPlus,
} from 'lucide-react';
import {
  registerWithEmailPassword,
  sendPasswordReset,
  signInWithEmailPassword,
  signInWithGooglePopup,
} from '../firebase';

function mapAuthErrorArabic(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '';

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'تسجيل الدخول بالبريد وكلمة المرور غير مفعّل بعد في Firebase Console (Authentication > Sign-in method > Email/Password).';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    case 'auth/email-already-in-use':
      return 'هذا البريد الإلكتروني مسجّل مسبقاً. انتقل إلى «تسجيل الدخول».';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة، يجب أن تتكون من 6 أحرف على الأقل.';
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صحيحة.';
    case 'auth/too-many-requests':
      return 'تم تجاوز عدد المحاولات المسموح به، يرجى الانتظار قليلاً ثم المحاولة مجدداً.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'تم إغلاق نافذة تسجيل الدخول قبل إكمال العملية.';
    case 'auth/popup-blocked':
      return 'قام المتصفح بحظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة والمحاولة مجدداً.';
    default:
      return 'تعذّر إتمام العملية. يرجى التحقق من البيانات والمحاولة مرة أخرى.';
  }
}

export function LoginView() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [infoText, setInfoText] = useState<string | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setInfoText(null);
    if (!email.trim() || !password) return;

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithEmailPassword(email, password);
      } else {
        await registerWithEmailPassword(email, password, displayName);
      }
    } catch (err) {
      setErrorText(mapAuthErrorArabic(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    setErrorText(null);
    setInfoText(null);
    if (!email.trim()) {
      setErrorText('أدخل بريدك الإلكتروني أولاً لإرسال رابط إعادة تعيين كلمة المرور.');
      return;
    }
    setIsSubmitting(true);
    try {
      await sendPasswordReset(email);
      setInfoText('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.');
    } catch (err) {
      setErrorText(mapAuthErrorArabic(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorText(null);
    setInfoText(null);
    setIsSubmitting(true);
    try {
      await signInWithGooglePopup();
    } catch (err) {
      setErrorText(mapAuthErrorArabic(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen w-screen bg-[#F5F7F5] text-[#0F1F18] flex items-center justify-center p-6"
    >
      <div className="w-full max-w-md bg-white border border-[#DCE3DD] rounded-2xl shadow-sm p-7 space-y-5">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-[#15803D]/25 flex items-center justify-center text-[#15803D] shrink-0">
            <Sprout size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[#0F1F18]">غرس</h1>
              <span className="text-xs font-semibold text-[#64748B] border-r border-[#DCE3DD] pr-2">
                منصة الإدارة
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              إدارة المزارع ومحاكي الخرائط والحساسات الميدانية
            </p>
          </div>
        </div>

        {/* Mode Switcher: Sign In vs Create Account */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F1F5F2] border border-[#E2E7E3] text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorText(null);
              setInfoText(null);
            }}
            className={`py-2 rounded-lg transition-colors cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-[#0F1F18] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F1F18]'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorText(null);
              setInfoText(null);
            }}
            className={`py-2 rounded-lg transition-colors cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-[#0F1F18] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F1F18]'
            }`}
          >
            إنشاء حساب جديد
          </button>
        </div>

        {errorText && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700 font-medium leading-relaxed"
          >
            {errorText}
          </div>
        )}

        {infoText && (
          <div
            role="status"
            className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-[#15803D] font-medium leading-relaxed"
          >
            {infoText}
          </div>
        )}

        {/* Email (Gmail) & Password Form */}
        <form onSubmit={handleEmailSubmit} className="space-y-3.5 text-xs">
          {mode === 'register' && (
            <div>
              <label htmlFor="login-name" className="block font-semibold text-[#334155] mb-1.5">
                الاسم الكامل
              </label>
              <div className="relative">
                <UserIcon
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                />
                <input
                  id="login-name"
                  type="text"
                  maxLength={120}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="مثال: محمد العزاوي"
                  className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18]"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block font-semibold text-[#334155] mb-1.5">
              البريد الإلكتروني (Gmail)
            </label>
            <div className="relative">
              <Mail
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
              />
              <input
                id="login-email"
                type="email"
                required
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@gmail.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18] text-left font-mono-nums"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="login-password" className="font-semibold text-[#334155]">
                كلمة المرور
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="text-[11px] font-medium text-[#15803D] hover:underline cursor-pointer"
                >
                  نسيت كلمة المرور؟
                </button>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F1F18] cursor-pointer"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                dir="ltr"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18] text-left font-mono-nums"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl bg-[#15803D] hover:bg-[#166534] disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            {mode === 'login' ? <LogIn size={15} /> : <UserPlus size={15} />}
            <span>
              {isSubmitting
                ? 'جارٍ المعالجة...'
                : mode === 'login'
                ? 'تسجيل الدخول'
                : 'إنشاء الحساب والدخول'}
            </span>
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-[#E2E7E3]" />
          <span className="bg-white px-3 text-[11px] font-medium text-[#64748B] shrink-0">أو</span>
        </div>

        {/* Google Popup Sign-In */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 rounded-xl border border-[#D4DBD5] bg-white hover:border-[#15803D] hover:bg-[#FAFBF9] disabled:opacity-60 text-[#0F1F18] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <span>تسجيل الدخول السريع بحساب Google</span>
        </button>

        <div className="border-t border-[#EEF2EE] pt-3.5 flex items-center justify-between text-[11px] text-[#64748B] gap-3">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-[#15803D] shrink-0" />
            <span>مصادقة محمية عبر Firebase</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Lock size={12} className="shrink-0" />
            <span>جلسة مشفّرة</span>
          </span>
        </div>
      </div>
    </div>
  );
}
