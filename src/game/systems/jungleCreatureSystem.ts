import { JUNGLE_BUFF_BALANCE, JUNGLE_CREATURE_BALANCE, WARNING_BALANCE } from '../balance';
import type { GameState, Hero, JungleCreature, Minion, Point, TargetRef } from '../types';
import { clampToMap, distance, distanceSq, normalize, subtract } from '@/utils/math';
import { absorbHeroDamage, getTarget, isHeroAlive } from './combatSystem';
import { pushEffect, pushFloatingText, pushWarning } from './systemUtils';

const HERO_RESPAWN_SECONDS = 8;
const MINION_AGGRO_RANGE = 190;
const RETURN_HOME_DISTANCE = 8;

export function updateJungleCreatureSystem(state: GameState, dt: number) {
  for (const creature of state.jungleCreatures) {
    if (!creature.alive) {
      updateRespawn(state, creature, dt);
      continue;
    }

    creature.attackCooldown = Math.max(0, creature.attackCooldown - dt);
    const target = findCreatureTarget(state, creature);
    creature.targetRef = target?.ref ?? null;

    if (target) {
      moveAndAttackTarget(state, creature, target, dt);
      continue;
    }

    creature.warningTargetRef = null;
    creature.warningTimer = 0;
    returnCreatureHome(creature, dt);
  }
}

function updateRespawn(state: GameState, creature: JungleCreature, dt: number) {
  creature.respawnTimer = Math.max(0, creature.respawnTimer - dt);

  if (creature.respawnTimer > 0) {
    return;
  }

  creature.position = { ...creature.homePosition };
  creature.hp = creature.maxHp;
  creature.alive = true;
  creature.attackCooldown = 0.45;
  creature.warningTargetRef = null;
  creature.warningTimer = 0;
  creature.lastDamageTime = -99;
  creature.targetRef = null;
  creature.facing = { x: creature.homePosition.x < state.heroes.player.position.x ? 1 : -1, y: 0 };
  pushEffect(state, 'spawn', creature.position, creature.radius + 28, 0.44, creature.kind === 'dragon' ? '#C7A5FF' : '#7CFFB0');
  creature.respawnTimer = 0;
}

function findCreatureTarget(state: GameState, creature: JungleCreature) {
  const current = creature.targetRef ? getTarget(state, creature.targetRef) : null;
  if (
    current &&
    distance(creature.homePosition, current.position) <= creature.leashRange + current.radius &&
    distance(creature.position, current.position) <= creature.aggroRange + current.radius
  ) {
    return current;
  }

  let best: ReturnType<typeof getTarget> | null = null;
  let bestDistanceSq = creature.aggroRange * creature.aggroRange;

  const consider = (ref: TargetRef, position: Point, radius: number) => {
    if (distance(creature.homePosition, position) > creature.leashRange + radius) return;
    const ds = distanceSq(creature.position, position);
    if (ds > bestDistanceSq) return;
    best = getTarget(state, ref);
    bestDistanceSq = ds;
  };

  for (const hero of [state.heroes.player, state.heroes.enemy]) {
    if (!isHeroAlive(hero)) continue;
    consider({ kind: 'hero', id: hero.id }, hero.position, hero.radius);
  }

  for (const minion of state.minions) {
    if (minion.dead || minion.hp <= 0) continue;
    if (distanceSq(creature.position, minion.position) > MINION_AGGRO_RANGE * MINION_AGGRO_RANGE) continue;
    consider({ kind: 'minion', id: minion.id }, minion.position, minion.radius);
  }

  return best;
}

