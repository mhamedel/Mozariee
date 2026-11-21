import type { GeoPoint, Point } from '../types/ghars';

export const PLAN_WIDTH = 1000;
export const PLAN_DEFAULT_HEIGHT = 680;

export type BoundingBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
};

export function getPlanWidth(planWidth?: number): number {
  if (typeof planWidth === 'number' && Number.isFinite(planWidth) && planWidth >= PLAN_WIDTH) {
    return Math.round(planWidth);
  }
  return PLAN_WIDTH;
}

export function getPlanHeight(
  backgroundMode: 'blank' | 'image' | 'satellite',
  imageAspectRatio = 1000 / 680,
  customPlanWidth?: number,
  customPlanHeight?: number
): number {
  const w = getPlanWidth(customPlanWidth);
  if (backgroundMode === 'image' && imageAspectRatio > 0.2 && imageAspectRatio < 5) {
    return Math.round(w / imageAspectRatio);
  }
  if (
    typeof customPlanHeight === 'number' &&
    Number.isFinite(customPlanHeight) &&
    customPlanHeight >= PLAN_DEFAULT_HEIGHT
  ) {
    return Math.round(customPlanHeight);
  }
  return PLAN_DEFAULT_HEIGHT;
}

export function getBoundingBox(points: Point[]): BoundingBox {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, cx: 0, cy: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    cx: minX + width / 2,
    cy: minY + height / 2,
  };
}

export function boxesOverlap(a: BoundingBox, b: BoundingBox, margin = 8): boolean {
  return !(
    a.maxX + margin <= b.minX ||
    b.maxX + margin <= a.minX ||
    a.maxY + margin <= b.minY ||
    b.maxY + margin <= a.minY
  );
}

export function isBoxInsideBox(inner: BoundingBox, outer: BoundingBox, padding = 10): boolean {
  return (
    inner.minX >= outer.minX + padding &&
    inner.maxX <= outer.maxX - padding &&
    inner.minY >= outer.minY + padding &&
    inner.maxY <= outer.maxY - padding
  );
}

export function remapPointBetweenBoxes(p: Point, from: BoundingBox, to: BoundingBox): Point {
  const safeW = Math.max(1, from.width);
  const safeH = Math.max(1, from.height);
  const nx = (p.x - from.minX) / safeW;
  const ny = (p.y - from.minY) / safeH;
  return {
    x: Math.round(to.minX + nx * to.width),
    y: Math.round(to.minY + ny * to.height),
  };
}

export function boxToRectPolygon(box: {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}): Point[] {
  return [
    { x: Math.round(box.minX), y: Math.round(box.minY) },
    { x: Math.round(box.maxX), y: Math.round(box.minY) },
    { x: Math.round(box.maxX), y: Math.round(box.maxY) },
    { x: Math.round(box.minX), y: Math.round(box.maxY) },
  ];
}

/**
 * Splits a container box into `count` non-overlapping rectangular slots.
 * Chooses horizontal vs vertical splits based on aspect ratio and count.
 */
export function partitionBoxIntoSlots(
  container: BoundingBox,
  count: number,
  gap = 18,
  preferHorizontal = true
): BoundingBox[] {
  if (count <= 0) return [];
  if (count === 1) return [container];

  let cols: number;
  let rows: number;

  if (count === 2) {
    if (preferHorizontal || container.width >= container.height * 1.05) {
      cols = 2;
      rows = 1;
    } else {
      cols = 1;
      rows = 2;
    }
  } else {
    cols = Math.ceil(Math.sqrt((count * container.width) / Math.max(1, container.height)));
    cols = Math.max(1, Math.min(count, cols));
    rows = Math.ceil(count / cols);
  }

  const slotW = Math.max(40, (container.width - gap * (cols - 1)) / cols);
  const slotH = Math.max(40, (container.height - gap * (rows - 1)) / rows);

  const slots: BoundingBox[] = [];
  for (let r = 0; r < rows; r++) {
    const itemsInThisRow = r === rows - 1 ? count - r * cols : cols;
    const rowSlotW =
      itemsInThisRow < cols
        ? Math.max(40, (container.width - gap * (itemsInThisRow - 1)) / itemsInThisRow)
        : slotW;

    for (let c = 0; c < itemsInThisRow; c++) {
      const minX = container.minX + c * (rowSlotW + gap);
      const minY = container.minY + r * (slotH + gap);
      const maxX = minX + rowSlotW;
      const maxY = minY + slotH;
      slots.push({
        minX,
        minY,
        maxX,
        maxY,
        width: rowSlotW,
        height: slotH,
        cx: minX + rowSlotW / 2,
        cy: minY + slotH / 2,
      });
    }
  }
  return slots;
}

