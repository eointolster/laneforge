import { MAP_HEIGHT, MAP_WIDTH } from '@/game/constants';
import type { Point, Vector } from '@/game/types';

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distanceSq(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function normalize(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y);

  if (!Number.isFinite(length) || length < 0.001) {
    return { x: 0, y: 0 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

export function scale(vector: Vector, amount: number): Vector {
  return {
    x: vector.x * amount,
    y: vector.y * amount,
  };
}

export function add(a: Point, b: Vector): Point {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
  };
}

export function subtract(a: Point, b: Point): Vector {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
  };
}

export function clampToMap(point: Point, padding = 18): Point {
  return {
    x: clamp(point.x, padding, MAP_WIDTH - padding),
    y: clamp(point.y, padding, MAP_HEIGHT - padding),
  };
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
