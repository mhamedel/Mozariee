import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MEASUREMENT_META,
  SENSOR_META,
  ZONE_PALETTE,
  buildSampleReadings,
  buildWeeklySensorHistory,
  createInitialWorkspace,
  ensureSensorWeeklyHistory,
  normalizeFarmerProfile,
} from '../data/seedData';
import type {
  BackgroundMode,
  DrawTargetKind,
  EditorTool,
  Farm,
  Farmer,
  Field,
  GeoPoint,
  MeasurementType,
  Point,
  SelectionTarget,
  SensorDevice,
  SensorType,
  ShellSection,
  WorkspaceState,
  Zone,
} from '../types/ghars';
import {
  MAX_PLAN_HEIGHT,
  MAX_PLAN_WIDTH,
  MIN_FARM_HEIGHT,
  MIN_FARM_WIDTH,
  distanceToBox,
  enforceHierarchyContainmentAndSizes,
  ensurePlanCanFitFarmsCount,
  getCanvasSafeBox,
  getFarmerPlanDimensions,
  insetBox,
  layoutNewFarmOnCanvas,
  layoutNewFieldInFarm,
  layoutNewZoneInField,
  reflowAfterBoundaryMove,
  remapFarmContents,
  remapFieldContents,
  remapZoneContents,
} from '../utils/autoLayout';
import {
  PLAN_DEFAULT_HEIGHT,
  PLAN_WIDTH,
  createRectPolygon,
  geoToSchematic,
  getBoundingBox,
  getPlanHeight,
  getPlanWidth,
  isGeoPointInPolygon,
  isPointInPolygon,
  partitionBoxIntoSlots,
  schematicToGeo,
  translateGeoPolygon,
  translatePolygon,
} from '../utils/geometry';

const STORAGE_KEY = 'ghars_map_editor_saved_v3';

function cloneWorkspace(ws: WorkspaceState): WorkspaceState {
  return JSON.parse(JSON.stringify(ws)) as WorkspaceState;
}

function loadSavedWorkspace(): WorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialWorkspace();
    const parsed = JSON.parse(raw) as WorkspaceState;
    if (
      parsed &&
      Array.isArray(parsed.farmers) &&
      parsed.farmers.length > 0 &&
      typeof parsed.farmers[0].backgroundMode === 'string'
    ) {
      return {
        ...parsed,
        farmers: parsed.farmers.map((f) => normalizeFarmerProfile(f)),
      };
    }
  } catch {
    // Fallback to initial seed data
  }
  return createInitialWorkspace();
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function generateUniqueDeviceId(ws: WorkspaceState, sensorType: SensorType): string {
  const prefixMap: Record<SensorType, string> = {
    moisture: 'GH-MOI',
    ec: 'GH-EC',
    ph: 'GH-PH',
    temp: 'GH-TMP',
    multi: 'GH-MLT',
  };
  const existingIds = new Set<string>();
  ws.farmers.forEach((f) =>
    f.farms.forEach((fm) =>
      fm.fields.forEach((fl) => fl.sensors.forEach((s) => existingIds.add(s.deviceId.toUpperCase())))
    )
  );
  let num = 101;
  while (existingIds.has(`${prefixMap[sensorType]}-${num}`)) {
    num++;
  }
  return `${prefixMap[sensorType]}-${num}`;
}

