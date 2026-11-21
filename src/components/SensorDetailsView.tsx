import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Clock,
  Cpu,
  Droplets,
  FlaskConical,
  Map as MapIcon,
  MapPin,
  Radio,
  Thermometer,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import {
  HIERARCHY_COLORS,
  MEASUREMENT_META,
  SENSOR_META,
  ensureSensorDailyHistory,
  ensureSensorWeeklyHistory,
  formatReadingTimeArabic,
} from '../data/seedData';
import type { GharsStore } from '../store/useGharsStore';
import type { Farm, MeasurementType, Point, SensorType } from '../types/ghars';
import { getBoundingBox } from '../utils/geometry';

type SensorDetailsViewProps = {
  store: GharsStore;
};

function SensorTypeIcon({ type, size = 18 }: { type: SensorType; size?: number }) {
  switch (type) {
    case 'moisture':
      return <Droplets size={size} />;
    case 'ec':
      return <Zap size={size} />;
    case 'ph':
      return <FlaskConical size={size} />;
    case 'temp':
      return <Thermometer size={size} />;
    case 'multi':
      return <Cpu size={size} />;
  }
}

function pointsToSvgString(pts: Point[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

function FarmMapDrawer({
  open,
  farm,
  activeSensorId,
  onSelectSensor,
  onClose,
}: {
  open: boolean;
  farm: Farm;
  activeSensorId: string;
  onSelectSensor: (farmId: string, fieldId: string, sensorId: string) => void;
  onClose: () => void;
}) {
  const mapBoxRef = useRef<HTMLDivElement | null>(null);
  const [boxSize, setBoxSize] = useState<{ w: number; h: number }>({ w: 460, h: 640 });
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);

  useEffect(() => {
    const el = mapBoxRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setBoxSize({ w: rect.width, h: rect.height });
      }
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  const mapLayout = useMemo(() => {
    const allPts: Point[] = [...farm.overviewPoints];
    const sensors: {
      fieldId: string;
      fieldName: string;
      zoneName: string;
      sensor: Farm['fields'][number]['sensors'][number];
    }[] = [];

    for (const fl of farm.fields) {
      allPts.push(...fl.overviewPoints);
      for (const z of fl.zones) {
        allPts.push(...z.schematicPoints);
      }
      for (const s of fl.sensors) {
        allPts.push(s.schematicPos);
        const z = s.zoneId ? fl.zones.find((item) => item.id === s.zoneId) : null;
        sensors.push({
          fieldId: fl.id,
          fieldName: fl.name,
          zoneName: z?.name ?? 'خارج المناطق',
          sensor: s,
        });
      }
    }

    const box = getBoundingBox(allPts.length > 0 ? allPts : [{ x: 0, y: 0 }, { x: 440, y: 320 }]);
    const pad = 42;
    const rawW = Math.max(120, box.width + pad * 2);
    const rawH = Math.max(100, box.height + pad * 2);
    const targetRatio = Math.max(0.25, boxSize.w / Math.max(1, boxSize.h));
    const rawRatio = rawW / rawH;

    let vbW = rawW;
    let vbH = rawH;
    if (rawRatio > targetRatio) {
      vbH = rawW / targetRatio;
    } else {
      vbW = rawH * targetRatio;
    }
    const vbX = box.cx - vbW / 2;
    const vbY = box.cy - vbH / 2;

    return { vbX, vbY, vbW, vbH, sensors };
  }, [boxSize.h, boxSize.w, farm]);

  const activeSensorName =
    mapLayout.sensors.find((item) => item.sensor.id === activeSensorId)?.sensor.name ?? '';

  return (
    <div
      dir="rtl"
      aria-hidden={!open}
      className={`fixed inset-0 z-50 overflow-hidden transition-opacity duration-200 ${
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Dimmed Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[#0F1F18]/25 backdrop-blur-[1px]"
      />

      {/* Full-Height Right-Side Slide-Out Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`خريطة ${farm.name}`}
        className={`fixed inset-y-0 right-0 h-full w-[500px] max-w-[92vw] bg-white border-l border-[#DCE3DD] shadow-2xl flex flex-col transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="px-5 py-4 bg-[#FAFBF9] border-b border-[#E2E7E3] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-[#15803D]/25 flex items-center justify-center text-[#15803D] shrink-0">
              <MapIcon size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#0F1F18] truncate">خريطة {farm.name}</h2>
              <p className="text-[11px] text-[#64748B] truncate">
                اختر أي حساس من الخريطة لعرض تفاصيل تغيّر القيم المسجلة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق خريطة المزرعة"
            className="p-2 rounded-lg text-[#64748B] hover:text-[#0F1F18] hover:bg-[#EEF2EE] cursor-pointer shrink-0 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Full-Height Interactive Farm Schematic Map */}
        <div className="flex-1 min-h-0 p-4 flex flex-col gap-3 bg-white">
          <div
            ref={mapBoxRef}
            className="relative flex-1 min-h-0 w-full rounded-xl border border-[#DCE3DD] bg-[#F8FAF8] overflow-hidden"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(15, 31, 24, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(15, 31, 24, 0.04) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          >
            <svg
              viewBox={`${mapLayout.vbX} ${mapLayout.vbY} ${mapLayout.vbW} ${mapLayout.vbH}`}
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-full block"
            >
              {/* Farm Boundary */}
              {farm.overviewPoints.length >= 3 && (
                <polygon
                  points={pointsToSvgString(farm.overviewPoints)}
                  fill={HIERARCHY_COLORS.farm.fill}
                  stroke={HIERARCHY_COLORS.farm.stroke}
                  strokeWidth={Math.max(2, mapLayout.vbW * 0.005)}
                  strokeDasharray={`${Math.max(5, mapLayout.vbW * 0.015)} ${Math.max(4, mapLayout.vbW * 0.01)}`}
                />
              )}

              {/* Fields & Zones */}
              {farm.fields.map((fl) => {
                const flBox = getBoundingBox(fl.overviewPoints);
                return (
                  <g key={fl.id}>
                    {fl.overviewPoints.length >= 3 && (
                      <polygon
                        points={pointsToSvgString(fl.overviewPoints)}
                        fill={HIERARCHY_COLORS.field.fill}
                        stroke={HIERARCHY_COLORS.field.stroke}
                        strokeWidth={Math.max(1.5, mapLayout.vbW * 0.004)}
                      />
                    )}
                    {fl.overviewPoints.length >= 3 && (
                      <text
                        x={flBox.minX + 10}
                        y={flBox.minY + 18}
                        fill={HIERARCHY_COLORS.field.labelText}
                        fontSize={Math.max(10, Math.min(16, mapLayout.vbW * 0.024))}
                        fontWeight="700"
                      >
                        {fl.name}
                      </text>
                    )}

                    {fl.zones.map((z) => {
                      const zBox = getBoundingBox(z.schematicPoints);
                      return (
                        <g key={z.id}>
                          {z.schematicPoints.length >= 3 && (
                            <polygon
                              points={pointsToSvgString(z.schematicPoints)}
                              fill={z.color}
                              fillOpacity="0.22"
                              stroke={z.color}
                              strokeWidth={Math.max(1.2, mapLayout.vbW * 0.003)}
                            />
                          )}
                          {z.schematicPoints.length >= 3 && (
                            <text
                              x={zBox.cx}
                              y={zBox.cy}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="#0F1F18"
                              fillOpacity="0.7"
                              fontSize={Math.max(9, Math.min(13, mapLayout.vbW * 0.02))}
                              fontWeight="600"
                            >
                              {z.name}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>

            {/* Clickable Sensor Pins Layer */}
            {mapLayout.sensors.map(({ fieldId, fieldName, zoneName, sensor }) => {
              const leftPct = ((sensor.schematicPos.x - mapLayout.vbX) / mapLayout.vbW) * 100;
              const topPct = ((sensor.schematicPos.y - mapLayout.vbY) / mapLayout.vbH) * 100;
              const sMeta = SENSOR_META[sensor.type];
              const isActive = sensor.id === activeSensorId;
              const isHovered = hoveredPinId === sensor.id;
              const isConnected = Boolean(sensor.lastReadingAt);
              const firstM = sensor.measurements[0];
              const firstR = firstM ? sensor.readings[firstM] : undefined;

              return (
                <button
                  key={sensor.id}
                  type="button"
                  onClick={() => onSelectSensor(farm.id, fieldId, sensor.id)}
                  onMouseEnter={() => setHoveredPinId(sensor.id)}
                  onMouseLeave={() => setHoveredPinId((cur) => (cur === sensor.id ? null : cur))}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    zIndex: isHovered ? 40 : isActive ? 30 : 15,
                    transform: 'translate(-50%, -85%)',
                  }}
                  aria-label={`التبديل إلى ${sensor.name}`}
                  className="absolute flex flex-col items-center cursor-pointer group focus:outline-none"
                >
                  {isHovered && (
                    <div
                      dir="rtl"
                      className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#0F1F18]/95 text-white rounded-md px-2.5 py-1 shadow-lg text-[11px] border border-white/15"
                    >
                      <div className="font-bold">{sensor.name}</div>
                      <div className="text-white/75 text-[10px]">
                        {fieldName} · {zoneName}
                        {firstR ? ` · ${firstR.value} ${firstR.unit}` : ''}
                      </div>
                    </div>
                  )}

                  <div className="relative flex items-center justify-center">
                    {isActive && (
                      <span
                        style={{
                          borderColor: '#10B981',
                          backgroundColor: 'rgba(16, 185, 129, 0.28)',
                        }}
                        className="ghars-sensor-pulse pointer-events-none absolute inset-0 rounded-full border-2"
                      />
                    )}
                    <div
                      style={{
                        backgroundColor: isActive ? '#047857' : sMeta.color,
                        boxShadow: isActive
                          ? '0 0 0 3px #A7F3D0, 0 4px 10px rgba(4, 120, 87, 0.45)'
                          : undefined,
                      }}
                      className={`relative w-8 h-8 rounded-full flex items-center justify-center text-white border-2 border-white shadow-md transition-transform ${
                        isActive ? 'scale-115' : 'group-hover:scale-110'
                      }`}
                    >
                      <SensorTypeIcon type={sensor.type} size={14} />
                      <span
                        className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${
                          isConnected ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                    </div>
                  </div>
                  <span
                    className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold leading-tight whitespace-nowrap shadow-xs border ${
                      isActive
                        ? 'bg-[#0F1F18] text-white border-[#15803D]'
                        : 'bg-white/95 text-[#0F1F18] border-[#DCE3DD]'
                    }`}
                  >
                    {sensor.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="px-5 py-3 bg-[#FAFBF9] border-t border-[#E2E7E3] flex items-center justify-between text-xs text-[#64748B] shrink-0">
          <span>
            حساسات المزرعة: <strong className="font-mono-nums text-[#0F1F18]">{mapLayout.sensors.length}</strong>
          </span>
          {activeSensorName && (
            <span className="text-[#15803D] font-semibold truncate max-w-[240px]">
              الحالي: {activeSensorName}
            </span>
          )}
        </div>
      </aside>
    </div>
  );
}

export function SensorDetailsView({ store }: SensorDetailsViewProps) {
  const {
    activeFarmer,
    selection,
    detailsSensorId,
    setDetailsSensorId,
    setSelection,
    setShellSection,
  } = store;

  const allFarmerSensors = useMemo(() => {
    if (!activeFarmer) return [];
    const list: {
      farm: (typeof activeFarmer.farms)[number];
      field: (typeof activeFarmer.farms)[number]['fields'][number];
      zone: (typeof activeFarmer.farms)[number]['fields'][number]['zones'][number] | null;
      sensor: (typeof activeFarmer.farms)[number]['fields'][number]['sensors'][number];
    }[] = [];
    for (const farm of activeFarmer.farms) {
      for (const field of farm.fields) {
        for (const sensor of field.sensors) {
          const zone = sensor.zoneId
            ? field.zones.find((z) => z.id === sensor.zoneId) ?? null
            : null;
          list.push({ farm, field, zone, sensor });
        }
      }
    }
    return list;
  }, [activeFarmer]);

  const resolvedSensorId =
    detailsSensorId ??
    (selection?.kind === 'sensor' ? selection.sensorId : null) ??
    allFarmerSensors[0]?.sensor.id ??
    null;

  const context = useMemo(() => {
    if (!resolvedSensorId) return allFarmerSensors[0] ?? null;
    return (
      allFarmerSensors.find((item) => item.sensor.id === resolvedSensorId) ??
      allFarmerSensors[0] ??
      null
    );
  }, [allFarmerSensors, resolvedSensorId]);

  const sensor = context?.sensor ?? null;

  const [timeframe, setTimeframe] = useState<'day' | 'week'>('day');
  const [selectedMeasurement, setSelectedMeasurement] = useState<MeasurementType>(
    sensor?.measurements[0] ?? 'moisture'
  );
  const [hoveredIdx, setHoveredIdx] = useState<number>(6);
  const [showFarmMap, setShowFarmMap] = useState<boolean>(false);

  useEffect(() => {
    if (!sensor) return;
    if (!sensor.measurements.includes(selectedMeasurement)) {
      setSelectedMeasurement(sensor.measurements[0] ?? 'moisture');
    }
  }, [selectedMeasurement, sensor]);

  useEffect(() => {
    setHoveredIdx(6);
  }, [sensor?.id, timeframe]);

  const dailyHistory = useMemo(
    () => (sensor ? ensureSensorDailyHistory(sensor) : []),
    [sensor]
  );

  const weeklyHistory = useMemo(
    () => (sensor ? ensureSensorWeeklyHistory(sensor) : []),
    [sensor]
  );

  const activeMeasureMeta = MEASUREMENT_META[selectedMeasurement];

  const chartData = useMemo(() => {
    const rawPts =
      timeframe === 'day'
        ? dailyHistory.map((pt, idx) => ({
            idx,
            axisLabel: pt.timeLabel,
            detailLabel: pt.fullLabel,
            subLabel: 'اليوم',
            rawVal: pt.values[selectedMeasurement],
          }))
        : weeklyHistory.map((pt, idx) => ({
            idx,
            axisLabel: pt.dayLabel,
            detailLabel: pt.dayLabel,
            subLabel: pt.shortDate,
            rawVal: pt.values[selectedMeasurement],
          }));

    const fallback = Number(
      ((activeMeasureMeta.sampleMin + activeMeasureMeta.sampleMax) / 2).toFixed(
        activeMeasureMeta.decimals
      )
    );

    const pts = rawPts.map((p, idx) => {
      const value = typeof p.rawVal === 'number' ? p.rawVal : fallback;
      const prevValue = idx > 0 && typeof rawPts[idx - 1].rawVal === 'number'
        ? (rawPts[idx - 1].rawVal as number)
        : null;
      const delta =
        prevValue !== null ? Number((value - prevValue).toFixed(activeMeasureMeta.decimals)) : null;
      return {
        ...p,
        value,
        delta,
      };
    });

    const values = pts.map((p) => p.value);
    const rawMin = values.length ? Math.min(...values) : 0;
    const rawMax = values.length ? Math.max(...values) : 1;
    const span = rawMax - rawMin;
    const pad = span < 0.2 ? Math.max(0.5, activeMeasureMeta.sampleMax * 0.1) : span * 0.24;
    const minY = Math.max(0, Number((rawMin - pad).toFixed(activeMeasureMeta.decimals)));
    const maxY = Number((rawMax + pad).toFixed(activeMeasureMeta.decimals));
    const avg = Number(
      (values.reduce((sum, x) => sum + x, 0) / Math.max(1, values.length)).toFixed(
        activeMeasureMeta.decimals
      )
    );
    const latest = values[values.length - 1] ?? 0;
    const startVal = values[0] ?? latest;
    const totalDelta = Number((latest - startVal).toFixed(activeMeasureMeta.decimals));

    return {
      pts,
      rawMin,
      rawMax,
      avg,
      latest,
      totalDelta,
      minY,
      maxY: maxY <= minY ? minY + 1 : maxY,
    };
  }, [activeMeasureMeta, dailyHistory, selectedMeasurement, timeframe, weeklyHistory]);

  if (!activeFarmer || !context || !sensor) {
    return (
      <main dir="rtl" className="flex-1 flex items-center justify-center p-8 bg-[#F5F7F5]">
        <div className="bg-white border border-[#DCE3DD] rounded-2xl p-8 max-w-md text-center space-y-3 shadow-xs">
          <h2 className="text-base font-bold text-[#0F1F18]">لا توجد أجهزة لعرض تفاصيلها</h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            أضف حساساً من «محاكي الخرائط» أو اختر مزارعاً يحتوي على أجهزة مثبتة لعرض تفاصيل تغيّر القيم المسجلة.
          </p>
          <button
            type="button"
            onClick={() => setShellSection('editor')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#15803D] text-white text-xs font-semibold hover:bg-[#166534] cursor-pointer"
          >
            <ArrowRight size={14} />
            <span>الانتقال إلى محاكي الخرائط</span>
          </button>
        </div>
      </main>
    );
  }

  const { farm, field, zone } = context;
  const sensorMeta = SENSOR_META[sensor.type];

  const svgWidth = 920;
  const svgHeight = 310;
  const padLeft = 40;
  const padRight = 64;
  const padTop = 28;
  const padBottom = 46;
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

  const activePoint = coords[hoveredIdx] ?? coords[coords.length - 1];

  return (
    <main dir="rtl" className="relative flex-1 flex flex-col min-h-0 overflow-hidden bg-[#F5F7F5]">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl w-full mx-auto p-6 space-y-5">
          {/* Top Context & Farm Map Trigger Bar */}
          <header className="bg-white rounded-xl border border-[#DCE3DD] px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setShowFarmMap((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors shrink-0 ${
                  showFarmMap
                    ? 'bg-[#15803D] border-[#15803D] text-white shadow-xs'
                    : 'border-[#15803D]/35 bg-emerald-50/70 hover:bg-emerald-100/80 text-[#14532D]'
                }`}
              >
                <MapIcon size={14} />
                <span>{showFarmMap ? 'إخفاء خريطة المزرعة' : 'خريطة المزرعة'}</span>
              </button>

              <div className="h-6 w-px bg-[#E2E7E3] hidden sm:block" />

            <div className="flex items-center gap-3 min-w-0">
              <div
                style={{ backgroundColor: sensorMeta.color }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm shrink-0"
              >
                <SensorTypeIcon type={sensor.type} size={19} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-bold text-[#0F1F18] truncate">{sensor.name}</h1>
                  <span className="font-mono-nums text-[11px] px-2 py-0.5 rounded bg-[#F1F5F2] text-[#475569] border border-[#E2E7E3]">
                    {sensor.deviceId}
                  </span>
                  <span className="text-[11px] font-medium text-[#64748B]">{sensorMeta.label}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#64748B] mt-0.5 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} className="text-[#15803D] shrink-0" />
                    <span>
                      {farm.name} · {field.name} · {zone ? zone.name : 'خارج المناطق'}
                    </span>
                  </span>
                  <span>·</span>
                  {sensor.lastReadingAt ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} />
                      <span>آخر قراءة: {formatReadingTimeArabic(sensor.lastReadingAt)}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                      <Radio size={11} />
                      <span>في انتظار أول قراءة</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {allFarmerSensors.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor="details-sensor-select" className="text-xs font-medium text-[#64748B]">
                الحساس:
              </label>
              <select
                id="details-sensor-select"
                value={sensor.id}
                onChange={(e) => {
                  const nextId = e.target.value;
                  const target = allFarmerSensors.find((item) => item.sensor.id === nextId);
                  setDetailsSensorId(nextId);
                  if (target) {
                    setSelection({
                      kind: 'sensor',
                      farmId: target.farm.id,
                      fieldId: target.field.id,
                      sensorId: target.sensor.id,
                    });
                  }
                }}
                className="px-3 py-1.5 rounded-lg border border-[#D4DBD5] bg-white text-xs font-semibold text-[#0F1F18] focus:border-[#15803D] focus:outline-none"
              >
                {allFarmerSensors.map((item) => (
                  <option key={item.sensor.id} value={item.sensor.id}>
                    {item.sensor.name} ({item.field.name})
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>

        {/* Fixed Recorded Values Strip */}
        <section className="bg-white rounded-xl border border-[#DCE3DD] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F1F18]">القيم المسجلة حالياً</h2>
            <span className="text-[11px] text-[#64748B]">قيم مضبوطة للعرض فقط</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {sensor.measurements.map((mKey) => {
              const mMeta = MEASUREMENT_META[mKey];
              const reading = sensor.readings[mKey];
              const isSelected = mKey === selectedMeasurement;
              return (
                <button
                  key={mKey}
                  type="button"
                  onClick={() => setSelectedMeasurement(mKey)}
                  className={`text-right px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/70 border-[#15803D] shadow-xs'
                      : 'bg-[#FAFBF9] border-[#E2E7E3] hover:border-[#CBD5E1]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#334155]">{mMeta.label}</span>
                    <span
                      style={{ backgroundColor: mMeta.color }}
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                    />
                  </div>
                  <div className="font-mono-nums text-lg font-bold text-[#0F1F18] mt-1 select-none">
                    {reading ? `${reading.value} ${reading.unit}` : '—'}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Timeframe + Measurement Controls */}
        <section className="bg-white rounded-xl border border-[#DCE3DD] p-5 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-bold text-[#0F1F18] flex items-center gap-2">
                <TrendingUp size={18} className="text-[#15803D]" />
                <span>تفاصيل تغيّر القيم المسجلة — {activeMeasureMeta.label}</span>
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                متابعة التغيرات الزمنية المسجلة للحساس مع أدنى وأعلى قيمة ومقدار التغيّر بين كل قراءة
              </p>
            </div>

            <div className="inline-flex items-center rounded-lg border border-[#DCE3DD] bg-[#FAFBF9] p-1 gap-1">
              <button
                type="button"
                onClick={() => setTimeframe('day')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  timeframe === 'day'
                    ? 'bg-[#15803D] text-white shadow-xs'
                    : 'text-[#475569] hover:text-[#0F1F18]'
                }`}
              >
                تغيّر يوم واحد (24 ساعة)
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('week')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  timeframe === 'week'
                    ? 'bg-[#15803D] text-white shadow-xs'
                    : 'text-[#475569] hover:text-[#0F1F18]'
                }`}
              >
                الأسبوع الماضي (7 أيام)
              </button>
            </div>
          </div>

          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-[#E2E7E3] bg-[#FAFBF9] px-4 py-3">
              <div className="text-[11px] font-medium text-[#64748B]">القيمة الحالية (الآن)</div>
              <div className="flex items-baseline justify-between mt-1 gap-2">
                <span
                  style={{ color: activeMeasureMeta.color }}
                  className="font-mono-nums text-lg font-bold"
                >
                  {chartData.latest} {activeMeasureMeta.unit}
                </span>
                <span
                  className={`inline-flex items-center gap-0.5 text-[11px] font-mono-nums font-semibold ${
                    chartData.totalDelta >= 0 ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {chartData.totalDelta >= 0 ? (
                    <TrendingUp size={12} />
                  ) : (
                    <TrendingDown size={12} />
                  )}
                  <span>
                    {chartData.totalDelta > 0 ? `+${chartData.totalDelta}` : chartData.totalDelta}
                  </span>
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E7E3] bg-[#FAFBF9] px-4 py-3">
              <div className="text-[11px] font-medium text-[#64748B]">المتوسط</div>
              <div className="font-mono-nums text-lg font-bold text-[#0F1F18] mt-1">
                {chartData.avg} {activeMeasureMeta.unit}
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E7E3] bg-[#FAFBF9] px-4 py-3">
              <div className="text-[11px] font-medium text-[#64748B]">أدنى قيمة مسجلة</div>
              <div className="font-mono-nums text-lg font-bold text-[#0F1F18] mt-1">
                {chartData.rawMin} {activeMeasureMeta.unit}
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E7E3] bg-[#FAFBF9] px-4 py-3">
              <div className="text-[11px] font-medium text-[#64748B]">أعلى قيمة مسجلة</div>
              <div className="font-mono-nums text-lg font-bold text-[#0F1F18] mt-1">
                {chartData.rawMax} {activeMeasureMeta.unit}
              </div>
            </div>
          </div>

          {/* Interactive SVG Chart */}
          <div className="rounded-xl border border-[#E2E7E3] bg-[#FCFDFC] p-4">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto max-h-[340px] overflow-visible select-none"
            >
              <defs>
                <linearGradient
                  id={`ghars-details-grad-${sensor.id}-${selectedMeasurement}-${timeframe}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={activeMeasureMeta.color} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={activeMeasureMeta.color} stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
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
                      strokeDasharray={frac === 0 ? undefined : '4 4'}
                      strokeWidth="1.2"
                    />
                    <text
                      x={padLeft + plotW + 10}
                      y={y + 4}
                      textAnchor="start"
                      fill="#64748B"
                      fontSize="11.5"
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {areaPath && (
                <path
                  d={areaPath}
                  fill={`url(#ghars-details-grad-${sensor.id}-${selectedMeasurement}-${timeframe})`}
                />
              )}

              {activePoint && (
                <line
                  x1={activePoint.x}
                  y1={padTop}
                  x2={activePoint.x}
                  y2={padTop + plotH}
                  stroke={activeMeasureMeta.color}
                  strokeOpacity="0.38"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />
              )}

              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke={activeMeasureMeta.color}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {coords.map((pt) => {
                const isActive = pt.idx === hoveredIdx;
                return (
                  <g
                    key={pt.idx}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(pt.idx)}
                    onClick={() => setHoveredIdx(pt.idx)}
                  >
                    <circle cx={pt.x} cy={pt.y} r="22" fill="transparent" />
                    {isActive && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="12"
                        fill={activeMeasureMeta.color}
                        fillOpacity="0.18"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isActive ? '6.5' : '4.5'}
                      fill={isActive ? activeMeasureMeta.color : '#FFFFFF'}
                      stroke={activeMeasureMeta.color}
                      strokeWidth="2.5"
                    />
                    <text
                      x={pt.x}
                      y={pt.y - 13}
                      textAnchor="middle"
                      fill={isActive ? '#0F1F18' : '#475569'}
                      fontWeight={isActive ? '700' : '600'}
                      fontSize={isActive ? '12' : '10.5'}
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {pt.value}
                    </text>
                    <text
                      x={pt.x}
                      y={svgHeight - 16}
                      textAnchor="middle"
                      fill={isActive ? '#0F1F18' : '#64748B'}
                      fontWeight={isActive ? '700' : '600'}
                      fontSize="11.5"
                      fontFamily={timeframe === 'day' ? 'IBM Plex Mono, monospace' : undefined}
                    >
                      {pt.axisLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>

        {/* Chronological Detailed Change Table */}
        <section className="bg-white rounded-xl border border-[#DCE3DD] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E7E3] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0F1F18]">
              سجل تغيّر القيم المسجلة ({timeframe === 'day' ? 'خلال اليوم' : 'خلال الأسبوع الماضي'})
            </h3>
            <span className="text-[11px] text-[#64748B]">
              {activeMeasureMeta.label} ({activeMeasureMeta.unit})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E2E7E3] bg-[#FAFBF9] text-[#475569]">
                  <th className="py-2.5 px-4 font-semibold">الوقت / الفترة</th>
                  <th className="py-2.5 px-4 font-semibold">القيمة المسجلة</th>
                  <th className="py-2.5 px-4 font-semibold">التغيّر عن القراءة السابقة</th>
                  <th className="py-2.5 px-4 font-semibold">المقارنة بالمتوسط</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2EE]">
                {chartData.pts.map((pt) => {
                  const isActive = pt.idx === hoveredIdx;
                  const diffFromAvg = Number(
                    (pt.value - chartData.avg).toFixed(activeMeasureMeta.decimals)
                  );
                  return (
                    <tr
                      key={pt.idx}
                      onMouseEnter={() => setHoveredIdx(pt.idx)}
                      onClick={() => setHoveredIdx(pt.idx)}
                      className={`cursor-pointer transition-colors ${
                        isActive ? 'bg-emerald-50/60' : 'hover:bg-[#FAFBF9]'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-semibold text-[#0F1F18]">
                        <span>{pt.detailLabel}</span>
                        {timeframe === 'week' && (
                          <span className="font-mono-nums text-[11px] text-[#64748B] mr-2">
                            ({pt.subLabel})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono-nums font-bold text-[#0F1F18]">
                        {pt.value} {activeMeasureMeta.unit}
                      </td>
                      <td className="py-2.5 px-4 font-mono-nums font-semibold">
                        {pt.delta === null ? (
                          <span className="text-[#94A3B8]">بداية الفترة</span>
                        ) : pt.delta === 0 ? (
                          <span className="text-[#64748B]">0 {activeMeasureMeta.unit}</span>
                        ) : (
                          <span
                            className={pt.delta > 0 ? 'text-emerald-700' : 'text-amber-700'}
                          >
                            {pt.delta > 0 ? `+${pt.delta}` : pt.delta} {activeMeasureMeta.unit}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono-nums text-[#475569]">
                        {diffFromAvg > 0 ? `+${diffFromAvg}` : diffFromAvg} {activeMeasureMeta.unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        </div>
      </div>

      {/* Full-Height Right-Side Farm Map Slide-Out Drawer */}
      <FarmMapDrawer
        open={showFarmMap}
        farm={farm}
        activeSensorId={sensor.id}
        onSelectSensor={(farmId, fieldId, sensorId) => {
          setDetailsSensorId(sensorId);
          setSelection({
            kind: 'sensor',
            farmId,
            fieldId,
            sensorId,
          });
          setShowFarmMap(false);
        }}
        onClose={() => setShowFarmMap(false)}
      />
    </main>
  );
}
