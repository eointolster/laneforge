import { Circle, Ellipse, G, Line, Path, Polygon, Rect } from './skiaElements';

import { projectedScale, worldToScreen } from '@/game/camera';
import { TEAM_COLORS } from '@/game/constants';
import type { CameraState, JungleBoss, JungleCreature, Trap } from '@/game/types';

type JungleBossViewProps = {
  boss: JungleBoss;
  camera: CameraState;
  time: number;
};

type JungleCreatureViewProps = {
  camera: CameraState;
  creature: JungleCreature;
  target?: { position: { x: number; y: number }; radius: number } | null;
  time: number;
};

type TrapViewProps = {
  camera: CameraState;
  trap: Trap;
  time: number;
};

export function JungleBossView({ boss, camera, time }: JungleBossViewProps) {
  const point = worldToScreen(camera, boss.position);
  const scale = projectedScale(camera);
  const radius = boss.radius * scale;
  const deathFade = boss.alive ? 1 : Math.max(0, 1 - (time - boss.deathTime) / 0.9);
  const attackFlash = Math.max(0, 1 - (time - boss.lastAttackTime) / 0.36);
  const damageFlash = Math.max(0, 1 - (time - boss.lastDamageTime) / 0.3);
  const bob = Math.sin(time * 1.6) * radius * 0.08;
  const wingSway = Math.sin(time * 2.1) * radius * 0.08;
  const hpRatio = Math.max(0, Math.min(1, boss.hp / boss.maxHp));

  return (
    <G opacity={deathFade}>
      <Ellipse cx={point.x} cy={point.y + radius * 0.52} rx={radius * 2.25} ry={radius * 0.95} fill="rgba(0,0,0,0.42)" />
      <Ellipse cx={point.x} cy={point.y + radius * 0.32} rx={radius * (2.1 + attackFlash * 0.2)} ry={radius * (0.92 + attackFlash * 0.1)} fill="#9B5CFF" opacity={0.24 + attackFlash * 0.16} />
      <Ellipse cx={point.x - radius * 0.2} cy={point.y - radius * 0.2 + bob} rx={radius * 1.08} ry={radius * 0.72} fill="#3A1854" stroke="#B58CFF" strokeWidth={3 * scale} />
      <Ellipse cx={point.x + radius * 0.34} cy={point.y - radius * 0.24 + bob} rx={radius * 0.78} ry={radius * 0.58} fill="#5F2590" opacity={0.92} />
      <Polygon
        points={`${point.x + radius * 0.98},${point.y - radius * 0.46 + bob} ${point.x + radius * 1.62},${point.y - radius * 0.18 + bob} ${point.x + radius * 1.0},${point.y + radius * 0.08 + bob} ${point.x + radius * 0.72},${point.y - radius * 0.14 + bob}`}
        fill="#7F45B9"
        stroke="#D8C7FF"
        strokeWidth={2.5 * scale}
      />
      <Path
        d={`M${point.x - radius * 0.55} ${point.y - radius * 0.68 + bob} Q${point.x - radius * 1.32} ${point.y - radius * 1.38 + wingSway} ${point.x - radius * 1.72} ${point.y - radius * 0.1} Q${point.x - radius * 1.0} ${point.y - radius * 0.36} ${point.x - radius * 0.55} ${point.y - radius * 0.68 + bob} Z`}
        fill="#2A0F3F"
        stroke="#8B5CF6"
        strokeWidth={2.2 * scale}
        opacity={0.86}
      />
      <Path
        d={`M${point.x - radius * 0.25} ${point.y - radius * 0.78 + bob} Q${point.x + radius * 0.55} ${point.y - radius * 1.42 - wingSway} ${point.x + radius * 1.08} ${point.y - radius * 0.22} Q${point.x + radius * 0.36} ${point.y - radius * 0.38} ${point.x - radius * 0.25} ${point.y - radius * 0.78 + bob} Z`}
        fill="#2A0F3F"
        stroke="#8B5CF6"
        strokeWidth={2.2 * scale}
        opacity={0.78}
      />
      {[0, 1, 2, 3].map((index) => (
        <Ellipse
          key={`boss-tail-${index}`}
          cx={point.x - radius * (1.05 + index * 0.4)}
          cy={point.y + radius * (0.1 + index * 0.08) + bob * 0.35}
          rx={radius * (0.42 - index * 0.055)}
          ry={radius * (0.22 - index * 0.025)}
          fill="#35164F"
          opacity={0.86 - index * 0.12}
        />
      ))}
      {[0, 1, 2, 3, 4].map((index) => (
        <Polygon
          key={`boss-spike-${index}`}
          points={`${point.x - radius * (0.68 - index * 0.28)},${point.y - radius * (0.72 + (index % 2) * 0.08) + bob} ${point.x - radius * (0.56 - index * 0.28)},${point.y - radius * 1.16 + bob} ${point.x - radius * (0.42 - index * 0.28)},${point.y - radius * (0.72 + (index % 2) * 0.08) + bob}`}
          fill="#C7A5FF"
          opacity={0.58}
        />
      ))}
      {attackFlash > 0 ? (
        <Circle cx={point.x + radius * 1.34} cy={point.y - radius * 0.18 + bob} r={radius * (0.24 + attackFlash * 0.12)} fill="#F0E4FF" opacity={0.72 * attackFlash} />
      ) : null}
      {damageFlash > 0 ? (
        <Ellipse cx={point.x} cy={point.y - radius * 0.24 + bob} rx={radius * 1.25} ry={radius * 0.82} fill="#FFFFFF" opacity={0.2 * damageFlash} />
      ) : null}
      {boss.alive ? (
        <ObjectiveHealthBar x={point.x} y={point.y - radius * 1.72} width={radius * 2.36} ratio={hpRatio} color="#B58CFF" scale={scale} />
      ) : null}
    </G>
  );
}

