import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  MEASUREMENT_META,
  SENSOR_META,
  formatReadingTimeArabic,
} from '../data/seedData';
import type { GharsStore } from '../store/useGharsStore';

type OverviewAndDevicesViewProps = {
  store: GharsStore;
};

export function OverviewAndDevicesView({ store }: OverviewAndDevicesViewProps) {
  const {
    savedWorkspace,
    selectFarmer,
    setShellSection,
    setSelection,
    recordTestReading,
  } = store;

  const [query, setQuery] = useState('');

  const allSensors = useMemo(() => {
    const rows: {
      farmerId: string;
      farmerName: string;
      farmId: string;
      farmName: string;
      fieldId: string;
      fieldName: string;
      zoneName: string;
      sensor: (typeof savedWorkspace.farmers)[number]['farms'][number]['fields'][number]['sensors'][number];
    }[] = [];

    savedWorkspace.farmers.forEach((farmer) => {
      farmer.farms.forEach((farm) => {
        farm.fields.forEach((field) => {
          field.sensors.forEach((sensor) => {
            const zone = field.zones.find((z) => z.id === sensor.zoneId);
            rows.push({
              farmerId: farmer.id,
              farmerName: farmer.name,
              farmId: farm.id,
              farmName: farm.name,
              fieldId: field.id,
              fieldName: field.name,
              zoneName: zone?.name ?? 'خارج المناطق',
              sensor,
            });
          });
        });
      });
    });

    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.sensor.name.toLowerCase().includes(q) ||
        r.sensor.deviceId.toLowerCase().includes(q) ||
        r.farmName.toLowerCase().includes(q) ||
        r.fieldName.toLowerCase().includes(q) ||
        r.zoneName.toLowerCase().includes(q)
    );
  }, [query, savedWorkspace]);

  return (
    <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-6xl w-full mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#0F1F18]">الأجهزة والقراءات الميدانية</h1>
          <p className="text-xs text-[#64748B] mt-1">
            جدول الحساسات المثبتة عبر المزارع والحقول المحفوظة مع آخر القراءات المسجلة.
          </p>
        </div>

        <div className="relative w-72">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث باسم الجهاز أو المعرّف أو المنطقة..."
            className="w-full pr-8 pl-3 py-2 rounded-lg border border-[#D4DBD5] bg-white text-xs focus:border-[#15803D] focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-white border border-[#E2E7E3] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E2E7E3] bg-[#FAFBF9] text-[#475569]">
                <th className="py-3 px-4 font-semibold">اسم الجهاز</th>
                <th className="py-3 px-4 font-semibold">المعرّف الفريد</th>
                <th className="py-3 px-4 font-semibold">النوع</th>
                <th className="py-3 px-4 font-semibold">الموقع (المزرعة / الحقل / المنطقة)</th>
                <th className="py-3 px-4 font-semibold">آخر قراءة</th>
                <th className="py-3 px-4 font-semibold">وقت القياس</th>
                <th className="py-3 px-4 font-semibold">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EE]">
              {allSensors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#64748B]">
                    لا توجد أجهزة مطابقة للبحث. أضف الحساسات من «محرّر الخرائط» ثم احفظ التغييرات.
                  </td>
                </tr>
              ) : (
                allSensors.map((row) => {
                  const s = row.sensor;
                  const meta = SENSOR_META[s.type];
                  const firstKey = s.measurements[0];
                  const readingSummary = s.lastReadingAt
                    ? s.measurements
                        .map((m) => {
                          const r = s.readings[m];
                          return r ? `${MEASUREMENT_META[m].label}: ${r.value} ${r.unit}` : null;
                        })
                        .filter(Boolean)
                        .join(' · ')
                    : firstKey
                    ? 'في انتظار أول قراءة'
                    : '—';

                  return (
                    <tr key={s.id} className="hover:bg-[#FAFBF9]">
                      <td className="py-3 px-4 font-semibold text-[#0F1F18]">{s.name}</td>
                      <td className="py-3 px-4 font-mono-nums text-[#475569]">{s.deviceId}</td>
                      <td className="py-3 px-4 text-[#334155]">{meta.label}</td>
                      <td className="py-3 px-4 text-[#475569]">
                        {row.farmName} / {row.fieldName} / {row.zoneName}
                      </td>
                      <td className="py-3 px-4 font-mono-nums text-[#0F1F18]">{readingSummary}</td>
                      <td className="py-3 px-4 text-[#64748B]">
                        {formatReadingTimeArabic(s.lastReadingAt)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              selectFarmer(row.farmerId);
                              setSelection({
                                kind: 'sensor',
                                farmId: row.farmId,
                                fieldId: row.fieldId,
                                sensorId: s.id,
                              });
                              setShellSection('editor');
                            }}
                            className="text-[#15803D] font-semibold hover:underline cursor-pointer whitespace-nowrap"
                          >
                            عرض على الخريطة
                          </button>
                          {!s.lastReadingAt && (
                            <button
                              type="button"
                              onClick={() =>
                                recordTestReading(row.farmId, row.fieldId, s.id, s.measurements)
                              }
                              className="text-[#475569] hover:text-[#0F1F18] underline cursor-pointer whitespace-nowrap"
                            >
                              قراءة اختبارية
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
