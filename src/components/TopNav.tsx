import { LogOut, Plus, User } from 'lucide-react';
import { useState } from 'react';
import type { Farmer, ShellSection } from '../types/ghars';

type TopNavProps = {
  shellSection: ShellSection;
  onSelectSection: (section: ShellSection) => void;
  isFarmerPreview: boolean;
  onToggleFarmerPreview: () => void;
  farmers: Farmer[];
  activeFarmerId: string;
  onSelectFarmer: (farmerId: string) => void;
  onAddFarmer: (payload: {
    name: string;
    region?: string;
    phone?: string;
    email?: string;
  }) => void;
  accountLabel: string;
  onSignOut: () => void;
};

export function TopNav({
  shellSection,
  onSelectSection,
  isFarmerPreview,
  onToggleFarmerPreview,
  farmers,
  activeFarmerId,
  onSelectFarmer,
  onAddFarmer,
  accountLabel,
  onSignOut,
}: TopNavProps) {
  const [showNewFarmerModal, setShowNewFarmerModal] = useState(false);
  const [newFarmerName, setNewFarmerName] = useState('');
  const [newFarmerRegion, setNewFarmerRegion] = useState('');
  const [newFarmerPhone, setNewFarmerPhone] = useState('');
  const [newFarmerEmail, setNewFarmerEmail] = useState('');

  const handleCreateFarmer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFarmerName.trim()) return;
    onAddFarmer({
      name: newFarmerName,
      region: newFarmerRegion,
      phone: newFarmerPhone,
      email: newFarmerEmail,
    });
    setNewFarmerName('');
    setNewFarmerRegion('');
    setNewFarmerPhone('');
    setNewFarmerEmail('');
    setShowNewFarmerModal(false);
  };

  return (
    <>
      <header className="h-14 shrink-0 bg-white border-b border-[#E2E7E3] px-5 flex items-center justify-between gap-4 lg:gap-6">
        {/* Zone 1: Brand wordmark + Admin context + Farmer selector & registration */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                onSelectSection('editor');
                if (isFarmerPreview) onToggleFarmerPreview();
              }}
              className="text-xl font-bold tracking-tight text-[#0F1F18] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-700 rounded"
            >
              غرس
            </button>
            <span className="text-[11px] font-semibold text-[#64748B] border-r border-[#DCE3DD] pr-2.5 whitespace-nowrap">
              منصة الإدارة
            </span>
          </div>

          <div className="flex items-center gap-2 border-r border-[#DCE3DD] pr-3 text-xs shrink-0">
            <label
              htmlFor="topnav-farmer-select"
              className="text-[#64748B] font-medium whitespace-nowrap shrink-0"
            >
              المزارع:
            </label>
            <select
              id="topnav-farmer-select"
              aria-label="اختيار المزارع"
              value={activeFarmerId}
              onChange={(e) => onSelectFarmer(e.target.value)}
              className="max-w-[185px] px-2.5 py-1.5 rounded-lg border border-[#D4DBD5] bg-[#FAFBF9] hover:border-[#15803D] font-semibold text-[#0F1F18] text-xs focus:bg-white focus:border-[#15803D] focus:outline-none cursor-pointer truncate"
            >
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.region})
                </option>
              ))}
            </select>

            {!isFarmerPreview && (
              <button
                type="button"
                onClick={() => setShowNewFarmerModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#D4DBD5] bg-white hover:border-[#15803D] hover:bg-emerald-50/50 text-[#0F1F18] font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus size={13} className="text-[#15803D]" />
                <span>مزارع جديد</span>
              </button>
            )}
          </div>
        </div>

        {/* Zone 2: Concise single-line text navigation links */}
        <nav aria-label="التنقل الرئيسي" className="flex items-center gap-4 lg:gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => onSelectSection('editor')}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              shellSection === 'editor' && !isFarmerPreview
                ? 'border-[#15803D] text-[#0F1F18] font-semibold'
                : 'border-transparent text-[#475569] hover:text-[#0F1F18]'
            }`}
          >
            محاكي الخرائط
          </button>

          <button
            type="button"
            onClick={() => onSelectSection('devices')}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              shellSection === 'devices' && !isFarmerPreview
                ? 'border-[#15803D] text-[#0F1F18] font-semibold'
                : 'border-transparent text-[#475569] hover:text-[#0F1F18]'
            }`}
          >
            الأجهزة والقراءات
          </button>

          <button
            type="button"
            onClick={() => onSelectSection('farmer-settings')}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              shellSection === 'farmer-settings' && !isFarmerPreview
                ? 'border-[#15803D] text-[#0F1F18] font-semibold'
                : 'border-transparent text-[#475569] hover:text-[#0F1F18]'
            }`}
          >
            إعدادات المزارع
          </button>

          <button
            type="button"
            onClick={() => onSelectSection('sensor-details')}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              shellSection === 'sensor-details' && !isFarmerPreview
                ? 'border-[#15803D] text-[#0F1F18] font-semibold'
                : 'border-transparent text-[#475569] hover:text-[#0F1F18]'
            }`}
          >
            التفاصيل
          </button>
        </nav>

        {/* Zone 3: Side actions (Preview, Account Info, Sign Out) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onSelectSection('editor');
              onToggleFarmerPreview();
            }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-700 ${
              isFarmerPreview
                ? 'bg-[#0F1F18] text-white hover:bg-[#1E2F26]'
                : 'bg-[#15803D] text-white hover:bg-[#166534]'
            }`}
          >
            {isFarmerPreview ? 'العودة للمحرّر' : 'معاينة كفلاح'}
          </button>

          <button
            type="button"
            onClick={() => onSelectSection('account-info')}
            title={`معلومات الحساب (${accountLabel})`}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              shellSection === 'account-info' && !isFarmerPreview
                ? 'border-[#15803D] bg-emerald-50 text-[#15803D]'
                : 'border-[#D4DBD5] bg-white hover:border-[#15803D] text-[#0F1F18]'
            }`}
          >
            <User size={13} className="text-[#15803D]" />
            <span>معلومات الحساب</span>
          </button>

          <button
            type="button"
            onClick={onSignOut}
            title={`تسجيل الخروج (${accountLabel})`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-[#D4DBD5] bg-white hover:border-red-300 hover:bg-red-50 text-[#334155] hover:text-red-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut size={13} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </header>

      {showNewFarmerModal && (
        <div className="fixed inset-0 z-[1500] bg-black/35 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateFarmer}
            className="w-full max-w-md bg-white rounded-xl border border-[#E2E7E3] shadow-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0F1F18]">إضافة مزارع جديد</h3>
              <button
                type="button"
                onClick={() => setShowNewFarmerModal(false)}
                className="text-xs text-[#64748B] hover:text-[#0F1F18] cursor-pointer"
              >
                إغلاق
              </button>
            </div>
            <p className="text-xs text-[#64748B]">
              سيتم إنشاء مخطط جاهز للمزارع الجديد لتتمكن من إسقاط المزرعة والحقول والمناطق والحساسات مباشرة.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#475569] mb-1">اسم المزارع</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="مثال: خالد العتيبي"
                  value={newFarmerName}
                  onChange={(e) => setNewFarmerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#475569] mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    dir="ltr"
                    placeholder="name@example.com"
                    value={newFarmerEmail}
                    onChange={(e) => setNewFarmerEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-left font-mono-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#475569] mb-1">رقم الهاتف</label>
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="+966 5X XXX XXXX"
                    value={newFarmerPhone}
                    onChange={(e) => setNewFarmerPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-left font-mono-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-[#475569] mb-1">المنطقة</label>
                <input
                  type="text"
                  placeholder="مثال: القصيم"
                  value={newFarmerRegion}
                  onChange={(e) => setNewFarmerRegion(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewFarmerModal(false)}
                className="px-4 py-2 rounded-lg border border-[#D4DBD5] text-xs font-medium text-[#475569] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#15803D] text-white text-xs font-semibold hover:bg-[#166534] cursor-pointer"
              >
                إنشاء وفتح اللوحة
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
