import type {
  Farmer,
  MeasurementType,
  SensorDailyPoint,
  SensorDevice,
  SensorHistoryPoint,
  SensorReading,
  SensorType,
  ToolboxItemType,
  WorkspaceState,
} from '../types/ghars';

export const HIERARCHY_COLORS = {
  farm: {
    stroke: '#78350F', // Rich Dark Soil (ترابي داكن — المستوى الأول)
    fill: 'rgba(120, 53, 15, 0.06)',
    fillActive: 'rgba(120, 53, 15, 0.13)',
    bgTint: '#FFFBEB',
    borderTint: '#D97706',
    labelBg: '#FEF3C7',
    labelText: '#78350F',
    label: 'مزرعة',
    toneLabel: 'ترابي داكن',
  },
  field: {
    stroke: '#14532D', // Deep Forest Green (أخضر غابي داكن — المستوى الثاني)
    fill: 'rgba(20, 83, 45, 0.09)',
    fillActive: 'rgba(20, 83, 45, 0.17)',
    bgTint: '#F0FDF4',
    borderTint: '#16A34A',
    labelBg: '#DCFCE7',
    labelText: '#14532D',
    label: 'حقل',
    toneLabel: 'أخضر داكن',
  },
  zone: {
    stroke: '#16A34A', // Fresh Leaf Green (أخضر نباتي حيوي — المستوى الثالث)
    fill: 'rgba(22, 163, 74, 0.17)',
    fillActive: 'rgba(22, 163, 74, 0.28)',
    bgTint: '#ECFDF5',
    borderTint: '#4ADE80',
    labelBg: '#D1FAE5',
    labelText: '#065F46',
    label: 'منطقة',
    toneLabel: 'أخضر حيوي',
  },
};

export type SensorMeta = {
  type: SensorType;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  bgTint: string;
  borderTint: string;
  defaultMeasurements: MeasurementType[];
};

export type MeasurementMeta = {
  key: MeasurementType;
  label: string;
  unit: string;
  sampleMin: number;
  sampleMax: number;
  decimals: number;
  color: string;
};

export const MEASUREMENT_META: Record<MeasurementType, MeasurementMeta> = {
  moisture: {
    key: 'moisture',
    label: 'رطوبة التربة',
    unit: '%',
    sampleMin: 34,
    sampleMax: 58,
    decimals: 1,
    color: '#0284C7',
  },
  ec: {
    key: 'ec',
    label: 'الملوحة (EC)',
    unit: 'dS/m',
    sampleMin: 1.2,
    sampleMax: 2.6,
    decimals: 2,
    color: '#D97706',
  },
  ph: {
    key: 'ph',
    label: 'حموضة التربة (pH)',
    unit: 'pH',
    sampleMin: 6.2,
    sampleMax: 7.4,
    decimals: 1,
    color: '#7C3AED',
  },
  temp: {
    key: 'temp',
    label: 'درجة الحرارة',
    unit: '°C',
    sampleMin: 21,
    sampleMax: 31,
    decimals: 1,
    color: '#DC2626',
  },
};

export const SENSOR_META: Record<SensorType, SensorMeta> = {
  moisture: {
    type: 'moisture',
    label: 'حساس رطوبة',
    shortLabel: 'رطوبة',
    description: 'قياس نسبة رطوبة التربة على عمق الجذور',
    color: '#0284C7',
    bgTint: '#E0F2FE',
    borderTint: '#7DD3FC',
    defaultMeasurements: ['moisture'],
  },
  ec: {
    type: 'ec',
    label: 'حساس ملوحة (EC)',
    shortLabel: 'ملوحة EC',
    description: 'قياس الموصلية الكهربائية وملوحة المحلول',
    color: '#D97706',
    bgTint: '#FEF3C7',
    borderTint: '#FCD34D',
    defaultMeasurements: ['ec'],
  },
  ph: {
    type: 'ph',
    label: 'حساس pH',
    shortLabel: 'pH',
    description: 'قياس درجة الحموضة والقلوية في التربة',
    color: '#7C3AED',
    bgTint: '#EDE9FE',
    borderTint: '#C4B5FD',
    defaultMeasurements: ['ph'],
  },
  temp: {
    type: 'temp',
    label: 'حساس حرارة',
    shortLabel: 'حرارة',
    description: 'مراقبة حرارة التربة والمناخ المحيط',
    color: '#DC2626',
    bgTint: '#FEE2E2',
    borderTint: '#FCA5A5',
    defaultMeasurements: ['temp'],
  },
  multi: {
    type: 'multi',
    label: 'جهاز متعدد القياسات',
    shortLabel: 'متعدد',
    description: 'وحدة ميدانية تجمع عدة حساسات في دبوس واحد',
    color: '#0F766E',
    bgTint: '#CCFBF1',
    borderTint: '#5EEAD4',
    defaultMeasurements: ['moisture', 'ec', 'ph', 'temp'],
  },
};

