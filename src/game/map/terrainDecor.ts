import type { Point } from '../types';
import { MAP_HEIGHT, MAP_WIDTH } from '../constants';

export type TreeCluster = {
  id: string;
  position: Point;
  count: number;
  scale: number;
};

export type WallSegment = {
  id: string;
  position: Point;
  width: number;
  height: number;
  rotate?: number;
};

export const TREE_CLUSTERS: TreeCluster[] = [
  { id: 'trees-blue-top', position: { x: MAP_WIDTH * 0.12, y: MAP_HEIGHT * 0.15 }, count: 3, scale: 1.1 },
  { id: 'trees-blue-bot', position: { x: MAP_WIDTH * 0.14, y: MAP_HEIGHT * 0.86 }, count: 3, scale: 1.15 },
  { id: 'trees-mid-nw', position: { x: MAP_WIDTH * 0.33, y: MAP_HEIGHT * 0.34 }, count: 4, scale: 1.2 },
  { id: 'trees-mid-se', position: { x: MAP_WIDTH * 0.5, y: MAP_HEIGHT * 0.66 }, count: 4, scale: 1.2 },
  { id: 'trees-red-top', position: { x: MAP_WIDTH * 0.82, y: MAP_HEIGHT * 0.15 }, count: 3, scale: 1.1 },
  { id: 'trees-red-bot', position: { x: MAP_WIDTH * 0.86, y: MAP_HEIGHT * 0.86 }, count: 3, scale: 1.15 },
];

export const WALL_SEGMENTS: WallSegment[] = [
  { id: 'wall-left-mid', position: { x: MAP_WIDTH * 0.3, y: MAP_HEIGHT * 0.5 }, width: 128, height: 22, rotate: -8 },
  { id: 'wall-right-mid', position: { x: MAP_WIDTH * 0.62, y: MAP_HEIGHT * 0.5 }, width: 132, height: 22, rotate: -8 },
  { id: 'wall-top-jungle', position: { x: MAP_WIDTH * 0.48, y: MAP_HEIGHT * 0.32 }, width: 166, height: 20, rotate: 8 },
  { id: 'wall-bot-jungle', position: { x: MAP_WIDTH * 0.48, y: MAP_HEIGHT * 0.68 }, width: 166, height: 20, rotate: 8 },
];
