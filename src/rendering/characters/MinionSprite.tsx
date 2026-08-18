import { Circle, Ellipse, G, Path, Polygon, Rect } from '../skiaElements';

import { projectedScale, worldToScreen } from '@/game/camera';
import type { CameraState, Minion } from '@/game/types';
import { getMinionVisualState } from './animationState';
import { minionPalette } from './characterPalettes';

type MinionSpriteProps = {
  camera: CameraState;
  minion: Minion;
  time: number;
};

export function MinionSprite({ camera, minion, time }: MinionSpriteProps) {
  const point = worldToScreen(camera, minion.position);
  const scale = projectedScale(camera);
  const state = getMinionVisualState(minion, time);
  const palette = minionPalette(minion.team);
  const radius = minion.radius * scale;
  const opacity = minion.dead ? Math.max(0, 1 - state.death) : 1;
  const shrink = 1 - state.death * 0.3;

  if (minion.dead && state.death >= 1) {
    return null;
  }

  const body = minion.kind === 'spark'
    ? <CasterSprite point={point} radius={radius} scale={scale} state={state} palette={palette} />
    : minion.kind === 'guard'
      ? <GuardSprite point={point} radius={radius} scale={scale} state={state} palette={palette} />
      : <MeleeSprite point={point} radius={radius} scale={scale} state={state} palette={palette} />;

  return (
    <G opacity={opacity}>
      <MinionGroundIndicator point={point} radius={radius} scale={scale} state={state} palette={palette} />
      {minion.dead ? (
        <MinionDeathBurst point={point} radius={radius} scale={scale} state={state} palette={palette} />
      ) : (
        <G transform={`translate(${point.x} ${point.y}) scale(${shrink}) translate(${-point.x} ${-point.y})`}>
          {body}
        </G>
      )}
    </G>
  );
}

function MinionGroundIndicator({ point, radius, scale, state, palette }: SpritePartProps) {
  const pulse = 1 + state.attack * 0.14 + state.cast * 0.12;
  const hit = state.hit;

  return (
    <G>
      <Ellipse cx={point.x} cy={point.y + radius * 0.36} rx={radius * 1.35 * pulse} ry={radius * 0.6 * pulse} fill={palette.glow} opacity={0.42 + state.cast * 0.16} />
      <Ellipse cx={point.x} cy={point.y + radius * 0.36} rx={radius * 1.22 * pulse} ry={radius * 0.52 * pulse} fill="none" stroke={palette.light} strokeWidth={1.8 * scale} opacity={0.68} />
      <Ellipse cx={point.x} cy={point.y + radius * 0.36} rx={radius * 0.82 * pulse} ry={radius * 0.35 * pulse} fill="none" stroke="#071013" strokeWidth={2.6 * scale} opacity={0.72} />
      {hit > 0 ? (
        <Ellipse cx={point.x} cy={point.y - radius * 0.22} rx={radius * 1.05} ry={radius * 1.15} fill="#FFFFFF" opacity={0.22 * hit} />
      ) : null}
    </G>
  );
}

function MinionDeathBurst({ point, radius, scale, state, palette }: SpritePartProps) {
  const progress = state.death;
  const fade = Math.max(0, 1 - progress);
  const burstRadius = radius * (0.85 + progress * 1.6);

  return (
    <G>
      <Ellipse cx={point.x} cy={point.y + radius * 0.34} rx={burstRadius * 1.2} ry={burstRadius * 0.52} fill={palette.glow} opacity={0.34 * fade} />
      <Ellipse cx={point.x} cy={point.y + radius * 0.34} rx={burstRadius} ry={burstRadius * 0.44} fill="none" stroke={palette.light} strokeWidth={2.4 * scale} opacity={0.58 * fade} />
      {Array.from({ length: 5 }).map((_, index) => {
        const angle = index * ((Math.PI * 2) / 5) + radius * 0.09;
        const distance = radius * (0.46 + progress * (1.16 + index * 0.08));
        return (
          <Circle
            key={`minion-death-${index}`}
            cx={point.x + Math.cos(angle) * distance}
            cy={point.y - radius * 0.25 - progress * radius * (0.92 + index * 0.1) + Math.sin(angle) * distance * 0.25}
            r={radius * (0.16 + index * 0.012)}
            fill={index % 2 === 0 ? palette.light : palette.main}
            opacity={fade}
          />
        );
      })}
    </G>
  );
}

