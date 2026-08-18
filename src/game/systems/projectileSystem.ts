import type { GameState, Projectile, TargetRef, Team } from '../types';
import { ENTITY_LIMITS, TEAM_COLORS } from '../constants';
import { circlesOverlap } from '@/utils/collision';
import { distanceSq, normalize, subtract } from '@/utils/math';
import { applyDamage, getTarget } from './combatSystem';
import type { Target } from './combatSystem';
import { pushEffect } from './systemUtils';

export function updateProjectiles(state: GameState, dt: number) {
  const remaining: Projectile[] = [];

  for (const projectile of state.projectiles) {
    projectile.ttl -= dt;
    const currentSpeed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
    if (!Number.isFinite(currentSpeed) || currentSpeed < 0.001) {
      continue;
    }

    const lockedTarget = projectile.target ? getTarget(state, projectile.target) : null;
    if (lockedTarget) {
      const direction = normalize(subtract(lockedTarget.position, projectile.position));
      if (Math.hypot(direction.x, direction.y) > 0.001) {
        projectile.velocity = {
          x: direction.x * currentSpeed,
          y: direction.y * currentSpeed,
        };
      }
    }

    projectile.position.x += projectile.velocity.x * dt;
    projectile.position.y += projectile.velocity.y * dt;

    const collisionTarget = lockedTarget ?? findProjectileCollisionTarget(state, projectile);
    if (collisionTarget && hasHitTarget(projectile, collisionTarget)) {
      if (resolveHit(state, projectile, collisionTarget)) {
        remaining.push(projectile);
      }
      continue;
    }

    if (projectile.ttl <= 0 && projectile.splashRadius) {
      resolveAreaDetonation(state, projectile);
      continue;
    }

    if (projectile.ttl > 0) {
      remaining.push(projectile);
    }
  }

  state.projectiles = remaining.length > ENTITY_LIMITS.projectiles
    ? remaining.slice(remaining.length - ENTITY_LIMITS.projectiles)
    : remaining;
}

function hasHitTarget(projectile: Projectile, target: Target) {
  return circlesOverlap(projectile.position, projectile.radius, target.position, target.radius + 3);
}

function findProjectileCollisionTarget(state: GameState, projectile: Projectile): Target | null {
  const enemy = projectile.team === 'blue' ? 'red' : 'blue';
  let best: Target | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  const consider = (target: Target) => {
    if (!hasHitTarget(projectile, target)) return;
    const ds = distanceSq(projectile.position, target.position);
    if (ds <= bestDistance) {
      best = target;
      bestDistance = ds;
    }
  };

  for (const minion of state.minions) {
    if (minion.team !== enemy || minion.dead || minion.hp <= 0) continue;
    consider({
      ref: { kind: 'minion', id: minion.id },
      team: minion.team,
      position: minion.position,
      radius: minion.radius,
      hp: minion.hp,
      maxHp: minion.maxHp,
    });
  }

  const hero = projectile.team === 'blue' ? state.heroes.enemy : state.heroes.player;
  if (hero.hp > 0 && hero.respawnTimer <= 0) {
    consider({
      ref: { kind: 'hero', id: hero.id },
      team: hero.team,
      position: hero.position,
      radius: hero.radius,
      hp: hero.hp,
      maxHp: hero.maxHp,
    });
  }

  for (const structure of state.structures) {
    if (structure.team !== enemy || !structure.alive || structure.hp <= 0) continue;
    consider({
      ref: { kind: 'structure', id: structure.id },
      team: structure.team,
      position: structure.position,
      radius: structure.radius,
      hp: structure.hp,
      maxHp: structure.maxHp,
    });
  }

  const boss = state.jungleBoss;
  if (boss?.alive && boss.hp > 0) {
    consider({
      ref: { kind: 'boss', id: boss.id },
      team: enemy,
      position: boss.position,
      radius: boss.radius,
      hp: boss.hp,
      maxHp: boss.maxHp,
    });
  }

  for (const creature of state.jungleCreatures) {
    if (!creature.alive || creature.hp <= 0) continue;
    consider({
      ref: { kind: 'jungle', id: creature.id },
      team: enemy,
      position: creature.position,
      radius: creature.radius,
      hp: creature.hp,
      maxHp: creature.maxHp,
    });
  }

  return best;
}

