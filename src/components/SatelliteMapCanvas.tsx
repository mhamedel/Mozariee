import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  LayoutGrid,
  Maximize2,
  Minimize2,
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
  GeoPoint,
  SensorDevice,
  SensorType,
  WorkspaceState,
} from '../types/ghars';
import {
  createGeoRectPolygon,
  getGeoMidpoints,
  isGeoPointInPolygon,
} from '../utils/geometry';
import { SensorPreviewCard } from './SensorPreviewCard';

type SatelliteMapCanvasProps = {
  store: GharsStore;
  activeDrag: ActiveDragPayload | null;
  onRegisterDropHandler: (
    handler: ((payload: ActiveDragPayload, clientX: number, clientY: number) => boolean) | null
  ) => void;
};

function buildBoundaryTitleIcon(
  label: string,
  bgColor: string,
  alignRight: boolean,
  isSelected = false
): L.DivIcon {
  const escaped = label.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const transform = alignRight ? 'translate(-100%, -100%)' : 'translate(-50%, -100%)';
  const activeRing = isSelected
    ? 'box-shadow:0 0 0 2px #FCD34D, 0 3px 8px rgba(0,0,0,0.35);'
    : 'box-shadow:0 1px 3px rgba(0,0,0,0.25);';
  const dotHtml = isSelected
    ? '<span style="display:inline-block; width:6px; height:6px; border-radius:9999px; background:#FCD34D; margin-left:5px; flex-shrink:0;"></span>'
    : '';
  return L.divIcon({
    className: 'ghars-boundary-title-icon',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `
      <div style="transform:${transform}; background:${bgColor}; color:#ffffff; border:1px solid ${isSelected ? '#FCD34D' : bgColor}; border-bottom:0; border-radius:6px 6px 0 0; padding:2px 8px; font-family:'IBM Plex Sans Arabic',sans-serif; font-size:11px; font-weight:700; line-height:1.3; white-space:nowrap; max-width:210px; overflow:hidden; text-overflow:ellipsis; display:inline-flex; align-items:center; ${activeRing} pointer-events:none;">
        ${dotHtml}<span>${escaped}</span>
      </div>
    `,
  });
}

function getGeoTopBorderAnchor(points: GeoPoint[]): { lat: number; lng: number; alignRight: boolean } {
  if (points.length === 0) return { lat: 0, lng: 0, alignRight: true };
  let maxLat = -Infinity;
  let minLat = Infinity;
  for (const p of points) {
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lat < minLat) minLat = p.lat;
  }
  const tol = Math.max(0.00001, (maxLat - minLat) * 0.1);
  const topPts = points.filter((p) => p.lat >= maxLat - tol);
  const topRightLng = Math.max(...topPts.map((p) => p.lng));
  const topLeftLng = Math.min(...topPts.map((p) => p.lng));
  const span = topRightLng - topLeftLng;
  if (span > 0.0001) {
    return { lat: maxLat, lng: topRightLng - span * 0.04, alignRight: true };
  }
  return { lat: maxLat, lng: (topRightLng + topLeftLng) / 2, alignRight: false };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getSensorSvgPath(type: SensorType): string {
  switch (type) {
    case 'moisture':
      return '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>';
    case 'ec':
      return '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>';
    case 'ph':
      return '<path d="M10 2v7.31"></path><path d="M14 9.3V1.99"></path><path d="M8.5 2h7"></path><path d="M14 9.3a6.5 6.5 0 1 1-4 0"></path><path d="M5.52 16h12.96"></path>';
    case 'temp':
      return '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"></path>';
    case 'multi':
      return '<rect width="16" height="16" x="4" y="4" rx="2"></rect><rect width="6" height="6" x="9" y="9" rx="1"></rect><path d="M15 2v2"></path><path d="M15 20v2"></path><path d="M2 15h2"></path><path d="M2 9h2"></path><path d="M20 15h2"></path><path d="M20 9h2"></path><path d="M9 2v2"></path><path d="M9 20v2"></path>';
  }
}

