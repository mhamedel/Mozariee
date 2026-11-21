import type { Farm, Farmer, Field, GeoPoint, Point, SensorDevice, Zone } from '../types/ghars';
import {
  type BoundingBox,
  boxToRectPolygon,
  boxesOverlap,
  getBoundingBox,
  getPlanHeight,
  getPlanWidth,
  isBoxInsideBox,
  isPointInPolygon,
  partitionBoxIntoSlots,
  remapPointBetweenBoxes,
  schematicToGeo,
} from './geometry';

export const MIN_FARM_WIDTH = 440;
export const MIN_FARM_HEIGHT = 320;
export const MAX_PLAN_WIDTH = 3800;
export const MAX_PLAN_HEIGHT = 2600;

export function makeBox(minX: number, minY: number, maxX: number, maxY: number): BoundingBox {
  const width = Math.max(20, maxX - minX);
  const height = Math.max(20, maxY - minY);
  return {
    minX,
    minY,
    maxX: minX + width,
    maxY: minY + height,
    width,
    height,
    cx: minX + width / 2,
    cy: minY + height / 2,
  };
}

export function ensureMinimumBoxSize(box: BoundingBox, minW: number, minH: number): BoundingBox {
  if (box.width >= minW && box.height >= minH) return box;
  const w = Math.max(minW, box.width);
  const h = Math.max(minH, box.height);
  return makeBox(box.cx - w / 2, box.cy - h / 2, box.cx + w / 2, box.cy + h / 2);
}

export function getFarmerPlanDimensions(farmer: Farmer): { planW: number; planH: number } {
  const planW = getPlanWidth(farmer.planWidth);
  const planH = getPlanHeight(
    farmer.backgroundMode,
    farmer.imageAspectRatio,
    planW,
    farmer.planHeight
  );
  return { planW, planH };
}

export function insetBox(
  box: BoundingBox,
  left: number,
  top: number,
  right: number,
  bottom: number
): BoundingBox {
  const safeLeft = Math.min(left, Math.max(4, box.width * 0.2));
  const safeRight = Math.min(right, Math.max(4, box.width * 0.2));
  const safeTop = Math.min(top, Math.max(4, box.height * 0.25));
  const safeBottom = Math.min(bottom, Math.max(4, box.height * 0.2));
  const minX = Math.min(box.cx - 4, box.minX + safeLeft);
  const minY = Math.min(box.cy - 4, box.minY + safeTop);
  const maxX = Math.min(box.maxX - 4, Math.max(minX + 8, box.maxX - safeRight));
  const maxY = Math.min(box.maxY - 4, Math.max(minY + 8, box.maxY - safeBottom));
  return makeBox(minX, minY, maxX, maxY);
}

export function distanceToBox(pt: Point, box: BoundingBox): number {
  const dx = Math.max(box.minX - pt.x, 0, pt.x - box.maxX);
  const dy = Math.max(box.minY - pt.y, 0, pt.y - box.maxY);
  return Math.hypot(dx, dy);
}

function shiftBoxIntoBounds(box: BoundingBox, bounds: BoundingBox): BoundingBox {
  const w = Math.min(box.width, bounds.width);
  const h = Math.min(box.height, bounds.height);
  const minX = Math.max(bounds.minX, Math.min(bounds.maxX - w, box.minX));
  const minY = Math.max(bounds.minY, Math.min(bounds.maxY - h, box.minY));
  return makeBox(minX, minY, minX + w, minY + h);
}

export function getCanvasSafeBox(farmer: Farmer): BoundingBox {
  const { planW, planH } = getFarmerPlanDimensions(farmer);
  return makeBox(40, 45, planW - 40, planH - 35);
}

export function setFarmerPlanSizeAtLeast(
  farmer: Farmer,
  minPlanW: number,
  minPlanH: number
): boolean {
  const { planW: curW, planH: curH } = getFarmerPlanDimensions(farmer);
  let nextW = Math.min(MAX_PLAN_WIDTH, Math.max(curW, Math.ceil(minPlanW)));
  let nextH: number;

  if (farmer.backgroundMode === 'image') {
    const ratio = farmer.imageAspectRatio > 0.2 && farmer.imageAspectRatio < 5 ? farmer.imageAspectRatio : 1000 / 680;
    const widthNeededForHeight = Math.ceil(minPlanH * ratio);
    nextW = Math.min(MAX_PLAN_WIDTH, Math.max(nextW, widthNeededForHeight));
    nextH = Math.round(nextW / ratio);
  } else {
    nextH = Math.min(MAX_PLAN_HEIGHT, Math.max(curH, Math.ceil(minPlanH)));
  }

  if (nextW > curW || nextH > curH) {
    farmer.planWidth = nextW;
    farmer.planHeight = nextH;
    return true;
  }
  return false;
}

export function ensurePlanCanFitFarmsCount(
  farmer: Farmer,
  count: number,
  gap = 24,
  slotMinW = Math.max(MIN_FARM_WIDTH, 460),
  slotMinH = Math.max(MIN_FARM_HEIGHT, 350)
): boolean {
  if (count <= 0) return false;
  let cols = 1;
  let rows = 1;
  if (count === 2) {
    cols = 2;
    rows = 1;
  } else if (count > 2) {
    cols = Math.min(3, Math.ceil(Math.sqrt(count * 1.25)));
    rows = Math.ceil(count / cols);
  }
  const neededSafeW = cols * slotMinW + Math.max(0, cols - 1) * gap;
  const neededSafeH = rows * slotMinH + Math.max(0, rows - 1) * gap;
  return setFarmerPlanSizeAtLeast(farmer, neededSafeW + 80, neededSafeH + 80);
}

export function remapZoneContents(
  zone: Zone,
  sensors: SensorDevice[],
  fromBox: BoundingBox,
  toBox: BoundingBox,
  geoCenter: GeoPoint,
  planH: number,
  planW?: number
) {
  zone.schematicPoints = zone.schematicPoints.map((p) =>
    remapPointBetweenBoxes(p, fromBox, toBox)
  );
  zone.geoPoints = zone.schematicPoints.map((p) => schematicToGeo(p, geoCenter, planH, planW));

  sensors.forEach((s) => {
    if (s.zoneId === zone.id) {
      s.schematicPos = remapPointBetweenBoxes(s.schematicPos, fromBox, toBox);
      s.geoPos = schematicToGeo(s.schematicPos, geoCenter, planH, planW);
    }
  });
}

