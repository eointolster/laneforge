import { BOSS_BALANCE, ECONOMY_BALANCE, GOLD_BOUNTY, JUNGLE_BUFF_BALANCE, JUNGLE_CREATURE_BALANCE, MINION_BALANCE, POWERUP_BALANCE, WARNING_BALANCE } from '../balance';
import { TEAM_COLORS } from '../constants';
import { getHeroDefinition } from '../heroes';
import type { GameState, Hero, MatchGoalId, Minion, Point, Projectile, Structure, TargetRef, Team } from '../types';
import { distance, distanceSq, normalize, subtract } from '@/utils/math';
import { makeId, otherTeam, pushEffect, pushFloatingText, pushGameEvent, pushWarning } from './systemUtils';

const HERO_REWARD_RADIUS = 620;

export type Target = {
  ref: TargetRef;
  team: Team;
  position: Point;
  radius: number;
  hp: number;
  maxHp: number;
};

export function isHeroAlive(hero: Hero) {
  return hero.hp > 0 && hero.respawnTimer <= 0;
}

export function getHeroForTeam(state: GameState, team: Team) {
  return team === 'blue' ? state.heroes.player : state.heroes.enemy;
}

export function getTarget(state: GameState, ref: TargetRef): Target | null {
  if (ref.kind === 'hero') {
    const hero = ref.id === state.heroes.player.id ? state.heroes.player : state.heroes.enemy;
    if (!isHeroAlive(hero)) return null;
    return {
      ref,
      team: hero.team,
      position: hero.position,
      radius: hero.radius,
      hp: hero.hp,
      maxHp: hero.maxHp,
    };
  }

  if (ref.kind === 'minion') {
    const minion = state.minions.find((candidate) => candidate.id === ref.id && !candidate.dead);
    if (!minion || minion.hp <= 0) return null;
    return toTarget(minion, ref);
  }

  if (ref.kind === 'boss') {
    const boss = state.jungleBoss;
    if (!boss || !boss.alive || boss.hp <= 0) return null;
    return toTarget(boss, ref, otherTeam(boss.targetRef?.kind === 'hero' && boss.targetRef.id === state.heroes.player.id ? 'blue' : 'red'));
  }

  if (ref.kind === 'jungle') {
    const creature = state.jungleCreatures.find((candidate) => candidate.id === ref.id && candidate.alive);
    if (!creature || creature.hp <= 0) return null;
    return toTarget(creature, ref, 'red');
  }

  const structure = state.structures.find((candidate) => candidate.id === ref.id && candidate.alive);
  if (!structure || structure.hp <= 0) return null;
  return toTarget(structure, ref);
}

export function findNearestTarget(
  state: GameState,
  team: Team,
  position: Point,
  range: number,
  options: { includeStructures?: boolean; includeBoss?: boolean; includeJungle?: boolean; laneOnly?: string; heroesOnly?: boolean; includeHeroes?: boolean } = {},
): Target | null {
  const enemy = otherTeam(team);
  let best: Target | null = null;
  let bestDistance = range * range;

  const consider = (target: Target) => {
    const ds = distanceSq(position, target.position);
    if (ds <= bestDistance) {
      best = target;
      bestDistance = ds;
    }
  };

  if (!options.heroesOnly) {
    for (const minion of state.minions) {
      if (minion.team !== enemy || minion.dead || minion.hp <= 0) continue;
      if (options.laneOnly && minion.lane !== options.laneOnly) continue;
      consider(toTarget(minion, { kind: 'minion', id: minion.id }));
    }
  }

  if (options.includeHeroes !== false) {
    const enemyHero = getHeroForTeam(state, enemy);
    if (isHeroAlive(enemyHero)) {
      consider(toTarget(enemyHero, { kind: 'hero', id: enemyHero.id }));
    }
  }

  if (options.includeBoss && state.jungleBoss?.alive && state.jungleBoss.hp > 0) {
    consider(toTarget(state.jungleBoss, { kind: 'boss', id: state.jungleBoss.id }, enemy));
  }

  if (options.includeJungle && !options.heroesOnly) {
    for (const creature of state.jungleCreatures) {
      if (!creature.alive || creature.hp <= 0) continue;
      consider(toTarget(creature, { kind: 'jungle', id: creature.id }, enemy));
    }
  }

  if (options.includeStructures && !options.heroesOnly) {
    for (const structure of state.structures) {
      if (structure.team !== enemy || !structure.alive || structure.hp <= 0) continue;
      if (options.laneOnly && structure.lane && structure.lane !== options.laneOnly) continue;
      consider(toTarget(structure, { kind: 'structure', id: structure.id }));
    }
  }

  return best;
}