function buildSensorDivIcon(type: SensorType, color: string, isSelected: boolean): L.DivIcon {
  const bg = isSelected ? '#047857' : color;
  const ring = isSelected
    ? 'box-shadow: 0 0 0 3px #A7F3D0, 0 6px 14px rgba(4, 120, 87, 0.48);'
    : 'box-shadow: 0 3px 8px rgba(0,0,0,0.32);';
  const pulseHtml = isSelected
    ? '<span class="ghars-sensor-pulse" style="position:absolute; inset:0; border-radius:9999px; border:2px solid #10B981; background:rgba(16,185,129,0.25); pointer-events:none;"></span>'
    : '';
  const scaleTransform = isSelected ? 'transform: scale(1.14);' : '';

  return L.divIcon({
    className: 'ghars-leaflet-sensor-icon',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `
      <div style="transform: translate(-50%, -100%); display:flex; flex-direction:column; align-items:center; pointer-events:auto;">
        <div style="position:relative; width:32px; height:32px; display:flex; align-items:center; justify-content:center; ${scaleTransform}">
          ${pulseHtml}
          <div style="position:relative; width:32px; height:32px; background:${bg}; color:#ffffff; border:2px solid #ffffff; border-radius:9999px; display:flex; align-items:center; justify-content:center; ${ring}">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              ${getSensorSvgPath(type)}
            </svg>
          </div>
        </div>
        <div style="width:2px; height:8px; background:${bg};"></div>
        <div style="width:10px; height:10px; border-radius:9999px; background:${bg}; border:2px solid #ffffff; ${isSelected ? 'box-shadow:0 0 0 2px #6EE7B7;' : 'box-shadow:0 1px 4px rgba(0,0,0,0.3);'}"></div>
      </div>
    `,
  });
}