export function remapFieldContents(
  field: Field,
  fromBox: BoundingBox,
  toBox: BoundingBox,
  geoCenter: GeoPoint,
  planH: number,
  planW?: number
) {
  field.overviewPoints = field.overviewPoints.map((p) =>
    remapPointBetweenBoxes(p, fromBox, toBox)
  );
  field.geoPoints = field.overviewPoints.map((p) => schematicToGeo(p, geoCenter, planH, planW));

  field.zones.forEach((z) => {
    z.schematicPoints = z.schematicPoints.map((p) =>
      remapPointBetweenBoxes(p, fromBox, toBox)
    );
    z.geoPoints = z.schematicPoints.map((p) => schematicToGeo(p, geoCenter, planH, planW));
  });

  field.sensors.forEach((s) => {
    s.schematicPos = remapPointBetweenBoxes(s.schematicPos, fromBox, toBox);
    s.geoPos = schematicToGeo(s.schematicPos, geoCenter, planH, planW);
  });
}

export function remapFarmContents(
  farm: Farm,
  fromBox: BoundingBox,
  toBox: BoundingBox,
  geoCenter: GeoPoint,
  planH: number,
  planW?: number
) {
  farm.overviewPoints = farm.overviewPoints.map((p) =>
    remapPointBetweenBoxes(p, fromBox, toBox)
  );
  farm.geoPoints = farm.overviewPoints.map((p) => schematicToGeo(p, geoCenter, planH, planW));

  farm.fields.forEach((fl) => {
    remapFieldContents(fl, fromBox, toBox, geoCenter, planH, planW);
  });
}

/**
 * Clamps a box `inner` strictly inside `outer` while guaranteeing `inner` is strictly smaller than `outer`.
 */
function clampBoxStrictlyInside(
  inner: BoundingBox,
  outer: BoundingBox,
  padX = 14,
  padTop = 28,
  padBottom = 14
): BoundingBox {
  const safeOuter = insetBox(outer, padX, padTop, padX, padBottom);
  const targetW = Math.min(inner.width, safeOuter.width);
  const targetH = Math.min(inner.height, safeOuter.height);
  const minX = Math.max(safeOuter.minX, Math.min(safeOuter.maxX - targetW, inner.minX));
  const minY = Math.max(safeOuter.minY, Math.min(safeOuter.maxY - targetH, inner.minY));
  return makeBox(minX, minY, minX + targetW, minY + targetH);
}

/**
 * Enforces strict hierarchy sizing invariant on schematic canvas:
 *   Zone < Field < Farm <= Canvas
 *   and Farm >= MIN_FARM_WIDTH × MIN_FARM_HEIGHT.
 */
export function enforceHierarchyContainmentAndSizes(farmer: Farmer) {
  if (farmer.backgroundMode === 'satellite') return;
  let { planW, planH } = getFarmerPlanDimensions(farmer);

  // First guarantee every farm meets minimum dimensions
  farmer.farms.forEach((farm) => {
    const farmBox = getBoundingBox(farm.overviewPoints);
    if (farmBox.width < MIN_FARM_WIDTH || farmBox.height < MIN_FARM_HEIGHT) {
      const minBox = ensureMinimumBoxSize(farmBox, MIN_FARM_WIDTH, MIN_FARM_HEIGHT);
      remapFarmContents(farm, farmBox, minBox, farmer.geoCenter, planH, planW);
    }
  });

  fitAllFarmsInCanvas(farmer);
  ({ planW, planH } = getFarmerPlanDimensions(farmer));

  farmer.farms.forEach((farm) => {
    const farmBox = getBoundingBox(farm.overviewPoints);
    const farmInner = insetBox(farmBox, 18, 34, 18, 18);

    farm.fields.forEach((field) => {
      const fieldBox = getBoundingBox(field.overviewPoints);

      if (
        !isBoxInsideBox(fieldBox, farmInner, 0) ||
        fieldBox.width >= farmBox.width - 10 ||
        fieldBox.height >= farmBox.height - 10
      ) {
        const clampedField = clampBoxStrictlyInside(fieldBox, farmBox, 18, 34, 18);
        remapFieldContents(field, fieldBox, clampedField, farmer.geoCenter, planH, planW);
      }

      const updatedFieldBox = getBoundingBox(field.overviewPoints);
      const fieldInner = insetBox(updatedFieldBox, 14, 28, 14, 14);

      field.zones.forEach((zone) => {
        const zoneBox = getBoundingBox(zone.schematicPoints);
        if (
          !isBoxInsideBox(zoneBox, fieldInner, 0) ||
          zoneBox.width >= updatedFieldBox.width - 10 ||
          zoneBox.height >= updatedFieldBox.height - 10
        ) {
          const clampedZone = clampBoxStrictlyInside(zoneBox, updatedFieldBox, 14, 28, 14);
          remapZoneContents(zone, field.sensors, zoneBox, clampedZone, farmer.geoCenter, planH, planW);
        }
      });
    });
  });
}

function assignSlotsWithDropCenter<T extends { box: BoundingBox }>(
  slots: BoundingBox[],
  existing: T[],
  dropCenter: Point
): { newItemSlot: BoundingBox; existingAssignments: { item: T; slot: BoundingBox }[] } {
  let bestSlotIdx = 0;
  let bestDist = Infinity;
  slots.forEach((slot, idx) => {
    const d = Math.hypot(slot.cx - dropCenter.x, slot.cy - dropCenter.y);
    if (d < bestDist) {
      bestDist = d;
      bestSlotIdx = idx;
    }
  });

  const newItemSlot = slots[bestSlotIdx];
  const remainingSlots = slots.filter((_, idx) => idx !== bestSlotIdx);

  const usedSlotIndices = new Set<number>();
  const existingAssignments: { item: T; slot: BoundingBox }[] = existing.map((item) => {
    let chosenIdx = 0;
    let minD = Infinity;
    remainingSlots.forEach((slot, sIdx) => {
      if (usedSlotIndices.has(sIdx)) return;
      const d = Math.hypot(slot.cx - item.box.cx, slot.cy - item.box.cy);
      if (d < minD) {
        minD = d;
        chosenIdx = sIdx;
      }
    });
    usedSlotIndices.add(chosenIdx);
    return { item, slot: remainingSlots[chosenIdx] };
  });

  return { newItemSlot, existingAssignments };
}

