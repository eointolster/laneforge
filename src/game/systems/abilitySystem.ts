import { ECONOMY_BALANCE, JUNGLE_BUFF_BALANCE, getAbilityStats } from '../balance';
import { ENTITY_LIMITS, TEAM_COLORS } from '../constants';
import { getHeroDefinition } from '../heroes';
import type { AbilityId, GameInput, GameState, Hero, Point, Team } from '../types';
import { clampToMap, distance, normalize, scale, subtract } from '@/utils/math';
import { applyDamage, findNearestTarget, fireProjectileAt, fireProjectileInDirection, isHeroAlive, type Target } from './combatSystem';
import { makeId, pushChainArc, pushEffect, pushFloatingText } from './systemUtils';

const ULTIMATE_CHANNEL_SECONDS = 1;

export function updateAbilitySystem(state: GameState, input: GameInput, dt: number) {
  for (const hero of [state.heroes.player, state.heroes.enemy]) {
    tickHeroAbilityState(state, hero, dt);
  }

  const queued = input.queuedAbilities.splice(0);
  for (const ability of queued) {
    castPlayerAbility(state, ability, input.move);
  }

  castEnemyAbilities(state);
}

function castPlayerAbility(state: GameState, ability: AbilityId, move: Point) {
  const hero = state.heroes.player;
  if (!isHeroAlive(hero) || hero.cooldowns[ability] > 0 || hero.channelTimer > 0) return;

  if (ability === 'bolt') {
    castBolt(state, hero, move);
  } else if (ability === 'dash') {
    castDash(state, hero, move);
  } else if (ability === 'pulse') {
    castPulse(state, hero);
  } else if (ability === 'fireball') {
    castFireball(state, hero, move);
  } else if (ability === 'shield') {
    castShield(state, hero);
  } else if (ability === 'chain') {
    castChainLightning(state, hero, move);
  } else if (ability === 'trap') {
    castTrap(state, hero, move);
  } else {
    castUltimate(state, hero);
  }
}

function castEnemyAbilities(state: GameState) {
  const enemy = state.heroes.enemy;
  if (!isHeroAlive(enemy) || enemy.channelTimer > 0) return;

  const level = state.levelConfig.level;
  const threat = findNearestTarget(state, enemy.team, enemy.position, 410, { includeStructures: false, includeBoss: true, includeJungle: true });
  const heroThreat = findNearestTarget(state, enemy.team, enemy.position, 420, { heroesOnly: true });
  const threatDistance = threat ? distance(enemy.position, threat.position) : Number.POSITIVE_INFINITY;
  const heroThreatDistance = heroThreat ? distance(enemy.position, heroThreat.position) : Number.POSITIVE_INFINITY;

  if (level >= 50 && enemy.cooldowns.ult <= 0 && threat && threatDistance <= getAbilityStats('ult', enemy.abilityLevels.ult).radius + threat.radius * 0.8) {
    castUltimate(state, enemy);
    return;
  }

  if (level >= 12 && enemy.hp < enemy.maxHp * 0.58 && enemy.cooldowns.shield <= 0) {
    castShield(state, enemy);
    return;
  }

  if (enemy.hp < enemy.maxHp * 0.42 && enemy.cooldowns.pulse <= 0) {
    castPulse(state, enemy);
    return;
  }

  if (level >= 35 && enemy.cooldowns.trap <= 0 && heroThreat && heroThreatDistance <= 300) {
    castTrap(state, enemy, subtract(heroThreat.position, enemy.position));
    return;
  }

  if (level >= 20 && enemy.cooldowns.chain <= 0 && threat && threatDistance <= getAbilityStats('chain', enemy.abilityLevels.chain).range) {
    castChainLightning(state, enemy);
    return;
  }

  if (level >= 5 && enemy.cooldowns.fireball <= 0 && threat && threatDistance <= getAbilityStats('fireball', enemy.abilityLevels.fireball).range) {
    castFireball(state, enemy);
    return;
  }

  if (level >= 8 && enemy.cooldowns.dash <= 0 && heroThreat && heroThreatDistance <= 260 && enemy.hp > enemy.maxHp * 0.36) {
    castDash(state, enemy, subtract(heroThreat.position, enemy.position));
    return;
  }

  const boltStats = getAbilityStats('bolt', enemy.abilityLevels.bolt);
  if (threat && threatDistance <= boltStats.range && enemy.cooldowns.bolt <= 0) {
    castBolt(state, enemy);
  }
}

