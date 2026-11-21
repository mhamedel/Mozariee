import {
  Check,
  ChevronLeft,
  ChevronRight,
  Expand,
  Eye,
  Hand,
  LayoutGrid,
  Maximize2,
  Minimize2,
  MousePointer2,
  PanelRight,
  PenTool,
  Redo2,
  RotateCcw,
  Save,
  Undo2,
} from 'lucide-react';
import { HIERARCHY_COLORS } from '../data/seedData';
import type { GharsStore } from '../store/useGharsStore';

type EditorToolbarProps = {
  store: GharsStore;
};

export function EditorToolbar({ store }: EditorToolbarProps) {
  const {
    activeFarmer,
    activeFarm,
    activeField,
    activeTool,
    setActiveTool,
    canUndo,
    canRedo,
    hasUnsavedChanges,
    undo,
    redo,
    saveChanges,
    resetToDefault,
    autoArrangeLayout,
    isFarmerPreview,
    setIsFarmerPreview,
    isFullscreen,
    setHideEditorPanels,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    selection,
    setSelection,
    focusedFarmId,
    focusSingleFarm,
    stepFocusedFarm,
    setSelectedVertexIndex,
    requestFitView,
  } = store;

  const allFieldsForFarm = activeFarm?.fields ?? [];
  const allZonesForField = activeField?.zones ?? [];
  const activeZone =
    selection?.kind === 'zone'
      ? allZonesForField.find((z) => z.id === selection.zoneId) ?? allZonesForField[0] ?? null
      : selection?.kind === 'sensor'
        ? (() => {
            const sensor = activeField?.sensors.find((s) => s.id === selection.sensorId);
            return (
              (sensor?.zoneId ? allZonesForField.find((z) => z.id === sensor.zoneId) : null) ??
              allZonesForField[0] ??
              null
            );
          })()
        : allZonesForField[0] ?? null;

  return (
    <div className="bg-white border-b border-[#E2E7E3] shrink-0">
      {/* Row 1: Direct Hierarchical Context & 1-Click Navigation */}
      <div className="px-4 py-2 border-b border-[#EEF2EE] flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs min-w-0 flex-wrap">
          {/* Direct Farm Selector + Single-Farm Focus Toggle */}
          {activeFarmer && activeFarmer.farms.length > 0 ? (
            <>
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: HIERARCHY_COLORS.farm.stroke }}
                title="مزرعة"
              />
              <span className="text-[#64748B] shrink-0">المزرعة:</span>
              <select
                aria-label="التنقل السريع للمزرعة"
                value={activeFarm?.id ?? ''}
                onChange={(e) => {
                  const nextId = e.target.value;
                  if (focusedFarmId !== null) {
                    focusSingleFarm(nextId);
                  } else {
                    setSelection({ kind: 'farm', farmId: nextId });
                    setSelectedVertexIndex(null);
                  }
                }}
                style={
                  selection?.kind === 'farm'
                    ? {
                        borderColor: HIERARCHY_COLORS.farm.stroke,
                        backgroundColor: HIERARCHY_COLORS.farm.bgTint,
                        color: HIERARCHY_COLORS.farm.labelText,
                      }
                    : undefined
                }
                className="px-2 py-1 rounded-md border border-[#D4DBD5] bg-white text-[#0F1F18] text-xs font-semibold cursor-pointer focus:outline-none"
              >
                {activeFarmer.farms.map((fm) => (
                  <option key={fm.id} value={fm.id}>
                    {fm.name}
                  </option>
                ))}
              </select>

              <div className="inline-flex items-center rounded-md border border-[#D4DBD5] bg-[#FAFBF9] p-0.5 gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => focusSingleFarm(null)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                    focusedFarmId === null
                      ? 'bg-[#0F1F18] text-white'
                      : 'text-[#475569] hover:text-[#0F1F18]'
                  }`}
                >
                  كل المزارع
                </button>
                <button
                  type="button"
                  onClick={() =>
                    focusSingleFarm(activeFarm?.id ?? activeFarmer.farms[0]?.id ?? null)
                  }
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                    focusedFarmId !== null
                      ? 'bg-[#15803D] text-white'
                      : 'text-[#475569] hover:text-[#0F1F18]'
                  }`}
                >
                  مزرعة واحدة
                </button>
              </div>

              {activeFarmer.farms.length > 1 && (
                <div className="inline-flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => stepFocusedFarm('prev')}
                    title="المزرعة السابقة"
                    className="p-1 rounded-md border border-[#D4DBD5] bg-white hover:border-[#15803D] text-[#0F1F18] cursor-pointer"
                  >
                    <ChevronRight size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepFocusedFarm('next')}
                    title="المزرعة التالية"
                    className="p-1 rounded-md border border-[#D4DBD5] bg-white hover:border-[#15803D] text-[#0F1F18] cursor-pointer"
                  >
                    <ChevronLeft size={13} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <span className="text-[#64748B]">لا توجد مزارع مسجلة لهذا المزارع بعد</span>
          )}

          {/* Direct Field Selector */}
          {allFieldsForFarm.length > 0 && activeFarm && (
            <>
              <ChevronLeft size={14} className="text-[#94A3B8] shrink-0" />
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: HIERARCHY_COLORS.field.stroke }}
                title="حقل"
              />
              <select
                aria-label="التنقل السريع للحقل"
                value={activeField?.id ?? ''}
                onChange={(e) => {
                  setSelection({
                    kind: 'field',
                    farmId: activeFarm.id,
                    fieldId: e.target.value,
                  });
                  setSelectedVertexIndex(null);
                }}
                style={
                  selection?.kind === 'field'
                    ? {
                        borderColor: HIERARCHY_COLORS.field.stroke,
                        backgroundColor: HIERARCHY_COLORS.field.bgTint,
                        color: HIERARCHY_COLORS.field.labelText,
                      }
                    : undefined
                }
                className="px-2 py-1 rounded-md border border-[#D4DBD5] bg-white text-[#0F1F18] text-xs font-semibold cursor-pointer focus:outline-none"
              >
                {allFieldsForFarm.map((fl) => (
                  <option key={fl.id} value={fl.id}>
                    {fl.name}
                  </option>
                ))}
              </select>
            </>
          )}

          {/* Direct Zone Selector */}
          {allZonesForField.length > 0 && activeFarm && activeField && (
            <>
              <ChevronLeft size={14} className="text-[#94A3B8] shrink-0" />
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: HIERARCHY_COLORS.zone.stroke }}
                title="منطقة"
              />
              <select
                aria-label="التنقل السريع للمنطقة"
                value={activeZone?.id ?? ''}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setSelection({
                    kind: 'zone',
                    farmId: activeFarm.id,
                    fieldId: activeField.id,
                    zoneId: e.target.value,
                  });
                  setSelectedVertexIndex(null);
                }}
                style={
                  selection?.kind === 'zone'
                    ? {
                        borderColor: HIERARCHY_COLORS.zone.stroke,
                        backgroundColor: HIERARCHY_COLORS.zone.bgTint,
                        color: HIERARCHY_COLORS.zone.labelText,
                      }
                    : undefined
                }
                className="px-2 py-1 rounded-md border border-[#D4DBD5] bg-white text-[#0F1F18] text-xs font-semibold cursor-pointer focus:outline-none"
              >
                {allZonesForField.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs shrink-0">
          {isFarmerPreview ? (
            <span className="font-semibold text-[#15803D]">وضع معاينة الفلاح (قراءة ومراقبة)</span>
          ) : (
            <>
              <span className={hasUnsavedChanges ? 'text-amber-700 font-medium' : 'text-[#64748B]'}>
                {hasUnsavedChanges ? 'توجد تعديلات غير محفوظة' : 'جميع التغييرات محفوظة'}
              </span>
              <span className="text-[#CBD5E1]">·</span>
              <button
                type="button"
                onClick={resetToDefault}
                className="inline-flex items-center gap-1 text-[#64748B] hover:text-[#0F1F18] cursor-pointer whitespace-nowrap"
                title="إعادة تعيين للوضع الافتراضي"
              >
                <RotateCcw size={13} />
                <span>إعادة تعيين</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Row 2: Editor Tools */}
      {!isFarmerPreview ? (
        <div className="px-4 py-2 flex items-center justify-between gap-3 flex-wrap bg-[#FAFBF9]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="inline-flex items-center bg-white border border-[#DCE3DD] rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setActiveTool('select')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTool === 'select'
                    ? 'bg-[#15803D] text-white'
                    : 'text-[#334155] hover:bg-[#F1F5F2]'
                }`}
              >
                <MousePointer2 size={14} />
                <span>تحديد</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('pan')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTool === 'pan'
                    ? 'bg-[#15803D] text-white'
                    : 'text-[#334155] hover:bg-[#F1F5F2]'
                }`}
              >
                <Hand size={14} />
                <span>تحريك الخريطة</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('draw')}
                title="انقر حول المحيط ثم انقر على النقطة الأولى لإغلاق الشكل"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTool === 'draw'
                    ? 'bg-[#15803D] text-white'
                    : 'text-[#334155] hover:bg-[#F1F5F2]'
                }`}
              >
                <PenTool size={14} />
                <span>رسم حدود</span>
              </button>
            </div>

            <div className="inline-flex items-center bg-white border border-[#DCE3DD] rounded-lg p-0.5">
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                title="تراجع (Ctrl/Cmd + Z)"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#334155] hover:bg-[#F1F5F2] disabled:opacity-40 disabled:pointer-events-none cursor-pointer whitespace-nowrap shrink-0"
              >
                <Undo2 size={14} />
                <span>تراجع</span>
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                title="إعادة (Ctrl/Cmd + Y)"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#334155] hover:bg-[#F1F5F2] disabled:opacity-40 disabled:pointer-events-none cursor-pointer whitespace-nowrap shrink-0"
              >
                <Redo2 size={14} />
                <span>إعادة</span>
              </button>
            </div>

            {activeFarmer && activeFarmer.farms.length > 0 && (
              <button
                type="button"
                onClick={autoArrangeLayout}
                title="ملاءمة وإعادة ترتيب أحجام المزارع والحقول والمناطق لتكفي اللوحة بالكامل"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#DCE3DD] hover:border-[#15803D] text-xs font-medium text-[#0F1F18] cursor-pointer whitespace-nowrap shrink-0"
              >
                <LayoutGrid size={14} className="text-[#15803D]" />
                <span>مواءمة المساحات</span>
              </button>
            )}

            {activeFarmer && (
              <button
                type="button"
                onClick={requestFitView}
                title="ملاءمة المخطط لملء مساحة الشاشة المتاحة"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#DCE3DD] hover:border-[#15803D] text-xs font-medium text-[#0F1F18] cursor-pointer whitespace-nowrap shrink-0"
              >
                <Maximize2 size={14} className="text-[#15803D]" />
                <span>ملاءمة الشاشة</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={saveChanges}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                hasUnsavedChanges
                  ? 'bg-[#15803D] text-white hover:bg-[#166534]'
                  : 'bg-white border border-[#DCE3DD] text-[#0F1F18] hover:border-[#15803D]'
              }`}
            >
              {hasUnsavedChanges ? <Save size={14} /> : <Check size={14} className="text-[#15803D]" />}
              <span>حفظ التغييرات</span>
            </button>

            <button
              type="button"
              onClick={() => enterFullscreen(true)}
              title="تخطيط كامل على ملء الشاشة (إخفاء القوائم والألواح)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#DCE3DD] hover:border-[#15803D] text-xs font-medium text-[#0F1F18] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Expand size={14} className="text-[#15803D]" />
              <span>تخطيط كامل</span>
            </button>

            <button
              type="button"
              onClick={() => (isFullscreen ? exitFullscreen() : toggleFullscreen(false))}
              title={isFullscreen ? 'خروج من ملء الشاشة (Esc)' : 'توسيع المحرّر لملء الشاشة'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isFullscreen
                  ? 'bg-emerald-50 border-[#15803D] text-[#15803D]'
                  : 'bg-white border-[#DCE3DD] hover:border-[#15803D] text-[#0F1F18]'
              }`}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <PanelRight size={14} />}
              <span>{isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFarmerPreview(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0F1F18] text-white hover:bg-[#1E2F26] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Eye size={14} />
              <span>معاينة كفلاح</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-2 flex items-center justify-between gap-3 flex-wrap bg-[#FAFBF9]">
          <div className="text-xs text-[#475569]">
            انقر على أي دبوس حساس في الخريطة لعرض اسم الجهاز وآخر قراءة ووقت القياس.
          </div>

          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={saveChanges}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                حفظ التعديلات الآن
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (isFullscreen) {
                  setHideEditorPanels(true);
                } else {
                  enterFullscreen(true);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#DCE3DD] hover:border-[#15803D] text-xs font-semibold text-[#0F1F18] cursor-pointer whitespace-nowrap"
            >
              <Expand size={14} className="text-[#15803D]" />
              <span>تخطيط كامل</span>
            </button>
            {isFullscreen && (
              <button
                type="button"
                onClick={exitFullscreen}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#DCE3DD] hover:border-[#0F1F18] text-xs font-semibold text-[#0F1F18] cursor-pointer whitespace-nowrap"
              >
                <Minimize2 size={14} />
                <span>إنهاء ملء الشاشة</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsFarmerPreview(false)}
              className="px-3.5 py-1.5 rounded-lg bg-white border border-[#DCE3DD] hover:border-[#0F1F18] text-xs font-semibold text-[#0F1F18] cursor-pointer whitespace-nowrap"
            >
              العودة للمحرّر
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