export function useGharsStore() {
  const [savedWorkspace, setSavedWorkspace] = useState<WorkspaceState>(() => loadSavedWorkspace());
  const [draftWorkspace, setDraftWorkspace] = useState<WorkspaceState>(() =>
    cloneWorkspace(loadSavedWorkspace())
  );
  const [undoStack, setUndoStack] = useState<WorkspaceState[]>([]);
  const [redoStack, setRedoStack] = useState<WorkspaceState[]>([]);

  const [shellSection, setShellSection] = useState<ShellSection>('editor');
  const [isFarmerPreview, setIsFarmerPreview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hideEditorPanels, setHideEditorPanels] = useState(false);
  const wasNativeFullscreenRef = useRef(false);

  const [activeFarmerId, setActiveFarmerId] = useState<string>(
    () => savedWorkspace.farmers[0]?.id ?? ''
  );

  const [activeTool, setActiveToolState] = useState<EditorTool>('select');
  const [drawTargetKind, setDrawTargetKind] = useState<DrawTargetKind>('zone');
  const [selection, setSelection] = useState<SelectionTarget>(null);
  const [focusedFarmId, setFocusedFarmId] = useState<string | null>(null);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const [sensorValueFocusToken, setSensorValueFocusToken] = useState(0);
  const [fitViewToken, setFitViewToken] = useState(0);
  const [popupSensorId, setPopupSensorId] = useState<string | null>(null);
  const [popupView, setPopupView] = useState<'chart'>('chart');
  const [detailsSensorId, setDetailsSensorId] = useState<string | null>(null);

  const requestSensorValuesFocus = useCallback(() => {
    setSensorValueFocusToken((t) => t + 1);
  }, []);

  const requestFitView = useCallback(() => {
    setFitViewToken((t) => t + 1);
  }, []);

  const openSensorPopup = useCallback((sensorId: string, view: 'chart' = 'chart') => {
    setPopupSensorId(sensorId);
    setPopupView(view);
  }, []);

  const closeSensorPopup = useCallback(() => {
    setPopupSensorId(null);
    setPopupView('chart');
  }, []);

  const openSensorDetails = useCallback((sensorId: string) => {
    setDetailsSensorId(sensorId);
    setPopupSensorId(null);
    setIsFarmerPreview(false);
    setIsFullscreen(false);
    setHideEditorPanels(false);
    setShellSection('sensor-details');
  }, []);

  const [toastMessage, setToastMessage] = useState<{
    text: string;
    tone: 'info' | 'success' | 'warn';
  } | null>(null);

  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((text: string, tone: 'info' | 'success' | 'warn' = 'info') => {
    setToastMessage({ text, tone });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3400);
  }, []);

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(draftWorkspace) !== JSON.stringify(savedWorkspace);
  }, [draftWorkspace, savedWorkspace]);

  const draftRef = useRef(draftWorkspace);
  draftRef.current = draftWorkspace;

  const commitChange = useCallback((updater: (prev: WorkspaceState) => WorkspaceState) => {
    const before = cloneWorkspace(draftRef.current);
    const next = updater(cloneWorkspace(before));
    setUndoStack((s) => [...s.slice(-49), before]);
    setRedoStack([]);
    setDraftWorkspace(next);
    return next;
  }, []);

  const applyLiveTransform = useCallback((updater: (prev: WorkspaceState) => WorkspaceState) => {
    setDraftWorkspace((prev) => updater(cloneWorkspace(prev)));
  }, []);

  const pushCheckpoint = useCallback((beforeSnapshot: WorkspaceState) => {
    if (JSON.stringify(beforeSnapshot) === JSON.stringify(draftRef.current)) return;
    setUndoStack((s) => [...s.slice(-49), cloneWorkspace(beforeSnapshot)]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      setRedoStack((r) => [...r, cloneWorkspace(draftRef.current)]);
      setDraftWorkspace(previous);
      setSelectedVertexIndex(null);
      showToast('تم التراجع عن آخر إجراء', 'info');
      return stack.slice(0, -1);
    });
  }, [showToast]);

  const redo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[stack.length - 1];
      setUndoStack((u) => [...u, cloneWorkspace(draftRef.current)]);
      setDraftWorkspace(next);
      setSelectedVertexIndex(null);
      showToast('تمت إعادة الإجراء', 'info');
      return stack.slice(0, -1);
    });
  }, [showToast]);

  const saveChanges = useCallback(() => {
    const snapshot = cloneWorkspace(draftRef.current);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore quota errors cleanly
    }
    setSavedWorkspace(snapshot);
    showToast('تم حفظ التغييرات في المنصة بنجاح', 'success');
  }, [showToast]);

  const resetToDefault = useCallback(() => {
    const fresh = createInitialWorkspace();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // Ignore
    }
    setSavedWorkspace(fresh);
    setDraftWorkspace(cloneWorkspace(fresh));
    setUndoStack([]);
    setRedoStack([]);
    setActiveFarmerId(fresh.farmers[0]?.id ?? '');
    setSelection(null);
    setFocusedFarmId(null);
    setSelectedVertexIndex(null);
    setActiveToolState('select');
    showToast('تمت إعادة تعيين البيانات إلى الوضع الافتراضي', 'info');
  }, [showToast]);

  const activeWorkspace = isFarmerPreview ? savedWorkspace : draftWorkspace;

  const activeFarmer = useMemo<Farmer | null>(() => {
    return (
      activeWorkspace.farmers.find((f) => f.id === activeFarmerId) ??
      activeWorkspace.farmers[0] ??
      null
    );
  }, [activeWorkspace, activeFarmerId]);

  const activeFarm = useMemo<Farm | null>(() => {
    if (!activeFarmer) return null;
    if (selection) {
      const found = activeFarmer.farms.find((fm) => fm.id === selection.farmId);
      if (found) return found;
    }
    return activeFarmer.farms[0] ?? null;
  }, [activeFarmer, selection]);

  const activeField = useMemo<Field | null>(() => {
    if (!activeFarmer) return null;
    if (selection && selection.kind !== 'farm') {
      for (const fm of activeFarmer.farms) {
        const fl = fm.fields.find((x) => x.id === selection.fieldId);
        if (fl) return fl;
      }
    }
    return activeFarm?.fields[0] ?? null;
  }, [activeFarmer, activeFarm, selection]);

  const setActiveTool = useCallback(
    (tool: EditorTool) => {
      setActiveToolState(tool);
      if (tool === 'draw' && activeFarmer) {
        if (activeFarmer.farms.length === 0) {
          setDrawTargetKind('farm');
        } else if (activeFarmer.farms.every((fm) => fm.fields.length === 0)) {
          setDrawTargetKind('field');
        } else {
          setDrawTargetKind('zone');
        }
      }
    },
    [activeFarmer]
  );

  const selectFarmer = useCallback((farmerId: string) => {
    setActiveFarmerId(farmerId);
    setSelection(null);
    setFocusedFarmId(null);
    setSelectedVertexIndex(null);
    setActiveToolState('select');
  }, []);

  const focusSingleFarm = useCallback(
    (farmId: string | null) => {
      setFocusedFarmId(farmId);
      if (farmId) {
        setSelection({ kind: 'farm', farmId });
        setSelectedVertexIndex(null);
        closeSensorPopup();
      }
    },
    [closeSensorPopup]
  );

  const stepFocusedFarm = useCallback(
    (direction: 'prev' | 'next') => {
      if (!activeFarmer || activeFarmer.farms.length === 0) return;
      const farms = activeFarmer.farms;
      const currentId = focusedFarmId ?? activeFarm?.id ?? farms[0].id;
      const curIdx = Math.max(0, farms.findIndex((fm) => fm.id === currentId));
      const nextIdx =
        direction === 'next'
          ? (curIdx + 1) % farms.length
          : (curIdx - 1 + farms.length) % farms.length;
      focusSingleFarm(farms[nextIdx].id);
    },
    [activeFarm?.id, activeFarmer, focusSingleFarm, focusedFarmId]
  );

  const addFarmer = useCallback(
    (payload: {
      name: string;
      region?: string;
      phone?: string;
      secondaryPhone?: string;
      email?: string;
      nationalIdOrLicense?: string;
      cityOrAddress?: string;
      preferredContactMethod?: Farmer['preferredContactMethod'];
      preferredLanguage?: Farmer['preferredLanguage'];
      accountStatus?: Farmer['accountStatus'];
      alertsEnabled?: boolean;
      moistureAlertThreshold?: number;
      tempAlertThreshold?: number;
      notes?: string;
    }) => {
      const trimmed = payload.name.trim();
      if (!trimmed) return;
      const newFarmerId = uid('farmer');
      const newFarmer = normalizeFarmerProfile({
        id: newFarmerId,
        name: trimmed,
        region: payload.region?.trim() || 'غير محدد',
        phone: payload.phone?.trim() ?? '',
        secondaryPhone: payload.secondaryPhone?.trim() ?? '',
        email: payload.email?.trim() ?? '',
        nationalIdOrLicense: payload.nationalIdOrLicense?.trim() ?? '',
        cityOrAddress: payload.cityOrAddress?.trim() ?? '',
        preferredContactMethod: payload.preferredContactMethod ?? 'whatsapp',
        preferredLanguage: payload.preferredLanguage ?? 'ar',
        accountStatus: payload.accountStatus ?? 'active',
        alertsEnabled: payload.alertsEnabled ?? true,
        moistureAlertThreshold: payload.moistureAlertThreshold ?? 32,
        tempAlertThreshold: payload.tempAlertThreshold ?? 38,
        notes: payload.notes?.trim() ?? '',
        createdAt: new Date().toISOString(),
        backgroundMode: 'blank',
        backgroundImageUrl: null,
        imageAspectRatio: 1000 / 680,
        geoCenter: { lat: 24.1555, lng: 47.3366 },
        geoZoom: 16,
        farms: [],
      });
      commitChange((ws) => {
        ws.farmers.push(newFarmer);
        return ws;
      });
      setActiveFarmerId(newFarmerId);
      setSelection(null);
      setFocusedFarmId(null);
      setSelectedVertexIndex(null);
      setActiveToolState('select');
      showToast(`تم إنشاء ملف المزارع «${trimmed}» بنجاح`, 'success');
    },
    [commitChange, showToast]
  );

  const updateFarmerProfile = useCallback(
    (
      farmerId: string,
      patch: Partial<
        Pick<
          Farmer,
          | 'name'
          | 'phone'
          | 'secondaryPhone'
          | 'email'
          | 'nationalIdOrLicense'
          | 'region'
          | 'cityOrAddress'
          | 'preferredContactMethod'
          | 'preferredLanguage'
          | 'accountStatus'
          | 'alertsEnabled'
          | 'moistureAlertThreshold'
          | 'tempAlertThreshold'
          | 'notes'
        >
      >
    ) => {
      commitChange((ws) => {
        const farmer = ws.farmers.find((f) => f.id === farmerId);
        if (!farmer) return ws;
        Object.assign(farmer, patch);
        return ws;
      });
    },
    [commitChange]
  );

  const deleteFarmer = useCallback(
    (farmerId: string) => {
      if (draftRef.current.farmers.length <= 1) {
        showToast('يجب الإبقاء على ملف مزارع واحد على الأقل في النظام', 'warn');
        return;
      }
      const target = draftRef.current.farmers.find((f) => f.id === farmerId);
      let fallbackId = '';
      commitChange((ws) => {
        ws.farmers = ws.farmers.filter((f) => f.id !== farmerId);
        fallbackId = ws.farmers[0]?.id ?? '';
        return ws;
      });
      if (activeFarmerId === farmerId && fallbackId) {
        setActiveFarmerId(fallbackId);
      }
      setSelection(null);
      setFocusedFarmId(null);
      setSelectedVertexIndex(null);
      closeSensorPopup();
      if (target) {
        showToast(`تم حذف ملف المزارع «${target.name}»`, 'info');
      }
    },
    [activeFarmerId, closeSensorPopup, commitChange, showToast]
  );

  const setCanvasBackground = useCallback(
    (mode: BackgroundMode, imagePayload?: { url: string; aspectRatio: number }) => {
      if (!activeFarmer) return;
      commitChange((ws) => {
        const farmer = ws.farmers.find((f) => f.id === activeFarmer.id);
        if (!farmer) return ws;
        farmer.backgroundMode = mode;
        if (imagePayload) {
          farmer.backgroundImageUrl = imagePayload.url;
          farmer.imageAspectRatio = imagePayload.aspectRatio;
        }
        return ws;
      });
    },
    [activeFarmer, commitChange]
  );

  const createFarm = useCallback(
    (params: {
      schematicPoints?: Point[];
      geoPoints?: GeoPoint[];
      name?: string;
      autoFitSpace?: boolean;
    }) => {
      if (!activeFarmer) return;
      const farmId = uid('farm');
      const farmIndex = activeFarmer.farms.length + 1;
      const farmName = params.name?.trim() || `مزرعة ${farmIndex}`;
      const { planW: initialPlanW, planH: initialPlanH } = getFarmerPlanDimensions(activeFarmer);
      const isSat = activeFarmer.backgroundMode === 'satellite';
      let didAutoResize = false;
      let didExpandPlan = false;

      commitChange((ws) => {
        const farmer = ws.farmers.find((f) => f.id === activeFarmer.id);
        if (!farmer) return ws;

        let schematicPoints =
          params.schematicPoints ??
          (params.geoPoints
            ? params.geoPoints.map((gp) =>
                geoToSchematic(gp, farmer.geoCenter, initialPlanH, initialPlanW)
              )
            : createRectPolygon(initialPlanW / 2, initialPlanH / 2, 235, 175));

        if (!isSat) {
          const layout = layoutNewFarmOnCanvas(
            farmer,
            schematicPoints,
            params.autoFitSpace === false
          );
          schematicPoints = layout.farmPoints;
          didAutoResize = layout.resizedExisting;
          didExpandPlan = layout.expandedPlan;
        }

        const { planW: nextW, planH: nextH } = getFarmerPlanDimensions(farmer);
        const geoPoints =
          params.geoPoints ??
          schematicPoints.map((pt) => schematicToGeo(pt, farmer.geoCenter, nextH, nextW));

        farmer.farms.push({
          id: farmId,
          name: farmName,
          region: farmer.region || 'غير محدد',
          geoCenter: { ...farmer.geoCenter },
          overviewPoints: schematicPoints,
          geoPoints,
          fields: [],
        });

        if (!isSat) {
          enforceHierarchyContainmentAndSizes(farmer);
        }
        return ws;
      });

      setSelection({ kind: 'farm', farmId });
      if (focusedFarmId !== null) {
        setFocusedFarmId(farmId);
      }
      setSelectedVertexIndex(null);
      setActiveToolState('select');
      showToast(
        didExpandPlan
          ? `تمت إضافة «${farmName}» وتوسيع مساحة المخطط تلقائياً`
          : didAutoResize
          ? `تمت إضافة «${farmName}» وتعديل أحجام المزارع تلقائياً لتوفير مساحة كافية`
          : `تمت إضافة «${farmName}» إلى الخريطة`,
        'success'
      );
    },
    [activeFarmer, commitChange, focusedFarmId, showToast]
  );

  const createField = useCallback(
    (params: {
      schematicPoints?: Point[];
      geoPoints?: GeoPoint[];
      name?: string;
      autoFitSpace?: boolean;
    }) => {
      if (!activeFarmer) return;
      if (activeFarmer.farms.length === 0) {
        showToast('اسحب «مزرعة» إلى اللوحة أولاً قبل إضافة حقل', 'warn');
        return;
      }

      const isSat = activeFarmer.backgroundMode === 'satellite';
      const { planW: initW, planH: initH } = getFarmerPlanDimensions(activeFarmer);
      const fieldId = uid('field');
      let targetFarmId = activeFarm?.id ?? activeFarmer.farms[0].id;
      let targetFarmName = activeFarm?.name ?? activeFarmer.farms[0].name;
      let fieldName = params.name?.trim() || '';
      let didAutoResize = false;

      commitChange((ws) => {
        const farmer = ws.farmers.find((f) => f.id === activeFarmer.id);
        if (!farmer || farmer.farms.length === 0) return ws;

        let schematicPoints =
          params.schematicPoints ??
          (params.geoPoints
            ? params.geoPoints.map((gp) => geoToSchematic(gp, farmer.geoCenter, initH, initW))
            : createRectPolygon(initW / 2, initH / 2, 135, 110));

        const prelimGeo =
          params.geoPoints ??
          schematicPoints.map((pt) => schematicToGeo(pt, farmer.geoCenter, initH, initW));

        const centerPt = {
          x: schematicPoints.reduce((s, p) => s + p.x, 0) / schematicPoints.length,
          y: schematicPoints.reduce((s, p) => s + p.y, 0) / schematicPoints.length,
        };
        const centerGeo = {
          lat: prelimGeo.reduce((s, p) => s + p.lat, 0) / prelimGeo.length,
          lng: prelimGeo.reduce((s, p) => s + p.lng, 0) / prelimGeo.length,
        };

        const directMatch = isSat
          ? farmer.farms.find((fm) => isGeoPointInPolygon(centerGeo, fm.geoPoints))
          : farmer.farms.find((fm) => isPointInPolygon(centerPt, fm.overviewPoints));

        // If dropped in empty canvas space outside any Farm, expand the nearest Farm container
        const nearestFarm = !directMatch && !isSat
          ? [...farmer.farms].sort(
              (a, b) =>
                distanceToBox(centerPt, getBoundingBox(a.overviewPoints)) -
                distanceToBox(centerPt, getBoundingBox(b.overviewPoints))
            )[0]
          : undefined;

        const containingFarm =
          directMatch ??
          nearestFarm ??
          farmer.farms.find((fm) => fm.id === activeFarm?.id) ??
          farmer.farms[0];

        targetFarmId = containingFarm.id;
        targetFarmName = containingFarm.name;
        if (!fieldName) {
          fieldName = `حقل ${containingFarm.fields.length + 1}`;
        }

        if (!isSat) {
          const layout = layoutNewFieldInFarm(
            farmer,
            containingFarm,
            schematicPoints,
            params.autoFitSpace === false
          );
          schematicPoints = layout.fieldPoints;
          didAutoResize = layout.resizedExisting;
        }

        const { planW: nextW, planH: nextH } = getFarmerPlanDimensions(farmer);
        const geoPoints =
          params.geoPoints ??
          schematicPoints.map((pt) => schematicToGeo(pt, farmer.geoCenter, nextH, nextW));

        containingFarm.fields.push({
          id: fieldId,
          name: fieldName,
          cropType: 'محصول موسمي',
          farmId: containingFarm.id,
          overviewPoints: schematicPoints,
          geoPoints,
          zones: [],
          sensors: [],
        });

        if (!isSat) {
          enforceHierarchyContainmentAndSizes(farmer);
        }
        return ws;
      });

      setSelection({ kind: 'field', farmId: targetFarmId, fieldId });
      setSelectedVertexIndex(null);
      setActiveToolState('select');
      showToast(
        didAutoResize
          ? `تمت إضافة «${fieldName}» وتعديل حجم الحاوية الأم (${targetFarmName}) تلقائياً للاستيعاب`
          : `تمت إضافة «${fieldName}» داخل ${targetFarmName}`,
        'success'
      );
    },
    [activeFarm, activeFarmer, commitChange, showToast]
  );

  const createZone = useCallback(
    (params: {
      schematicPoints?: Point[];
      geoPoints?: GeoPoint[];
      name?: string;
      autoFitSpace?: boolean;
    }) => {
      if (!activeFarmer) return;
      const hasAnyField = activeFarmer.farms.some((fm) => fm.fields.length > 0);
      if (!hasAnyField) {
        showToast('أضف «حقل» داخل المزرعة أولاً ثم أضف المناطق داخله', 'warn');
        return;
      }

      const isSat = activeFarmer.backgroundMode === 'satellite';
      const { planW: initW, planH: initH } = getFarmerPlanDimensions(activeFarmer);
      const zoneId = uid('zone');
      let targetFarmId = '';
      let targetFieldId = '';
      let targetFieldName = '';
      let zoneName = params.name?.trim() || '';
      let didAutoResize = false;

      commitChange((ws) => {
        const farmer = ws.farmers.find((f) => f.id === activeFarmer.id);
        if (!farmer) return ws;

        const allFields = farmer.farms.flatMap((fm) =>
          fm.fields.map((fl) => ({ farm: fm, field: fl }))
        );
        if (allFields.length === 0) return ws;

        let schematicPoints =
          params.schematicPoints ??
          (params.geoPoints
            ? params.geoPoints.map((gp) => geoToSchematic(gp, farmer.geoCenter, initH, initW))
            : createRectPolygon(initW / 2, initH / 2, 85, 75));

        const prelimGeo =
          params.geoPoints ??
          schematicPoints.map((pt) => schematicToGeo(pt, farmer.geoCenter, initH, initW));

        const centerPt = {
          x: schematicPoints.reduce((s, p) => s + p.x, 0) / schematicPoints.length,
          y: schematicPoints.reduce((s, p) => s + p.y, 0) / schematicPoints.length,
        };
        const centerGeo = {
          lat: prelimGeo.reduce((s, p) => s + p.lat, 0) / prelimGeo.length,
          lng: prelimGeo.reduce((s, p) => s + p.lng, 0) / prelimGeo.length,
        };

        const directFieldMatch = isSat
          ? allFields.find(({ field }) => isGeoPointInPolygon(centerGeo, field.geoPoints))
          : allFields.find(({ field }) => isPointInPolygon(centerPt, field.overviewPoints));

        // If dropped in empty space inside a Farm or on open canvas, find nearest Field in that Farm or across Farms
        let nearestPair: { farm: Farm; field: Field } | undefined;
        if (!directFieldMatch && !isSat) {
          const enclosingFarm = farmer.farms.find((fm) =>
            isPointInPolygon(centerPt, fm.overviewPoints)
          );
          const candidatePool =
            enclosingFarm && enclosingFarm.fields.length > 0
              ? enclosingFarm.fields.map((fl) => ({ farm: enclosingFarm, field: fl }))
              : allFields;
          nearestPair = [...candidatePool].sort(
            (a, b) =>
              distanceToBox(centerPt, getBoundingBox(a.field.overviewPoints)) -
              distanceToBox(centerPt, getBoundingBox(b.field.overviewPoints))
          )[0];
        }

        const targetPair =
          directFieldMatch ??
          nearestPair ??
          allFields.find(({ field }) => field.id === activeField?.id) ??
          allFields[0];

        targetFarmId = targetPair.farm.id;
        targetFieldId = targetPair.field.id;
        targetFieldName = targetPair.field.name;
        const idx = targetPair.field.zones.length + 1;
        if (!zoneName) zoneName = `المنطقة ${idx}`;
        const color = ZONE_PALETTE[(idx - 1) % ZONE_PALETTE.length];

        if (!isSat) {
          const layout = layoutNewZoneInField(
            farmer,
            targetPair.farm,
            targetPair.field,
            schematicPoints,
            params.autoFitSpace === false
          );
          schematicPoints = layout.zonePoints;
          didAutoResize = layout.resizedExisting;
        }

        const { planW: nextW, planH: nextH } = getFarmerPlanDimensions(farmer);
        const geoPoints =
          params.geoPoints ??
          schematicPoints.map((pt) => schematicToGeo(pt, farmer.geoCenter, nextH, nextW));

        targetPair.field.zones.push({
          id: zoneId,
          name: zoneName,
          cropOrNote: 'منطقة ري ومراقبة',
          color,
          schematicPoints,
          geoPoints,
        });

        if (!isSat) {
          enforceHierarchyContainmentAndSizes(farmer);
        }
        return ws;
      });

      if (targetFarmId && targetFieldId) {
        setSelection({
          kind: 'zone',
          farmId: targetFarmId,
          fieldId: targetFieldId,
          zoneId,
        });
      }
      setSelectedVertexIndex(null);
      setActiveToolState('select');
      showToast(
        didAutoResize
          ? `تم إنشاء «${zoneName}» وتعديل حجم الحاوية الأم (${targetFieldName}) تلقائياً للاستيعاب`
          : `تم إنشاء «${zoneName}» داخل ${targetFieldName}`,
        'success'
      );
    },
    [activeFarmer, activeField, commitChange, showToast]
  );

  // Called on pointerup after dragging a Farm, Field, or Zone on the schematic canvas
  const finalizeBoundaryMove = useCallback(
    (
      movedTarget:
        | { kind: 'farm'; farmId: string }
        | { kind: 'field'; farmId: string; fieldId: string }
        | { kind: 'zone'; farmId: string; fieldId: string; zoneId: string },
      beforeSnapshot: WorkspaceState
    ) => {
      if (!activeFarmer) return;
      if (JSON.stringify(beforeSnapshot) === JSON.stringify(draftRef.current)) return;

      let adjusted = false;
      let nextSelection: SelectionTarget = null;

      applyLiveTransform((ws) => {
        const farmer = ws.farmers.find((f) => f.id === activeFarmer.id);
        if (!farmer) return ws;
        const result = reflowAfterBoundaryMove(farmer, movedTarget);
        adjusted = result.adjusted;
        if (result.newSelection) {
          if (result.newSelection.kind === 'field' && result.newSelection.fieldId) {
            nextSelection = {
              kind: 'field',
              farmId: result.newSelection.farmId,
              fieldId: result.newSelection.fieldId,
            };
          } else if (
            result.newSelection.kind === 'zone' &&
            result.newSelection.fieldId &&
            result.newSelection.zoneId
          ) {
            nextSelection = {
              kind: 'zone',
              farmId: result.newSelection.farmId,
              fieldId: result.newSelection.fieldId,
              zoneId: result.newSelection.zoneId,
            };
          }
        }
        return ws;
      });

      if (nextSelection) {
        setSelection(nextSelection);
      }

      // Push single Undo checkpoint covering the entire drag + auto-reflow
      setUndoStack((s) => [...s.slice(-49), cloneWorkspace(beforeSnapshot)]);
      setRedoStack([]);

      if (adjusted) {
        showToast('تمت مواءمة الأحجام والمواقع تلقائياً لتناسب اللوحة', 'info');
      }
    },
    [activeFarmer, applyLiveTransform, showToast]
  );

  // Called on pointerup after dragging a corner vertex
  const finalizeBoundaryVertexEdit = useCallback(
    (beforeSnapshot: WorkspaceState) => {
      if (!activeFarmer) return;
      if (JSON.stringify(beforeSnapshot) === JSON.stringify(draftRef.current)) return;

      applyLiveTransform((ws) => {
        const farmer = ws.farmers.find((f) => f.id === activeFarmer.id);
        if (farmer) {
          enforceHierarchyContainmentAndSizes(farmer);
        }
        return ws;
      });

      setUndoStack((s) => [...s.slice(-49), cloneWorkspace(beforeSnapshot)]);
      setRedoStack([]);
    },
    [activeFarmer, applyLiveTransform]
  );

  const resizeEntityScale = useCallback(
    (target: SelectionTarget, scaleFactor: number) => {
      if (!activeFarmer || !target || target.kind === 'sensor') return;
      if (activeFarmer.backgroundMode === 'satellite') {
        showToast('اسحب زوايا الحدود على الخريطة الفضائية لتعديل المساحة', 'info');
        return;
      }

      const curW = getPlanWidth(activeFarmer.planWidth);
      const curH = getPlanHeight(
        activeFarmer.backgroundMode,
        activeFarmer.imageAspectRatio,
        curW,
        activeFarmer.planHeight
      );
      commitChange((ws) => {
        const farmer = ws.farmers.find((f) => f.id === activeFarmer.id);
        if (!farmer) return ws;
        const farm = farmer.farms.find((fm) => fm.id === target.farmId);
        if (!farm) return ws;

        const scaleBox = (box: ReturnType<typeof getBoundingBox>) => {
          const nw = Math.max(80, box.width * scaleFactor);
          const nh = Math.max(70, box.height * scaleFactor);
          return {
            minX: box.cx - nw / 2,
            minY: box.cy - nh / 2,
            maxX: box.cx + nw / 2,
            maxY: box.cy + nh / 2,
            width: nw,
            height: nh,
            cx: box.cx,
            cy: box.cy,
          };
        };

        let nextW = curW;
        let nextH = curH;

        if (target.kind === 'farm') {
          const oldBox = getBoundingBox(farm.overviewPoints);
          const scaledBox = scaleBox(oldBox);

          if (scaleFactor > 1) {
            const neededW = Math.min(3200, Math.max(curW, Math.ceil(scaledBox.width + 100)));
            const neededH =
              farmer.backgroundMode === 'image'
                ? Math.round(neededW / farmer.imageAspectRatio)
                : Math.min(2200, Math.max(curH, Math.ceil(scaledBox.height + 90)));

            if (neededW > curW || neededH > curH) {
              const dx = (neededW - curW) / 2;
              const dy = (neededH - curH) / 2;
              nextW = neededW;
              nextH = neededH;
              farmer.planWidth = nextW;
              farmer.planHeight = nextH;

              farmer.farms.forEach((fm) => {
                if (fm.id === farm.id) return;
                const b = getBoundingBox(fm.overviewPoints);
                remapFarmContents(
                  fm,
                  b,
                  {
                    ...b,
                    minX: b.minX + dx,
                    maxX: b.maxX + dx,
                    minY: b.minY + dy,
                    maxY: b.maxY + dy,
                    cx: b.cx + dx,
                    cy: b.cy + dy,
                  },
                  farmer.geoCenter,
                  nextH
                );
              });

              const shiftedTarget = {
                ...scaledBox,
                minX: scaledBox.minX + dx,
                maxX: scaledBox.maxX + dx,
                minY: scaledBox.minY + dy,
                maxY: scaledBox.maxY + dy,
                cx: scaledBox.cx + dx,
                cy: scaledBox.cy + dy,
              };
              remapFarmContents(farm, oldBox, shiftedTarget, farmer.geoCenter, nextH);
            } else {
              remapFarmContents(farm, oldBox, scaledBox, farmer.geoCenter, nextH);
            }
          } else {
            remapFarmContents(farm, oldBox, scaledBox, farmer.geoCenter, nextH);
          }
        } else if (target.kind === 'field') {
          const field = farm.fields.find((fl) => fl.id === target.fieldId);
          if (field) {
            const oldBox = getBoundingBox(field.overviewPoints);
            remapFieldContents(field, oldBox, scaleBox(oldBox), farmer.geoCenter, nextH);
          }
        } else if (target.kind === 'zone') {
          const field = farm.fields.find((fl) => fl.id === target.fieldId);
          const zone = field?.zones.find((z) => z.id === target.zoneId);
          if (field && zone) {
            const oldBox = getBoundingBox(zone.schematicPoints);
            remapZoneContents(
              zone,
              field.sensors,
              oldBox,
              scaleBox(oldBox),
              farmer.geoCenter,
              nextH
            );
          }
        }

        enforceHierarchyContainmentAndSizes(farmer);
        return ws;
      });
      showToast(scaleFactor < 1 ? 'تم تقليص الحجم لإفساح مساحة' : 'تم توسيع الحجم', 'info');
    },
    [activeFarmer, commitChange, showToast]
  );

  const expandPlanCanvas = useCallback(
    (scaleFactor: number) => {
      if (!activeFarmer) return;
      if (activeFarmer.backgroundMode === 'satellite') {
        showToast('تكبير وتصغير الخريطة الفضائية يتم عبر أزرار التكبير على الخريطة', 'info');
        return;
      }

      const { planW: curW, planH: curH } = getFarmerPlanDimensions(activeFarmer);
      let appliedW = curW;
      let appliedH = curH;

      commitChange((ws) => {
        const farmer = ws.farmers.find((f) => f.id === activeFarmer.id);
        if (!farmer) return ws;

        let nextW = Math.max(PLAN_WIDTH, Math.min(MAX_PLAN_WIDTH, Math.round(curW * scaleFactor)));
        let nextH =
          farmer.backgroundMode === 'image'
            ? Math.round(nextW / farmer.imageAspectRatio)
            : Math.max(PLAN_DEFAULT_HEIGHT, Math.min(MAX_PLAN_HEIGHT, Math.round(curH * scaleFactor)));

        if (scaleFactor < 1 && farmer.farms.length > 0) {
          const allPts = farmer.farms.flatMap((fm) => fm.overviewPoints);
          const totalBox = getBoundingBox(allPts);
          nextW = Math.max(nextW, Math.ceil(totalBox.width + 90), MIN_FARM_WIDTH + 90);
          nextH = Math.max(nextH, Math.ceil(totalBox.height + 90), MIN_FARM_HEIGHT + 90);
          if (farmer.backgroundMode === 'image') {
            nextH = Math.round(nextW / farmer.imageAspectRatio);
          }
        }

        const dx = Math.round((nextW - curW) / 2);
        const dy = Math.round((nextH - curH) / 2);

        farmer.planWidth = nextW;
        farmer.planHeight = nextH;

        if (dx !== 0 || dy !== 0) {
          farmer.farms.forEach((fm) => {
            const b = getBoundingBox(fm.overviewPoints);
            remapFarmContents(
              fm,
              b,
              {
                ...b,
                minX: b.minX + dx,
                maxX: b.maxX + dx,
                minY: b.minY + dy,
                maxY: b.maxY + dy,
                cx: b.cx + dx,
                cy: b.cy + dy,
              },
              farmer.geoCenter,
              nextH,
              nextW
            );
          });
        }

        enforceHierarchyContainmentAndSizes(farmer);
        const dims = getFarmerPlanDimensions(farmer);
        appliedW = dims.planW;
        appliedH = dims.planH;
        return ws;
      });

      showToast(
        scaleFactor >= 1
          ? `تم توسيع مساحة المخطط (${appliedW} × ${appliedH})`
          : `تم تعديل مساحة المخطط (${appliedW} × ${appliedH})`,
        'success'
      );
    },
    [activeFarmer, commitChange, showToast]
  );

  const autoArrangeLayout = useCallback(() => {
    if (!activeFarmer) return;
    if (activeFarmer.backgroundMode === 'satellite') {
      showToast('التنسيق التلقائي متاح في وضع اللوحة الفارغة أو صورة الحقل', 'info');
      return;
    }
    let expandedForFarms = false;
    commitChange((ws) => {
      const farmer = ws.farmers.find((f) => f.id === activeFarmer.id);
      if (!farmer || farmer.farms.length === 0) return ws;
      expandedForFarms = ensurePlanCanFitFarmsCount(
        farmer,
        farmer.farms.length,
        24,
        Math.max(MIN_FARM_WIDTH, 460),
        Math.max(MIN_FARM_HEIGHT, 350)
      );
      const { planW, planH } = getFarmerPlanDimensions(farmer);
      const safeBox = getCanvasSafeBox(farmer);
      const farmSlots = partitionBoxIntoSlots(safeBox, farmer.farms.length, 24, true);
      farmer.farms.forEach((fm, fIdx) => {
        const oldFarmBox = getBoundingBox(fm.overviewPoints);
        remapFarmContents(fm, oldFarmBox, farmSlots[fIdx], farmer.geoCenter, planH, planW);
        if (fm.fields.length > 0) {
          const fInner = insetBox(farmSlots[fIdx], 20, 34, 20, 20);
          const fieldSlots = partitionBoxIntoSlots(fInner, fm.fields.length, 16, true);
          fm.fields.forEach((fl, flIdx) => {
            const oldFieldBox = getBoundingBox(fl.overviewPoints);
            remapFieldContents(fl, oldFieldBox, fieldSlots[flIdx], farmer.geoCenter, planH, planW);
            if (fl.zones.length > 0) {
              const zInner = insetBox(fieldSlots[flIdx], 14, 28, 14, 14);
              const zSlots = partitionBoxIntoSlots(zInner, fl.zones.length, 12, true);
              fl.zones.forEach((z, zIdx) => {
                const oldZBox = getBoundingBox(z.schematicPoints);
                remapZoneContents(z, fl.sensors, oldZBox, zSlots[zIdx], farmer.geoCenter, planH, planW);
              });
            }
          });
        }
      });
      enforceHierarchyContainmentAndSizes(farmer);
      return ws;
    });
    showToast(
      expandedForFarms
        ? 'تم توسيع المخطط وموازنة جميع المزارع والحقول والمناطق مع الحفاظ على الحد الأدنى للحجم'
        : 'تمت موازنة وتوزيع جميع المزارع والحقول والمناطق على اللوحة',
      'success'
    );
  }, [activeFarmer, commitChange, showToast]);

  const placeSensorAtPoint = useCallback(
    (sensorType: SensorType, coords: { schematicPos?: Point; geoPos?: GeoPoint }) => {
      if (!activeFarmer) return;
      const allFields = activeFarmer.farms.flatMap((fm) =>
        fm.fields.map((fl) => ({ farm: fm, field: fl }))
      );
      if (allFields.length === 0) {
        showToast('أضف مزرعة وحقلاً أولاً لتركيب الحساسات داخله', 'warn');
        return;
      }

      const isSat = activeFarmer.backgroundMode === 'satellite';
      const planH = getPlanHeight(activeFarmer.backgroundMode, activeFarmer.imageAspectRatio);

      const schematicPos: Point =
        coords.schematicPos ??
        (coords.geoPos
          ? geoToSchematic(coords.geoPos, activeFarmer.geoCenter, planH)
          : { x: PLAN_WIDTH / 2, y: planH / 2 });

      const geoPos: GeoPoint =
        coords.geoPos ?? schematicToGeo(schematicPos, activeFarmer.geoCenter, planH);

      let matchedPair: { farm: Farm; field: Field; zone: Zone | null } | null = null;
      for (const { farm, field } of allFields) {
        const zone = isSat
          ? field.zones.find((z) => isGeoPointInPolygon(geoPos, z.geoPoints))
          : field.zones.find((z) => isPointInPolygon(schematicPos, z.schematicPoints));
        if (zone) {
          matchedPair = { farm, field, zone };
          break;
        }
      }

      if (!matchedPair) {
        const fieldMatch = allFields.find(({ field }) =>
          isSat
            ? isGeoPointInPolygon(geoPos, field.geoPoints)
            : isPointInPolygon(schematicPos, field.overviewPoints)
        );
        if (fieldMatch) {
          matchedPair = { farm: fieldMatch.farm, field: fieldMatch.field, zone: null };
        }
      }

      if (!matchedPair) {
        const fallback =
          activeField && activeFarm ? { farm: activeFarm, field: activeField } : allFields[0];
        matchedPair = { farm: fallback.farm, field: fallback.field, zone: null };
      }

      const meta = SENSOR_META[sensorType];
      const sensorId = uid('sensor');
      const totalSensors = activeFarmer.farms.reduce(
        (acc, fm) => acc + fm.fields.reduce((a, fl) => a + fl.sensors.length, 0),
        0
      );
      const deviceId = generateUniqueDeviceId(draftRef.current, sensorType);

      const newSensor: SensorDevice = {
        id: sensorId,
        name: `${meta.label} ${totalSensors + 1}`,
        deviceId,
        type: sensorType,
        measurements: [...meta.defaultMeasurements],
        farmId: matchedPair.farm.id,
        fieldId: matchedPair.field.id,
        zoneId: matchedPair.zone?.id ?? null,
        schematicPos,
        geoPos,
        readings: {},
        lastReadingAt: null,
        createdAt: new Date().toISOString(),
      };

      commitChange((ws) => {
        const field = ws.farmers
          .find((f) => f.id === activeFarmer.id)
          ?.farms.find((fm) => fm.id === matchedPair!.farm.id)
          ?.fields.find((fl) => fl.id === matchedPair!.field.id);
        if (!field) return ws;
        field.sensors.push(newSensor);
        return ws;
      });

      setSelection({
        kind: 'sensor',
        farmId: matchedPair.farm.id,
        fieldId: matchedPair.field.id,
        sensorId,
      });
      setSelectedVertexIndex(null);
      setActiveToolState('select');

      const zoneLabel = matchedPair.zone
        ? `داخل «${matchedPair.zone.name}»`
        : `داخل «${matchedPair.field.name}»`;
      showToast(`تم تركيب ${meta.label} (${zoneLabel}) — في انتظار أول قراءة`, 'success');
    },
    [activeFarm, activeFarmer, activeField, commitChange, showToast]
  );

  const moveSensorPosition = useCallback(
    (
      _farmId: string,
      _fieldId: string,
      sensorId: string,
      coords: { schematicPos?: Point; geoPos?: GeoPoint },
      commitDirect = false
    ) => {
      if (!activeFarmer) return;
      const isSat = activeFarmer.backgroundMode === 'satellite';
      const planH = getPlanHeight(activeFarmer.backgroundMode, activeFarmer.imageAspectRatio);

      const applyFn = (ws: WorkspaceState) => {
        const farmer = ws.farmers.find((f) => f.id === activeFarmer.id);
        if (!farmer) return ws;

        let sensor: SensorDevice | undefined;
        let currentField: Field | undefined;

        for (const fm of farmer.farms) {
          for (const fl of fm.fields) {
            const idx = fl.sensors.findIndex((s) => s.id === sensorId);
            if (idx !== -1) {
              sensor = fl.sensors[idx];
              currentField = fl;
              break;
            }
          }
          if (sensor) break;
        }
        if (!sensor || !currentField) return ws;

        if (isSat && coords.geoPos) {
          sensor.geoPos = coords.geoPos;
          sensor.schematicPos = geoToSchematic(coords.geoPos, farmer.geoCenter, planH);
        } else if (coords.schematicPos) {
          sensor.schematicPos = coords.schematicPos;
          sensor.geoPos = schematicToGeo(coords.schematicPos, farmer.geoCenter, planH);
        }

        let newZoneId: string | null = null;
        let newField: Field | null = null;
        let newFarm: Farm | null = null;

        for (const fm of farmer.farms) {
          for (const fl of fm.fields) {
            const matchedZone = isSat
              ? fl.zones.find((z) => isGeoPointInPolygon(sensor!.geoPos, z.geoPoints))
              : fl.zones.find((z) => isPointInPolygon(sensor!.schematicPos, z.schematicPoints));
            if (matchedZone) {
              newZoneId = matchedZone.id;
              newField = fl;
              newFarm = fm;
              break;
            }
          }
          if (newZoneId) break;
        }

        if (!newField) {
          for (const fm of farmer.farms) {
            const matchedField = isSat
              ? fm.fields.find((fl) => isGeoPointInPolygon(sensor!.geoPos, fl.geoPoints))
              : fm.fields.find((fl) => isPointInPolygon(sensor!.schematicPos, fl.overviewPoints));
            if (matchedField) {
              newField = matchedField;
              newFarm = fm;
              break;
            }
          }
        }

        if (newField && newFarm && newField.id !== currentField.id) {
          currentField.sensors = currentField.sensors.filter((s) => s.id !== sensorId);
          sensor.farmId = newFarm.id;
          sensor.fieldId = newField.id;
          sensor.zoneId = newZoneId;
          newField.sensors.push(sensor);
          setSelection({
            kind: 'sensor',
            farmId: newFarm.id,
            fieldId: newField.id,
            sensorId: sensor.id,
          });
        } else {
          sensor.zoneId = newZoneId;
        }

        return ws;
      };

      if (commitDirect) {
        commitChange(applyFn);
      } else {
        applyLiveTransform(applyFn);
      }
    },
    [activeFarmer, applyLiveTransform, commitChange]
  );

  const translateBoundary = useCallback(
    (
      target:
        | { kind: 'farm'; farmId: string; dx: number; dy: number }
        | { kind: 'field'; farmId: string; fieldId: string; dx: number; dy: number }
        | { kind: 'zone'; farmId: string; fieldId: string; zoneId: string; dx: number; dy: number }
        | { kind: 'farm-geo'; farmId: string; dLat: number; dLng: number }
        | { kind: 'field-geo'; farmId: string; fieldId: string; dLat: number; dLng: number }
        | {
            kind: 'zone-geo';
            farmId: string;
            fieldId: string;
            zoneId: string;
            dLat: number;
            dLng: number;
          },
      commitDirect = false
    ) => {
      if (!activeFarmer) return;
      const { planW, planH } = getFarmerPlanDimensions(activeFarmer);

      const applyFn = (ws: WorkspaceState) => {
        const farmer = ws.farmers.find((f) => f.id === activeFarmer.id);
        if (!farmer) return ws;
        const farm = farmer.farms.find((fm) => fm.id === target.farmId);
        if (!farm) return ws;

        if (target.kind === 'farm') {
          farm.overviewPoints = translatePolygon(farm.overviewPoints, target.dx, target.dy);
          farm.geoPoints = farm.overviewPoints.map((pt) =>
            schematicToGeo(pt, farmer.geoCenter, planH, planW)
          );
          farm.fields = farm.fields.map((fl) => ({
            ...fl,
            overviewPoints: translatePolygon(fl.overviewPoints, target.dx, target.dy),
            geoPoints: translatePolygon(fl.overviewPoints, target.dx, target.dy).map((pt) =>
              schematicToGeo(pt, farmer.geoCenter, planH)
            ),
            zones: fl.zones.map((z) => {
              const nextPts = translatePolygon(z.schematicPoints, target.dx, target.dy);
              return {
                ...z,
                schematicPoints: nextPts,
                geoPoints: nextPts.map((pt) => schematicToGeo(pt, farmer.geoCenter, planH)),
              };
            }),
            sensors: fl.sensors.map((s) => {
              const nextPos = { x: s.schematicPos.x + target.dx, y: s.schematicPos.y + target.dy };
              return {
                ...s,
                schematicPos: nextPos,
                geoPos: schematicToGeo(nextPos, farmer.geoCenter, planH),
              };
            }),
          }));
        } else if (target.kind === 'field') {
          const field = farm.fields.find((fl) => fl.id === target.fieldId);
          if (field) {
            field.overviewPoints = translatePolygon(field.overviewPoints, target.dx, target.dy);
            field.geoPoints = field.overviewPoints.map((pt) =>
              schematicToGeo(pt, farmer.geoCenter, planH)
            );
            field.zones = field.zones.map((z) => {
              const nextPts = translatePolygon(z.schematicPoints, target.dx, target.dy);
              return {
                ...z,
                schematicPoints: nextPts,
                geoPoints: nextPts.map((pt) => schematicToGeo(pt, farmer.geoCenter, planH)),
              };
            });
            field.sensors = field.sensors.map((s) => {
              const nextPos = { x: s.schematicPos.x + target.dx, y: s.schematicPos.y + target.dy };
              return {
                ...s,
                schematicPos: nextPos,
                geoPos: schematicToGeo(nextPos, farmer.geoCenter, planH),
              };
            });
          }
        } else if (target.kind === 'zone') {
          const field = farm.fields.find((fl) => fl.id === target.fieldId);
          const zone = field?.zones.find((z) => z.id === target.zoneId);
          if (field && zone) {
            zone.schematicPoints = translatePolygon(zone.schematicPoints, target.dx, target.dy);
            zone.geoPoints = zone.schematicPoints.map((pt) =>
              schematicToGeo(pt, farmer.geoCenter, planH)
            );
            field.sensors = field.sensors.map((s) => {
              if (s.zoneId !== zone.id) return s;
              const nextPos = { x: s.schematicPos.x + target.dx, y: s.schematicPos.y + target.dy };
              return {
                ...s,
                schematicPos: nextPos,
                geoPos: schematicToGeo(nextPos, farmer.geoCenter, planH),
              };
            });
          }
        } else if (target.kind === 'farm-geo') {
          farm.geoPoints = translateGeoPolygon(farm.geoPoints, target.dLat, target.dLng);
          farm.overviewPoints = farm.geoPoints.map((gp) =>
            geoToSchematic(gp, farmer.geoCenter, planH)
          );
        } else if (target.kind === 'field-geo') {
          const field = farm.fields.find((fl) => fl.id === target.fieldId);
          if (field) {
            field.geoPoints = translateGeoPolygon(field.geoPoints, target.dLat, target.dLng);
            field.overviewPoints = field.geoPoints.map((gp) =>
              geoToSchematic(gp, farmer.geoCenter, planH)
            );
          }
        } else if (target.kind === 'zone-geo') {
          const field = farm.fields.find((fl) => fl.id === target.fieldId);
          const zone = field?.zones.find((z) => z.id === target.zoneId);
          if (field && zone) {
            zone.geoPoints = translateGeoPolygon(zone.geoPoints, target.dLat, target.dLng);
            zone.schematicPoints = zone.geoPoints.map((gp) =>
              geoToSchematic(gp, farmer.geoCenter, planH)
            );
            field.sensors = field.sensors.map((s) => {
              const matched = field.zones.find((z) => isGeoPointInPolygon(s.geoPos, z.geoPoints));
              return { ...s, zoneId: matched?.id ?? null };
            });
          }
        }
        return ws;
      };

      if (commitDirect) {
        commitChange(applyFn);
      } else {
        applyLiveTransform(applyFn);
      }
    },
    [activeFarmer, applyLiveTransform, commitChange]
  );

  // Move single vertex of a boundary — clamps child corners strictly inside parent bounds so Zone < Field < Farm!
  const updateBoundaryVertex = useCallback(
    (
      target:
        | { kind: 'farm'; farmId: string; index: number; point: Point }
        | { kind: 'field'; farmId: string; fieldId: string; index: number; point: Point }
        | { kind: 'zone'; farmId: string; fieldId: string; zoneId: string; index: number; point: Point }
        | { kind: 'farm-geo'; farmId: string; index: number; geoPoint: GeoPoint }
        | { kind: 'field-geo'; farmId: string; fieldId: string; index: number; geoPoint: GeoPoint }
        | {
            kind: 'zone-geo';
            farmId: string;
            fieldId: string;
            zoneId: string;
            index: number;
            geoPoint: GeoPoint;
          },
      commitDirect = false
    ) => {
      if (!activeFarmer) return;
      const { planW, planH } = getFarmerPlanDimensions(activeFarmer);

      const applyFn = (ws: WorkspaceState) => {
        const farmer = ws.farmers.find((f) => f.id === activeFarmer.id);
        const farm = farmer?.farms.find((fm) => fm.id === target.farmId);
        if (!farmer || !farm) return ws;

        if (target.kind === 'farm') {
          const safeBox = getCanvasSafeBox(farmer);
          const clamped: Point = {
            x: Math.round(Math.max(safeBox.minX, Math.min(safeBox.maxX, target.point.x))),
            y: Math.round(Math.max(safeBox.minY, Math.min(safeBox.maxY, target.point.y))),
          };

          // Enforce strict minimum Farm dimensions (MIN_FARM_WIDTH × MIN_FARM_HEIGHT) during vertex drag
          const otherPts = farm.overviewPoints.filter((_, idx) => idx !== target.index);
          if (otherPts.length > 0) {
            const otherBox = getBoundingBox(otherPts);
            const testBox = getBoundingBox([...otherPts, clamped]);
            if (testBox.width < MIN_FARM_WIDTH) {
              if (clamped.x <= otherBox.minX) {
                clamped.x = Math.round(Math.max(safeBox.minX, otherBox.maxX - MIN_FARM_WIDTH));
              } else if (clamped.x >= otherBox.maxX) {
                clamped.x = Math.round(Math.min(safeBox.maxX, otherBox.minX + MIN_FARM_WIDTH));
              }
            }
            if (testBox.height < MIN_FARM_HEIGHT) {
              if (clamped.y <= otherBox.minY) {
                clamped.y = Math.round(Math.max(safeBox.minY, otherBox.maxY - MIN_FARM_HEIGHT));
              } else if (clamped.y >= otherBox.maxY) {
                clamped.y = Math.round(Math.min(safeBox.maxY, otherBox.minY + MIN_FARM_HEIGHT));
              }
            }
          }

          farm.overviewPoints[target.index] = clamped;
          farm.geoPoints = farm.overviewPoints.map((pt) =>
            schematicToGeo(pt, farmer.geoCenter, planH, planW)
          );
          enforceHierarchyContainmentAndSizes(farmer);
        } else if (target.kind === 'field') {
          const field = farm.fields.find((fl) => fl.id === target.fieldId);
          if (field) {
            // Strictly clamp Field corner inside parent Farm's inner bounds so Field is ALWAYS smaller than Farm
            const farmInner = insetBox(getBoundingBox(farm.overviewPoints), 18, 34, 18, 18);
            const clamped: Point = {
              x: Math.round(Math.max(farmInner.minX, Math.min(farmInner.maxX, target.point.x))),
              y: Math.round(Math.max(farmInner.minY, Math.min(farmInner.maxY, target.point.y))),
            };
            field.overviewPoints[target.index] = clamped;
            field.geoPoints = field.overviewPoints.map((pt) =>
              schematicToGeo(pt, farmer.geoCenter, planH, planW)
            );
            enforceHierarchyContainmentAndSizes(farmer);
          }
        } else if (target.kind === 'zone') {
          const field = farm.fields.find((fl) => fl.id === target.fieldId);
          const zone = field?.zones.find((z) => z.id === target.zoneId);
          if (field && zone) {
            // Strictly clamp Zone corner inside parent Field's inner bounds so Zone is ALWAYS smaller than Field
            const fieldInner = insetBox(getBoundingBox(field.overviewPoints), 14, 28, 14, 14);
            const clamped: Point = {
              x: Math.round(Math.max(fieldInner.minX, Math.min(fieldInner.maxX, target.point.x))),
              y: Math.round(Math.max(fieldInner.minY, Math.min(fieldInner.maxY, target.point.y))),
            };
            zone.schematicPoints[target.index] = clamped;
            zone.geoPoints = zone.schematicPoints.map((pt) =>
              schematicToGeo(pt, farmer.geoCenter, planH)
            );
            field.sensors = field.sensors.map((s) => {
              const matched = field.zones.find((z) =>
                isPointInPolygon(s.schematicPos, z.schematicPoints)
              );
              return { ...s, zoneId: matched?.id ?? null };
            });
          }
        } else if (target.kind === 'farm-geo') {
          farm.geoPoints[target.index] = target.geoPoint;
          farm.overviewPoints = farm.geoPoints.map((gp) =>
            geoToSchematic(gp, farmer.geoCenter, planH)
          );
        } else if (target.kind === 'field-geo') {
          const field = farm.fields.find((fl) => fl.id === target.fieldId);
          if (field) {
            field.geoPoints[target.index] = target.geoPoint;
            field.overviewPoints = field.geoPoints.map((gp) =>
              geoToSchematic(gp, farmer.geoCenter, planH)
            );
          }
        } else if (target.kind === 'zone-geo') {
          const field = farm.fields.find((fl) => fl.id === target.fieldId);
          const zone = field?.zones.find((z) => z.id === target.zoneId);
          if (field && zone) {
            zone.geoPoints[target.index] = target.geoPoint;
            zone.schematicPoints = zone.geoPoints.map((gp) =>
              geoToSchematic(gp, farmer.geoCenter, planH)
            );
            field.sensors = field.sensors.map((s) => {
              const matched = field.zones.find((z) => isGeoPointInPolygon(s.geoPos, z.geoPoints));
              return { ...s, zoneId: matched?.id ?? null };
            });
          }
        }
        return ws;
      };

      if (commitDirect) {
        commitChange(applyFn);
      } else {
        applyLiveTransform(applyFn);
      }
    },
    [activeFarmer, applyLiveTransform, commitChange]
  );

  const insertBoundaryVertex = useCallback(
    (
      target: SelectionTarget,
      afterIndex: number,
      point: { schematic?: Point; geo?: GeoPoint }
    ) => {
      if (!activeFarmer || !target || target.kind === 'sensor') return;
      const planH = getPlanHeight(activeFarmer.backgroundMode, activeFarmer.imageAspectRatio);
      const isSat = activeFarmer.backgroundMode === 'satellite';

      commitChange((ws) => {
        const farmer = ws.farmers.find((f) => f.id === activeFarmer.id);
        const farm = farmer?.farms.find((fm) => fm.id === target.farmId);
        if (!farmer || !farm) return ws;

        if (target.kind === 'farm') {
          if (isSat && point.geo) {
            farm.geoPoints.splice(afterIndex + 1, 0, point.geo);
            farm.overviewPoints = farm.geoPoints.map((gp) =>
              geoToSchematic(gp, farmer.geoCenter, planH)
            );
          } else if (point.schematic) {
            farm.overviewPoints.splice(afterIndex + 1, 0, point.schematic);
            farm.geoPoints = farm.overviewPoints.map((pt) =>
              schematicToGeo(pt, farmer.geoCenter, planH)
            );
          }
        } else if (target.kind === 'field') {
          const field = farm.fields.find((fl) => fl.id === target.fieldId);
          if (field) {
            if (isSat && point.geo) {
              field.geoPoints.splice(afterIndex + 1, 0, point.geo);
              field.overviewPoints = field.geoPoints.map((gp) =>
                geoToSchematic(gp, farmer.geoCenter, planH)
              );
            } else if (point.schematic) {
              field.overviewPoints.splice(afterIndex + 1, 0, point.schematic);
              field.geoPoints = field.overviewPoints.map((pt) =>
                schematicToGeo(pt, farmer.geoCenter, planH)
              );
            }
          }
        } else if (target.kind === 'zone') {
          const field = farm.fields.find((fl) => fl.id === target.fieldId);
          const zone = field?.zones.find((z) => z.id === target.zoneId);
          if (field && zone) {
            if (isSat && point.geo) {
              zone.geoPoints.splice(afterIndex + 1, 0, point.geo);
              zone.schematicPoints = zone.geoPoints.map((gp) =>
                geoToSchematic(gp, farmer.geoCenter, planH)
              );
            } else if (point.schematic) {
              zone.schematicPoints.splice(afterIndex + 1, 0, point.schematic);
              zone.geoPoints = zone.schematicPoints.map((pt) =>
                schematicToGeo(pt, farmer.geoCenter, planH)
              );
            }
          }
        }
        return ws;
      });
      setSelectedVertexIndex(afterIndex + 1);
      showToast('تمت إضافة نقطة زاوية جديدة على الضلع', 'info');
    },
    [activeFarmer, commitChange, showToast]
  );

  const removeBoundaryVertex = useCallback(
    (target: SelectionTarget, index: number) => {
      if (!activeFarmer || !target || target.kind === 'sensor') return;
      let removed = false;
      commitChange((ws) => {
        const farmer = ws.farmers.find((f) => f.id === activeFarmer.id);
        const farm = farmer?.farms.find((fm) => fm.id === target.farmId);
        if (!farmer || !farm) return ws;

        if (target.kind === 'farm' && farm.overviewPoints.length > 3) {
          farm.overviewPoints.splice(index, 1);
          farm.geoPoints.splice(index, 1);
          removed = true;
        } else if (target.kind === 'field') {
          const field = farm.fields.find((fl) => fl.id === target.fieldId);
          if (field && field.overviewPoints.length > 3) {
            field.overviewPoints.splice(index, 1);
            field.geoPoints.splice(index, 1);
            removed = true;
          }
        } else if (target.kind === 'zone') {
          const field = farm.fields.find((fl) => fl.id === target.fieldId);
          const zone = field?.zones.find((z) => z.id === target.zoneId);
          if (field && zone && zone.schematicPoints.length > 3) {
            zone.schematicPoints.splice(index, 1);
            zone.geoPoints.splice(index, 1);
            removed = true;
          }
        }
        if (removed && farmer.backgroundMode !== 'satellite') {
          enforceHierarchyContainmentAndSizes(farmer);
        }
        return ws;
      });
      if (removed) {
        setSelectedVertexIndex(null);
        showToast('تم حذف نقطة الزاوية', 'info');
      } else {
        showToast('يجب بقاء 3 نقاط على الأقل لتشكيل الحدود', 'warn');
      }
    },
    [activeFarmer, commitChange, showToast]
  );

  const updateFarmProps = useCallback(
    (farmId: string, patch: Partial<Pick<Farm, 'name' | 'region'>>) => {
      if (!activeFarmer) return;
      commitChange((ws) => {
        const farm = ws.farmers
          .find((f) => f.id === activeFarmer.id)
          ?.farms.find((fm) => fm.id === farmId);
        if (farm) Object.assign(farm, patch);
        return ws;
      });
    },
    [activeFarmer, commitChange]
  );

  const updateFieldProps = useCallback(
    (farmId: string, fieldId: string, patch: Partial<Pick<Field, 'name' | 'cropType'>>) => {
      if (!activeFarmer) return;
      commitChange((ws) => {
        const farm = ws.farmers
          .find((f) => f.id === activeFarmer.id)
          ?.farms.find((fm) => fm.id === farmId);
        const field = farm?.fields.find((fl) => fl.id === fieldId);
        if (field) Object.assign(field, patch);
        return ws;
      });
    },
    [activeFarmer, commitChange]
  );

  const updateZoneProps = useCallback(
    (
      farmId: string,
      fieldId: string,
      zoneId: string,
      patch: Partial<Pick<Zone, 'name' | 'cropOrNote' | 'color'>>
    ) => {
      if (!activeFarmer) return;
      commitChange((ws) => {
        const zone = ws.farmers
          .find((f) => f.id === activeFarmer.id)
          ?.farms.find((fm) => fm.id === farmId)
          ?.fields.find((fl) => fl.id === fieldId)
          ?.zones.find((z) => z.id === zoneId);
        if (zone) Object.assign(zone, patch);
        return ws;
      });
    },
    [activeFarmer, commitChange]
  );

  const updateSensorProps = useCallback(
    (
      farmId: string,
      fieldId: string,
      sensorId: string,
      patch: Partial<Pick<SensorDevice, 'name' | 'deviceId' | 'zoneId' | 'measurements'>>
    ) => {
      if (!activeFarmer) return;
      commitChange((ws) => {
        const field = ws.farmers
          .find((f) => f.id === activeFarmer.id)
          ?.farms.find((fm) => fm.id === farmId)
          ?.fields.find((fl) => fl.id === fieldId);
        const sensor = field?.sensors.find((s) => s.id === sensorId);
        if (!sensor) return ws;
        Object.assign(sensor, patch);
        return ws;
      });
    },
    [activeFarmer, commitChange]
  );

  const recordTestReading = useCallback(
    (farmId: string, fieldId: string, sensorId: string, customMeasurements?: MeasurementType[]) => {
      const nowIso = new Date().toISOString();
      const applyReadings = (ws: WorkspaceState) => {
        for (const farmer of ws.farmers) {
          const farm = farmer.farms.find((fm) => fm.id === farmId);
          const field = farm?.fields.find((fl) => fl.id === fieldId);
          const sensor = field?.sensors.find((s) => s.id === sensorId);
          if (sensor) {
            const keys = customMeasurements ?? sensor.measurements;
            const nextReadings = buildSampleReadings(keys, nowIso);
            sensor.readings = nextReadings;
            sensor.lastReadingAt = nowIso;
            const history = ensureSensorWeeklyHistory(sensor);
            const today = history[history.length - 1];
            if (today) {
              keys.forEach((m) => {
                if (nextReadings[m] !== undefined) {
                  today.values[m] = nextReadings[m]!.value;
                }
              });
            }
            sensor.weeklyHistory = history;
            return ws;
          }
        }
        return ws;
      };

      if (isFarmerPreview) {
        const updatedSaved = applyReadings(cloneWorkspace(savedWorkspace));
        setSavedWorkspace(updatedSaved);
        setDraftWorkspace(applyReadings(cloneWorkspace(draftRef.current)));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSaved));
        } catch {
          // ignore
        }
      } else {
        commitChange(applyReadings);
      }
      showToast('تم تسجيل قراءة ميدانية جديدة للجهاز', 'success');
    },
    [commitChange, isFarmerPreview, savedWorkspace, showToast]
  );

  const regenerateWeeklyHistory = useCallback(
    (farmId: string, fieldId: string, sensorId: string) => {
      const applyHistory = (ws: WorkspaceState) => {
        for (const farmer of ws.farmers) {
          const farm = farmer.farms.find((fm) => fm.id === farmId);
          const field = farm?.fields.find((fl) => fl.id === fieldId);
          const sensor = field?.sensors.find((s) => s.id === sensorId);
          if (sensor) {
            sensor.weeklyHistory = buildWeeklySensorHistory(
              sensor.measurements,
              sensor.readings,
              sensor.id,
              true
            );
            return ws;
          }
        }
        return ws;
      };

      if (isFarmerPreview) {
        const updatedSaved = applyHistory(cloneWorkspace(savedWorkspace));
        setSavedWorkspace(updatedSaved);
        setDraftWorkspace(applyHistory(cloneWorkspace(draftRef.current)));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSaved));
        } catch {
          // ignore
        }
      } else {
        commitChange(applyHistory);
      }
      showToast('تم تحديث سجل القراءات الاختبارية للأسبوع الماضي', 'info');
    },
    [commitChange, isFarmerPreview, savedWorkspace, showToast]
  );

  const updateSensorReadingValue = useCallback(
    (
      farmId: string,
      fieldId: string,
      sensorId: string,
      measurement: MeasurementType,
      value: number | null
    ) => {
      const nowIso = new Date().toISOString();
      const applyValue = (ws: WorkspaceState) => {
        for (const farmer of ws.farmers) {
          const farm = farmer.farms.find((fm) => fm.id === farmId);
          const field = farm?.fields.find((fl) => fl.id === fieldId);
          const sensor = field?.sensors.find((s) => s.id === sensorId);
          if (sensor) {
            const nextReadings = { ...sensor.readings };
            if (value === null || Number.isNaN(value)) {
              delete nextReadings[measurement];
              sensor.readings = nextReadings;
              const remainingTimes = Object.values(nextReadings)
                .map((r) => r?.recordedAt)
                .filter((t): t is string => Boolean(t));
              sensor.lastReadingAt =
                remainingTimes.length > 0 ? remainingTimes.sort().slice(-1)[0] : null;
            } else {
              nextReadings[measurement] = {
                value,
                unit: MEASUREMENT_META[measurement].unit,
                recordedAt: nowIso,
              };
              sensor.readings = nextReadings;
              sensor.lastReadingAt = nowIso;
              const history = ensureSensorWeeklyHistory(sensor);
              const today = history[history.length - 1];
              if (today) {
                today.values[measurement] = value;
              }
              sensor.weeklyHistory = history;
            }
            return ws;
          }
        }
        return ws;
      };

      if (isFarmerPreview) {
        const updatedSaved = applyValue(cloneWorkspace(savedWorkspace));
        setSavedWorkspace(updatedSaved);
        setDraftWorkspace(applyValue(cloneWorkspace(draftRef.current)));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSaved));
        } catch {
          // ignore
        }
      } else {
        commitChange(applyValue);
      }
    },
    [commitChange, isFarmerPreview, savedWorkspace]
  );

  const deleteSelection = useCallback(() => {
    if (!activeFarmer || !selection) return;
    const sel = selection;
    commitChange((ws) => {
      const farmer = ws.farmers.find((f) => f.id === activeFarmer.id);
      if (!farmer) return ws;
      if (sel.kind === 'farm') {
        farmer.farms = farmer.farms.filter((fm) => fm.id !== sel.farmId);
      } else if (sel.kind === 'field') {
        const farm = farmer.farms.find((fm) => fm.id === sel.farmId);
        if (farm) farm.fields = farm.fields.filter((fl) => fl.id !== sel.fieldId);
      } else if (sel.kind === 'zone') {
        const field = farmer.farms
          .find((fm) => fm.id === sel.farmId)
          ?.fields.find((fl) => fl.id === sel.fieldId);
        if (field) {
          field.zones = field.zones.filter((z) => z.id !== sel.zoneId);
          field.sensors = field.sensors.map((s) =>
            s.zoneId === sel.zoneId ? { ...s, zoneId: null } : s
          );
        }
      } else if (sel.kind === 'sensor') {
        const field = farmer.farms
          .find((fm) => fm.id === sel.farmId)
          ?.fields.find((fl) => fl.id === sel.fieldId);
        if (field) {
          field.sensors = field.sensors.filter((s) => s.id !== sel.sensorId);
        }
      }
      return ws;
    });
    if (sel.kind === 'farm' && focusedFarmId === sel.farmId) {
      const remaining = activeFarmer.farms.filter((fm) => fm.id !== sel.farmId);
      setFocusedFarmId(remaining[0]?.id ?? null);
    }
    setSelection(null);
    setSelectedVertexIndex(null);
    showToast('تم حذف العنصر المحدد', 'info');
  }, [activeFarmer, commitChange, focusedFarmId, selection, showToast]);

  const isDeviceIdDuplicate = useCallback(
    (deviceId: string, excludeSensorId?: string): boolean => {
      const normalized = deviceId.trim().toUpperCase();
      if (!normalized) return false;
      for (const farmer of draftWorkspace.farmers) {
        for (const farm of farmer.farms) {
          for (const field of farm.fields) {
            for (const sensor of field.sensors) {
              if (sensor.id !== excludeSensorId && sensor.deviceId.toUpperCase() === normalized) {
                return true;
              }
            }
          }
        }
      }
      return false;
    },
    [draftWorkspace]
  );

  const enterFullscreen = useCallback(
    (canvasOnly = false) => {
      setShellSection('editor');
      setIsFullscreen(true);
      setHideEditorPanels(canvasOnly);
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement
            .requestFullscreen()
            .then(() => {
              wasNativeFullscreenRef.current = true;
            })
            .catch(() => {
              // Sandboxed iframe fallback: viewport fixed inset-0 fullscreen still active
            });
        }
      } catch {
        // Ignore browser restriction cleanly
      }
      showToast(
        canvasOnly
          ? 'تم تفعيل وضع التخطيط الكامل على ملء الشاشة (Esc للخروج)'
          : 'تم تفعيل وضع ملء الشاشة للمحرّر (Esc للخروج)',
        'info'
      );
    },
    [showToast]
  );

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
    setHideEditorPanels(false);
    wasNativeFullscreenRef.current = false;
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Ignore
    }
  }, []);

  const toggleFullscreen = useCallback(
    (canvasOnly = false) => {
      if (isFullscreen) {
        exitFullscreen();
      } else {
        enterFullscreen(canvasOnly);
      }
    },
    [enterFullscreen, exitFullscreen, isFullscreen]
  );

  useEffect(() => {
    const onFsChange = () => {
      if (document.fullscreenElement) {
        wasNativeFullscreenRef.current = true;
      } else if (wasNativeFullscreenRef.current) {
        wasNativeFullscreenRef.current = false;
        setIsFullscreen(false);
        setHideEditorPanels(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (isTyping || isFarmerPreview) return;
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        if (isTyping || isFarmerPreview) return;
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === 'Escape') {
        if (popupSensorId) {
          closeSensorPopup();
          return;
        }
        if (activeTool !== 'select' || selectedVertexIndex !== null) {
          setActiveToolState('select');
          setSelectedVertexIndex(null);
          return;
        }
        if (isFullscreen) {
          exitFullscreen();
          return;
        }
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping && !isFarmerPreview) {
        if (selectedVertexIndex !== null && selection && selection.kind !== 'sensor') {
          e.preventDefault();
          removeBoundaryVertex(selection, selectedVertexIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTool,
    closeSensorPopup,
    exitFullscreen,
    isFarmerPreview,
    isFullscreen,
    popupSensorId,
    redo,
    removeBoundaryVertex,
    selectedVertexIndex,
    selection,
    undo,
  ]);

  return {
    savedWorkspace,
    draftWorkspace,
    activeWorkspace,
    shellSection,
    setShellSection,
    isFarmerPreview,
    setIsFarmerPreview,
    isFullscreen,
    hideEditorPanels,
    setHideEditorPanels,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    activeFarmer,
    activeFarm,
    activeField,
    activeFarmerId,
    selectFarmer,
    addFarmer,
    updateFarmerProfile,
    deleteFarmer,
    setCanvasBackground,
    activeTool,
    setActiveTool,
    drawTargetKind,
    setDrawTargetKind,
    selection,
    setSelection,
    focusedFarmId,
    setFocusedFarmId,
    focusSingleFarm,
    stepFocusedFarm,
    selectedVertexIndex,
    setSelectedVertexIndex,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    hasUnsavedChanges,
    undo,
    redo,
    saveChanges,
    resetToDefault,
    draftRef,
    pushCheckpoint,
    finalizeBoundaryMove,
    finalizeBoundaryVertexEdit,
    createFarm,
    createField,
    createZone,
    resizeEntityScale,
    expandPlanCanvas,
    autoArrangeLayout,
    placeSensorAtPoint,
    moveSensorPosition,
    translateBoundary,
    updateBoundaryVertex,
    insertBoundaryVertex,
    removeBoundaryVertex,
    updateFarmProps,
    updateFieldProps,
    updateZoneProps,
    updateSensorProps,
    recordTestReading,
    regenerateWeeklyHistory,
    updateSensorReadingValue,
    sensorValueFocusToken,
    requestSensorValuesFocus,
    fitViewToken,
    requestFitView,
    popupSensorId,
    popupView,
    setPopupView,
    openSensorPopup,
    closeSensorPopup,
    detailsSensorId,
    setDetailsSensorId,
    openSensorDetails,
    deleteSelection,
    isDeviceIdDuplicate,
    toastMessage,
    showToast,
  };
}

export type GharsStore = ReturnType<typeof useGharsStore>;