export function JungleCreatureView({ camera, creature, target, time }: JungleCreatureViewProps) {
  const point = worldToScreen(camera, creature.position);
  const scale = projectedScale(camera);
  const radius = creature.radius * scale;
  const fade = creature.alive ? 1 : Math.max(0, 1 - (time - creature.deathTime) / 0.8);
  const attackFlash = Math.max(0, 1 - (time - creature.lastAttackTime) / 0.32);
  const damageFlash = Math.max(0, 1 - (time - creature.lastDamageTime) / 0.24);
  const bob = Math.sin(time * (creature.kind === 'dragon' ? 2.2 : 1.8) + creature.position.x * 0.01) * radius * 0.06;
  const facing = creature.facing.x >= 0 ? 1 : -1;
  const hpRatio = Math.max(0, Math.min(1, creature.hp / creature.maxHp));
  const color = creature.kind === 'dragon' ? '#C7A5FF' : '#7CFFB0';
  const aggroPulse = creature.targetRef && creature.alive ? 0.45 + Math.sin(time * 5.2 + creature.position.x * 0.01) * 0.18 : 0;

  return (
    <G opacity={fade}>
      <Ellipse cx={point.x + radius * 0.16} cy={point.y + radius * 0.22} rx={radius * 1.42} ry={radius * 0.54} fill="rgba(0,0,0,0.4)" />
      <Ellipse cx={point.x} cy={point.y + radius * 0.1} rx={radius * (1.5 + attackFlash * 0.12)} ry={radius * (0.62 + attackFlash * 0.08)} fill={creature.kind === 'dragon' ? 'rgba(155,92,255,0.24)' : 'rgba(124,255,176,0.2)'} />
      {aggroPulse > 0 ? (
        <Ellipse cx={point.x} cy={point.y + radius * 0.1} rx={radius * (1.72 + attackFlash * 0.18)} ry={radius * (0.74 + attackFlash * 0.1)} fill="none" stroke="#FFD36A" strokeWidth={2.4 * scale} opacity={aggroPulse} />
      ) : null}
      {creature.kind === 'dragon' && target && attackFlash > 0 ? (
        <DragonFlameBreath camera={camera} source={creature.position} target={target.position} radius={radius} scale={scale} facing={facing} attackFlash={attackFlash} time={time} />
      ) : null}
      {creature.kind === 'dragon' ? (
        <DragonCampBody point={point} radius={radius} scale={scale} facing={facing} bob={bob} attackFlash={attackFlash} time={time} />
      ) : (
        <BearCampBody point={point} radius={radius} scale={scale} facing={facing} bob={bob} attackFlash={attackFlash} time={time} />
      )}
      {damageFlash > 0 ? (
        <Ellipse cx={point.x} cy={point.y - radius * 0.44 + bob} rx={radius * 1.08} ry={radius * 0.82} fill="#FFFFFF" opacity={0.22 * damageFlash} />
      ) : null}
      {creature.alive ? (
        <ObjectiveHealthBar x={point.x} y={point.y - radius * 1.55} width={radius * 1.9} ratio={hpRatio} color={color} scale={scale} />
      ) : null}
    </G>
  );
}

