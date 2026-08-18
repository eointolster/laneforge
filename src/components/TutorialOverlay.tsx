import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/game/constants';

type TutorialOverlayProps = {
  time: number;
  enabled: boolean;
};

const STEPS = [
  { end: 14, title: 'Move', text: 'Use the left stick to keep your champion with the wave.' },
  { end: 30, title: 'Attack', text: 'Stay near enemies. Basic attacks fire automatically when a target is in range.' },
  { end: 48, title: 'Abilities', text: 'Cast from the right-side buttons. Heal is your safest early recovery tool.' },
  { end: 68, title: 'Pressure', text: 'Stand near your minions so they absorb tower fire before you commit.' },
  { end: 90, title: 'Objective', text: 'Break towers, then the enemy core. The top bar shows the whole match state.' },
] as const;

export function TutorialOverlay({ time, enabled }: TutorialOverlayProps) {
  if (!enabled || time >= STEPS[STEPS.length - 1].end) return null;

  const step = STEPS.find((candidate) => time < candidate.end) ?? STEPS[STEPS.length - 1];

  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.text}>{step.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 132,
    alignItems: 'center',
  },
  panel: {
    maxWidth: 360,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.28)',
    backgroundColor: 'rgba(5,12,17,0.78)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  title: {
    color: COLORS.warning,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  text: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
});
