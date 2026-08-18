import { Circle, G, Line, Path } from '../skiaElements';

import { projectedScale, worldToScreen } from '@/game/camera';
import type { CameraState, Effect } from '@/game/types';

type CombatEffectProps = {
  camera: CameraState;
  effect: Effect;
};

const HIT_SPARKS = [-2, -1, 0, 1, 2];

export function CombatEffect({ camera, effect }: CombatEffectProps) {
  const progress = Math.max(0, effect.ttl / effect.maxTtl);
  const point = worldToScreen(camera, effect.position);
  const scale = projectedScale(camera);
  const radius = effect.radius * scale * (1.12 - progress * 0.18);

  if (effect.kind === 'hit') {
    return (
      <G opacity={Math.min(0.9, progress + 0.1)}>
        <Circle cx={point.x} cy={point.y} r={radius * 0.32} fill={effect.color} opacity={0.24 * progress} />
        <Circle cx={point.x} cy={point.y} r={radius * 0.17} fill="#FFFFFF" opacity={0.76 * progress} />
        {HIT_SPARKS.map((offset) => {
          const angle = -Math.PI / 2 + offset * 0.42;
          const inner = radius * 0.13;
          const outer = radius * (0.45 + Math.abs(offset) * 0.08);

          return (
            <Line
              key={offset}
              x1={point.x + Math.cos(angle) * inner}
              y1={point.y + Math.sin(angle) * inner * 0.72}
              x2={point.x + Math.cos(angle) * outer}
              y2={point.y + Math.sin(angle) * outer * 0.72}
              stroke={offset === 0 ? '#FFFFFF' : effect.color}
              strokeWidth={(offset === 0 ? 4.4 : 3.2) * scale}
              strokeLinecap="round"
              opacity={0.82 * progress}
            />
          );
        })}
      </G>
    );
  }

  if (effect.kind === 'dash') {
    return (
      <G opacity={0.55 * progress}>
        <Path
          d={`M${point.x - radius * 0.8} ${point.y + radius * 0.2} C${point.x - radius * 0.2} ${point.y - radius * 0.45} ${point.x + radius * 0.48} ${point.y - radius * 0.38} ${point.x + radius} ${point.y + radius * 0.12}`}
          fill="none"
          stroke={effect.color}
          strokeWidth={5 * scale}
          strokeLinecap="round"
        />
      </G>
    );
  }

  if (effect.kind === 'pulse') {
    const motes = Array.from({ length: 8 }, (_, index) => {
      const angle = index * ((Math.PI * 2) / 8) + (1 - progress) * 2.4;
      const orbit = radius * (0.34 + (1 - progress) * 0.44);

      return (
        <Circle
          key={`pulse-mote-${index}`}
          cx={point.x + Math.cos(angle) * orbit}
          cy={point.y - radius * 0.18 + Math.sin(angle) * orbit * 0.58}
          r={radius * (0.045 + (index % 2) * 0.02)}
          fill={index % 2 === 0 ? '#D7FFE4' : effect.color}
          opacity={0.64 * progress}
        />
      );
    });

    return (
      <G opacity={Math.min(0.9, progress + 0.1)}>
        <Circle cx={point.x} cy={point.y} r={radius * (0.92 + (1 - progress) * 0.28)} fill={effect.color} opacity={0.13 * progress} />
        <Circle cx={point.x} cy={point.y - radius * 0.14} r={radius * 0.5} fill="none" stroke="#D7FFE4" strokeWidth={3 * scale} opacity={0.44 * progress} />
        <Path
          d={`M${point.x} ${point.y - radius * 0.72} C${point.x + radius * 0.24} ${point.y - radius * 0.42} ${point.x + radius * 0.24} ${point.y - radius * 0.08} ${point.x} ${point.y + radius * 0.18} C${point.x - radius * 0.24} ${point.y - radius * 0.08} ${point.x - radius * 0.24} ${point.y - radius * 0.42} ${point.x} ${point.y - radius * 0.72} Z`}
          fill="#D7FFE4"
          opacity={0.2 * progress}
        />
        {motes}
      </G>
    );
  }

  if (effect.kind === 'bolt') {
    const branches = [-2, -1, 0, 1, 2];

    return (
      <G opacity={Math.min(0.9, progress + 0.1)}>
        <Circle cx={point.x} cy={point.y - radius * 0.6} r={radius * 0.22} fill="#FFFFFF" opacity={0.72 * progress} />
        <Circle cx={point.x} cy={point.y - radius * 0.6} r={radius * 0.58} fill={effect.color} opacity={0.14 * progress} />
        {branches.map((branch) => {
          const angle = -Math.PI / 2 + branch * 0.36;
          const mid = radius * (0.25 + Math.abs(branch) * 0.035);
          const outer = radius * (0.66 + Math.abs(branch) * 0.08);

          return (
            <Path
              key={`bolt-cast-${branch}`}
              d={`M${point.x} ${point.y - radius * 0.58} L${point.x + Math.cos(angle) * mid} ${point.y - radius * 0.58 + Math.sin(angle) * mid * 0.72} L${point.x + Math.cos(angle + branch * 0.08) * outer} ${point.y - radius * 0.58 + Math.sin(angle + branch * 0.08) * outer * 0.72}`}
              fill="none"
              stroke={branch === 0 ? '#FFFFFF' : effect.color}
              strokeWidth={(branch === 0 ? 4.4 : 2.8) * scale}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.74 * progress}
            />
          );
        })}
      </G>
    );
  }

  if (effect.kind === 'fireball') {
    const blast = 1 - progress;
    return (
      <G opacity={Math.min(0.9, progress + 0.1)}>
        <Circle cx={point.x} cy={point.y - radius * 0.28} r={radius * (0.62 + blast * 0.46)} fill="#2C1811" opacity={0.16 * progress} />
        <Circle cx={point.x} cy={point.y - radius * 0.34} r={radius * (0.48 + blast * 0.28)} fill="#FF5533" opacity={0.32 * progress} />
        <Circle cx={point.x} cy={point.y - radius * 0.4} r={radius * (0.28 + blast * 0.18)} fill={effect.color} opacity={0.72 * progress} />
        <Circle cx={point.x - radius * 0.06} cy={point.y - radius * 0.44} r={radius * 0.12} fill="#FFF7D6" opacity={0.76 * progress} />
        <Circle cx={point.x} cy={point.y - radius * 0.2} r={radius * (0.88 + blast * 0.5)} fill="none" stroke="#FFB15F" strokeWidth={4 * scale} opacity={0.38 * progress} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
          const angle = index * ((Math.PI * 2) / 8) + blast * 1.6;
          const travel = radius * (0.24 + blast * (0.52 + (index % 3) * 0.08));
          return (
            <Circle
              key={`fire-cast-${index}`}
              cx={point.x + Math.cos(angle) * travel}
              cy={point.y - radius * 0.24 + Math.sin(angle) * travel * 0.58}
              r={radius * (0.07 + (index % 3) * 0.025)}
              fill={index % 3 === 0 ? '#3A241B' : index % 2 === 0 ? '#FFB15F' : '#FFD36A'}
              opacity={(index % 3 === 0 ? 0.24 : 0.58) * progress}
            />
          );
        })}
      </G>
    );
  }

  if (effect.kind === 'chain') {
    const branches = [-1, 0, 1];

    return (
      <G opacity={Math.min(0.9, progress + 0.1)}>
        <Circle cx={point.x} cy={point.y - radius * 0.42} r={radius * 0.22} fill="#FFFFFF" opacity={0.7 * progress} />
        {branches.map((branch) => {
          const y = point.y - radius * (0.42 - branch * 0.08);
          const side = branch * radius * 0.18;
          return (
            <Path
              key={`chain-cast-${branch}`}
              d={`M${point.x} ${point.y - radius * 0.42} L${point.x + radius * 0.2 + side} ${y - radius * 0.18} L${point.x + radius * 0.48 - side} ${y + radius * 0.04} L${point.x + radius * 0.76 + side * 0.5} ${y - radius * 0.16}`}
              fill="none"
              stroke={branch === 0 ? '#FFFFFF' : effect.color}
              strokeWidth={(branch === 0 ? 3.8 : 2.6) * scale}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.74 * progress}
            />
          );
        })}
        <Circle cx={point.x} cy={point.y - radius * 0.42} r={radius * 0.58} fill={effect.color} opacity={0.1 * progress} />
      </G>
    );
  }

  if (effect.kind === 'shield') {
    return (
      <G opacity={Math.min(0.86, progress + 0.08)}>
        <Circle cx={point.x} cy={point.y - radius * 0.08} r={radius * 0.78} fill={effect.color} opacity={0.12 * progress} />
        <Circle cx={point.x} cy={point.y - radius * 0.08} r={radius} fill="none" stroke="#D8FBFF" strokeWidth={5 * scale} opacity={0.58 * progress} />
        <Circle cx={point.x} cy={point.y - radius * 0.08} r={radius * 0.56} fill="none" stroke={effect.color} strokeWidth={3 * scale} opacity={0.74 * progress} />
        {[-1, 1].map((side) => (
          <Path
            key={`shield-facet-${side}`}
            d={`M${point.x + side * radius * 0.18} ${point.y - radius * 0.86} L${point.x + side * radius * 0.72} ${point.y - radius * 0.36} L${point.x + side * radius * 0.6} ${point.y + radius * 0.38} L${point.x + side * radius * 0.08} ${point.y + radius * 0.66}`}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2.2 * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.32 * progress}
          />
        ))}
      </G>
    );
  }

  if (effect.kind === 'trap') {
    const corners = 6;
    const marks = Array.from({ length: corners }, (_, index) => {
      const angle = index * ((Math.PI * 2) / corners);
      const x = point.x + Math.cos(angle) * radius * 0.72;
      const y = point.y + Math.sin(angle) * radius * 0.42;
      return (
        <Line
          key={`trap-mark-${index}`}
          x1={x - Math.sin(angle) * radius * 0.12}
          y1={y + Math.cos(angle) * radius * 0.08}
          x2={x + Math.sin(angle) * radius * 0.12}
          y2={y - Math.cos(angle) * radius * 0.08}
          stroke={index % 2 === 0 ? '#FFFFFF' : effect.color}
          strokeWidth={3 * scale}
          strokeLinecap="round"
          opacity={0.58 * progress}
        />
      );
    });

    return (
      <G opacity={Math.min(0.86, progress + 0.08)}>
        <Circle cx={point.x} cy={point.y} r={radius * 0.82} fill={effect.color} opacity={0.12 * progress} />
        <Circle cx={point.x} cy={point.y} r={radius} fill="none" stroke={effect.color} strokeWidth={4 * scale} opacity={0.68 * progress} />
        <Path
          d={`M${point.x} ${point.y - radius * 0.52} L${point.x + radius * 0.45} ${point.y + radius * 0.26} L${point.x - radius * 0.45} ${point.y + radius * 0.26} Z`}
          fill="none"
          stroke="#FFD36A"
          strokeWidth={2.6 * scale}
          strokeLinejoin="round"
          opacity={0.42 * progress}
        />
        <Path
          d={`M${point.x} ${point.y + radius * 0.52} L${point.x + radius * 0.45} ${point.y - radius * 0.26} L${point.x - radius * 0.45} ${point.y - radius * 0.26} Z`}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={2 * scale}
          strokeLinejoin="round"
          opacity={0.24 * progress}
        />
        {marks}
      </G>
    );
  }

  if (effect.kind === 'ult') {
    return (
      <G opacity={Math.min(0.9, progress + 0.1)}>
        <Circle cx={point.x} cy={point.y} r={radius * 1.05} fill="#8B5CF6" opacity={0.16 * progress} />
        <Circle cx={point.x} cy={point.y} r={radius * 0.62} fill="#E9D5FF" opacity={0.12 * progress} />
        <Path
          d={`M${point.x - radius * 0.78} ${point.y} C${point.x - radius * 0.2} ${point.y - radius * 0.48} ${point.x + radius * 0.36} ${point.y + radius * 0.42} ${point.x + radius * 0.86} ${point.y - radius * 0.1}`}
          fill="none"
          stroke="#E9D5FF"
          strokeWidth={5 * scale}
          strokeLinecap="round"
          opacity={0.62 * progress}
        />
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const angle = index * ((Math.PI * 2) / 6) + (1 - progress) * 2.2;
          const x = point.x + Math.cos(angle) * radius * 0.78;
          return (
            <Line
              key={`ult-bolt-${index}`}
              x1={x}
              y1={point.y - radius * (0.9 + (index % 2) * 0.2)}
              x2={x + Math.sin(angle) * radius * 0.12}
              y2={point.y - radius * 0.1}
              stroke={index % 2 === 0 ? '#FFD36A' : '#C7A5FF'}
              strokeWidth={2.8 * scale}
              strokeLinecap="round"
              opacity={0.44 * progress}
            />
          );
        })}
        <Circle cx={point.x} cy={point.y} r={radius * (0.82 + (1 - progress) * 0.3)} fill="none" stroke={effect.color} strokeWidth={4 * scale} opacity={0.76 * progress} />
      </G>
    );
  }

  return (
    <G opacity={Math.min(0.85, progress + 0.08)}>
      <Circle
        cx={point.x}
        cy={point.y}
        r={radius}
        fill="none"
        opacity={1}
        stroke={effect.color}
        strokeWidth={effect.kind === 'level' ? 5 * scale : 4 * scale}
      />
    </G>
  );
}
