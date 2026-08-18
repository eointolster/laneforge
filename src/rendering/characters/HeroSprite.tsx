import { Circle, Ellipse, G, Line, Path, Polygon, Rect } from '../skiaElements';

import { projectedScale, worldToScreen } from '@/game/camera';
import type { CameraState, Hero } from '@/game/types';
import { getHeroVisualState } from './animationState';
import { heroPalette } from './characterPalettes';
import { UnitShadow } from './UnitShadow';

type HeroSpriteProps = {
  camera: CameraState;
  hero: Hero;
  time: number;
  isPlayer: boolean;
};

export function HeroSprite({ camera, hero, time, isPlayer }: HeroSpriteProps) {
  const point = worldToScreen(camera, hero.position);
  const scale = projectedScale(camera);
  const state = getHeroVisualState(hero, time);
  const palette = heroPalette(hero.team, isPlayer ? hero.heroColor : undefined);
  const radius = hero.radius * scale;
  const deathOpacity = hero.hp <= 0 ? Math.max(0, 1 - state.death) : 1;
  const readyGlow = isPlayer && Object.values(hero.cooldowns).some((cooldown) => cooldown <= 0)
    ? 0.2 + Math.sin(time * 3.4) * 0.05
    : 0;

  if (hero.hp <= 0 && state.death >= 1) {
    return null;
  }

  const bodyY = point.y - radius * 1.28 + state.bob - state.attack * radius * 0.12 - state.stepLift * radius * 0.04;

  return (
    <G opacity={deathOpacity} transform={`translate(${point.x} ${point.y}) scale(${1 - state.death * 0.25}) translate(${-point.x} ${-point.y})`}>
      <UnitShadow x={point.x} y={point.y} radius={radius} opacity={isPlayer ? 0.42 : 0.34} />
      <Ellipse cx={point.x} cy={point.y + radius * 0.1} rx={radius * 1.2} ry={radius * 0.55} fill={palette.glow} opacity={isPlayer ? 0.55 : 0.38} />
      <Ellipse cx={point.x} cy={point.y + radius * 0.08} rx={radius * 1.62} ry={radius * 0.74} fill="none" stroke={isPlayer ? palette.light : '#FFB096'} strokeWidth={2.4 * scale} opacity={isPlayer ? 0.82 : 0.7} />
      {isPlayer ? (
        <Polygon
          points={`${point.x},${point.y - radius * 2.72} ${point.x - radius * 0.42},${point.y - radius * 2.24} ${point.x + radius * 0.42},${point.y - radius * 2.24}`}
          fill={palette.light}
          opacity={0.86}
        />
      ) : (
        <Polygon
          points={`${point.x},${point.y - radius * 2.8} ${point.x - radius * 0.54},${point.y - radius * 2.25} ${point.x},${point.y - radius * 2.02} ${point.x + radius * 0.54},${point.y - radius * 2.25}`}
          fill="#FF5533"
          stroke="#FFD0BD"
          strokeWidth={1.4 * scale}
          opacity={0.9}
        />
      )}
      {isPlayer ? (
        <Ellipse cx={point.x} cy={point.y + radius * 0.08} rx={radius * 1.4} ry={radius * 0.65} fill="none" stroke={palette.light} strokeWidth={2 * scale} opacity={0.72} />
      ) : null}
      {readyGlow > 0 ? (
        <Ellipse cx={point.x} cy={point.y + radius * 0.08} rx={radius * 2.1} ry={radius} fill="none" stroke={palette.weapon} strokeWidth={3 * scale} opacity={readyGlow} />
      ) : null}
      {hero.weaponBoostTimer > 0 ? (
        <Ellipse cx={point.x} cy={point.y + radius * 0.08} rx={radius * 2.05} ry={radius * 0.96} fill="none" stroke="#FFD36A" strokeWidth={3 * scale} opacity={0.2 + Math.sin(time * 6.2) * 0.05} />
      ) : null}
      {hero.powerShield > 0 ? (
        <G opacity={0.42 + Math.sin(time * 5.4) * 0.05}>
          <Ellipse cx={point.x} cy={point.y - radius * 0.48} rx={radius * 1.86} ry={radius * 2.15} fill="#88EEFF" opacity={0.1} />
          <Ellipse cx={point.x} cy={point.y - radius * 0.48} rx={radius * 1.86} ry={radius * 2.15} fill="none" stroke="#D8FBFF" strokeWidth={3.2 * scale} opacity={0.72} />
          <Ellipse cx={point.x} cy={point.y - radius * 0.48} rx={radius * 1.28} ry={radius * 1.48} fill="none" stroke="#FFFFFF" strokeWidth={1.2 * scale} opacity={0.34} />
        </G>
      ) : null}
      {hero.attackSpeedBoostTimer > 0 ? (
        <Ellipse cx={point.x} cy={point.y + radius * 0.08} rx={radius * 2.18} ry={radius * 1.02} fill="none" stroke="#FFD36A" strokeWidth={3 * scale} opacity={0.24 + Math.sin(time * 10.2) * 0.06} />
      ) : null}
      {hero.bearBuffTimer > 0 ? (
        <Ellipse cx={point.x} cy={point.y + radius * 0.1} rx={radius * 2.18} ry={radius * 1.02} fill="none" stroke="#7CFFB0" strokeWidth={3 * scale} opacity={0.22 + Math.sin(time * 5.4) * 0.04} />
      ) : null}
      {hero.dragonBuffTimer > 0 ? (
        <Ellipse cx={point.x} cy={point.y + radius * 0.1} rx={radius * 2.36} ry={radius * 1.12} fill="none" stroke="#FFB15F" strokeWidth={3.4 * scale} opacity={0.26 + Math.sin(time * 6.8) * 0.05} />
      ) : null}
      <HeroCastFlare point={point} radius={radius} scale={scale} state={state} palette={palette} ability={hero.lastCastAbility} time={time} />
      {state.attack > 0 ? (
        <Path
          d={`M${point.x + state.facing * radius * 0.25} ${point.y - radius * 1.35} C${point.x + state.facing * radius * 2.2} ${point.y - radius * 1.1} ${point.x + state.facing * radius * 2.1} ${point.y + radius * 0.65} ${point.x + state.facing * radius * 0.56} ${point.y + radius * 0.8}`}
          fill="none"
          stroke={palette.light}
          strokeWidth={5 * scale}
          strokeLinecap="round"
          opacity={0.65 * state.attack}
        />
      ) : null}

      {hero.team === 'blue' ? (
        <PlayerHeroBody point={point} bodyY={bodyY} radius={radius} scale={scale} state={state} palette={palette} design={hero.heroDesign ?? 'knight'} />
      ) : (
        <CinderWardenBody point={point} bodyY={bodyY} radius={radius} scale={scale} state={state} palette={palette} />
      )}

      {state.hit > 0 ? (
        <Ellipse cx={point.x} cy={point.y - radius * 0.55} rx={radius * 1.08} ry={radius * 1.6} fill="#FFFFFF" opacity={0.32 * state.hit} />
      ) : null}
    </G>
  );
}