export type ToolboxDefinition = {
  itemType: ToolboxItemType;
  label: string;
  category: 'structure' | 'sensor';
  hint: string;
  accentColor: string;
};

export const TOOLBOX_ITEMS: ToolboxDefinition[] = [
  {
    itemType: 'farm',
    label: 'مزرعة',
    category: 'structure',
    hint: 'حدود المزرعة الكبرى (الأكبر)',
    accentColor: HIERARCHY_COLORS.farm.stroke,
  },
  {
    itemType: 'field',
    label: 'حقل',
    category: 'structure',
    hint: 'حقل داخل المزرعة (متوسط)',
    accentColor: HIERARCHY_COLORS.field.stroke,
  },
  {
    itemType: 'zone',
    label: 'منطقة',
    category: 'structure',
    hint: 'منطقة ري داخل الحقل (الأصغر)',
    accentColor: HIERARCHY_COLORS.zone.stroke,
  },
  {
    itemType: 'moisture',
    label: 'حساس رطوبة',
    category: 'sensor',
    hint: 'رطوبة التربة (%)',
    accentColor: SENSOR_META.moisture.color,
  },
  {
    itemType: 'ec',
    label: 'حساس ملوحة (EC)',
    category: 'sensor',
    hint: 'الموصلية الكهربائية (dS/m)',
    accentColor: SENSOR_META.ec.color,
  },
  {
    itemType: 'ph',
    label: 'حساس pH',
    category: 'sensor',
    hint: 'درجة حموضة التربة (pH)',
    accentColor: SENSOR_META.ph.color,
  },
  {
    itemType: 'temp',
    label: 'حساس حرارة',
    category: 'sensor',
    hint: 'حرارة التربة (°C)',
    accentColor: SENSOR_META.temp.color,
  },
  {
    itemType: 'multi',
    label: 'جهاز متعدد القياسات',
    category: 'sensor',
    hint: 'رطوبة · ملوحة · pH · حرارة',
    accentColor: SENSOR_META.multi.color,
  },
];

// Graded Green & Earth tones for zones so each zone stays distinct yet harmonizes with Soil (Farm) & Deep Green (Field)
export const ZONE_PALETTE = [
  '#16A34A', // Fresh Leaf Green
  '#65A30D', // Olive Sprout Green
  '#0D9488', // Irrigated Sage-Teal
  '#B45309', // Warm Terracotta Soil
  '#059669', // Mint Emerald
  '#CA8A04', // Golden Harvest Loam
];

export function buildSampleReadings(
  measurements: MeasurementType[],
  timestampIso = new Date().toISOString()
): Partial<Record<MeasurementType, SensorReading>> {
  const result: Partial<Record<MeasurementType, SensorReading>> = {};
  measurements.forEach((m) => {
    const meta = MEASUREMENT_META[m];
    const raw = meta.sampleMin + Math.random() * (meta.sampleMax - meta.sampleMin);
    result[m] = {
      value: Number(raw.toFixed(meta.decimals)),
      unit: meta.unit,
      recordedAt: timestampIso,
    };
  });
  return result;
}