export function fitAllFarmsInCanvas(farmer: Farmer) {
  if (farmer.backgroundMode === 'satellite' || farmer.farms.length === 0) return;
  let safeBox = getCanvasSafeBox(farmer);
  let { planW, planH } = getFarmerPlanDimensions(farmer);

  const allPts: Point[] = [];
  farmer.farms.forEach((fm) => {
    allPts.push(...fm.overviewPoints);
    fm.fields.forEach((fl) => {
      allPts.push(...fl.overviewPoints);
      fl.zones.forEach((z) => allPts.push(...z.schematicPoints));
    });
  });

  if (allPts.length === 0) return;
  const totalBox = getBoundingBox(allPts);

  if (isBoxInsideBox(totalBox, safeBox, 0)) return;

  const scaleX = safeBox.width / Math.max(1, totalBox.width);
  const scaleY = safeBox.height / Math.max(1, totalBox.height);
  const candidateScale = Math.min(1, scaleX, scaleY);

  // Check if scaling down would force any farm below MIN_FARM_WIDTH × MIN_FARM_HEIGHT
  const minScaleToKeepMinFarms = farmer.farms.reduce((acc, fm) => {
    const b = getBoundingBox(fm.overviewPoints);
    const reqScaleW = MIN_FARM_WIDTH / Math.max(1, b.width);
    const reqScaleH = MIN_FARM_HEIGHT / Math.max(1, b.height);
    return Math.max(acc, reqScaleW, reqScaleH);
  }, 0);

  if (candidateScale < minScaleToKeepMinFarms) {
    // Auto-expand the plan canvas instead of shrinking farms below minimum allowed size
    setFarmerPlanSizeAtLeast(farmer, totalBox.width + 88, totalBox.height + 88);
    safeBox = getCanvasSafeBox(farmer);
    ({ planW, planH } = getFarmerPlanDimensions(farmer));
  }

  const finalScaleX = safeBox.width / Math.max(1, totalBox.width);
  const finalScaleY = safeBox.height / Math.max(1, totalBox.height);
  const scale = Math.min(1, Math.max(minScaleToKeepMinFarms, Math.min(finalScaleX, finalScaleY)), finalScaleX, finalScaleY);

  const targetW = totalBox.width * scale;
  const targetH = totalBox.height * scale;
  const targetMinX =
    totalBox.width <= safeBox.width
      ? Math.max(safeBox.minX, Math.min(safeBox.maxX - targetW, totalBox.minX))
      : safeBox.minX + (safeBox.width - targetW) / 2;
  const targetMinY =
    totalBox.height <= safeBox.height
      ? Math.max(safeBox.minY, Math.min(safeBox.maxY - targetH, totalBox.minY))
      : safeBox.minY + (safeBox.height - targetH) / 2;

  const targetBox = makeBox(targetMinX, targetMinY, targetMinX + targetW, targetMinY + targetH);

  farmer.farms.forEach((fm) => {
    remapFarmContents(fm, totalBox, targetBox, farmer.geoCenter, planH, planW);
  });
}

function findNonOverlappingSlotInExpandedPlan(
  existingBoxes: BoundingBox[],
  slotW: number,
  slotH: number,
  gap = 28
): BoundingBox {
  const maxRightLimit = 1750;
  // Place to the right of the top/last row if within reasonable horizontal spread, else start a new row below
  let maxRowY = 45;
  let rightMostOnLastRow = 40;

  if (existingBoxes.length > 0) {
    // Sort top-to-bottom by minY
    const sorted = [...existingBoxes].sort((a, b) => a.minY - b.minY);
    const lastRowAnchorY = sorted[sorted.length - 1].minY;
    const lastRowBoxes = existingBoxes.filter((b) => Math.abs(b.minY - lastRowAnchorY) < slotH * 0.65);
    maxRowY = Math.min(...lastRowBoxes.map((b) => b.minY));
    rightMostOnLastRow = Math.max(...lastRowBoxes.map((b) => b.maxX));

    const candRight = makeBox(
      rightMostOnLastRow + gap,
      maxRowY,
      rightMostOnLastRow + gap + slotW,
      maxRowY + slotH
    );

    const overlapsRight = existingBoxes.some((b) => boxesOverlap(candRight, b, 18));
    if (!overlapsRight && candRight.maxX + 40 <= maxRightLimit) {
      return candRight;
    }

    const totalMaxY = Math.max(...existingBoxes.map((b) => b.maxY));
    const candBelow = makeBox(40, totalMaxY + gap, 40 + slotW, totalMaxY + gap + slotH);
    if (!existingBoxes.some((b) => boxesOverlap(candBelow, b, 18))) {
      return candBelow;
    }

    const totalMaxX = Math.max(...existingBoxes.map((b) => b.maxX));
    return makeBox(totalMaxX + gap, 45, totalMaxX + gap + slotW, 45 + slotH);
  }

  return makeBox(40, 45, 40 + slotW, 45 + slotH);
}

