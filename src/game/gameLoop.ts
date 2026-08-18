import { SIMULATION } from './constants';
import type { GameInput, GameState } from './types';
import { updateAbilitySystem } from './systems/abilitySystem';
import { updateAiHeroSystem } from './systems/aiHeroSystem';
import { updateCombat, updateHeroRegen } from './systems/combatSystem';
import { updateEconomySystem } from './systems/economySystem';
import { updateJungleBossSystem } from './systems/jungleBossSystem';
import { updateJungleCreatureSystem } from './systems/jungleCreatureSystem';
import { clearUnsafeEntities, updateMovement } from './systems/movementSystem';
import { updateMinionSystem } from './systems/minionSystem';
import { updateObjectiveSystem } from './systems/objectiveSystem';
import { updateProjectiles } from './systems/projectileSystem';
import { updatePowerUpSystem } from './systems/powerUpSystem';
import { updateTowerSystem } from './systems/towerSystem';
import { updateTrapSystem } from './systems/trapSystem';
import { updateLevelSystem } from './systems/levelSystem';
import { sanitizePositions, updateTransientVisuals } from './systems/systemUtils';

export function updateGame(state: GameState, input: GameInput, deltaSeconds: number) {
  if (state.winner) {
    updateTransientVisuals(state, Math.min(deltaSeconds, SIMULATION.maxDelta));
    sanitizePositions(state);
    return state;
  }

  const dt = Math.min(deltaSeconds, SIMULATION.maxDelta);
  state.time += dt;

  updateAiHeroSystem(state);
  updateAbilitySystem(state, input, dt);
  updateMovement(state, input, dt);
  updatePowerUpSystem(state);
  updateMinionSystem(state, dt);
  updateJungleCreatureSystem(state, dt);
  updateJungleBossSystem(state, dt);
  updateTrapSystem(state, dt);
  updateTowerSystem(state, dt);
  updateCombat(state, dt);
  updateHeroRegen(state, dt);
  updateEconomySystem(state, dt);
  updateProjectiles(state, dt);
  updateLevelSystem(state);
  clearUnsafeEntities(state);
  updateTransientVisuals(state, dt);
  sanitizePositions(state);
  updateObjectiveSystem(state);

  return state;
}