function resolveHit(state: GameState, projectile: Projectile, target: Target) {
  const primaryTargetKey = targetKey(target.ref);
  applyDamage(state, target.ref, projectile.damage, projectile.team);
  const hitRefs = projectile.hitRefs ?? [];
  hitRefs.push(primaryTargetKey);
  projectile.hitRefs = hitRefs;

  if (projectile.splashRadius) {
    applyProjectileSplash(state, projectile, primaryTargetKey);
  }

  pushProjectileImpactEffect(state, projectile);
  return retargetPiercingProjectile(state, projectile, hitRefs);
}

function resolveAreaDetonation(state: GameState, projectile: Projectile) {
  applyProjectileSplash(state, projectile, null);
  pushProjectileImpactEffect(state, projectile);
}

function applyProjectileSplash(state: GameState, projectile: Projectile, primaryTargetKey: string | null) {
  if (!projectile.splashRadius) return;

  for (const minion of state.minions) {
    if (minion.team === projectile.team || minion.dead || minion.hp <= 0) continue;
    if (primaryTargetKey === targetKey({ kind: 'minion', id: minion.id })) continue;
    if (circlesOverlap(projectile.position, projectile.splashRadius, minion.position, minion.radius)) {
      applyDamage(state, { kind: 'minion', id: minion.id }, projectile.damage * 0.55, projectile.team);
    }
  }

  const hero = projectile.team === 'blue' ? state.heroes.enemy : state.heroes.player;
  if (
    hero.hp > 0 &&
    hero.respawnTimer <= 0 &&
    primaryTargetKey !== targetKey({ kind: 'hero', id: hero.id }) &&
    circlesOverlap(projectile.position, projectile.splashRadius, hero.position, hero.radius)
  ) {
    applyDamage(state, { kind: 'hero', id: hero.id }, projectile.damage * 0.55, projectile.team);
  }

  for (const creature of state.jungleCreatures) {
    if (!creature.alive || creature.hp <= 0) continue;
    if (primaryTargetKey === targetKey({ kind: 'jungle', id: creature.id })) continue;
    if (circlesOverlap(projectile.position, projectile.splashRadius, creature.position, creature.radius)) {
      applyDamage(state, { kind: 'jungle', id: creature.id }, projectile.damage * 0.55, projectile.team);
    }
  }

  if ((projectile.masteryTier ?? 0) >= 2 && projectile.kind === 'fireball') {
    for (const structure of state.structures) {
      if (structure.team === projectile.team || !structure.alive || structure.hp <= 0) continue;
      if (primaryTargetKey === targetKey({ kind: 'structure', id: structure.id })) continue;
      if (circlesOverlap(projectile.position, projectile.splashRadius, structure.position, structure.radius)) {
        applyDamage(state, { kind: 'structure', id: structure.id }, projectile.damage * 0.38, projectile.team);
      }
    }

    const boss = state.jungleBoss;
    if (
      boss?.alive &&
      boss.hp > 0 &&
      primaryTargetKey !== targetKey({ kind: 'boss', id: boss.id }) &&
      circlesOverlap(projectile.position, projectile.splashRadius, boss.position, boss.radius)
    ) {
      applyDamage(state, { kind: 'boss', id: boss.id }, projectile.damage * 0.38, projectile.team);
    }
  }
}

