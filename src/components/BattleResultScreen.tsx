import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { COLORS, TEAM_COLORS } from '@/game/constants';
import { getHeroDefinition } from '@/game/heroes';
import { levelModifierSummary } from '@/game/levels';
import type { GameState } from '@/game/types';
import { HeroPreviewBadge } from './HeroPreviewBadge';

type BattleResultScreenProps = {
  state: GameState;
  saved: boolean;
  alreadyCompleted: boolean;
  onRetry: () => void;
  onMenu: () => void;
  onContinue: () => void;
};

export function BattleResultScreen({
  state,
  saved,
  alreadyCompleted,
  onRetry,
  onMenu,
  onContinue,
}: BattleResultScreenProps) {
  const posePulse = useRef(new Animated.Value(0)).current;
  const statsIntro = useRef(new Animated.Value(0)).current;
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!state.winner) return undefined;

    statsIntro.setValue(0);
    Animated.timing(statsIntro, { toValue: 1, duration: 620, useNativeDriver: true }).start();
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(posePulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(posePulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [posePulse, state.winner, statsIntro]);

  if (!state.winner) return null;

  const playerWon = state.winner === 'blue';
  const minutes = Math.floor(state.time / 60);
  const seconds = Math.floor(state.time % 60).toString().padStart(2, '0');
  const rewardPoints = playerWon && !alreadyCompleted ? state.levelConfig.rewardUpgradePoints : 0;
  const rewardGold = playerWon ? state.levelConfig.rewardGold : Math.floor(state.levelConfig.rewardGold * 0.25);
  const unspentMatchGold = Math.floor(state.heroes.player.gold);
  const bankedUnspentGold = Math.floor(unspentMatchGold * (playerWon ? 0.25 : 0.1));
  const totalGoldReward = rewardGold + bankedUnspentGold;
  const compact = width < 760 || height < 390;
  const panelWidth = Math.min(430, Math.max(320, width - 42));
  const heroDefinition = getHeroDefinition(state.matchStats.heroUsed);

  return (
    <View style={styles.backdrop}>
      <View style={[styles.panel, compact && styles.panelCompact, { width: panelWidth, borderColor: playerWon ? TEAM_COLORS.blue.main : TEAM_COLORS.red.main }]}>
        <Text style={[styles.title, compact && styles.titleCompact, { color: playerWon ? '#FFD36A' : TEAM_COLORS.red.soft }]}>
          {playerWon ? 'VICTORY' : 'DEFEATED'}
        </Text>
        <Text style={styles.subtitle}>
          {playerWon ? `Level ${state.levelConfig.level} Complete` : `Level ${state.levelConfig.level} Failed`}
        </Text>
        <Text style={styles.levelTitle}>{state.levelConfig.levelTitle}</Text>
        <Text style={styles.modifierLine}>{levelModifierSummary(state.levelConfig)}</Text>
        {state.gameOverReason ? <Text style={styles.reason}>{state.gameOverReason}</Text> : null}

        <ResultHeroVignette state={state} playerWon={playerWon} pulse={posePulse} compact={compact} />

        <View style={[styles.statsGrid, compact && styles.statsGridCompact]}>
          <ResultStat label="Hero" value={heroDefinition.name} progress={statsIntro} order={0} />
          <ResultStat label="Time" value={`${minutes}:${seconds}`} progress={statsIntro} order={1} />
          <ResultStat label="Kills" value={state.teamKills.blue.toString()} progress={statsIntro} order={2} />
          <ResultStat label="Damage" value={state.matchStats.damageDealt.toString()} progress={statsIntro} order={3} />
          <ResultStat label="Towers" value={state.matchStats.towersDestroyed.toString()} progress={statsIntro} order={4} />
          <ResultStat label="Deaths" value={state.heroDeaths.blue.toString()} progress={statsIntro} order={5} />
          <ResultStat label="Unspent Gold" value={unspentMatchGold.toString()} progress={statsIntro} order={6} />
        </View>

        <View style={[styles.rewardRow, compact && styles.rewardRowCompact]}>
          <View style={styles.rewardPill}>
            <Text style={styles.rewardLabel}>Upgrade Points</Text>
            <Text style={styles.rewardValue}>{rewardPoints > 0 ? `+${rewardPoints}` : alreadyCompleted && playerWon ? 'Replay' : '+0'}</Text>
          </View>
          <View style={styles.rewardPill}>
            <Text style={styles.rewardLabel}>Banked Gold</Text>
            <Text style={styles.rewardValue}>+{totalGoldReward}</Text>
          </View>
        </View>
        <Text style={styles.goldSpendHint}>Gold buys Ward/Power in battle and ability upgrades between levels.</Text>
        {playerWon ? (
          <View style={styles.nextStepPill}>
            <Text style={styles.nextStepText}>Next: choose an upgrade before the next fight</Text>
          </View>
        ) : null}

        <View style={[styles.actions, compact && styles.actionsCompact]}>
          <ResultButton label="Menu" onPress={onMenu} />
          <ResultButton label="Retry" onPress={onRetry} />
          {playerWon ? <ResultButton label={saved ? 'Upgrade Now' : 'Saving'} onPress={onContinue} primary disabled={!saved} pulse={saved ? posePulse : undefined} /> : null}
        </View>
      </View>
    </View>
  );
}

