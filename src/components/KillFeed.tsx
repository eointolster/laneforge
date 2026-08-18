import { StyleSheet, Text, View } from 'react-native';

import { COLORS, TEAM_COLORS } from '@/game/constants';
import type { GameEvent } from '@/game/types';

type KillFeedProps = {
  events: GameEvent[];
  time: number;
};

export function KillFeed({ events, time }: KillFeedProps) {
  const visible = events
    .filter((event) => time - event.time < 4.8)
    .slice(-3)
    .reverse();

  if (visible.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {visible.map((event) => (
        <View key={event.id} style={[styles.item, { opacity: eventOpacity(time - event.time) }]}>
          <View style={[styles.dot, { backgroundColor: TEAM_COLORS[event.team].main }]} />
          <Text style={styles.text}>{event.message}</Text>
          <Text style={styles.time}>{formatEventTime(event.time)}</Text>
        </View>
      ))}
    </View>
  );
}

function formatEventTime(time: number) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function eventOpacity(age: number) {
  if (age < 4) return 0.85;
  return Math.max(0, 0.85 * (1 - (age - 4) / 0.8));
}

const styles = StyleSheet.create({
  container: {
    gap: 5,
  },
  item: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.12)',
    backgroundColor: 'rgba(5,12,17,0.66)',
    paddingHorizontal: 9,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  text: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '900',
  },
  time: {
    color: COLORS.mutedText,
    fontSize: 9,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
});