function castBolt(state: GameState, hero: Hero, move?: Point) {
  const ability = getAbilityStats('bolt', hero.abilityLevels.bolt);
  const tier = masteryTier(hero, 'bolt');
  const target = findNearestTarget(state, hero.team, hero.position, ability.range, { includeStructures: true, includeJungle: true });
  const direction = target ? normalize(subtract(target.position, hero.position)) : getCastDirection(hero, move);

  if (target) {
    markHeroTarget(hero, target, state.time);
  }
  hero.facing = direction;
  markHeroCast(hero, 'bolt', state.time);
  pushEffect(state, 'bolt', hero.position, 48 + tier * 8, 0.24 + tier * 0.04, masteryColor(hero, 'bolt', '#9CEEFF'));
  const projectileDamage = abilityDamage(state, hero, ability.damage + (hero.level - 1) * 12);
  const options = {
    masteryTier: tier,
    pierceRemaining: tier >= 2 ? 1 : 0,
    ttl: ability.range / 560 + 0.45,
  };

  if (target) {
    fireProjectileAt(state, hero.team, hero.position, target.ref, projectileDamage, 'bolt', 560, 34, options);
  } else {
    fireProjectileInDirection(state, hero.team, hero.position, direction, projectileDamage, 'bolt', 560, 34, options);
  }
  hero.cooldowns.bolt = ability.cooldown;
}

function castDash(state: GameState, hero: Hero, move: Point) {
  const ability = getAbilityStats('dash', hero.abilityLevels.dash);
  const tier = masteryTier(hero, 'dash');
  const target = findNearestTarget(state, hero.team, hero.position, 320, { includeStructures: false, includeBoss: true, includeJungle: true });
  let direction = normalize(move);

  if (Math.hypot(direction.x, direction.y) < 0.1 && target) {
    direction = normalize(subtract(target.position, hero.position));
  }

  if (Math.hypot(direction.x, direction.y) < 0.1) {
    direction = { x: hero.team === 'blue' ? 1 : -1, y: 0 };
  }

  const velocity = scale(direction, ability.range / 0.18);
  hero.dashTimer = 0.18;
  hero.dashVelocity = velocity;
  hero.facing = direction;
  hero.dashImpactTimer = 0.19;
  hero.dashImpactDamage = abilityDamage(state, hero, ability.damage + (hero.level - 1) * 8);
  markHeroCast(hero, 'dash', state.time);
  hero.cooldowns.dash = ability.cooldown;
  if (tier >= 2) {
    hero.shield = Math.min(260 + hero.level * 22, hero.shield + Math.round(ability.damage * 0.42));
    hero.shieldTimer = Math.max(hero.shieldTimer, 1.8);
  }
  pushEffect(state, 'dash', hero.position, ability.radius, 0.24, masteryColor(hero, 'dash'));
}

function castPulse(state: GameState, hero: Hero) {
  const ability = getAbilityStats('pulse', hero.abilityLevels.pulse);
  const tier = masteryTier(hero, 'pulse');
  const healAmount = Math.round(28 + hero.level * 5 + ability.damage * 0.14);
  if (tier >= 2) {
    hero.rootTimer = 0;
  }
  hero.shield = Math.min(130 + hero.level * 16 + tier * 32, hero.shield + 74 + hero.level * 10 + tier * 18);
  hero.shieldTimer = 2.8 + tier * 0.3;
  hero.hp = Math.min(hero.maxHp, hero.hp + healAmount);
  markHeroCast(hero, 'pulse', state.time);
  hero.cooldowns.pulse = ability.cooldown;
  applyAreaDamage(state, hero.team, hero.position, ability.radius, abilityDamage(state, hero, ability.damage + (hero.level - 1) * 8));
  pushEffect(state, 'pulse', hero.position, ability.radius, 0.45 + tier * 0.08, masteryColor(hero, 'pulse', '#56F28C'));
  pushFloatingText(state, `+${healAmount}`, hero.position, undefined, '#67F58F');
}

