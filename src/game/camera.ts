import { MAP_HEIGHT, MAP_WIDTH } from './constants';
import type { CameraBox, CameraState, Point } from './types';
import { clamp, lerp } from '@/utils/math';

const DEFAULT_VIEWPORT = {
  width: 844,
  height: 390,
};

const CAMERA_ZOOM = 1.62;
const CAMERA_Y_SCALE = 0.66;
const CAMERA_SKEW_X = -0.02;
const CAMERA_LERP = 6.2;
const CAMERA_DEAD_ZONE = 10;
const CAMERA_ANCHOR_X = 0.5;
const CAMERA_ANCHOR_Y = 0.54;
const CAMERA_MIN_ZOOM = 0.56;
const CAMERA_MAX_ZOOM = 2.2;

export function createInitialCamera(target: Point, viewport = DEFAULT_VIEWPORT): CameraState {
  return clampCamera({
    center: { ...target },
    lastTarget: { ...target },
    width: viewport.width,
    height: viewport.height,
    zoom: CAMERA_ZOOM,
    yScale: CAMERA_Y_SCALE,
    skewX: CAMERA_SKEW_X,
    anchorX: CAMERA_ANCHOR_X,
    anchorY: CAMERA_ANCHOR_Y,
  });
}

export function updateCamera(
  camera: CameraState,
  target: Point,
  viewport: { width: number; height: number },
  dt: number,
): CameraState {
  const stableTarget = getCameraTarget(camera, target);

  const desired = clampCamera({
    ...camera,
    width: viewport.width,
    height: viewport.height,
    center: stableTarget,
    lastTarget: { ...target },
  });

  const t = 1 - Math.exp(-CAMERA_LERP * Math.min(dt, 0.05));

  return clampCamera({
    ...desired,
    center: {
      x: lerp(camera.center.x, desired.center.x, t),
      y: lerp(camera.center.y, desired.center.y, t),
    },
  });
}

export function getCameraTarget(camera: CameraState, playerPosition: Point): Point {
  const dx = playerPosition.x - camera.center.x;
  const dy = playerPosition.y - camera.center.y;

  if (Math.hypot(dx, dy) < CAMERA_DEAD_ZONE) {
    return camera.center;
  }

  return { ...playerPosition };
}

export function worldToScreen(camera: CameraState, point: Point): Point {
  const dx = point.x - camera.center.x;
  const dy = point.y - camera.center.y;

  return {
    x: dx * camera.zoom + dy * camera.skewX * camera.zoom + camera.width * camera.anchorX,
    y: dy * camera.zoom * camera.yScale + camera.height * camera.anchorY,
  };
}

export function screenToWorld(camera: CameraState, point: Point): Point {
  const dy = (point.y - camera.height * camera.anchorY) / (camera.zoom * camera.yScale);
  const dx = (point.x - camera.width * camera.anchorX) / camera.zoom - dy * camera.skewX;

  return {
    x: camera.center.x + dx,
    y: camera.center.y + dy,
  };
}

export function projectedScale(camera: CameraState) {
  return camera.zoom;
}

export function setCameraZoom(camera: CameraState, zoom: number): CameraState {
  return clampCamera({
    ...camera,
    zoom: clamp(zoom, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM),
  });
}

export function setCameraZoomAt(camera: CameraState, zoom: number, focalPoint: Point): CameraState {
  const worldBefore = screenToWorld(camera, focalPoint);
  const zoomed = {
    ...camera,
    zoom: clamp(zoom, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM),
  };
  const worldAfter = screenToWorld(zoomed, focalPoint);

  return clampCamera({
    ...zoomed,
    center: {
      x: zoomed.center.x + worldBefore.x - worldAfter.x,
      y: zoomed.center.y + worldBefore.y - worldAfter.y,
    },
  });
}

export function projectedMapTransform(camera: CameraState) {
  const a = camera.zoom;
  const b = 0;
  const c = camera.skewX * camera.zoom;
  const d = camera.zoom * camera.yScale;
  const e = camera.width * camera.anchorX - a * camera.center.x - c * camera.center.y;
  const f = camera.height * camera.anchorY - d * camera.center.y;

  return `matrix(${a} ${b} ${c} ${d} ${e} ${f})`;
}

export function getVisibleWorldRect(camera: CameraState): CameraBox {
  const leftWidth = camera.width * camera.anchorX / camera.zoom;
  const rightWidth = camera.width * (1 - camera.anchorX) / camera.zoom;
  const topHeight = camera.height * camera.anchorY / (camera.zoom * camera.yScale);
  const bottomHeight = camera.height * (1 - camera.anchorY) / (camera.zoom * camera.yScale);

  return {
    x: clamp(camera.center.x - leftWidth, 0, MAP_WIDTH),
    y: clamp(camera.center.y - topHeight, 0, MAP_HEIGHT),
    width: Math.min(MAP_WIDTH, leftWidth + rightWidth),
    height: Math.min(MAP_HEIGHT, topHeight + bottomHeight),
  };
}

export function clampCameraToWorld(camera: CameraState): CameraState {
  return clampCamera(camera);
}

function clampCamera(camera: CameraState): CameraState {
  const minX = (camera.width * camera.anchorX) / camera.zoom;
  const maxX = MAP_WIDTH - (camera.width * (1 - camera.anchorX)) / camera.zoom;
  const minY = (camera.height * camera.anchorY) / (camera.zoom * camera.yScale);
  const maxY = MAP_HEIGHT - (camera.height * (1 - camera.anchorY)) / (camera.zoom * camera.yScale);

  return {
    ...camera,
    center: {
      x: clamp(camera.center.x, minX, Math.max(minX, maxX)),
      y: clamp(camera.center.y, minY, Math.max(minY, maxY)),
    },
  };
}