type HeroBodyProps = {
  point: { x: number; y: number };
  bodyY: number;
  radius: number;
  scale: number;
  state: ReturnType<typeof getHeroVisualState>;
  palette: ReturnType<typeof heroPalette>;
};

function HeroCastFlare({
  point,
  radius,
  scale,
  state,
  palette,
  ability,
  time,
}: {
  point: { x: number; y: number };
  radius: number;
  scale: number;
  state: ReturnType<typeof getHeroVisualState>;
  palette: ReturnType<typeof heroPalette>;
  ability: Hero['lastCastAbility'];
  time: number;
}) {
  const flash = state.cast;
  if (!ability || flash <= 0) return null;

  const facing = state.facing;
  const hand = {
    x: point.x + facing * radius * 0.94,
    y: point.y - radius * 1.22,
  };
  const front = {
    x: point.x + facing * radius * 1.34,
    y: point.y - radius * 1.02,
  };
  const color = abilityCastColor(ability, palette);

  if (ability === 'bolt') {
    const branches = [-2, -1, 0, 1, 2];
    return (
      <G opacity={Math.min(0.92, flash + 0.08)}>
        <Circle cx={hand.x} cy={hand.y} r={radius * (0.28 + flash * 0.18)} fill="#FFFFFF" opacity={0.7 * flash} />
        {branches.map((branch) => {
          const endX = hand.x + facing * radius * (0.52 + Math.abs(branch) * 0.1);
          const endY = hand.y + branch * radius * 0.2;
          return (
            <Path
              key={`hero-bolt-${branch}`}
              d={`M${hand.x} ${hand.y} L${hand.x + facing * radius * 0.22} ${hand.y + branch * radius * 0.08} L${endX} ${endY}`}
              fill="none"
              stroke={branch === 0 ? '#FFFFFF' : color}
              strokeWidth={(branch === 0 ? 4.2 : 2.8) * scale}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.76 * flash}
            />
          );
        })}
      </G>
    );
  }

  if (ability === 'fireball') {
    const flameNose = {
      x: front.x + facing * radius * (0.56 + flash * 0.16),
      y: front.y - radius * 0.02,
    };
    const flameBack = {
      x: front.x - facing * radius * (0.58 + flash * 0.08),
      y: front.y + radius * 0.06,
    };

    return (
      <G opacity={Math.min(0.94, flash + 0.06)}>
        {[0, 1, 2].map((index) => (
          <Circle
            key={`hero-fire-smoke-${index}`}
            cx={front.x - facing * radius * (0.62 + index * 0.18)}
            cy={front.y + (index - 1) * radius * 0.12}
            r={radius * (0.18 + index * 0.04)}
            fill="#4B3428"
            opacity={0.12 * flash}
          />
        ))}
        <Path
          d={`M${flameNose.x} ${flameNose.y} C${front.x + facing * radius * 0.22} ${front.y - radius * 0.54} ${flameBack.x} ${flameBack.y - radius * 0.32} ${front.x - facing * radius * 0.98} ${front.y - radius * 0.04} C${flameBack.x} ${flameBack.y + radius * 0.36} ${front.x + facing * radius * 0.2} ${front.y + radius * 0.48} ${flameNose.x} ${flameNose.y} Z`}
          fill="#D94A22"
          opacity={0.76 * flash}
        />
        <Path
          d={`M${front.x + facing * radius * 0.38} ${front.y} C${front.x + facing * radius * 0.1} ${front.y - radius * 0.28} ${front.x - facing * radius * 0.48} ${front.y - radius * 0.2} ${front.x - facing * radius * 0.68} ${front.y} C${front.x - facing * radius * 0.34} ${front.y + radius * 0.22} ${front.x + facing * radius * 0.04} ${front.y + radius * 0.22} ${front.x + facing * radius * 0.38} ${front.y} Z`}
          fill={color}
          opacity={0.9 * flash}
        />
        <Circle cx={front.x + facing * radius * 0.06} cy={front.y - radius * 0.02} r={radius * 0.13} fill="#FFF7D6" opacity={0.84 * flash} />
        {[0, 1, 2, 3, 4].map((index) => {
          const angle = time * 5 + index * ((Math.PI * 2) / 5);
          const orbit = radius * (0.38 + (1 - flash) * 0.24);
          return (
            <Circle
              key={`hero-fire-${index}`}
              cx={front.x + Math.cos(angle) * orbit}
              cy={front.y + Math.sin(angle) * orbit * 0.62}
              r={radius * (0.07 + (index % 2) * 0.035)}
              fill={index % 2 === 0 ? '#FFB15F' : '#FFD36A'}
              opacity={0.48 * flash}
            />
          );
        })}
      </G>
    );
  }

  if (ability === 'pulse') {
    return (
      <G opacity={Math.min(0.9, flash + 0.1)}>
        <Ellipse cx={point.x} cy={point.y + radius * 0.04} rx={radius * (1.6 + flash * 0.72)} ry={radius * (0.74 + flash * 0.3)} fill="#67F58F" opacity={0.16 * flash} />
        <Ellipse cx={point.x} cy={point.y - radius * 0.18} rx={radius * (0.9 + flash * 0.26)} ry={radius * (0.46 + flash * 0.14)} fill="none" stroke="#D7FFE4" strokeWidth={3 * scale} opacity={0.56 * flash} />
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const angle = time * 2.7 + index * ((Math.PI * 2) / 6);
          return (
            <Circle
              key={`hero-pulse-${index}`}
              cx={point.x + Math.cos(angle) * radius * 1.15}
              cy={point.y - radius * 0.35 + Math.sin(angle) * radius * 0.52}
              r={radius * 0.07}
              fill="#D7FFE4"
              opacity={0.62 * flash}
            />
          );
        })}
      </G>
    );
  }

  if (ability === 'shield') {
    return (
      <G opacity={Math.min(0.92, flash + 0.08)}>
        <Ellipse cx={point.x} cy={point.y - radius * 0.34} rx={radius * (1.36 + flash * 0.26)} ry={radius * (1.72 + flash * 0.28)} fill={color} opacity={0.11 * flash} />
        <Ellipse cx={point.x} cy={point.y - radius * 0.34} rx={radius * (1.1 + flash * 0.2)} ry={radius * (1.46 + flash * 0.22)} fill="none" stroke="#D8FBFF" strokeWidth={4 * scale} opacity={0.5 * flash} />
        {[-1, 1].map((side) => (
          <Polygon
            key={`hero-shield-${side}`}
            points={`${point.x + side * radius * 0.78},${point.y - radius * 1.12} ${point.x + side * radius * 1.02},${point.y - radius * 0.38} ${point.x + side * radius * 0.72},${point.y + radius * 0.18} ${point.x + side * radius * 0.48},${point.y - radius * 0.42}`}
            fill={color}
            opacity={0.32 * flash}
          />
        ))}
      </G>
    );
  }

  if (ability === 'chain') {
    return (
      <G opacity={Math.min(0.94, flash + 0.06)}>
        <Circle cx={hand.x} cy={hand.y} r={radius * 0.2} fill="#FFFFFF" opacity={0.72 * flash} />
        {[-1, 0, 1].map((branch) => (
          <Path
            key={`hero-chain-${branch}`}
            d={`M${hand.x} ${hand.y} L${hand.x + facing * radius * 0.22} ${hand.y + branch * radius * 0.16} L${hand.x + facing * radius * 0.54} ${hand.y - branch * radius * 0.08} L${hand.x + facing * radius * 0.86} ${hand.y + branch * radius * 0.2}`}
            fill="none"
            stroke={branch === 0 ? '#FFFFFF' : color}
            strokeWidth={(branch === 0 ? 4 : 2.6) * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.75 * flash}
          />
        ))}
      </G>
    );
  }

  if (ability === 'trap') {
    const rune = Array.from({ length: 6 }, (_, index) => {
      const angle = index * ((Math.PI * 2) / 6);
      return `${front.x + Math.cos(angle) * radius * 0.72},${point.y + radius * 0.14 + Math.sin(angle) * radius * 0.36}`;
    }).join(' ');

    return (
      <G opacity={Math.min(0.9, flash + 0.08)}>
        <Polygon points={rune} fill="none" stroke={color} strokeWidth={4 * scale} opacity={0.66 * flash} />
        <Ellipse cx={front.x} cy={point.y + radius * 0.14} rx={radius * 0.92} ry={radius * 0.46} fill={color} opacity={0.1 * flash} />
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const angle = index * ((Math.PI * 2) / 6) + time * 0.8;
          return (
            <Line
              key={`hero-trap-${index}`}
              x1={front.x + Math.cos(angle) * radius * 0.35}
              y1={point.y + radius * 0.14 + Math.sin(angle) * radius * 0.18}
              x2={front.x + Math.cos(angle) * radius * 0.66}
              y2={point.y + radius * 0.14 + Math.sin(angle) * radius * 0.34}
              stroke="#FFD36A"
              strokeWidth={2.4 * scale}
              strokeLinecap="round"
              opacity={0.46 * flash}
            />
          );
        })}
      </G>
    );
  }

  if (ability === 'dash') {
    return (
      <G opacity={Math.min(0.88, flash + 0.08)}>
        <Path
          d={`M${point.x - facing * radius * 1.4} ${point.y + radius * 0.42} C${point.x - facing * radius * 0.42} ${point.y - radius * 0.42} ${point.x + facing * radius * 0.72} ${point.y - radius * 0.22} ${point.x + facing * radius * 1.7} ${point.y + radius * 0.22}`}
          fill="none"
          stroke={color}
          strokeWidth={6 * scale}
          strokeLinecap="round"
          opacity={0.58 * flash}
        />
        <Line x1={point.x - facing * radius * 0.78} y1={point.y + radius * 0.64} x2={point.x + facing * radius * 1.12} y2={point.y - radius * 0.18} stroke="#FFFFFF" strokeWidth={2.4 * scale} strokeLinecap="round" opacity={0.34 * flash} />
      </G>
    );
  }

  if (ability === 'ult') {
    return (
      <G opacity={Math.min(0.94, flash + 0.06)}>
        <Ellipse cx={point.x} cy={point.y - radius * 0.2} rx={radius * (1.8 + flash * 0.65)} ry={radius * (0.98 + flash * 0.34)} fill="#8B5CF6" opacity={0.18 * flash} />
        <Ellipse cx={point.x} cy={point.y - radius * 0.2} rx={radius * (1.06 + flash * 0.28)} ry={radius * (0.58 + flash * 0.16)} fill="none" stroke="#E9D5FF" strokeWidth={4 * scale} opacity={0.54 * flash} />
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const angle = time * 3 + index * ((Math.PI * 2) / 6);
          const x = point.x + Math.cos(angle) * radius * 1.34;
          return (
            <Line
              key={`hero-ult-${index}`}
              x1={x}
              y1={point.y - radius * (1.62 + (index % 2) * 0.18)}
              x2={x + Math.sin(angle) * radius * 0.16}
              y2={point.y - radius * 0.62}
              stroke={index % 2 === 0 ? '#C7A5FF' : '#FFD36A'}
              strokeWidth={3 * scale}
              strokeLinecap="round"
              opacity={0.48 * flash}
            />
          );
        })}
      </G>
    );
  }

  return (
    <Ellipse cx={point.x} cy={point.y + radius * 0.08} rx={radius * (1.8 + flash * 0.8)} ry={radius * (0.8 + flash * 0.32)} fill="none" stroke={palette.light} strokeWidth={3 * scale} opacity={0.55 * flash} />
  );
}