function castFireball(state: GameState, hero: Hero, move?: Point) {
  const ability = getAbilityStats('fireball', hero.abilityLevels.fireball);
  const tier = masteryTier(hero, 'fireball');
  const target = findNearestTarget(state, hero.team, hero.position, ability.range, { includeStructures: true, includeBoss: true, includeJungle: true });
  const direction = target ? normalize(subtract(target.position, hero.position)) : getCastDirection(hero, move);

  if (target) {
    markHeroTarget(hero, target, state.time);
  }
  hero.facing = direction;
  markHeroCast(hero, 'fireball', state.time);
  const projectileDamage = abilityDamage(state, hero, ability.damage + (hero.level - 1) * 14);
  const options = {
    masteryTier: tier,
    ttl: ability.range / 310 + 0.65,
  };

  if (target) {
    fireProjectileAt(state, hero.team, hero.position, target.ref, projectileDamage, 'fireball', 310, ability.radius, options);
  } else {
    fireProjectileInDirection(state, hero.team, hero.position, direction, projectileDamage, 'fireball', 310, ability.radius, options);
  }
  hero.cooldowns.fireball = ability.cooldown;
  pushEffect(state, 'fireball', hero.position, 54 + tier * 12, 0.3 + tier * 0.04, tier >= 2 ? '#FFD36A' : tier >= 1 ? '#FF9F2F' : '#FFB15F');
}

function castShield(state: GameState, hero: Hero) {
  const ability = getAbilityStats('shield', hero.abilityLevels.shield);
  const tier = masteryTier(hero, 'shield');
  hero.shield = Math.min(320 + hero.level * 24, hero.shield + ability.damage + hero.level * 14);
  hero.shieldTimer = 4 + tier * 0.35;
  markHeroCast(hero, 'shield', state.time);
  hero.cooldowns.shield = ability.cooldown;
  if (tier >= 2) {
    applyAreaDamage(state, hero.team, hero.position, 128, abilityDamage(state, hero, ability.damage * 0.34));
  }
  pushEffect(state, 'shield', hero.position, 92 + tier * 14, 0.55 + tier * 0.08, masteryColor(hero, 'shield'));
}

function castChainLightning(state: GameState, hero: Hero, move?: Point) {
  const ability = getAbilityStats('chain', hero.abilityLevels.chain);
  const tier = masteryTier(hero, 'chain');
  const hitIds = new Set<string>();
  let origin = hero.position;
  let didHit = false;
  const bounceCount = 3 + tier;

  for (let bounce = 0; bounce < bounceCount; bounce += 1) {
    const target = findChainTarget(state, hero.team, origin, bounce === 0 ? ability.range : ability.radius, hitIds);
    if (!target) break;

    if (!didHit) {
      markHeroTarget(hero, target, state.time);
      hero.facing = normalize(subtract(target.position, hero.position));
    }
    hitIds.add(`${target.ref.kind}:${target.ref.id}`);
    pushChainArc(state, hero.team, origin, target.position, 0.26 + tier * 0.04, masteryColor(hero, 'chain', '#9CEEFF'));
    applyDamage(state, target.ref, abilityDamage(state, hero, ability.damage + (hero.level - 1) * 8), hero.team);
    pushEffect(state, 'chain', target.position, 46 + tier * 8, 0.22 + tier * 0.03, masteryColor(hero, 'chain', '#9CEEFF'));
    origin = target.position;
    didHit = true;
  }

  markHeroCast(hero, 'chain', state.time);

  if (!didHit) {
    const direction = getCastDirection(hero, move);
    const end = clampToMap({
      x: hero.position.x + direction.x * Math.min(ability.range, 300),
      y: hero.position.y + direction.y * Math.min(ability.range, 300),
    }, 24);
    hero.facing = direction;
    pushChainArc(state, hero.team, hero.position, end, 0.26 + tier * 0.04, masteryColor(hero, 'chain', '#9CEEFF'));
    pushEffect(state, 'chain', end, 42 + tier * 8, 0.22 + tier * 0.03, masteryColor(hero, 'chain', '#9CEEFF'));
  }

  pushEffect(state, 'chain', hero.position, 64 + tier * 12, 0.32 + tier * 0.04, masteryColor(hero, 'chain', '#9CEEFF'));
  hero.cooldowns.chain = ability.cooldown;
}