function DragonFlameBreath({
  camera,
  source,
  target,
  radius,
  scale,
  facing,
  attackFlash,
  time,
}: {
  camera: CameraState;
  source: { x: number; y: number };
  target: { x: number; y: number };
  radius: number;
  scale: number;
  facing: 1 | -1;
  attackFlash: number;
  time: number;
}) {
  const startPoint = worldToScreen(camera, {
    x: source.x + facing * radius / scale * 0.72,
    y: source.y,
  });
  const endPoint = worldToScreen(camera, target);
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const distance = Math.hypot(dx, dy);
  if (distance < radius * 0.35) return null;

  const nx = dx / distance;
  const ny = dy / distance;
  const sx = -ny;
  const sy = nx;
  const flameWidth = radius * (0.26 + attackFlash * 0.26);
  const startInset = radius * 0.22;
  const endInset = Math.max(radius * 0.4, Math.min(radius * 1.15, distance * 0.24));
  const startX = startPoint.x + nx * startInset;
  const startY = startPoint.y + ny * startInset - radius * 0.4;
  const endX = endPoint.x - nx * endInset;
  const endY = endPoint.y - ny * endInset - radius * 0.12;
  const midX = (startX + endX) * 0.5 + sx * Math.sin(time * 14) * radius * 0.12;
  const midY = (startY + endY) * 0.5 + sy * Math.sin(time * 14) * radius * 0.12;

  return (
    <G opacity={Math.min(0.9, attackFlash + 0.12)}>
      <Path
        d={`M${startX - sx * flameWidth * 0.35} ${startY - sy * flameWidth * 0.35} Q${midX - sx * flameWidth * 0.8} ${midY - sy * flameWidth * 0.8} ${endX - sx * flameWidth * 1.45} ${endY - sy * flameWidth * 1.45} Q${endX + sx * flameWidth * 0.6} ${endY + sy * flameWidth * 0.6} ${startX + sx * flameWidth * 0.35} ${startY + sy * flameWidth * 0.35} Z`}
        fill="#D94A22"
        opacity={0.6 * attackFlash}
      />
      <Path
        d={`M${startX} ${startY} Q${midX - sx * flameWidth * 0.22} ${midY - sy * flameWidth * 0.22} ${endX - sx * flameWidth * 0.62} ${endY - sy * flameWidth * 0.62} Q${endX + sx * flameWidth * 0.2} ${endY + sy * flameWidth * 0.2} ${startX} ${startY} Z`}
        fill="#FFD36A"
        opacity={0.82 * attackFlash}
      />
      {[0.22, 0.42, 0.62, 0.82].map((t, index) => {
        const flicker = Math.sin(time * 18 + index * 1.7) * radius * 0.14;
        return (
          <Circle
            key={`dragon-flame-${index}`}
            cx={startX + (endX - startX) * t + sx * flicker}
            cy={startY + (endY - startY) * t + sy * flicker}
            r={radius * (0.08 + index * 0.018)}
            fill={index % 2 === 0 ? '#FFF7D6' : '#FFB15F'}
            opacity={(0.46 - index * 0.05) * attackFlash}
          />
        );
      })}
      <Line x1={startX} y1={startY} x2={endX} y2={endY} stroke="#FFF7D6" strokeWidth={2.4 * scale} strokeLinecap="round" opacity={0.28 * attackFlash} />
    </G>
  );
}