function abilityCastColor(ability: Hero['lastCastAbility'], palette: ReturnType<typeof heroPalette>) {
  if (ability === 'bolt') return '#9CEEFF';
  if (ability === 'fireball') return '#FFB15F';
  if (ability === 'pulse') return '#67F58F';
  if (ability === 'shield') return '#88EEFF';
  if (ability === 'chain') return '#9CEEFF';
  if (ability === 'trap') return '#C7A5FF';
  if (ability === 'ult') return '#FFD36A';
  if (ability === 'dash') return palette.light;
  return palette.light;
}

function PlayerHeroBody(props: HeroBodyProps & { design: Hero['heroDesign'] }) {
  if (props.design === 'mage') return <MageBody {...props} />;
  if (props.design === 'berserker') return <BerserkerBody {...props} />;
  if (props.design === 'ranger') return <RangerBody {...props} />;
  if (props.design === 'warlock') return <WarlockBody {...props} />;
  if (props.design === 'paladin') return <PaladinBody {...props} />;
  return <ArcKnightBody {...props} />;
}

function ArcKnightBody({ point, bodyY, radius, scale, state, palette }: HeroBodyProps) {
  const attackReach = radius * (1.45 + state.attack * 0.95 + state.cast * 0.25);
  const squashX = 1 + state.attack * 0.08;
  const squashY = 1 - state.attack * 0.05;
  const leftLift = Math.max(0, state.stride) * radius * 0.14;
  const rightLift = Math.max(0, -state.stride) * radius * 0.14;
  const leftStep = state.stride * radius * 0.1;
  const rightStep = -state.stride * radius * 0.1;
  const legSwing = state.stride * 8;
  const armSway = state.armSway * 5;
  const swordRotation = 16 + armSway + state.attack * 34;

  return (
    <G transform={`translate(${point.x} ${bodyY}) scale(${state.facing * squashX} ${squashY}) rotate(${state.lean})`}>
      <Path d={`M${-radius * 0.74} ${-radius * 0.72} Q0 ${-radius * 1.04} ${radius * 0.74} ${-radius * 0.72} L${radius * 0.58} ${radius * 1.08} Q0 ${radius * 1.38} ${-radius * 0.58} ${radius * 1.08} Z`} fill="#041B23" stroke={palette.light} strokeWidth={1.5 * scale} opacity={0.88} />
      <Path d={`M${-radius * 0.38} ${-radius * 0.48} Q0 ${-radius * 0.72} ${radius * 0.38} ${-radius * 0.48} L${radius * 0.28} ${radius * 0.88} Q0 ${radius * 1.08} ${-radius * 0.28} ${radius * 0.88} Z`} fill={palette.main} opacity={0.22} />
      <Rect
        x={-radius * 0.34 + leftStep}
        y={radius * 0.36 - leftLift}
        width={radius * 0.28}
        height={radius * 0.86}
        rx={radius * 0.1}
        fill="#082F3A"
        stroke="#071216"
        strokeWidth={2 * scale}
        transform={`rotate(${-legSwing} ${-radius * 0.2} ${radius * 0.78})`}
      />
      <Rect
        x={radius * 0.08 + rightStep}
        y={radius * 0.34 - rightLift}
        width={radius * 0.28}
        height={radius * 0.9}
        rx={radius * 0.1}
        fill="#082F3A"
        stroke="#071216"
        strokeWidth={2 * scale}
        transform={`rotate(${legSwing} ${radius * 0.22} ${radius * 0.78})`}
      />
      <Rect x={-radius * 0.5 + leftStep} y={radius * 1.08 - leftLift} width={radius * 0.52} height={radius * 0.22} rx={radius * 0.08} fill={palette.dark} />
      <Rect x={radius * 0.02 + rightStep} y={radius * 1.1 - rightLift} width={radius * 0.54} height={radius * 0.22} rx={radius * 0.08} fill={palette.dark} />
      <Line x1={-radius * 0.42 + leftStep} y1={radius * 1.16 - leftLift} x2={-radius * 0.08 + leftStep} y2={radius * 1.16 - leftLift} stroke={palette.light} strokeWidth={1.8 * scale} strokeLinecap="round" opacity={0.65} />
      <Line x1={radius * 0.1 + rightStep} y1={radius * 1.18 - rightLift} x2={radius * 0.46 + rightStep} y2={radius * 1.18 - rightLift} stroke={palette.light} strokeWidth={1.8 * scale} strokeLinecap="round" opacity={0.65} />
      <Path d={`M${-radius * 0.68} ${radius * 0.32} L${-radius * 0.42} ${-radius * 0.9} Q0 ${-radius * 1.26} ${radius * 0.42} ${-radius * 0.9} L${radius * 0.68} ${radius * 0.32} Q0 ${radius * 0.72} ${-radius * 0.68} ${radius * 0.32} Z`} fill={palette.dark} stroke={palette.light} strokeWidth={4 * scale} />
      <Path d={`M${-radius * 0.42} ${radius * 0.18} L0 ${-radius * 0.86} L${radius * 0.42} ${radius * 0.18} Q0 ${radius * 0.48} ${-radius * 0.42} ${radius * 0.18} Z`} fill={palette.mid} />
      <Ellipse cx={-radius * 0.55} cy={-radius * 0.52} rx={radius * 0.32} ry={radius * 0.18} fill={palette.main} stroke={palette.dark} strokeWidth={2 * scale} />
      <Ellipse cx={radius * 0.55} cy={-radius * 0.52} rx={radius * 0.32} ry={radius * 0.18} fill={palette.main} stroke={palette.dark} strokeWidth={2 * scale} />
      <Path d={`M0 ${-radius * 0.72} L${radius * 0.25} ${-radius * 0.12} L0 ${radius * 0.26} L${-radius * 0.25} ${-radius * 0.12} Z`} fill={palette.light} opacity={0.72} />
      <Line x1={0} y1={-radius * 0.64} x2={0} y2={radius * 0.2} stroke="#EAF8F5" strokeWidth={1.8 * scale} strokeLinecap="round" opacity={0.72} />
      <Path d={`M${-radius * 0.94} ${-radius * 0.42 + armSway * 0.3} Q${-radius * 0.52} ${-radius * 0.82 + armSway} ${-radius * 0.12} ${-radius * 0.36}`} fill="none" stroke={palette.trim} strokeWidth={6 * scale} strokeLinecap="round" />
      <Path d={`M${radius * 0.12} ${-radius * 0.36} Q${radius * 0.58} ${-radius * 0.88 - armSway} ${radius * 1.0} ${-radius * 0.4 + armSway * 0.35}`} fill="none" stroke={palette.trim} strokeWidth={6 * scale} strokeLinecap="round" />
      <Path d={`M${-radius * 0.98} ${-radius * 0.44} L${-radius * 1.22} ${radius * 0.04} L${-radius * 0.82} ${radius * 0.28}`} fill={palette.main} stroke={palette.dark} strokeWidth={2.2 * scale} />
      <Rect x={radius * 0.44} y={-radius * 0.5} width={radius * 0.5} height={radius * 0.12} rx={radius * 0.05} fill={palette.dark} transform={`rotate(${swordRotation} ${radius * 0.66} ${-radius * 0.28})`} />
      <Rect x={radius * 0.58} y={-radius * 1.05} width={radius * 0.18} height={attackReach} rx={radius * 0.08} fill={palette.weapon} transform={`rotate(${swordRotation} ${radius * 0.66} ${-radius * 0.28})`} />
      <Line x1={radius * 0.67} y1={-radius * 0.98} x2={radius * 0.67} y2={-radius * 0.04 + attackReach - radius * 1.05} stroke="#FFFFFF" strokeWidth={1.4 * scale} strokeLinecap="round" opacity={0.62} transform={`rotate(${swordRotation} ${radius * 0.66} ${-radius * 0.28})`} />
      <Line x1={radius * 0.66} y1={-radius * 1.04} x2={radius * 0.66} y2={-radius * 1.34} stroke={palette.light} strokeWidth={4 * scale} strokeLinecap="round" opacity={0.75 + state.cast * 0.2} />
      <Circle cx={0} cy={-radius * 1.22} r={radius * 0.5} fill={palette.face} stroke={palette.dark} strokeWidth={3 * scale} />
      <Path d={`M${-radius * 0.68} ${-radius * 1.24} Q0 ${-radius * 1.94} ${radius * 0.68} ${-radius * 1.24} L${radius * 0.42} ${-radius * 0.96} Q0 ${-radius * 1.18} ${-radius * 0.42} ${-radius * 0.96} Z`} fill={palette.main} stroke={palette.dark} strokeWidth={3 * scale} />
      <Path d={`M${-radius * 0.08} ${-radius * 1.72} Q0 ${-radius * 2.12} ${radius * 0.18} ${-radius * 1.76}`} fill="none" stroke={palette.light} strokeWidth={4 * scale} strokeLinecap="round" opacity={0.86} />
      <Path d={`M${-radius * 0.2} ${-radius * 1.25} H${radius * 0.42}`} stroke={palette.dark} strokeWidth={3 * scale} strokeLinecap="round" />
      <Circle cx={radius * 0.18} cy={-radius * 1.24} r={radius * 0.05} fill={palette.light} opacity={0.88} />
    </G>
  );
}