function getCastDirection(hero: Hero, move?: Point) {
  let direction = normalize(move ?? hero.facing);

  if (Math.hypot(direction.x, direction.y) < 0.1) {
    direction = normalize(hero.facing);
  }

  if (Math.hypot(direction.x, direction.y) < 0.1) {
    direction = { x: hero.team === 'blue' ? 1 : -1, y: 0 };
  }

  return direction;
}

function castTrap(state: GameState, hero: Hero, move: Point) {
  const ability = getAbilityStats('trap', hero.abilityLevels.trap);
  const tier = masteryTier(hero, 'trap');
  let direction = normalize(move);
  if (Math.hypot(direction.x, direction.y) < 0.1) {
    direction = normalize(hero.facing);
  }
  if (Math.hypot(direction.x, direction.y) < 0.1) {
    direction = { x: hero.team === 'blue' ? 1 : -1, y: 0 };
  }

  const position = {
    x: hero.position.x + direction.x * ability.range,
    y: hero.position.y + direction.y * ability.range,
  };
  const trapDamage = abilityDamage(state, hero, ability.damage + (hero.level - 1) * 5);
  pushTrap(state, hero, position, ability.radius, trapDamage, ability.rootDuration ?? 1.5, 8 + tier);
  if (tier >= 2) {
    const side = { x: -direction.y, y: direction.x };
    const offset = ability.radius * 0.82;
    for (const sign of [-1, 1]) {
      pushTrap(
        state,
        hero,
        { x: position.x + side.x * offset * sign, y: position.y + side.y * offset * sign },
        Math.round(ability.radius * 0.72),
        Math.round(trapDamage * 0.64),
        Math.max(0.8, (ability.rootDuration ?? 1.5) * 0.72),
        7,
      );
    }
  }
  markHeroCast(hero, 'trap', state.time);
  hero.cooldowns.trap = ability.cooldown;
  pushEffect(state, 'trap', position, ability.radius + tier * 12, 0.35 + tier * 0.08, masteryColor(hero, 'trap'));
}

function castUltimate(state: GameState, hero: Hero) {
  const ability = getAbilityStats('ult', hero.abilityLevels.ult);
  const tier = masteryTier(hero, 'ult');
  hero.channelTimer = ULTIMATE_CHANNEL_SECONDS;
  hero.channelAbility = 'ult';
  hero.channelRadius = ability.radius;
  hero.channelDamage = abilityDamage(state, hero, ability.damage + (hero.level - 1) * 18 + tier * 26);
  hero.dashTimer = 0;
  hero.dashVelocity = { x: 0, y: 0 };
  markHeroCast(hero, 'ult', state.time);
  hero.cooldowns.ult = ability.cooldown;
  pushEffect(state, 'ult', hero.position, ability.radius * 0.72, ULTIMATE_CHANNEL_SECONDS, masteryColor(hero, 'ult'));
}