function MeleeSprite({ point, radius, scale, state, palette }: SpritePartProps) {
  const bodyY = point.y - radius * 0.5 + state.bob - state.stepLift * radius * 0.04;
  const leftStep = state.stride * radius * 0.09;
  const rightStep = -state.stride * radius * 0.09;
  const weaponY = state.armSway * 3;

  return (
    <G>
      {state.attack > 0 ? (
        <Path
          d={`M${point.x + state.facing * radius * 0.1} ${point.y - radius * 0.92} C${point.x + state.facing * radius * 1.1} ${point.y - radius * 0.72} ${point.x + state.facing * radius * 1.05} ${point.y + radius * 0.22} ${point.x + state.facing * radius * 0.2} ${point.y + radius * 0.42}`}
          fill="none"
          stroke={palette.weapon}
          strokeWidth={3 * scale}
          strokeLinecap="round"
          opacity={0.72 * state.attack}
        />
      ) : null}
      <G transform={`translate(${point.x} ${bodyY}) scale(${state.facing} 1) rotate(${state.lean})`}>
        <Rect x={-radius * 0.26 + leftStep} y={radius * 0.24} width={radius * 0.18} height={radius * 0.54} rx={radius * 0.06} fill="#061315" />
        <Rect x={radius * 0.08 + rightStep} y={radius * 0.24} width={radius * 0.18} height={radius * 0.54} rx={radius * 0.06} fill="#061315" />
        <Circle cx={0} cy={-radius * 0.25} r={radius * 0.64} fill={palette.dark} stroke="#091517" strokeWidth={1.7 * scale} />
        <Circle cx={0} cy={-radius * 0.3} r={radius * 0.34} fill={palette.main} />
        <Circle cx={0} cy={-radius * 0.95} r={radius * 0.28} fill={palette.face} stroke={palette.dark} strokeWidth={1.5 * scale} />
        <Path d={`M${radius * 0.35} ${-radius * 0.55} L${radius * 1.06 + state.attack * radius * 0.26} ${-radius * 0.1 + weaponY}`} stroke={palette.weapon} strokeWidth={2.8 * scale} strokeLinecap="round" />
      </G>
    </G>
  );
}

function CasterSprite({ point, radius, scale, state, palette }: SpritePartProps) {
  const bodyY = point.y - radius * 0.56 + state.bob - state.stepLift * radius * 0.04;
  const leftStep = state.stride * radius * 0.08;
  const rightStep = -state.stride * radius * 0.08;
  const weaponSway = state.armSway * 4;

  return (
    <G>
      {state.cast > 0 ? (
        <Circle cx={point.x + state.facing * radius * 1.22} cy={point.y - radius * 0.82} r={radius * (0.24 + state.cast * 0.62)} fill={palette.light} opacity={0.5 * state.cast} />
      ) : null}
      <G transform={`translate(${point.x} ${bodyY}) scale(${state.facing} 1) rotate(${state.lean})`}>
        <Rect x={-radius * 0.2 + leftStep} y={radius * 0.3} width={radius * 0.15} height={radius * 0.46} rx={radius * 0.05} fill="#061315" />
        <Rect x={radius * 0.05 + rightStep} y={radius * 0.3} width={radius * 0.15} height={radius * 0.46} rx={radius * 0.05} fill="#061315" />
        <Polygon points={`0,${-radius * 1.36} ${radius * 0.46},${-radius * 0.42} ${radius * 0.28},${radius * 0.34} 0,${radius * 0.52} ${-radius * 0.28},${radius * 0.34} ${-radius * 0.46},${-radius * 0.42}`} fill={palette.main} stroke={palette.dark} strokeWidth={1.7 * scale} />
        <Circle cx={0} cy={-radius * 0.92} r={radius * 0.25} fill={palette.face} stroke={palette.dark} strokeWidth={1.4 * scale} />
        <Path d={`M${radius * 0.38} ${-radius * 1.1} L${radius * 1.08} ${radius * 0.18 + weaponSway}`} stroke={palette.weapon} strokeWidth={3.2 * scale} strokeLinecap="round" />
        <Circle cx={radius * 1.28} cy={radius * 0.18 + weaponSway * 0.4} r={radius * 0.16} fill={palette.light} />
      </G>
    </G>
  );
}

