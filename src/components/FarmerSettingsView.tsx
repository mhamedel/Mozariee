import { useMemo, useState } from 'react';
import {
  Bell,
  Check,
  FileBadge2,
  Mail,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Save,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import type { GharsStore } from '../store/useGharsStore';
import type {
  FarmerAccountStatus,
  FarmerPreferredLanguage,
  PreferredContactMethod,
} from '../types/ghars';

type FarmerSettingsViewProps = {
  store: GharsStore;
};

const STATUS_META: Record<
  FarmerAccountStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  active: {
    label: 'نشط',
    bg: 'bg-emerald-50',
    text: 'text-[#15803D]',
    border: 'border-emerald-200',
  },
  pending: {
    label: 'قيد المراجعة',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  suspended: {
    label: 'موقوف',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
};

function formatDateArabic(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'غ';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`;
}

export function FarmerSettingsView({ store }: FarmerSettingsViewProps) {
  const {
    activeWorkspace,
    activeFarmer,
    selectFarmer,
    addFarmer,
    updateFarmerProfile,
    deleteFarmer,
    saveChanges,
    hasUnsavedChanges,
    setShellSection,
  } = store;

  const [query, setQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add farmer modal state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newLicense, setNewLicense] = useState('');
  const [newStatus, setNewStatus] = useState<FarmerAccountStatus>('active');

  const filteredFarmers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeWorkspace.farmers;
    return activeWorkspace.farmers.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        f.phone.toLowerCase().includes(q) ||
        f.region.toLowerCase().includes(q) ||
        f.nationalIdOrLicense.toLowerCase().includes(q)
    );
  }, [activeWorkspace.farmers, query]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addFarmer({
      name: newName,
      email: newEmail,
      phone: newPhone,
      region: newRegion,
      cityOrAddress: newCity,
      nationalIdOrLicense: newLicense,
      accountStatus: newStatus,
    });
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewRegion('');
    setNewCity('');
    setNewLicense('');
    setNewStatus('active');
    setShowAddModal(false);
  };

  const selectedFarmer = activeFarmer ?? activeWorkspace.farmers[0] ?? null;

  return (
    <main className="flex-1 overflow-y-auto bg-[#F5F7F5]">
      <div className="max-w-6xl w-full mx-auto p-6 md:p-8 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-[#0F1F18]">إعدادات المزارع</h1>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white border border-[#DCE3DD] text-[#475569]">
                {activeWorkspace.farmers.length} حساب مسجّل
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              مركز الإدارة لإعداد جميع بيانات المزارعين، معلومات التواصل، التوثيق الزراعي، وتفضيلات التنبيهات.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-md ${
                hasUnsavedChanges
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'text-[#64748B]'
              }`}
            >
              {hasUnsavedChanges ? 'توجد تعديلات غير محفوظة' : 'جميع الإعدادات محفوظة'}
            </span>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-[#DCE3DD] hover:border-[#15803D] text-xs font-semibold text-[#0F1F18] transition-colors cursor-pointer"
            >
              <Plus size={14} className="text-[#15803D]" />
              <span>إضافة مزارع جديد</span>
            </button>

            <button
              type="button"
              onClick={saveChanges}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-[#15803D] text-white hover:bg-[#166534]'
                  : 'bg-[#0F1F18] text-white hover:bg-[#1E2F26]'
              }`}
            >
              {hasUnsavedChanges ? <Save size={14} /> : <Check size={14} />}
              <span>حفظ الإعدادات</span>
            </button>
          </div>
        </div>

        {/* 2-Column Admin Settings Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-[310px_1fr] gap-6 items-start">
          {/* Farmer Selector List */}
          <aside className="bg-white border border-[#E2E7E3] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-[#0F1F18]">قائمة المزارعين</h2>
              <span className="text-[11px] text-[#64748B] font-mono-nums">
                {filteredFarmers.length} / {activeWorkspace.farmers.length}
              </span>
            </div>

            <div className="relative">
              <Search
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث بالاسم، البريد، الهاتف..."
                className="w-full pr-8 pl-3 py-2 rounded-lg border border-[#D4DBD5] bg-[#FAFBF9] text-xs focus:bg-white focus:border-[#15803D] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5 max-h-[520px] overflow-y-auto pl-0.5">
              {filteredFarmers.length === 0 ? (
                <div className="text-xs text-[#64748B] py-6 text-center">
                  لا توجد نتائج مطابقة للبحث.
                </div>
              ) : (
                filteredFarmers.map((farmer) => {
                  const isSelected = selectedFarmer?.id === farmer.id;
                  const status = STATUS_META[farmer.accountStatus];
                  return (
                    <button
                      key={farmer.id}
                      type="button"
                      onClick={() => {
                        selectFarmer(farmer.id);
                        setConfirmDeleteId(null);
                      }}
                      className={`w-full text-right p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? 'bg-emerald-50/70 border-[#15803D] shadow-xs'
                          : 'bg-white border-[#EEF2EE] hover:border-[#CBD5E1] hover:bg-[#FAFBF9]'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
                          isSelected
                            ? 'bg-[#15803D] text-white'
                            : 'bg-[#EEF2EE] text-[#0F1F18]'
                        }`}
                      >
                        {getInitials(farmer.name)}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#0F1F18] truncate">
                            {farmer.name}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${status.bg} ${status.text} ${status.border}`}
                          >
                            {status.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#64748B] truncate" dir="ltr">
                          {farmer.email || farmer.phone || 'بدون بيانات تواصل'}
                        </div>
                        <div className="text-[10px] text-[#94A3B8] truncate">{farmer.region}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Selected Farmer Settings Form */}
          {selectedFarmer ? (
            <div className="space-y-5">
              {/* Profile Summary Banner */}
              <section className="bg-white border border-[#E2E7E3] rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-[#0F1F18] text-white flex items-center justify-center text-base font-bold shrink-0">
                    {getInitials(selectedFarmer.name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-[#0F1F18]">{selectedFarmer.name}</h2>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          STATUS_META[selectedFarmer.accountStatus].bg
                        } ${STATUS_META[selectedFarmer.accountStatus].text} ${
                          STATUS_META[selectedFarmer.accountStatus].border
                        }`}
                      >
                        {STATUS_META[selectedFarmer.accountStatus].label}
                      </span>
                    </div>
                    <div className="text-xs text-[#64748B] mt-1 flex items-center gap-2 flex-wrap">
                      <span>{selectedFarmer.region || 'المنطقة غير محددة'}</span>
                      <span className="text-[#CBD5E1]">·</span>
                      <span>تاريخ التسجيل: {formatDateArabic(selectedFarmer.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShellSection('editor')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#DCE3DD] hover:border-[#15803D] bg-white text-xs font-semibold text-[#0F1F18] cursor-pointer"
                  >
                    <MapIcon size={14} className="text-[#15803D]" />
                    <span>فتح محاكي الخرائط</span>
                  </button>

                  {activeWorkspace.farmers.length > 1 &&
                    (confirmDeleteId === selectedFarmer.id ? (
                      <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
                        <span className="text-[11px] font-semibold text-red-700">تأكيد الحذف؟</span>
                        <button
                          type="button"
                          onClick={() => {
                            deleteFarmer(selectedFarmer.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-1 rounded bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700 cursor-pointer"
                        >
                          نعم، احذف
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded bg-white border border-red-200 text-[#475569] text-[11px] font-medium cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(selectedFarmer.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E2E7E3] hover:border-red-300 hover:bg-red-50 text-xs font-medium text-red-700 cursor-pointer"
                      >
                        <Trash2 size={14} />
                        <span>حذف الملف</span>
                      </button>
                    ))}
                </div>
              </section>

              {/* Section 1: Personal & Contact Info */}
              <section className="bg-white border border-[#E2E7E3] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-[#EEF2EE] pb-3">
                  <User size={16} className="text-[#15803D]" />
                  <div>
                    <h3 className="text-sm font-bold text-[#0F1F18]">
                      البيانات الشخصية ومعلومات التواصل
                    </h3>
                    <p className="text-[11px] text-[#64748B]">
                      المعلومات الأساسية للتواصل مع المزارع وإرسال التقارير والتنبيهات.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-[#334155] mb-1.5">
                      الاسم الكامل للمزارع
                    </label>
                    <input
                      type="text"
                      value={selectedFarmer.name}
                      onChange={(e) =>
                        updateFarmerProfile(selectedFarmer.id, { name: e.target.value })
                      }
                      placeholder="مثال: أحمد المنصور"
                      className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#334155] mb-1.5">
                      البريد الإلكتروني
                    </label>
                    <div className="relative">
                      <Mail
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                      />
                      <input
                        type="email"
                        dir="ltr"
                        value={selectedFarmer.email}
                        onChange={(e) =>
                          updateFarmerProfile(selectedFarmer.id, { email: e.target.value })
                        }
                        placeholder="farmer@example.com"
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18] text-left font-mono-nums"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#334155] mb-1.5">
                      رقم الهاتف الأساسي
                    </label>
                    <div className="relative">
                      <Phone
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                      />
                      <input
                        type="tel"
                        dir="ltr"
                        value={selectedFarmer.phone}
                        onChange={(e) =>
                          updateFarmerProfile(selectedFarmer.id, { phone: e.target.value })
                        }
                        placeholder="+966 5X XXX XXXX"
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18] text-left font-mono-nums"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#334155] mb-1.5">
                      رقم هاتف بديل / طوارئ
                    </label>
                    <div className="relative">
                      <Phone
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                      />
                      <input
                        type="tel"
                        dir="ltr"
                        value={selectedFarmer.secondaryPhone}
                        onChange={(e) =>
                          updateFarmerProfile(selectedFarmer.id, { secondaryPhone: e.target.value })
                        }
                        placeholder="+966 5X XXX XXXX"
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18] text-left font-mono-nums"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#334155] mb-1.5">
                      وسيلة التواصل المفضلة
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'whatsapp', label: 'واتساب', icon: MessageCircle },
                          { id: 'phone', label: 'اتصال هاتفي', icon: Phone },
                          { id: 'email', label: 'بريد إلكتروني', icon: Mail },
                        ] as { id: PreferredContactMethod; label: string; icon: typeof Phone }[]
                      ).map((opt) => {
                        const Icon = opt.icon;
                        const active = selectedFarmer.preferredContactMethod === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              updateFarmerProfile(selectedFarmer.id, {
                                preferredContactMethod: opt.id,
                              })
                            }
                            className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                              active
                                ? 'bg-emerald-50 border-[#15803D] text-[#15803D]'
                                : 'bg-white border-[#D4DBD5] text-[#475569] hover:border-[#94A3B8]'
                            }`}
                          >
                            <Icon size={13} />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#334155] mb-1.5">
                      لغة الإشعارات والتقارير
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'ar', label: 'العربية' },
                          { id: 'en', label: 'English' },
                        ] as { id: FarmerPreferredLanguage; label: string }[]
                      ).map((lang) => {
                        const active = selectedFarmer.preferredLanguage === lang.id;
                        return (
                          <button
                            key={lang.id}
                            type="button"
                            onClick={() =>
                              updateFarmerProfile(selectedFarmer.id, {
                                preferredLanguage: lang.id,
                              })
                            }
                            className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                              active
                                ? 'bg-emerald-50 border-[#15803D] text-[#15803D]'
                                : 'bg-white border-[#D4DBD5] text-[#475569] hover:border-[#94A3B8]'
                            }`}
                          >
                            {lang.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 2: Location & Official Registration */}
              <section className="bg-white border border-[#E2E7E3] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-[#EEF2EE] pb-3">
                  <FileBadge2 size={16} className="text-[#15803D]" />
                  <div>
                    <h3 className="text-sm font-bold text-[#0F1F18]">
                      الموقع والتوثيق الإداري
                    </h3>
                    <p className="text-[11px] text-[#64748B]">
                      بيانات المنطقة الجغرافية، العنوان التفصيلي، رقم السجل الزراعي، وحالة الحساب.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-[#334155] mb-1.5">
                      المنطقة / المحافظة
                    </label>
                    <div className="relative">
                      <MapPin
                        size={14}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                      />
                      <input
                        type="text"
                        value={selectedFarmer.region}
                        onChange={(e) =>
                          updateFarmerProfile(selectedFarmer.id, { region: e.target.value })
                        }
                        placeholder="مثال: الخرج · الرياض"
                        className="w-full pr-9 pl-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#334155] mb-1.5">
                      رقم السجل الزراعي / الهوية
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={selectedFarmer.nationalIdOrLicense}
                      onChange={(e) =>
                        updateFarmerProfile(selectedFarmer.id, {
                          nationalIdOrLicense: e.target.value,
                        })
                      }
                      placeholder="AGR-4410892"
                      className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18] text-left font-mono-nums"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-semibold text-[#334155] mb-1.5">
                      المدينة والعنوان التفصيلي
                    </label>
                    <input
                      type="text"
                      value={selectedFarmer.cityOrAddress}
                      onChange={(e) =>
                        updateFarmerProfile(selectedFarmer.id, { cityOrAddress: e.target.value })
                      }
                      placeholder="اسم المدينة، الطريق، أو اسم القطاع الزراعي..."
                      className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-semibold text-[#334155] mb-1.5">
                      حالة الحساب الإدارية
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['active', 'pending', 'suspended'] as FarmerAccountStatus[]).map((st) => {
                        const meta = STATUS_META[st];
                        const active = selectedFarmer.accountStatus === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() =>
                              updateFarmerProfile(selectedFarmer.id, { accountStatus: st })
                            }
                            className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                              active
                                ? `${meta.bg} ${meta.border} ${meta.text}`
                                : 'bg-white border-[#D4DBD5] text-[#475569] hover:border-[#94A3B8]'
                            }`}
                          >
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 3: Alerts & Admin Notes */}
              <section className="bg-white border border-[#E2E7E3] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-[#EEF2EE] pb-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-[#15803D]" />
                    <div>
                      <h3 className="text-sm font-bold text-[#0F1F18]">
                        إعدادات التنبيهات والملاحظات الإدارية
                      </h3>
                      <p className="text-[11px] text-[#64748B]">
                        ضبط حدود الإشعارات التلقائية عند انخفاض الرطوبة أو ارتفاع درجة الحرارة.
                      </p>
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedFarmer.alertsEnabled}
                      onChange={(e) =>
                        updateFarmerProfile(selectedFarmer.id, {
                          alertsEnabled: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-[#15803D] rounded cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-[#0F1F18]">
                      تفعيل التنبيهات التلقائية
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-[#334155] mb-1.5">
                      حد تنبيه انخفاض رطوبة التربة (%)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={90}
                      disabled={!selectedFarmer.alertsEnabled}
                      value={selectedFarmer.moistureAlertThreshold}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!Number.isNaN(val)) {
                          updateFarmerProfile(selectedFarmer.id, {
                            moistureAlertThreshold: val,
                          });
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs font-mono-nums disabled:opacity-50 disabled:bg-[#FAFBF9]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#334155] mb-1.5">
                      حد تنبيه ارتفاع درجة الحرارة (°C)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={60}
                      disabled={!selectedFarmer.alertsEnabled}
                      value={selectedFarmer.tempAlertThreshold}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!Number.isNaN(val)) {
                          updateFarmerProfile(selectedFarmer.id, {
                            tempAlertThreshold: val,
                          });
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs font-mono-nums disabled:opacity-50 disabled:bg-[#FAFBF9]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-semibold text-[#334155] mb-1.5">
                      ملاحظات الإدارة
                    </label>
                    <textarea
                      rows={3}
                      value={selectedFarmer.notes}
                      onChange={(e) =>
                        updateFarmerProfile(selectedFarmer.id, { notes: e.target.value })
                      }
                      placeholder="أي ملاحظات خاصة بمتابعة المزارع، جدول الزيارات الميدانية، أو متطلبات الدعم الفني..."
                      className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18] resize-y"
                    />
                  </div>
                </div>
              </section>

              {/* Bottom Action Bar */}
              <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShellSection('editor')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-[#DCE3DD] hover:border-[#15803D] text-xs font-semibold text-[#0F1F18] cursor-pointer"
                >
                  <MapIcon size={14} className="text-[#15803D]" />
                  <span>الانتقال إلى محاكي الخرائط لهذا المزارع</span>
                </button>

                <button
                  type="button"
                  onClick={saveChanges}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#15803D] text-white hover:bg-[#166534] text-xs font-semibold cursor-pointer"
                >
                  <Save size={14} />
                  <span>حفظ إعدادات المزارع</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E2E7E3] rounded-xl p-10 text-center text-xs text-[#64748B]">
              اختر مزارعاً من القائمة الجانبية لعرض وتعديل إعداداته.
            </div>
          )}
        </div>
      </div>

      {/* Add Farmer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddSubmit}
            className="w-full max-w-lg bg-white rounded-xl border border-[#E2E7E3] shadow-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#EEF2EE] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#0F1F18]">إضافة ملف مزارع جديد</h3>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  أدخل بيانات المزارع الأساسية لإنشاء ملفه في منصة الإدارة.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-xs text-[#64748B] hover:text-[#0F1F18] cursor-pointer"
              >
                إغلاق
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-[#334155] mb-1">
                  الاسم الكامل للمزارع *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: خالد العتيبي"
                  className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  dir="ltr"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-left font-mono-nums"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+966 5X XXX XXXX"
                  className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-left font-mono-nums"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">المنطقة</label>
                <input
                  type="text"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  placeholder="مثال: القصيم"
                  className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  رقم السجل الزراعي / الهوية
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={newLicense}
                  onChange={(e) => setNewLicense(e.target.value)}
                  placeholder="AGR-000000"
                  className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-left font-mono-nums"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">المدينة / العنوان</label>
                <input
                  type="text"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  placeholder="مثال: بريدة، طريق الملك عبدالعزيز"
                  className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">حالة الحساب</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as FarmerAccountStatus)}
                  className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] bg-white focus:border-[#15803D] focus:outline-none text-xs"
                >
                  <option value="active">نشط</option>
                  <option value="pending">قيد المراجعة</option>
                  <option value="suspended">موقوف</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EEF2EE]">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg border border-[#D4DBD5] text-xs font-medium text-[#475569] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#15803D] text-white text-xs font-semibold hover:bg-[#166534] cursor-pointer"
              >
                إنشاء ملف المزارع
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