function MageBody({ point, bodyY, radius, scale, state, palette }: HeroBodyProps) {
  const sway = state.armSway * 4;
  const staffReach = radius * (1.9 + state.cast * 0.35);

  return (
    <G transform={`translate(${point.x} ${bodyY - radius * 0.08}) scale(${state.facing} 1) rotate(${state.lean * 0.6})`}>
      <Path d={`M${-radius * 0.48} ${radius * 0.98} L${-radius * 0.28} ${-radius * 0.72} Q0 ${-radius * 1.16} ${radius * 0.28} ${-radius * 0.72} L${radius * 0.48} ${radius * 0.98} Q0 ${radius * 1.18} ${-radius * 0.48} ${radius * 0.98} Z`} fill={palette.dark} stroke={palette.light} strokeWidth={3 * scale} />
      <Path d={`M${-radius * 0.26} ${radius * 0.72} L0 ${-radius * 0.78} L${radius * 0.26} ${radius * 0.72} Z`} fill={palette.main} opacity={0.86} />
      <Circle cx={0} cy={-radius * 1.18} r={radius * 0.42} fill={palette.face} stroke={palette.dark} strokeWidth={2.5 * scale} />
      <Path d={`M${-radius * 0.44} ${-radius * 1.22} Q0 ${-radius * 1.78} ${radius * 0.44} ${-radius * 1.22} L${radius * 0.22} ${-radius * 0.9} Q0 ${-radius * 1.08} ${-radius * 0.22} ${-radius * 0.9} Z`} fill={palette.main} stroke={palette.dark} strokeWidth={2.5 * scale} />
      <Line x1={radius * 0.78} y1={radius * 0.8} x2={radius * 0.78} y2={-staffReach} stroke={palette.weapon} strokeWidth={5 * scale} strokeLinecap="round" transform={`rotate(${8 + sway} ${radius * 0.78} ${-radius * 0.4})`} />
      <Circle cx={radius * 0.78} cy={-staffReach} r={radius * (0.22 + state.cast * 0.12)} fill={palette.light} opacity={0.9} />
      <Circle cx={-radius * 0.92} cy={-radius * 0.32 + Math.sin(state.cast * Math.PI) * radius * 0.16} r={radius * 0.18} fill={palette.light} opacity={0.76} />
      <Ellipse cx={0} cy={radius * 0.38} rx={radius * 0.88} ry={radius * 0.34} fill={palette.glow} opacity={0.24 + state.cast * 0.18} />
    </G>
  );
}