function moveAndAttackTarget(
  state: GameState,
  creature: JungleCreature,
  target: NonNullable<ReturnType<typeof getTarget>>,
  dt: number,
) {
  const targetDistance = distance(creature.position, target.position);
  const attackDistance = creature.attackRange + target.radius;
  const direction = normalize(subtract(target.position, creature.position));

  if (Math.hypot(direction.x, direction.y) > 0.001) {
    creature.facing = direction;
  }

  if (targetDistance > attackDistance) {
    creature.warningTargetRef = null;
    creature.warningTimer = 0;
    const next = {
      x: creature.position.x + direction.x * creature.speed * dt,
      y: creature.position.y + direction.y * creature.speed * dt,
    };

    if (distance(creature.homePosition, next) <= creature.leashRange) {
      creature.position = clampToMap(next, creature.radius);
    }
    return;
  }

  if (creature.attackCooldown > 0) {
    creature.warningTargetRef = null;
    creature.warningTimer = 0;
    return;
  }

  if (!sameTargetRef(creature.warningTargetRef, target.ref) || (creature.warningTimer ?? 0) <= 0) {
    creature.warningTargetRef = { ...target.ref };
    creature.warningTimer = WARNING_BALANCE.jungleLeadSeconds;
    pushCreatureWarning(state, creature, target.position, target.radius, WARNING_BALANCE.jungleLeadSeconds);
    return;
  }

  pushCreatureWarning(state, creature, target.position, target.radius, creature.warningTimer ?? WARNING_BALANCE.jungleLeadSeconds);
  creature.warningTimer = Math.max(0, (creature.warningTimer ?? 0) - dt);

  if (creature.warningTimer > 0) {
    return;
  }

  creature.lastAttackTime = state.time;
  pushEffect(state, creature.kind === 'dragon' ? 'fireball' : 'dash', creature.position, creature.kind === 'dragon' ? 88 : 52, 0.26, creature.kind === 'dragon' ? '#FFB15F' : '#FFD36A');
  damageNeutralTarget(state, target.ref, creature.damage);
  pushEffect(state, creature.kind === 'dragon' ? 'fireball' : 'hit', target.position, creature.kind === 'dragon' ? 78 : 42, 0.34, creature.kind === 'dragon' ? '#FFD36A' : '#7CFFB0');
  creature.attackCooldown = JUNGLE_CREATURE_BALANCE[creature.kind].attackCooldown;
  creature.warningTargetRef = null;
  creature.warningTimer = 0;
}

function pushCreatureWarning(
  state: GameState,
  creature: JungleCreature,
  targetPosition: Point,
  targetRadius: number,
  ttl: number,
) {
  pushWarning(
    state,
    'jungle',
    'red',
    creature.position,
    targetPosition,
    targetRadius + (creature.kind === 'dragon' ? 46 : 34),
    Math.max(0.08, ttl),
    creature.kind === 'dragon' ? '#FFD36A' : '#FFB15F',
  );
}

function returnCreatureHome(creature: JungleCreature, dt: number) {
  const homeDistance = distance(creature.position, creature.homePosition);
  if (homeDistance <= RETURN_HOME_DISTANCE) {
    creature.position = { ...creature.homePosition };
    return;
  }

  const direction = normalize(subtract(creature.homePosition, creature.position));
  creature.facing = direction;
  creature.position = clampToMap({
    x: creature.position.x + direction.x * creature.speed * 0.72 * dt,
    y: creature.position.y + direction.y * creature.speed * 0.72 * dt,
  }, creature.radius);
}

function damageNeutralTarget(state: GameState, ref: TargetRef, rawDamage: number) {
  const damage = Math.max(0, Math.round(rawDamage));

  if (ref.kind === 'hero') {
    const hero = ref.id === state.heroes.player.id ? state.heroes.player : state.heroes.enemy;
    damageHeroByCreature(state, hero, damage);
    return;
  }

  if (ref.kind === 'minion') {
    const minion = state.minions.find((candidate) => candidate.id === ref.id);
    if (!minion || minion.dead || minion.hp <= 0) return;
    damageMinionByCreature(state, minion, damage);
  }
}

function damageHeroByCreature(state: GameState, hero: Hero, damage: number) {
  if (!isHeroAlive(hero)) return;

  let amount = damage;
  if (hero.bearBuffTimer > 0) {
    amount *= JUNGLE_BUFF_BALANCE.bearDamageTakenMultiplier;
  }
  if (hero.dragonBuffTimer > 0) {
    amount *= JUNGLE_BUFF_BALANCE.dragonDamageTakenMultiplier;
  }
  amount = Math.max(0, Math.round(amount));

  const healthDamage = absorbHeroDamage(hero, amount);
  hero.hp -= healthDamage;
  hero.lastDamageTime = state.time;
  pushFloatingText(state, `-${amount}`, hero.position, undefined, '#FFB15F');

  if (hero.hp <= 0) {
    hero.hp = 0;
    hero.respawnTimer = HERO_RESPAWN_SECONDS;
    hero.deathTime = state.time;
    state.heroDeaths[hero.team] += 1;
  }
}

function sameTargetRef(a: TargetRef | null | undefined, b: TargetRef | null | undefined) {
  return Boolean(a && b && a.kind === b.kind && a.id === b.id);
}

function damageMinionByCreature(state: GameState, minion: Minion, damage: number) {
  minion.hp -= damage;
  minion.lastDamageTime = state.time;

  if (minion.hp <= 0) {
    minion.hp = 0;
    minion.dead = true;
    minion.deathTime = state.time;
  }
}
