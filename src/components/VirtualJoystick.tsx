import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { TEAM_COLORS } from '@/game/constants';
import type { JoystickVector } from '@/game/types';

type VirtualJoystickProps = {
  size?: number;
  onMove: (vector: JoystickVector) => void;
};

const DEAD_ZONE = 0.12;

export function VirtualJoystick({ size = 104, onMove }: VirtualJoystickProps) {
  const knobX = useSharedValue(0);
  const knobY = useSharedValue(0);
  const lastCallRef = useRef(0);
  const pendingUpdate = useRef<JoystickVector | null>(null);
  const rafRef = useRef<number | null>(null);
  const maxDistance = size / 2 - 24;
  const knobSize = size * 0.42;

  const throttledOnMove = useCallback((vector: JoystickVector) => {
    const now = Date.now();
    if (now - lastCallRef.current > 28) {
      lastCallRef.current = now;
      onMove(vector);
      return;
    }

    pendingUpdate.current = vector;
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingUpdate.current) {
          onMove(pendingUpdate.current);
          pendingUpdate.current = null;
        }
      });
    }
  }, [onMove]);

  useEffect(() => () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  const emitMove = useCallback((rawX: number, rawY: number) => {
    const vector = normalizeJoystick(rawX, rawY, maxDistance);
    throttledOnMove(vector);
  }, [maxDistance, throttledOnMove]);

  const panGesture = Gesture.Pan()
    .onBegin((event) => {
      'worklet';
      const x = event.x - size / 2;
      const y = event.y - size / 2;
      const clamped = clampKnob(x, y, maxDistance);
      knobX.value = clamped.x;
      knobY.value = clamped.y;
      runOnJS(emitMove)(clamped.x, clamped.y);
    })
    .onUpdate((event) => {
      'worklet';
      const x = event.x - size / 2;
      const y = event.y - size / 2;
      const clamped = clampKnob(x, y, maxDistance);
      knobX.value = clamped.x;
      knobY.value = clamped.y;
      runOnJS(emitMove)(clamped.x, clamped.y);
    })
    .onEnd(() => {
      'worklet';
      knobX.value = withSpring(0, { damping: 15, stiffness: 150 });
      knobY.value = withSpring(0, { damping: 15, stiffness: 150 });
      runOnJS(throttledOnMove)({ x: 0, y: 0, magnitude: 0 });
    })
    .onFinalize(() => {
      'worklet';
      knobX.value = withSpring(0, { damping: 15, stiffness: 150 });
      knobY.value = withSpring(0, { damping: 15, stiffness: 150 });
      runOnJS(throttledOnMove)({ x: 0, y: 0, magnitude: 0 });
    })
    .shouldCancelWhenOutside(false);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: knobX.value },
      { translateY: knobY.value },
    ],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <View style={[styles.container, { width: size, height: size }]}>
        <View style={[styles.base, { width: size, height: size, borderRadius: size / 2 }]}>
          <View
            style={[
              styles.innerRing,
              {
                width: size * 0.58,
                height: size * 0.58,
                borderRadius: size * 0.29,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.knob,
              {
                width: knobSize,
                height: knobSize,
                borderRadius: knobSize / 2,
              },
              knobStyle,
            ]}
          />
        </View>
      </View>
    </GestureDetector>
  );
}

function clampKnob(x: number, y: number, maxDistance: number) {
  'worklet';
  const distance = Math.sqrt(x * x + y * y);
  if (distance <= maxDistance || distance <= 0) {
    return { x, y };
  }

  return {
    x: (x / distance) * maxDistance,
    y: (y / distance) * maxDistance,
  };
}

function normalizeJoystick(x: number, y: number, maxDistance: number): JoystickVector {
  const rawMagnitude = Math.min(1, Math.hypot(x, y) / maxDistance);

  if (rawMagnitude < DEAD_ZONE) {
    return { x: 0, y: 0, magnitude: 0 };
  }

  const distance = Math.max(0.001, Math.hypot(x, y));
  const adjustedMagnitude = (rawMagnitude - DEAD_ZONE) / (1 - DEAD_ZONE);

  return {
    x: x / distance,
    y: y / distance,
    magnitude: Math.min(1, adjustedMagnitude),
  };
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  base: {
    backgroundColor: 'rgba(5,12,17,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.24)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.14)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(71,216,255,0.05)',
  },
  knob: {
    backgroundColor: TEAM_COLORS.blue.main,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
    boxShadow: '0 0 9px rgba(61,229,255,0.65)',
  },
});
