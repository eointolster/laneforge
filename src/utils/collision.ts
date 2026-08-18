import type { Point } from '@/game/types';
import { distanceSq } from './math';

export function circlesOverlap(a: Point, ar: number, b: Point, br: number) {
  const radius = ar + br;
  return distanceSq(a, b) <= radius * radius;
}

export function inRange(a: Point, b: Point, range: number) {
  return distanceSq(a, b) <= range * range;
}