export function layoutNewFarmOnCanvas(
  farmer: Farmer,
  proposedPoints: Point[],
  preserveShape = false
): { farmPoints: Point[]; resizedExisting: boolean; expandedPlan: boolean } {
  let safeBox = getCanvasSafeBox(farmer);
  const rawProposedBox = getBoundingBox(proposedPoints);
  const minProposedBox = ensureMinimumBoxSize(rawProposedBox, MIN_FARM_WIDTH, MIN_FARM_HEIGHT);

  const shiftPoints = (pts: Point[], from: BoundingBox, to: BoundingBox) =>
    pts.map((p) => remapPointBetweenBoxes(p, from, to));

  const sizedPoints =
    minProposedBox.width === rawProposedBox.width && minProposedBox.height === rawProposedBox.height
      ? proposedPoints
      : shiftPoints(proposedPoints, rawProposedBox, minProposedBox);

  if (farmer.farms.length === 0) {
    let expandedPlan = false;
    if (!isBoxInsideBox(minProposedBox, safeBox, 0)) {
      if (minProposedBox.width > safeBox.width || minProposedBox.height > safeBox.height) {
        expandedPlan = setFarmerPlanSizeAtLeast(
          farmer,
          minProposedBox.width + 88,
          minProposedBox.height + 88
        );
        safeBox = getCanvasSafeBox(farmer);
      }
      const shiftedBox = shiftBoxIntoBounds(minProposedBox, safeBox);
      return {
        farmPoints: preserveShape
          ? shiftPoints(sizedPoints, minProposedBox, shiftedBox)
          : boxToRectPolygon(shiftedBox),
        resizedExisting: false,
        expandedPlan,
      };
    }
    return { farmPoints: sizedPoints, resizedExisting: false, expandedPlan: false };
  }

  // Check if minProposedBox already fits inside current safeBox without overlapping existing farms
  const fitsCurrentSafe = isBoxInsideBox(minProposedBox, safeBox, 0);
  const shiftedBox = shiftBoxIntoBounds(minProposedBox, safeBox);
  const canFitShiftedInCurrent =
    shiftedBox.width >= MIN_FARM_WIDTH &&
    shiftedBox.height >= MIN_FARM_HEIGHT &&
    !farmer.farms.some((fm) => boxesOverlap(shiftedBox, getBoundingBox(fm.overviewPoints), 16));

  if (fitsCurrentSafe && !farmer.farms.some((fm) => boxesOverlap(minProposedBox, getBoundingBox(fm.overviewPoints), 16))) {
    return { farmPoints: sizedPoints, resizedExisting: false, expandedPlan: false };
  }
  if (canFitShiftedInCurrent) {
    return {
      farmPoints: preserveShape
        ? shiftPoints(sizedPoints, minProposedBox, shiftedBox)
        : boxToRectPolygon(shiftedBox),
      resizedExisting: false,
      expandedPlan: false,
    };
  }

  // Automatically expand the plan canvas so the new farm gets full space (>= MIN_FARM_WIDTH × MIN_FARM_HEIGHT)
  // without shrinking existing farms!
  const existingBoxes = farmer.farms.map((fm) => getBoundingBox(fm.overviewPoints));
  const targetSlotW = Math.max(MIN_FARM_WIDTH, Math.min(540, minProposedBox.width));
  const targetSlotH = Math.max(MIN_FARM_HEIGHT, Math.min(420, minProposedBox.height));
  const newSlot = findNonOverlappingSlotInExpandedPlan(existingBoxes, targetSlotW, targetSlotH, 28);

  const expandedPlan = setFarmerPlanSizeAtLeast(farmer, newSlot.maxX + 44, newSlot.maxY + 44);
  safeBox = getCanvasSafeBox(farmer);

  if (isBoxInsideBox(newSlot, safeBox, 0)) {
    return {
      farmPoints: preserveShape
        ? shiftPoints(sizedPoints, minProposedBox, newSlot)
        : boxToRectPolygon(newSlot),
      resizedExisting: false,
      expandedPlan,
    };
  }

  // Fallback if MAX_PLAN_WIDTH / MAX_PLAN_HEIGHT reached: partition slots cleanly
  const { planW, planH } = getFarmerPlanDimensions(farmer);
  const existing = farmer.farms.map((fm) => ({
    farm: fm,
    box: getBoundingBox(fm.overviewPoints),
  }));
  const slots = partitionBoxIntoSlots(safeBox, existing.length + 1, 20, true);
  const { newItemSlot, existingAssignments } = assignSlotsWithDropCenter(slots, existing, {
    x: minProposedBox.cx,
    y: minProposedBox.cy,
  });
  existingAssignments.forEach(({ item, slot }) => {
    remapFarmContents(item.farm, item.box, slot, farmer.geoCenter, planH, planW);
  });

  return {
    farmPoints: preserveShape
      ? shiftPoints(sizedPoints, minProposedBox, newItemSlot)
      : boxToRectPolygon(newItemSlot),
    resizedExisting: true,
    expandedPlan,
  };
}