export function applyDamage(state: GameState, ref: TargetRef, rawDamage: number, sourceTeam: Team) {
  let amount = Math.max(0, Math.round(rawDamage));

  if (ref.kind === 'hero') {
    const hero = ref.id === state.heroes.player.id ? state.heroes.player : state.heroes.enemy;
    if (!isHeroAlive(hero)) return;
    if (hero.team !== sourceTeam) {
      amount = applyHeroDamageReduction(hero, amount);
    }

    const healthDamage = absorbHeroDamage(hero, amount);
    hero.hp -= healthDamage;
    hero.lastDamageTime = state.time;
    recordDamage(state, sourceTeam, hero.team, healthDamage);
    pushFloatingText(state, `${amount}`, hero.position, sourceTeam);

    if (hero.hp <= 0) {
      hero.hp = 0;
      hero.respawnTimer = 8;
      hero.deathTime = state.time;
      state.heroDeaths[hero.team] += 1;
      grantHeroXp(state, sourceTeam, 80, hero.position);
      grantHeroGold(state, sourceTeam, GOLD_BOUNTY.hero, hero.position);
      state.teamKills[sourceTeam] += 1;
      pushGameEvent(state, 'hero_kill', sourceTeam, 'Champion slain');
      pushEffect(state, 'hit', hero.position, 58, 0.42, TEAM_COLORS[sourceTeam].main);
    }
    return;
  }

  if (ref.kind === 'minion') {
    const minion = state.minions.find((candidate) => candidate.id === ref.id);
    if (!minion || minion.dead || minion.hp <= 0) return;
    recordDamage(state, sourceTeam, minion.team, Math.min(amount, minion.hp));
    minion.hp -= amount;
    minion.lastDamageTime = state.time;

    if (minion.hp <= 0) {
      minion.dead = true;
      minion.deathTime = state.time;
      grantHeroXp(state, sourceTeam, minion.bountyXp, minion.position);
      grantHeroGold(state, sourceTeam, GOLD_BOUNTY[minion.kind], minion.position);
      pushEffect(state, 'hit', minion.position, 32, 0.26, TEAM_COLORS[sourceTeam].main);
    }
    return;
  }

  if (ref.kind === 'boss') {
    const boss = state.jungleBoss;
    if (!boss || !boss.alive || boss.hp <= 0) return;
    recordDamage(state, sourceTeam, 'red', Math.min(amount, boss.hp));
    boss.hp -= amount;
    boss.lastDamageTime = state.time;

    if (boss.hp <= 0) {
      boss.hp = 0;
      boss.alive = false;
      boss.deathTime = state.time;
      boss.respawnTimer = BOSS_BALANCE.respawnSeconds;
      boss.targetRef = null;
      const hero = getHeroForTeam(state, sourceTeam);
      grantHeroXp(state, sourceTeam, BOSS_BALANCE.xpReward, boss.position);
      hero.bossBuffTimer = BOSS_BALANCE.buffSeconds;
      grantHeroGold(state, sourceTeam, GOLD_BOUNTY.boss, boss.position);
      pushGameEvent(state, 'boss_kill', sourceTeam, 'Dragon slain');
      pushEffect(state, 'hit', boss.position, boss.radius + 120, 0.9, TEAM_COLORS[sourceTeam].main);
    }
    return;
  }

  if (ref.kind === 'jungle') {
    const creature = state.jungleCreatures.find((candidate) => candidate.id === ref.id);
    if (!creature || !creature.alive || creature.hp <= 0) return;
    recordDamage(state, sourceTeam, 'red', Math.min(amount, creature.hp));
    creature.hp -= amount;
    creature.lastDamageTime = state.time;
    creature.targetRef = heroRefForTeam(state, sourceTeam);

    if (creature.hp <= 0) {
      creature.hp = 0;
      creature.alive = false;
      creature.deathTime = state.time;
      creature.respawnTimer = JUNGLE_CREATURE_BALANCE[creature.kind].respawnSeconds;
      creature.targetRef = null;
      const xpGranted = grantHeroXp(state, sourceTeam, creature.bountyXp, creature.position);
      grantHeroGold(state, sourceTeam, creature.bountyGold, creature.position);
      if (xpGranted) {
        applyJungleCreatureBuff(state, sourceTeam, creature.kind, creature.position, creature.radius);
        advancePlayerGoal(state, 'jungle-clears', 1, creature.position);
        if (creature.kind === 'dragon') {
          advancePlayerGoal(state, 'dragon-hunt', 1, creature.position);
        }
      }
      if (xpGranted) {
        pushFloatingText(state, `+${creature.bountyXp} XP`, creature.position, sourceTeam, '#BFFFFF');
      }
      pushFloatingText(state, `+${creature.bountyGold}g`, {
        x: creature.position.x,
        y: creature.position.y + creature.radius * 0.7,
      }, sourceTeam, '#FFD36A');
      pushEffect(state, 'hit', creature.position, creature.radius + 42, 0.44, TEAM_COLORS[sourceTeam].main);
    } else {
      pushFloatingText(state, `${amount}`, creature.position, sourceTeam, TEAM_COLORS[sourceTeam].soft);
    }
    return;
  }

  const structure = state.structures.find((candidate) => candidate.id === ref.id);
  if (!structure || !structure.alive || structure.hp <= 0) return;
  recordDamage(state, sourceTeam, structure.team, Math.min(amount, structure.hp));
  structure.hp -= amount;
  structure.lastDamageTime = state.time;

  if (structure.hp <= 0) {
    structure.hp = 0;
    structure.alive = false;
    grantHeroXp(state, sourceTeam, structure.kind === 'core' ? 0 : 120, structure.position);
    if (structure.kind === 'tower') {
      if (sourceTeam === 'blue') {
        state.matchStats.towersDestroyed += 1;
      }
      grantHeroGold(state, sourceTeam, GOLD_BOUNTY.tower, structure.position);
      pushGameEvent(state, 'structure_destroy', sourceTeam, structureDestroyedMessage(structure, sourceTeam));
      if (sourceTeam === 'blue' && structure.lane === 'top') {
        advancePlayerGoal(state, 'top-tower', 1, structure.position);
      }
    }
    pushEffect(state, 'hit', structure.position, structure.radius + 38, 0.62, TEAM_COLORS[sourceTeam].main);
  }
}

