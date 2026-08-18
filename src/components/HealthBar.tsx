import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/game/constants';

type HealthBarProps = {
  label?: string;
  value: number;
  max: number;
  color: string;
  compact?: boolean;
};

export function HealthBar({ label, value, max, color, compact = false }: HealthBarProps) {
  const ratio = Math.max(0, Math.min(1, value / max));
  const [drainRatio, setDrainRatio] = useState(ratio);

  useEffect(() => {
    if (ratio >= drainRatio) {
      setDrainRatio(ratio);
      return undefined;
    }

    const timer = setTimeout(() => setDrainRatio(ratio), 220);
    return () => clearTimeout(timer);
  }, [drainRatio, ratio]);

  return (
    <View style={[styles.container, compact && styles.compact]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{Math.ceil(value)}</Text>
        </View>
      ) : null}
      <View style={[styles.track, compact && styles.trackCompact]}>
        <View style={[styles.drain, { width: `${drainRatio * 100}%` }]} />
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
        <Text style={[styles.inlineValue, compact && styles.inlineValueCompact]}>{Math.ceil(value)}/{Math.ceil(max)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 118,
    gap: 4,
  },
  compact: {
    minWidth: 92,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '800',
  },
  value: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '900',
  },
  track: {
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.62)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  trackCompact: {
    height: 10,
    borderRadius: 3,
  },
  drain: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    borderRadius: 4,
  },
  inlineValue: {
    color: '#F8FFFF',
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowRadius: 3,
    fontVariant: ['tabular-nums'],
  },
  inlineValueCompact: {
    fontSize: 7,
    lineHeight: 10,
  },
});
