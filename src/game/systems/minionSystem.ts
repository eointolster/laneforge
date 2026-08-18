import { HERO_BALANCE, MINION_BALANCE, WAVE_BALANCE } from '../balance';
import { ENTITY_LIMITS, LANES, MAP_HEIGHT, MAP_WIDTH, TEAM_COLORS, TEAM_DIRECTION } from '../constants';
import { getHeroDefinition } from '../heroes';
import { getLaneYAtX, laneGoalX, laneSpawnPoint } from '../map/lanePaths';
import type { GameState, Hero, LaneId, Minion, MinionKind, Point, Team } from '../types';
import { inRange } from '@/utils/collision';
import { clampToMap, distance, normalize, subtract } from '@/utils/math';
import { findNearestTarget, getHeroForTeam, isHeroAlive } from './combatSystem';
import { makeId, pushEffect } from './systemUtils';

const MINION_HUNT_RANGE = 230;
const MINION_HUNT_SPEED_MULTIPLIER = 1.06;
const MINION_WAVE_LEVEL_INTERVAL = 2;
const MINION_WAVE_XP_THRESHOLD = 0.45;
const MINION_WAVE_MAX_BONUS = 4;
const HEAVY_INFANTRY_LEVEL = 8;
const OPPOSING_MINION_SEPARATION_PADDING = 10;
const SAME_TEAM_MINION_SEPARATION_SCALE = 0.72;
const MINION_CROWDING_MAX_PUSH = 7;

export function updateMinionSystem(state: GameState, dt: number) {
  state.waveTimer -= dt;

  if (state.waveTimer <= 0) {
    spawnWave(state);
    if (state.minions.length > ENTITY_LIMITS.minions) {
      pruneMinionOverflow(state);
    }
    state.waveTimer = WAVE_BALANCE.interval;
  }

  for (const minion of state.minions) {
    if (minion.dead || minion.hp <= 0) continue;
    if (minion.rootTimer > 0) {
      minion.rootTimer = Math.max(0, minion.rootTimer - dt);
      continue;
    }

    const huntTarget = findNearestTarget(state, minion.team, minion.position, MINION_HUNT_RANGE, {
      laneOnly: minion.lane,
    });

    if (huntTarget && inRange(minion.position, huntTarget.position, minion.attackRange + huntTarget.radius)) {
      continue;
    }

    if (huntTarget) {
      moveMinionToward(state, minion, huntTarget.position, dt);
      continue;
    }

    const direction = TEAM_DIRECTION[minion.team];
    const targetY = getTravelY(minion);
    minion.facing = { x: direction, y: 0 };
    const speed = getMinionSpeed(state, minion);
    minion.position.x += direction * speed * dt;
    minion.position.y += (targetY - minion.position.y) * Math.min(1, dt * 3);
    minion.position = clampToMap(minion.position, minion.radius);
  }

  resolveMinionCrowding(state, dt);
}

function getTravelY(minion: Minion) {
  const coreCommitDistance = 170;
  const nearEnemyCore = minion.team === 'blue'
    ? minion.position.x > laneGoalX('blue') - coreCommitDistance
    : minion.position.x < laneGoalX('red') + coreCommitDistance;

  if (nearEnemyCore) {
    return MAP_HEIGHT / 2;
  }

  return getLaneYAtX(minion.lane, minion.position.x);
}

function moveMinionToward(state: GameState, minion: Minion, targetPosition: Point, dt: number) {
  const direction = normalize(subtract(targetPosition, minion.position));
  if (Math.hypot(direction.x, direction.y) < 0.001) {
    return;
  }

  const speed = getMinionSpeed(state, minion);
  minion.facing = direction;
  minion.position.x += direction.x * speed * MINION_HUNT_SPEED_MULTIPLIER * dt;
  minion.position.y += direction.y * speed * MINION_HUNT_SPEED_MULTIPLIER * dt;
  minion.position = clampToMap(minion.position, minion.radius);
}