export function formatReadingTimeArabic(iso: string | null): string {
  if (!iso) return 'في انتظار أول قراءة';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    }).format(d);
  } catch {
    return iso;
  }
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clampMeasurementValue(m: MeasurementType, val: number): number {
  const meta = MEASUREMENT_META[m];
  const bounds: Record<MeasurementType, [number, number]> = {
    moisture: [15, 85],
    ec: [0.4, 4.5],
    ph: [5.0, 8.5],
    temp: [8, 45],
  };
  const [min, max] = bounds[m];
  return Number(Math.max(min, Math.min(max, val)).toFixed(meta.decimals));
}

export function buildWeeklySensorHistory(
  measurements: MeasurementType[],
  currentReadings: Partial<Record<MeasurementType, SensorReading>> = {},
  seedKey?: string,
  randomize = false
): SensorHistoryPoint[] {
  const now = new Date();
  const baseSeed = randomize ? Math.floor(Math.random() * 1000000) : hashSeed(seedKey ?? 'ghars');
  const dayNamesFormatter = new Intl.DateTimeFormat('ar-SA', { weekday: 'short' });
  const shortDateFormatter = new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'numeric' });

  const points: SensorHistoryPoint[] = [];

  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(now);
    d.setDate(now.getDate() - offset);
    const dateIso = d.toISOString().slice(0, 10);
    const dayLabel = offset === 0 ? 'اليوم' : dayNamesFormatter.format(d);
    const shortDate = shortDateFormatter.format(d);

    const values: Partial<Record<MeasurementType, number>> = {};
    measurements.forEach((m, mIdx) => {
      const meta = MEASUREMENT_META[m];
      const anchor =
        currentReadings[m]?.value ??
        Number(((meta.sampleMin + meta.sampleMax) / 2).toFixed(meta.decimals));

      if (offset === 0 && currentReadings[m] !== undefined) {
        values[m] = Number(currentReadings[m]!.value.toFixed(meta.decimals));
        return;
      }

      const span = (meta.sampleMax - meta.sampleMin) * 0.42;
      const waveSeed = ((baseSeed + (6 - offset) * 97 + mIdx * 31) % 1000) / 1000;
      const wave = Math.sin((6 - offset) * 0.95 + mIdx * 1.4 + (baseSeed % 17)) * 0.65;
      const delta = (waveSeed - 0.5) * span + wave * (span * 0.45);
      values[m] = clampMeasurementValue(m, anchor + delta);
    });

    points.push({ dateIso, dayLabel, shortDate, values });
  }

  return points;
}

export function ensureSensorWeeklyHistory(sensor: SensorDevice): SensorHistoryPoint[] {
  if (sensor.weeklyHistory && sensor.weeklyHistory.length === 7) {
    // Ensure all currently selected measurements have values & today's point matches latest reading
    const cloned = sensor.weeklyHistory.map((pt, idx) => {
      const nextValues = { ...pt.values };
      sensor.measurements.forEach((m) => {
        if (idx === 6 && sensor.readings[m] !== undefined) {
          nextValues[m] = sensor.readings[m]!.value;
        } else if (nextValues[m] === undefined) {
          const fallback = buildWeeklySensorHistory([m], sensor.readings, sensor.id)[idx]?.values[m];
          if (fallback !== undefined) nextValues[m] = fallback;
        }
      });
      return { ...pt, values: nextValues };
    });
    return cloned;
  }
  return buildWeeklySensorHistory(sensor.measurements, sensor.readings, sensor.id);
}

const DAILY_SLOTS: { timeLabel: string; fullLabel: string; diurnalFactor: number }[] = [
  { timeLabel: '00:00', fullLabel: '00:00 منتصف الليل', diurnalFactor: -0.65 },
  { timeLabel: '04:00', fullLabel: '04:00 فجراً', diurnalFactor: -0.85 },
  { timeLabel: '08:00', fullLabel: '08:00 صباحاً', diurnalFactor: -0.15 },
  { timeLabel: '12:00', fullLabel: '12:00 ظهراً', diurnalFactor: 0.75 },
  { timeLabel: '16:00', fullLabel: '16:00 عصراً', diurnalFactor: 0.9 },
  { timeLabel: '20:00', fullLabel: '20:00 مساءً', diurnalFactor: 0.15 },
  { timeLabel: 'الآن', fullLabel: 'الآن (آخر قراءة مسجلة)', diurnalFactor: 0 },
];

