import { BASE_POSITIONS, MAP_WIDTH } from '../constants';
import { getLaneYAtX } from '../map/lanePaths';
import type { GameState, LaneId, Point } from '../types';
import { distance, normalize, subtract } from '@/utils/math';
import { findNearestTarget, isHeroAlive } from './combatSystem';

export function updateAiHeroSystem(state: GameState) {
  const enemy = state.heroes.enemy;

  if (!isHeroAlive(enemy)) {
    enemy.intent = { x: 0, y: 0 };
    return;
  }

  if (enemy.hp < enemy.maxHp * 0.28) {
    enemy.intent = normalize(subtract(BASE_POSITIONS.red, enemy.position));
    return;
  }

  const powerUpTarget = findUsefulPowerUp(state);
  if (powerUpTarget) {
    enemy.intent = normalize(subtract(powerUpTarget, enemy.position));
    return;
  }

  const towerThreat = findUnguardedTowerThreat(state);
  if (towerThreat) {
    enemy.intent = normalize(subtract(BASE_POSITIONS.red, enemy.position));
    return;
  }

  const pressureLane = choosePressureLane(state);
  const nearestThreat = findNearestTarget(state, enemy.team, enemy.position, 360, { includeStructures: true });

  if (nearestThreat && nearestThreat.ref.kind !== 'structure') {
    enemy.intent = normalize(subtract(nearestThreat.position, enemy.position));
    return;
  }

  const lanePointX = state.time < 40 ? MAP_WIDTH * 0.62 : MAP_WIDTH * 0.47;
  const lanePoint: Point = {
    x: lanePointX,
    y: getLaneYAtX(pressureLane, lanePointX),
  };

  if (distance(enemy.position, lanePoint) < 40) {
    enemy.intent = { x: -0.18, y: 0 };
  } else {
    enemy.intent = normalize(subtract(lanePoint, enemy.position));
  }
}

function findUsefulPowerUp(state: GameState): Point | null {
  const enemy = state.heroes.enemy;
  const candidates = state.powerUps.filter((powerUp) => (
    powerUp.active &&
    powerUp.team === 'red' &&
    (
      (powerUp.kind === 'shield' && enemy.powerShield <= 0) ||
      (powerUp.kind === 'speed' && enemy.attackSpeedBoostTimer <= 0)
    )
  ));

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aPriority = a.kind === 'shield' && enemy.hp < enemy.maxHp * 0.72 ? -1 : 0;
    const bPriority = b.kind === 'shield' && enemy.hp < enemy.maxHp * 0.72 ? -1 : 0;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return distance(enemy.position, a.position) - distance(enemy.position, b.position);
  });

  return candidates[0].position;
}

function findUnguardedTowerThreat(state: GameState) {
  const enemy = state.heroes.enemy;
  let nearestThreatDistance: number | null = null;

  for (const structure of state.structures) {
    if (structure.team !== 'blue' || structure.kind !== 'tower' || !structure.alive || structure.hp <= 0) continue;
    const towerDistance = distance(enemy.position, structure.position);
    if (towerDistance > structure.range * 0.92) continue;

    const hasRedMinionTakingSpace = state.minions.some((minion) => (
      minion.team === 'red' &&
      !minion.dead &&
      minion.hp > 0 &&
      distance(minion.position, structure.position) <= structure.range * 0.88
    ));

    if (hasRedMinionTakingSpace) continue;
    if (nearestThreatDistance === null || towerDistance < nearestThreatDistance) {
      nearestThreatDistance = towerDistance;
    }
  }

  return nearestThreatDistance !== null;
}

function choosePressureLane(state: GameState): LaneId {
  const lanes: LaneId[] = ['top', 'middle', 'bottom'];
  let bestLane: LaneId = 'middle';
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const lane of lanes) {
    let score = 0;

    for (const minion of state.minions) {
      if (minion.lane !== lane || minion.dead) continue;
      score += minion.team === 'blue' ? minion.position.x / 80 : -minion.position.x / 95;
    }

    const blueLaneTowers = state.structures.filter((structure) => (
      structure.team === 'blue' &&
      structure.kind === 'tower' &&
      structure.lane === lane
    ));
    const destroyedBlueTowers = blueLaneTowers.filter((tower) => !tower.alive || tower.hp <= 0).length;
    score += destroyedBlueTowers * 6;

    if (score > bestScore) {
      bestScore = score;
      bestLane = lane;
    }
  }

  return bestLane;
}
