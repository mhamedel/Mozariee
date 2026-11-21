import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Cpu,
  Droplets,
  Expand,
  FlaskConical,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Thermometer,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  HIERARCHY_COLORS,
  MEASUREMENT_META,
  SENSOR_META,
  formatReadingTimeArabic,
} from '../data/seedData';
import type { GharsStore } from '../store/useGharsStore';
import type {
  ActiveDragPayload,
  DrawTargetKind,
  Point,
  SensorDevice,
  SensorType,
  WorkspaceState,
} from '../types/ghars';
import { MIN_FARM_HEIGHT, MIN_FARM_WIDTH } from '../utils/autoLayout';
import {
  createRectPolygon,
  distanceBetweenPoints,
  getBoundingBox,
  getMidpoints,
  getPlanHeight,
  getPlanWidth,
  isPointInPolygon,
} from '../utils/geometry';
import { SensorPreviewCard } from './SensorPreviewCard';

type SchematicCanvasProps = {
  store: GharsStore;
  activeDrag: ActiveDragPayload | null;
  onRegisterDropHandler: (
    handler: ((payload: ActiveDragPayload, clientX: number, clientY: number) => boolean) | null
  ) => void;
};

type DragInteraction =
  | { kind: 'pan'; startClientX: number; startClientY: number; startPanX: number; startPanY: number }
  | {
      kind: 'move-polygon';
      targetKind: 'farm' | 'field' | 'zone';
      farmId: string;
      fieldId?: string;
      zoneId?: string;
      startClientX: number;
      startClientY: number;
      didMove: boolean;
      lastPlanPoint: Point;
      beforeSnapshot: WorkspaceState;
    }
  | {
      kind: 'move-vertex';
      targetKind: 'farm' | 'field' | 'zone';
      farmId: string;
      fieldId?: string;
      zoneId?: string;
      vertexIndex: number;
      beforeSnapshot: WorkspaceState;
    }
  | {
      kind: 'move-sensor';
      farmId: string;
      fieldId: string;
      sensorId: string;
      startClientX: number;
      startClientY: number;
      didMove: boolean;
      beforeSnapshot: WorkspaceState;
    };

