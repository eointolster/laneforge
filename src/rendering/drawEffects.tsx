import type { ReactNode } from 'react';
import { Circle, G, Path, Text as SkiaText } from './skiaElements';

import { projectedScale, worldToScreen } from '@/game/camera';
import type { ChainArc, Effect, FloatingText, WarningIndicator } from '@/game/types';
import type { CameraState } from '@/game/types';
import { EFFECT_RENDER_PADDING, getRenderBounds, isPointInRenderBounds, isPositionedInRenderBounds } from '@/performance/renderBudget';
import { CombatEffect } from './effects/CombatEffects';

type DrawEffectsProps = {
  camera: CameraState;
  chainArcs: ChainArc[];
  effects: Effect[];
  warnings: WarningIndicator[];
  floatingText: FloatingText[];
};

export function DrawEffects({ camera, chainArcs, effects, warnings, floatingText }: DrawEffectsProps) {
  const bounds = getRenderBounds(camera, EFFECT_RENDER_PADDING);
  const scale = projectedScale(camera);
  const warningNodes: ReactNode[] = [];
  const chainNodes: ReactNode[] = [];
  const effectNodes: ReactNode[] = [];
  const textNodes: ReactNode[] = [];

  for (const warning of warnings) {
    if (!isPointInRenderBounds(warning.sourcePosition, bounds, 120) && !isPointInRenderBounds(warning.targetPosition, bounds, 120)) continue;
    warningNodes.push(<WarningEffect key={warning.id} camera={camera} warning={warning} />);
  }

  for (const arc of chainArcs) {
    if (!isPointInRenderBounds(arc.start, bounds, 70) && !isPointInRenderBounds(arc.end, bounds, 70)) continue;
    chainNodes.push(<ChainArcEffect key={arc.id} camera={camera} arc={arc} />);
  }

  for (const effect of effects) {
    if (!isPositionedInRenderBounds(effect, bounds, effect.radius)) continue;
    effectNodes.push(<CombatEffect key={effect.id} camera={camera} effect={effect} />);
  }

  for (const text of floatingText) {
    if (!isPointInRenderBounds(text.position, bounds, 36)) continue;

    const point = worldToScreen(camera, text.position);

    textNodes.push(
      <SkiaText
        key={text.id}
        x={point.x}
        y={point.y}
        fill={text.color}
        fontSize={18 * scale}
        fontWeight="900"
        textAnchor="middle"
        opacity={Math.max(0, text.ttl)}
      >
        {text.text}
      </SkiaText>,
    );
  }

  return (
    <G>
      {warningNodes}
      {chainNodes}
      {effectNodes}
      {textNodes}
    </G>
  );
}

function WarningEffect({ camera, warning }: { camera: CameraState; warning: WarningIndicator }) {
  const source = worldToScreen(camera, warning.sourcePosition);
  const target = worldToScreen(camera, warning.targetPosition);
  const scale = projectedScale(camera);
  const progress = Math.max(0, Math.min(1, warning.ttl / warning.maxTtl));
  const age = 1 - progress;
  const ringRadius = warning.radius * scale * (1.05 + age * 0.22);
  const innerRadius = ringRadius * 0.58;
  const color = warning.color || '#FFD36A';
  const linePath = `M${source.x} ${source.y} L${target.x} ${target.y}`;
  const opacity = warning.kind === 'tower' ? 0.78 : warning.kind === 'jungle' ? 0.68 : 0.58;

  return (
    <G opacity={Math.max(0.08, progress * opacity)}>
      <Path d={linePath} fill="none" stroke={color} strokeWidth={warning.kind === 'tower' ? 4.2 * scale : 3 * scale} strokeLinecap="round" opacity={0.46} />
      <Path d={linePath} fill="none" stroke="#FFFFFF" strokeWidth={1.2 * scale} strokeLinecap="round" opacity={0.32} />
      <Circle cx={target.x} cy={target.y} r={ringRadius} fill="none" stroke={color} strokeWidth={3.2 * scale} opacity={0.7} />
      <Circle cx={target.x} cy={target.y} r={innerRadius} fill="none" stroke="#FFFFFF" strokeWidth={1.4 * scale} opacity={0.38} />
      <Circle cx={target.x} cy={target.y} r={Math.max(2 * scale, ringRadius * 0.12)} fill={color} opacity={0.3 + age * 0.22} />
    </G>
  );
}

function ChainArcEffect({ camera, arc }: { camera: CameraState; arc: ChainArc }) {
  const start = worldToScreen(camera, arc.start);
  const end = worldToScreen(camera, arc.end);
  const scale = projectedScale(camera);
  const progress = Math.max(0, Math.min(1, arc.ttl / arc.maxTtl));
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 2) return null;

  const nx = -dy / length;
  const ny = dx / length;
  const segments = 7;
  const points = Array.from({ length: segments + 1 }, (_, index) => {
    const t = index / segments;
    const taper = Math.sin(t * Math.PI);
    const jitter = Math.sin(arc.start.x * 0.017 + arc.end.y * 0.011 + index * 1.83 + arc.ttl * 18) * 10 * scale * taper;
    return {
      x: start.x + dx * t + nx * jitter,
      y: start.y + dy * t + ny * jitter,
    };
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
  const color = arc.color || '#9CEEFF';

  return (
    <G opacity={progress}>
      <Path d={path} fill="none" stroke={color} strokeWidth={8 * scale} strokeLinecap="round" strokeLinejoin="round" opacity={0.26} />
      <Path d={path} fill="none" stroke={color} strokeWidth={4.2 * scale} strokeLinecap="round" strokeLinejoin="round" opacity={0.72} />
      <Path d={path} fill="none" stroke="#FFFFFF" strokeWidth={1.6 * scale} strokeLinecap="round" strokeLinejoin="round" opacity={0.58} />
      <Circle cx={start.x} cy={start.y} r={10 * scale} fill={color} opacity={0.34} />
      <Circle cx={end.x} cy={end.y} r={13 * scale} fill={color} opacity={0.44} />
      <Circle cx={end.x} cy={end.y} r={5 * scale} fill="#FFFFFF" opacity={0.72} />
    </G>
  );
}