export function ensureSensorDailyHistory(sensor: SensorDevice): SensorDailyPoint[] {
  const baseSeed = hashSeed(`${sensor.id}:daily`);

  return DAILY_SLOTS.map((slot, idx) => {
    const values: Partial<Record<MeasurementType, number>> = {};

    sensor.measurements.forEach((m, mIdx) => {
      const meta = MEASUREMENT_META[m];
      const currentReading = sensor.readings[m];
      const anchor =
        currentReading?.value ??
        Number(((meta.sampleMin + meta.sampleMax) / 2).toFixed(meta.decimals));

      if (idx === DAILY_SLOTS.length - 1 && currentReading !== undefined) {
        values[m] = Number(currentReading.value.toFixed(meta.decimals));
        return;
      }

      const span = (meta.sampleMax - meta.sampleMin) * 0.28;
      const noiseSeed = ((baseSeed + idx * 73 + mIdx * 41) % 1000) / 1000;
      const direction = m === 'moisture' ? -slot.diurnalFactor : slot.diurnalFactor;
      const delta = direction * (span * 0.55) + (noiseSeed - 0.5) * (span * 0.45);
      values[m] = clampMeasurementValue(m, anchor + delta);
    });

    return {
      timeLabel: slot.timeLabel,
      fullLabel: slot.fullLabel,
      values,
    };
  });
}

export function normalizeFarmerProfile(
  raw: Partial<Farmer> & Pick<Farmer, 'id' | 'name'>
): Farmer {
  return {
    id: raw.id,
    name: raw.name || 'مزارع بدون اسم',
    phone: raw.phone ?? '',
    secondaryPhone: raw.secondaryPhone ?? '',
    email: raw.email ?? '',
    nationalIdOrLicense: raw.nationalIdOrLicense ?? '',
    region: raw.region || 'غير محدد',
    cityOrAddress: raw.cityOrAddress ?? '',
    preferredContactMethod: raw.preferredContactMethod ?? 'whatsapp',
    preferredLanguage: raw.preferredLanguage ?? 'ar',
    accountStatus: raw.accountStatus ?? 'active',
    alertsEnabled: raw.alertsEnabled ?? true,
    moistureAlertThreshold:
      typeof raw.moistureAlertThreshold === 'number' && !Number.isNaN(raw.moistureAlertThreshold)
        ? raw.moistureAlertThreshold
        : 32,
    tempAlertThreshold:
      typeof raw.tempAlertThreshold === 'number' && !Number.isNaN(raw.tempAlertThreshold)
        ? raw.tempAlertThreshold
        : 38,
    notes: raw.notes ?? '',
    createdAt: raw.createdAt || new Date().toISOString(),
    backgroundMode: 'blank',
    backgroundImageUrl: null,
    imageAspectRatio: raw.imageAspectRatio ?? 1000 / 680,
    planWidth: typeof raw.planWidth === 'number' && raw.planWidth >= 1000 ? raw.planWidth : 1000,
    planHeight: typeof raw.planHeight === 'number' && raw.planHeight >= 680 ? raw.planHeight : 680,
    geoCenter: raw.geoCenter ?? { lat: 24.1555, lng: 47.3366 },
    geoZoom: raw.geoZoom ?? 16,
    farms: Array.isArray(raw.farms) ? raw.farms : [],
  };
}