function BerserkerBody({ point, bodyY, radius, scale, state, palette }: HeroBodyProps) {
  const swing = state.attack * 32 + state.armSway * 4;
  const squash = 1 + state.attack * 0.12;

  return (
    <G transform={`translate(${point.x} ${bodyY + radius * 0.04}) scale(${state.facing * squash} ${1 - state.attack * 0.04}) rotate(${state.lean})`}>
      <Rect x={-radius * 0.62} y={-radius * 0.86} width={radius * 1.24} height={radius * 1.55} rx={radius * 0.18} fill={palette.dark} stroke={palette.light} strokeWidth={3 * scale} />
      <Rect x={-radius * 0.42} y={-radius * 0.58} width={radius * 0.84} height={radius * 0.94} rx={radius * 0.12} fill={palette.main} opacity={0.86} />
      <Circle cx={0} cy={-radius * 1.26} r={radius * 0.46} fill={palette.face} stroke={palette.dark} strokeWidth={2.5 * scale} />
      <Path d={`M${-radius * 0.56} ${-radius * 1.36} L${-radius * 0.18} ${-radius * 1.76} L0 ${-radius * 1.42} L${radius * 0.18} ${-radius * 1.76} L${radius * 0.56} ${-radius * 1.36}`} fill="none" stroke={palette.main} strokeWidth={5 * scale} strokeLinecap="round" />
      {[-1, 1].map((side) => (
        <G key={side} transform={`rotate(${side * (20 + swing)} ${side * radius * 0.66} ${-radius * 0.2})`}>
          <Line x1={side * radius * 0.5} y1={-radius * 0.42} x2={side * radius * 1.18} y2={radius * 0.4} stroke={palette.trim} strokeWidth={5 * scale} strokeLinecap="round" />
          <Path d={`M${side * radius * 1.08} ${radius * 0.32} L${side * radius * 1.58} ${radius * 0.08} L${side * radius * 1.44} ${radius * 0.7} Z`} fill={palette.weapon} />
        </G>
      ))}
    </G>
  );
}