function BearCampBody({
  point,
  radius,
  scale,
  facing,
  bob,
  attackFlash,
  time,
}: {
  point: { x: number; y: number };
  radius: number;
  scale: number;
  facing: 1 | -1;
  bob: number;
  attackFlash: number;
  time: number;
}) {
  const stride = Math.sin(time * 7.2 + point.x * 0.018);
  const shoulderRise = attackFlash * radius * 0.12;
  const snoutPush = attackFlash * radius * 0.2;

  return (
    <G transform={`translate(${point.x} ${point.y - radius * 0.72 + bob - shoulderRise}) scale(${facing} 1)`}>
      <Path d={`M${-radius * 0.92} ${-radius * 0.2} Q${-radius * 0.38} ${-radius * 0.64} ${radius * 0.34} ${-radius * 0.32} Q${-radius * 0.08} ${-radius * 0.06} ${-radius * 0.92} ${-radius * 0.2} Z`} fill="#463424" opacity={0.72} />
      <Ellipse cx={-radius * 0.12} cy={radius * 0.18} rx={radius * 0.96} ry={radius * 0.58} fill="#2B2119" stroke="#0B0806" strokeWidth={2.8 * scale} />
      <Ellipse cx={-radius * 0.42} cy={-radius * 0.02} rx={radius * 0.52} ry={radius * 0.42} fill="#3A2B1F" opacity={0.78} />
      <Ellipse cx={radius * (0.48 + attackFlash * 0.06)} cy={-radius * 0.1} rx={radius * 0.48} ry={radius * 0.43} fill="#33261B" stroke="#0B0806" strokeWidth={2.4 * scale} />
      <Circle cx={radius * 0.28} cy={-radius * 0.48} r={radius * 0.16} fill="#211811" stroke="#0B0806" strokeWidth={1.6 * scale} />
      <Circle cx={radius * 0.62} cy={-radius * 0.45} r={radius * 0.14} fill="#211811" stroke="#0B0806" strokeWidth={1.6 * scale} />
      <Ellipse cx={radius * (0.66 + attackFlash * 0.08)} cy={-radius * 0.04} rx={radius * (0.19 + attackFlash * 0.03)} ry={radius * 0.13} fill="#12100C" />
      <Circle cx={radius * 0.34} cy={-radius * 0.18} r={radius * 0.055} fill="#BFFFFF" />
      <Circle cx={radius * 0.36} cy={-radius * 0.18} r={radius * 0.022} fill="#0B0806" />
      <Line x1={radius * 0.76} y1={radius * 0.04} x2={radius * (0.95 + attackFlash * 0.08)} y2={radius * 0.02} stroke="#EAF8F5" strokeWidth={1.4 * scale} strokeLinecap="round" opacity={0.7 + attackFlash * 0.18} />
      <Path d={`M${radius * (0.72 + snoutPush / radius)} ${radius * 0.12} Q${radius * 1.04 + attackFlash * radius * 0.22} ${radius * 0.16} ${radius * 1.14 + attackFlash * radius * 0.36} ${radius * 0.44}`} fill="none" stroke="#D9FCE3" strokeWidth={3.4 * scale} strokeLinecap="round" opacity={0.68 + attackFlash * 0.25} />
      {attackFlash > 0 ? (
        <Path d={`M${radius * 0.74} ${radius * 0.22} Q${radius * 1.1} ${radius * 0.46} ${radius * 1.48} ${radius * 0.32}`} fill="none" stroke="#FFD36A" strokeWidth={2.4 * scale} strokeLinecap="round" opacity={0.38 * attackFlash} />
      ) : null}
      {[-0.62, -0.18, 0.28, 0.64].map((x, index) => (
        <Rect
          key={`bear-leg-${index}`}
          x={radius * x}
          y={radius * (0.42 + (index % 2 === 0 ? stride : -stride) * 0.04)}
          width={radius * 0.23}
          height={radius * 0.45}
          rx={radius * 0.08}
          fill="#19120E"
        />
      ))}
      {[-0.56, 0.34, 0.72].map((x, index) => (
        <Line key={`bear-claw-${index}`} x1={radius * x} y1={radius * 0.88} x2={radius * (x + 0.15)} y2={radius * 0.9} stroke="#D9FCE3" strokeWidth={1.8 * scale} strokeLinecap="round" opacity={0.72} />
      ))}
      <Path d={`M${-radius * 0.86} ${-radius * 0.02} Q${-radius * 1.1} ${-radius * 0.24} ${-radius * 1.22} ${radius * 0.06}`} fill="none" stroke="#18110D" strokeWidth={4 * scale} strokeLinecap="round" />
    </G>
  );
}

