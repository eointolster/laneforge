import { BOSS_BALANCE } from '../balance';
import { MAP_HEIGHT, MAP_WIDTH } from '../constants';
import type { GameState, JungleBoss, Point, TargetRef, Team } from '../types';
import { distanceSq } from '@/utils/math';
import { absorbHeroDamage, isHeroAlive } from './combatSystem';
import { pushEffect } from './systemUtils';

type BossTarget = { ref: TargetRef; team: Team; position: Point; distanceSq: number };

export function updateJungleBossSystem(state: GameState, dt: number) {
  if (!state.levelConfig.bossEnabled) {
    state.jungleBoss = null;
    return;
  }

  const boss = ensureBoss(state);

  if (!boss.alive) {
    boss.respawnTimer = Math.max(0, boss.respawnTimer - dt);
    if (state.time >= BOSS_BALANCE.spawnSeconds && boss.respawnTimer <= 0) {
      spawnBoss(state, boss);
      pushEffect(state, 'spawn', boss.position, boss.radius + 40, 0.8, '#9B5CFF');
    }
    return;
  }

  boss.attackCooldown = Math.max(0, boss.attackCooldown - dt);
  const target = findBossTarget(state, boss.position);
  boss.targetRef = target?.ref ?? null;
  const canStrikeTarget = target && target.distanceSq <= boss.attackRange * boss.attackRange;

  if (target && canStrikeTarget && boss.attackCooldown <= 0) {
    boss.lastAttackTime = state.time;
    damageBossTarget(state, target.ref, boss.damage);
    pushEffect(state, 'hit', target.position, 36, 0.28, '#B58CFF');
    boss.attackCooldown = BOSS_BALANCE.attackCooldown;
  }
}

function ensureBoss(state: GameState): JungleBoss {
  const maxHp = bossMaxHp(state);
  if (state.jungleBoss) {
    if (!state.jungleBoss.alive) {
      state.jungleBoss.maxHp = maxHp;
      state.jungleBoss.damage = BOSS_BALANCE.damage;
      state.jungleBoss.attackRange = BOSS_BALANCE.attackRange;
    }
    return state.jungleBoss;
  }

  state.jungleBoss = {
    id: 'jungle-boss',
    position: bossSpawnPosition(),
    radius: BOSS_BALANCE.radius,
    hp: maxHp,
    maxHp,
    damage: BOSS_BALANCE.damage,
    attackRange: BOSS_BALANCE.attackRange,
    attackCooldown: 0,
    alive: false,
    respawnTimer: BOSS_BALANCE.spawnSeconds,
    lastAttackTime: -99,
    lastDamageTime: -99,
    targetRef: null,
    deathTime: -99,
  };
  return state.jungleBoss;
}

function spawnBoss(state: GameState, boss: JungleBoss) {
  boss.maxHp = bossMaxHp(state);
  boss.position = bossSpawnPosition();
  boss.hp = boss.maxHp;
  boss.alive = true;
  boss.attackCooldown = BOSS_BALANCE.initialAttackDelay;
  boss.lastDamageTime = -99;
  boss.targetRef = null;
}

function bossMaxHp(state: GameState) {
  return Math.round(BOSS_BALANCE.baseHp * Math.max(1, state.levelConfig.bossHpMultiplier));
}

function bossSpawnPosition(): Point {
  return { x: MAP_WIDTH / 2, y: MAP_HEIGHT * BOSS_BALANCE.spawnYRatio };
}

function findBossTarget(state: GameState, position: Point): BossTarget | null {
  let best: BossTarget | null = null;
  let bestDistance = BOSS_BALANCE.aggroRange * BOSS_BALANCE.aggroRange;

  const consider = (candidate: { ref: TargetRef; team: Team; position: Point }) => {
    const targetDistanceSq = distanceSq(position, candidate.position);
    if (targetDistanceSq <= bestDistance) {
      best = { ...candidate, distanceSq: targetDistanceSq };
      bestDistance = targetDistanceSq;
    }
  };

  for (const hero of [state.heroes.player, state.heroes.enemy]) {
    if (!isHeroAlive(hero)) continue;
    consider({ ref: { kind: 'hero', id: hero.id }, team: hero.team, position: hero.position });
  }

  for (const minion of state.minions) {
    if (minion.dead || minion.hp <= 0) continue;
    consider({ ref: { kind: 'minion', id: minion.id }, team: minion.team, position: minion.position });
  }

  return best;
}

function damageBossTarget(state: GameState, ref: TargetRef, damage: number) {
  if (ref.kind === 'hero') {
    const hero = ref.id === state.heroes.player.id ? state.heroes.player : state.heroes.enemy;
    if (!isHeroAlive(hero)) return;
    const healthDamage = absorbHeroDamage(hero, damage);
    hero.hp -= healthDamage;
    hero.lastDamageTime = state.time;
    if (hero.hp <= 0) {
      hero.hp = 0;
      hero.respawnTimer = 8;
      hero.deathTime = state.time;
      state.heroDeaths[hero.team] += 1;
    }
    return;
  }

  if (ref.kind === 'minion') {
    const minion = state.minions.find((candidate) => candidate.id === ref.id);
    if (!minion || minion.dead || minion.hp <= 0) return;
    minion.hp -= damage;
    minion.lastDamageTime = state.time;
    if (minion.hp <= 0) {
      minion.hp = 0;
      minion.dead = true;
      minion.deathTime = state.time;
    }
  }
}