export function layoutNewFieldInFarm(
  farmer: Farmer,
  parentFarm: Farm,
  proposedPoints: Point[],
  preserveShape = false
): { fieldPoints: Point[]; resizedExisting: boolean } {
  const safeBox = getCanvasSafeBox(farmer);
  const maxFieldCanvasBox = insetBox(safeBox, 20, 34, 20, 20);
  const { planW, planH } = getFarmerPlanDimensions(farmer);

  const rawProposedBox = getBoundingBox(proposedPoints);
  const proposedBox = isBoxInsideBox(rawProposedBox, maxFieldCanvasBox, 0)
    ? rawProposedBox
    : shiftBoxIntoBounds(rawProposedBox, maxFieldCanvasBox);
  const candidatePoints =
    proposedBox === rawProposedBox
      ? proposedPoints
      : proposedPoints.map((p) => remapPointBetweenBoxes(p, rawProposedBox, proposedBox));

  let farmBox = getBoundingBox(parentFarm.overviewPoints);
  let farmInner = insetBox(farmBox, 20, 34, 20, 20);

  const fitsInFarm = isBoxInsideBox(proposedBox, farmInner, 0);
  const overlapsSibling = parentFarm.fields.some((fl) =>
    boxesOverlap(proposedBox, getBoundingBox(fl.overviewPoints), 12)
  );

  if (fitsInFarm && !overlapsSibling) {
    return { fieldPoints: candidatePoints, resizedExisting: false };
  }

  // Case 1: Dropped in empty space outside parentFarm (or parentFarm is too small)
  // First try expanding parentFarm directly to wrap existing farmBox + new proposedBox!
  if (!fitsInFarm) {
    const neededFarmBox = makeBox(
      Math.max(safeBox.minX, Math.min(farmBox.minX, proposedBox.minX - 20)),
      Math.max(safeBox.minY, Math.min(farmBox.minY, proposedBox.minY - 34)),
      Math.min(safeBox.maxX, Math.max(farmBox.maxX, proposedBox.maxX + 20)),
      Math.min(safeBox.maxY, Math.max(farmBox.maxY, proposedBox.maxY + 20))
    );

    const overlapsOtherFarm = farmer.farms.some(
      (fm) => fm.id !== parentFarm.id && boxesOverlap(neededFarmBox, getBoundingBox(fm.overviewPoints), 14)
    );

    if (!overlapsOtherFarm) {
      parentFarm.overviewPoints = boxToRectPolygon(neededFarmBox);
      parentFarm.geoPoints = parentFarm.overviewPoints.map((p) =>
        schematicToGeo(p, farmer.geoCenter, planH, planW)
      );
      farmBox = neededFarmBox;
      farmInner = insetBox(farmBox, 20, 34, 20, 20);

      const overlapsInExpanded = parentFarm.fields.some((fl) =>
        boxesOverlap(proposedBox, getBoundingBox(fl.overviewPoints), 12)
      );
      if (isBoxInsideBox(proposedBox, farmInner, 0) && !overlapsInExpanded) {
        return { fieldPoints: candidatePoints, resizedExisting: true };
      }
    } else {
      // Rebalance all farms on canvas so parentFarm gets room cleanly without overlapping other farms
      ensurePlanCanFitFarmsCount(farmer, farmer.farms.length, 24, MIN_FARM_WIDTH, MIN_FARM_HEIGHT);
      const updatedSafe = getCanvasSafeBox(farmer);
      const { planW: nextW, planH: nextH } = getFarmerPlanDimensions(farmer);
      const existingFarms = farmer.farms.map((fm) => ({
        farm: fm,
        box: getBoundingBox(fm.overviewPoints),
      }));
      const farmSlots = partitionBoxIntoSlots(updatedSafe, existingFarms.length, 20, true);
      existingFarms.forEach((ef, idx) => {
        if (ef.farm.id !== parentFarm.id) {
          remapFarmContents(ef.farm, ef.box, farmSlots[idx], farmer.geoCenter, nextH, nextW);
        } else {
          ef.farm.overviewPoints = boxToRectPolygon(farmSlots[idx]);
          ef.farm.geoPoints = ef.farm.overviewPoints.map((p) =>
            schematicToGeo(p, farmer.geoCenter, nextH, nextW)
          );
          farmBox = farmSlots[idx];
          farmInner = insetBox(farmBox, 20, 34, 20, 20);
        }
      });
    }
  }

  const { planW: curW, planH: curH } = getFarmerPlanDimensions(farmer);

  // Case 2: Repartition fields inside updated parentFarm.farmInner
  const existingFields = parentFarm.fields.map((fl) => ({
    field: fl,
    box: getBoundingBox(fl.overviewPoints),
  }));

  if (existingFields.length === 0) {
    return {
      fieldPoints: preserveShape
        ? candidatePoints.map((p) => remapPointBetweenBoxes(p, proposedBox, farmInner))
        : boxToRectPolygon(farmInner),
      resizedExisting: true,
    };
  }

  const slots = partitionBoxIntoSlots(farmInner, existingFields.length + 1, 16, true);
  const { newItemSlot, existingAssignments } = assignSlotsWithDropCenter(slots, existingFields, {
    x: proposedBox.cx,
    y: proposedBox.cy,
  });

  existingAssignments.forEach(({ item, slot }) => {
    remapFieldContents(item.field, item.box, slot, farmer.geoCenter, curH, curW);
  });

  return {
    fieldPoints: preserveShape
      ? candidatePoints.map((p) => remapPointBetweenBoxes(p, proposedBox, newItemSlot))
      : boxToRectPolygon(newItemSlot),
    resizedExisting: true,
  };
}