function getMinionSpeed(state: GameState, minion: Minion) {
  const hero = getHeroForTeam(state, minion.team);
  const stats = getHeroDefinition(hero.heroClass).stats;
  const auraActive = stats.minionAuraRadius && isHeroAlive(hero) && distance(hero.position, minion.position) <= stats.minionAuraRadius;
  return auraActive ? minion.speed * (stats.minionSpeedMultiplier ?? 1) : minion.speed;
}

function resolveMinionCrowding(state: GameState, dt: number) {
  const pushScale = Math.min(1, dt * 12);
  if (pushScale <= 0) return;

  const liveMinions = state.minions.filter((minion) => !minion.dead && minion.hp > 0);
  for (let i = 0; i < liveMinions.length; i += 1) {
    const a = liveMinions[i];
    for (let j = i + 1; j < liveMinions.length; j += 1) {
      const b = liveMinions[j];
      if (a.lane !== b.lane) continue;

      const sameTeam = a.team === b.team;
      const minSeparation = sameTeam
        ? (a.radius + b.radius) * SAME_TEAM_MINION_SEPARATION_SCALE
        : a.radius + b.radius + OPPOSING_MINION_SEPARATION_PADDING;
      const dx = a.position.x - b.position.x;
      const dy = a.position.y - b.position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq >= minSeparation * minSeparation) continue;

      const dist = Math.sqrt(Math.max(0.0001, distSq));
      const overlap = minSeparation - dist;
      const pushAmount = Math.min(MINION_CROWDING_MAX_PUSH, overlap * (sameTeam ? 0.26 : 0.52) * pushScale);
      const direction = dist > 0.1
        ? { x: dx / dist, y: dy / dist }
        : fallbackCrowdingDirection(a, b);

      a.position = clampToMap({
        x: a.position.x + direction.x * pushAmount,
        y: a.position.y + direction.y * pushAmount,
      }, a.radius);
      b.position = clampToMap({
        x: b.position.x - direction.x * pushAmount,
        y: b.position.y - direction.y * pushAmount,
      }, b.radius);
    }
  }
}

function fallbackCrowdingDirection(a: Minion, b: Minion) {
  if (a.team !== b.team) {
    return { x: a.team === 'blue' ? -1 : 1, y: 0 };
  }

  const laneBias = a.lane === 'top' ? -1 : a.lane === 'bottom' ? 1 : 0;
  const idBias = a.id < b.id ? -1 : 1;
  return normalize({ x: 0.24 * idBias, y: laneBias || idBias });
}

function spawnWave(state: GameState) {
  state.waveNumber += 1;

  for (const team of ['blue', 'red'] as Team[]) {
    const hero = team === 'blue' ? state.heroes.player : state.heroes.enemy;
    const waveBonus = getHeroWaveBonus(hero);

    for (const lane of LANES) {
      const bladeCount = (state.levelConfig.minionWaveSize ?? WAVE_BALANCE.bladeCount) + waveBonus;
      const sparkEvery = state.levelConfig.sparkFrequency ?? WAVE_BALANCE.sparkEvery;
      for (let index = 0; index < bladeCount; index += 1) {
        state.minions.push(createMinion(state, team, lane, 'blade', index));
      }

      if (state.waveNumber % sparkEvery === 0) {
        state.minions.push(createMinion(state, team, lane, 'spark', bladeCount + 1));
      }

      const guardCount = getGuardCount(state, hero);
      for (let index = 0; index < guardCount; index += 1) {
        state.minions.push(createMinion(state, team, lane, 'guard', bladeCount + 2 + index));
      }

      pushEffect(state, 'spawn', laneSpawnPoint(team, lane, 0), 30, 0.28, TEAM_COLORS[team].main);
    }
  }
}

