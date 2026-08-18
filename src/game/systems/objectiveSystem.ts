import type { GameState } from '../types';

export function updateObjectiveSystem(state: GameState) {
  if (state.winner) return;

  const blueCore = state.structures.find((structure) => structure.id === 'blue-core');
  const redCore = state.structures.find((structure) => structure.id === 'red-core');

  if (redCore && (!redCore.alive || redCore.hp <= 0)) {
    state.winner = 'blue';
    state.gameOverReason = 'Enemy core destroyed';
  }

  if (blueCore && (!blueCore.alive || blueCore.hp <= 0)) {
    state.winner = 'red';
    state.gameOverReason = 'Blue core destroyed';
  }
}