function structureDestroyedMessage(structure: Structure, sourceTeam: Team) {
  const targetTeam = otherTeam(sourceTeam) === 'blue' ? 'Blue' : 'Red';
  const lane = structure.lane ? `${structure.lane[0].toUpperCase()}${structure.lane.slice(1)} ` : '';
  const towerLine = structure.id.includes('mid-tower') ? 'mid tower' : 'base tower';
  return `${targetTeam} ${lane}${towerLine} destroyed`;
}

export function updateCombat(state: GameState, dt: number) {
  for (const hero of [state.heroes.player, state.heroes.enemy]) {
    if (!isHeroAlive(hero)) continue;
    hero.bossBuffTimer = Math.max(0, hero.bossBuffTimer - dt);
    hero.bearBuffTimer = Math.max(0, hero.bearBuffTimer - dt);
    hero.dragonBuffTimer = Math.max(0, hero.dragonBuffTimer - dt);
    hero.weaponBoostTimer = Math.max(0, hero.weaponBoostTimer - dt);
    hero.attackSpeedBoostTimer = Math.max(0, hero.attackSpeedBoostTimer - dt);
    hero.attackCooldown = Math.max(0, hero.attackCooldown - dt);
    if (hero.channelTimer > 0) continue;

    const heroStats = getHeroDefinition(hero.heroClass).stats;
    const target = findNearestTarget(state, hero.team, hero.position, heroStats.attackRange, { includeStructures: true, includeBoss: true, includeJungle: true });
    if (target) {
      hero.lastTargetRef = { ...target.ref };
      hero.lastTargetTime = state.time;
    } else if (state.time - hero.lastTargetTime > 0.65) {
      hero.lastTargetRef = null;
      hero.warningTargetRef = null;
      hero.warningTimer = 0;
    }

    if (target && hero.attackCooldown <= 0) {
      if (hero.team === 'red') {
        if (!sameTargetRef(hero.warningTargetRef, target.ref) || (hero.warningTimer ?? 0) <= 0) {
          hero.warningTargetRef = { ...target.ref };
          hero.warningTimer = WARNING_BALANCE.heroLeadSeconds;
          pushWarning(state, 'hero', hero.team, hero.position, target.position, target.radius + 32, WARNING_BALANCE.heroLeadSeconds, TEAM_COLORS.red.soft);
          continue;
        }

        pushWarning(state, 'hero', hero.team, hero.position, target.position, target.radius + 32, hero.warningTimer ?? WARNING_BALANCE.heroLeadSeconds, TEAM_COLORS.red.soft);
        hero.warningTimer = Math.max(0, (hero.warningTimer ?? 0) - dt);

        if (hero.warningTimer > 0) {
          continue;
        }
      }

      hero.facing = normalize(subtract(target.position, hero.position));
      hero.lastAttackTime = state.time;
      const speedBoosted = hero.attackSpeedBoostTimer > 0;
      fireProjectileAt(
        state,
        hero.team,
        hero.position,
        target.ref,
        heroDamage(state, hero),
        'basic',
        420 * (speedBoosted ? POWERUP_BALANCE.projectileSpeedMultiplier : 1),
      );
      hero.attackCooldown = heroStats.attackSpeed * (speedBoosted ? POWERUP_BALANCE.attackCooldownMultiplier : 1);
      hero.warningTargetRef = null;
      hero.warningTimer = 0;
    } else if (!target || hero.attackCooldown > 0) {
      hero.warningTargetRef = null;
      hero.warningTimer = 0;
    }
  }

  for (const minion of state.minions) {
    if (minion.dead || minion.hp <= 0) continue;
    minion.attackCooldown = Math.max(0, minion.attackCooldown - dt);
    const target = findNearestTarget(state, minion.team, minion.position, minion.attackRange, {
      includeStructures: true,
      laneOnly: minion.lane,
    });

    if (target && minion.attackCooldown <= 0) {
      minion.facing = normalize(subtract(target.position, minion.position));
      minion.lastAttackTime = state.time;
      const minionDamage = getMinionDamage(state, minion);
      if (minion.kind === 'spark') {
        fireProjectileAt(state, minion.team, minion.position, target.ref, minionDamage, 'spark', 360);
      } else {
        applyDamage(state, target.ref, minionDamage, minion.team);
        pushEffect(
          state,
          'hit',
          target.position,
          minion.kind === 'guard' ? target.radius + 26 : target.radius + 18,
          0.2,
          TEAM_COLORS[minion.team].main,
        );
      }
      minion.attackCooldown = MINION_BALANCE[minion.kind].cooldown;
    }
  }

  state.minions = state.minions.filter((minion) => !minion.dead || state.time - minion.deathTime < 0.32);
}

