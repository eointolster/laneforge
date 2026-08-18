import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { playRandomMusic, setMusicEnabled } from '@/audio/music';
import { abilityToSfx, effectToSfx, eventToSfx, playSfx, setSfxEnabled } from '@/audio/sfx';
import { getAbilityStats } from '@/game/balance';
import { createInitialCamera, getVisibleWorldRect, setCameraZoom, setCameraZoomAt, updateCamera } from '@/game/camera';
import { COLORS } from '@/game/constants';
import { updateGame } from '@/game/gameLoop';
import { cloneForRender, createInitialState } from '@/game/initialState';
import { generateLevelConfig } from '@/game/levels';
import {
  DEFAULT_PROFILE,
  getNextCampaignLevel,
  getUnlockedAbilitiesForLevel,
  loadProfile,
  normalizeEquippedAbilities,
  updateProfile,
  type PlayerProfile,
} from '@/game/playerProfile';
import { buyBaseForge, buyBaseWard } from '@/game/systems/economySystem';
import type { AbilityId, GameInput, GameState, GraphicsQuality, JoystickVector, Point } from '@/game/types';
import { createFpsTracker, type FrameStats } from '@/performance/fps';
import { AbilityButton } from './AbilityButton';
import { ArenaView } from './ArenaView';
import { BattleResultScreen } from './BattleResultScreen';
import { FloatingTextOverlay } from './FloatingTextOverlay';
import { FpsMeter } from './FpsMeter';
import { Hud } from './Hud';
import { TutorialOverlay } from './TutorialOverlay';
import { VirtualJoystick } from './VirtualJoystick';

const HUD_UPDATE_INTERVAL_MS = 180;
const RENDER_UPDATE_INTERVAL_MS = 33;
const AUTO_PERFORMANCE_FPS = 24;
const AUTO_PERFORMANCE_FRAME_MS = 48;
const AUTO_PERFORMANCE_SAMPLES = 8;