export function layoutNewZoneInField(
  farmer: Farmer,
  parentFarm: Farm,
  parentField: Field,
  proposedPoints: Point[],
  preserveShape = false
): { zonePoints: Point[]; resizedExisting: boolean } {
  const safeBox = getCanvasSafeBox(farmer);
  const maxFieldCanvasBox = insetBox(safeBox, 20, 34, 20, 20);
  const maxZoneCanvasBox = insetBox(maxFieldCanvasBox, 14, 28, 14, 14);
  const { planW, planH } = getFarmerPlanDimensions(farmer);

  const rawProposedBox = getBoundingBox(proposedPoints);
  const proposedBox = isBoxInsideBox(rawProposedBox, maxZoneCanvasBox, 0)
    ? rawProposedBox
    : shiftBoxIntoBounds(rawProposedBox, maxZoneCanvasBox);
  const candidatePoints =
    proposedBox === rawProposedBox
      ? proposedPoints
      : proposedPoints.map((p) => remapPointBetweenBoxes(p, rawProposedBox, proposedBox));

  let fieldBox = getBoundingBox(parentField.overviewPoints);
  let fieldInner = insetBox(fieldBox, 14, 28, 14, 14);

  const fitsInField = isBoxInsideBox(proposedBox, fieldInner, 0);
  const overlapsSibling = parentField.zones.some((z) =>
    boxesOverlap(proposedBox, getBoundingBox(z.schematicPoints), 10)
  );

  if (fitsInField && !overlapsSibling) {
    return { zonePoints: candidatePoints, resizedExisting: false };
  }

  // Case 1: Dropped in empty space outside parentField (and possibly outside parentFarm!)
  if (!fitsInField) {
    let neededFieldBox = makeBox(
      Math.max(maxFieldCanvasBox.minX, Math.min(fieldBox.minX, proposedBox.minX - 14)),
      Math.max(maxFieldCanvasBox.minY, Math.min(fieldBox.minY, proposedBox.minY - 28)),
      Math.min(maxFieldCanvasBox.maxX, Math.max(fieldBox.maxX, proposedBox.maxX + 14)),
      Math.min(maxFieldCanvasBox.maxY, Math.max(fieldBox.maxY, proposedBox.maxY + 14))
    );

    // Ensure parentFarm wraps neededFieldBox + farm padding
    let farmBox = getBoundingBox(parentFarm.overviewPoints);
    let farmInner = insetBox(farmBox, 20, 34, 20, 20);

    if (!isBoxInsideBox(neededFieldBox, farmInner, 0)) {
      const neededFarmBox = makeBox(
        Math.max(safeBox.minX, Math.min(farmBox.minX, neededFieldBox.minX - 20)),
        Math.max(safeBox.minY, Math.min(farmBox.minY, neededFieldBox.minY - 34)),
        Math.min(safeBox.maxX, Math.max(farmBox.maxX, neededFieldBox.maxX + 20)),
        Math.min(safeBox.maxY, Math.max(farmBox.maxY, neededFieldBox.maxY + 20))
      );

      const overlapsOtherFarm = farmer.farms.some(
        (fm) => fm.id !== parentFarm.id && boxesOverlap(neededFarmBox, getBoundingBox(fm.overviewPoints), 14)
      );

      if (!overlapsOtherFarm) {
        parentFarm.overviewPoints = boxToRectPolygon(neededFarmBox);
        parentFarm.geoPoints = parentFarm.overviewPoints.map((p) =>
          schematicToGeo(p, farmer.geoCenter, planH, planW)
        );
        farmBox = neededFarmBox;
        farmInner = insetBox(farmBox, 20, 34, 20, 20);
      } else {
        // Rebalance farms cleanly within canvas without breaking minimum farm sizes
        ensurePlanCanFitFarmsCount(farmer, farmer.farms.length, 24, MIN_FARM_WIDTH, MIN_FARM_HEIGHT);
        const updatedSafe = getCanvasSafeBox(farmer);
        const { planW: nextW, planH: nextH } = getFarmerPlanDimensions(farmer);
        const existingFarms = farmer.farms.map((fm) => ({
          farm: fm,
          box: getBoundingBox(fm.overviewPoints),
        }));
        const farmSlots = partitionBoxIntoSlots(updatedSafe, existingFarms.length, 20, true);
        existingFarms.forEach((ef, idx) => {
          if (ef.farm.id !== parentFarm.id) {
            remapFarmContents(ef.farm, ef.box, farmSlots[idx], farmer.geoCenter, nextH, nextW);
          } else {
            ef.farm.overviewPoints = boxToRectPolygon(farmSlots[idx]);
            ef.farm.geoPoints = ef.farm.overviewPoints.map((p) =>
              schematicToGeo(p, farmer.geoCenter, nextH, nextW)
            );
            farmBox = farmSlots[idx];
            farmInner = insetBox(farmBox, 20, 34, 20, 20);
          }
        });
        neededFieldBox = clampBoxStrictlyInside(neededFieldBox, farmBox, 20, 34, 20);
      }
    }

    const { planW: curW, planH: curH } = getFarmerPlanDimensions(farmer);

    // Expand parentField inside farmInner (rebalancing sibling fields only if needed)
    const overlapsOtherField = parentFarm.fields.some(
      (fl) =>
        fl.id !== parentField.id && boxesOverlap(neededFieldBox, getBoundingBox(fl.overviewPoints), 12)
    );

    if (isBoxInsideBox(neededFieldBox, farmInner, 0) && !overlapsOtherField) {
      parentField.overviewPoints = boxToRectPolygon(neededFieldBox);
      parentField.geoPoints = parentField.overviewPoints.map((p) =>
        schematicToGeo(p, farmer.geoCenter, curH, curW)
      );
      fieldBox = neededFieldBox;
      fieldInner = insetBox(fieldBox, 14, 28, 14, 14);
    } else if (parentFarm.fields.length === 1) {
      parentField.overviewPoints = boxToRectPolygon(farmInner);
      parentField.geoPoints = parentField.overviewPoints.map((p) =>
        schematicToGeo(p, farmer.geoCenter, curH, curW)
      );
      fieldBox = farmInner;
      fieldInner = insetBox(fieldBox, 14, 28, 14, 14);
    } else {
      const fSlots = partitionBoxIntoSlots(farmInner, parentFarm.fields.length, 16, true);
      const otherFields = parentFarm.fields
        .filter((fl) => fl.id !== parentField.id)
        .map((fl) => ({ field: fl, box: getBoundingBox(fl.overviewPoints) }));
      const { newItemSlot: parentFieldSlot, existingAssignments: fieldAssignments } =
        assignSlotsWithDropCenter(fSlots, otherFields, {
          x: neededFieldBox.cx,
          y: neededFieldBox.cy,
        });
      parentField.overviewPoints = boxToRectPolygon(parentFieldSlot);
      parentField.geoPoints = parentField.overviewPoints.map((p) =>
        schematicToGeo(p, farmer.geoCenter, curH, curW)
      );
      fieldAssignments.forEach(({ item, slot }) => {
        remapFieldContents(item.field, item.box, slot, farmer.geoCenter, curH, curW);
      });
      fieldBox = parentFieldSlot;
      fieldInner = insetBox(fieldBox, 14, 28, 14, 14);
    }

    const overlapsAfterExpand = parentField.zones.some((z) =>
      boxesOverlap(proposedBox, getBoundingBox(z.schematicPoints), 10)
    );
    if (isBoxInsideBox(proposedBox, fieldInner, 0) && !overlapsAfterExpand) {
      return { zonePoints: candidatePoints, resizedExisting: true };
    }
  }

  const { planW: curW, planH: curH } = getFarmerPlanDimensions(farmer);

  // Case 2: Repartition zones cleanly inside updated parentField.fieldInner
  const existingZones = parentField.zones.map((z) => ({
    zone: z,
    box: getBoundingBox(z.schematicPoints),
  }));

  if (existingZones.length === 0) {
    return {
      zonePoints: preserveShape
        ? candidatePoints.map((p) => remapPointBetweenBoxes(p, proposedBox, fieldInner))
        : boxToRectPolygon(fieldInner),
      resizedExisting: true,
    };
  }

  const slots = partitionBoxIntoSlots(fieldInner, existingZones.length + 1, 12, true);
  const { newItemSlot, existingAssignments } = assignSlotsWithDropCenter(slots, existingZones, {
    x: proposedBox.cx,
    y: proposedBox.cy,
  });

  existingAssignments.forEach(({ item, slot }) => {
    remapZoneContents(item.zone, parentField.sensors, item.box, slot, farmer.geoCenter, curH, curW);
  });

  return {
    zonePoints: preserveShape
      ? candidatePoints.map((p) => remapPointBetweenBoxes(p, proposedBox, newItemSlot))
      : boxToRectPolygon(newItemSlot),
    resizedExisting: true,
  };
}

/**
 * Called right after dragging/repositioning an existing Farm, Field, or Zone on the schematic canvas:
 * - Resolves overlaps or out-of-bounds drops by resizing/repacking affected elements.
 * - Handles moving a Zone into another Field OR onto open canvas space (expanding/rebalancing parent Field/Farm so Zone < Field < Farm always holds!).
 * - Handles moving a Field into another Farm OR overlapping sibling Fields.
 * - Handles moving a Farm overlapping sibling Farms or canvas edges.
 */