function buildSensorHoverTooltipHtml(sensor: SensorDevice, isFarmerPreview: boolean): string {
  const meta = SENSOR_META[sensor.type];
  const header = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:4px; margin-bottom:5px;">
      <span style="font-size:11px; font-weight:700; color:#ffffff;">${escapeHtml(sensor.name)}</span>
      <span style="font-size:10px; color:rgba(255,255,255,0.7);">${escapeHtml(meta.shortLabel)}</span>
    </div>
  `;

  let body = '';
  if (sensor.lastReadingAt) {
    const rows = sensor.measurements
      .map((mKey) => {
        const mMeta = MEASUREMENT_META[mKey];
        const r = sensor.readings[mKey];
        const valText = r ? `${r.value} ${escapeHtml(r.unit)}` : '—';
        return `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; font-size:10px; margin-bottom:2px;">
            <span style="color:rgba(255,255,255,0.78);">${escapeHtml(mMeta.label)}</span>
            <span style="font-family:'IBM Plex Mono',monospace; font-weight:700; color:#6EE7B7;">${valText}</span>
          </div>
        `;
      })
      .join('');
    body = `${rows}<div style="font-size:9px; color:rgba(255,255,255,0.55); margin-top:3px;">${escapeHtml(
      formatReadingTimeArabic(sensor.lastReadingAt)
    )}</div>`;
  } else {
    body = `<div style="font-size:10px; font-weight:600; color:#FCD34D;">في انتظار أول قراءة</div>`;
  }

  const footer = !isFarmerPreview
    ? `<div style="font-size:9px; color:#6EE7B7; border-top:1px solid rgba(255,255,255,0.12); padding-top:4px; margin-top:5px;">انقر لعرض القيم وتغيّر اليوم</div>`
    : '';

  return `<div style="min-width:170px; max-width:230px;">${header}${body}${footer}</div>`;
}

export function SatelliteMapCanvas({
  store,
  activeDrag,
  onRegisterDropHandler,
}: SatelliteMapCanvasProps) {
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
    draftRef,
    popupSensorId,
    openSensorPopup,
    closeSensorPopup,
    openSensorDetails,
    fitViewToken,
  } = store;

  const focusedFarm = useMemo(
    () =>
      focusedFarmId ? activeFarmer?.farms.find((fm) => fm.id === focusedFarmId) ?? null : null,
    [activeFarmer, focusedFarmId]
  );

  const visibleFarms = useMemo(
    () => (focusedFarm ? [focusedFarm] : activeFarmer?.farms ?? []),
    [activeFarmer, focusedFarm]
  );

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const drawGroupRef = useRef<L.LayerGroup | null>(null);

  const [drawGeoPoints, setDrawGeoPoints] = useState<GeoPoint[]>([]);
  const [highlightedZoneId, setHighlightedZoneId] = useState<string | null>(null);

  const latestRef = useRef({
    activeFarmer,
    activeTool,
    drawTargetKind,
    isFarmerPreview,
  });
  latestRef.current = {
    activeFarmer,
    activeTool,
    drawTargetKind,
    isFarmerPreview,
  };

  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el || mapRef.current) return;

    const initialCenter = activeFarmer?.geoCenter ?? { lat: 24.1555, lng: 47.3366 };
    const initialZoom = activeFarmer?.geoZoom ?? 16;

    const map = L.map(el, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: initialZoom,
      zoomControl: false,
      doubleClickZoom: false,
    });

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Esri World Imagery',
        maxZoom: 20,
      }
    ).addTo(map);

    const layersGroup = L.layerGroup().addTo(map);
    const drawGroup = L.layerGroup().addTo(map);

    mapRef.current = map;
    layersGroupRef.current = layersGroup;
    drawGroupRef.current = drawGroup;

    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layersGroupRef.current = null;
      drawGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeFarmer) return;
    map.setView([activeFarmer.geoCenter.lat, activeFarmer.geoCenter.lng], activeFarmer.geoZoom || 16);
    setDrawGeoPoints([]);
    closeSensorPopup();
  }, [activeFarmer?.id, closeSensorPopup]);

  useEffect(() => {
    if (activeTool !== 'draw') {
      setDrawGeoPoints([]);
    }
  }, [activeTool]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = window.setTimeout(() => {
      map.invalidateSize();
    }, 60);
    return () => window.clearTimeout(t);
  }, [isFullscreen, hideEditorPanels]);

  const finishGeoDraw = (pts: GeoPoint[], target: DrawTargetKind) => {
    if (target === 'farm') {
      createFarm({ geoPoints: pts });
    } else if (target === 'field') {
      createField({ geoPoints: pts });
    } else {
      createZone({ geoPoints: pts });
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onMapClick = (e: L.LeafletMouseEvent) => {
      const state = latestRef.current;
      if (state.isFarmerPreview) {
        closeSensorPopup();
        return;
      }

      if (state.activeTool === 'draw') {
        const clickedGeo: GeoPoint = {
          lat: Number(e.latlng.lat.toFixed(6)),
          lng: Number(e.latlng.lng.toFixed(6)),
        };
        setDrawGeoPoints((prev) => {
          if (prev.length >= 3) {
            const firstPx = map.latLngToContainerPoint([prev[0].lat, prev[0].lng]);
            const curPx = map.latLngToContainerPoint(e.latlng);
            if (firstPx.distanceTo(curPx) < 16) {
              finishGeoDraw(prev, state.drawTargetKind);
              return [];
            }
          }
          return [...prev, clickedGeo];
        });
        return;
      }

      setSelection(null);
      setSelectedVertexIndex(null);
      closeSensorPopup();
    };

    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
    };
  }, [closeSensorPopup, createFarm, createField, createZone, setSelectedVertexIndex, setSelection]);

  useEffect(() => {
    const drawGroup = drawGroupRef.current;
    const map = mapRef.current;
    if (!drawGroup || !map) return;
    drawGroup.clearLayers();

    if (activeTool !== 'draw' || drawGeoPoints.length === 0) return;

    const latLngs = drawGeoPoints.map((p) => [p.lat, p.lng] as [number, number]);
    L.polyline(latLngs, {
      color: '#22C55E',
      weight: 2.5,
      dashArray: '6, 5',
    }).addTo(drawGroup);

    drawGeoPoints.forEach((p, idx) => {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: idx === 0 ? 7 : 5,
        color: '#0F1F18',
        weight: 2,
        fillColor: idx === 0 ? '#15803D' : '#FFFFFF',
        fillOpacity: 1,
      }).addTo(drawGroup);

      if (idx === 0 && drawGeoPoints.length >= 3) {
        marker.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev);
          finishGeoDraw(drawGeoPoints, drawTargetKind);
          setDrawGeoPoints([]);
        });
      }
    });
  }, [activeTool, drawGeoPoints, drawTargetKind]);

  // Highlight receiving zone while dragging sensor over Leaflet map
  useEffect(() => {
    const map = mapRef.current;
    const el = mapContainerRef.current;
    if (!activeDrag || !map || !el || !activeFarmer) {
      setHighlightedZoneId(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    if (
      activeDrag.clientX < rect.left ||
      activeDrag.clientX > rect.right ||
      activeDrag.clientY < rect.top ||
      activeDrag.clientY > rect.bottom
    ) {
      setHighlightedZoneId(null);
      return;
    }

    if (
      activeDrag.itemType !== 'farm' &&
      activeDrag.itemType !== 'field' &&
      activeDrag.itemType !== 'zone'
    ) {
      const ll = map.containerPointToLatLng([
        activeDrag.clientX - rect.left,
        activeDrag.clientY - rect.top,
      ]);
      const geo = { lat: ll.lat, lng: ll.lng };
      let matchedId: string | null = null;
      for (const fm of activeFarmer.farms) {
        for (const fl of fm.fields) {
          const z = fl.zones.find((x) => isGeoPointInPolygon(geo, x.geoPoints));
          if (z) {
            matchedId = z.id;
            break;
          }
        }
        if (matchedId) break;
      }
      setHighlightedZoneId(matchedId);
    } else {
      setHighlightedZoneId(null);
    }
  }, [activeDrag, activeFarmer]);

  useEffect(() => {
    const handleDrop = (payload: ActiveDragPayload, clientX: number, clientY: number): boolean => {
      const map = mapRef.current;
      const el = mapContainerRef.current;
      if (!map || !el || !activeFarmer) return false;
      const rect = el.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return false;
      }

      const ll = map.containerPointToLatLng([clientX - rect.left, clientY - rect.top]);
      const dropGeo: GeoPoint = {
        lat: Number(ll.lat.toFixed(6)),
        lng: Number(ll.lng.toFixed(6)),
      };

      if (payload.itemType === 'farm') {
        createFarm({ geoPoints: createGeoRectPolygon(dropGeo, 0.0018, 0.0028) });
        return true;
      }
      if (payload.itemType === 'field') {
        createField({ geoPoints: createGeoRectPolygon(dropGeo, 0.0011, 0.0016) });
        return true;
      }
      if (payload.itemType === 'zone') {
        createZone({ geoPoints: createGeoRectPolygon(dropGeo, 0.00075, 0.001) });
        return true;
      }

      placeSensorAtPoint(payload.itemType, { geoPos: dropGeo });
      return true;
    };

    onRegisterDropHandler(handleDrop);
    return () => onRegisterDropHandler(null);
  }, [activeFarmer, createFarm, createField, createZone, onRegisterDropHandler, placeSensorAtPoint]);

  // Render Farms -> Fields -> Zones -> Sensors onto Leaflet
  useEffect(() => {
    const map = mapRef.current;
    const group = layersGroupRef.current;
    if (!map || !group || !activeFarmer) return;

    group.clearLayers();

    const attachPolygonDrag = (
      polygon: L.Polygon,
      onSelect: () => void,
      onDelta: (dLat: number, dLng: number) => void,
      onPureClick?: () => void
    ) => {
      polygon.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (activeTool !== 'select') return;
        onSelect();
        if (isFarmerPreview) {
          onPureClick?.();
        }
      });

      if (!isFarmerPreview && activeTool === 'select') {
        polygon.on('mousedown', (downEv: L.LeafletMouseEvent) => {
          if (downEv.originalEvent.button !== 0) return;
          L.DomEvent.stopPropagation(downEv);
          onSelect();

          const beforeSnapshot = JSON.parse(JSON.stringify(draftRef.current)) as WorkspaceState;
          let lastLatLng = downEv.latlng;
          const startPoint = downEv.containerPoint;
          let didMove = false;
          map.dragging.disable();

          const onMouseMove = (moveEv: L.LeafletMouseEvent) => {
            if (!didMove && moveEv.containerPoint.distanceTo(startPoint) < 4) {
              return;
            }
            didMove = true;
            const dLat = moveEv.latlng.lat - lastLatLng.lat;
            const dLng = moveEv.latlng.lng - lastLatLng.lng;
            lastLatLng = moveEv.latlng;
            onDelta(dLat, dLng);
          };

          const onMouseUp = () => {
            map.off('mousemove', onMouseMove);
            map.off('mouseup', onMouseUp);
            window.removeEventListener('mouseup', onMouseUp);
            map.dragging.enable();
            if (didMove) {
              pushCheckpoint(beforeSnapshot);
            } else {
              onPureClick?.();
            }
          };

          map.on('mousemove', onMouseMove);
          map.on('mouseup', onMouseUp);
          window.addEventListener('mouseup', onMouseUp);
        });
      }
    };

    const attachHandles = (
      pts: GeoPoint[],
      target:
        | { kind: 'farm'; farmId: string }
        | { kind: 'field'; farmId: string; fieldId: string }
        | { kind: 'zone'; farmId: string; fieldId: string; zoneId: string }
    ) => {
      if (isFarmerPreview || activeTool !== 'select') return;
      const midpoints = getGeoMidpoints(pts);
      midpoints.forEach((mp, idx) => {
        const midIcon = L.divIcon({
          className: 'ghars-mid-handle',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
          html: `<div style="width:14px;height:14px;border-radius:9999px;background:#fff;border:2px solid #15803D;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#15803D;cursor:copy;">+</div>`,
        });
        const midMarker = L.marker([mp.lat, mp.lng], { icon: midIcon }).addTo(group);
        midMarker.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev);
          insertBoundaryVertex(target, idx, { geo: mp });
        });
      });

      pts.forEach((pt, idx) => {
        const isVSel = selectedVertexIndex === idx;
        const vIcon = L.divIcon({
          className: 'ghars-vertex-handle',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
          html: `<div style="width:14px;height:14px;border-radius:3px;background:${
            isVSel ? '#15803D' : '#FFFFFF'
          };border:2px solid #0F1F18;cursor:move;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
        });
        const vMarker = L.marker([pt.lat, pt.lng], {
          icon: vIcon,
          draggable: true,
        }).addTo(group);

        let beforeSnapshot: WorkspaceState | null = null;
        vMarker.on('dragstart', () => {
          beforeSnapshot = JSON.parse(JSON.stringify(draftRef.current)) as WorkspaceState;
          setSelectedVertexIndex(idx);
        });
        vMarker.on('drag', () => {
          const ll = vMarker.getLatLng();
          const geoPoint = { lat: Number(ll.lat.toFixed(6)), lng: Number(ll.lng.toFixed(6)) };
          if (target.kind === 'farm') {
            updateBoundaryVertex({ kind: 'farm-geo', farmId: target.farmId, index: idx, geoPoint }, false);
          } else if (target.kind === 'field') {
            updateBoundaryVertex(
              {
                kind: 'field-geo',
                farmId: target.farmId,
                fieldId: target.fieldId,
                index: idx,
                geoPoint,
              },
              false
            );
          } else {
            updateBoundaryVertex(
              {
                kind: 'zone-geo',
                farmId: target.farmId,
                fieldId: target.fieldId,
                zoneId: target.zoneId,
                index: idx,
                geoPoint,
              },
              false
            );
          }
        });
        vMarker.on('dragend', () => {
          if (beforeSnapshot) pushCheckpoint(beforeSnapshot);
        });
        vMarker.on('contextmenu', (ev) => {
          L.DomEvent.stopPropagation(ev);
          removeBoundaryVertex(target, idx);
        });
      });
    };

    let assignedFieldId: string | null = null;
    let assignedZoneId: string | null = null;
    const activeSensorId = selection?.kind === 'sensor' ? selection.sensorId : popupSensorId;
    if (activeSensorId) {
      for (const fm of activeFarmer.farms) {
        for (const fl of fm.fields) {
          const found = fl.sensors.find((s) => s.id === activeSensorId);
          if (found) {
            assignedFieldId = fl.id;
            assignedZoneId = found.zoneId ?? null;
            break;
          }
        }
        if (assignedFieldId) break;
      }
    }

    // 1. Farms
    visibleFarms.forEach((farm) => {
      const isFarmSel = selection?.kind === 'farm' && selection.farmId === farm.id;
      const farmLatLngs = farm.geoPoints.map((p) => [p.lat, p.lng] as [number, number]);
      if (isFarmSel) {
        L.polygon(farmLatLngs, {
          color: '#F59E0B',
          weight: 8,
          opacity: 0.45,
          fill: false,
          interactive: false,
        }).addTo(group);
      }
      const farmPoly = L.polygon(farmLatLngs, {
        color: isFarmSel ? '#B45309' : HIERARCHY_COLORS.farm.stroke,
        weight: isFarmSel ? 3.4 : 2,
        dashArray: isFarmSel ? undefined : '6, 5',
        fillColor: isFarmSel ? '#D97706' : HIERARCHY_COLORS.farm.stroke,
        fillOpacity: isFarmSel ? 0.16 : 0.06,
      }).addTo(group);

      attachPolygonDrag(
        farmPoly,
        () => {
          setSelection({ kind: 'farm', farmId: farm.id });
          setSelectedVertexIndex(null);
          closeSensorPopup();
        },
        (dLat, dLng) => {
          translateBoundary({ kind: 'farm-geo', farmId: farm.id, dLat, dLng }, false);
        },
        () => {
          focusSingleFarm(farm.id);
        }
      );

      if (isFarmSel) attachHandles(farm.geoPoints, { kind: 'farm', farmId: farm.id });

      const farmAnchor = getGeoTopBorderAnchor(farm.geoPoints);
      L.marker([farmAnchor.lat, farmAnchor.lng], {
        icon: buildBoundaryTitleIcon(
          `${HIERARCHY_COLORS.farm.label}: ${farm.name}`,
          isFarmSel ? '#B45309' : HIERARCHY_COLORS.farm.stroke,
          farmAnchor.alignRight,
          isFarmSel
        ),
        interactive: false,
        zIndexOffset: isFarmSel ? 90 : 50,
      }).addTo(group);

      // 2. Fields
      farm.fields.forEach((field) => {
        const isFieldSel = selection?.kind === 'field' && selection.fieldId === field.id;
        const isAssignedField = assignedFieldId === field.id;
        const fieldLatLngs = field.geoPoints.map((p) => [p.lat, p.lng] as [number, number]);
        if (isFieldSel || isAssignedField) {
          L.polygon(fieldLatLngs, {
            color: '#10B981',
            weight: isFieldSel ? 8 : 5.5,
            opacity: isFieldSel ? 0.52 : 0.36,
            fill: false,
            interactive: false,
          }).addTo(group);
        }
        const fieldPoly = L.polygon(fieldLatLngs, {
          color: isFieldSel ? '#FFFFFF' : isAssignedField ? '#10B981' : HIERARCHY_COLORS.field.stroke,
          weight: isFieldSel ? 3.2 : isAssignedField ? 2.6 : 2.2,
          fillColor: isFieldSel || isAssignedField ? '#10B981' : HIERARCHY_COLORS.field.stroke,
          fillOpacity: isFieldSel ? 0.28 : isAssignedField ? 0.18 : 0.1,
        }).addTo(group);

        attachPolygonDrag(
          fieldPoly,
          () => {
            setSelection({ kind: 'field', farmId: farm.id, fieldId: field.id });
            setSelectedVertexIndex(null);
            closeSensorPopup();
          },
          (dLat, dLng) => {
            translateBoundary(
              { kind: 'field-geo', farmId: farm.id, fieldId: field.id, dLat, dLng },
              false
            );
          }
        );

        if (isFieldSel)
          attachHandles(field.geoPoints, { kind: 'field', farmId: farm.id, fieldId: field.id });

        const fieldAnchor = getGeoTopBorderAnchor(field.geoPoints);
        const fieldTitleActive = isFieldSel || isAssignedField;
        L.marker([fieldAnchor.lat, fieldAnchor.lng], {
          icon: buildBoundaryTitleIcon(
            `${HIERARCHY_COLORS.field.label}: ${field.name}`,
            fieldTitleActive ? '#047857' : HIERARCHY_COLORS.field.stroke,
            fieldAnchor.alignRight,
            fieldTitleActive
          ),
          interactive: false,
          zIndexOffset: fieldTitleActive ? 95 : 60,
        }).addTo(group);

        // 3. Zones
        field.zones.forEach((zone) => {
          const isZoneSel = selection?.kind === 'zone' && selection.zoneId === zone.id;
          const isAssignedZone = assignedZoneId === zone.id;
          const isHighlighted = highlightedZoneId === zone.id;
          const zoneLatLngs = zone.geoPoints.map((p) => [p.lat, p.lng] as [number, number]);
          if (isZoneSel || isHighlighted || isAssignedZone) {
            L.polygon(zoneLatLngs, {
              color: isZoneSel || isHighlighted ? '#F59E0B' : '#10B981',
              weight: isZoneSel || isHighlighted ? 8 : 5.5,
              opacity: isZoneSel || isHighlighted ? 0.55 : 0.45,
              fill: false,
              interactive: false,
            }).addTo(group);
          }
          const zonePoly = L.polygon(zoneLatLngs, {
            color:
              isHighlighted || isZoneSel
                ? '#FFFFFF'
                : isAssignedZone
                ? '#047857'
                : zone.color,
            weight: isHighlighted || isZoneSel ? 3.2 : isAssignedZone ? 2.6 : 2,
            fillColor: zone.color,
            fillOpacity: isHighlighted ? 0.42 : isZoneSel ? 0.36 : isAssignedZone ? 0.3 : 0.2,
          }).addTo(group);

          const zoneAnchor = getGeoTopBorderAnchor(zone.geoPoints);
          const zoneTitleActive = isZoneSel || isAssignedZone;
          L.marker([zoneAnchor.lat, zoneAnchor.lng], {
            icon: buildBoundaryTitleIcon(
              zone.name,
              zoneTitleActive ? '#0F1F18' : zone.color,
              zoneAnchor.alignRight,
              zoneTitleActive
            ),
            interactive: false,
            zIndexOffset: zoneTitleActive ? 100 : 70,
          }).addTo(group);

          attachPolygonDrag(
            zonePoly,
            () => {
              setSelection({
                kind: 'zone',
                farmId: farm.id,
                fieldId: field.id,
                zoneId: zone.id,
              });
              setSelectedVertexIndex(null);
              closeSensorPopup();
            },
            (dLat, dLng) => {
              translateBoundary(
                {
                  kind: 'zone-geo',
                  farmId: farm.id,
                  fieldId: field.id,
                  zoneId: zone.id,
                  dLat,
                  dLng,
                },
                false
              );
            }
          );

          if (isZoneSel)
            attachHandles(zone.geoPoints, {
              kind: 'zone',
              farmId: farm.id,
              fieldId: field.id,
              zoneId: zone.id,
            });
        });

        // 4. Sensors
        field.sensors.forEach((sensor) => {
          const meta = SENSOR_META[sensor.type];
          const isSelected =
            (selection?.kind === 'sensor' && selection.sensorId === sensor.id) ||
            popupSensorId === sensor.id;

          const marker = L.marker([sensor.geoPos.lat, sensor.geoPos.lng], {
            icon: buildSensorDivIcon(sensor.type, meta.color, isSelected),
            draggable: !isFarmerPreview && activeTool === 'select',
            zIndexOffset: isSelected ? 600 : 300,
          }).addTo(group);

          marker.bindTooltip(buildSensorHoverTooltipHtml(sensor, isFarmerPreview), {
            direction: 'top',
            offset: [0, -40],
            opacity: 1,
            className: 'ghars-sensor-tooltip',
          });

          marker.on('click', (ev) => {
            L.DomEvent.stopPropagation(ev);
            if (isFarmerPreview) {
              openSensorPopup(sensor.id, 'chart');
              return;
            }
            setSelection({
              kind: 'sensor',
              farmId: farm.id,
              fieldId: field.id,
              sensorId: sensor.id,
            });
            setSelectedVertexIndex(null);
            openSensorPopup(sensor.id, 'chart');
          });

          if (!isFarmerPreview && activeTool === 'select') {
            let beforeSnapshot: WorkspaceState | null = null;
            marker.on('dragstart', () => {
              beforeSnapshot = JSON.parse(JSON.stringify(draftRef.current)) as WorkspaceState;
              setSelection({
                kind: 'sensor',
                farmId: farm.id,
                fieldId: field.id,
                sensorId: sensor.id,
              });
            });
            marker.on('drag', () => {
              const ll = marker.getLatLng();
              const geoPos = { lat: Number(ll.lat.toFixed(6)), lng: Number(ll.lng.toFixed(6)) };
              moveSensorPosition(farm.id, field.id, sensor.id, { geoPos }, false);
              let matchedZoneId: string | null = null;
              for (const fm of activeFarmer.farms) {
                for (const fl of fm.fields) {
                  const z = fl.zones.find((x) => isGeoPointInPolygon(geoPos, x.geoPoints));
                  if (z) {
                    matchedZoneId = z.id;
                    break;
                  }
                }
                if (matchedZoneId) break;
              }
              setHighlightedZoneId(matchedZoneId);
            });
            marker.on('dragend', () => {
              setHighlightedZoneId(null);
              if (beforeSnapshot) pushCheckpoint(beforeSnapshot);
            });
          }
        });
      });
    });
  }, [
    activeFarmer,
    activeTool,
    closeSensorPopup,
    draftRef,
    focusSingleFarm,
    highlightedZoneId,
    insertBoundaryVertex,
    isFarmerPreview,
    moveSensorPosition,
    openSensorPopup,
    popupSensorId,
    pushCheckpoint,
    removeBoundaryVertex,
    selectedVertexIndex,
    selection,
    setSelectedVertexIndex,
    setSelection,
    translateBoundary,
    updateBoundaryVertex,
    visibleFarms,
  ]);

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

  const handleFitAll = () => {
    const map = mapRef.current;
    if (!map || !activeFarmer) return;
    const allPts = visibleFarms.flatMap((fm) =>
      fm.geoPoints.map((p) => [p.lat, p.lng] as [number, number])
    );
    if (allPts.length > 0) {
      map.fitBounds(L.latLngBounds(allPts), { padding: [50, 50] });
    } else {
      map.setView([activeFarmer.geoCenter.lat, activeFarmer.geoCenter.lng], activeFarmer.geoZoom || 16);
    }
  };

  useEffect(() => {
    if (fitViewToken === 0) return;
    handleFitAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitViewToken]);

  useEffect(() => {
    handleFitAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedFarmId]);

  return (
    <div className="relative flex-1 overflow-hidden bg-[#1A241E]">
      <div
        ref={mapContainerRef}
        className={`w-full h-full ${activeTool === 'draw' && !isFarmerPreview ? 'cursor-crosshair' : ''}`}
      />

      {focusedFarm && activeFarmer && activeTool !== 'draw' && (
        <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 bg-white/95 backdrop-blur-xs border border-[#DCE3DD] rounded-xl px-2.5 py-1.5 shadow-md flex-wrap max-w-[calc(100%-24px)]">
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

      {activeTool === 'draw' && !isFarmerPreview && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-[#0F1F18] text-white px-3.5 py-2 rounded-lg text-xs font-medium shadow-md flex items-center gap-3 flex-wrap">
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
                  setDrawGeoPoints([]);
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
            {drawGeoPoints.length === 0
              ? 'انقر على الخريطة الفضائية لتحديد الزوايا'
              : drawGeoPoints.length < 3
              ? `${drawGeoPoints.length} نقاط — أضف 3 نقاط على الأقل`
              : 'انقر على النقطة الأولى الخضراء للإغلاق'}
          </span>
          <button
            type="button"
            onClick={() => {
              setDrawGeoPoints([]);
              setActiveTool('select');
            }}
            className="text-emerald-300 hover:text-white font-semibold cursor-pointer"
          >
            إلغاء (Esc)
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 right-4 z-[1000] flex items-center gap-3 bg-white/95 border border-[#DCE3DD] rounded-lg px-3 py-1.5 shadow-sm text-[11px] font-semibold text-[#0F1F18]">
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

      <div className="absolute bottom-4 left-4 z-[1000] flex items-center gap-1 bg-white border border-[#DCE3DD] rounded-lg p-1 shadow-sm">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          title="تكبير"
          className="p-1.5 rounded hover:bg-[#F5F7F5] text-[#0F1F18] cursor-pointer"
        >
          <ZoomIn size={15} />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          title="تصغير"
          className="p-1.5 rounded hover:bg-[#F5F7F5] text-[#0F1F18] cursor-pointer"
        >
          <ZoomOut size={15} />
        </button>
        <button
          type="button"
          onClick={handleFitAll}
          title="ملاءمة الحدود"
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

      {popupContext && (
        <div className="absolute top-4 left-4 z-[1000]">
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