function tickHeroAbilityState(state: GameState, hero: Hero, dt: number) {
  for (const key of Object.keys(hero.cooldowns) as AbilityId[]) {
    hero.cooldowns[key] = Math.max(0, hero.cooldowns[key] - dt);
  }

  if (hero.shieldTimer > 0) {
    hero.shieldTimer = Math.max(0, hero.shieldTimer - dt);
    if (hero.shieldTimer <= 0) {
      hero.shield = 0;
    }
  }

  if (hero.dashImpactTimer > 0) {
    hero.dashImpactTimer = Math.max(0, hero.dashImpactTimer - dt);
    if (hero.dashImpactTimer <= 0) {
      const ability = getAbilityStats('dash', hero.abilityLevels.dash);
      applyAreaDamage(state, hero.team, hero.position, ability.radius, hero.dashImpactDamage);
      pushEffect(state, 'dash', hero.position, ability.radius, 0.28, TEAM_COLORS[hero.team].main);
    }
  }

  if (!isHeroAlive(hero)) {
    cancelHeroChannel(hero);
    return;
  }

  if (hero.channelTimer > 0) {
    hero.channelTimer = Math.max(0, hero.channelTimer - dt);
    if (hero.channelTimer <= 0 && hero.channelAbility === 'ult') {
      const hitCount = applyAreaDamage(state, hero.team, hero.position, hero.channelRadius, hero.channelDamage);
      if (masteryTier(hero, 'ult') >= 2 && hitCount > 0) {
        hero.shield = Math.min(hero.maxHp * 0.38, hero.shield + hitCount * 42);
        hero.shieldTimer = Math.max(hero.shieldTimer, 4);
      }
      pushEffect(state, 'ult', hero.position, hero.channelRadius, 0.9, masteryColor(hero, 'ult'));
      pushFloatingText(state, 'Storm', hero.position, undefined, TEAM_COLORS[hero.team].soft);
      cancelHeroChannel(hero);
    }
  }
}

function masteryTier(hero: Hero, ability: AbilityId): 0 | 1 | 2 {
  const level = hero.abilityLevels[ability] ?? 1;
  if (level >= 10) return 2;
  if (level >= 5) return 1;
  return 0;
}

function masteryColor(hero: Hero, ability: AbilityId, fallback = TEAM_COLORS[hero.team].main) {
  const tier = masteryTier(hero, ability);
  if (tier >= 2) return ability === 'pulse' ? '#D7FFE4' : '#FFD36A';
  if (tier >= 1) return ability === 'pulse' ? '#7CFFB0' : '#C7A5FF';
  return fallback;
}

function abilityDamage(state: GameState, hero: Hero, rawDamage: number) {
  const difficultyScale = hero.team === 'red' ? state.levelConfig.enemyDamageMultiplier : 1;
  const matchLevelScale = 0.86 + Math.min(0.24, Math.max(0, hero.level - 1) * 0.04);
  const classScale = getHeroDefinition(hero.heroClass).stats.abilityDamageMultiplier;
  const bossBuffScale = hero.bossBuffTimer > 0 ? 1.1 : 1;
  const weaponBoostScale = hero.weaponBoostTimer > 0 ? ECONOMY_BALANCE.baseForgeDamageMultiplier : 1;
  const dragonBuffScale = hero.dragonBuffTimer > 0 ? JUNGLE_BUFF_BALANCE.dragonDamageMultiplier : 1;
  return Math.round(rawDamage * classScale * matchLevelScale * difficultyScale * bossBuffScale * weaponBoostScale * dragonBuffScale);
}

function pushTrap(
  state: GameState,
  hero: Hero,
  position: Point,
  radius: number,
  damage: number,
  rootDuration: number,
  ttl: number,
) {
  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(radius) ||
    !Number.isFinite(damage) ||
    !Number.isFinite(rootDuration) ||
    !Number.isFinite(ttl)
  ) {
    return;
  }

  const safeRadius = Math.max(12, Math.min(180, Math.round(radius)));
  state.traps.push({
    id: makeId(state, 'trap'),
    team: hero.team,
    position: clampToMap(position, safeRadius),
    radius: safeRadius,
    damage: Math.max(0, Math.round(damage)),
    rootDuration: Math.max(0.2, Math.min(6, rootDuration)),
    ttl: Math.max(0.2, Math.min(12, ttl)),
    triggered: false,
  });

  if (state.traps.length > ENTITY_LIMITS.traps) {
    state.traps = state.traps.slice(state.traps.length - ENTITY_LIMITS.traps);
  }
}