export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isGeoPointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function getCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

export function getGeoCentroid(points: GeoPoint[]): GeoPoint {
  if (points.length === 0) return { lat: 24.155, lng: 47.335 };
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), {
    lat: 0,
    lng: 0,
  });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

export function translatePolygon(points: Point[], dx: number, dy: number): Point[] {
  return points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

export function translateGeoPolygon(points: GeoPoint[], dLat: number, dLng: number): GeoPoint[] {
  return points.map((p) => ({ lat: p.lat + dLat, lng: p.lng + dLng }));
}

export function createRectPolygon(cx: number, cy: number, halfW: number, halfH: number): Point[] {
  return [
    { x: Math.round(cx - halfW), y: Math.round(cy - halfH) },
    { x: Math.round(cx + halfW), y: Math.round(cy - halfH) },
    { x: Math.round(cx + halfW), y: Math.round(cy + halfH) },
    { x: Math.round(cx - halfW), y: Math.round(cy + halfH) },
  ];
}

export function createGeoRectPolygon(
  center: GeoPoint,
  halfLat = 0.0012,
  halfLng = 0.0016
): GeoPoint[] {
  return [
    { lat: center.lat + halfLat, lng: center.lng - halfLng },
    { lat: center.lat + halfLat, lng: center.lng + halfLng },
    { lat: center.lat - halfLat, lng: center.lng + halfLng },
    { lat: center.lat - halfLat, lng: center.lng - halfLng },
  ];
}

export function schematicToGeo(
  point: Point,
  center: GeoPoint,
  planHeight = PLAN_DEFAULT_HEIGHT,
  planWidth = PLAN_WIDTH
): GeoPoint {
  const normX = (point.x - planWidth / 2) / planWidth;
  const normY = (point.y - planHeight / 2) / planHeight;
  const latSpan = 0.0055;
  const lngSpan = 0.008;
  return {
    lat: Number((center.lat - normY * latSpan).toFixed(6)),
    lng: Number((center.lng + normX * lngSpan).toFixed(6)),
  };
}

export function geoToSchematic(
  geo: GeoPoint,
  center: GeoPoint,
  planHeight = PLAN_DEFAULT_HEIGHT,
  planWidth = PLAN_WIDTH
): Point {
  const latSpan = 0.0055;
  const lngSpan = 0.008;
  const normX = (geo.lng - center.lng) / lngSpan;
  const normY = (center.lat - geo.lat) / latSpan;
  return {
    x: Math.round(planWidth / 2 + normX * planWidth),
    y: Math.round(planHeight / 2 + normY * planHeight),
  };
}

export function getMidpoints(points: Point[]): Point[] {
  if (points.length < 2) return [];
  return points.map((p, i) => {
    const next = points[(i + 1) % points.length];
    return {
      x: (p.x + next.x) / 2,
      y: (p.y + next.y) / 2,
    };
  });
}

export function getGeoMidpoints(points: GeoPoint[]): GeoPoint[] {
  if (points.length < 2) return [];
  return points.map((p, i) => {
    const next = points[(i + 1) % points.length];
    return {
      lat: (p.lat + next.lat) / 2,
      lng: (p.lng + next.lng) / 2,
    };
  });
}

export function distanceBetweenPoints(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