function RangerBody({ point, bodyY, radius, scale, state, palette }: HeroBodyProps) {
  const draw = state.attack * radius * 0.54;
  const sway = state.armSway * 4;

  return (
    <G transform={`translate(${point.x} ${bodyY}) scale(${state.facing} 1) rotate(${state.lean * 0.7})`}>
      <Path d={`M${-radius * 0.55} ${radius * 0.72} L${-radius * 0.32} ${-radius * 0.88} Q0 ${-radius * 1.18} ${radius * 0.32} ${-radius * 0.88} L${radius * 0.55} ${radius * 0.72} Q0 ${radius * 1.02} ${-radius * 0.55} ${radius * 0.72} Z`} fill={palette.dark} stroke={palette.light} strokeWidth={3 * scale} />
      <Path d={`M${-radius * 0.6} ${-radius * 1.12} Q0 ${-radius * 1.82} ${radius * 0.6} ${-radius * 1.12} Q0 ${-radius * 0.9} ${-radius * 0.6} ${-radius * 1.12} Z`} fill={palette.main} stroke={palette.dark} strokeWidth={2.5 * scale} />
      <Circle cx={0} cy={-radius * 1.18} r={radius * 0.36} fill={palette.face} opacity={0.9} />
      <Path d={`M${radius * 0.66} ${-radius * 1.02} Q${radius * 1.54} ${-radius * 0.24 + sway} ${radius * 0.66} ${radius * 0.72}`} fill="none" stroke={palette.weapon} strokeWidth={5 * scale} strokeLinecap="round" />
      <Line x1={radius * 0.66} y1={-radius * 1.02} x2={radius * 0.66} y2={radius * 0.72} stroke={palette.light} strokeWidth={1.8 * scale} opacity={0.7} />
      <Line x1={radius * 0.1 - draw} y1={-radius * 0.34} x2={radius * 1.06} y2={-radius * 0.18} stroke={palette.light} strokeWidth={3 * scale} strokeLinecap="round" />
      <Path d={`M${radius * 1.06} ${-radius * 0.18} L${radius * 1.38} ${-radius * 0.3} L${radius * 1.2} ${-radius * 0.08} Z`} fill={palette.light} />
    </G>
  );
}