export function reflowAfterBoundaryMove(
  farmer: Farmer,
  movedTarget:
    | { kind: 'farm'; farmId: string }
    | { kind: 'field'; farmId: string; fieldId: string }
    | { kind: 'zone'; farmId: string; fieldId: string; zoneId: string }
): { adjusted: boolean; newSelection?: { kind: 'farm' | 'field' | 'zone'; farmId: string; fieldId?: string; zoneId?: string } } {
  if (farmer.backgroundMode === 'satellite') return { adjusted: false };
  let safeBox = getCanvasSafeBox(farmer);
  let { planW, planH } = getFarmerPlanDimensions(farmer);
  let adjusted = false;

  if (movedTarget.kind === 'farm') {
    const movedFarm = farmer.farms.find((fm) => fm.id === movedTarget.farmId);
    if (!movedFarm) return { adjusted: false };

    const movedBox = getBoundingBox(movedFarm.overviewPoints);
    const overflows = !isBoxInsideBox(movedBox, safeBox, 0);
    const overlaps = farmer.farms.some(
      (fm) => fm.id !== movedFarm.id && boxesOverlap(movedBox, getBoundingBox(fm.overviewPoints), 14)
    );

    if (overflows || overlaps) {
      if (farmer.farms.length === 1) {
        fitAllFarmsInCanvas(farmer);
      } else {
        ensurePlanCanFitFarmsCount(farmer, farmer.farms.length, 24, MIN_FARM_WIDTH, MIN_FARM_HEIGHT);
        safeBox = getCanvasSafeBox(farmer);
        ({ planW, planH } = getFarmerPlanDimensions(farmer));
        const allItems = farmer.farms.map((fm) => ({
          farm: fm,
          box: getBoundingBox(fm.overviewPoints),
        }));
        const slots = partitionBoxIntoSlots(safeBox, allItems.length, 20, true);
        // Place moved farm into slot closest to its drop center
        const others = allItems.filter((x) => x.farm.id !== movedFarm.id);
        const { newItemSlot, existingAssignments } = assignSlotsWithDropCenter(slots, others, {
          x: movedBox.cx,
          y: movedBox.cy,
        });
        remapFarmContents(movedFarm, movedBox, newItemSlot, farmer.geoCenter, planH, planW);
        existingAssignments.forEach(({ item, slot }) => {
          remapFarmContents(item.farm, item.box, slot, farmer.geoCenter, planH, planW);
        });
      }
      adjusted = true;
    }
    enforceHierarchyContainmentAndSizes(farmer);
    return { adjusted };
  }

  if (movedTarget.kind === 'field') {
    const oldFarm = farmer.farms.find((fm) => fm.id === movedTarget.farmId);
    const movedField = oldFarm?.fields.find((fl) => fl.id === movedTarget.fieldId);
    if (!oldFarm || !movedField) return { adjusted: false };

    const movedBox = getBoundingBox(movedField.overviewPoints);
    const center = { x: movedBox.cx, y: movedBox.cy };

    // Did user move this Field into another Farm?
    let targetFarm =
      farmer.farms.find((fm) => isPointInPolygon(center, fm.overviewPoints)) ?? oldFarm;

    if (targetFarm.id !== oldFarm.id) {
      oldFarm.fields = oldFarm.fields.filter((fl) => fl.id !== movedField.id);
      movedField.farmId = targetFarm.id;
      movedField.sensors.forEach((s) => {
        s.farmId = targetFarm.id;
      });
      targetFarm.fields.push(movedField);
      adjusted = true;
    }

    const farmBox = getBoundingBox(targetFarm.overviewPoints);
    const farmInner = insetBox(farmBox, 20, 34, 20, 20);
    const outsideFarm = !isBoxInsideBox(movedBox, farmInner, 0);
    const overlapsSibling = targetFarm.fields.some(
      (fl) => fl.id !== movedField.id && boxesOverlap(movedBox, getBoundingBox(fl.overviewPoints), 12)
    );

    if (outsideFarm || overlapsSibling) {
      if (targetFarm.fields.length === 1) {
        const clamped = clampBoxStrictlyInside(movedBox, farmBox, 20, 34, 20);
        remapFieldContents(movedField, movedBox, clamped, farmer.geoCenter, planH, planW);
      } else {
        const others = targetFarm.fields
          .filter((fl) => fl.id !== movedField.id)
          .map((fl) => ({ field: fl, box: getBoundingBox(fl.overviewPoints) }));
        const slots = partitionBoxIntoSlots(farmInner, targetFarm.fields.length, 16, true);
        const { newItemSlot, existingAssignments } = assignSlotsWithDropCenter(
          slots,
          others,
          center
        );
        remapFieldContents(movedField, movedBox, newItemSlot, farmer.geoCenter, planH, planW);
        existingAssignments.forEach(({ item, slot }) => {
          remapFieldContents(item.field, item.box, slot, farmer.geoCenter, planH, planW);
        });
      }
      adjusted = true;
    }

    enforceHierarchyContainmentAndSizes(farmer);
    return {
      adjusted,
      newSelection: { kind: 'field', farmId: targetFarm.id, fieldId: movedField.id },
    };
  }

  // movedTarget.kind === 'zone'
  const oldFarm = farmer.farms.find((fm) => fm.id === movedTarget.farmId);
  const oldField = oldFarm?.fields.find((fl) => fl.id === movedTarget.fieldId);
  const movedZone = oldField?.zones.find((z) => z.id === movedTarget.zoneId);
  if (!oldFarm || !oldField || !movedZone) return { adjusted: false };

  const movedBox = getBoundingBox(movedZone.schematicPoints);
  const center = { x: movedBox.cx, y: movedBox.cy };

  // Check if Zone was dragged onto another Field!
  let targetFarm = oldFarm;
  let targetField = oldField;
  for (const fm of farmer.farms) {
    const fl = fm.fields.find((f) => isPointInPolygon(center, f.overviewPoints));
    if (fl) {
      targetFarm = fm;
      targetField = fl;
      break;
    }
  }

  if (targetField.id !== oldField.id) {
    // Transfer Zone and its Sensors to the new Field
    oldField.zones = oldField.zones.filter((z) => z.id !== movedZone.id);
    const movingSensors = oldField.sensors.filter((s) => s.zoneId === movedZone.id);
    oldField.sensors = oldField.sensors.filter((s) => s.zoneId !== movedZone.id);
    movingSensors.forEach((s) => {
      s.farmId = targetFarm.id;
      s.fieldId = targetField.id;
    });
    targetField.zones.push(movedZone);
    targetField.sensors.push(...movingSensors);
    adjusted = true;
  }

  let fieldBox = getBoundingBox(targetField.overviewPoints);
  let fieldInner = insetBox(fieldBox, 14, 28, 14, 14);
  const outsideField = !isBoxInsideBox(movedBox, fieldInner, 0);
  const overlapsSibling = targetField.zones.some(
    (z) => z.id !== movedZone.id && boxesOverlap(movedBox, getBoundingBox(z.schematicPoints), 10)
  );

  if (outsideField || overlapsSibling) {
    if (outsideField) {
      const unionMinX = Math.max(safeBox.minX + 20, Math.min(fieldBox.minX, movedBox.minX - 18));
      const unionMinY = Math.max(safeBox.minY + 34, Math.min(fieldBox.minY, movedBox.minY - 32));
      const unionMaxX = Math.min(safeBox.maxX - 20, Math.max(fieldBox.maxX, movedBox.maxX + 18));
      const unionMaxY = Math.min(safeBox.maxY - 20, Math.max(fieldBox.maxY, movedBox.maxY + 18));
      const expandedFieldBox = makeBox(unionMinX, unionMinY, unionMaxX, unionMaxY);

      const farmBox = getBoundingBox(targetFarm.overviewPoints);
      if (!isBoxInsideBox(expandedFieldBox, insetBox(farmBox, 18, 34, 18, 18), 0)) {
        const nextFarmBox = makeBox(
          Math.max(safeBox.minX, Math.min(farmBox.minX, expandedFieldBox.minX - 20)),
          Math.max(safeBox.minY, Math.min(farmBox.minY, expandedFieldBox.minY - 36)),
          Math.min(safeBox.maxX, Math.max(farmBox.maxX, expandedFieldBox.maxX + 20)),
          Math.min(safeBox.maxY, Math.max(farmBox.maxY, expandedFieldBox.maxY + 20))
        );
        targetFarm.overviewPoints = boxToRectPolygon(nextFarmBox);
        targetFarm.geoPoints = targetFarm.overviewPoints.map((p) =>
          schematicToGeo(p, farmer.geoCenter, planH, planW)
        );
      }

      targetField.overviewPoints = boxToRectPolygon(expandedFieldBox);
      targetField.geoPoints = targetField.overviewPoints.map((p) =>
        schematicToGeo(p, farmer.geoCenter, planH, planW)
      );

      if (targetFarm.fields.length > 1) {
        const updatedFarmBox = getBoundingBox(targetFarm.overviewPoints);
        const farmInner = insetBox(updatedFarmBox, 20, 34, 20, 20);
        const fHasOverlap = targetFarm.fields.some(
          (fl) =>
            fl.id !== targetField.id &&
            boxesOverlap(expandedFieldBox, getBoundingBox(fl.overviewPoints), 12)
        );
        if (fHasOverlap) {
          const fOthers = targetFarm.fields
            .filter((fl) => fl.id !== targetField.id)
            .map((fl) => ({ field: fl, box: getBoundingBox(fl.overviewPoints) }));
          const fSlots = partitionBoxIntoSlots(farmInner, targetFarm.fields.length, 16, true);
          const { newItemSlot, existingAssignments } = assignSlotsWithDropCenter(
            fSlots,
            fOthers,
            { x: expandedFieldBox.cx, y: expandedFieldBox.cy }
          );
          remapFieldContents(
            targetField,
            expandedFieldBox,
            newItemSlot,
            farmer.geoCenter,
            planH,
            planW
          );
          existingAssignments.forEach(({ item, slot }) => {
            remapFieldContents(item.field, item.box, slot, farmer.geoCenter, planH, planW);
          });
        }
      }

      fieldBox = getBoundingBox(targetField.overviewPoints);
      fieldInner = insetBox(fieldBox, 14, 28, 14, 14);
    }

    const curMovedBox = getBoundingBox(movedZone.schematicPoints);
    const curCenter = { x: curMovedBox.cx, y: curMovedBox.cy };
    const stillOutside = !isBoxInsideBox(curMovedBox, fieldInner, 0);
    const stillOverlaps = targetField.zones.some(
      (z) => z.id !== movedZone.id && boxesOverlap(curMovedBox, getBoundingBox(z.schematicPoints), 10)
    );

    if (stillOutside || stillOverlaps) {
      if (targetField.zones.length === 1) {
        const clamped = clampBoxStrictlyInside(curMovedBox, fieldBox, 14, 28, 14);
        remapZoneContents(
          movedZone,
          targetField.sensors,
          curMovedBox,
          clamped,
          farmer.geoCenter,
          planH,
          planW
        );
      } else {
        const zOthers = targetField.zones
          .filter((z) => z.id !== movedZone.id)
          .map((z) => ({ zone: z, box: getBoundingBox(z.schematicPoints) }));
        const zSlots = partitionBoxIntoSlots(fieldInner, targetField.zones.length, 12, true);
        const { newItemSlot, existingAssignments } = assignSlotsWithDropCenter(
          zSlots,
          zOthers,
          curCenter
        );
        remapZoneContents(
          movedZone,
          targetField.sensors,
          curMovedBox,
          newItemSlot,
          farmer.geoCenter,
          planH,
          planW
        );
        existingAssignments.forEach(({ item, slot }) => {
          remapZoneContents(
            item.zone,
            targetField.sensors,
            item.box,
            slot,
            farmer.geoCenter,
            planH,
            planW
          );
        });
      }
    }
    adjusted = true;
  }

  enforceHierarchyContainmentAndSizes(farmer);
  return {
    adjusted,
    newSelection: {
      kind: 'zone',
      farmId: targetFarm.id,
      fieldId: targetField.id,
      zoneId: movedZone.id,
    },
  };
}
