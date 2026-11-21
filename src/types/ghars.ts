export type Point = {
  x: number; // Virtual plan coordinate 0..1000
  y: number; // Virtual plan coordinate 0..680
};

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type BackgroundMode = 'blank' | 'image' | 'satellite';

export type DrawTargetKind = 'farm' | 'field' | 'zone';

export type MeasurementType = 'moisture' | 'ec' | 'ph' | 'temp';

export type SensorType = 'moisture' | 'ec' | 'ph' | 'temp' | 'multi';

export type ToolboxItemType = 'farm' | 'field' | 'zone' | SensorType;

export type EditorTool = 'select' | 'pan' | 'draw';

export type ShellSection =
  | 'editor'
  | 'devices'
  | 'farmer-settings'
  | 'sensor-details'
  | 'account-info';

export type PreferredContactMethod = 'phone' | 'whatsapp' | 'email';

export type FarmerAccountStatus = 'active' | 'pending' | 'suspended';

export type FarmerPreferredLanguage = 'ar' | 'en';

export type SensorReading = {
  value: number;
  unit: string;
  recordedAt: string; // ISO string
};

export type SensorHistoryPoint = {
  dateIso: string; // YYYY-MM-DD
  dayLabel: string; // Arabic weekday label
  shortDate: string; // Arabic short day/month
  values: Partial<Record<MeasurementType, number>>;
};

export type SensorDailyPoint = {
  timeLabel: string;
  fullLabel: string;
  values: Partial<Record<MeasurementType, number>>;
};

export type SensorDevice = {
  id: string;
  name: string;
  deviceId: string; // Unique hardware identifier
  type: SensorType;
  measurements: MeasurementType[];
  farmId: string;
  fieldId: string | null;
  zoneId: string | null;
  schematicPos: Point;
  geoPos: GeoPoint;
  readings: Partial<Record<MeasurementType, SensorReading>>;
  weeklyHistory?: SensorHistoryPoint[];
  lastReadingAt: string | null; // null => "في انتظار أول قراءة"
  createdAt: string;
};

export type Zone = {
  id: string;
  name: string;
  cropOrNote: string;
  color: string;
  schematicPoints: Point[];
  geoPoints: GeoPoint[];
};

export type Field = {
  id: string;
  name: string;
  cropType: string;
  farmId: string;
  overviewPoints: Point[];
  geoPoints: GeoPoint[];
  zones: Zone[];
  sensors: SensorDevice[];
};

export type Farm = {
  id: string;
  name: string;
  region: string;
  overviewPoints: Point[];
  geoPoints: GeoPoint[];
  geoCenter: GeoPoint;
  fields: Field[];
};

export type Farmer = {
  id: string;
  name: string;
  phone: string;
  secondaryPhone: string;
  email: string;
  nationalIdOrLicense: string;
  region: string;
  cityOrAddress: string;
  preferredContactMethod: PreferredContactMethod;
  preferredLanguage: FarmerPreferredLanguage;
  accountStatus: FarmerAccountStatus;
  alertsEnabled: boolean;
  moistureAlertThreshold: number;
  tempAlertThreshold: number;
  notes: string;
  createdAt: string;
  backgroundMode: BackgroundMode;
  backgroundImageUrl: string | null;
  imageAspectRatio: number;
  planWidth?: number;
  planHeight?: number;
  geoCenter: GeoPoint;
  geoZoom: number;
  farms: Farm[];
};

export type WorkspaceState = {
  farmers: Farmer[];
};

export type SelectionTarget =
  | { kind: 'farm'; farmId: string }
  | { kind: 'field'; farmId: string; fieldId: string }
  | { kind: 'zone'; farmId: string; fieldId: string; zoneId: string }
  | { kind: 'sensor'; farmId: string; fieldId: string; sensorId: string }
  | null;

export type ActiveDragPayload = {
  itemType: ToolboxItemType;
  label: string;
  clientX: number;
  clientY: number;
};