function WarlockBody({ point, bodyY, radius, scale, state, palette }: HeroBodyProps) {
  const float = Math.sin(state.cast * Math.PI) * radius * 0.12 - radius * 0.12;

  return (
    <G transform={`translate(${point.x} ${bodyY + float}) scale(${state.facing} 1) rotate(${state.lean * 0.45})`}>
      <Ellipse cx={0} cy={radius * 0.72} rx={radius * 1.05} ry={radius * 0.38} fill={palette.glow} opacity={0.28 + state.cast * 0.18} />
      <Path d={`M${-radius * 0.62} ${radius * 0.94} L${-radius * 0.34} ${-radius * 0.86} Q0 ${-radius * 1.22} ${radius * 0.34} ${-radius * 0.86} L${radius * 0.62} ${radius * 0.94} Q0 ${radius * 1.24} ${-radius * 0.62} ${radius * 0.94} Z`} fill={palette.dark} stroke={palette.light} strokeWidth={3 * scale} />
      <Circle cx={0} cy={-radius * 1.22} r={radius * 0.4} fill={palette.face} stroke={palette.dark} strokeWidth={2.5 * scale} />
      <Path d={`M${-radius * 0.64} ${-radius * 1.18} Q0 ${-radius * 1.88} ${radius * 0.64} ${-radius * 1.18} L${radius * 0.34} ${-radius * 0.92} Q0 ${-radius * 1.12} ${-radius * 0.34} ${-radius * 0.92} Z`} fill={palette.dark} stroke={palette.main} strokeWidth={2.5 * scale} />
      {[-2, -1, 0, 1, 2].map((index) => (
        <Path key={index} d={`M${index * radius * 0.22} ${radius * 0.5} Q${index * radius * 0.44} ${radius * 0.94 + Math.sin(index + state.cast) * radius * 0.1} ${index * radius * 0.68} ${radius * 1.16}`} fill="none" stroke={index % 2 === 0 ? palette.main : palette.light} strokeWidth={2.4 * scale} strokeLinecap="round" opacity={0.72} />
      ))}
      <Circle cx={radius * 0.88} cy={-radius * 0.42} r={radius * (0.18 + state.cast * 0.08)} fill={palette.light} opacity={0.8} />
    </G>
  );
}

function PaladinBody({ point, bodyY, radius, scale, state, palette }: HeroBodyProps) {
  const swing = state.attack * 34 + state.armSway * 3;

  return (
    <G transform={`translate(${point.x} ${bodyY}) scale(${state.facing} 1) rotate(${state.lean * 0.7})`}>
      <Ellipse cx={0} cy={-radius * 1.72} rx={radius * 0.62} ry={radius * 0.2} fill="none" stroke="#FFD36A" strokeWidth={4 * scale} opacity={0.82} />
      <Path d={`M${-radius * 0.62} ${radius * 0.42} L${-radius * 0.46} ${-radius * 0.9} Q0 ${-radius * 1.26} ${radius * 0.46} ${-radius * 0.9} L${radius * 0.62} ${radius * 0.42} Q0 ${radius * 0.82} ${-radius * 0.62} ${radius * 0.42} Z`} fill={palette.dark} stroke="#FFD36A" strokeWidth={3 * scale} />
      <Path d={`M${-radius * 0.3} ${radius * 0.22} L0 ${-radius * 0.82} L${radius * 0.3} ${radius * 0.22} Q0 ${radius * 0.44} ${-radius * 0.3} ${radius * 0.22} Z`} fill={palette.main} />
      <Circle cx={0} cy={-radius * 1.24} r={radius * 0.45} fill={palette.face} stroke={palette.dark} strokeWidth={2.5 * scale} />
      <Line x1={radius * 0.62} y1={-radius * 0.72} x2={radius * 1.0} y2={radius * 0.82} stroke={palette.weapon} strokeWidth={6 * scale} strokeLinecap="round" transform={`rotate(${14 + swing} ${radius * 0.7} ${-radius * 0.1})`} />
      <Rect x={radius * 0.78} y={radius * 0.58} width={radius * 0.46} height={radius * 0.34} rx={radius * 0.08} fill="#FFD36A" transform={`rotate(${14 + swing} ${radius * 0.7} ${-radius * 0.1})`} />
      <Path d={`M${-radius * 0.82} ${-radius * 0.3} L${-radius * 1.14} ${radius * 0.12} L${-radius * 0.68} ${radius * 0.34} Z`} fill={palette.main} stroke={palette.light} strokeWidth={2 * scale} />
    </G>
  );
}