function DragonCampBody({
  point,
  radius,
  scale,
  facing,
  bob,
  attackFlash,
  time,
}: {
  point: { x: number; y: number };
  radius: number;
  scale: number;
  facing: 1 | -1;
  bob: number;
  attackFlash: number;
  time: number;
}) {
  const wingLift = Math.sin(time * 3.1 + point.x * 0.012) * radius * 0.14 + attackFlash * radius * 0.12;
  const tailSway = Math.sin(time * 2.8 + point.y * 0.012) * radius * 0.09;
  const headPush = attackFlash * radius * 0.26;
  const stride = Math.sin(time * 5 + point.x * 0.018) * radius * 0.035;

  return (
    <G transform={`translate(${point.x} ${point.y - radius * 0.78 + bob}) scale(${facing} 1)`}>
      <Rect x={-radius * 0.9} y={-radius * 0.72 + wingLift * 0.38} width={radius * 0.68} height={radius * 0.28} fill="#20133A" stroke="#8B5CF6" strokeWidth={2.2 * scale} />
      <Rect x={-radius * 0.72} y={-radius * 0.44 + wingLift * 0.22} width={radius * 0.48} height={radius * 0.24} fill="#35195A" />
      <Rect x={-radius * 0.06} y={-radius * 0.78 - wingLift * 0.3} width={radius * 0.84} height={radius * 0.28} fill="#241544" stroke="#8B5CF6" strokeWidth={2.2 * scale} />
      <Rect x={radius * 0.18} y={-radius * 0.5 - wingLift * 0.18} width={radius * 0.52} height={radius * 0.24} fill="#3B1F68" />
      <Rect x={-radius * 0.72} y={-radius * 0.12} width={radius * 1.22} height={radius * 0.62} fill="#35195A" stroke="#0D0820" strokeWidth={3 * scale} />
      <Rect x={-radius * 0.58} y={radius * 0.1} width={radius * 0.82} height={radius * 0.22} fill="#57269A" opacity={0.72} />
      <Rect x={radius * (0.38 + attackFlash * 0.08)} y={-radius * 0.36 - attackFlash * radius * 0.04} width={radius * 0.54} height={radius * 0.48} fill="#57269A" stroke="#0D0820" strokeWidth={2.6 * scale} />
      <Rect x={radius * (0.82 + headPush * 0.5)} y={-radius * 0.2} width={radius * 0.4} height={radius * 0.24} fill="#7F45B9" stroke="#D8C7FF" strokeWidth={1.8 * scale} />
      <Rect x={radius * (0.86 + headPush * 0.5)} y={radius * 0.04} width={radius * 0.28} height={radius * 0.16} fill="#4D2380" />
      <Rect x={radius * 0.46} y={-radius * 0.68} width={radius * 0.12} height={radius * 0.28} fill="#D8C7FF" opacity={0.78} />
      <Rect x={radius * 0.76} y={-radius * 0.58} width={radius * 0.12} height={radius * 0.24} fill="#D8C7FF" opacity={0.72} />
      <Rect x={radius * (0.62 + headPush * 0.28)} y={-radius * 0.16} width={radius * 0.1} height={radius * 0.08} fill="#D9FFE8" />
      <Rect x={radius * (1.06 + attackFlash * 0.32)} y={-radius * 0.08} width={radius * (0.18 + attackFlash * 0.16)} height={radius * (0.12 + attackFlash * 0.08)} fill="#FFD36A" opacity={0.36 + attackFlash * 0.34} />
      {attackFlash > 0 ? (
        <Rect x={radius * 1.24} y={-radius * 0.16} width={radius * 0.5} height={radius * 0.12} fill="#FFB15F" opacity={0.42 * attackFlash} />
      ) : null}
      {[0, 1, 2, 3].map((index) => (
        <Rect
          key={`dragon-spike-${index}`}
          x={-radius * (0.52 - index * 0.24)}
          y={-radius * (0.38 - (index % 2) * 0.04)}
          width={radius * 0.14}
          height={radius * (0.22 - index * 0.02)}
          fill="#D8C7FF"
          opacity={0.72 - index * 0.07}
        />
      ))}
      {[
        { x: -0.98, y: 0.18 },
        { x: -1.22, y: 0.08 + tailSway / radius },
        { x: -1.4, y: -0.04 + tailSway / radius },
      ].map((block, index) => (
        <Rect
          key={`dragon-tail-${index}`}
          x={radius * block.x}
          y={radius * block.y}
          width={radius * (0.28 - index * 0.04)}
          height={radius * (0.2 - index * 0.02)}
          fill={index === 0 ? '#2A164A' : '#20133A'}
        />
      ))}
      {[-0.48, -0.1, 0.3, 0.58].map((x, index) => (
        <Rect key={`dragon-leg-${index}`} x={radius * x} y={radius * (0.34 + (index % 2 === 0 ? stride : -stride) / radius)} width={radius * 0.18} height={radius * 0.38} fill="#1A0E30" />
      ))}
      {[0.38, 0.72].map((x, index) => (
        <Rect key={`dragon-claw-${index}`} x={radius * x} y={radius * 0.72} width={radius * 0.16} height={radius * 0.05} fill="#D8C7FF" opacity={0.76} />
      ))}
    </G>
  );
}

