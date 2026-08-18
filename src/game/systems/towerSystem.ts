import { STRUCTURE_BALANCE, WARNING_BALANCE } from '../balance';
import { TEAM_COLORS } from '../constants';
import type { GameState, Point, Structure, Team } from '../types';
import { distanceSq } from '@/utils/math';
import { fireProjectileAt, getHeroForTeam, getTarget, isHeroAlive, type Target } from './combatSystem';
import { otherTeam, pushChainArc, pushWarning } from './systemUtils';

export function updateTowerSystem(state: GameState, dt: number) {
  for (const structure of state.structures) {
    if (!structure.alive || structure.hp <= 0) continue;

    structure.attackCooldown = Math.max(0, structure.attackCooldown - dt);

    const target = findTowerTarget(state, structure);

    if ((structure.warningTimer ?? 0) > 0) {
      const primedTarget = structure.warningTargetRef ? getTarget(state, structure.warningTargetRef) : target;
      if (!primedTarget || !targetInStructureRange(structure, primedTarget)) {
        structure.warningTimer = 0;
        structure.warningTargetRef = null;
        continue;
      }

      pushTowerWarning(state, structure, primedTarget, structure.warningTimer ?? WARNING_BALANCE.towerLeadSeconds);
      structure.warningTimer = Math.max(0, (structure.warningTimer ?? 0) - dt);

      if (structure.warningTimer > 0) {
        continue;
      }

      fireTowerShot(state, structure, primedTarget);
      structure.warningTargetRef = null;
      continue;
    }

    if (!target || structure.attackCooldown > 0) {
      structure.warningTargetRef = null;
      structure.warningTimer = 0;
      continue;
    }

    structure.warningTargetRef = { ...target.ref };
    structure.warningTimer = WARNING_BALANCE.towerLeadSeconds;
    pushTowerWarning(state, structure, target, WARNING_BALANCE.towerLeadSeconds);
  }
}

function fireTowerShot(state: GameState, structure: Structure, target: Target) {
  const origin = getStructureAttackOrigin(structure);
  pushChainArc(state, structure.team, origin, target.position, 0.2, structure.team === 'blue' ? '#9CEEFF' : '#FFB096');
  pushChainArc(state, structure.team, {
    x: origin.x,
    y: origin.y + (structure.team === 'blue' ? -10 : 10),
  }, {
    x: target.position.x,
    y: target.position.y + (structure.team === 'blue' ? 10 : -10),
  }, 0.16, TEAM_COLORS[structure.team].soft);
  pushChainArc(state, structure.team, {
    x: origin.x + (structure.team === 'blue' ? 16 : -16),
    y: origin.y + 8,
  }, {
    x: target.position.x - (structure.team === 'blue' ? 8 : -8),
    y: target.position.y + (structure.team === 'blue' ? -14 : 14),
  }, 0.13, structure.team === 'blue' ? '#C7A5FF' : '#FFD36A');
  const shotDamage = target.ref.kind === 'hero'
    ? Math.round(structure.damage * STRUCTURE_BALANCE.towerHeroDamageMultiplier)
    : structure.damage;
  fireProjectileAt(state, structure.team, origin, target.ref, shotDamage, 'tower', 700);
  structure.attackCooldown = structure.kind === 'tower'
    ? STRUCTURE_BALANCE.towerCooldown
    : STRUCTURE_BALANCE.coreCooldown;
}

function pushTowerWarning(state: GameState, structure: Structure, target: Target, ttl: number) {
  pushWarning(
    state,
    'tower',
    structure.team,
    getStructureAttackOrigin(structure),
    target.position,
    target.radius + (structure.kind === 'core' ? 42 : 34),
    Math.max(0.08, ttl),
    structure.team === 'blue' ? '#9CEEFF' : '#FFB096',
  );
}

function targetInStructureRange(structure: Structure, target: Target) {
  return distanceSq(structure.position, target.position) <= structure.range * structure.range;
}

function getStructureAttackOrigin(structure: Structure): Point {
  if (structure.kind === 'core') {
    return {
      x: structure.position.x,
      y: structure.position.y - 72,
    };
  }

  return {
    x: structure.position.x,
    y: structure.position.y - 86,
  };
}

function findTowerTarget(state: GameState, structure: Structure): Target | null {
  const enemy = otherTeam(structure.team);
  const rangeSq = structure.range * structure.range;
  let best: Target | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  const consider = (target: Target) => {
    const ds = distanceSq(structure.position, target.position);
    if (ds > rangeSq || ds >= bestDistance) return;

    best = target;
    bestDistance = ds;
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

  const heroTarget = findClosestHeroTarget(state, enemy, structure.position, rangeSq);
  if (heroTarget) {
    consider(heroTarget);
  }

  return best;
}

function findClosestHeroTarget(state: GameState, enemy: Team, position: Point, rangeSq: number): Target | null {
  const hero = getHeroForTeam(state, enemy);
  if (!isHeroAlive(hero)) return null;

  const ds = distanceSq(position, hero.position);
  if (ds > rangeSq) return null;

  return {
    ref: { kind: 'hero', id: hero.id },
    team: hero.team,
    position: hero.position,
    radius: hero.radius,
    hp: hero.hp,
    maxHp: hero.maxHp,
  };
}
