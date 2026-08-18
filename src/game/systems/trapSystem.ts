import { TEAM_COLORS } from '../constants';
import type { GameState, Trap } from '../types';
import { circlesOverlap } from '@/utils/collision';
import { applyDamage, isHeroAlive } from './combatSystem';
import { pushEffect } from './systemUtils';

export function updateTrapSystem(state: GameState, dt: number) {
  const remaining: Trap[] = [];

  for (const trap of state.traps) {
    trap.ttl -= dt;
    if (trap.ttl <= 0 || trap.triggered) continue;

    if (triggerTrapOnHero(state, trap) || triggerTrapOnMinion(state, trap) || triggerTrapOnJungleCreature(state, trap)) {
      trap.triggered = true;
      pushEffect(state, 'trap', trap.position, trap.radius, 0.45, TEAM_COLORS[trap.team].main);
      continue;
    }

    remaining.push(trap);
  }

  state.traps = remaining;
}

function triggerTrapOnJungleCreature(state: GameState, trap: Trap) {
  for (const creature of state.jungleCreatures) {
    if (!creature.alive || creature.hp <= 0) continue;
    if (!circlesOverlap(trap.position, trap.radius, creature.position, creature.radius)) continue;

    creature.attackCooldown = Math.max(creature.attackCooldown, trap.rootDuration * 0.4);
    applyDamage(state, { kind: 'jungle', id: creature.id }, trap.damage, trap.team);
    return true;
  }

  return false;
}

function triggerTrapOnHero(state: GameState, trap: Trap) {
  const hero = trap.team === 'blue' ? state.heroes.enemy : state.heroes.player;
  if (!isHeroAlive(hero)) return false;
  if (!circlesOverlap(trap.position, trap.radius, hero.position, hero.radius)) return false;

  hero.rootTimer = Math.max(hero.rootTimer, trap.rootDuration);
  applyDamage(state, { kind: 'hero', id: hero.id }, trap.damage, trap.team);
  return true;
}

function triggerTrapOnMinion(state: GameState, trap: Trap) {
  for (const minion of state.minions) {
    if (minion.team === trap.team || minion.dead || minion.hp <= 0) continue;
    if (!circlesOverlap(trap.position, trap.radius, minion.position, minion.radius)) continue;

    minion.rootTimer = Math.max(minion.rootTimer, trap.rootDuration);
    applyDamage(state, { kind: 'minion', id: minion.id }, trap.damage, trap.team);
    return true;
  }

  return false;
}
