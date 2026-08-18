import { getVisibleWorldRect } from '@/game/camera';
import type { CameraBox, CameraState, Point } from '@/game/types';

export const RENDER_PADDING = 520;
export const EFFECT_RENDER_PADDING = 360;

type Positioned = {
  position: Point;
  radius?: number;
};

export function getRenderBounds(camera: CameraState, padding = RENDER_PADDING): CameraBox {
  return expandBox(getVisibleWorldRect(camera), padding);
}

export function expandBox(box: CameraBox, padding: number): CameraBox {
  return {
    x: box.x - padding,
    y: box.y - padding,
    width: box.width + padding * 2,
    height: box.height + padding * 2,
  };
}

export function isPointInRenderBounds(point: Point, bounds: CameraBox, radius = 0) {
  return (
    point.x + radius >= bounds.x &&
    point.x - radius <= bounds.x + bounds.width &&
    point.y + radius >= bounds.y &&
    point.y - radius <= bounds.y + bounds.height
  );
}

export function isPositionedInRenderBounds<T extends Positioned>(item: T, bounds: CameraBox, extraPadding = 0) {
  return isPointInRenderBounds(item.position, bounds, (item.radius ?? 0) + extraPadding);
}