function ResultHeroVignette({ state, playerWon, pulse, compact }: { state: GameState; playerWon: boolean; pulse: Animated.Value; compact: boolean }) {
  const hero = state.heroes.player;
  const color = hero.heroColor ?? TEAM_COLORS.blue.main;
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: playerWon ? [1, 1.06] : [1, 0.97],
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: playerWon ? [0.28, 0.52] : [0.18, 0.34],
  });
  const rotate = playerWon ? '0deg' : '-14deg';

  return (
    <View style={[styles.heroVignette, compact && styles.heroVignetteCompact]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.heroGlow,
          {
            backgroundColor: playerWon ? color : TEAM_COLORS.red.main,
            opacity: glowOpacity,
            transform: [{ scale }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.heroPose,
          {
            transform: [
              { scale },
              { rotate },
              { translateY: playerWon ? -3 : 7 },
            ],
          },
        ]}
      >
        <HeroPreviewBadge color={playerWon ? color : TEAM_COLORS.red.main} design={hero.heroDesign ?? 'knight'} size={compact ? 74 : 92} />
      </Animated.View>
      <View style={[styles.poseRing, { borderColor: playerWon ? '#FFD36A' : TEAM_COLORS.red.soft }]} />
      <Text style={[styles.poseLabel, { color: playerWon ? '#7CFFB0' : TEAM_COLORS.red.soft }]}>
        {playerWon ? 'Champion standing' : 'Champion down'}
      </Text>
    </View>
  );
}

function ResultStat({ label, value, progress, order }: { label: string; value: string; progress: Animated.Value; order: number }) {
  const start = order * 0.08;
  const opacity = progress.interpolate({
    inputRange: [0, start, Math.min(1, start + 0.32), 1],
    outputRange: [0, 0, 1, 1],
  });
  const translateY = progress.interpolate({
    inputRange: [0, start, Math.min(1, start + 0.32), 1],
    outputRange: [8, 8, 0, 0],
  });

  return (
    <Animated.View style={[styles.stat, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

function ResultButton({ label, onPress, primary = false, disabled = false, pulse }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean; pulse?: Animated.Value }) {
  const flashOpacity = pulse?.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.46],
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primaryButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      {pulse ? <Animated.View pointerEvents="none" style={[styles.primaryFlash, { opacity: flashOpacity }]} /> : null}
      <Text style={[styles.buttonText, primary && styles.primaryButtonText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  panel: {
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: COLORS.panelStrong,
    alignItems: 'center',
    padding: 18,
    gap: 10,
  },
  panelCompact: {
    padding: 12,
    gap: 7,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: 0,
    textShadowColor: 'rgba(255,211,106,0.42)',
    textShadowRadius: 12,
  },
  titleCompact: {
    fontSize: 27,
    lineHeight: 31,
  },
  subtitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
  },
  levelTitle: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
  modifierLine: {
    color: 'rgba(52,211,153,0.72)',
    fontSize: 10,
    fontWeight: '900',
    marginTop: -4,
  },
  reason: {
    color: 'rgba(234,248,245,0.66)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: -5,
  },
  heroVignette: {
    width: '100%',
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroVignetteCompact: {
    height: 70,
  },
  heroGlow: {
    position: 'absolute',
    width: 142,
    height: 64,
    borderRadius: 72,
  },
  heroPose: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poseRing: {
    position: 'absolute',
    bottom: 7,
    width: 108,
    height: 28,
    borderRadius: 54,
    borderWidth: 2,
    opacity: 0.42,
  },
  poseLabel: {
    position: 'absolute',
    right: 0,
    bottom: 8,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  nextStepPill: {
    minHeight: 22,
    borderRadius: 7,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,85,51,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
  },
  nextStepText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  statsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statsGridCompact: {
    gap: 6,
  },
  stat: {
    flexGrow: 1,
    flexBasis: 86,
    minWidth: 74,
    borderRadius: 7,
    backgroundColor: 'rgba(234,248,245,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.1)',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },
  statLabel: {
    color: COLORS.mutedText,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  rewardRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  rewardRowCompact: {
    gap: 6,
  },
  rewardPill: {
    flex: 1,
    borderRadius: 7,
    backgroundColor: 'rgba(255,211,106,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.24)',
    padding: 10,
  },
  rewardLabel: {
    color: 'rgba(234,248,245,0.66)',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  rewardValue: {
    color: '#FFD36A',
    fontSize: 16,
    fontWeight: '900',
  },
  goldSpendHint: {
    color: 'rgba(255,211,106,0.78)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: -4,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionsCompact: {
    gap: 6,
  },
  button: {
    height: 38,
    minWidth: 92,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234,248,245,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.14)',
    overflow: 'hidden',
  },
  primaryButton: {
    backgroundColor: '#D71920',
    borderColor: '#FFFFFF',
  },
  primaryFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.52,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(80,0,0,0.55)',
    textShadowRadius: 5,
  },
});