export function createInitialWorkspace(): WorkspaceState {
  const now = new Date();
  const minsAgo12 = new Date(now.getTime() - 12 * 60 * 1000).toISOString();
  const minsAgo4 = new Date(now.getTime() - 4 * 60 * 1000).toISOString();
  const createdDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();

  return {
    farmers: [
      {
        id: 'farmer-1',
        name: 'أحمد المنصور',
        phone: '+966 55 412 8900',
        secondaryPhone: '+966 50 318 4410',
        email: 'ahmed.mansour@ghars.sa',
        nationalIdOrLicense: 'AGR-4410892',
        region: 'الخرج · الرياض',
        cityOrAddress: 'طريق الملك فهد الزراعي، قطاع الهياثم، الخرج',
        preferredContactMethod: 'whatsapp',
        preferredLanguage: 'ar',
        accountStatus: 'active',
        alertsEnabled: true,
        moistureAlertThreshold: 32,
        tempAlertThreshold: 38,
        notes: 'مزرعة نموذجية لمتابعة رطوبة النخيل والبيوت المحمية مع تفعيل تنبيهات الجفاف.',
        createdAt: createdDaysAgo,
        backgroundMode: 'blank',
        backgroundImageUrl: null,
        imageAspectRatio: 1000 / 680,
        geoCenter: { lat: 24.1555, lng: 47.3366 },
        geoZoom: 16,
        farms: [
          {
            id: 'farm-1',
            name: 'مزرعة الواحة الشمالية',
            region: 'الخرج',
            geoCenter: { lat: 24.1555, lng: 47.3366 },
            overviewPoints: [
              { x: 80, y: 70 },
              { x: 920, y: 70 },
              { x: 920, y: 615 },
              { x: 80, y: 615 },
            ],
            geoPoints: [
              { lat: 24.1574, lng: 47.3316 },
              { lat: 24.1574, lng: 47.3418 },
              { lat: 24.1536, lng: 47.3418 },
              { lat: 24.1536, lng: 47.3316 },
            ],
            fields: [
              {
                id: 'field-1',
                name: 'حقل النخيل الشرقي',
                cropType: 'نخيل خلاص',
                farmId: 'farm-1',
                overviewPoints: [
                  { x: 115, y: 115 },
                  { x: 545, y: 115 },
                  { x: 545, y: 580 },
                  { x: 115, y: 580 },
                ],
                geoPoints: [
                  { lat: 24.1570, lng: 47.3321 },
                  { lat: 24.1570, lng: 47.3375 },
                  { lat: 24.1541, lng: 47.3375 },
                  { lat: 24.1541, lng: 47.3321 },
                ],
                zones: [
                  {
                    id: 'zone-1',
                    name: 'المنطقة أ — ري ١',
                    cropOrNote: 'أشجار بالغة · ري بالتنقيط',
                    color: '#16A34A',
                    schematicPoints: [
                      { x: 140, y: 155 },
                      { x: 320, y: 155 },
                      { x: 320, y: 545 },
                      { x: 140, y: 545 },
                    ],
                    geoPoints: [
                      { lat: 24.1568, lng: 47.3324 },
                      { lat: 24.1568, lng: 47.3346 },
                      { lat: 24.1544, lng: 47.3345 },
                      { lat: 24.1544, lng: 47.3323 },
                    ],
                  },
                  {
                    id: 'zone-2',
                    name: 'المنطقة ب — ري ٢',
                    cropOrNote: 'فسائل حديثة · تسميد متوازن',
                    color: '#65A30D',
                    schematicPoints: [
                      { x: 345, y: 155 },
                      { x: 520, y: 155 },
                      { x: 520, y: 545 },
                      { x: 345, y: 545 },
                    ],
                    geoPoints: [
                      { lat: 24.1567, lng: 47.3349 },
                      { lat: 24.1566, lng: 47.3372 },
                      { lat: 24.1544, lng: 47.3373 },
                      { lat: 24.1544, lng: 47.3348 },
                    ],
                  },
                ],
                sensors: [
                  {
                    id: 'sensor-1',
                    name: 'محطة رطوبة القطاع أ',
                    deviceId: 'GH-MOI-104',
                    type: 'moisture',
                    measurements: ['moisture'],
                    farmId: 'farm-1',
                    fieldId: 'field-1',
                    zoneId: 'zone-1',
                    schematicPos: { x: 230, y: 335 },
                    geoPos: { lat: 24.1557, lng: 47.3334 },
                    readings: {
                      moisture: { value: 44.8, unit: '%', recordedAt: minsAgo12 },
                    },
                    weeklyHistory: buildWeeklySensorHistory(
                      ['moisture'],
                      { moisture: { value: 44.8, unit: '%', recordedAt: minsAgo12 } },
                      'sensor-1'
                    ),
                    lastReadingAt: minsAgo12,
                    createdAt: minsAgo12,
                  },
                  {
                    id: 'sensor-2',
                    name: 'وحدة التربة ب-1',
                    deviceId: 'GH-MLT-209',
                    type: 'multi',
                    measurements: ['moisture', 'ec', 'ph', 'temp'],
                    farmId: 'farm-1',
                    fieldId: 'field-1',
                    zoneId: 'zone-2',
                    schematicPos: { x: 432, y: 350 },
                    geoPos: { lat: 24.1555, lng: 47.3361 },
                    readings: {
                      moisture: { value: 49.2, unit: '%', recordedAt: minsAgo4 },
                      ec: { value: 1.78, unit: 'dS/m', recordedAt: minsAgo4 },
                      ph: { value: 6.8, unit: 'pH', recordedAt: minsAgo4 },
                      temp: { value: 25.4, unit: '°C', recordedAt: minsAgo4 },
                    },
                    weeklyHistory: buildWeeklySensorHistory(
                      ['moisture', 'ec', 'ph', 'temp'],
                      {
                        moisture: { value: 49.2, unit: '%', recordedAt: minsAgo4 },
                        ec: { value: 1.78, unit: 'dS/m', recordedAt: minsAgo4 },
                        ph: { value: 6.8, unit: 'pH', recordedAt: minsAgo4 },
                        temp: { value: 25.4, unit: '°C', recordedAt: minsAgo4 },
                      },
                      'sensor-2'
                    ),
                    lastReadingAt: minsAgo4,
                    createdAt: minsAgo4,
                  },
                ],
              },
              {
                id: 'field-2',
                name: 'حقل البيوت المحمية',
                cropType: 'طماطم وخضروات',
                farmId: 'farm-1',
                overviewPoints: [
                  { x: 575, y: 115 },
                  { x: 890, y: 115 },
                  { x: 890, y: 580 },
                  { x: 575, y: 580 },
                ],
                geoPoints: [
                  { lat: 24.1568, lng: 47.3381 },
                  { lat: 24.1568, lng: 47.3414 },
                  { lat: 24.1541, lng: 47.3414 },
                  { lat: 24.1541, lng: 47.3381 },
                ],
                zones: [
                  {
                    id: 'zone-3',
                    name: 'الصوبة الأولى — شمال',
                    cropOrNote: 'طماطم كرزية',
                    color: '#0D9488',
                    schematicPoints: [
                      { x: 605, y: 160 },
                      { x: 860, y: 160 },
                      { x: 860, y: 525 },
                      { x: 605, y: 525 },
                    ],
                    geoPoints: [
                      { lat: 24.1563, lng: 47.3385 },
                      { lat: 24.1563, lng: 47.3411 },
                      { lat: 24.1544, lng: 47.3411 },
                      { lat: 24.1544, lng: 47.3385 },
                    ],
                  },
                ],
                sensors: [
                  {
                    id: 'sensor-3',
                    name: 'حساس حموضة الصوبة ١',
                    deviceId: 'GH-PH-301',
                    type: 'ph',
                    measurements: ['ph'],
                    farmId: 'farm-1',
                    fieldId: 'field-2',
                    zoneId: 'zone-3',
                    schematicPos: { x: 732, y: 335 },
                    geoPos: { lat: 24.1554, lng: 47.3398 },
                    readings: {
                      ph: { value: 6.5, unit: 'pH', recordedAt: minsAgo4 },
                    },
                    weeklyHistory: buildWeeklySensorHistory(
                      ['ph'],
                      { ph: { value: 6.5, unit: 'pH', recordedAt: minsAgo4 } },
                      'sensor-3'
                    ),
                    lastReadingAt: minsAgo4,
                    createdAt: minsAgo4,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}