export function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ level?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const stateRef = useRef<GameState>(createInitialState());
  const inputRef = useRef<GameInput>({ move: { x: 0, y: 0, magnitude: 0 }, queuedAbilities: [] });
  const layoutRef = useRef<{ width: number; height: number }>({ width: 844, height: 390 });
  const cameraRef = useRef(createInitialCamera(stateRef.current.heroes.player.position, layoutRef.current));
  const cameraZoomRef = useRef(cameraRef.current.zoom);
  const fpsTrackerRef = useRef(createFpsTracker());
  const lastEventIdRef = useRef<string | null>(null);
  const lastEffectSfxIdRef = useRef<string | null>(null);
  const lastEffectSfxAtRef = useRef(0);
  const lastCastSfxKeyRef = useRef<string | null>(null);
  const lastCastSfxAtRef = useRef(0);
  const lastObjectiveProjectileSfxIdRef = useRef<string | null>(null);
  const lastObjectiveSfxAtRef = useRef(0);
  const lastBossAttackSfxKeyRef = useRef<string | null>(null);
  const lastCreatureAttackSfxKeyRef = useRef<string | null>(null);
  const graphicsQualityRef = useRef<GraphicsQuality>('high');
  const lowFpsSamplesRef = useRef(0);
  const currentLevelRef = useRef(1);
  const profileRef = useRef<PlayerProfile>(DEFAULT_PROFILE);
  const pausedRef = useRef(false);
  const tutorialPersistedRef = useRef(false);
  const didPersistResultRef = useRef(false);
  const [hudState, setHudState] = useState<GameState>(() => cloneForRender(stateRef.current));
  const [camera, setCamera] = useState(cameraRef.current);
  const [hudCamera, setHudCamera] = useState(cameraRef.current);
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PROFILE);
  const [resultSaved, setResultSaved] = useState(false);
  const [resultAlreadyCompleted, setResultAlreadyCompleted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [fpsMeterEnabled, setFpsMeterEnabled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>('high');
  const [fpsStats, setFpsStats] = useState<FrameStats>({
    fps: 60,
    frameMs: 16.7,
    minFps: 60,
    slowFrames: 0,
    updatedAt: Date.now(),
  });
  const [session, setSession] = useState(0);

  graphicsQualityRef.current = graphicsQuality;
  pausedRef.current = paused;

  const startBattle = useCallback((level: number, nextProfile: PlayerProfile) => {
    const levelConfig = generateLevelConfig(level);
    const next = createInitialState(levelConfig, nextProfile);
    currentLevelRef.current = levelConfig.level;
    profileRef.current = nextProfile;
    stateRef.current = next;
    inputRef.current = { move: { x: 0, y: 0, magnitude: 0 }, queuedAbilities: [] };
    lastEventIdRef.current = null;
    lastEffectSfxIdRef.current = null;
    lastEffectSfxAtRef.current = 0;
    lastCastSfxKeyRef.current = null;
    lastCastSfxAtRef.current = 0;
    lastObjectiveProjectileSfxIdRef.current = null;
    lastObjectiveSfxAtRef.current = 0;
    lastBossAttackSfxKeyRef.current = null;
    lastCreatureAttackSfxKeyRef.current = null;
    lowFpsSamplesRef.current = 0;
    tutorialPersistedRef.current = nextProfile.tutorialDone || nextProfile.completedLevels.length > 0;
    didPersistResultRef.current = false;
    setResultSaved(false);
    setResultAlreadyCompleted(nextProfile.completedLevels.includes(levelConfig.level));
    setPaused(false);
    pausedRef.current = false;
    cameraRef.current = setCameraZoom(createInitialCamera(next.heroes.player.position, layoutRef.current), cameraZoomRef.current);
    fpsTrackerRef.current.reset(Date.now());
    setHudState(cloneForRender(next));
    setCamera(cameraRef.current);
    setHudCamera(cameraRef.current);
    setSession((current) => current + 1);
    if (nextProfile.sfxEnabled) {
      void playRandomMusic();
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    loadProfile().then((loaded) => {
      if (!mounted) return;
      const requestedLevel = parseRouteLevel(params.level) ?? getNextCampaignLevel(loaded);
      profileRef.current = loaded;
      setProfile(loaded);
      setSoundEnabled(loaded.sfxEnabled);
      setFpsMeterEnabled(loaded.fpsMeterEnabled);
      setSfxEnabled(loaded.sfxEnabled);
      setMusicEnabled(loaded.sfxEnabled);
      graphicsQualityRef.current = loaded.graphicsQuality;
      setGraphicsQuality(loaded.graphicsQuality);
      startBattle(requestedLevel, loaded);
    });

    return () => {
      mounted = false;
    };
  }, [params.level, startBattle]);

  const persistBattleResult = useCallback((finalState: GameState) => {
    const playerWon = finalState.winner === 'blue';
    const level = finalState.levelConfig.level;
    const matchKills = finalState.teamKills.blue;
    const matchDeaths = finalState.heroDeaths.blue;
    const matchGold = Math.floor(finalState.heroes.player.gold);
    const campaignGold = playerWon ? finalState.levelConfig.rewardGold : Math.floor(finalState.levelConfig.rewardGold * 0.25);

    void updateProfile((current) => {
      const alreadyCompleted = current.completedLevels.includes(level);
      const completedLevels = playerWon && !alreadyCompleted
        ? [...current.completedLevels, level].sort((a, b) => a - b)
        : current.completedLevels;
      const currentLevel = playerWon
        ? getNextCampaignLevel({ ...current, completedLevels })
        : current.currentLevel;
      const unlockedAbilities = Array.from(new Set([
        ...current.unlockedAbilities,
        ...getUnlockedAbilitiesForLevel(currentLevel),
      ]));

      return {
        ...current,
        currentLevel,
        completedLevels,
        unlockedAbilities,
        equippedAbilities: normalizeEquippedAbilities(current.equippedAbilities, unlockedAbilities),
        heroRecords: {
          ...current.heroRecords,
          [finalState.matchStats.heroUsed]: {
            wins: (current.heroRecords[finalState.matchStats.heroUsed]?.wins ?? 0) + (playerWon ? 1 : 0),
            kills: (current.heroRecords[finalState.matchStats.heroUsed]?.kills ?? 0) + matchKills,
            bestLevel: Math.max(current.heroRecords[finalState.matchStats.heroUsed]?.bestLevel ?? 0, playerWon ? level : 0),
          },
        },
        tutorialDone: true,
        upgradePoints: current.upgradePoints + (playerWon && !alreadyCompleted ? finalState.levelConfig.rewardUpgradePoints : 0),
        gold: current.gold + campaignGold + Math.floor(matchGold * (playerWon ? 0.25 : 0.1)),
        totalKills: current.totalKills + matchKills,
        totalDeaths: current.totalDeaths + matchDeaths,
        totalWins: current.totalWins + (playerWon ? 1 : 0),
      };
    }).then((saved) => {
      profileRef.current = saved;
      setProfile(saved);
      setResultSaved(true);
    });
  }, []);

  useEffect(() => {
    let frameId = 0;
    let last = Date.now();
    let lastHudUpdate = last;
    let lastRenderUpdate = last;
    let didRenderWinner = false;
    let didReportWinner = false;
    fpsTrackerRef.current.reset(last);

    const frame = () => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;

      if (pausedRef.current) {
        frameId = requestAnimationFrame(frame);
        return;
      }

      stateRef.current = updateGame(stateRef.current, inputRef.current, dt);
      if (!tutorialPersistedRef.current && stateRef.current.time >= 90) {
        tutorialPersistedRef.current = true;
        void updateProfile((profile) => ({ ...profile, tutorialDone: true })).then((saved) => {
          profileRef.current = { ...profileRef.current, tutorialDone: saved.tutorialDone };
          setProfile((current) => ({ ...current, tutorialDone: saved.tutorialDone }));
        });
      }
      if (stateRef.current.winner && !didPersistResultRef.current) {
        didPersistResultRef.current = true;
        playSfx(stateRef.current.winner === 'blue' ? 'victory' : 'defeat');
        persistBattleResult(stateRef.current);
      }

      const latestEvent = stateRef.current.events[stateRef.current.events.length - 1];
      if (latestEvent && latestEvent.id !== lastEventIdRef.current) {
        lastEventIdRef.current = latestEvent.id;
        const sfx = eventToSfx(latestEvent);
        if (sfx) {
          playSfx(sfx);
        }
      }

      const followTarget = stateRef.current.heroes.player.hp > 0
        ? stateRef.current.heroes.player.position
        : stateRef.current.heroes.enemy.position;
      cameraRef.current = setCameraZoom(
        updateCamera(cameraRef.current, followTarget, layoutRef.current, dt),
        cameraZoomRef.current,
      );
      playLatestEffectSfx(stateRef.current, cameraRef.current, now, lastEffectSfxIdRef, lastEffectSfxAtRef);
      playEnemyCastSfx(stateRef.current, cameraRef.current, now, lastCastSfxKeyRef, lastCastSfxAtRef, lastEffectSfxAtRef);
      playObjectiveAttackSfx(
        stateRef.current,
        cameraRef.current,
        now,
        lastObjectiveProjectileSfxIdRef,
        lastObjectiveSfxAtRef,
        lastBossAttackSfxKeyRef,
        lastCreatureAttackSfxKeyRef,
      );

      const shouldRenderWinner = Boolean(stateRef.current.winner) && !didRenderWinner;
      if (now - lastRenderUpdate >= RENDER_UPDATE_INTERVAL_MS || shouldRenderWinner) {
        setCamera(cameraRef.current);
        lastRenderUpdate = now;
        didRenderWinner = Boolean(stateRef.current.winner);

        const nextFpsStats = fpsTrackerRef.current.sample(now);
        if (nextFpsStats) {
          setFpsStats(nextFpsStats);
          const autoQuality = updateGraphicsGuardrail(nextFpsStats, stateRef.current, graphicsQualityRef, lowFpsSamplesRef, setGraphicsQuality);
          if (autoQuality) {
            void updateProfile((profile) => ({ ...profile, graphicsQuality: autoQuality })).then((saved) => {
              profileRef.current = { ...profileRef.current, graphicsQuality: saved.graphicsQuality };
              setProfile((current) => ({ ...current, graphicsQuality: saved.graphicsQuality }));
            });
          }
        }
      }

      const shouldReportWinner = Boolean(stateRef.current.winner) && !didReportWinner;
      if (now - lastHudUpdate >= HUD_UPDATE_INTERVAL_MS || shouldReportWinner) {
        setHudState(cloneForRender(stateRef.current));
        setHudCamera(cameraRef.current);
        lastHudUpdate = now;
        didReportWinner = Boolean(stateRef.current.winner);
      }

      frameId = requestAnimationFrame(frame);
    };

    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [persistBattleResult, session]);

  const handleMove = useCallback((vector: JoystickVector) => {
    inputRef.current.move = vector;
  }, []);

  const handleAbility = useCallback((ability: AbilityId) => {
    const hero = stateRef.current.heroes.player;
    if (
      stateRef.current.winner ||
      hero.hp <= 0 ||
      hero.respawnTimer > 0 ||
      hero.channelTimer > 0 ||
      hero.cooldowns[ability] > 0 ||
      inputRef.current.queuedAbilities.includes(ability)
    ) {
      return;
    }

    inputRef.current.queuedAbilities.push(ability);
    playSfx(abilityToSfx(ability));
    lastEffectSfxAtRef.current = Date.now();
  }, []);

  const handleReset = useCallback(() => {
    playSfx('button');
    startBattle(currentLevelRef.current, profileRef.current);
  }, [startBattle]);

  const handleMenu = useCallback(() => {
    playSfx('button');
    setPaused(false);
    pausedRef.current = false;
    router.replace('/');
  }, [router]);

  const handleContinue = useCallback(() => {
    playSfx('button');
    router.replace('/upgrades');
  }, [router]);

  const handleSurrender = useCallback(() => {
    playSfx('button');
    setPaused(false);
    pausedRef.current = false;
    if (stateRef.current.winner) return;
    stateRef.current = {
      ...stateRef.current,
      winner: 'red',
      gameOverReason: 'Surrendered',
    };
    setHudState(cloneForRender(stateRef.current));
  }, []);

  const handlePause = useCallback(() => {
    if (stateRef.current.winner) return;
    playSfx('button');
    setPaused(true);
    pausedRef.current = true;
  }, []);

  const handleResume = useCallback(() => {
    playSfx('button');
    setPaused(false);
    pausedRef.current = false;
  }, []);

  const handleToggleSound = useCallback(() => {
      setSoundEnabled((current) => {
      const next = !current;
      setSfxEnabled(next);
      setMusicEnabled(next);
      if (next) {
        playSfx('button');
      }
      void updateProfile((profile) => ({ ...profile, sfxEnabled: next })).then((saved) => {
        profileRef.current = { ...profileRef.current, sfxEnabled: saved.sfxEnabled };
        setProfile((current) => ({ ...current, sfxEnabled: saved.sfxEnabled }));
      });
      return next;
    });
  }, []);

  const handleToggleFpsMeter = useCallback(() => {
    playSfx('button');
    setFpsMeterEnabled((current) => {
      const next = !current;
      void updateProfile((profile) => ({ ...profile, fpsMeterEnabled: next })).then((saved) => {
        profileRef.current = { ...profileRef.current, fpsMeterEnabled: saved.fpsMeterEnabled };
        setProfile((currentProfile) => ({ ...currentProfile, fpsMeterEnabled: saved.fpsMeterEnabled }));
      });
      return next;
    });
  }, []);

  const handleToggleGraphicsQuality = useCallback(() => {
    playSfx('button');
    lowFpsSamplesRef.current = 0;
    setGraphicsQuality((current) => {
      const next = current === 'high' ? 'performance' : 'high';
      graphicsQualityRef.current = next;
      void updateProfile((profile) => ({ ...profile, graphicsQuality: next })).then((saved) => {
        profileRef.current = { ...profileRef.current, graphicsQuality: saved.graphicsQuality };
        setProfile((currentProfile) => ({ ...currentProfile, graphicsQuality: saved.graphicsQuality }));
      });
      return next;
    });
  }, []);

  const handleLayoutSize = useCallback((size: { width: number; height: number }) => {
    layoutRef.current = size;
  }, []);

  const handleZoomChange = useCallback((zoom: number, focalPoint?: Point) => {
    cameraRef.current = focalPoint
      ? setCameraZoomAt(cameraRef.current, zoom, focalPoint)
      : setCameraZoom(cameraRef.current, zoom);
    cameraZoomRef.current = cameraRef.current.zoom;
    setCamera(cameraRef.current);
    setHudCamera(cameraRef.current);
  }, []);

  const handleBuyBaseWard = useCallback(() => {
    if (stateRef.current.winner) return;
    if (!buyBaseWard(stateRef.current, stateRef.current.heroes.player)) return;

    playSfx('shield');
    setHudState(cloneForRender(stateRef.current));
  }, []);

  const handleBuyBaseForge = useCallback(() => {
    if (stateRef.current.winner) return;
    if (!buyBaseForge(stateRef.current, stateRef.current.heroes.player)) return;

    playSfx('upgrade');
    setHudState(cloneForRender(stateRef.current));
  }, []);

  const arenaState = stateRef.current;
  const heroCooldowns = hudState.heroes.player.cooldowns;
  const player = hudState.heroes.player;
  const abilitiesDisabled = paused || Boolean(hudState.winner) || player.hp <= 0 || player.respawnTimer > 0 || player.channelTimer > 0;
  const equippedAbilities = normalizeEquippedAbilities(profile.equippedAbilities, profile.unlockedAbilities);
  const bottomInset = Math.max(0, insets.bottom);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <View style={styles.root}>
        <ArenaView
          state={arenaState}
          camera={camera}
          graphicsQuality={graphicsQuality}
          onLayoutSize={handleLayoutSize}
          onZoomChange={handleZoomChange}
        />
        <FloatingTextOverlay camera={camera} floatingText={arenaState.floatingText} />
        <TutorialOverlay
          time={hudState.time}
          enabled={!profile.tutorialDone && profile.completedLevels.length === 0 && !Boolean(hudState.winner)}
        />
        {fpsMeterEnabled ? <FpsMeter stats={fpsStats} graphicsQuality={graphicsQuality} /> : null}

        <View style={[styles.joystickWrap, { bottom: 42 + bottomInset }]}>
          <VirtualJoystick onMove={handleMove} size={120} />
        </View>

        <View style={[styles.abilities, { bottom: 16 + bottomInset }]}>
          {equippedAbilities.map((ability) => (
            <AbilityButton
              key={ability}
              id={ability}
              cooldown={heroCooldowns[ability]}
              totalCooldown={getAbilityStats(ability, hudState.heroes.player.abilityLevels[ability]).cooldown}
              disabled={abilitiesDisabled}
              onPress={() => handleAbility(ability)}
            />
          ))}
        </View>

        <Hud
          state={hudState}
          camera={hudCamera}
          paused={paused}
          onPause={handlePause}
          onResume={handleResume}
          onReset={handleReset}
          onSurrender={handleSurrender}
          onQuitToMenu={handleMenu}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          fpsMeterEnabled={fpsMeterEnabled}
          onToggleFpsMeter={handleToggleFpsMeter}
          graphicsQuality={graphicsQuality}
          onToggleGraphicsQuality={handleToggleGraphicsQuality}
          onBuyBaseWard={handleBuyBaseWard}
          onBuyBaseForge={handleBuyBaseForge}
          equippedAbilities={equippedAbilities}
        />

        <BattleResultScreen
          state={arenaState}
          saved={resultSaved}
          alreadyCompleted={resultAlreadyCompleted}
          onRetry={handleReset}
          onMenu={handleMenu}
          onContinue={handleContinue}
        />
      </View>
    </SafeAreaView>
  );
}

function parseRouteLevel(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(1, Math.min(100, parsed));
}

function updateGraphicsGuardrail(
  stats: FrameStats,
  state: GameState,
  graphicsQualityRef: MutableRefObject<GraphicsQuality>,
  lowFpsSamplesRef: MutableRefObject<number>,
  setGraphicsQuality: (quality: GraphicsQuality) => void,
): GraphicsQuality | null {
  if (state.winner || graphicsQualityRef.current !== 'high') {
    lowFpsSamplesRef.current = 0;
    return null;
  }

  const underBudget = stats.fps < AUTO_PERFORMANCE_FPS || stats.frameMs > AUTO_PERFORMANCE_FRAME_MS;
  lowFpsSamplesRef.current = underBudget
    ? lowFpsSamplesRef.current + 1
    : Math.max(0, lowFpsSamplesRef.current - 2);

  if (lowFpsSamplesRef.current < AUTO_PERFORMANCE_SAMPLES) {
    return null;
  }

  graphicsQualityRef.current = 'performance';
  lowFpsSamplesRef.current = 0;
  setGraphicsQuality('performance');
  return 'performance';
}

function playLatestEffectSfx(
  state: GameState,
  camera: ReturnType<typeof createInitialCamera>,
  now: number,
  lastEffectIdRef: MutableRefObject<string | null>,
  lastEffectAtRef: MutableRefObject<number>,
) {
  const latestEffect = state.effects[state.effects.length - 1];
  if (!latestEffect || latestEffect.id === lastEffectIdRef.current) return;

  lastEffectIdRef.current = latestEffect.id;
  const sfx = effectToSfx(latestEffect);
  if (!sfx || now - lastEffectAtRef.current < 95) return;

  if (!isWorldPointNearCamera(latestEffect.position, camera, 160)) return;

  lastEffectAtRef.current = now;
  playSfx(sfx);
}

function playEnemyCastSfx(
  state: GameState,
  camera: ReturnType<typeof createInitialCamera>,
  now: number,
  lastCastKeyRef: MutableRefObject<string | null>,
  lastCastAtRef: MutableRefObject<number>,
  lastEffectAtRef: MutableRefObject<number>,
) {
  const enemy = state.heroes.enemy;
  if (!enemy.lastCastAbility || enemy.lastCastTime < 0 || enemy.hp <= 0 || enemy.respawnTimer > 0) return;

  const castKey = `${enemy.lastCastAbility}:${enemy.lastCastTime.toFixed(3)}`;
  if (castKey === lastCastKeyRef.current) return;
  lastCastKeyRef.current = castKey;

  if (now - lastCastAtRef.current < 140) return;
  if (!isWorldPointNearCamera(enemy.position, camera, 190)) return;

  lastCastAtRef.current = now;
  lastEffectAtRef.current = now;
  playSfx(abilityToSfx(enemy.lastCastAbility));
}

function playObjectiveAttackSfx(
  state: GameState,
  camera: ReturnType<typeof createInitialCamera>,
  now: number,
  lastProjectileIdRef: MutableRefObject<string | null>,
  lastObjectiveAtRef: MutableRefObject<number>,
  lastBossAttackKeyRef: MutableRefObject<string | null>,
  lastCreatureAttackKeyRef: MutableRefObject<string | null>,
) {
  const latestProjectile = state.projectiles[state.projectiles.length - 1];
  if (
    latestProjectile &&
    latestProjectile.kind === 'tower' &&
    latestProjectile.id !== lastProjectileIdRef.current
  ) {
    lastProjectileIdRef.current = latestProjectile.id;
    if (
      now - lastObjectiveAtRef.current >= 180 &&
      isWorldPointNearCamera(latestProjectile.position, camera, 180)
    ) {
      lastObjectiveAtRef.current = now;
      playSfx('tower');
      return;
    }
  }

  const latestCreatureAttack = state.jungleCreatures.reduce((latest, creature) => {
    if (!creature.alive || creature.lastAttackTime < 0) return latest;
    if (!latest || creature.lastAttackTime > latest.lastAttackTime) return creature;
    return latest;
  }, null as GameState['jungleCreatures'][number] | null);

  if (latestCreatureAttack) {
    const creatureAttackKey = `${latestCreatureAttack.id}:${latestCreatureAttack.lastAttackTime.toFixed(3)}`;
    if (creatureAttackKey !== lastCreatureAttackKeyRef.current) {
      lastCreatureAttackKeyRef.current = creatureAttackKey;
      if (
        now - lastObjectiveAtRef.current >= 260 &&
        isWorldPointNearCamera(latestCreatureAttack.position, camera, 240)
      ) {
        lastObjectiveAtRef.current = now;
        playSfx(latestCreatureAttack.kind === 'dragon' ? 'boss' : 'hit');
        return;
      }
    }
  }

  const boss = state.jungleBoss;
  if (!boss || !boss.alive || boss.lastAttackTime < 0) return;

  const bossAttackKey = boss.lastAttackTime.toFixed(3);
  if (bossAttackKey === lastBossAttackKeyRef.current) return;
  lastBossAttackKeyRef.current = bossAttackKey;

  if (now - lastObjectiveAtRef.current < 420) return;
  if (!isWorldPointNearCamera(boss.position, camera, 280)) return;

  lastObjectiveAtRef.current = now;
  playSfx('boss');
}

function isWorldPointNearCamera(
  position: { x: number; y: number },
  camera: ReturnType<typeof createInitialCamera>,
  padding: number,
) {
  const visible = getVisibleWorldRect(camera);
  return (
    position.x >= visible.x - padding &&
    position.x <= visible.x + visible.width + padding &&
    position.y >= visible.y - padding &&
    position.y <= visible.y + visible.height + padding
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.void,
  },
  root: {
    flex: 1,
    backgroundColor: COLORS.void,
    overflow: 'hidden',
  },
  joystickWrap: {
    position: 'absolute',
    left: 18,
  },
  abilities: {
    position: 'absolute',
    right: 18,
    width: 212,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    gap: 8,
  },
});
