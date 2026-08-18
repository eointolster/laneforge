import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import type { AbilityId, Effect, GameEvent } from '@/game/types';

const SFX_SOURCES = {
  button: require('../assets/sfx/button.wav'),
  bolt: require('../assets/sfx/bolt.wav'),
  dash: require('../assets/sfx/dash.wav'),
  heal: require('../assets/sfx/heal.wav'),
  fireball: require('../assets/sfx/fireball.wav'),
  shield: require('../assets/sfx/shield.wav'),
  chain: require('../assets/sfx/chain.wav'),
  trap: require('../assets/sfx/trap.wav'),
  ult: require('../assets/sfx/ult.wav'),
  hit: require('../assets/sfx/hit.wav'),
  kill: require('../assets/sfx/kill.wav'),
  tower: require('../assets/sfx/tower.wav'),
  boss: require('../assets/sfx/boss.wav'),
  levelup: require('../assets/sfx/levelup.wav'),
  victory: require('../assets/sfx/victory.wav'),
  defeat: require('../assets/sfx/defeat.wav'),
  upgrade: require('../assets/sfx/upgrade.wav'),
} as const;

export type SfxId = keyof typeof SFX_SOURCES;

const SFX_VOLUME: Record<SfxId, number> = {
  button: 0.22,
  bolt: 0.36,
  dash: 0.34,
  heal: 0.36,
  fireball: 0.42,
  shield: 0.34,
  chain: 0.34,
  trap: 0.32,
  ult: 0.5,
  hit: 0.2,
  kill: 0.46,
  tower: 0.42,
  boss: 0.48,
  levelup: 0.38,
  victory: 0.46,
  defeat: 0.42,
  upgrade: 0.34,
};

type AudioPlayerInstance = ReturnType<typeof createAudioPlayer>;

let configured = false;
let enabled = true;
let initPromise: Promise<void> | null = null;
let players: Partial<Record<SfxId, AudioPlayerInstance>> = {};

export async function initSfx() {
  if (configured) {
    return initPromise ?? Promise.resolve();
  }
  configured = true;

  initPromise = (async () => {
    try {
      await setAudioModeAsync({
        interruptionMode: 'mixWithOthers',
        playsInSilentMode: true,
        allowsRecording: false,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
    } catch {
      // Audio mode is best-effort; gameplay should not fail if native audio setup rejects.
    }

    for (const id of Object.keys(SFX_SOURCES) as SfxId[]) {
      if (players[id]) continue;
      const player = createAudioPlayer(SFX_SOURCES[id], { updateInterval: 1000 });
      player.volume = SFX_VOLUME[id];
      players[id] = player;
    }
  })();

  return initPromise;
}

export function playSfx(id: SfxId) {
  if (!enabled) return;
  const player = players[id];
  if (!player) {
    void initSfx().then(() => playPreparedSfx(id));
    return;
  }

  playPreparedSfx(id);
}

function playPreparedSfx(id: SfxId) {
  if (!enabled) return;
  const player = players[id];
  if (!player) return;

  try {
    void player.seekTo(0);
    player.play();
  } catch {
    // Keep SFX fire-and-forget; missing audio should never interrupt input.
  }
}

export function releaseSfx() {
  for (const player of Object.values(players)) {
    try {
      player?.remove();
    } catch {
      // Ignore native teardown races during fast refresh.
    }
  }
  players = {};
  configured = false;
  initPromise = null;
}

export function setSfxEnabled(value: boolean) {
  enabled = value;
}

export function abilityToSfx(ability: AbilityId): SfxId {
  if (ability === 'pulse') return 'heal';
  return ability;
}

export function eventToSfx(event: GameEvent): SfxId | null {
  if (event.kind === 'hero_kill') return 'kill';
  if (event.kind === 'boss_kill') return 'boss';
  if (event.kind === 'structure_destroy') return 'tower';
  if (event.kind === 'level_up') return 'levelup';
  if (event.kind === 'goal_complete') return 'upgrade';

  return null;
}

export function effectToSfx(effect: Effect): SfxId | null {
  if (effect.kind === 'hit') return 'hit';
  if (effect.kind === 'bolt') return 'bolt';
  if (effect.kind === 'fireball') return 'fireball';
  if (effect.kind === 'chain') return 'chain';
  if (effect.kind === 'dash') return 'dash';
  if (effect.kind === 'pulse') return 'heal';
  if (effect.kind === 'shield') return 'shield';
  if (effect.kind === 'trap') return 'trap';
  if (effect.kind === 'ult') return 'ult';
  if (effect.kind === 'level') return 'levelup';

  return null;
}
