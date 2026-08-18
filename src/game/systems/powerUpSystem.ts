import { POWERUP_BALANCE } from '../balance';
import { TEAM_COLORS } from '../constants';
import type { GameState, PowerUp } from '../types';
import { distance } from '@/utils/math';
import { getHeroForTeam, isHeroAlive } from './combatSystem';
import { pushEffect, pushFloatingText } from './systemUtils';

export function updatePowerUpSystem(state: GameState) {
  for (const powerUp of state.powerUps) {
    if (!powerUp.active) continue;

    const hero = getHeroForTeam(state, powerUp.team);
    if (!isHeroAlive(hero)) continue;
    if (distance(hero.position, powerUp.position) > hero.radius + powerUp.radius) continue;

    collectPowerUp(state, powerUp);
  }
}

function collectPowerUp(state: GameState, powerUp: PowerUp) {
  const hero = getHeroForTeam(state, powerUp.team);
  powerUp.active = false;
  powerUp.pickedBy = hero.team;
  powerUp.pickedAt = state.time;

  if (powerUp.kind === 'shield') {
    const shieldAmount = Math.round(hero.maxHp * POWERUP_BALANCE.shieldHealthMultiplier);
    hero.powerShield = Math.max(hero.powerShield, shieldAmount);
    hero.powerShieldMax = Math.max(hero.powerShieldMax, shieldAmount);
    pushFloatingText(state, 'Shield +50%', hero.position, hero.team, '#D8FBFF');
    pushEffect(state, 'shield', hero.position, hero.radius + 112, 0.75, TEAM_COLORS[hero.team].soft);
    return;
  }

  hero.attackSpeedBoostTimer = Math.max(hero.attackSpeedBoostTimer, POWERUP_BALANCE.speedSeconds);
  pushFloatingText(state, 'Rapid Fire', hero.position, hero.team, '#FFD36A');
  pushEffect(state, 'bolt', hero.position, hero.radius + 86, 0.62, '#FFD36A');
}
