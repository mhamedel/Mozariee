import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  GripHorizontal,
  MapPin,
  Radio,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  MEASUREMENT_META,
  SENSOR_META,
  ensureSensorDailyHistory,
  formatReadingTimeArabic,
} from '../data/seedData';
import type { MeasurementType, SensorDevice, Zone } from '../types/ghars';

type SensorPreviewCardProps = {
  sensor: SensorDevice;
  zone: Zone | null;
  farmName: string;
  fieldName: string;
  onOpenDetails?: () => void;
  onClose: () => void;
};

export function SensorPreviewCard({
  sensor,
  zone,
  farmName,
  fieldName,
  onOpenDetails,
  onClose,
}: SensorPreviewCardProps) {
  const meta = SENSOR_META[sensor.type];
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [selectedMeasurement, setSelectedMeasurement] = useState<MeasurementType>(
    sensor.measurements[0] ?? 'moisture'
  );
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<number>(6);

  useEffect(() => {
    if (!sensor.measurements.includes(selectedMeasurement)) {
      setSelectedMeasurement(sensor.measurements[0] ?? 'moisture');
    }
  }, [selectedMeasurement, sensor.measurements]);

  useEffect(() => {
    setHoveredSlotIndex(6);
  }, [sensor.id]);

  const dailyHistory = useMemo(() => ensureSensorDailyHistory(sensor), [sensor]);

  const activeMeasureMeta = MEASUREMENT_META[selectedMeasurement];

  const chartData = useMemo(() => {
    const pts = dailyHistory.map((pt, idx) => {
      const v = pt.values[selectedMeasurement];
      const fallback = Number(
        ((activeMeasureMeta.sampleMin + activeMeasureMeta.sampleMax) / 2).toFixed(
          activeMeasureMeta.decimals
        )
      );
      return {
        idx,
        timeLabel: pt.timeLabel,
        fullLabel: pt.fullLabel,
        value: typeof v === 'number' ? v : fallback,
      };
    });

    const values = pts.map((p) => p.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const span = rawMax - rawMin;
    const pad = span < 0.2 ? Math.max(0.5, activeMeasureMeta.sampleMax * 0.08) : span * 0.25;
    const minY = Math.max(0, Number((rawMin - pad).toFixed(activeMeasureMeta.decimals)));
    const maxY = Number((rawMax + pad).toFixed(activeMeasureMeta.decimals));
    const avg = Number(
      (values.reduce((sum, x) => sum + x, 0) / Math.max(1, values.length)).toFixed(
        activeMeasureMeta.decimals
      )
    );

    return {
      pts,
      rawMin,
      rawMax,
      avg,
      minY,
      maxY: maxY <= minY ? minY + 1 : maxY,
    };
  }, [activeMeasureMeta, dailyHistory, selectedMeasurement]);

  const svgWidth = 380;
  const svgHeight = 168;
  const padLeft = 18;
  const padRight = 40;
  const padTop = 22;
  const padBottom = 30;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const coords = chartData.pts.map((p, i) => {
    const x = padLeft + (i / Math.max(1, chartData.pts.length - 1)) * plotW;
    const ratio = (p.value - chartData.minY) / (chartData.maxY - chartData.minY);
    const y = padTop + (1 - ratio) * plotH;
    return { ...p, x, y };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(
          1
        )} L ${coords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const activePoint = coords[hoveredSlotIndex] ?? coords[coords.length - 1];

  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    const cardEl = cardRef.current;
    const containerEl = cardEl?.parentElement?.parentElement;
    if (!cardEl || !containerEl) return;

    e.preventDefault();
    e.stopPropagation();

    const containerRect = containerEl.getBoundingClientRect();
    const cardRect = cardEl.getBoundingClientRect();
    const margin = 8;
    const minDx = containerRect.left + margin - cardRect.left;
    const maxDx = containerRect.right - margin - cardRect.right;
    const minDy = containerRect.top + margin - cardRect.top;
    const maxDy = containerRect.bottom - margin - cardRect.bottom;
    const startX = e.clientX;
    const startY = e.clientY;
    const baseOffset = dragOffset;

    setIsDragging(true);

    const onMove = (moveEv: PointerEvent) => {
      const rawDx = moveEv.clientX - startX;
      const rawDy = moveEv.clientY - startY;
      const clampedDx = minDx <= maxDx ? Math.max(minDx, Math.min(maxDx, rawDx)) : 0;
      const clampedDy = minDy <= maxDy ? Math.max(minDy, Math.min(maxDy, rawDy)) : 0;
      setDragOffset({
        x: Math.round(baseOffset.x + clampedDx),
        y: Math.round(baseOffset.y + clampedDy),
      });
    };

    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <div
      ref={cardRef}
      dir="rtl"
      style={{ transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)` }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      className="w-[440px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-8rem)] overflow-y-auto bg-white rounded-xl border border-[#DCE3DD] shadow-2xl p-4 space-y-3 text-xs"
    >
      {/* Draggable Popup Header */}
      <div
        onPointerDown={handleHeaderPointerDown}
        title="اسحب لتحريك النافذة"
        className={`flex items-start justify-between gap-2 select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <GripHorizontal size={13} className="text-[#94A3B8] shrink-0" />
            <span
              style={{ backgroundColor: meta.color }}
              className="w-2.5 h-2.5 rounded-full shrink-0"
            />
            <span className="text-[11px] font-medium text-[#64748B]">{meta.label}</span>
          </div>
          <h4 className="text-sm font-bold text-[#0F1F18] truncate mt-0.5">{sensor.name}</h4>
          <div className="font-mono-nums text-[11px] text-[#64748B] mt-0.5">{sensor.deviceId}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق نافذة الحساس"
          className="p-1 rounded-md text-[#64748B] hover:text-[#0F1F18] hover:bg-[#F5F7F5] cursor-pointer"
        >
          <X size={15} />
        </button>
      </div>

      {/* Location Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[11px] text-[#475569] border-t border-[#EEF2EE] pt-2">
        <MapPin size={13} className="text-[#15803D] shrink-0" />
        <span className="truncate">
          {farmName} · {fieldName} · {zone ? zone.name : 'خارج المناطق'}
        </span>
      </div>

      {/* Fixed Recorded Values */}
      <div className="space-y-2 border-t border-[#EEF2EE] pt-2.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#0F1F18]">القيم المسجلة</span>
          {sensor.lastReadingAt ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-[#64748B]">
              <Clock size={11} />
              <span>{formatReadingTimeArabic(sensor.lastReadingAt)}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
              <Radio size={11} />
              <span>في انتظار أول قراءة</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-1.5">
          {sensor.measurements.map((mKey) => {
            const mMeta = MEASUREMENT_META[mKey];
            const reading = sensor.readings[mKey];
            return (
              <div
                key={mKey}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#FAFBF9] border border-[#E2E7E3]"
              >
                <span className="font-medium text-[#334155]">{mMeta.label}</span>
                <span className="font-mono-nums font-bold text-sm text-[#0F1F18] select-none">
                  {reading ? `${reading.value} ${reading.unit}` : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 1-Day Trend Chart View */}
      <div className="space-y-3 border-t border-[#EEF2EE] pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0F1F18] truncate">
            <TrendingUp size={13} className="text-[#15803D] shrink-0" />
            <span className="truncate">تغيّر القراءات ليوم واحد</span>
          </div>
          <span className="text-[10px] font-medium text-[#64748B] shrink-0">آخر 24 ساعة</span>
        </div>

        {/* Measurement Tabs if sensor has > 1 measurement */}
        {sensor.measurements.length > 1 && (
          <div className="flex items-center gap-1 flex-wrap">
            {sensor.measurements.map((mKey) => {
              const mMeta = MEASUREMENT_META[mKey];
              const isActive = mKey === selectedMeasurement;
              return (
                <button
                  key={mKey}
                  type="button"
                  onClick={() => setSelectedMeasurement(mKey)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-[#0F1F18] text-white border-[#0F1F18]'
                      : 'bg-[#FAFBF9] text-[#334155] border-[#DCE3DD] hover:bg-[#EEF2EE]'
                  }`}
                >
                  <span
                    style={{ backgroundColor: mMeta.color }}
                    className="w-2 h-2 rounded-full"
                  />
                  <span>{mMeta.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* SVG Line + Area Chart (1 Day) */}
        <div className="rounded-lg border border-[#E2E7E3] bg-[#FCFDFC] p-2">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto overflow-visible select-none"
          >
            <defs>
              <linearGradient
                id={`ghars-grad-${sensor.id}-${selectedMeasurement}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={activeMeasureMeta.color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={activeMeasureMeta.color} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Y-Axis Labels */}
            {[0, 0.5, 1].map((frac) => {
              const y = padTop + (1 - frac) * plotH;
              const val = Number(
                (chartData.minY + frac * (chartData.maxY - chartData.minY)).toFixed(
                  activeMeasureMeta.decimals
                )
              );
              return (
                <g key={frac}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={padLeft + plotW}
                    y2={y}
                    stroke="#E2E8E4"
                    strokeDasharray={frac === 0 ? undefined : '3 3'}
                    strokeWidth="1"
                  />
                  <text
                    x={padLeft + plotW + 6}
                    y={y + 3}
                    textAnchor="start"
                    fill="#64748B"
                    fontSize="9.5"
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Area Fill */}
            {areaPath && (
              <path
                d={areaPath}
                fill={`url(#ghars-grad-${sensor.id}-${selectedMeasurement})`}
              />
            )}

            {/* Active Vertical Guide */}
            {activePoint && (
              <line
                x1={activePoint.x}
                y1={padTop}
                x2={activePoint.x}
                y2={padTop + plotH}
                stroke={activeMeasureMeta.color}
                strokeOpacity="0.35"
                strokeDasharray="3 3"
                strokeWidth="1.2"
              />
            )}

            {/* Trend Line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={activeMeasureMeta.color}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data Points + X-Axis Time Labels */}
            {coords.map((pt) => {
              const isActive = pt.idx === hoveredSlotIndex;
              return (
                <g
                  key={pt.idx}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredSlotIndex(pt.idx)}
                  onClick={() => setHoveredSlotIndex(pt.idx)}
                >
                  <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />
                  {isActive && (
                    <>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="8"
                        fill={activeMeasureMeta.color}
                        fillOpacity="0.18"
                      />
                      <text
                        x={pt.x}
                        y={pt.y - 10}
                        textAnchor="middle"
                        fill="#0F1F18"
                        fontWeight="700"
                        fontSize="10"
                        fontFamily="IBM Plex Mono, monospace"
                      >
                        {pt.value}
                      </text>
                    </>
                  )}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isActive ? '4.8' : '3.5'}
                    fill={isActive ? activeMeasureMeta.color : '#FFFFFF'}
                    stroke={activeMeasureMeta.color}
                    strokeWidth="2"
                  />
                  <text
                    x={pt.x}
                    y={svgHeight - 9}
                    textAnchor="middle"
                    fill={isActive ? '#0F1F18' : '#64748B'}
                    fontWeight={isActive ? '700' : '500'}
                    fontSize="9.5"
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    {pt.timeLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Min / Avg / Max Summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="px-2.5 py-1.5 rounded-lg bg-[#FAFBF9] border border-[#E2E7E3] text-center">
            <div className="text-[10px] text-[#64748B]">أدنى قيمة</div>
            <div className="font-mono-nums font-bold text-xs text-[#0F1F18] mt-0.5">
              {chartData.rawMin} {activeMeasureMeta.unit}
            </div>
          </div>
          <div className="px-2.5 py-1.5 rounded-lg bg-[#FAFBF9] border border-[#E2E7E3] text-center">
            <div className="text-[10px] text-[#64748B]">المتوسط</div>
            <div className="font-mono-nums font-bold text-xs text-[#0F1F18] mt-0.5">
              {chartData.avg} {activeMeasureMeta.unit}
            </div>
          </div>
          <div className="px-2.5 py-1.5 rounded-lg bg-[#FAFBF9] border border-[#E2E7E3] text-center">
            <div className="text-[10px] text-[#64748B]">أعلى قيمة</div>
            <div className="font-mono-nums font-bold text-xs text-[#0F1F18] mt-0.5">
              {chartData.rawMax} {activeMeasureMeta.unit}
            </div>
          </div>
        </div>

        {/* Bottom Details Button */}
        {onOpenDetails && (
          <button
            type="button"
            onClick={onOpenDetails}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            <span>التفاصيل</span>
            <ArrowLeft size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
