import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/game/constants';
import type { GraphicsQuality } from '@/game/types';
import type { FrameStats } from '@/performance/fps';

type FpsMeterProps = {
  stats: FrameStats;
  graphicsQuality: GraphicsQuality;
};

export function FpsMeter({ stats, graphicsQuality }: FpsMeterProps) {
  const stable = stats.fps >= 28 && stats.frameMs <= 42;

  return (
    <View pointerEvents="none" style={styles.container}>
      <Text style={[styles.value, stable ? styles.good : styles.warn]}>
        FPS {Math.round(stats.fps)}
      </Text>
      <Text style={styles.meta}>
        {stats.frameMs.toFixed(1)}ms  slow {stats.slowFrames}
      </Text>
      <Text style={styles.quality}>{graphicsQuality === 'high' ? 'FX high' : 'FPS mode'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 10,
    top: 54,
    minWidth: 84,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.14)',
    backgroundColor: 'rgba(5,12,17,0.5)',
  },
  value: {
    fontSize: 10,
    fontWeight: '900',
  },
  good: {
    color: '#9CEEFF',
  },
  warn: {
    color: COLORS.warning,
  },
  meta: {
    marginTop: 1,
    color: COLORS.mutedText,
    fontSize: 8,
    fontWeight: '800',
  },
  quality: {
    marginTop: 1,
    color: 'rgba(234,248,245,0.62)',
    fontSize: 8,
    fontWeight: '900',
  },
});