function markHeroTarget(hero: Hero, target: Target, time: number) {
  hero.lastTargetRef = { ...target.ref };
  hero.lastTargetTime = time;
}

function markHeroCast(hero: Hero, ability: AbilityId, time: number) {
  hero.lastCastTime = time;
  hero.lastCastAbility = ability;
}

function cancelHeroChannel(hero: Hero) {
  hero.channelTimer = 0;
  hero.channelAbility = null;
  hero.channelRadius = 0;
  hero.channelDamage = 0;
}

function applyAreaDamage(state: GameState, team: Team, center: Point, radius: number, damage: number) {
  let hitCount = 0;

  for (const minion of state.minions) {
    if (minion.team === team || minion.dead || minion.hp <= 0) continue;
    if (distance(center, minion.position) <= radius + minion.radius) {
      applyDamage(state, { kind: 'minion', id: minion.id }, damage, team);
      hitCount += 1;
    }
  }

  const enemyHero = team === 'blue' ? state.heroes.enemy : state.heroes.player;
  if (isHeroAlive(enemyHero) && distance(center, enemyHero.position) <= radius + enemyHero.radius) {
    applyDamage(state, { kind: 'hero', id: enemyHero.id }, damage, team);
    hitCount += 1;
  }

  if (state.jungleBoss?.alive && distance(center, state.jungleBoss.position) <= radius + state.jungleBoss.radius) {
    applyDamage(state, { kind: 'boss', id: state.jungleBoss.id }, damage, team);
    hitCount += 1;
  }

  for (const creature of state.jungleCreatures) {
    if (!creature.alive || creature.hp <= 0) continue;
    if (distance(center, creature.position) <= radius + creature.radius) {
      applyDamage(state, { kind: 'jungle', id: creature.id }, damage, team);
      hitCount += 1;
    }
  }

  return hitCount;
}

function findChainTarget(
  state: GameState,
  team: Team,
  origin: Point,
  range: number,
  hitIds: Set<string>,
): Target | null {
  const enemyTeam = team === 'blue' ? 'red' : 'blue';
  let best: Target | null = null;
  let bestDistance = range;

  const consider = (target: Target) => {
    if (hitIds.has(`${target.ref.kind}:${target.ref.id}`)) return;
    const targetDistance = distance(origin, target.position);
    if (targetDistance <= bestDistance) {
      best = target;
      bestDistance = targetDistance;
    }
  };

  for (const minion of state.minions) {
    if (minion.team !== enemyTeam || minion.dead || minion.hp <= 0) continue;
    consider({
      ref: { kind: 'minion', id: minion.id },
      team: minion.team,
      position: minion.position,
      radius: minion.radius,
      hp: minion.hp,
      maxHp: minion.maxHp,
    });
  }

  const enemyHero = team === 'blue' ? state.heroes.enemy : state.heroes.player;
  if (isHeroAlive(enemyHero)) {
    consider({
      ref: { kind: 'hero', id: enemyHero.id },
      team: enemyHero.team,
      position: enemyHero.position,
      radius: enemyHero.radius,
      hp: enemyHero.hp,
      maxHp: enemyHero.maxHp,
    });
  }

  if (state.jungleBoss?.alive && state.jungleBoss.hp > 0) {
    consider({
      ref: { kind: 'boss', id: state.jungleBoss.id },
      team: enemyTeam,
      position: state.jungleBoss.position,
      radius: state.jungleBoss.radius,
      hp: state.jungleBoss.hp,
      maxHp: state.jungleBoss.maxHp,
    });
  }

  for (const creature of state.jungleCreatures) {
    if (!creature.alive || creature.hp <= 0) continue;
    consider({
      ref: { kind: 'jungle', id: creature.id },
      team: enemyTeam,
      position: creature.position,
      radius: creature.radius,
      hp: creature.hp,
      maxHp: creature.maxHp,
    });
  }

  return best;
}