export function updateHeroRegen(state: GameState, dt: number) {
  for (const hero of [state.heroes.player, state.heroes.enemy]) {
    if (!isHeroAlive(hero)) continue;
    if (hero.bearBuffTimer > 0) {
      hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * JUNGLE_BUFF_BALANCE.bearRegenPerSecond * dt);
    }
    if (state.time - hero.lastDamageTime <= 4) continue;
    hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * 0.012 * dt);
  }
}

export function fireProjectileAt(
  state: GameState,
  team: Team,
  origin: Point,
  target: TargetRef,
  damage: number,
  kind: Projectile['kind'],
  speed: number,
  splashRadius?: number,
  options: { masteryTier?: 0 | 1 | 2; pierceRemaining?: number; ttl?: number } = {},
) {
  const targetEntity = getTarget(state, target);
  const fallbackDirection = { x: team === 'blue' ? 1 : -1, y: 0 };
  const direction = normalize(targetEntity ? subtract(targetEntity.position, origin) : fallbackDirection);

  spawnProjectile(state, team, origin, direction, target, damage, kind, speed, splashRadius, options);
}

export function absorbHeroDamage(hero: Hero, amount: number) {
  let remaining = Math.max(0, Math.round(amount));
  const shieldUsed = Math.min(hero.shield, remaining);
  hero.shield -= shieldUsed;
  remaining -= shieldUsed;

  if (remaining > 0 && hero.powerShield > 0) {
    const powerShieldUsed = Math.min(hero.powerShield, remaining);
    hero.powerShield -= powerShieldUsed;
    remaining -= powerShieldUsed;
    if (hero.powerShield <= 0) {
      hero.powerShield = 0;
      hero.powerShieldMax = 0;
    }
  }

  return remaining;
}

