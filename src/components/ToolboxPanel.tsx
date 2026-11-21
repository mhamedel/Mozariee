import type React from 'react';
import {
  Cpu,
  Droplets,
  FlaskConical,
  Grid,
  GripVertical,
  Layers,
  Map as MapIcon,
  Thermometer,
  Zap,
} from 'lucide-react';
import { HIERARCHY_COLORS, TOOLBOX_ITEMS } from '../data/seedData';
import type { ToolboxItemType } from '../types/ghars';

type ToolboxPanelProps = {
  onStartToolboxDrag: (itemType: ToolboxItemType, label: string, e: React.PointerEvent) => void;
};

export function renderToolboxIcon(itemType: ToolboxItemType, color: string) {
  const props = { size: 17, strokeWidth: 1.9, style: { color } };
  switch (itemType) {
    case 'farm':
      return <MapIcon {...props} />;
    case 'field':
      return <Grid {...props} />;
    case 'zone':
      return <Layers {...props} />;
    case 'moisture':
      return <Droplets {...props} />;
    case 'ec':
      return <Zap {...props} />;
    case 'ph':
      return <FlaskConical {...props} />;
    case 'temp':
      return <Thermometer {...props} />;
    case 'multi':
      return <Cpu {...props} />;
  }
}

export function ToolboxPanel({ onStartToolboxDrag }: ToolboxPanelProps) {
  const structureItems = TOOLBOX_ITEMS.filter((i) => i.category === 'structure');
  const sensorItems = TOOLBOX_ITEMS.filter((i) => i.category === 'sensor');

  return (
    <aside
      aria-label="صندوق الأدوات"
      className="w-64 shrink-0 bg-white border-l border-[#E2E7E3] flex flex-col select-none overflow-y-auto"
    >
      <div className="px-4 py-3.5 border-b border-[#E2E7E3]">
        <h2 className="text-sm font-bold text-[#0F1F18]">صندوق الأدوات</h2>
        <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
          اسحب أي عنصر أو حساس وأفلته مباشرة في موقعه على الخريطة
        </p>
      </div>

      <div className="p-3 space-y-5 flex-1">
        {/* Structure items */}
        <section>
          <div className="px-1.5 mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#475569]">الحدود والمساحات</h3>
            <span className="text-[11px] text-[#64748B]">سحب وإفلات</span>
          </div>
          <div className="space-y-2">
            {structureItems.map((item) => {
              const levelColors =
                item.itemType === 'farm'
                  ? HIERARCHY_COLORS.farm
                  : item.itemType === 'field'
                  ? HIERARCHY_COLORS.field
                  : HIERARCHY_COLORS.zone;
              return (
                <div
                  key={item.itemType}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    onStartToolboxDrag(item.itemType, item.label, e);
                  }}
                  title={item.hint}
                  style={{
                    backgroundColor: levelColors.bgTint,
                    borderColor: levelColors.borderTint,
                    borderRightColor: levelColors.stroke,
                    borderRightWidth: 4,
                  }}
                  className="group flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg border transition-all hover:shadow-sm cursor-grab active:cursor-grabbing"
                >
                  <span
                    style={{
                      backgroundColor: levelColors.labelBg,
                      borderColor: levelColors.borderTint,
                    }}
                    className="w-8 h-8 rounded-md border flex items-center justify-center shrink-0"
                  >
                    {renderToolboxIcon(item.itemType, levelColors.stroke)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-bold text-[#0F1F18] truncate">{item.label}</span>
                      <span
                        style={{ color: levelColors.labelText }}
                        className="text-[10px] font-semibold shrink-0"
                      >
                        {levelColors.toneLabel}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#475569] truncate">{item.hint}</div>
                  </div>
                  <GripVertical size={14} className="text-[#94A3B8] shrink-0" />
                </div>
              );
            })}
          </div>
        </section>

        {/* Sensor items */}
        <section>
          <div className="px-1.5 mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#475569]">الحساسات والأجهزة</h3>
            <span className="text-[11px] text-[#64748B]">تركيب مباشر</span>
          </div>
          <div className="space-y-1.5">
            {sensorItems.map((item) => (
              <div
                key={item.itemType}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onStartToolboxDrag(item.itemType, item.label, e);
                }}
                title={item.hint}
                className="group flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg border bg-[#FAFBF9] border-[#DCE3DD] hover:border-[#15803D] hover:bg-emerald-50/40 transition-colors cursor-grab active:cursor-grabbing"
              >
                <span className="w-8 h-8 rounded-md bg-white border border-[#E2E7E3] flex items-center justify-center shrink-0">
                  {renderToolboxIcon(item.itemType, item.accentColor)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[#0F1F18] truncate">{item.label}</div>
                  <div className="text-[11px] text-[#64748B] truncate">{item.hint}</div>
                </div>
                <GripVertical size={14} className="text-[#94A3B8] shrink-0" />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="p-3 border-t border-[#E2E7E3] bg-[#FAFBF9] text-[11px] text-[#64748B] space-y-1">
        <div>• اسحب زاوية الشكل لتعديله أو أضف نقطة على الضلع.</div>
        <div>• Ctrl/Cmd + Z للتراجع، و Esc لإلغاء الإجراء.</div>
      </div>
    </aside>
  );
}
