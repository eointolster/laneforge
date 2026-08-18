import { useCallback, useEffect } from 'react';
import { Canvas } from '@shopify/react-native-skia';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';

import { AbilityIcon } from '@/assets/icons';
import { ABILITY_LABELS, COLORS, TEAM_COLORS } from '@/game/constants';
import type { AbilityId } from '@/game/types';
import { Path } from '@/rendering/skiaElements';

type AbilityButtonProps = {
  id: AbilityId;
  cooldown: number;
  totalCooldown: number;
  disabled?: boolean;
  onPress: () => void;
};

const ABILITY_READY_THEME: Record<AbilityId, { border: string; glow: string; text: string }> = {
  bolt: { border: 'rgba(156,238,255,0.78)', glow: 'rgba(61,229,255,0.2)', text: '#BFFFFF' },
  dash: { border: 'rgba(234,248,245,0.74)', glow: 'rgba(234,248,245,0.16)', text: '#EAF8F5' },
  pulse: { border: 'rgba(124,255,176,0.78)', glow: 'rgba(124,255,176,0.2)', text: '#D7FFE4' },
  fireball: { border: 'rgba(255,177,95,0.82)', glow: 'rgba(255,129,47,0.24)', text: '#FFE9A8' },
  shield: { border: 'rgba(136,238,255,0.82)', glow: 'rgba(136,238,255,0.2)', text: '#D8FBFF' },
  chain: { border: 'rgba(199,165,255,0.82)', glow: 'rgba(199,165,255,0.2)', text: '#F0E4FF' },
  trap: { border: 'rgba(255,211,106,0.82)', glow: 'rgba(199,165,255,0.18)', text: '#FFE9A8' },
  ult: { border: 'rgba(255,211,106,0.9)', glow: 'rgba(255,211,106,0.24)', text: '#FFF7D6' },
};

