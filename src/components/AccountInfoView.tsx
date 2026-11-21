import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Building2,
  Check,
  Clock,
  KeyRound,
  LogOut,
  Mail,
  Monitor,
  Save,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import {
  sendVerificationEmailToUser,
  subscribeLoginSessions,
  subscribeUserAccount,
  syncAuthenticatedUserAccount,
  updateAccountProfileInfo,
  type LoginSessionRecord,
  type UserAccountRecord,
} from '../firebase';

type AccountInfoViewProps = {
  user: User;
  onSignOut: () => void;
};

function formatIsoOrDateArabic(raw: string | null | undefined): string {
  if (!raw) return '—';
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(raw));
  } catch {
    return raw;
  }
}

function formatTimestampArabic(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return 'الآن';
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(ts.toDate());
  } catch {
    return '—';
  }
}

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name || email || 'غ').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'غ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function AccountInfoView({ user, onSignOut }: AccountInfoViewProps) {
  const [accountDoc, setAccountDoc] = useState<UserAccountRecord | null>(null);
  const [sessions, setSessions] = useState<LoginSessionRecord[]>([]);
  const [displayNameInput, setDisplayNameInput] = useState(user.displayName ?? '');
  const [organizationInput, setOrganizationInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifiedState, setIsVerifiedState] = useState<boolean>(user.emailVerified);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);

  useEffect(() => {
    setIsVerifiedState(user.emailVerified);
  }, [user.emailVerified]);

  useEffect(() => {
    if (!isVerifiedState) return;

    const unsubAccount = subscribeUserAccount(
      user.uid,
      (record) => {
        setAccountDoc(record);
        if (record) {
          setDisplayNameInput(record.displayName || user.displayName || '');
          setOrganizationInput(record.organization || '');
        }
      },
      (err) => setErrorMessage(err.message)
    );

    const unsubSessions = subscribeLoginSessions(
      user.uid,
      (list) => setSessions(list),
      (err) => setErrorMessage(err.message)
    );

    return () => {
      unsubAccount();
      unsubSessions();
    };
  }, [isVerifiedState, user.displayName, user.uid]);

  const handleResendVerification = async () => {
    setVerificationNotice(null);
    setErrorMessage(null);
    try {
      await sendVerificationEmailToUser(user);
      setVerificationNotice('تم إرسال رابط تفعيل البريد الإلكتروني. تفحّص صندوق الوارد ثم اضغط «تحديث حالة التوثيق».');
    } catch {
      setErrorMessage('تعذّر إرسال رابط التوثيق حالياً. يرجى المحاولة بعد قليل.');
    }
  };

  const handleRefreshVerification = async () => {
    setVerificationNotice(null);
    setErrorMessage(null);
    try {
      await user.reload();
      if (user.emailVerified) {
        setIsVerifiedState(true);
        await syncAuthenticatedUserAccount(user);
        setVerificationNotice('تم توثيق البريد الإلكتروني ومزامنة بيانات الحساب بنجاح.');
      } else {
        setVerificationNotice('لم يتم تفعيل البريد الإلكتروني بعد. افتح رابط التفعيل المرسل لبريدك أولاً.');
      }
    } catch {
      setErrorMessage('تعذّر التحقق من حالة التوثيق.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);
    setSavedToast(false);
    try {
      await updateAccountProfileInfo(user, {
        displayName: displayNameInput,
        organization: organizationInput,
      });
      setSavedToast(true);
      window.setTimeout(() => setSavedToast(false), 2500);
    } catch {
      setErrorMessage('تعذّر حفظ بيانات الحساب في السحابة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSaving(false);
    }
  };

  const primaryProvider = user.providerData[0]?.providerId ?? 'password';
  const providerDisplayLabel =
    primaryProvider === 'google.com'
      ? 'Google'
      : primaryProvider === 'password'
      ? 'البريد الإلكتروني وكلمة المرور'
      : primaryProvider;
  const effectiveName = accountDoc?.displayName || user.displayName || user.email || 'حساب الإدارة';

  return (
    <main dir="rtl" className="flex-1 overflow-y-auto bg-[#F5F7F5]">
      <div className="max-w-5xl w-full mx-auto p-6 md:p-8 space-y-6">
        {/* Account Overview Header */}
        <header className="bg-white border border-[#E2E7E3] rounded-xl p-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={effectiveName}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-xl object-cover border border-[#DCE3DD] shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-[#0F1F18] text-white flex items-center justify-center text-base font-bold shrink-0">
                {getInitials(effectiveName, user.email)}
              </div>
            )}

            <div className="min-w-0">
              <h1 className="text-lg font-bold text-[#0F1F18] truncate">{effectiveName}</h1>
              <div className="flex items-center gap-2 text-xs text-[#64748B] mt-1 flex-wrap">
                <span className="font-mono-nums" dir="ltr">
                  {user.email || '—'}
                </span>
                <span aria-hidden="true">·</span>
                <span
                  className={`inline-flex items-center gap-1 font-medium ${
                    isVerifiedState ? 'text-[#15803D]' : 'text-amber-700'
                  }`}
                >
                  <ShieldCheck size={13} />
                  <span>{isVerifiedState ? 'حساب موثّق' : 'بانتظار توثيق البريد'}</span>
                </span>
                <span aria-hidden="true">·</span>
                <span>مزوّد الدخول: {providerDisplayLabel}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 bg-red-50/70 hover:bg-red-100 text-red-700 text-xs font-semibold cursor-pointer transition-colors shrink-0"
          >
            <LogOut size={14} />
            <span>تسجيل الخروج</span>
          </button>
        </header>

        {!isVerifiedState && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="text-xs text-amber-900 space-y-1">
              <div className="font-bold">توثيق البريد الإلكتروني مطلوب للمزامنة السحابية</div>
              <p className="text-amber-800">
                لحماية بيانات حسابك وسجل جلساتك في قاعدة البيانات، فعّل بريدك عبر الرابط المرسل ثم حدّث الحالة.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResendVerification}
                className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 hover:border-amber-500 text-xs font-semibold text-amber-900 cursor-pointer"
              >
                إرسال رابط التوثيق
              </button>
              <button
                type="button"
                onClick={handleRefreshVerification}
                className="px-3 py-1.5 rounded-lg bg-[#15803D] hover:bg-[#166534] text-xs font-semibold text-white cursor-pointer"
              >
                تحديث حالة التوثيق
              </button>
            </div>
          </div>
        )}

        {verificationNotice && (
          <div
            role="status"
            className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs text-[#15803D] font-medium"
          >
            {verificationNotice}
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900"
          >
            حدث تنبيه أثناء مزامنة بيانات الحساب: {errorMessage}
          </div>
        )}

        {/* Authentication & Credentials Info Grid */}
        <section className="bg-white border border-[#E2E7E3] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#EEF2EE] pb-3">
            <KeyRound size={16} className="text-[#15803D]" />
            <div>
              <h2 className="text-sm font-bold text-[#0F1F18]">معلومات تسجيل الدخول والحساب</h2>
              <p className="text-[11px] text-[#64748B]">
                بيانات المصادقة الفعلية المرتبطة بالجلسة الحالية في Firebase Authentication.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="rounded-xl border border-[#E2E7E3] bg-[#FAFBF9] p-4 space-y-1">
              <div className="text-[11px] font-medium text-[#64748B] flex items-center gap-1.5">
                <Mail size={12} />
                <span>البريد الإلكتروني</span>
              </div>
              <div className="font-mono-nums font-semibold text-[#0F1F18] break-all" dir="ltr">
                {user.email || '—'}
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E7E3] bg-[#FAFBF9] p-4 space-y-1">
              <div className="text-[11px] font-medium text-[#64748B] flex items-center gap-1.5">
                <UserIcon size={12} />
                <span>معرّف الحساب (UID)</span>
              </div>
              <div className="font-mono-nums font-semibold text-[#0F1F18] break-all" dir="ltr">
                {user.uid}
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E7E3] bg-[#FAFBF9] p-4 space-y-1">
              <div className="text-[11px] font-medium text-[#64748B] flex items-center gap-1.5">
                <ShieldCheck size={12} />
                <span>طريقة المصادقة وحالة التوثيق</span>
              </div>
              <div className="font-semibold text-[#0F1F18]">
                {providerDisplayLabel} · {user.emailVerified ? 'بريد موثّق' : 'غير موثّق'}
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E7E3] bg-[#FAFBF9] p-4 space-y-1">
              <div className="text-[11px] font-medium text-[#64748B] flex items-center gap-1.5">
                <Clock size={12} />
                <span>تاريخ إنشاء الحساب</span>
              </div>
              <div className="font-semibold text-[#0F1F18]">
                {formatIsoOrDateArabic(user.metadata.creationTime)}
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E7E3] bg-[#FAFBF9] p-4 space-y-1">
              <div className="text-[11px] font-medium text-[#64748B] flex items-center gap-1.5">
                <Clock size={12} />
                <span>آخر تسجيل دخول</span>
              </div>
              <div className="font-semibold text-[#0F1F18]">
                {formatIsoOrDateArabic(user.metadata.lastSignInTime)}
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E7E3] bg-[#FAFBF9] p-4 space-y-1">
              <div className="text-[11px] font-medium text-[#64748B] flex items-center gap-1.5">
                <Building2 size={12} />
                <span>آخر تحديث للسجل السحابي</span>
              </div>
              <div className="font-semibold text-[#0F1F18]">
                {formatTimestampArabic(accountDoc?.updatedAt)}
              </div>
            </div>
          </div>
        </section>

        {/* Editable Account Display & Organization Info Synced to Firestore */}
        {isVerifiedState && (
          <section className="bg-white border border-[#E2E7E3] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-[#EEF2EE] pb-3 flex-wrap">
              <div>
                <h2 className="text-sm font-bold text-[#0F1F18]">تخصيص بيانات الحساب</h2>
                <p className="text-[11px] text-[#64748B]">
                  تُحفظ هذه البيانات بشكل خاص لحسابك فقط في قاعدة البيانات.
                </p>
              </div>
              {savedToast && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D]">
                  <Check size={14} />
                  <span>تم حفظ التغييرات</span>
                </span>
              )}
            </div>

            <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label htmlFor="account-display-name" className="block font-semibold text-[#334155] mb-1.5">
                  الاسم المعروض في المنصة
                </label>
                <input
                  id="account-display-name"
                  type="text"
                  maxLength={120}
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="اسم المسؤول أو المشرف"
                  className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18]"
                />
              </div>

              <div>
                <label htmlFor="account-org-name" className="block font-semibold text-[#334155] mb-1.5">
                  الجهة / المؤسسة الزراعية
                </label>
                <input
                  id="account-org-name"
                  type="text"
                  maxLength={120}
                  value={organizationInput}
                  onChange={(e) => setOrganizationInput(e.target.value)}
                  placeholder="مثال: إدارة المشاريع الزراعية"
                  className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18]"
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#15803D] hover:bg-[#166534] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  <Save size={14} />
                  <span>{isSaving ? 'جارٍ الحفظ...' : 'حفظ بيانات الحساب'}</span>
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Sign-In Sessions History */}
        <section className="bg-white border border-[#E2E7E3] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2E7E3] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor size={16} className="text-[#15803D]" />
              <h2 className="text-sm font-bold text-[#0F1F18]">سجل جلسات تسجيل الدخول الأخيرة</h2>
            </div>
            <span className="font-mono-nums text-[11px] text-[#64748B]">
              {sessions.length} جلسة
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E2E7E3] bg-[#FAFBF9] text-[#475569]">
                  <th className="py-2.5 px-5 font-semibold">وقت الدخول</th>
                  <th className="py-2.5 px-5 font-semibold">الحساب</th>
                  <th className="py-2.5 px-5 font-semibold">المتصفح والنظام</th>
                  <th className="py-2.5 px-5 font-semibold">المزوّد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2EE]">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-[#64748B]">
                      لا توجد جلسات مسجلة بعد.
                    </td>
                  </tr>
                ) : (
                  sessions.map((sess) => (
                    <tr key={sess.id} className="hover:bg-[#FAFBF9]">
                      <td className="py-2.5 px-5 font-medium text-[#0F1F18]">
                        {formatTimestampArabic(sess.signedInAt)}
                      </td>
                      <td className="py-2.5 px-5 font-mono-nums text-[#475569]" dir="ltr">
                        {sess.email || '—'}
                      </td>
                      <td className="py-2.5 px-5 text-[#334155]">{sess.deviceSummary}</td>
                      <td className="py-2.5 px-5 text-[#64748B]">
                        {sess.providerId === 'google.com'
                          ? 'Google'
                          : sess.providerId === 'password'
                          ? 'البريد وكلمة المرور'
                          : sess.providerId}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