function getHeroWaveBonus(hero: Hero) {
  const levelBonus = Math.floor(Math.max(0, hero.level - 1) / MINION_WAVE_LEVEL_INTERVAL);
  const xpNeeded = HERO_BALANCE.xpPerLevel + Math.max(0, hero.level - 1) * 58;
  const xpBonus = xpNeeded > 0 && hero.xp / xpNeeded >= MINION_WAVE_XP_THRESHOLD ? 1 : 0;

  return Math.min(MINION_WAVE_MAX_BONUS, levelBonus + xpBonus);
}

function getGuardCount(state: GameState, hero: Hero) {
  if (state.waveNumber < WAVE_BALANCE.guardFirstWave) {
    return 0;
  }

  const cadenceWave = (state.waveNumber - WAVE_BALANCE.guardFirstWave) % WAVE_BALANCE.guardEvery === 0;
  let count = cadenceWave ? 1 : 0;

  if (state.waveNumber >= WAVE_BALANCE.guardFirstWave + WAVE_BALANCE.guardEvery * 3) {
    count = Math.max(count, 1);
  }

  if (hero.level >= HEAVY_INFANTRY_LEVEL || state.waveNumber >= WAVE_BALANCE.guardFirstWave + WAVE_BALANCE.guardEvery * 5) {
    count += 1;
  }

  return Math.min(WAVE_BALANCE.guardMaxPerLane, count);
}

function pruneMinionOverflow(state: GameState) {
  state.minions = state.minions.filter((minion) => !minion.dead && minion.hp > 0);

  if (state.minions.length <= ENTITY_LIMITS.minions) {
    return;
  }

  state.minions = [...state.minions]
    .sort((a, b) => minionKeepScore(state, b) - minionKeepScore(state, a))
    .slice(0, ENTITY_LIMITS.minions);
}

function minionKeepScore(state: GameState, minion: Minion) {
  const playerDistance = distance(minion.position, state.heroes.player.position);
  const enemyDistance = distance(minion.position, state.heroes.enemy.position);
  const recentCombat = Math.max(
    0,
    180 - (state.time - Math.max(minion.lastAttackTime, minion.lastDamageTime)) * 60,
  );
  const laneProgress = minion.team === 'blue'
    ? minion.position.x / MAP_WIDTH
    : (MAP_WIDTH - minion.position.x) / MAP_WIDTH;

  return (
    Math.max(0, 900 - playerDistance) * 4 +
    Math.max(0, 540 - enemyDistance) * 1.4 +
    recentCombat +
    laneProgress * 220 +
    (minion.kind === 'guard' ? 120 : minion.kind === 'spark' ? 60 : 0) +
    (minion.hp / minion.maxHp) * 30
  );
}

function createMinion(state: GameState, team: Team, lane: LaneId, kind: MinionKind, index: number): Minion {
  const stats = MINION_BALANCE[kind];
  const enemyMultiplier = team === 'red' ? state.levelConfig.enemyHpMultiplier : 1;
  const enemyDamageMultiplier = team === 'red' ? state.levelConfig.enemyDamageMultiplier : 1;
  const enemySpeedMultiplier = team === 'red' ? state.levelConfig.enemySpeedMultiplier : 1;
  const maxHp = Math.round(stats.maxHp * enemyMultiplier);

  return {
    id: makeId(state, `${team}-${lane}-${kind}`),
    team,
    lane,
    kind,
    position: laneSpawnPoint(team, lane, index),
    radius: stats.radius,
    hp: maxHp,
    maxHp,
    speed: stats.speed * enemySpeedMultiplier,
    damage: stats.damage * enemyDamageMultiplier,
    attackRange: stats.range,
    attackCooldown: 0.3 + index * 0.15,
    bountyXp: stats.bountyXp,
    facing: { x: team === 'blue' ? 1 : -1, y: 0 },
    lastAttackTime: -99,
    lastDamageTime: -99,
    deathTime: -99,
    rootTimer: 0,
    dead: false,
  };
}