function GuardSprite({ point, radius, scale, state, palette }: SpritePartProps) {
  const bodyY = point.y - radius * 0.58 + state.bob - state.stepLift * radius * 0.03;
  const leftStep = state.stride * radius * 0.07;
  const rightStep = -state.stride * radius * 0.07;
  const weaponY = state.armSway * 3;

  return (
    <G>
      {state.attack > 0 ? (
        <Path
          d={`M${point.x + state.facing * radius * 0.2} ${point.y - radius * 0.96} C${point.x + state.facing * radius * 1.24} ${point.y - radius * 0.82} ${point.x + state.facing * radius * 1.42} ${point.y + radius * 0.18} ${point.x + state.facing * radius * 0.46} ${point.y + radius * 0.4}`}
          fill="none"
          stroke={palette.light}
          strokeWidth={4 * scale}
          strokeLinecap="round"
          opacity={0.7 * state.attack}
        />
      ) : null}
      <G transform={`translate(${point.x} ${bodyY}) scale(${state.facing} 1) rotate(${state.lean * 0.65})`}>
        <Rect x={-radius * 0.36 + leftStep} y={radius * 0.28} width={radius * 0.26} height={radius * 0.66} rx={radius * 0.08} fill="#061315" />
        <Rect x={radius * 0.1 + rightStep} y={radius * 0.28} width={radius * 0.26} height={radius * 0.66} rx={radius * 0.08} fill="#061315" />
        <Path d={`M${-radius * 0.62} ${radius * 0.42} L${-radius * 0.42} ${-radius * 0.62} Q0 ${-radius * 0.96} ${radius * 0.42} ${-radius * 0.62} L${radius * 0.62} ${radius * 0.42} Q0 ${radius * 0.68} ${-radius * 0.62} ${radius * 0.42} Z`} fill={palette.dark} stroke="#091517" strokeWidth={2.2 * scale} />
        <Path d={`M${-radius * 0.32} ${radius * 0.28} L0 ${-radius * 0.62} L${radius * 0.32} ${radius * 0.28} Q0 ${radius * 0.48} ${-radius * 0.32} ${radius * 0.28} Z`} fill={palette.main} opacity={0.84} />
        <Circle cx={0} cy={-radius * 1.02} r={radius * 0.3} fill={palette.face} stroke={palette.dark} strokeWidth={1.6 * scale} />
        <Path d={`M${-radius * 0.42} ${-radius * 1.08} Q0 ${-radius * 1.44} ${radius * 0.42} ${-radius * 1.08} L${radius * 0.24} ${-radius * 0.82} Q0 ${-radius * 0.94} ${-radius * 0.24} ${-radius * 0.82} Z`} fill={palette.main} stroke={palette.dark} strokeWidth={1.8 * scale} />
        <Path d={`M${-radius * 0.74} ${-radius * 0.34} L${-radius * 1.1} ${radius * 0.14} L${-radius * 0.66} ${radius * 0.48} L${-radius * 0.38} ${radius * 0.02} Z`} fill={palette.main} stroke={palette.light} strokeWidth={1.8 * scale} opacity={0.9} />
        <Path d={`M${radius * 0.38} ${-radius * 0.7} L${radius * 1.24 + state.attack * radius * 0.22} ${radius * 0.1 + weaponY}`} stroke={palette.weapon} strokeWidth={3.2 * scale} strokeLinecap="round" />
        <Path d={`M${radius * 1.12 + state.attack * radius * 0.22} ${radius * 0.02 + weaponY} L${radius * 1.48 + state.attack * radius * 0.24} ${-radius * 0.12 + weaponY} L${radius * 1.36 + state.attack * radius * 0.24} ${radius * 0.24 + weaponY} Z`} fill={palette.light} />
      </G>
    </G>
  );
}

type SpritePartProps = {
  point: { x: number; y: number };
  radius: number;
  scale: number;
  state: ReturnType<typeof getMinionVisualState>;
  palette: ReturnType<typeof minionPalette>;
};