function CinderWardenBody({ point, bodyY, radius, scale, state, palette }: HeroBodyProps) {
  const clawReach = radius * (1.0 + state.attack * 0.72);
  const squashX = 1 + state.attack * 0.1;
  const leftLift = Math.max(0, state.stride) * radius * 0.12;
  const rightLift = Math.max(0, -state.stride) * radius * 0.12;
  const leftStep = state.stride * radius * 0.09;
  const rightStep = -state.stride * radius * 0.09;
  const legSwing = state.stride * 7;
  const armSway = state.armSway * 5;

  return (
    <G transform={`translate(${point.x} ${bodyY}) scale(${state.facing * squashX} ${1 - state.attack * 0.04}) rotate(${state.lean})`}>
      <Ellipse cx={0} cy={radius * 0.82} rx={radius * 1.14} ry={radius * 0.36} fill="#170706" opacity={0.76} />
      <Path d={`M${-radius * 0.72} ${-radius * 0.74} Q0 ${-radius * 1.08} ${radius * 0.72} ${-radius * 0.74} L${radius * 0.64} ${radius * 0.96} Q0 ${radius * 1.32} ${-radius * 0.64} ${radius * 0.96} Z`} fill="#1A0807" stroke={palette.main} strokeWidth={1.4 * scale} opacity={0.78} />
      <Rect
        x={-radius * 0.44 + leftStep}
        y={radius * 0.34 - leftLift}
        width={radius * 0.3}
        height={radius * 0.9}
        rx={radius * 0.12}
        fill="#2B1110"
        stroke="#090606"
        strokeWidth={2 * scale}
        transform={`rotate(${-legSwing} ${-radius * 0.28} ${radius * 0.82})`}
      />
      <Rect
        x={radius * 0.14 + rightStep}
        y={radius * 0.34 - rightLift}
        width={radius * 0.3}
        height={radius * 0.9}
        rx={radius * 0.12}
        fill="#2B1110"
        stroke="#090606"
        strokeWidth={2 * scale}
        transform={`rotate(${legSwing} ${radius * 0.28} ${radius * 0.82})`}
      />
      <Rect x={-radius * 0.52 + leftStep} y={radius * 1.1 - leftLift} width={radius * 0.46} height={radius * 0.2} rx={radius * 0.07} fill={palette.dark} />
      <Rect x={radius * 0.08 + rightStep} y={radius * 1.1 - rightLift} width={radius * 0.46} height={radius * 0.2} rx={radius * 0.07} fill={palette.dark} />
      <Path d={`M${-radius * 0.82} ${radius * 0.38} L${-radius * 0.48} ${-radius * 0.88} L0 ${-radius * 1.16} L${radius * 0.54} ${-radius * 0.86} L${radius * 0.88} ${radius * 0.38} Q0 ${radius * 0.82} ${-radius * 0.82} ${radius * 0.38} Z`} fill={palette.dark} stroke={palette.light} strokeWidth={4 * scale} />
      <Path d={`M${-radius * 0.44} ${radius * 0.18} L0 ${-radius * 0.78} L${radius * 0.46} ${radius * 0.18} Q0 ${radius * 0.5} ${-radius * 0.44} ${radius * 0.18} Z`} fill={palette.mid} />
      <Path d={`M0 ${-radius * 0.68} L${radius * 0.28} ${-radius * 0.08} L0 ${radius * 0.28} L${-radius * 0.28} ${-radius * 0.08} Z`} fill="#FFB15F" opacity={0.74} />
      <Circle cx={0} cy={-radius * 0.18} r={radius * 0.11} fill="#FFF0C8" opacity={0.74 + state.attack * 0.16} />
      {[-0.34, 0, 0.34].map((offset) => (
        <Polygon key={offset} points={`${offset * radius},${-radius * 0.9} ${offset * radius - radius * 0.13},${-radius * 0.62} ${offset * radius + radius * 0.13},${-radius * 0.62}`} fill={palette.light} opacity={0.7} />
      ))}
      <Polygon points={`${-radius * 0.98},${-radius * 0.54} ${-radius * 0.52},${-radius * 0.95} ${-radius * 0.15},${-radius * 0.45}`} fill={palette.main} stroke={palette.dark} strokeWidth={2 * scale} />
      <Polygon points={`${radius * 0.98},${-radius * 0.54} ${radius * 0.52},${-radius * 0.95} ${radius * 0.15},${-radius * 0.45}`} fill={palette.main} stroke={palette.dark} strokeWidth={2 * scale} />
      <Path d={`M${-radius * 0.46} ${-radius * 0.58} Q${-radius * 0.94 - clawReach * 0.22} ${-radius * 0.18 - armSway} ${-radius * 0.82 - clawReach * 0.72} ${radius * 0.2 - armSway * 0.25}`} fill="none" stroke={palette.weapon} strokeWidth={5 * scale} strokeLinecap="round" opacity={0.9} />
      <Path d={`M${-radius * 0.78 - clawReach * 0.42} ${radius * 0.08 - armSway * 0.2} L${-radius * 1.08 - clawReach * 0.86} ${radius * 0.16 - armSway * 0.1} L${-radius * 0.82 - clawReach * 0.6} ${radius * 0.36 - armSway * 0.24}`} fill={palette.light} opacity={0.74} />
      <Path d={`M${radius * 0.46} ${-radius * 0.58} Q${radius * 0.94 + clawReach * 0.28} ${-radius * 0.18 + armSway} ${radius * 0.82 + clawReach} ${radius * 0.22 + armSway * 0.25}`} fill="none" stroke={palette.weapon} strokeWidth={6 * scale} strokeLinecap="round" />
      <Path d={`M${radius * 0.78 + clawReach * 0.5} ${radius * 0.08 + armSway * 0.2} L${radius * 1.18 + clawReach} ${radius * 0.18 + armSway * 0.1} L${radius * 0.82 + clawReach * 0.7} ${radius * 0.38 + armSway * 0.24}`} fill={palette.light} opacity={0.88} />
      <Circle cx={0} cy={-radius * 1.22} r={radius * 0.52} fill={palette.face} stroke={palette.dark} strokeWidth={3 * scale} />
      <Path d={`M${-radius * 0.72} ${-radius * 1.18} L${-radius * 0.34} ${-radius * 1.78} L0 ${-radius * 1.36} L${radius * 0.34} ${-radius * 1.78} L${radius * 0.72} ${-radius * 1.18} Q0 ${-radius * 0.92} ${-radius * 0.72} ${-radius * 1.18} Z`} fill={palette.main} stroke={palette.dark} strokeWidth={3 * scale} />
      <Line x1={-radius * 0.34} y1={-radius * 1.62} x2={-radius * 0.16} y2={-radius * 1.36} stroke="#FFD36A" strokeWidth={2 * scale} strokeLinecap="round" opacity={0.68} />
      <Line x1={radius * 0.34} y1={-radius * 1.62} x2={radius * 0.16} y2={-radius * 1.36} stroke="#FFD36A" strokeWidth={2 * scale} strokeLinecap="round" opacity={0.68} />
      <Circle cx={-radius * 0.16} cy={-radius * 1.22} r={radius * 0.08} fill="#260806" />
      <Circle cx={radius * 0.16} cy={-radius * 1.22} r={radius * 0.09} fill="#260806" />
      <Circle cx={-radius * 0.16} cy={-radius * 1.22} r={radius * 0.035} fill="#FFD36A" opacity={0.72} />
      <Circle cx={radius * 0.16} cy={-radius * 1.22} r={radius * 0.035} fill="#FFD36A" opacity={0.72} />
    </G>
  );
}
