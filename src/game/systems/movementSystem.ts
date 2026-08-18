import { BASE_POSITIONS, HERO_START, MAP_HEIGHT, MAP_WIDTH, SIMULATION } from '../constants';
import { getHeroDefinition } from '../heroes';
import type { GameInput, GameState, Hero, Team, Vector } from '../types';
import { clampToMap, normalize } from '@/utils/math';
import { isHeroAlive } from './combatSystem';
import { pushEffect } from './systemUtils';

export function updateMovement(state: GameState, input: GameInput, dt: number) {
  updateHero(state, state.heroes.player, input.move, dt);
  updateHero(state, state.heroes.enemy, state.heroes.enemy.intent, dt);
}

function updateHero(state: GameState, hero: Hero, move: Vector, dt: number) {
  if (!isHeroAlive(hero)) {
    updateRespawn(state, hero, dt);
    return;
  }

  hero.intent = move;
  const heroStats = getHeroDefinition(hero.heroClass).stats;
  const speed = heroStats.speed * (hero.team === 'red' ? state.levelConfig.enemySpeedMultiplier : 1);

  if (hero.rootTimer > 0) {
    hero.rootTimer = Math.max(0, hero.rootTimer - dt);
    hero.dashTimer = 0;
    hero.dashVelocity = { x: 0, y: 0 };
    hero.intent = { x: 0, y: 0 };
    return;
  }

  if (hero.channelTimer > 0) {
    hero.dashTimer = 0;
    hero.dashVelocity = { x: 0, y: 0 };
    hero.intent = { x: 0, y: 0 };
    return;
  }

  if (hero.dashTimer > 0) {
    hero.facing = normalize(hero.dashVelocity);
    const dashSpeed = Math.hypot(hero.dashVelocity.x, hero.dashVelocity.y);
    if (!Number.isFinite(dashSpeed) || dashSpeed < 0.001) {
      hero.dashTimer = 0;
      hero.dashVelocity = { x: 0, y: 0 };
      return;
    }

    const maxStep = 600 * dt;
    const step = Math.min(maxStep, dashSpeed * dt);
    const dashDirection = { x: hero.dashVelocity.x / dashSpeed, y: hero.dashVelocity.y / dashSpeed };
    hero.position = clampToMap({
      x: hero.position.x + dashDirection.x * step,
      y: hero.position.y + dashDirection.y * step,
    }, hero.radius);
    hero.dashTimer = Math.max(0, hero.dashTimer - dt);
    return;
  }

  const magnitude = getMoveMagnitude(move);
  const direction = normalize(move);
  if (magnitude > 0.08) {
    hero.facing = direction;
  }
  hero.position = clampToMap({
    x: hero.position.x + direction.x * speed * magnitude * dt,
    y: hero.position.y + direction.y * speed * magnitude * dt,
  }, hero.radius);
}

function getMoveMagnitude(move: Vector) {
  if (hasMagnitude(move)) {
    return Number.isFinite(move.magnitude) ? Math.min(1, Math.max(0, move.magnitude)) : 0;
  }

  const magnitude = Math.hypot(move.x, move.y);
  return Number.isFinite(magnitude) ? Math.min(1, magnitude) : 0;
}

function hasMagnitude(move: Vector): move is Vector & { magnitude: number } {
  return typeof (move as { magnitude?: unknown }).magnitude === 'number';
}

function updateRespawn(state: GameState, hero: Hero, dt: number) {
  if (hero.respawnTimer <= 0) return;

  hero.respawnTimer = Math.max(0, hero.respawnTimer - dt);

  if (hero.respawnTimer > 0) {
    return;
  }

  const team = hero.team;
  const start = team === 'blue' ? HERO_START.blue : HERO_START.red;
  hero.position = {
    x: start.x,
    y: start.y,
  };
  hero.hp = Math.round(hero.maxHp * 0.72);
  hero.shield = 0;
  hero.powerShield = 0;
  hero.powerShieldMax = 0;
  hero.attackSpeedBoostTimer = 0;
  hero.intent = { x: 0, y: 0 };
  hero.facing = { x: team === 'blue' ? 1 : -1, y: 0 };
  pushEffect(state, 'spawn', BASE_POSITIONS[team], 76, 0.65, team === 'blue' ? '#47D8FF' : '#FF714D');
}

export function clearUnsafeEntities(state: GameState) {
  state.minions = state.minions.filter((minion) => (
    minion.position.x > -SIMULATION.minionCleanupPadding &&
    minion.position.x < MAP_WIDTH + SIMULATION.minionCleanupPadding &&
    minion.position.y > -SIMULATION.minionCleanupPadding &&
    minion.position.y < MAP_HEIGHT + SIMULATION.minionCleanupPadding &&
    (minion.hp > 0 || (minion.dead && state.time - minion.deathTime < 0.32))
  ));
}
