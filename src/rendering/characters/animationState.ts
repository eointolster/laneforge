import type { Hero, Minion, Vector } from '@/game/types';

export type UnitVisualState = {
  facing: 1 | -1;
  bob: number;
  lean: number;
  stride: number;
  stepLift: number;
  armSway: number;
  attack: number;
  cast: number;
  hit: number;
  death: number;
  moving: boolean;
  moveAmount: number;
};

export function getHeroVisualState(hero: Hero, time: number): UnitVisualState {
  const moveAmount = hero.dashTimer > 0 ? 1.2 : getMoveMagnitude(hero.intent);
  const moving = moveAmount > 0.08 || hero.dashTimer > 0;
  const facing = facingSign(hero.facing, hero.team === 'blue' ? 1 : -1);
  const walkPhase = getWalkPhase(time, hero.id, moving, moveAmount, hero.team === 'blue' ? 8.8 : 8.1);

  return {
    facing,
    bob: getBob(time, hero.id, moving, hero.team === 'blue' ? 1.45 : 1.25, moveAmount),
    lean: moving ? facing * 3 : 0,
    stride: getStride(walkPhase, moving, moveAmount),
    stepLift: getStepLift(walkPhase, moving, moveAmount),
    armSway: getArmSway(walkPhase, time, hero.id, moving, moveAmount),
    attack: recentPulse(time, hero.lastAttackTime, 0.32),
    cast: recentPulse(time, hero.lastCastTime, 0.45),
    hit: recentPulse(time, hero.lastDamageTime, 0.25),
    death: hero.hp <= 0 ? Math.min(1, Math.max(0, (time - hero.deathTime) / 0.35)) : 0,
    moving,
    moveAmount,
  };
}

export function getMinionVisualState(minion: Minion, time: number): UnitVisualState {
  const moving = !minion.dead && vectorLength(minion.facing) > 0.08;
  const moveAmount = moving ? Math.min(1.15, minion.speed / 54) : 0;
  const isSpark = minion.kind === 'spark';
  const isGuard = minion.kind === 'guard';
  const walkPhase = getWalkPhase(time, minion.id, moving, moveAmount, isSpark ? 7.8 : isGuard ? 7.1 : 8.6);
  const facing = facingSign(minion.facing, minion.team === 'blue' ? 1 : -1);

  return {
    facing,
    bob: getBob(time, minion.id, moving, isSpark ? 1.1 : isGuard ? 0.72 : 0.9, moveAmount),
    lean: moving ? facing * 2 : 0,
    stride: getStride(walkPhase, moving, moveAmount),
    stepLift: getStepLift(walkPhase, moving, moveAmount),
    armSway: getArmSway(walkPhase, time, minion.id, moving, moveAmount),
    attack: recentPulse(time, minion.lastAttackTime, isSpark ? 0.42 : isGuard ? 0.34 : 0.28),
    cast: isSpark ? recentPulse(time, minion.lastAttackTime, 0.42) : 0,
    hit: recentPulse(time, minion.lastDamageTime, 0.22),
    death: minion.dead ? Math.min(1, Math.max(0, (time - minion.deathTime) / 0.32)) : 0,
    moving,
    moveAmount,
  };
}

function getBob(time: number, id: string, moving: boolean, amount: number, moveAmount: number) {
  const seed = getSeed(id);
  const speed = moving ? 7.4 + moveAmount * 3.3 : 3.1;
  return Math.sin(time * speed + seed * 0.17) * amount;
}

function getWalkPhase(time: number, id: string, moving: boolean, moveAmount: number, baseSpeed: number) {
  const seed = getSeed(id);
  const speed = moving ? baseSpeed * (0.72 + moveAmount * 0.46) : 2.1;
  return time * speed + seed * 0.19;
}

function getStride(phase: number, moving: boolean, moveAmount: number) {
  const idleAmount = moving ? moveAmount : 0.08;
  return Math.sin(phase) * idleAmount;
}

function getStepLift(phase: number, moving: boolean, moveAmount: number) {
  if (!moving) return 0;
  return Math.abs(Math.cos(phase)) * moveAmount;
}

function getArmSway(phase: number, time: number, id: string, moving: boolean, moveAmount: number) {
  if (moving) {
    return Math.cos(phase + 0.5) * moveAmount;
  }

  return Math.sin(time * 2.2 + getSeed(id) * 0.13) * 0.14;
}

function recentPulse(time: number, startedAt: number, duration: number) {
  if (startedAt < 0) return 0;
  const elapsed = time - startedAt;
  if (elapsed < 0 || elapsed > duration) return 0;
  return 1 - elapsed / duration;
}

function facingSign(vector: Vector, fallback: 1 | -1): 1 | -1 {
  if (Math.abs(vector.x) < 0.08) return fallback;
  return vector.x >= 0 ? 1 : -1;
}

function getMoveMagnitude(vector: Vector) {
  if (hasMagnitude(vector)) {
    return Math.min(1, vector.magnitude);
  }

  return Math.min(1, vectorLength(vector));
}

function hasMagnitude(vector: Vector): vector is Vector & { magnitude: number } {
  return typeof (vector as { magnitude?: unknown }).magnitude === 'number';
}

function vectorLength(vector: Vector) {
  return Math.hypot(vector.x, vector.y);
}

function getSeed(id: string) {
  return id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}
