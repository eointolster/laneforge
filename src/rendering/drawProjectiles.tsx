import { Circle, G, Line, Path } from './skiaElements';

import { projectedScale, worldToScreen } from '@/game/camera';
import { TEAM_COLORS } from '@/game/constants';
import type { CameraState, Projectile } from '@/game/types';
import { normalize } from '@/utils/math';

type ProjectileViewProps = {
  camera: CameraState;
  projectile: Projectile;
};

export function ProjectileView({ camera, projectile }: ProjectileViewProps) {
  const rawPoint = worldToScreen(camera, projectile.position);
  const scale = projectedScale(camera);
  const radius = Math.max(4, projectile.radius * scale);
  const point = {
    x: rawPoint.x,
    y: rawPoint.y - projectileVisualLift(projectile, radius),
  };
  const masteryTier = projectile.masteryTier ?? 0;
  const color = masteryTier >= 2
    ? '#FFD36A'
    : masteryTier >= 1
      ? '#C7A5FF'
      : projectile.kind === 'tower'
        ? projectile.team === 'blue' ? '#9CEEFF' : '#FFB096'
        : TEAM_COLORS[projectile.team].soft;
  const velocity = normalize(projectile.velocity);
  const side = { x: -velocity.y, y: velocity.x };
  const tailLength = (projectile.kind === 'bolt' ? 42 : projectile.kind === 'tower' ? 34 : 28) + masteryTier * 8;
  const towerPath = projectile.kind === 'tower'
    ? lightningPath(point.x, point.y, velocity, tailLength * scale, radius)
    : null;

  if (projectile.kind === 'bolt') {
    const boltPath = lightningPath(point.x, point.y, velocity, tailLength * 1.18 * scale, radius * 0.82);

    return (
      <G opacity={Math.min(1, projectile.ttl * 1.4)}>
        <Path
          d={boltPath}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={Math.max(4, radius * (0.78 + masteryTier * 0.12))}
          opacity={0.76}
        />
        <Path
          d={boltPath}
          fill="none"
          stroke="#FFFFFF"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={Math.max(1.4, radius * 0.24)}
          opacity={0.82}
        />
        <Path
          d={`M${point.x - side.x * radius * 0.72} ${point.y - side.y * radius * 0.58} L${point.x + velocity.x * radius * 1.7} ${point.y + velocity.y * radius * 1.25} L${point.x + side.x * radius * 0.72} ${point.y + side.y * radius * 0.58} Z`}
          fill={color}
          opacity={0.72}
        />
        <Circle cx={point.x} cy={point.y} r={radius * (0.72 + masteryTier * 0.12)} fill="#FFFFFF" opacity={0.68} />
        <Circle cx={point.x} cy={point.y} r={radius * (1.55 + masteryTier * 0.18)} fill={color} opacity={0.18 + masteryTier * 0.05} />
      </G>
    );
  }

  if (projectile.kind === 'fireball') {
    const fireColor = masteryTier >= 2 ? '#FFD36A' : masteryTier >= 1 ? '#FFB12E' : '#FF7A1A';
    const emberColor = masteryTier >= 1 ? '#FFD36A' : '#FFB15F';
    const hotCore = masteryTier >= 2 ? '#FFF7D6' : '#FFF0A8';
    const spikeCount = 10 + masteryTier * 2;

    return (
      <G opacity={Math.min(1, projectile.ttl * 1.35)}>
        {Array.from({ length: 6 + masteryTier }).map((_, index) => {
          const step = index + 1;
          const jitter = Math.sin(projectile.position.x * 0.02 + index * 1.9) * radius * 0.42;
          return (
            <Circle
              key={`fire-ember-${projectile.id}-${index}`}
              cx={point.x - velocity.x * step * radius * 0.68 + side.x * jitter}
              cy={point.y - velocity.y * step * radius * 0.36 + side.y * jitter * 0.58 + (index % 3 - 1) * radius * 0.12}
              r={Math.max(2, radius * (0.22 - Math.min(0.15, step * 0.018)))}
              fill={step % 2 === 0 ? emberColor : fireColor}
              opacity={0.7 / (step + 1)}
            />
          );
        })}
        {Array.from({ length: spikeCount }).map((_, index) => {
          const angle = index * ((Math.PI * 2) / spikeCount) + projectile.position.x * 0.003;
          const inner = radius * (0.78 + (index % 2) * 0.08);
          const outer = radius * (1.42 + (index % 3) * 0.13);
          const spread = 0.18;
          return (
            <Path
              key={`fire-spike-${projectile.id}-${index}`}
              d={`M${point.x + Math.cos(angle - spread) * inner} ${point.y + Math.sin(angle - spread) * inner * 0.72} L${point.x + Math.cos(angle) * outer} ${point.y + Math.sin(angle) * outer * 0.72} L${point.x + Math.cos(angle + spread) * inner} ${point.y + Math.sin(angle + spread) * inner * 0.72} Z`}
              fill={index % 3 === 0 ? '#D94A22' : index % 2 === 0 ? '#FF7A1A' : '#FFD36A'}
              opacity={0.76}
            />
          );
        })}
        <Circle cx={point.x} cy={point.y} r={radius * (1.18 + masteryTier * 0.08)} fill="#D94A22" opacity={0.96} />
        <Circle cx={point.x + velocity.x * radius * 0.12} cy={point.y + velocity.y * radius * 0.08} r={radius * (0.86 + masteryTier * 0.06)} fill={fireColor} opacity={0.92} />
        <Circle cx={point.x + velocity.x * radius * 0.22 - side.x * radius * 0.14} cy={point.y + velocity.y * radius * 0.12 - side.y * radius * 0.1} r={radius * (0.46 + masteryTier * 0.06)} fill={hotCore} opacity={0.88} />
        <Circle cx={point.x - side.x * radius * 0.32} cy={point.y - side.y * radius * 0.22} r={radius * 0.18} fill="#FFF7D6" opacity={0.68} />
      </G>
    );
  }

  return (
    <G opacity={Math.min(1, projectile.ttl * 1.4)}>
      <Line
        x1={point.x - velocity.x * tailLength * scale}
        y1={point.y - velocity.y * tailLength * 0.72 * scale}
        x2={point.x}
        y2={point.y}
        stroke={color}
        strokeWidth={Math.max(4, radius * (0.82 + masteryTier * 0.12))}
        strokeLinecap="round"
        opacity={0.52}
      />
      {towerPath ? (
        <>
          <Path
            d={towerPath}
            fill="none"
            stroke={projectile.team === 'blue' ? '#C7A5FF' : '#FFD36A'}
            strokeLinecap="round"
            strokeWidth={Math.max(2.2, radius * 0.44)}
            opacity={0.74}
          />
          <Path
            d={towerPath}
            fill="none"
            stroke="#FFFFFF"
            strokeLinecap="round"
            strokeWidth={Math.max(1.1, radius * 0.2)}
            opacity={0.68}
          />
        </>
      ) : null}
      <Path
        d={`M${point.x - velocity.y * radius * 0.9} ${point.y + velocity.x * radius * 0.7} L${point.x + velocity.x * radius * 1.45} ${point.y + velocity.y * radius * 1.1} L${point.x + velocity.y * radius * 0.9} ${point.y - velocity.x * radius * 0.7} Z`}
        fill={color}
        opacity={0.42}
      />
      {masteryTier >= 2 ? <Circle cx={point.x} cy={point.y} r={radius * 0.42} fill="#FFFFFF" opacity={0.88} /> : null}
      <Circle cx={point.x} cy={point.y} r={radius + (4 + masteryTier * 3) * scale} fill={color} opacity={0.22 + masteryTier * 0.06} />
      <Circle cx={point.x} cy={point.y} r={radius} fill={color} />
    </G>
  );
}

function projectileVisualLift(projectile: Projectile, radius: number) {
  if (projectile.kind === 'fireball') return radius * 1.9;
  if (projectile.kind === 'bolt' || projectile.kind === 'chain') return radius * 1.25;
  if (projectile.kind === 'tower') return radius * 0.72;
  return 0;
}

function lightningPath(x: number, y: number, velocity: { x: number; y: number }, length: number, radius: number) {
  const side = { x: -velocity.y, y: velocity.x };
  const steps = 5;
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const jitter = index === 0 || index === steps ? 0 : (index % 2 === 0 ? 1 : -1) * radius * (0.42 + index * 0.04);
    return {
      x: x - velocity.x * length * t + side.x * jitter,
      y: y - velocity.y * length * 0.72 * t + side.y * jitter * 0.72,
    };
  });

  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
}
