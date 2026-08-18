import { Circle, Ellipse, G, Path, Polygon, Rect } from './skiaElements';

import { ART } from '@/assets/proceduralArt';
import { projectedScale, worldToScreen } from '@/game/camera';
import { TEAM_COLORS } from '@/game/constants';
import type { CameraState, Structure } from '@/game/types';

type StructureViewProps = {
  camera: CameraState;
  structure: Structure;
  version: string;
};

export function StructureView({ camera, structure }: StructureViewProps) {
  const color = TEAM_COLORS[structure.team];
  const point = worldToScreen(camera, structure.position);
  const scale = projectedScale(camera);
  const opacity = structure.alive ? 1 : 0.24;
  const hpRatio = Math.max(0, Math.min(1, structure.hp / structure.maxHp));

  if (structure.kind === 'core') {
    const base = 55 * scale;
    const height = 90 * scale;

    return (
      <G opacity={opacity}>
        <Ellipse cx={point.x + base * 0.12} cy={point.y + base * 0.3} rx={base * 1.05} ry={base * 0.42} fill="rgba(0,0,0,0.38)" />
        <Ellipse cx={point.x} cy={point.y + base * 0.08} rx={base * 1.55} ry={base * 0.72} fill={color.glow} opacity={structure.alive ? 0.26 : 0.04} />
        <Ellipse cx={point.x} cy={point.y + base * 0.08} rx={base * 0.84} ry={base * 0.34} fill={color.dark} opacity={0.82} />
        <Path
          d={`M${point.x - base * 0.62} ${point.y + base * 0.03} L${point.x - base * 0.42} ${point.y + base * 0.34} H${point.x + base * 0.42} L${point.x + base * 0.62} ${point.y + base * 0.03} Z`}
          fill="#4A4C42"
          stroke={color.dark}
          strokeWidth={4 * scale}
        />
        <Path
          d={`M${point.x} ${point.y - height} L${point.x + base * 0.52} ${point.y - height * 0.25} L${point.x + base * 0.34} ${point.y + base * 0.28} L${point.x - base * 0.34} ${point.y + base * 0.28} L${point.x - base * 0.52} ${point.y - height * 0.25} Z`}
          fill={structure.team === 'blue' ? ART.coreBlue : ART.coreRed}
          stroke={color.dark}
          strokeWidth={5 * scale}
        />
        <Path
          d={`M${point.x + base * 0.34} ${point.y + base * 0.28} L${point.x + base * 0.52} ${point.y - height * 0.25} L${point.x + base * 0.2} ${point.y - height * 0.64} L${point.x + base * 0.08} ${point.y + base * 0.2} Z`}
          fill="rgba(0,0,0,0.24)"
        />
        <Path
          d={`M${point.x} ${point.y - height * 0.86} L${point.x + base * 0.18} ${point.y - height * 0.2} L${point.x} ${point.y + base * 0.16} L${point.x - base * 0.18} ${point.y - height * 0.2} Z`}
          fill="#FFFFFF"
          opacity={0.34}
        />
        {structure.alive ? (
          <StructureFallbackBar x={point.x} y={point.y - height - 28 * scale} width={96 * scale} scale={scale} ratio={hpRatio} color={hpRatio < 0.35 ? TEAM_COLORS.red.main : color.main} />
        ) : null}
      </G>
    );
  }

  const baseWidth = 42 * scale;
  const towerHeight = 78 * scale;

  return (
    <G opacity={opacity}>
      {structure.alive ? (
        <Ellipse
          cx={point.x}
          cy={point.y}
          rx={structure.range * scale}
          ry={structure.range * scale * camera.yScale}
          fill={color.glow}
          stroke={color.soft}
          strokeWidth={Math.max(1, 1.5 * scale)}
          opacity={0.075}
        />
      ) : null}
      <Ellipse
        cx={point.x}
        cy={point.y + baseWidth * 0.32}
        rx={baseWidth * 1.34}
        ry={baseWidth * 0.48}
        fill={color.glow}
        opacity={structure.alive ? 0.08 : 0.03}
      />
      <Ellipse cx={point.x + baseWidth * 0.13} cy={point.y + baseWidth * 0.28} rx={baseWidth * 0.76} ry={baseWidth * 0.34} fill="rgba(0,0,0,0.36)" />
      <Ellipse
        cx={point.x}
        cy={point.y + baseWidth * 0.2}
        rx={baseWidth * 0.9}
        ry={baseWidth * 0.35}
        fill="#3D3B35"
        stroke="#2A2925"
        strokeWidth={3 * scale}
      />
      <Path
        d={`M${point.x - baseWidth * 0.6} ${point.y - baseWidth * 0.1} L${point.x - baseWidth * 0.42} ${point.y + baseWidth * 0.26} H${point.x + baseWidth * 0.42} L${point.x + baseWidth * 0.6} ${point.y - baseWidth * 0.1} Z`}
        fill="#565144"
        stroke={color.dark}
        strokeWidth={4 * scale}
      />
      <Path
        d={`M${point.x + baseWidth * 0.2} ${point.y - towerHeight} L${point.x + baseWidth * 0.42} ${point.y - towerHeight * 0.1} L${point.x + baseWidth * 0.28} ${point.y + baseWidth * 0.1} L${point.x + baseWidth * 0.04} ${point.y - towerHeight * 0.78} Z`}
        fill="#7F786B"
        opacity={0.82}
      />
      <Path
        d={`M${point.x - baseWidth * 0.34} ${point.y - towerHeight * 0.12} L${point.x - baseWidth * 0.2} ${point.y - towerHeight} H${point.x + baseWidth * 0.2} L${point.x + baseWidth * 0.34} ${point.y - towerHeight * 0.12} Z`}
        fill={ART.towerStone}
        stroke={color.dark}
        strokeWidth={4 * scale}
      />
      <Path
        d={`M${point.x + baseWidth * 0.2} ${point.y - towerHeight} L${point.x + baseWidth * 0.34} ${point.y - towerHeight * 0.12} L${point.x + baseWidth * 0.22} ${point.y - towerHeight * 0.02} L${point.x + baseWidth * 0.1} ${point.y - towerHeight * 0.76} Z`}
        fill="rgba(0,0,0,0.2)"
      />
      <Circle cx={point.x} cy={point.y - towerHeight - 2 * scale} r={22 * scale} fill={color.glow} opacity={structure.alive ? 0.55 : 0.08} />
      <Polygon
        points={`${point.x},${point.y - towerHeight - 14 * scale} ${point.x + 13 * scale},${point.y - towerHeight - 1 * scale} ${point.x},${point.y - towerHeight + 12 * scale} ${point.x - 13 * scale},${point.y - towerHeight - 1 * scale}`}
        fill={color.main}
        stroke={color.soft}
        strokeWidth={3 * scale}
      />
      {structure.alive ? (
        <StructureFallbackBar x={point.x} y={point.y - towerHeight - 36 * scale} width={72 * scale} scale={scale} ratio={hpRatio} color={hpRatio < 0.35 ? TEAM_COLORS.red.main : color.main} />
      ) : null}
    </G>
  );
}

function StructureFallbackBar({
  x,
  y,
  width,
  scale,
  ratio,
  color,
}: {
  x: number;
  y: number;
  width: number;
  scale: number;
  ratio: number;
  color: string;
}) {
  const height = Math.max(5, 8 * scale);
  const pad = Math.max(1.5, 2 * scale);

  return (
    <G>
      <Rect x={x - width / 2 - pad} y={y - pad} width={width + pad * 2} height={height + pad * 2} rx={3 * scale} fill="rgba(0,0,0,0.78)" />
      <Rect x={x - width / 2} y={y} width={width} height={height} rx={2 * scale} fill="rgba(6,16,18,0.92)" />
      <Rect x={x - width / 2 + pad} y={y + pad} width={(width - pad * 2) * ratio} height={height - pad * 2} rx={1.5 * scale} fill={color} />
      <Rect x={x - width / 2 + pad} y={y + pad} width={(width - pad * 2) * ratio} height={Math.max(1, (height - pad * 2) * 0.35)} rx={1 * scale} fill="#FFFFFF" opacity={0.26} />
    </G>
  );
}
