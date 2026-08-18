import { StyleSheet, Text, View } from 'react-native';

import { COLORS, TEAM_COLORS } from '@/game/constants';
import type { GameEvent } from '@/game/types';

type EventBannerProps = {
  events: GameEvent[];
  time: number;
};

export function EventBanner({ events, time }: EventBannerProps) {
  const event = [...events].reverse().find((candidate) => (
    time - candidate.time < 2.1 &&
    (candidate.kind === 'hero_kill' || candidate.kind === 'boss_kill' || candidate.kind === 'structure_destroy')
  ));

  if (!event) return null;

  const age = time - event.time;
  const opacity = age < 1.45 ? 1 : Math.max(0, 1 - (age - 1.45) / 0.65);
  const slideIn = Math.max(0, 1 - age / 0.22);
  const slideOut = age > 1.55 ? Math.min(1, (age - 1.55) / 0.55) : 0;
  const translateY = -18 * slideIn - 12 * slideOut;
  const label = event.kind === 'hero_kill'
    ? 'CHAMPION SLAIN'
    : event.kind === 'boss_kill'
      ? 'DRAGON SLAIN'
      : 'TOWER DESTROYED';
  const teamLabel = event.team === 'blue' ? 'BLUE' : 'RED';
  const teamColor = TEAM_COLORS[event.team].main;
  const flashOpacity = age < 0.55
    ? Math.max(0, 1 - age / 0.55) * (event.kind === 'boss_kill' ? 0.32 : event.kind === 'hero_kill' ? 0.24 : 0.2)
    : 0;
  const flashColor = event.kind === 'boss_kill'
    ? '#9B5CFF'
    : event.kind === 'structure_destroy'
      ? COLORS.warning
      : TEAM_COLORS[event.team].main;

  return (
    <>
      {flashOpacity > 0 ? <EventFlash color={flashColor} opacity={flashOpacity} full={event.kind === 'boss_kill'} /> : null}
      <View style={[styles.container, { opacity, transform: [{ translateY }] }]} pointerEvents="none">
        <View style={[styles.accent, { backgroundColor: teamColor }]} />
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <View style={[styles.teamPill, { borderColor: teamColor, backgroundColor: `${teamColor}24` }]}>
              <View style={[styles.teamGem, { backgroundColor: teamColor }]} />
              <Text style={[styles.teamText, { color: TEAM_COLORS[event.team].soft }]}>{teamLabel}</Text>
            </View>
            <Text style={styles.text} numberOfLines={1}>{label}</Text>
          </View>
          <Text style={styles.message} numberOfLines={1}>{event.message}</Text>
        </View>
        <View style={[styles.accent, { backgroundColor: teamColor }]} />
      </View>
    </>
  );
}

function EventFlash({ color, opacity, full }: { color: string; opacity: number; full: boolean }) {
  if (full) {
    return <View style={[styles.fullFlash, { backgroundColor: color, opacity }]} pointerEvents="none" />;
  }

  return (
    <View style={styles.edgeFlash} pointerEvents="none">
      <View style={[styles.flashTop, { backgroundColor: color, opacity }]} />
      <View style={[styles.flashBottom, { backgroundColor: color, opacity }]} />
      <View style={[styles.flashLeft, { backgroundColor: color, opacity: opacity * 0.82 }]} />
      <View style={[styles.flashRight, { backgroundColor: color, opacity: opacity * 0.82 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    minWidth: 318,
    maxWidth: 420,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.28)',
    backgroundColor: 'rgba(5,12,17,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  accent: {
    width: 28,
    height: 2,
    borderRadius: 1,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  teamPill: {
    height: 16,
    minWidth: 54,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  teamGem: {
    width: 6,
    height: 6,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  teamText: {
    fontSize: 8,
    fontWeight: '900',
  },
  text: {
    color: COLORS.warning,
    fontSize: 14,
    fontWeight: '900',
    textShadowColor: 'rgba(255,211,106,0.45)',
    textShadowRadius: 8,
    flexShrink: 1,
  },
  message: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '900',
    opacity: 0.9,
    maxWidth: 260,
  },
  fullFlash: {
    ...StyleSheet.absoluteFillObject,
  },
  edgeFlash: {
    ...StyleSheet.absoluteFillObject,
  },
  flashTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 46,
  },
  flashBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 54,
  },
  flashLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 42,
  },
  flashRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 42,
  },
});
