import { BASE_POSITIONS, LANE_Y, MAP_HEIGHT, MAP_WIDTH } from '../constants';
import { STRUCTURE_BALANCE } from '../balance';
import type { LaneId, Point, Structure, Team } from '../types';
import type { LevelConfig } from '../types';
import { getLaneYAtX } from './lanePaths';

export type TerrainPatch = {
  id: string;
  kind: 'brush' | 'rock' | 'water' | 'ruin';
  position: Point;
  width: number;
  height: number;
  rotate?: number;
};

export const TERRAIN_PATCHES: TerrainPatch[] = [
  { id: 'brush-nw', kind: 'brush', position: { x: MAP_WIDTH * 0.2, y: MAP_HEIGHT * 0.33 }, width: 230, height: 72, rotate: -9 },
  { id: 'brush-se', kind: 'brush', position: { x: MAP_WIDTH * 0.64, y: MAP_HEIGHT * 0.66 }, width: 230, height: 72, rotate: -9 },
  { id: 'water-sw', kind: 'water', position: { x: MAP_WIDTH * 0.18, y: MAP_HEIGHT * 0.72 }, width: 260, height: 78, rotate: 8 },
  { id: 'rock-ne', kind: 'rock', position: { x: MAP_WIDTH * 0.72, y: MAP_HEIGHT * 0.28 }, width: 220, height: 68, rotate: 10 },
  { id: 'ruin-mid-left', kind: 'ruin', position: { x: MAP_WIDTH * 0.42, y: MAP_HEIGHT * 0.5 }, width: 106, height: 52, rotate: 0 },
  { id: 'ruin-mid-right', kind: 'ruin', position: { x: MAP_WIDTH * 0.56, y: MAP_HEIGHT * 0.5 }, width: 106, height: 52, rotate: 0 },
];

const TOWER_SLOTS: Array<{ idSuffix: string; x: Record<Team, number>; hpScale: number; radius: number }> = [
  {
    idSuffix: 'tower',
    x: {
      blue: 580,
      red: MAP_WIDTH - 580,
    },
    hpScale: 1,
    radius: 28,
  },
  {
    idSuffix: 'mid-tower',
    x: {
      blue: 1460,
      red: MAP_WIDTH - 1460,
    },
    hpScale: 0.86,
    radius: 25,
  },
];

export function createStructures(levelConfig?: LevelConfig): Structure[] {
  const structures: Structure[] = [];
  const lanes = Object.keys(LANE_Y) as LaneId[];

  for (const team of ['blue', 'red'] as Team[]) {
    for (const lane of lanes) {
      for (const slot of TOWER_SLOTS) {
        const towerX = slot.x[team];
        const hpMultiplier = levelConfig?.towerHpMultiplier ?? 1;
        const maxHp = Math.round(STRUCTURE_BALANCE.towerHp * hpMultiplier * slot.hpScale);
        structures.push({
          id: `${team}-${lane}-${slot.idSuffix}`,
          team,
          kind: 'tower',
          lane,
          position: { x: towerX, y: getLaneYAtX(lane, towerX) },
          radius: slot.radius,
          hp: maxHp,
          maxHp,
          range: STRUCTURE_BALANCE.towerRange,
          damage: STRUCTURE_BALANCE.towerDamage,
          attackCooldown: 0,
          lastDamageTime: -99,
          alive: true,
        });
      }
    }

    const coreHpMultiplier = levelConfig?.towerHpMultiplier ?? 1;
    const coreMaxHp = Math.round(STRUCTURE_BALANCE.coreHp * coreHpMultiplier);
    structures.push({
      id: `${team}-core`,
      team,
      kind: 'core',
      position: BASE_POSITIONS[team],
      radius: 48,
      hp: coreMaxHp,
      maxHp: coreMaxHp,
      range: STRUCTURE_BALANCE.coreRange,
      damage: STRUCTURE_BALANCE.coreDamage,
      attackCooldown: 0,
      lastDamageTime: -99,
      alive: true,
    });
  }

  return structures;
}

export function mapBounds() {
  return {
    x: 0,
    y: 0,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
  };
}