function pushProjectileImpactEffect(state: GameState, projectile: Projectile) {
  if (projectile.kind === 'fireball') {
    pushEffect(state, 'fireball', projectile.position, projectile.splashRadius ?? 72, 0.5, projectile.masteryTier && projectile.masteryTier >= 2 ? '#FFD36A' : projectile.masteryTier && projectile.masteryTier >= 1 ? '#FF9F2F' : '#FFB15F');
    return;
  }

  if (projectile.kind === 'bolt') {
    pushEffect(state, 'bolt', projectile.position, projectile.radius + 30, 0.24, projectile.masteryTier && projectile.masteryTier >= 1 ? '#FFD36A' : '#9CEEFF');
    return;
  }

  if (projectile.kind === 'chain') {
    pushEffect(state, 'chain', projectile.position, projectile.radius + 34, 0.26, '#9CEEFF');
    return;
  }

  pushEffect(state, 'hit', projectile.position, projectile.splashRadius ?? 24, 0.22, TEAM_COLORS[projectile.team].main);
}

function retargetPiercingProjectile(state: GameState, projectile: Projectile, hitRefs: string[]) {
  if (projectile.kind !== 'bolt' || !projectile.pierceRemaining || projectile.pierceRemaining <= 0) {
    return false;
  }

  const nextTarget = findPierceTarget(state, projectile.team, projectile.position, 320, hitRefs);
  if (!nextTarget) {
    return false;
  }

  const direction = normalize(subtract(nextTarget.position, projectile.position));
  const speed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
  if (Math.hypot(direction.x, direction.y) < 0.001 || !Number.isFinite(speed)) {
    return false;
  }

  projectile.target = { ...nextTarget.ref };
  projectile.velocity = {
    x: direction.x * speed,
    y: direction.y * speed,
  };
  projectile.damage *= 0.72;
  projectile.pierceRemaining -= 1;
  projectile.ttl = Math.max(projectile.ttl, 0.7);
  projectile.position = {
    x: projectile.position.x + direction.x * (projectile.radius + 10),
    y: projectile.position.y + direction.y * (projectile.radius + 10),
  };
  return true;
}

function findPierceTarget(
  state: GameState,
  team: Team,
  origin: Projectile['position'],
  range: number,
  hitRefs: string[],
): Target | null {
  const enemy = team === 'blue' ? 'red' : 'blue';
  const ignored = new Set(hitRefs);
  let best: Target | null = null;
  let bestDistance = range * range;

  const consider = (target: Target) => {
    if (ignored.has(targetKey(target.ref))) return;
    const ds = distanceSq(origin, target.position);
    if (ds <= bestDistance) {
      best = target;
      bestDistance = ds;
    }
  };

  for (const minion of state.minions) {
    if (minion.team !== enemy || minion.dead || minion.hp <= 0) continue;
    consider({
      ref: { kind: 'minion', id: minion.id },
      team: minion.team,
      position: minion.position,
      radius: minion.radius,
      hp: minion.hp,
      maxHp: minion.maxHp,
    });
  }

  const hero = team === 'blue' ? state.heroes.enemy : state.heroes.player;
  if (hero.hp > 0 && hero.respawnTimer <= 0) {
    consider({
      ref: { kind: 'hero', id: hero.id },
      team: hero.team,
      position: hero.position,
      radius: hero.radius,
      hp: hero.hp,
      maxHp: hero.maxHp,
    });
  }

  for (const structure of state.structures) {
    if (structure.team !== enemy || !structure.alive || structure.hp <= 0) continue;
    consider({
      ref: { kind: 'structure', id: structure.id },
      team: structure.team,
      position: structure.position,
      radius: structure.radius,
      hp: structure.hp,
      maxHp: structure.maxHp,
    });
  }

  const boss = state.jungleBoss;
  if (boss?.alive && boss.hp > 0) {
    consider({
      ref: { kind: 'boss', id: boss.id },
      team: enemy,
      position: boss.position,
      radius: boss.radius,
      hp: boss.hp,
      maxHp: boss.maxHp,
    });
  }

  for (const creature of state.jungleCreatures) {
    if (!creature.alive || creature.hp <= 0) continue;
    consider({
      ref: { kind: 'jungle', id: creature.id },
      team: enemy,
      position: creature.position,
      radius: creature.radius,
      hp: creature.hp,
      maxHp: creature.maxHp,
    });
  }

  return best;
}

function targetKey(ref: TargetRef) {
  return `${ref.kind}:${ref.id}`;
}