export function fireProjectileInDirection(
  state: GameState,
  team: Team,
  origin: Point,
  directionInput: Point,
  damage: number,
  kind: Projectile['kind'],
  speed: number,
  splashRadius?: number,
  options: { masteryTier?: 0 | 1 | 2; pierceRemaining?: number; ttl?: number } = {},
) {
  const direction = normalize(directionInput);

  spawnProjectile(state, team, origin, direction, undefined, damage, kind, speed, splashRadius, options);
}

function spawnProjectile(
  state: GameState,
  team: Team,
  origin: Point,
  directionInput: Point,
  target: TargetRef | undefined,
  damage: number,
  kind: Projectile['kind'],
  speed: number,
  splashRadius?: number,
  options: { masteryTier?: 0 | 1 | 2; pierceRemaining?: number; ttl?: number } = {},
) {
  const fallbackDirection = { x: team === 'blue' ? 1 : -1, y: 0 };
  let direction = directionInput;
  if (Math.hypot(direction.x, direction.y) < 0.001) {
    direction = fallbackDirection;
  }
  if (!Number.isFinite(direction.x) || !Number.isFinite(direction.y) || !Number.isFinite(speed) || speed <= 0) {
    return;
  }

  const spawnPosition = {
    x: origin.x + direction.x * 18,
    y: origin.y + direction.y * 18,
  };

  state.projectiles.push({
    id: makeId(state, 'projectile'),
    team,
    kind,
    position: spawnPosition,
    velocity: { x: direction.x * speed, y: direction.y * speed },
    radius: projectileRadius(kind, options.masteryTier ?? 0),
    damage,
    target,
    splashRadius,
    masteryTier: options.masteryTier,
    pierceRemaining: options.pierceRemaining,
    hitRefs: options.pierceRemaining ? [] : undefined,
    ttl: options.ttl ?? 2.2,
  });
}

function projectileRadius(kind: Projectile['kind'], masteryTier: 0 | 1 | 2) {
  const base = kind === 'fireball' ? 16 : kind === 'tower' ? 8 : kind === 'chain' ? 9 : 7;
  return masteryTier > 0 ? Math.round(base * (1 + masteryTier * 0.18)) : base;
}

function heroDamage(state: GameState, hero: Hero) {
  const heroStats = getHeroDefinition(hero.heroClass).stats;
  const base = heroStats.damage + (hero.level - 1) * heroStats.levelDamage;
  const scaled = hero.team === 'red' ? base * state.levelConfig.enemyDamageMultiplier : base;
  const bossBuffScale = hero.bossBuffTimer > 0 ? 1.1 : 1;
  const weaponBoostScale = hero.weaponBoostTimer > 0 ? ECONOMY_BALANCE.baseForgeDamageMultiplier : 1;
  const dragonBuffScale = hero.dragonBuffTimer > 0 ? JUNGLE_BUFF_BALANCE.dragonDamageMultiplier : 1;
  return scaled * bossBuffScale * weaponBoostScale * dragonBuffScale;
}

function getMinionDamage(state: GameState, minion: Minion) {
  const supportingHero = getHeroForTeam(state, minion.team);
  const stats = getHeroDefinition(supportingHero.heroClass).stats;
  const auraActive = stats.minionAuraRadius && isHeroAlive(supportingHero) && distance(supportingHero.position, minion.position) <= stats.minionAuraRadius;
  return auraActive ? minion.damage * (stats.minionDamageMultiplier ?? 1) : minion.damage;
}

function recordDamage(state: GameState, sourceTeam: Team, targetTeam: Team, amount: number) {
  const safeAmount = Math.max(0, Math.round(amount));
  if (safeAmount <= 0 || sourceTeam === targetTeam) return;

  if (sourceTeam === 'blue') {
    state.matchStats.damageDealt += safeAmount;
  }
  if (targetTeam === 'blue') {
    state.matchStats.damageTaken += safeAmount;
  }
}

