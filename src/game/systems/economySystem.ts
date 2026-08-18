import { ECONOMY_BALANCE } from '../balance';
import { BASE_POSITIONS, TEAM_COLORS } from '../constants';
import type { GameState, Hero } from '../types';
import { distance } from '@/utils/math';
import { isHeroAlive } from './combatSystem';
import { pushEffect, pushFloatingText } from './systemUtils';

export function updateEconomySystem(state: GameState, dt: number) {
  for (const hero of [state.heroes.player, state.heroes.enemy]) {
    if (!isHeroAlive(hero)) continue;
    hero.gold += ECONOMY_BALANCE.passiveGoldPerSecond * dt;
    updateBaseFountain(state, hero, dt);

    if (hero.team === 'red') {
      buyBaseWard(state, hero);
      buyBaseForge(state, hero);
    }
  }
}

export function canBuyBaseWard(hero: Hero) {
  if (!isHeroAlive(hero)) return false;

  const base = BASE_POSITIONS[hero.team];
  return (
    distance(hero.position, base) <= ECONOMY_BALANCE.baseHealRadius &&
    hero.shieldTimer <= 0 &&
    hero.gold >= ECONOMY_BALANCE.baseArmoryGoldCost
  );
}

export function buyBaseWard(state: GameState, hero: Hero) {
  if (!canBuyBaseWard(hero)) return false;

  hero.gold -= ECONOMY_BALANCE.baseArmoryGoldCost;
  hero.shield = Math.max(hero.shield, ECONOMY_BALANCE.baseArmoryShield + hero.level * 8);
  hero.shieldTimer = ECONOMY_BALANCE.baseArmorySeconds;
  pushFloatingText(state, `-${ECONOMY_BALANCE.baseArmoryGoldCost}g Ward`, hero.position, hero.team, '#FFD36A');
  pushEffect(state, 'shield', hero.position, 104, 0.55, TEAM_COLORS[hero.team].soft);
  return true;
}

export function canBuyBaseForge(hero: Hero) {
  if (!isHeroAlive(hero)) return false;

  const base = BASE_POSITIONS[hero.team];
  return (
    distance(hero.position, base) <= ECONOMY_BALANCE.baseHealRadius &&
    hero.weaponBoostTimer <= 0 &&
    hero.gold >= ECONOMY_BALANCE.baseForgeGoldCost
  );
}

export function buyBaseForge(state: GameState, hero: Hero) {
  if (!canBuyBaseForge(hero)) return false;

  hero.gold -= ECONOMY_BALANCE.baseForgeGoldCost;
  hero.weaponBoostTimer = ECONOMY_BALANCE.baseForgeSeconds;
  pushFloatingText(state, `-${ECONOMY_BALANCE.baseForgeGoldCost}g Power`, hero.position, hero.team, '#FFD36A');
  pushEffect(state, 'level', hero.position, 112, 0.62, '#FFD36A');
  return true;
}

function updateBaseFountain(state: GameState, hero: GameState['heroes']['player'], dt: number) {
  const base = BASE_POSITIONS[hero.team];
  if (distance(hero.position, base) > ECONOMY_BALANCE.baseHealRadius) {
    return;
  }

  const missingHp = hero.maxHp - hero.hp;
  if (missingHp > 0.5) {
    const healAmount = Math.min(missingHp, ECONOMY_BALANCE.baseHealPerSecond * dt);
    hero.hp += healAmount;

    if (state.time % 0.75 < dt) {
      pushFloatingText(state, 'Base Heal', hero.position, hero.team, '#7CFFB0');
      pushEffect(state, 'pulse', base, 88, 0.35, TEAM_COLORS[hero.team].soft);
    }
  }
}