export function TrapView({ camera, trap, time }: TrapViewProps) {
  const point = worldToScreen(camera, trap.position);
  const scale = projectedScale(camera);
  const radius = trap.radius * scale;
  const color = TEAM_COLORS[trap.team];
  const pulse = 0.72 + Math.sin(time * 4 + trap.position.x * 0.01) * 0.14;
  const fade = trap.triggered ? Math.min(0.45, trap.ttl * 2) : Math.min(1, trap.ttl / 0.6);

  return (
    <G opacity={fade}>
      <Ellipse cx={point.x} cy={point.y + radius * 0.14} rx={radius * (1.08 + pulse * 0.08)} ry={radius * (0.58 + pulse * 0.05)} fill={color.glow} opacity={0.34} />
      <Ellipse cx={point.x} cy={point.y + radius * 0.14} rx={radius * 0.82} ry={radius * 0.44} fill="none" stroke="#C7A5FF" strokeWidth={3 * scale} opacity={0.72} />
      <Ellipse cx={point.x} cy={point.y + radius * 0.14} rx={radius * 0.48} ry={radius * 0.26} fill="none" stroke={color.soft} strokeWidth={2 * scale} opacity={0.68} />
      {[0, 1, 2, 3, 4, 5].map((index) => {
        const angle = index * (Math.PI / 3) + time * 0.5;
        const glyphX = point.x + Math.cos(angle) * radius * 0.68;
        const glyphY = point.y + radius * 0.14 + Math.sin(angle) * radius * 0.38;

        return (
          <Rect
            key={`trap-glyph-${trap.id}-${index}`}
            x={glyphX - radius * 0.08}
            y={glyphY - radius * 0.08}
            width={radius * 0.16}
            height={radius * 0.16}
            rx={2 * scale}
            fill={index % 2 === 0 ? color.soft : '#C7A5FF'}
            opacity={0.72}
            transform={`rotate(${45 + index * 20} ${glyphX} ${glyphY})`}
          />
        );
      })}
    </G>
  );
}

function ObjectiveHealthBar({
  x,
  y,
  width,
  ratio,
  color,
  scale,
}: {
  x: number;
  y: number;
  width: number;
  ratio: number;
  color: string;
  scale: number;
}) {
  const height = Math.max(7, 10 * scale);
  const pad = Math.max(2, 2.5 * scale);

  return (
    <G>
      <Rect x={x - width / 2 - pad} y={y - pad} width={width + pad * 2} height={height + pad * 2} rx={4 * scale} fill="rgba(0,0,0,0.82)" />
      <Rect x={x - width / 2} y={y} width={width} height={height} rx={3 * scale} fill="rgba(9,6,18,0.9)" />
      <Rect x={x - width / 2 + pad} y={y + pad} width={(width - pad * 2) * ratio} height={height - pad * 2} rx={2 * scale} fill={color} />
      <Rect x={x - width / 2 + pad} y={y + pad} width={(width - pad * 2) * ratio} height={Math.max(1, (height - pad * 2) * 0.36)} rx={1.5 * scale} fill="#FFFFFF" opacity={0.24} />
    </G>
  );
}