function applyHeroDamageReduction(hero: Hero, amount: number) {
  let nextAmount = amount;
  if (hero.bearBuffTimer > 0) {
    nextAmount *= JUNGLE_BUFF_BALANCE.bearDamageTakenMultiplier;
  }
  if (hero.dragonBuffTimer > 0) {
    nextAmount *= JUNGLE_BUFF_BALANCE.dragonDamageTakenMultiplier;
  }
  return Math.max(0, Math.round(nextAmount));
}

function applyJungleCreatureBuff(state: GameState, team: Team, kind: GameState['jungleCreatures'][number]['kind'], position: Point, radius: number) {
  const hero = getHeroForTeam(state, team);
  if (!isHeroAlive(hero)) return;

  if (kind === 'dragon') {
    hero.dragonBuffTimer = Math.max(hero.dragonBuffTimer, JUNGLE_BUFF_BALANCE.dragonSeconds);
    pushFloatingText(state, '+ Dragon Fire', { x: position.x, y: position.y - radius * 0.35 }, team, '#FFD36A');
    pushEffect(state, 'fireball', position, radius + 62, 0.68, '#FF9F2F');
    return;
  }

  hero.bearBuffTimer = Math.max(hero.bearBuffTimer, JUNGLE_BUFF_BALANCE.bearSeconds);
  pushFloatingText(state, '+ Bear Regen', { x: position.x, y: position.y - radius * 0.35 }, team, '#7CFFB0');
  pushEffect(state, 'pulse', position, radius + 48, 0.58, '#67F58F');
}

function advancePlayerGoal(state: GameState, id: MatchGoalId, amount: number, position: Point) {
  if (amount <= 0 || !canReceiveTeamReward(state, 'blue', position)) return;

  const goal = state.matchGoals.find((candidate) => candidate.id === id);
  if (!goal || goal.completed) return;

  goal.progress = Math.min(goal.target, goal.progress + amount);
  if (goal.progress < goal.target) return;

  goal.completed = true;
  grantHeroGold(state, 'blue', goal.rewardGold);
  grantHeroXp(state, 'blue', goal.rewardXp);
  pushFloatingText(state, `Goal +${goal.rewardGold}g +${goal.rewardXp}XP`, {
    x: position.x,
    y: position.y - 34,
  }, 'blue', '#FFF7D6');
  pushGameEvent(state, 'goal_complete', 'blue', `${goal.label} complete`);
  pushEffect(state, 'level', position, 88, 0.64, '#FFD36A');
}

function grantHeroXp(state: GameState, team: Team, xp: number, position?: Point) {
  if (xp <= 0) return false;
  if (position && !canReceiveTeamReward(state, team, position)) return false;
  getHeroForTeam(state, team).xp += xp;
  return true;
}

export function grantHeroGold(state: GameState, team: Team, gold: number, position?: Point) {
  if (gold <= 0) return;
  if (position && !canReceiveTeamReward(state, team, position)) return;
  getHeroForTeam(state, team).gold += gold;
  if (position) {
    pushFloatingText(state, `+${Math.round(gold)}g`, position, undefined, '#FFD36A');
  }
}

function canReceiveTeamReward(state: GameState, team: Team, position: Point) {
  const hero = getHeroForTeam(state, team);
  return isHeroAlive(hero) && distance(hero.position, position) <= HERO_REWARD_RADIUS;
}

function heroRefForTeam(state: GameState, team: Team): TargetRef {
  return {
    kind: 'hero',
    id: getHeroForTeam(state, team).id,
  };
}

function sameTargetRef(a: TargetRef | null | undefined, b: TargetRef | null | undefined) {
  return Boolean(a && b && a.kind === b.kind && a.id === b.id);
}

function toTarget(entity: Hero | Minion | Structure | NonNullable<GameState['jungleBoss']> | GameState['jungleCreatures'][number], ref: TargetRef, teamOverride?: Team): Target {
  return {
    ref,
    team: teamOverride ?? ('team' in entity ? entity.team : 'red'),
    position: entity.position,
    radius: entity.radius,
    hp: entity.hp,
    maxHp: entity.maxHp,
  };
}

export function targetDistance(a: Point, target: Target) {
  return Math.max(0, distance(a, target.position) - target.radius);
}
