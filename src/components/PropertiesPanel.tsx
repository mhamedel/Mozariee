import {
  AlertTriangle,
  ArrowRight,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Radio,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  HIERARCHY_COLORS,
  MEASUREMENT_META,
  SENSOR_META,
  formatReadingTimeArabic,
} from '../data/seedData';
import type { GharsStore } from '../store/useGharsStore';
import type { MeasurementType } from '../types/ghars';
import { getPlanHeight, getPlanWidth } from '../utils/geometry';

type PropertiesPanelProps = {
  store: GharsStore;
};

export function PropertiesPanel({ store }: PropertiesPanelProps) {
  const {
    activeFarmer,
    selection,
    focusedFarmId,
    focusSingleFarm,
    selectedVertexIndex,
    updateFarmProps,
    updateFieldProps,
    updateZoneProps,
    updateSensorProps,
    openSensorPopup,
    removeBoundaryVertex,
    expandPlanCanvas,
    autoArrangeLayout,
    deleteSelection,
    isDeviceIdDuplicate,
  } = store;

  const selectedFarm =
    selection?.kind === 'farm'
      ? activeFarmer?.farms.find((fm) => fm.id === selection.farmId) ?? null
      : null;

  const selectedField =
    selection?.kind === 'field'
      ? activeFarmer?.farms
          .find((fm) => fm.id === selection.farmId)
          ?.fields.find((fl) => fl.id === selection.fieldId) ?? null
      : null;

  const selectedZone =
    selection?.kind === 'zone'
      ? activeFarmer?.farms
          .find((fm) => fm.id === selection.farmId)
          ?.fields.find((fl) => fl.id === selection.fieldId)
          ?.zones.find((z) => z.id === selection.zoneId) ?? null
      : null;

  const selectedSensor =
    selection?.kind === 'sensor'
      ? activeFarmer?.farms
          .find((fm) => fm.id === selection.farmId)
          ?.fields.find((fl) => fl.id === selection.fieldId)
          ?.sensors.find((s) => s.id === selection.sensorId) ?? null
      : null;

  const fieldParentFarm =
    selection?.kind === 'field'
      ? activeFarmer?.farms.find((fm) => fm.id === selection.farmId) ?? null
      : null;

  const sensorParentFarm =
    selection?.kind === 'sensor'
      ? activeFarmer?.farms.find((fm) => fm.id === selection.farmId) ?? null
      : null;
  const sensorParentField =
    selection?.kind === 'sensor'
      ? sensorParentFarm?.fields.find((fl) => fl.id === selection.fieldId) ?? null
      : null;

  const zoneParentFarm =
    selection?.kind === 'zone'
      ? activeFarmer?.farms.find((fm) => fm.id === selection.farmId) ?? null
      : null;
  const zoneParentField =
    selection?.kind === 'zone'
      ? zoneParentFarm?.fields.find((fl) => fl.id === selection.fieldId) ?? null
      : null;

  const renderResizeControls = () => {
    if (!selection || selection.kind === 'sensor') {
      return null;
    }
    return (
      <div className="border-t border-[#EEF2EE] pt-3 space-y-2">
        <div className="font-semibold text-[#0F1F18]">تعديل الحجم وإمكانية التوسيع</div>
        {selection.kind === 'farm' && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => expandPlanCanvas(1.25)}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#15803D]/35 bg-emerald-50/70 hover:bg-emerald-100/70 text-[11px] font-semibold text-[#14532D] cursor-pointer"
            >
              <Maximize2 size={12} />
              <span>توسيع المخطط</span>
            </button>
            <button
              type="button"
              onClick={() => expandPlanCanvas(0.8)}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E2E7E3] hover:border-[#15803D] bg-white text-[11px] font-medium text-[#475569] hover:text-[#0F1F18] cursor-pointer"
            >
              <Minimize2 size={12} />
              <span>تقليص المخطط</span>
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={autoArrangeLayout}
          className="w-full py-1.5 rounded-md border border-[#E2E7E3] hover:border-[#15803D] text-[11px] font-medium text-[#475569] hover:text-[#0F1F18] cursor-pointer"
        >
          إعادة توزيع ومواءمة جميع العناصر تلقائياً
        </button>
      </div>
    );
  };

  return (
    <aside
      aria-label="لوحة الخصائص"
      className="w-80 shrink-0 bg-white border-r border-[#E2E7E3] flex flex-col overflow-y-auto"
    >
      <div className="px-4 py-3.5 border-b border-[#E2E7E3] flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#0F1F18]">لوحة الخصائص</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            {selection ? 'تعديل بيانات العنصر المحدد' : 'اختر عنصراً من الخريطة لتعديله'}
          </p>
        </div>
      </div>

      {/* Empty / Farmer Summary */}
      {!selection && activeFarmer && (
        <div className="p-4 space-y-5 text-xs">
          <div className="space-y-1">
            <div className="text-[#64748B]">المخطط الحالي</div>
            <div className="text-sm font-bold text-[#0F1F18]">{activeFarmer.name}</div>
            <div className="text-[#475569]">
              {activeFarmer.farms.length} مزارع ·{' '}
              {activeFarmer.farms.reduce((s, fm) => s + fm.fields.length, 0)} حقول ·{' '}
              {activeFarmer.farms.reduce(
                (s, fm) => s + fm.fields.reduce((a, fl) => a + fl.sensors.length, 0),
                0
              )}{' '}
              أجهزة
            </div>
          </div>

          <div className="border-t border-[#EEF2EE] pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#0F1F18]">مساحة المخطط</span>
              <span className="font-mono-nums text-[11px] text-[#64748B]">
                {getPlanWidth(activeFarmer.planWidth)} ×{' '}
                {getPlanHeight(
                  'blank',
                  activeFarmer.imageAspectRatio,
                  activeFarmer.planWidth,
                  activeFarmer.planHeight
                )}
              </span>
            </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => expandPlanCanvas(1.25)}
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-[#15803D]/35 bg-emerald-50/70 hover:bg-emerald-100/70 text-[11px] font-semibold text-[#14532D] cursor-pointer"
                >
                  <Maximize2 size={13} />
                  <span>توسيع المخطط</span>
                </button>
                <button
                  type="button"
                  onClick={() => expandPlanCanvas(0.8)}
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-[#D4DBD5] hover:border-[#15803D] bg-[#FAFBF9] text-[11px] font-medium text-[#0F1F18] cursor-pointer"
                >
                  <Minimize2 size={13} className="text-[#15803D]" />
                  <span>تصغير المخطط</span>
                </button>
              </div>
          </div>

          {activeFarmer.farms.length > 0 && (
            <div className="border-t border-[#EEF2EE] pt-4 space-y-2">
              <div className="font-semibold text-[#0F1F18]">التنقل المباشر</div>
              <div className="space-y-1.5">
                {activeFarmer.farms.map((fm) => (
                  <div key={fm.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => store.setSelection({ kind: 'farm', farmId: fm.id })}
                      style={{
                        backgroundColor: HIERARCHY_COLORS.farm.bgTint,
                        borderColor: HIERARCHY_COLORS.farm.borderTint,
                        borderRightColor: HIERARCHY_COLORS.farm.stroke,
                        borderRightWidth: 4,
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md border font-semibold text-[#0F1F18] cursor-pointer hover:shadow-xs"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: HIERARCHY_COLORS.farm.stroke }}
                        />
                        <span className="truncate">{fm.name}</span>
                      </span>
                      <span className="text-[11px] text-[#475569]">{fm.fields.length} حقول</span>
                    </button>
                    {fm.fields.map((fl) => (
                      <button
                        key={fl.id}
                        type="button"
                        onClick={() =>
                          store.setSelection({ kind: 'field', farmId: fm.id, fieldId: fl.id })
                        }
                        style={{
                          backgroundColor: HIERARCHY_COLORS.field.bgTint,
                          borderColor: HIERARCHY_COLORS.field.borderTint,
                          borderRightColor: HIERARCHY_COLORS.field.stroke,
                          borderRightWidth: 4,
                        }}
                        className="w-[92%] mr-auto flex items-center justify-between px-2.5 py-1.5 rounded-md border text-[#0F1F18] cursor-pointer hover:shadow-xs"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: HIERARCHY_COLORS.field.stroke }}
                          />
                          <span className="truncate">{fl.name}</span>
                        </span>
                        <span className="text-[11px] text-[#475569]">{fl.zones.length} مناطق</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Farm Inspector */}
      {selectedFarm && (
        <div className="p-4 space-y-4 text-xs">
          <div
            style={{
              backgroundColor: HIERARCHY_COLORS.farm.bgTint,
              borderColor: HIERARCHY_COLORS.farm.borderTint,
              borderRightColor: HIERARCHY_COLORS.farm.stroke,
              borderRightWidth: 4,
            }}
            className="flex items-center justify-between px-3 py-2 rounded-lg border"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm border border-dashed shrink-0"
                style={{
                  backgroundColor: HIERARCHY_COLORS.farm.labelBg,
                  borderColor: HIERARCHY_COLORS.farm.stroke,
                }}
              />
              <span className="font-bold text-sm" style={{ color: HIERARCHY_COLORS.farm.labelText }}>
                خصائص المزرعة
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                focusSingleFarm(focusedFarmId === selectedFarm.id ? null : selectedFarm.id)
              }
              className="px-2 py-1 rounded-md border border-[#D97706]/35 bg-white hover:bg-amber-50 text-[11px] font-semibold text-[#92400E] cursor-pointer whitespace-nowrap"
            >
              {focusedFarmId === selectedFarm.id ? 'عرض كل المزارع' : 'تخطيط هذه المزرعة فقط'}
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block font-medium text-[#475569] mb-1">اسم المزرعة</label>
              <input
                type="text"
                value={selectedFarm.name}
                onChange={(e) => updateFarmProps(selectedFarm.id, { name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18]"
              />
            </div>

            <div>
              <label className="block font-medium text-[#475569] mb-1">المنطقة / الموقع</label>
              <input
                type="text"
                value={selectedFarm.region}
                onChange={(e) => updateFarmProps(selectedFarm.id, { region: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18]"
              />
            </div>
          </div>

          <div className="border-t border-[#EEF2EE] pt-3 space-y-2">
            <div className="font-semibold text-[#0F1F18]">
              الحقول التابعة ({selectedFarm.fields.length})
            </div>
            {selectedFarm.fields.length === 0 ? (
              <p className="text-[#64748B]">اسحب عنصر «حقل» وأفلته داخل حدود هذه المزرعة.</p>
            ) : (
              <div className="space-y-1.5">
                {selectedFarm.fields.map((fl) => (
                  <button
                    key={fl.id}
                    type="button"
                    onClick={() =>
                      store.setSelection({
                        kind: 'field',
                        farmId: selectedFarm.id,
                        fieldId: fl.id,
                      })
                    }
                    style={{
                      backgroundColor: HIERARCHY_COLORS.field.bgTint,
                      borderColor: HIERARCHY_COLORS.field.borderTint,
                      borderRightColor: HIERARCHY_COLORS.field.stroke,
                      borderRightWidth: 3,
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg border cursor-pointer hover:shadow-xs"
                  >
                    <span className="flex items-center gap-1.5 font-medium text-[#0F1F18] truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: HIERARCHY_COLORS.field.stroke }}
                      />
                      <span className="truncate">{fl.name}</span>
                    </span>
                    <span className="text-[11px] text-[#475569] shrink-0">
                      {fl.zones.length} مناطق · {fl.sensors.length} أجهزة
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {renderResizeControls()}

          {selectedVertexIndex !== null && (
            <div className="border-t border-[#EEF2EE] pt-3 flex items-center justify-between">
              <span className="text-[#475569]">الزاوية المحددة: #{selectedVertexIndex + 1}</span>
              <button
                type="button"
                onClick={() => removeBoundaryVertex(selection, selectedVertexIndex)}
                className="px-2.5 py-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50 font-medium cursor-pointer"
              >
                حذف الزاوية
              </button>
            </div>
          )}

          <div className="border-t border-[#EEF2EE] pt-3">
            <button
              type="button"
              onClick={deleteSelection}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-medium cursor-pointer"
            >
              <Trash2 size={14} />
              <span>حذف المزرعة</span>
            </button>
          </div>
        </div>
      )}

      {/* Field Inspector */}
      {selectedField && (
        <div className="p-4 space-y-4 text-xs">
          <div
            style={{
              backgroundColor: HIERARCHY_COLORS.field.bgTint,
              borderColor: HIERARCHY_COLORS.field.borderTint,
              borderRightColor: HIERARCHY_COLORS.field.stroke,
              borderRightWidth: 4,
            }}
            className="flex items-center justify-between px-3 py-2 rounded-lg border"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: HIERARCHY_COLORS.field.stroke }}
              />
              <span className="font-bold text-sm" style={{ color: HIERARCHY_COLORS.field.labelText }}>
                خصائص الحقل
              </span>
            </div>
            {fieldParentFarm && (
              <button
                type="button"
                onClick={() => store.setSelection({ kind: 'farm', farmId: fieldParentFarm.id })}
                className="inline-flex items-center gap-1 text-[11px] font-semibold hover:underline cursor-pointer"
                style={{ color: HIERARCHY_COLORS.farm.labelText }}
              >
                <ArrowRight size={12} />
                <span>{fieldParentFarm.name}</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block font-medium text-[#475569] mb-1">اسم الحقل</label>
              <input
                type="text"
                value={selectedField.name}
                onChange={(e) =>
                  updateFieldProps(selectedField.farmId, selectedField.id, { name: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18]"
              />
            </div>

            <div>
              <label className="block font-medium text-[#475569] mb-1">المحصول الرئيسي</label>
              <input
                type="text"
                value={selectedField.cropType}
                onChange={(e) =>
                  updateFieldProps(selectedField.farmId, selectedField.id, { cropType: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18]"
              />
            </div>
          </div>

          <div className="border-t border-[#EEF2EE] pt-3 space-y-2">
            <div className="font-semibold text-[#0F1F18]">
              المناطق داخل الحقل ({selectedField.zones.length})
            </div>
            {selectedField.zones.length === 0 ? (
              <p className="text-[#64748B]">اسحب «منطقة» أو ارسم حدوداً داخل هذا الحقل.</p>
            ) : (
              <div className="space-y-1">
                {selectedField.zones.map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() =>
                      store.setSelection({
                        kind: 'zone',
                        farmId: selectedField.farmId,
                        fieldId: selectedField.id,
                        zoneId: z.id,
                      })
                    }
                    style={{
                      backgroundColor: HIERARCHY_COLORS.zone.bgTint,
                      borderColor: HIERARCHY_COLORS.zone.borderTint,
                      borderRightColor: z.color,
                      borderRightWidth: 3,
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded border cursor-pointer hover:shadow-xs"
                  >
                    <span className="flex items-center gap-1.5 font-medium text-[#0F1F18] truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: z.color }}
                      />
                      <span className="truncate">{z.name}</span>
                    </span>
                    <span className="font-mono-nums text-[11px] text-[#475569]">
                      {selectedField.sensors.filter((s) => s.zoneId === z.id).length} أجهزة
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {renderResizeControls()}

          {selectedVertexIndex !== null && (
            <div className="border-t border-[#EEF2EE] pt-3 flex items-center justify-between">
              <span className="text-[#475569]">الزاوية المحددة: #{selectedVertexIndex + 1}</span>
              <button
                type="button"
                onClick={() => removeBoundaryVertex(selection, selectedVertexIndex)}
                className="px-2.5 py-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50 font-medium cursor-pointer"
              >
                حذف الزاوية
              </button>
            </div>
          )}

          <div className="border-t border-[#EEF2EE] pt-3">
            <button
              type="button"
              onClick={deleteSelection}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-medium cursor-pointer"
            >
              <Trash2 size={14} />
              <span>حذف الحقل</span>
            </button>
          </div>
        </div>
      )}

      {/* Zone Inspector */}
      {selectedZone && zoneParentFarm && zoneParentField && (
        <div className="p-4 space-y-4 text-xs">
          <div
            style={{
              backgroundColor: HIERARCHY_COLORS.zone.bgTint,
              borderColor: HIERARCHY_COLORS.zone.borderTint,
              borderRightColor: selectedZone.color,
              borderRightWidth: 4,
            }}
            className="flex items-center justify-between px-3 py-2 rounded-lg border"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: selectedZone.color }}
              />
              <span className="font-bold text-sm" style={{ color: HIERARCHY_COLORS.zone.labelText }}>
                خصائص المنطقة
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                store.setSelection({
                  kind: 'field',
                  farmId: zoneParentFarm.id,
                  fieldId: zoneParentField.id,
                })
              }
              className="inline-flex items-center gap-1 text-[11px] font-semibold hover:underline cursor-pointer"
              style={{ color: HIERARCHY_COLORS.field.labelText }}
            >
              <ArrowRight size={12} />
              <span>{zoneParentField.name}</span>
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block font-medium text-[#475569] mb-1">اسم المنطقة</label>
              <input
                type="text"
                value={selectedZone.name}
                onChange={(e) =>
                  updateZoneProps(zoneParentFarm.id, zoneParentField.id, selectedZone.id, {
                    name: e.target.value,
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18]"
              />
            </div>

            <div>
              <label className="block font-medium text-[#475569] mb-1">المحصول</label>
              <input
                type="text"
                value={selectedZone.cropOrNote}
                onChange={(e) =>
                  updateZoneProps(zoneParentFarm.id, zoneParentField.id, selectedZone.id, {
                    cropOrNote: e.target.value,
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18]"
              />
            </div>
          </div>

          <div className="border-t border-[#EEF2EE] pt-3 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-[#0F1F18]">
              <Layers size={14} className="text-[#15803D]" />
              <span>
                الأجهزة داخل المنطقة (
                {zoneParentField.sensors.filter((s) => s.zoneId === selectedZone.id).length})
              </span>
            </div>
            {zoneParentField.sensors.filter((s) => s.zoneId === selectedZone.id).length === 0 ? (
              <p className="text-[#64748B]">اسحب حساساً وأفلته داخل هذه المنطقة لربطه بها.</p>
            ) : (
              <div className="space-y-1">
                {zoneParentField.sensors
                  .filter((s) => s.zoneId === selectedZone.id)
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        store.setSelection({
                          kind: 'sensor',
                          farmId: zoneParentFarm.id,
                          fieldId: zoneParentField.id,
                          sensorId: s.id,
                        })
                      }
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-[#FAFBF9] border border-[#E2E7E3] hover:border-[#15803D] cursor-pointer"
                    >
                      <span className="font-medium text-[#0F1F18] truncate">{s.name}</span>
                      <span className="font-mono-nums text-[11px] text-[#64748B]">{s.deviceId}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {renderResizeControls()}

          {selectedVertexIndex !== null && (
            <div className="border-t border-[#EEF2EE] pt-3 flex items-center justify-between">
              <span className="text-[#475569]">الزاوية المحددة: #{selectedVertexIndex + 1}</span>
              <button
                type="button"
                onClick={() => removeBoundaryVertex(selection, selectedVertexIndex)}
                className="px-2.5 py-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50 font-medium cursor-pointer"
              >
                حذف الزاوية
              </button>
            </div>
          )}

          <div className="border-t border-[#EEF2EE] pt-3">
            <button
              type="button"
              onClick={deleteSelection}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-medium cursor-pointer"
            >
              <Trash2 size={14} />
              <span>حذف المنطقة</span>
            </button>
          </div>
        </div>
      )}

      {/* Sensor Inspector */}
      {selectedSensor && sensorParentFarm && sensorParentField && (
        <div className="p-4 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-[#0F1F18]">خصائص الجهاز / الحساس</span>
            <span className="font-medium text-[#475569]">
              {SENSOR_META[selectedSensor.type].shortLabel}
            </span>
          </div>

          <div className="p-2.5 rounded-lg border border-[#E2E7E3] bg-[#FAFBF9] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">حالة الاتصال والقراءة</span>
              <span className="flex items-center gap-1 font-semibold text-[#0F1F18]">
                <Radio
                  size={13}
                  className={selectedSensor.lastReadingAt ? 'text-[#15803D]' : 'text-amber-600'}
                />
                <span>{selectedSensor.lastReadingAt ? 'متصل · مسجّل' : 'في انتظار أول قراءة'}</span>
              </span>
            </div>
            {selectedSensor.lastReadingAt && (
              <div className="text-[11px] text-[#64748B]">
                آخر قراءة: {formatReadingTimeArabic(selectedSensor.lastReadingAt)}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => openSensorPopup(selectedSensor.id, 'chart')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#15803D]/35 bg-emerald-50/60 hover:bg-emerald-100/70 text-xs font-semibold text-[#14532D] cursor-pointer transition-colors"
          >
            <TrendingUp size={14} className="text-[#15803D]" />
            <span>تغيّر القراءات ليوم واحد</span>
          </button>

          <div className="space-y-3">
            <div>
              <label className="block font-medium text-[#475569] mb-1">اسم الجهاز</label>
              <input
                type="text"
                value={selectedSensor.name}
                onChange={(e) =>
                  updateSensorProps(sensorParentFarm.id, sensorParentField.id, selectedSensor.id, {
                    name: e.target.value,
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs text-[#0F1F18]"
              />
            </div>

            <div>
              <label className="block font-medium text-[#475569] mb-1">
                المعرّف الفريد للجهاز (Device ID)
              </label>
              <input
                type="text"
                dir="ltr"
                value={selectedSensor.deviceId}
                onChange={(e) =>
                  updateSensorProps(sensorParentFarm.id, sensorParentField.id, selectedSensor.id, {
                    deviceId: e.target.value,
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-[#D4DBD5] focus:border-[#15803D] focus:outline-none text-xs font-mono-nums text-[#0F1F18]"
              />
              {isDeviceIdDuplicate(selectedSensor.deviceId, selectedSensor.id) && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-red-700 font-medium">
                  <AlertTriangle size={12} />
                  <span>هذا المعرّف مستخدم بالفعل في جهاز آخر</span>
                </div>
              )}
            </div>

            <div className="p-2.5 rounded-lg border border-[#E2E7E3] space-y-2 bg-white">
              <div className="flex items-center gap-1.5 font-semibold text-[#0F1F18]">
                <MapPin size={13} className="text-[#15803D]" />
                <span>التعيين المكاني المستنتج</span>
              </div>
              <div className="text-[11px] text-[#475569]">
                {sensorParentFarm.name} / {sensorParentField.name}
              </div>
              <div>
                <label className="block text-[11px] text-[#64748B] mb-1">المنطقة</label>
                <select
                  value={selectedSensor.zoneId ?? ''}
                  onChange={(e) =>
                    updateSensorProps(sensorParentFarm.id, sensorParentField.id, selectedSensor.id, {
                      zoneId: e.target.value || null,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-[#D4DBD5] text-xs bg-white text-[#0F1F18]"
                >
                  <option value="">خارج المناطق المحددة</option>
                  {sensorParentField.zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="font-mono-nums text-[11px] text-[#64748B] flex items-center justify-between pt-0.5">
                <span>
                  مخطط: ({Math.round(selectedSensor.schematicPos.x)},{' '}
                  {Math.round(selectedSensor.schematicPos.y)})
                </span>
                <span>
                  GPS: {selectedSensor.geoPos.lat.toFixed(4)}, {selectedSensor.geoPos.lng.toFixed(4)}
                </span>
              </div>
            </div>

            <div>
              <label className="block font-medium text-[#475569] mb-1.5">
                القياسات المرتبطة ({selectedSensor.measurements.length})
              </label>
              <div className="space-y-1.5">
                {(Object.keys(MEASUREMENT_META) as MeasurementType[]).map((mKey) => {
                  const meta = MEASUREMENT_META[mKey];
                  const enabled = selectedSensor.measurements.includes(mKey);
                  const isMulti = selectedSensor.type === 'multi';
                  const currentVal = selectedSensor.readings[mKey];

                  return (
                    <div
                      key={mKey}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded border border-[#E2E7E3] bg-[#FAFBF9]"
                    >
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enabled}
                          disabled={!isMulti && enabled && selectedSensor.measurements.length === 1}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...selectedSensor.measurements, mKey]
                              : selectedSensor.measurements.filter((x) => x !== mKey);
                            if (next.length > 0) {
                              updateSensorProps(
                                sensorParentFarm.id,
                                sensorParentField.id,
                                selectedSensor.id,
                                { measurements: next }
                              );
                            }
                          }}
                          className="accent-[#15803D]"
                        />
                        <span className="text-[#0F1F18] font-medium">{meta.label}</span>
                      </label>
                      <span className="font-mono-nums text-[11px] text-[#475569]">
                        {currentVal ? `${currentVal.value} ${currentVal.unit}` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-[#EEF2EE] pt-3">
            <button
              type="button"
              onClick={deleteSelection}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-medium cursor-pointer"
            >
              <Trash2 size={14} />
              <span>حذف الجهاز</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
