import { HERO_BALANCE } from '../balance';
import { getHeroDefinition } from '../heroes';
import type { GameState, Hero } from '../types';
import { pushEffect, pushFloatingText, pushGameEvent } from './systemUtils';

export function updateLevelSystem(state: GameState) {
  updateHeroLevel(state, state.heroes.player);
  updateHeroLevel(state, state.heroes.enemy);
}

function updateHeroLevel(state: GameState, hero: Hero) {
  const required = HERO_BALANCE.xpPerLevel + (hero.level - 1) * 58;

  if (hero.xp < required || hero.level >= 12) {
    return;
  }

  hero.xp -= required;
  hero.level += 1;
  const heroStats = getHeroDefinition(hero.heroClass).stats;
  hero.maxHp += heroStats.levelHp;
  hero.hp = Math.min(hero.maxHp, hero.hp + heroStats.levelHp);
  pushEffect(state, 'level', hero.position, 108, 0.95, hero.team === 'blue' ? '#BFFFFF' : '#FFD0BD');
  pushFloatingText(state, `LEVEL ${hero.level}`, hero.position, hero.team, hero.team === 'blue' ? '#FFF7D6' : '#FFD0BD');
  pushFloatingText(state, `DMG +${heroStats.levelDamage} HP +${heroStats.levelHp}`, {
    x: hero.position.x,
    y: hero.position.y + hero.radius * 1.4,
  }, hero.team, '#BFFFFF');
  pushGameEvent(state, 'level_up', hero.team, `${hero.name} reached level ${hero.level}: +${heroStats.levelDamage} damage, +${heroStats.levelHp} HP`);
}