export function AbilityButton({ id, cooldown, totalCooldown, disabled: forceDisabled = false, onPress }: AbilityButtonProps) {
  const onCooldown = cooldown > 0;
  const disabled = forceDisabled || onCooldown;
  const isUltimate = id === 'ult';
  const buttonSize = isUltimate ? 64 : 56;
  const cooldownStrokeWidth = isUltimate ? 5 : 4.5;
  const cooldownRadius = buttonSize / 2 - cooldownStrokeWidth - 1.5;
  const progress = totalCooldown > 0 ? Math.min(1, cooldown / totalCooldown) : 0;
  const cooldownTrackPath = describeArc(buttonSize / 2, buttonSize / 2, cooldownRadius, 1);
  const cooldownPath = describeArc(buttonSize / 2, buttonSize / 2, cooldownRadius, progress);
  const canUseSkiaCooldown = Platform.OS !== 'web' || typeof (globalThis as typeof globalThis & { CanvasKit?: unknown }).CanvasKit !== 'undefined';
  const readyTheme = ABILITY_READY_THEME[id];
  const buttonFrame = {
    width: buttonSize,
    height: buttonSize,
    borderRadius: buttonSize / 2,
  };
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const readyPulse = useSharedValue(0);

  const callPress = useCallback(() => {
    if (!disabled) {
      onPress();
    }
  }, [disabled, onPress]);

  const gesture = Gesture.Manual()
    .onTouchesDown(() => {
      'worklet';
      scale.value = withSpring(0.92, { damping: 15 });
      opacity.value = 0.88;
      runOnJS(callPress)();
    })
    .onTouchesUp(() => {
      'worklet';
      scale.value = withSpring(1, { damping: 15 });
      opacity.value = 1;
    })
    .onTouchesCancelled(() => {
      'worklet';
      scale.value = withSpring(1, { damping: 15 });
      opacity.value = 1;
    })
    .shouldCancelWhenOutside(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const readyGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.42 + readyPulse.value * 0.32,
    transform: [{ scale: 1 + readyPulse.value * 0.1 }],
  }));

  useEffect(() => {
    readyPulse.value = disabled
      ? withTiming(0, { duration: 120 })
      : withRepeat(withTiming(1, { duration: 850 }), -1, true);
  }, [disabled, readyPulse]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.button, buttonFrame, isUltimate && styles.ultimate, !disabled && styles.ready, !disabled && { borderColor: readyTheme.border }, disabled && styles.disabled, animatedStyle]}>
        {!disabled ? <Animated.View pointerEvents="none" style={[styles.readyGlow, isUltimate && styles.ultimateReadyGlow, { backgroundColor: readyTheme.glow }, readyGlowStyle]} /> : null}
        {!disabled ? <Text style={[styles.readyBadge, { color: readyTheme.text }]}>READY</Text> : null}
        <AbilityIcon id={id} color={disabled ? '#7D908D' : isUltimate ? COLORS.warning : '#EAF8F5'} size={isUltimate ? 28 : 23} />
        <Text style={styles.label} numberOfLines={1}>{ABILITY_LABELS[id]}</Text>
        {onCooldown ? (
          <View pointerEvents="none" style={styles.cooldownOverlay}>
            <View style={styles.cooldownShade} />
            {canUseSkiaCooldown ? (
              <Canvas style={[styles.cooldownArc, { width: buttonSize, height: buttonSize }]}>
                {cooldownTrackPath ? (
                  <Path
                    d={cooldownTrackPath}
                    fill="none"
                    stroke="rgba(234,248,245,0.2)"
                    strokeLinecap="round"
                    strokeWidth={cooldownStrokeWidth}
                  />
                ) : null}
                {cooldownPath ? (
                  <Path
                    d={cooldownPath}
                    fill="none"
                    stroke={isUltimate ? COLORS.warning : TEAM_COLORS.blue.soft}
                    strokeLinecap="round"
                    strokeWidth={cooldownStrokeWidth}
                    opacity={0.86}
                  />
                ) : null}
              </Canvas>
            ) : null}
            <Text style={styles.cooldownText}>{cooldown.toFixed(1)}</Text>
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

function describeArc(cx: number, cy: number, radius: number, progress: number) {
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped <= 0.001) return null;
  if (clamped >= 0.999) {
    return `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius} A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius}`;
  }

  const start = pointOnCircle(cx, cy, radius, -90);
  const end = pointOnCircle(cx, cy, radius, -90 + clamped * 360);
  const largeArcFlag = clamped > 0.5 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function pointOnCircle(cx: number, cy: number, radius: number, angleDegrees: number) {
  const angle = (angleDegrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

const styles = StyleSheet.create({
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(234,248,245,0.32)',
    backgroundColor: 'rgba(6,20,26,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 0,
    boxShadow: '0 0 8px rgba(61,229,255,0.28)',
  },
  ultimate: {
    borderColor: 'rgba(255,211,106,0.7)',
    boxShadow: '0 0 12px rgba(255,211,106,0.42)',
  },
  ready: {
    borderColor: 'rgba(234,248,245,0.46)',
    backgroundColor: 'rgba(9,27,34,0.82)',
  },
  readyGlow: {
    position: 'absolute',
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: 'rgba(61,229,255,0.16)',
  },
  readyBadge: {
    position: 'absolute',
    top: 3,
    fontSize: 6,
    lineHeight: 7,
    fontWeight: '900',
    letterSpacing: 0,
  },
  ultimateReadyGlow: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,211,106,0.18)',
  },
  disabled: {
    borderColor: 'rgba(130,147,145,0.2)',
    backgroundColor: 'rgba(4,10,14,0.64)',
  },
  label: {
    color: COLORS.text,
    fontSize: 8,
    fontWeight: '900',
    lineHeight: 9,
    marginTop: -1,
  },
  cooldownOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cooldownShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cooldownArc: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  cooldownText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
});
