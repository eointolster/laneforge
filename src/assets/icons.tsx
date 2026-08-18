import { Canvas } from '@shopify/react-native-skia';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import type { AbilityId } from '@/game/types';
import { Circle, G, Path, Rect } from '@/rendering/skiaElements';

type IconProps = {
  color: string;
  size?: number;
};

export function AbilityIcon({ id, color, size = 28 }: IconProps & { id: AbilityId }) {
  if (!canUseSkiaCanvas()) {
    return <FallbackAbilityIcon id={id} color={color} size={size} />;
  }

  if (id === 'fireball') {
    return <IconCanvas size={size}><FireballIcon color={color} /></IconCanvas>;
  }
  if (id === 'shield') {
    return <IconCanvas size={size}><ShieldIcon color={color} /></IconCanvas>;
  }
  if (id === 'chain') {
    return <IconCanvas size={size}><ChainIcon color={color} /></IconCanvas>;
  }
  if (id === 'trap') {
    return <IconCanvas size={size}><TrapIcon color={color} /></IconCanvas>;
  }
  if (id === 'ult') {
    return <IconCanvas size={size}><UltIcon color={color} /></IconCanvas>;
  }
  if (id === 'dash') {
    return <IconCanvas size={size}><DashIcon color={color} /></IconCanvas>;
  }
  if (id === 'pulse') {
    return <IconCanvas size={size}><PulseIcon color={color} /></IconCanvas>;
  }
  return <IconCanvas size={size}><BoltIcon color={color} /></IconCanvas>;
}

function canUseSkiaCanvas() {
  return Platform.OS !== 'web' || typeof (globalThis as typeof globalThis & { CanvasKit?: unknown }).CanvasKit !== 'undefined';
}

function FallbackAbilityIcon({ id, color, size = 28 }: IconProps & { id: AbilityId }) {
  return (
    <View pointerEvents="none" style={[styles.fallbackIcon, { width: size, height: size, borderRadius: size / 2, borderColor: color }]}>
      <Text style={[styles.fallbackIconText, { color, fontSize: Math.max(10, size * 0.46), lineHeight: Math.max(12, size * 0.52) }]}>
        {fallbackIconLabel(id)}
      </Text>
    </View>
  );
}

function fallbackIconLabel(id: AbilityId) {
  if (id === 'bolt') return 'B';
  if (id === 'dash') return 'D';
  if (id === 'pulse') return '+';
  if (id === 'fireball') return 'F';
  if (id === 'shield') return 'S';
  if (id === 'chain') return 'C';
  if (id === 'trap') return 'T';
  return 'U';
}

function IconCanvas({ size, children }: { size: number; children: ReactNode }) {
  return (
    <Canvas pointerEvents="none" style={{ width: size, height: size }}>
      <G transform={`scale(${size / 32})`}>
        {children}
      </G>
    </Canvas>
  );
}

function BoltIcon({ color }: IconProps) {
  return (
    <G>
      <Path d="M18 2 L7 17 H15 L12 30 L25 13 H17 Z" fill={color} />
      <Path d="M18 2 L7 17 H15" fill="none" stroke="#FFFFFF" strokeWidth={1.5} opacity={0.5} />
    </G>
  );
}

function DashIcon({ color }: IconProps) {
  return (
    <G>
      <Path d="M4 22 C12 8 20 8 28 10" fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" />
      <Path d="M22 5 L29 10 L21 15" fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={8} cy={23} r={3} fill="#FFFFFF" opacity={0.7} />
    </G>
  );
}

function PulseIcon({ color }: IconProps) {
  return (
    <G>
      <Circle cx={16} cy={16} r={5} fill={color} />
      <Circle cx={16} cy={16} r={10} fill="none" stroke={color} strokeWidth={3} opacity={0.76} />
      <Rect x={14.5} y={3} width={3} height={7} rx={1.5} fill="#FFFFFF" opacity={0.7} />
      <Rect x={14.5} y={22} width={3} height={7} rx={1.5} fill="#FFFFFF" opacity={0.7} />
    </G>
  );
}

function FireballIcon({ color }: IconProps) {
  return (
    <G>
      <Circle cx={18} cy={18} r={8} fill={color} />
      <Path d="M4 25 C9 8 18 4 27 3 C22 8 24 14 28 18 C20 17 15 21 13 29 C11 24 8 24 4 25 Z" fill={color} opacity={0.55} />
      <Circle cx={18} cy={18} r={3} fill="#FFFFFF" opacity={0.72} />
    </G>
  );
}

function ShieldIcon({ color }: IconProps) {
  return (
    <G>
      <Path d="M16 3 L27 7 V15 C27 23 21 28 16 30 C11 28 5 23 5 15 V7 Z" fill={color} />
      <Path d="M16 7 V25" fill="none" stroke="#FFFFFF" strokeWidth={2} opacity={0.55} />
    </G>
  );
}

function ChainIcon({ color }: IconProps) {
  return (
    <G>
      <Path d="M7 20 L14 13 L19 18 L26 9" fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={7} cy={20} r={4} fill={color} />
      <Circle cx={19} cy={18} r={4} fill={color} opacity={0.76} />
      <Circle cx={26} cy={9} r={4} fill="#FFFFFF" opacity={0.72} />
    </G>
  );
}

function TrapIcon({ color }: IconProps) {
  return (
    <G>
      <Circle cx={16} cy={16} r={11} fill="none" stroke={color} strokeWidth={3} />
      <Path d="M16 6 L20 16 L16 26 L12 16 Z" fill={color} />
      <Circle cx={16} cy={16} r={3} fill="#FFFFFF" opacity={0.7} />
    </G>
  );
}

function UltIcon({ color }: IconProps) {
  return (
    <G>
      <Circle cx={16} cy={16} r={12} fill="none" stroke={color} strokeWidth={3} />
      <Path d="M16 2 L19 12 L29 12 L21 18 L24 29 L16 22 L8 29 L11 18 L3 12 L13 12 Z" fill={color} />
      <Circle cx={16} cy={16} r={4} fill="#FFFFFF" opacity={0.68} />
    </G>
  );
}

const styles = StyleSheet.create({
  fallbackIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: 'rgba(6,20,26,0.82)',
  },
  fallbackIconText: {
    fontWeight: '900',
    textAlign: 'center',
  },
});