function SensorGlyph({ type, size = 14 }: { type: SensorType; size?: number }) {
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

function getTopBorderAnchor(points: Point[]): { x: number; y: number; alignRight: boolean } {
  if (points.length === 0) return { x: 0, y: 0, alignRight: true };
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const tol = Math.min(8, Math.max(1, (maxY - minY) * 0.1));
  const topPts = points.filter((p) => p.y <= minY + tol);
  const topRightX = Math.max(...topPts.map((p) => p.x));
  const topLeftX = Math.min(...topPts.map((p) => p.x));
  const topSpan = topRightX - topLeftX;
  if (topSpan >= 40) {
    return { x: topRightX - Math.min(8, topSpan * 0.06), y: minY, alignRight: true };
  }
  return { x: (topRightX + topLeftX) / 2, y: minY, alignRight: false };
}

export function SchematicCanvas({
  store,
  activeDrag,
  onRegisterDropHandler,
}: SchematicCanvasProps) {
  const {
    activeFarmer,
    activeTool,
    setActiveTool,
    drawTargetKind,
    setDrawTargetKind,
    selection,
    setSelection,
    focusedFarmId,
    focusSingleFarm,
    stepFocusedFarm,
    selectedVertexIndex,
    setSelectedVertexIndex,
    isFarmerPreview,
    isFullscreen,
    hideEditorPanels,
    enterFullscreen,
    exitFullscreen,
    createFarm,
    createField,
    createZone,
    placeSensorAtPoint,
    moveSensorPosition,
    translateBoundary,
    updateBoundaryVertex,
    insertBoundaryVertex,
    removeBoundaryVertex,
    pushCheckpoint,
    finalizeBoundaryMove,
    finalizeBoundaryVertexEdit,
    draftRef,
    popupSensorId,
    openSensorPopup,
    closeSensorPopup,
    openSensorDetails,
    fitViewToken,
  } = store;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 960, height: 640 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);

  const [drawPoints, setDrawPoints] = useState<Point[]>([]);
  const [drawHoverPoint, setDrawHoverPoint] = useState<Point | null>(null);
  const [interaction, setInteraction] = useState<DragInteraction | null>(null);
  const [highlightedFarmId, setHighlightedFarmId] = useState<string | null>(null);
  const [highlightedFieldId, setHighlightedFieldId] = useState<string | null>(null);
  const [highlightedZoneId, setHighlightedZoneId] = useState<string | null>(null);
  const [hoveredSensorId, setHoveredSensorId] = useState<string | null>(null);

  const planWidth = useMemo(() => getPlanWidth(activeFarmer?.planWidth), [activeFarmer]);

  const planHeight = useMemo(() => {
    if (!activeFarmer) return getPlanHeight('blank');
    return getPlanHeight(
      activeFarmer.backgroundMode,
      activeFarmer.imageAspectRatio,
      planWidth,
      activeFarmer.planHeight
    );
  }, [activeFarmer, planWidth]);

  const focusedFarm = useMemo(
    () =>
      focusedFarmId ? activeFarmer?.farms.find((fm) => fm.id === focusedFarmId) ?? null : null,
    [activeFarmer, focusedFarmId]
  );

  const visibleFarms = useMemo(
    () => (focusedFarm ? [focusedFarm] : activeFarmer?.farms ?? []),
    [activeFarmer, focusedFarm]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 50 && height > 50) {
        setSize({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDrawPoints([]);
    setDrawHoverPoint(null);
    closeSensorPopup();
  }, [activeFarmer?.id, closeSensorPopup, isFarmerPreview]);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [isFullscreen, hideEditorPanels]);

  useEffect(() => {
    if (fitViewToken === 0) return;
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [fitViewToken]);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [focusedFarmId]);

  useEffect(() => {
    if (activeTool !== 'draw') {
      setDrawPoints([]);
      setDrawHoverPoint(null);
    }
  }, [activeTool]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
        setSpacePressed(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const viewRegion = useMemo(() => {
    if (focusedFarm) {
      const fb = getBoundingBox(focusedFarm.overviewPoints);
      const padX = 48;
      const padTop = 82;
      const padBottom = 48;
      const w = Math.max(MIN_FARM_WIDTH, fb.width) + padX * 2;
      const h = Math.max(MIN_FARM_HEIGHT, fb.height) + padTop + padBottom;
      return {
        minX: fb.minX - padX,
        minY: fb.minY - padTop,
        width: w,
        height: h,
      };
    }
    return { minX: 0, minY: 0, width: planWidth, height: planHeight };
  }, [focusedFarm, planHeight, planWidth]);

  const baseScale = useMemo(() => {
    const pad = 40;
    return Math.min((size.width - pad) / viewRegion.width, (size.height - pad) / viewRegion.height);
  }, [size.width, size.height, viewRegion.width, viewRegion.height]);

  const baseOffsetX = useMemo(
    () => (size.width - viewRegion.width * baseScale) / 2 - viewRegion.minX * baseScale,
    [size.width, viewRegion.width, viewRegion.minX, baseScale]
  );
  const baseOffsetY = useMemo(
    () => (size.height - viewRegion.height * baseScale) / 2 - viewRegion.minY * baseScale,
    [size.height, viewRegion.height, viewRegion.minY, baseScale]
  );

  const totalScale = baseScale * zoom;
  const tx = baseOffsetX + pan.x;
  const ty = baseOffsetY + pan.y;

  const exactScreenToPlan = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: planWidth / 2, y: planHeight / 2 };
      return {
        x: (clientX - rect.left - tx) / totalScale,
        y: (clientY - rect.top - ty) / totalScale,
      };
    },
    [planWidth, planHeight, totalScale, tx, ty]
  );

  // Highlight receiving Farm / Field / Zone while dragging from Toolbox
  useEffect(() => {
    if (!activeDrag || !activeFarmer) {
      setHighlightedFarmId(null);
      setHighlightedFieldId(null);
      setHighlightedZoneId(null);
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (
      !rect ||
      activeDrag.clientX < rect.left ||
      activeDrag.clientX > rect.right ||
      activeDrag.clientY < rect.top ||
      activeDrag.clientY > rect.bottom
    ) {
      setHighlightedFarmId(null);
      setHighlightedFieldId(null);
      setHighlightedZoneId(null);
      return;
    }

    const pt = exactScreenToPlan(activeDrag.clientX, activeDrag.clientY);

    if (activeDrag.itemType === 'field') {
      const targetFarm = activeFarmer.farms.find((fm) => isPointInPolygon(pt, fm.overviewPoints));
      setHighlightedFarmId(targetFarm?.id ?? null);
      setHighlightedFieldId(null);
      setHighlightedZoneId(null);
    } else if (activeDrag.itemType === 'zone') {
      let matchedFieldId: string | null = null;
      for (const fm of activeFarmer.farms) {
        const fl = fm.fields.find((x) => isPointInPolygon(pt, x.overviewPoints));
        if (fl) {
          matchedFieldId = fl.id;
          break;
        }
      }
      setHighlightedFarmId(null);
      setHighlightedFieldId(matchedFieldId);
      setHighlightedZoneId(null);
    } else if (activeDrag.itemType !== 'farm') {
      // Sensor drag: highlight receiving Zone (or Field if outside zones)
      let zId: string | null = null;
      let fId: string | null = null;
      for (const fm of activeFarmer.farms) {
        for (const fl of fm.fields) {
          const z = fl.zones.find((x) => isPointInPolygon(pt, x.schematicPoints));
          if (z) {
            zId = z.id;
            break;
          }
          if (!fId && isPointInPolygon(pt, fl.overviewPoints)) {
            fId = fl.id;
          }
        }
        if (zId) break;
      }
      setHighlightedFarmId(null);
      setHighlightedZoneId(zId);
      setHighlightedFieldId(zId ? null : fId);
    } else {
      setHighlightedFarmId(null);
      setHighlightedFieldId(null);
      setHighlightedZoneId(null);
    }
  }, [activeDrag, activeFarmer, exactScreenToPlan]);

  // Register unified drop handler for all 8 Toolbox items
  useEffect(() => {
    const handleDrop = (payload: ActiveDragPayload, clientX: number, clientY: number): boolean => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return false;
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return false;
      }

      const pt = exactScreenToPlan(clientX, clientY);
      const roundedPt = { x: Math.round(pt.x), y: Math.round(pt.y) };

      if (payload.itemType === 'farm') {
        createFarm({ schematicPoints: createRectPolygon(roundedPt.x, roundedPt.y, 230, 175) });
        return true;
      }
      if (payload.itemType === 'field') {
        createField({ schematicPoints: createRectPolygon(roundedPt.x, roundedPt.y, 140, 110) });
        return true;
      }
      if (payload.itemType === 'zone') {
        createZone({ schematicPoints: createRectPolygon(roundedPt.x, roundedPt.y, 80, 68) });
        return true;
      }

      placeSensorAtPoint(payload.itemType, { schematicPos: roundedPt });
      return true;
    };

    onRegisterDropHandler(handleDrop);
    return () => onRegisterDropHandler(null);
  }, [createFarm, createField, createZone, exactScreenToPlan, onRegisterDropHandler, placeSensorAtPoint]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const nextZoom = Math.max(0.35, Math.min(4.5, zoom * factor));
    const nextTotalScale = baseScale * nextZoom;

    const planX = (localX - tx) / totalScale;
    const planY = (localY - ty) / totalScale;

    const nextTx = localX - planX * nextTotalScale;
    const nextTy = localY - planY * nextTotalScale;

    setZoom(nextZoom);
    setPan({ x: nextTx - baseOffsetX, y: nextTy - baseOffsetY });
  };

  useEffect(() => {
    if (!interaction) return;

    const onMove = (e: PointerEvent) => {
      if (interaction.kind === 'pan') {
        setPan({
          x: interaction.startPanX + (e.clientX - interaction.startClientX),
          y: interaction.startPanY + (e.clientY - interaction.startClientY),
        });
        return;
      }

      const pt = exactScreenToPlan(e.clientX, e.clientY);

      if (interaction.kind === 'move-polygon') {
        const distPx = Math.hypot(
          e.clientX - interaction.startClientX,
          e.clientY - interaction.startClientY
        );
        if (!interaction.didMove && distPx < 4) {
          return;
        }
        interaction.didMove = true;
        const dx = pt.x - interaction.lastPlanPoint.x;
        const dy = pt.y - interaction.lastPlanPoint.y;
        interaction.lastPlanPoint = pt;

        if (interaction.targetKind === 'farm') {
          translateBoundary({ kind: 'farm', farmId: interaction.farmId, dx, dy }, false);
        } else if (interaction.targetKind === 'field' && interaction.fieldId) {
          translateBoundary(
            { kind: 'field', farmId: interaction.farmId, fieldId: interaction.fieldId, dx, dy },
            false
          );
        } else if (interaction.targetKind === 'zone' && interaction.fieldId && interaction.zoneId) {
          translateBoundary(
            {
              kind: 'zone',
              farmId: interaction.farmId,
              fieldId: interaction.fieldId,
              zoneId: interaction.zoneId,
              dx,
              dy,
            },
            false
          );
        }
        return;
      }

      if (interaction.kind === 'move-vertex') {
        const rounded = { x: Math.round(pt.x), y: Math.round(pt.y) };
        if (interaction.targetKind === 'farm') {
          updateBoundaryVertex(
            {
              kind: 'farm',
              farmId: interaction.farmId,
              index: interaction.vertexIndex,
              point: rounded,
            },
            false
          );
        } else if (interaction.targetKind === 'field' && interaction.fieldId) {
          updateBoundaryVertex(
            {
              kind: 'field',
              farmId: interaction.farmId,
              fieldId: interaction.fieldId,
              index: interaction.vertexIndex,
              point: rounded,
            },
            false
          );
        } else if (interaction.targetKind === 'zone' && interaction.fieldId && interaction.zoneId) {
          updateBoundaryVertex(
            {
              kind: 'zone',
              farmId: interaction.farmId,
              fieldId: interaction.fieldId,
              zoneId: interaction.zoneId,
              index: interaction.vertexIndex,
              point: rounded,
            },
            false
          );
        }
        return;
      }

      if (interaction.kind === 'move-sensor') {
        const distPx = Math.hypot(
          e.clientX - interaction.startClientX,
          e.clientY - interaction.startClientY
        );
        if (!interaction.didMove && distPx < 4) {
          return;
        }
        interaction.didMove = true;
        const rounded = { x: Math.round(pt.x), y: Math.round(pt.y) };
        moveSensorPosition(
          interaction.farmId,
          interaction.fieldId,
          interaction.sensorId,
          { schematicPos: rounded },
          false
        );
        if (activeFarmer) {
          let matchedZoneId: string | null = null;
          for (const fm of activeFarmer.farms) {
            for (const fl of fm.fields) {
              const z = fl.zones.find((x) => isPointInPolygon(rounded, x.schematicPoints));
              if (z) {
                matchedZoneId = z.id;
                break;
              }
            }
            if (matchedZoneId) break;
          }
          setHighlightedZoneId(matchedZoneId);
        }
      }
    };

    const onUp = () => {
      if (interaction.kind === 'move-polygon') {
        if (interaction.didMove) {
          if (interaction.targetKind === 'farm') {
            finalizeBoundaryMove(
              { kind: 'farm', farmId: interaction.farmId },
              interaction.beforeSnapshot
            );
          } else if (interaction.targetKind === 'field' && interaction.fieldId) {
            finalizeBoundaryMove(
              { kind: 'field', farmId: interaction.farmId, fieldId: interaction.fieldId },
              interaction.beforeSnapshot
            );
          } else if (
            interaction.targetKind === 'zone' &&
            interaction.fieldId &&
            interaction.zoneId
          ) {
            finalizeBoundaryMove(
              {
                kind: 'zone',
                farmId: interaction.farmId,
                fieldId: interaction.fieldId,
                zoneId: interaction.zoneId,
              },
              interaction.beforeSnapshot
            );
          }
        } else if (interaction.targetKind === 'farm') {
          focusSingleFarm(interaction.farmId);
        }
      } else if (interaction.kind === 'move-vertex') {
        finalizeBoundaryVertexEdit(interaction.beforeSnapshot);
      } else if (interaction.kind === 'move-sensor') {
        if (interaction.didMove) {
          pushCheckpoint(interaction.beforeSnapshot);
        } else {
          openSensorPopup(interaction.sensorId, 'chart');
        }
      }
      setHighlightedZoneId(null);
      setInteraction(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [
    activeFarmer,
    exactScreenToPlan,
    finalizeBoundaryMove,
    finalizeBoundaryVertexEdit,
    focusSingleFarm,
    interaction,
    moveSensorPosition,
    openSensorPopup,
    pushCheckpoint,
    translateBoundary,
    updateBoundaryVertex,
  ]);

  const snapRadiusInPlan = 14 / totalScale;

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || spacePressed || activeTool === 'pan') {
      e.preventDefault();
      setInteraction({
        kind: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      });
      return;
    }

    if (e.button !== 0) return;

    if (activeTool === 'draw' && !isFarmerPreview) {
      const pt = exactScreenToPlan(e.clientX, e.clientY);
      const rounded = { x: Math.round(pt.x), y: Math.round(pt.y) };

      if (drawPoints.length >= 3 && distanceBetweenPoints(pt, drawPoints[0]) <= snapRadiusInPlan) {
        if (drawTargetKind === 'farm') {
          createFarm({ schematicPoints: drawPoints, autoFitSpace: false });
        } else if (drawTargetKind === 'field') {
          createField({ schematicPoints: drawPoints, autoFitSpace: false });
        } else {
          createZone({ schematicPoints: drawPoints, autoFitSpace: false });
        }
        setDrawPoints([]);
        setDrawHoverPoint(null);
        return;
      }

      setDrawPoints((prev) => [...prev, rounded]);
      return;
    }

    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasBg === 'true') {
      setSelection(null);
      setSelectedVertexIndex(null);
      closeSensorPopup();
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (activeTool === 'draw' && drawPoints.length > 0) {
      setDrawHoverPoint(exactScreenToPlan(e.clientX, e.clientY));
    }
  };

  const popupContext = useMemo(() => {
    if (!activeFarmer || !popupSensorId) return null;
    for (const farm of activeFarmer.farms) {
      for (const field of farm.fields) {
        const sensor = field.sensors.find((s) => s.id === popupSensorId);
        if (sensor) {
          const zone = sensor.zoneId
            ? field.zones.find((z) => z.id === sensor.zoneId) ?? null
            : null;
          return { farm, field, zone, sensor };
        }
      }
    }
    return null;
  }, [activeFarmer, popupSensorId]);

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleZoomButton = (factor: number) => {
    const nextZoom = Math.max(0.35, Math.min(4.5, zoom * factor));
    const centerX = size.width / 2;
    const centerY = size.height / 2;
    const planX = (centerX - tx) / totalScale;
    const planY = (centerY - ty) / totalScale;
    const nextScale = baseScale * nextZoom;
    setZoom(nextZoom);
    setPan({
      x: centerX - planX * nextScale - baseOffsetX,
      y: centerY - planY * nextScale - baseOffsetY,
    });
  };

  const renderPolygonHandles = (
    points: Point[],
    targetKind: 'farm' | 'field' | 'zone',
    farmId: string,
    fieldId?: string,
    zoneId?: string
  ) => {
    if (isFarmerPreview || activeTool !== 'select') return null;
    const handleSize = 10 / totalScale;
    const midpoints = getMidpoints(points);
    const accentHex = HIERARCHY_COLORS[targetKind].stroke;

    return (
      <g>
        {midpoints.map((mp, idx) => (
          <g
            key={`mid-${idx}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              insertBoundaryVertex(
                targetKind === 'farm'
                  ? { kind: 'farm', farmId }
                  : targetKind === 'field' && fieldId
                  ? { kind: 'field', farmId, fieldId }
                  : { kind: 'zone', farmId, fieldId: fieldId!, zoneId: zoneId! },
                idx,
                { schematic: { x: Math.round(mp.x), y: Math.round(mp.y) } }
              );
            }}
            className="cursor-copy"
          >
            <circle
              cx={mp.x}
              cy={mp.y}
              r={handleSize * 0.55}
              fill="#FFFFFF"
              stroke={accentHex}
              strokeWidth={1.5 / totalScale}
            />
            <line
              x1={mp.x - handleSize * 0.25}
              y1={mp.y}
              x2={mp.x + handleSize * 0.25}
              y2={mp.y}
              stroke={accentHex}
              strokeWidth={1.3 / totalScale}
            />
            <line
              x1={mp.x}
              y1={mp.y - handleSize * 0.25}
              x2={mp.x}
              y2={mp.y + handleSize * 0.25}
              stroke={accentHex}
              strokeWidth={1.3 / totalScale}
            />
          </g>
        ))}

        {points.map((pt, idx) => {
          const isVertexSelected = selectedVertexIndex === idx;
          return (
            <rect
              key={`v-${idx}`}
              x={pt.x - handleSize / 2}
              y={pt.y - handleSize / 2}
              width={handleSize}
              height={handleSize}
              rx={2 / totalScale}
              fill={isVertexSelected ? accentHex : '#FFFFFF'}
              stroke="#0F1F18"
              strokeWidth={1.8 / totalScale}
              className="cursor-nwse-resize"
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                removeBoundaryVertex(
                  targetKind === 'farm'
                    ? { kind: 'farm', farmId }
                    : targetKind === 'field' && fieldId
                    ? { kind: 'field', farmId, fieldId }
                    : { kind: 'zone', farmId, fieldId: fieldId!, zoneId: zoneId! },
                  idx
                );
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                setSelectedVertexIndex(idx);
                setInteraction({
                  kind: 'move-vertex',
                  targetKind,
                  farmId,
                  fieldId,
                  zoneId,
                  vertexIndex: idx,
                  beforeSnapshot: JSON.parse(JSON.stringify(draftRef.current)) as WorkspaceState,
                });
              }}
            />
          );
        })}
      </g>
    );
  };

  const activeSelectedSensorId =
    selection?.kind === 'sensor' ? selection.sensorId : popupSensorId;

  const assignedTarget = useMemo(() => {
    if (!activeFarmer || !activeSelectedSensorId) {
      return { fieldId: null as string | null, zoneId: null as string | null };
    }
    for (const fm of activeFarmer.farms) {
      for (const fl of fm.fields) {
        const s = fl.sensors.find((x) => x.id === activeSelectedSensorId);
        if (s) {
          return { fieldId: fl.id, zoneId: s.zoneId ?? null };
        }
      }
    }
    return { fieldId: null, zoneId: null };
  }, [activeFarmer, activeSelectedSensorId]);

  const boundaryTitles = useMemo(() => {
    if (!activeFarmer) return [];
    const items: {
      key: string;
      kind: 'farm' | 'field' | 'zone';
      farmId: string;
      text: string;
      bgColor: string;
      borderColor: string;
      isSelected: boolean;
      anchor: { x: number; y: number; alignRight: boolean };
      zIndex: number;
    }[] = [];

    visibleFarms.forEach((farm) => {
      const isFarmSel = selection?.kind === 'farm' && selection.farmId === farm.id;
      items.push({
        key: `title-farm-${farm.id}`,
        kind: 'farm',
        farmId: farm.id,
        text: `${HIERARCHY_COLORS.farm.label}: ${farm.name}`,
        bgColor: isFarmSel ? '#B45309' : HIERARCHY_COLORS.farm.stroke,
        borderColor: isFarmSel ? '#F59E0B' : HIERARCHY_COLORS.farm.stroke,
        isSelected: isFarmSel,
        anchor: getTopBorderAnchor(farm.overviewPoints),
        zIndex: isFarmSel ? 18 : 11,
      });

      farm.fields.forEach((field) => {
        const isFieldSel =
          (selection?.kind === 'field' && selection.fieldId === field.id) ||
          assignedTarget.fieldId === field.id;
        items.push({
          key: `title-field-${field.id}`,
          kind: 'field',
          farmId: farm.id,
          text: `${HIERARCHY_COLORS.field.label}: ${field.name}`,
          bgColor: isFieldSel ? '#047857' : HIERARCHY_COLORS.field.stroke,
          borderColor: isFieldSel ? '#10B981' : HIERARCHY_COLORS.field.stroke,
          isSelected: isFieldSel,
          anchor: getTopBorderAnchor(field.overviewPoints),
          zIndex: isFieldSel ? 19 : 12,
        });

        field.zones.forEach((zone) => {
          const isZoneSel =
            (selection?.kind === 'zone' && selection.zoneId === zone.id) ||
            assignedTarget.zoneId === zone.id;
          items.push({
            key: `title-zone-${zone.id}`,
            kind: 'zone',
            farmId: farm.id,
            text: zone.name,
            bgColor: isZoneSel ? '#0F1F18' : zone.color,
            borderColor: isZoneSel ? '#F59E0B' : zone.color,
            isSelected: isZoneSel,
            anchor: getTopBorderAnchor(zone.schematicPoints),
            zIndex: isZoneSel ? 20 : 13,
          });
        });
      });
    });

    return items;
  }, [activeFarmer, assignedTarget.fieldId, assignedTarget.zoneId, selection, visibleFarms]);

  const allSensors: { farmId: string; fieldId: string; sensor: SensorDevice }[] = useMemo(() => {
    if (!activeFarmer) return [];
    const list: { farmId: string; fieldId: string; sensor: SensorDevice }[] = [];
    visibleFarms.forEach((fm) =>
      fm.fields.forEach((fl) =>
        fl.sensors.forEach((s) => list.push({ farmId: fm.id, fieldId: fl.id, sensor: s }))
      )
    );
    return list;
  }, [activeFarmer, visibleFarms]);

  const cursorClass =
    interaction?.kind === 'pan'
      ? 'cursor-grabbing'
      : activeTool === 'pan' || spacePressed
      ? 'cursor-grab'
      : activeTool === 'draw' && !isFarmerPreview
      ? 'cursor-crosshair'
      : 'cursor-default';

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      data-canvas-bg="true"
      className={`relative flex-1 overflow-hidden bg-[#F1F4F1] select-none ${cursorClass}`}
    >
      {/* Transformed Virtual Plan Stage */}
      <div
        data-canvas-bg="true"
        style={{
          width: planWidth,
          height: planHeight,
          transform: `translate(${tx}px, ${ty}px) scale(${totalScale})`,
          transformOrigin: '0 0',
        }}
        className="absolute top-0 left-0 bg-white border border-[#DCE3DD] shadow-sm"
      >
        {/* Background Layer: Grid or Uploaded Field Image */}
        {activeFarmer?.backgroundMode === 'image' && activeFarmer.backgroundImageUrl ? (
          <img
            src={activeFarmer.backgroundImageUrl}
            alt={activeFarmer.name}
            draggable={false}
            data-canvas-bg="true"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
        ) : (
          <svg
            width={planWidth}
            height={planHeight}
            className="absolute inset-0 pointer-events-none"
          >
            <defs>
              <pattern id="ghars-grid-sm" width="25" height="25" patternUnits="userSpaceOnUse">
                <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#F1F5F2" strokeWidth="1" />
              </pattern>
              <pattern id="ghars-grid-lg" width="100" height="100" patternUnits="userSpaceOnUse">
                <rect width="100" height="100" fill="url(#ghars-grid-sm)" />
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#E2E8E4" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={planWidth} height={planHeight} fill="url(#ghars-grid-lg)" />
          </svg>
        )}

        {/* Unified Vector Shapes Layer: Farms -> Fields -> Zones */}
        <svg
          width={planWidth}
          height={planHeight}
          viewBox={`0 0 ${planWidth} ${planHeight}`}
          className="absolute inset-0 overflow-visible"
          data-canvas-bg="true"
        >
          {visibleFarms.map((farm) => {
            const isFarmSel = selection?.kind === 'farm' && selection.farmId === farm.id;
            const isFarmHighlight = highlightedFarmId === farm.id;
            const farmPtsStr = farm.overviewPoints.map((p) => `${p.x},${p.y}`).join(' ');

            return (
              <g key={farm.id}>
                {(isFarmSel || isFarmHighlight) && (
                  <polygon
                    points={farmPtsStr}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth={8 / totalScale}
                    strokeOpacity={0.35}
                    strokeLinejoin="round"
                    className="pointer-events-none"
                  />
                )}
                <polygon
                  points={farmPtsStr}
                  fill={
                    isFarmHighlight || isFarmSel
                      ? 'rgba(217, 119, 6, 0.14)'
                      : HIERARCHY_COLORS.farm.fill
                  }
                  stroke={isFarmSel || isFarmHighlight ? '#B45309' : HIERARCHY_COLORS.farm.stroke}
                  strokeWidth={(isFarmSel || isFarmHighlight ? 3 : 1.9) / totalScale}
                  strokeDasharray={isFarmSel || isFarmHighlight ? undefined : `${7 / totalScale} ${4 / totalScale}`}
                  className={!isFarmerPreview && activeTool === 'select' ? 'cursor-move' : 'cursor-pointer'}
                  onPointerDown={(e) => {
                    if (activeTool !== 'select' || e.button !== 0) return;
                    e.stopPropagation();
                    setSelection({ kind: 'farm', farmId: farm.id });
                    setSelectedVertexIndex(null);
                    closeSensorPopup();
                    if (isFarmerPreview) {
                      focusSingleFarm(farm.id);
                      return;
                    }
                    setInteraction({
                      kind: 'move-polygon',
                      targetKind: 'farm',
                      farmId: farm.id,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      didMove: false,
                      lastPlanPoint: exactScreenToPlan(e.clientX, e.clientY),
                      beforeSnapshot: JSON.parse(JSON.stringify(draftRef.current)) as WorkspaceState,
                    });
                  }}
                />

                {/* Fields inside Farm */}
                {farm.fields.map((field) => {
                  const isFieldSel =
                    selection?.kind === 'field' && selection.fieldId === field.id;
                  const isAssignedField = assignedTarget.fieldId === field.id;
                  const isFieldHighlight = highlightedFieldId === field.id;
                  const fieldPtsStr = field.overviewPoints.map((p) => `${p.x},${p.y}`).join(' ');

                  return (
                    <g key={field.id}>
                      {(isFieldSel || isFieldHighlight || isAssignedField) && (
                        <polygon
                          points={fieldPtsStr}
                          fill="none"
                          stroke="#10B981"
                          strokeWidth={(isFieldSel || isFieldHighlight ? 8 : 5.5) / totalScale}
                          strokeOpacity={isFieldSel || isFieldHighlight ? 0.45 : 0.35}
                          strokeLinejoin="round"
                          className="pointer-events-none"
                        />
                      )}
                      <polygon
                        points={fieldPtsStr}
                        fill={
                          isFieldHighlight || isFieldSel
                            ? 'rgba(16, 185, 129, 0.22)'
                            : isAssignedField
                            ? 'rgba(16, 185, 129, 0.14)'
                            : HIERARCHY_COLORS.field.fill
                        }
                        stroke={
                          isFieldSel || isFieldHighlight
                            ? '#047857'
                            : isAssignedField
                            ? '#10B981'
                            : HIERARCHY_COLORS.field.stroke
                        }
                        strokeWidth={
                          (isFieldSel || isFieldHighlight ? 3 : isAssignedField ? 2.4 : 1.75) /
                          totalScale
                        }
                        className={
                          !isFarmerPreview && activeTool === 'select'
                            ? 'cursor-move'
                            : 'cursor-pointer'
                        }
                        onPointerDown={(e) => {
                          if (activeTool !== 'select' || e.button !== 0) return;
                          e.stopPropagation();
                          setSelection({ kind: 'field', farmId: farm.id, fieldId: field.id });
                          setSelectedVertexIndex(null);
                          closeSensorPopup();
                          if (!isFarmerPreview) {
                            setInteraction({
                              kind: 'move-polygon',
                              targetKind: 'field',
                              farmId: farm.id,
                              fieldId: field.id,
                              startClientX: e.clientX,
                              startClientY: e.clientY,
                              didMove: false,
                              lastPlanPoint: exactScreenToPlan(e.clientX, e.clientY),
                              beforeSnapshot: JSON.parse(
                                JSON.stringify(draftRef.current)
                              ) as WorkspaceState,
                            });
                          }
                        }}
                      />

                      {/* Zones inside Field */}
                      {field.zones.map((zone) => {
                        const isZoneSel =
                          selection?.kind === 'zone' && selection.zoneId === zone.id;
                        const isAssignedZone = assignedTarget.zoneId === zone.id;
                        const isZoneHighlight = highlightedZoneId === zone.id;
                        const zPtsStr = zone.schematicPoints.map((p) => `${p.x},${p.y}`).join(' ');

                        return (
                          <g key={zone.id}>
                            {(isZoneSel || isZoneHighlight || isAssignedZone) && (
                              <polygon
                                points={zPtsStr}
                                fill="none"
                                stroke={isZoneSel || isZoneHighlight ? '#F59E0B' : '#10B981'}
                                strokeWidth={
                                  (isZoneSel || isZoneHighlight ? 7.5 : 5.5) / totalScale
                                }
                                strokeOpacity={isZoneSel || isZoneHighlight ? 0.5 : 0.45}
                                strokeLinejoin="round"
                                className="pointer-events-none"
                              />
                            )}
                            <polygon
                              points={zPtsStr}
                              fill={zone.color}
                              fillOpacity={
                                isZoneHighlight
                                  ? 0.34
                                  : isZoneSel
                                  ? 0.3
                                  : isAssignedZone
                                  ? 0.24
                                  : 0.13
                              }
                              stroke={
                                isZoneHighlight || isZoneSel
                                  ? '#0F1F18'
                                  : isAssignedZone
                                  ? '#047857'
                                  : zone.color
                              }
                              strokeWidth={
                                (isZoneHighlight || isZoneSel
                                  ? 2.8
                                  : isAssignedZone
                                  ? 2.2
                                  : 1.6) / totalScale
                              }
                              className={
                                !isFarmerPreview && activeTool === 'select'
                                  ? 'cursor-move'
                                  : 'cursor-pointer'
                              }
                              onPointerDown={(e) => {
                                if (activeTool !== 'select' || e.button !== 0) return;
                                e.stopPropagation();
                                setSelection({
                                  kind: 'zone',
                                  farmId: farm.id,
                                  fieldId: field.id,
                                  zoneId: zone.id,
                                });
                                setSelectedVertexIndex(null);
                                closeSensorPopup();
                                if (!isFarmerPreview) {
                                  setInteraction({
                                    kind: 'move-polygon',
                                    targetKind: 'zone',
                                    farmId: farm.id,
                                    fieldId: field.id,
                                    zoneId: zone.id,
                                    startClientX: e.clientX,
                                    startClientY: e.clientY,
                                    didMove: false,
                                    lastPlanPoint: exactScreenToPlan(e.clientX, e.clientY),
                                    beforeSnapshot: JSON.parse(
                                      JSON.stringify(draftRef.current)
                                    ) as WorkspaceState,
                                  });
                                }
                              }}
                            />

                            {isZoneSel &&
                              renderPolygonHandles(
                                zone.schematicPoints,
                                'zone',
                                farm.id,
                                field.id,
                                zone.id
                              )}
                          </g>
                        );
                      })}

                      {isFieldSel &&
                        renderPolygonHandles(
                          field.overviewPoints,
                          'field',
                          farm.id,
                          field.id
                        )}
                    </g>
                  );
                })}

                {isFarmSel && renderPolygonHandles(farm.overviewPoints, 'farm', farm.id)}
              </g>
            );
          })}

          {/* Active Polygon Drawing Preview */}
          {activeTool === 'draw' && drawPoints.length > 0 && (
            <g className="pointer-events-none">
              <polyline
                points={[...drawPoints, ...(drawHoverPoint ? [drawHoverPoint] : [])]
                  .map((p) => `${p.x},${p.y}`)
                  .join(' ')}
                fill={HIERARCHY_COLORS[drawTargetKind].fillActive}
                stroke={HIERARCHY_COLORS[drawTargetKind].stroke}
                strokeWidth={2 / totalScale}
                strokeDasharray={`${5 / totalScale} ${4 / totalScale}`}
              />
              {drawPoints.map((pt, i) => {
                const canClose =
                  i === 0 &&
                  drawPoints.length >= 3 &&
                  drawHoverPoint &&
                  distanceBetweenPoints(drawHoverPoint, drawPoints[0]) <= snapRadiusInPlan;
                return (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={(canClose ? 8 : 4.5) / totalScale}
                    fill={i === 0 ? HIERARCHY_COLORS[drawTargetKind].stroke : '#FFFFFF'}
                    stroke="#0F1F18"
                    strokeWidth={1.6 / totalScale}
                  />
                );
              })}
            </g>
          )}
        </svg>

        {/* Border-Attached Hierarchy Title Tabs (always above element, flush with top border) */}
        {boundaryTitles.map((item) => (
          <div
            key={item.key}
            style={{
              left: item.anchor.x,
              top: item.anchor.y,
              zIndex: item.zIndex,
              backgroundColor: item.bgColor,
              borderColor: item.borderColor,
              transform: item.anchor.alignRight
                ? `translate(-100%, -100%) scale(${1 / totalScale})`
                : `translate(-50%, -100%) scale(${1 / totalScale})`,
              transformOrigin: item.anchor.alignRight ? 'bottom right' : 'bottom center',
            }}
            onPointerDown={
              item.kind === 'farm'
                ? (e) => {
                    if (e.button !== 0 || activeTool !== 'select') return;
                    e.stopPropagation();
                    focusSingleFarm(item.farmId);
                  }
                : undefined
            }
            title={item.kind === 'farm' ? 'انقر لعرض تخطيط هذه المزرعة فقط' : undefined}
            className={`${
              item.kind === 'farm' ? 'pointer-events-auto cursor-pointer hover:brightness-110' : 'pointer-events-none'
            } absolute px-2 py-0.5 rounded-t-md border border-b-0 text-white text-[11px] font-bold leading-tight whitespace-nowrap max-w-[210px] truncate flex items-center gap-1 ${
              item.isSelected ? 'ring-2 ring-amber-300/90 shadow-md' : 'shadow-xs'
            }`}
          >
            {item.isSelected && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shrink-0" />
            )}
            <span className="truncate">{item.text}</span>
          </div>
        ))}

        {/* Sensor Pins Layer (Icon-only on map; hover shows name + latest reading; click opens values/chart popup) */}
        {allSensors.map(({ farmId, fieldId, sensor }) => {
          const meta = SENSOR_META[sensor.type];
          const isSelected =
            (selection?.kind === 'sensor' && selection.sensorId === sensor.id) ||
            popupSensorId === sensor.id;
          const isHovered = hoveredSensorId === sensor.id && !interaction && !activeDrag;
          const isConnected = Boolean(sensor.lastReadingAt);
          const pinColor = isSelected ? '#0F1F18' : meta.color;

          return (
            <div
              key={sensor.id}
              style={{
                left: sensor.schematicPos.x,
                top: sensor.schematicPos.y,
                zIndex: isHovered ? 50 : isSelected ? 30 : 20,
                transform: `translate(-50%, -100%) scale(${1 / totalScale})`,
                transformOrigin: 'bottom center',
              }}
              onPointerEnter={() => setHoveredSensorId(sensor.id)}
              onPointerLeave={() =>
                setHoveredSensorId((cur) => (cur === sensor.id ? null : cur))
              }
              onPointerDown={(e) => {
                if (e.button !== 0 || activeTool !== 'select') return;
                e.stopPropagation();
                if (isFarmerPreview) {
                  openSensorPopup(sensor.id, 'chart');
                  return;
                }
                setSelection({
                  kind: 'sensor',
                  farmId,
                  fieldId,
                  sensorId: sensor.id,
                });
                setSelectedVertexIndex(null);
                setInteraction({
                  kind: 'move-sensor',
                  farmId,
                  fieldId,
                  sensorId: sensor.id,
                  startClientX: e.clientX,
                  startClientY: e.clientY,
                  didMove: false,
                  beforeSnapshot: JSON.parse(JSON.stringify(draftRef.current)) as WorkspaceState,
                });
              }}
              className={`absolute flex flex-col items-center ${
                isFarmerPreview ? 'cursor-pointer' : 'cursor-pointer active:cursor-grabbing'
              }`}
            >
              {/* Hover Tooltip */}
              {isHovered && (
                <div
                  dir="rtl"
                  className="pointer-events-none absolute bottom-full mb-5 left-1/2 -translate-x-1/2 min-w-[185px] max-w-[240px] bg-[#0F1F18]/95 text-white rounded-lg px-2.5 py-2 shadow-xl border border-white/15 text-right space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1">
                    <span className="text-[11px] font-bold leading-tight truncate">
                      {sensor.name}
                    </span>
                    <span className="text-[10px] text-white/70 shrink-0">
                      {meta.shortLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isConnected ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                    />
                    <span className={isConnected ? 'text-emerald-300' : 'text-amber-300'}>
                      {isConnected ? 'متصل · يرسل البيانات للنظام' : 'في انتظار الاتصال والإرسال'}
                    </span>
                  </div>

                  {sensor.lastReadingAt && (
                    <div className="space-y-0.5">
                      {sensor.measurements.map((mKey) => {
                        const mMeta = MEASUREMENT_META[mKey];
                        const r = sensor.readings[mKey];
                        return (
                          <div
                            key={mKey}
                            className="flex items-center justify-between gap-2 text-[10px]"
                          >
                            <span className="text-white/75 truncate">{mMeta.label}</span>
                            <span className="font-mono-nums font-bold text-emerald-300 shrink-0">
                              {r ? `${r.value} ${r.unit}` : '—'}
                            </span>
                          </div>
                        );
                      })}
                      <div className="text-[9px] text-white/55 pt-0.5">
                        {formatReadingTimeArabic(sensor.lastReadingAt)}
                      </div>
                    </div>
                  )}

                  {!isFarmerPreview && (
                    <div className="text-[9px] text-emerald-300/90 border-t border-white/10 pt-1">
                      انقر لعرض القيم وتغيّر اليوم
                    </div>
                  )}
                </div>
              )}

              {/* Live Transmission Signal Waves Above Sensor Pin */}
              <div
                aria-hidden="true"
                className="pointer-events-none flex items-center justify-center h-3.5 mb-0.5"
              >
                {isConnected ? (
                  <svg
                    width="22"
                    height="12"
                    viewBox="0 0 22 12"
                    fill="none"
                    className="overflow-visible drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]"
                  >
                    <path
                      d="M7 9.5C8.1 8.3 9.5 7.7 11 7.7C12.5 7.7 13.9 8.3 15 9.5"
                      stroke="#15803D"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="ghars-signal-arc-1"
                    />
                    <path
                      d="M4 6.2C5.9 4.2 8.4 3.1 11 3.1C13.6 3.1 16.1 4.2 18 6.2"
                      stroke="#10B981"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="ghars-signal-arc-2"
                    />
                  </svg>
                ) : (
                  <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
                    <path
                      d="M4 7.5C5.8 5.6 7.3 4.8 9 4.8C10.7 4.8 12.2 5.6 14 7.5"
                      stroke="#D97706"
                      strokeWidth="1.6"
                      strokeDasharray="2 2"
                      strokeLinecap="round"
                      opacity="0.7"
                    />
                  </svg>
                )}
              </div>

              {/* Icon-Only Pin with Selection Pulse & Live Connection Dot */}
              <div className="relative flex items-center justify-center">
                {isSelected && (
                  <span
                    style={{ borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.25)' }}
                    className="ghars-sensor-pulse pointer-events-none absolute inset-0 rounded-full border-2"
                  />
                )}
                <div
                  style={{
                    backgroundColor: isSelected ? '#047857' : pinColor,
                    boxShadow: isSelected
                      ? '0 0 0 3px #A7F3D0, 0 6px 14px rgba(4, 120, 87, 0.45)'
                      : undefined,
                  }}
                  aria-label={sensor.name}
                  className={`relative w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white transition-transform ${
                    isSelected ? 'scale-115' : isHovered ? 'scale-110' : ''
                  }`}
                >
                  <SensorGlyph type={sensor.type} size={15} />

                  {/* Live Connection Status Dot */}
                  <span
                    title={isConnected ? 'متصل ويرسل البيانات' : 'في انتظار الاتصال'}
                    className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center"
                  >
                    {isConnected && (
                      <span className="ghars-live-ring absolute inset-0 rounded-full bg-emerald-400" />
                    )}
                    <span
                      className={`relative w-2.5 h-2.5 rounded-full border border-white ${
                        isConnected ? 'bg-emerald-500' : 'bg-amber-400'
                      }`}
                    />
                  </span>
                </div>
              </div>
              <div
                style={{ backgroundColor: isSelected ? '#047857' : pinColor }}
                className="w-0.5 h-2"
              />
              <div
                style={{ backgroundColor: isSelected ? '#047857' : pinColor }}
                className={`w-2.5 h-2.5 rounded-full border-2 border-white shadow ${
                  isSelected ? 'ring-2 ring-emerald-300' : ''
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Single-Farm Plan Focus & Navigation Bar */}
      {focusedFarm && activeFarmer && activeTool !== 'draw' && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-white/95 backdrop-blur-xs border border-[#DCE3DD] rounded-xl px-2.5 py-1.5 shadow-md flex-wrap max-w-[calc(100%-24px)]">
          <button
            type="button"
            onClick={() => focusSingleFarm(null)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0F1F18] text-white hover:bg-[#1E352A] text-[11px] font-semibold cursor-pointer whitespace-nowrap"
          >
            <LayoutGrid size={13} />
            <span>عرض كل المزارع ({activeFarmer.farms.length})</span>
          </button>

          {activeFarmer.farms.length > 1 && (
            <>
              <span className="w-px h-5 bg-[#E2E7E3] mx-0.5" />
              <button
                type="button"
                onClick={() => stepFocusedFarm('prev')}
                title="المزرعة السابقة"
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg border border-[#DCE3DD] hover:border-[#15803D] bg-[#FAFBF9] text-[11px] font-medium text-[#0F1F18] cursor-pointer whitespace-nowrap"
              >
                <ChevronRight size={13} />
                <span>السابقة</span>
              </button>

              <div className="flex items-center gap-1 overflow-x-auto max-w-[420px]">
                {activeFarmer.farms.map((fm) => {
                  const isCurrent = fm.id === focusedFarm.id;
                  return (
                    <button
                      key={fm.id}
                      type="button"
                      onClick={() => focusSingleFarm(fm.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                        isCurrent
                          ? 'bg-[#15803D] text-white shadow-xs'
                          : 'bg-[#F5F7F5] text-[#475569] hover:text-[#0F1F18] hover:bg-[#E8EEE9]'
                      }`}
                    >
                      {fm.name}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => stepFocusedFarm('next')}
                title="المزرعة التالية"
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg border border-[#DCE3DD] hover:border-[#15803D] bg-[#FAFBF9] text-[11px] font-medium text-[#0F1F18] cursor-pointer whitespace-nowrap"
              >
                <span>التالية</span>
                <ChevronLeft size={13} />
              </button>
            </>
          )}
        </div>
      )}

      {/* Empty Canvas Guide Overlay */}
      {activeFarmer && activeFarmer.farms.length === 0 && !isFarmerPreview && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="bg-white/95 border border-[#DCE3DD] rounded-xl px-6 py-5 text-center max-w-sm shadow-sm space-y-1.5">
            <div className="text-sm font-bold text-[#0F1F18]">اللوحة فارغة وجاهزة للتصميم</div>
            <p className="text-xs text-[#475569] leading-relaxed">
              اسحب <strong>«مزرعة»</strong> ثم <strong>«حقل»</strong> و<strong>«منطقة»</strong> والحساسات مباشرة من صندوق الأدوات على اليمين وأفلتها هنا.
            </p>
          </div>
        </div>
      )}

      {/* Draw mode floating helper with Farm / Field / Zone target choice */}
      {activeTool === 'draw' && !isFarmerPreview && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-[#0F1F18] text-white px-3.5 py-2 rounded-lg text-xs font-medium shadow-md flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center bg-white/10 rounded p-0.5 gap-0.5">
            {(
              [
                { id: 'farm', label: 'مزرعة' },
                { id: 'field', label: 'حقل' },
                { id: 'zone', label: 'منطقة' },
              ] as { id: DrawTargetKind; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setDrawTargetKind(opt.id);
                  setDrawPoints([]);
                }}
                className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                  drawTargetKind === opt.id ? 'bg-[#15803D] text-white' : 'text-white/75 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <span>
            {drawPoints.length === 0
              ? 'انقر حول المحيط لتحديد الزوايا'
              : drawPoints.length < 3
              ? `${drawPoints.length} نقاط — أضف 3 نقاط على الأقل`
              : 'انقر على النقطة الأولى الخضراء للإغلاق'}
          </span>

          <button
            type="button"
            onClick={() => {
              setDrawPoints([]);
              setActiveTool('select');
            }}
            className="text-emerald-300 hover:text-white font-semibold cursor-pointer"
          >
            إلغاء (Esc)
          </button>
        </div>
      )}

      {/* Color Distinction Legend Bottom-Right */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex items-center gap-3 bg-white/95 border border-[#DCE3DD] rounded-lg px-3 py-1.5 shadow-sm text-[11px] font-semibold text-[#0F1F18]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm border-2 border-dashed inline-block"
            style={{
              borderColor: HIERARCHY_COLORS.farm.stroke,
              backgroundColor: HIERARCHY_COLORS.farm.labelBg,
            }}
          />
          <span>{HIERARCHY_COLORS.farm.label}</span>
          <span className="text-[10px] font-normal text-[#64748B]">({HIERARCHY_COLORS.farm.toneLabel})</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm border-2 inline-block"
            style={{
              borderColor: HIERARCHY_COLORS.field.stroke,
              backgroundColor: HIERARCHY_COLORS.field.labelBg,
            }}
          />
          <span>{HIERARCHY_COLORS.field.label}</span>
          <span className="text-[10px] font-normal text-[#64748B]">({HIERARCHY_COLORS.field.toneLabel})</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm border-2 inline-block"
            style={{
              borderColor: HIERARCHY_COLORS.zone.stroke,
              backgroundColor: HIERARCHY_COLORS.zone.labelBg,
            }}
          />
          <span>{HIERARCHY_COLORS.zone.label}</span>
          <span className="text-[10px] font-normal text-[#64748B]">({HIERARCHY_COLORS.zone.toneLabel})</span>
        </span>
      </div>

      {/* Zoom Controls Bottom-Left */}
      <div className="absolute bottom-4 left-4 z-30 flex items-center gap-1 bg-white border border-[#DCE3DD] rounded-lg p-1 shadow-sm">
        <button
          type="button"
          onClick={() => handleZoomButton(1.18)}
          title="تكبير"
          className="p-1.5 rounded hover:bg-[#F5F7F5] text-[#0F1F18] cursor-pointer"
        >
          <ZoomIn size={15} />
        </button>
        <span className="font-mono-nums text-[11px] font-semibold text-[#475569] px-1.5 min-w-[44px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => handleZoomButton(0.85)}
          title="تصغير"
          className="p-1.5 rounded hover:bg-[#F5F7F5] text-[#0F1F18] cursor-pointer"
        >
          <ZoomOut size={15} />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          title="ملاءمة للشاشة"
          className="p-1.5 rounded hover:bg-[#F5F7F5] text-[#0F1F18] cursor-pointer border-r border-[#EEF2EE] pr-2"
        >
          <Maximize2 size={14} />
        </button>
        <button
          type="button"
          onClick={() =>
            isFullscreen && hideEditorPanels ? exitFullscreen() : enterFullscreen(true)
          }
          title={
            isFullscreen && hideEditorPanels
              ? 'خروج من وضع التخطيط الكامل (Esc)'
              : 'تخطيط كامل على ملء الشاشة'
          }
          className={`p-1.5 rounded cursor-pointer border-r border-[#EEF2EE] pr-2 ${
            isFullscreen && hideEditorPanels
              ? 'bg-emerald-50 text-[#15803D]'
              : 'hover:bg-[#F5F7F5] text-[#0F1F18]'
          }`}
        >
          {isFullscreen && hideEditorPanels ? <Minimize2 size={14} /> : <Expand size={14} />}
        </button>
      </div>

      {/* Floating Sensor Daily Chart & Values Popup */}
      {popupContext && (
        <div className="absolute top-4 left-4 z-40">
          <SensorPreviewCard
            sensor={popupContext.sensor}
            zone={popupContext.zone}
            farmName={popupContext.farm.name}
            fieldName={popupContext.field.name}
            onOpenDetails={() => openSensorDetails(popupContext.sensor.id)}
            onClose={closeSensorPopup}
          />
        </div>
      )}
    </div>
  );
}
