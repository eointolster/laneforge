import { Canvas } from '@shopify/react-native-skia';

import type { HeroDesignId } from '@/game/types';
import { Circle, Ellipse, G, Path, Rect } from '@/rendering/skiaElements';

type HeroPreviewBadgeProps = {
  color: string;
  design: HeroDesignId;
  size?: number;
};

export function HeroPreviewBadge({ color, design, size = 132 }: HeroPreviewBadgeProps) {
  const dark = shade(color, -0.46);
  const mid = shade(color, -0.16);
  const light = shade(color, 0.62);

  return (
    <Canvas pointerEvents="none" style={{ width: size, height: size }}>
      <G transform={`scale(${size / 132})`}>
        <Ellipse cx={66} cy={103} rx={46} ry={18} fill={color} opacity={0.18} />
        <Ellipse cx={66} cy={103} rx={38} ry={14} fill="none" stroke={light} strokeWidth={3} opacity={0.52} />
        <G>
          {design === 'mage' ? <MagePreview color={color} dark={dark} light={light} /> : null}
          {design === 'berserker' ? <BerserkerPreview color={color} dark={dark} light={light} /> : null}
          {design === 'ranger' ? <RangerPreview color={color} dark={dark} light={light} /> : null}
          {design === 'warlock' ? <WarlockPreview color={color} dark={dark} light={light} /> : null}
          {design === 'paladin' ? <PaladinPreview color={color} dark={dark} light={light} /> : null}
          {design === 'knight' ? <KnightPreview color={color} dark={dark} mid={mid} light={light} /> : null}
        </G>
      </G>
    </Canvas>
  );
}

function KnightPreview({ color, dark, mid, light }: { color: string; dark: string; mid: string; light: string }) {
  return (
    <G>
      <Path d="M42 99 L48 48 Q66 31 84 48 L90 99 Q66 115 42 99 Z" fill={dark} stroke={light} strokeWidth={3} />
      <Path d="M53 96 L66 50 L79 96 Q66 106 53 96 Z" fill={mid} />
      <Circle cx={66} cy={35} r={15} fill="#EAF8F5" stroke={dark} strokeWidth={3} />
      <Path d="M47 35 Q66 12 85 35 L78 45 Q66 38 54 45 Z" fill={color} stroke={dark} strokeWidth={3} />
      <Rect x={87} y={34} width={7} height={58} rx={3} fill="#EAF8F5" transform="rotate(18 90 63)" />
      <Path d="M38 62 L26 82 L44 93 L55 70 Z" fill={color} stroke={dark} strokeWidth={3} />
    </G>
  );
}

function MagePreview({ color, dark, light }: { color: string; dark: string; light: string }) {
  return (
    <G>
      <Path d="M48 105 L54 45 Q66 28 78 45 L84 105 Q66 114 48 105 Z" fill={dark} stroke={light} strokeWidth={3} />
      <Path d="M56 101 L66 48 L76 101 Z" fill={color} opacity={0.86} />
      <Circle cx={66} cy={34} r={13} fill="#EAF8F5" stroke={dark} strokeWidth={3} />
      <Path d="M50 34 Q66 12 82 34 L76 45 Q66 39 56 45 Z" fill={color} stroke={dark} strokeWidth={3} />
      <Rect x={91} y={25} width={6} height={78} rx={3} fill="#EAF8F5" />
      <Circle cx={94} cy={22} r={8} fill={light} />
      <Circle cx={34} cy={64} r={8} fill={light} opacity={0.75} />
    </G>
  );
}

function BerserkerPreview({ color, dark, light }: { color: string; dark: string; light: string }) {
  return (
    <G>
      <Rect x={43} y={43} width={46} height={58} rx={10} fill={dark} stroke={light} strokeWidth={3} />
      <Rect x={51} y={52} width={30} height={38} rx={7} fill={color} />
      <Circle cx={66} cy={32} r={15} fill="#EAF8F5" stroke={dark} strokeWidth={3} />
      <Path d="M48 29 L57 15 L66 27 L75 15 L84 29" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" />
      <Path d="M36 50 L20 82 L36 76 Z" fill={light} stroke={dark} strokeWidth={3} />
      <Path d="M96 50 L112 82 L96 76 Z" fill={light} stroke={dark} strokeWidth={3} />
    </G>
  );
}

function RangerPreview({ color, dark, light }: { color: string; dark: string; light: string }) {
  return (
    <G>
      <Path d="M47 101 L54 44 Q66 28 78 44 L85 101 Q66 112 47 101 Z" fill={dark} stroke={light} strokeWidth={3} />
      <Path d="M47 32 Q66 9 85 32 Q66 47 47 32 Z" fill={color} stroke={dark} strokeWidth={3} />
      <Circle cx={66} cy={37} r={11} fill="#EAF8F5" />
      <Path d="M89 35 Q118 65 89 98" fill="none" stroke={light} strokeWidth={5} strokeLinecap="round" />
      <Path d="M59 65 L102 61" stroke={light} strokeWidth={4} strokeLinecap="round" />
      <Path d="M102 61 L113 56 L108 68 Z" fill={light} />
    </G>
  );
}

function WarlockPreview({ color, dark, light }: { color: string; dark: string; light: string }) {
  return (
    <G>
      <Ellipse cx={66} cy={106} rx={34} ry={10} fill={color} opacity={0.2} />
      <Path d="M45 102 L54 42 Q66 25 78 42 L87 102 Q66 116 45 102 Z" fill={dark} stroke={color} strokeWidth={3} />
      <Circle cx={66} cy={31} r={13} fill="#EAF8F5" stroke={dark} strokeWidth={3} />
      <Path d="M47 30 Q66 7 85 30 L76 44 Q66 38 56 44 Z" fill={dark} stroke={color} strokeWidth={3} />
      <Path d="M48 94 Q34 110 24 100" fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" />
      <Path d="M84 94 Q98 110 108 100" fill="none" stroke={light} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={96} cy={58} r={8} fill={light} opacity={0.8} />
    </G>
  );
}

function PaladinPreview({ color, dark, light }: { color: string; dark: string; light: string }) {
  return (
    <G>
      <Ellipse cx={66} cy={15} rx={20} ry={7} fill="none" stroke="#FFD36A" strokeWidth={4} />
      <Path d="M43 99 L50 46 Q66 30 82 46 L89 99 Q66 114 43 99 Z" fill={dark} stroke="#FFD36A" strokeWidth={3} />
      <Path d="M55 96 L66 50 L77 96 Z" fill={color} />
      <Circle cx={66} cy={34} r={14} fill="#EAF8F5" stroke={dark} strokeWidth={3} />
      <Rect x={90} y={38} width={7} height={56} rx={3} fill={light} transform="rotate(-14 94 66)" />
      <Rect x={84} y={84} width={22} height={14} rx={4} fill="#FFD36A" transform="rotate(-14 94 66)" />
      <Path d="M37 60 L25 81 L44 92 L55 69 Z" fill={color} stroke={light} strokeWidth={3} />
    </G>
  );
}

function shade(value: string, amount: number) {
  const hex = value.replace('#', '');
  const color = {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return `#${toHex(color.r + (target - color.r) * t)}${toHex(color.g + (target - color.g) * t)}${toHex(color.b + (target - color.b) * t)}`;
}

function toHex(value: number) {
  return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0');
}
