import { memo } from 'react';
import { RadialGradient, Rect as SkiaRect } from '@shopify/react-native-skia';

import { ART, TERRAIN_COLORS } from '@/assets/proceduralArt';
import { projectedMapTransform } from '@/game/camera';
import { BASE_POSITIONS, COLORS, HERO_START, LANE_Y, MAP_HEIGHT, MAP_WIDTH, TEAM_COLORS } from '@/game/constants';
import { JUNGLE_CONNECTOR_RENDER_PATHS, LANE_RENDER_PATHS } from '@/game/map/lanePaths';
import { TERRAIN_PATCHES } from '@/game/map/mapLayout';
import { TREE_CLUSTERS, WALL_SEGMENTS } from '@/game/map/terrainDecor';
import type { CameraState } from '@/game/types';
import { seededBetween } from '@/utils/random';
import { Circle, Ellipse, G, Path, Rect } from './skiaElements';

type DrawMapProps = {
  camera: CameraState;
};

const RIDGE_PLATES = [
  `M${MAP_WIDTH * 0.16} ${MAP_HEIGHT * 0.28} C${MAP_WIDTH * 0.21} ${MAP_HEIGHT * 0.24} ${MAP_WIDTH * 0.27} ${MAP_HEIGHT * 0.25} ${MAP_WIDTH * 0.31} ${MAP_HEIGHT * 0.3} C${MAP_WIDTH * 0.27} ${MAP_HEIGHT * 0.34} ${MAP_WIDTH * 0.2} ${MAP_HEIGHT * 0.35} ${MAP_WIDTH * 0.15} ${MAP_HEIGHT * 0.32} Z`,
  `M${MAP_WIDTH * 0.5} ${MAP_HEIGHT * 0.24} C${MAP_WIDTH * 0.57} ${MAP_HEIGHT * 0.21} ${MAP_WIDTH * 0.65} ${MAP_HEIGHT * 0.25} ${MAP_WIDTH * 0.69} ${MAP_HEIGHT * 0.32} C${MAP_WIDTH * 0.62} ${MAP_HEIGHT * 0.36} ${MAP_WIDTH * 0.55} ${MAP_HEIGHT * 0.34} ${MAP_WIDTH * 0.48} ${MAP_HEIGHT * 0.29} Z`,
  `M${MAP_WIDTH * 0.18} ${MAP_HEIGHT * 0.72} C${MAP_WIDTH * 0.23} ${MAP_HEIGHT * 0.66} ${MAP_WIDTH * 0.3} ${MAP_HEIGHT * 0.67} ${MAP_WIDTH * 0.35} ${MAP_HEIGHT * 0.73} C${MAP_WIDTH * 0.29} ${MAP_HEIGHT * 0.78} ${MAP_WIDTH * 0.23} ${MAP_HEIGHT * 0.79} ${MAP_WIDTH * 0.16} ${MAP_HEIGHT * 0.76} Z`,
  `M${MAP_WIDTH * 0.58} ${MAP_HEIGHT * 0.68} C${MAP_WIDTH * 0.64} ${MAP_HEIGHT * 0.62} ${MAP_WIDTH * 0.74} ${MAP_HEIGHT * 0.65} ${MAP_WIDTH * 0.8} ${MAP_HEIGHT * 0.72} C${MAP_WIDTH * 0.73} ${MAP_HEIGHT * 0.78} ${MAP_WIDTH * 0.64} ${MAP_HEIGHT * 0.78} ${MAP_WIDTH * 0.56} ${MAP_HEIGHT * 0.74} Z`,
];

const TERRAIN_DOTS = Array.from({ length: 190 }, (_, index) => {
  const colorRoll = seededBetween(index * 17 + 11, 0, 1);
  return {
    id: `terrain-dot-${index}`,
    x: seededBetween(index * 29 + 3, 32, MAP_WIDTH - 32),
    y: seededBetween(index * 31 + 7, 42, MAP_HEIGHT - 42),
    r: seededBetween(index * 13 + 5, 1.2, 3.4),
    color: colorRoll > 0.62 ? '#1E573C' : colorRoll > 0.28 ? '#173A2D' : '#726F55',
    opacity: colorRoll > 0.28 ? 0.13 : 0.09,
  };
});

const MAGIC_GLADES = [
  { x: MAP_WIDTH * 0.14, y: MAP_HEIGHT * 0.17, rx: 310, ry: 160, color: '#5FE9FF' },
  { x: MAP_WIDTH * 0.2, y: MAP_HEIGHT * 0.79, rx: 330, ry: 170, color: '#7CFFB0' },
  { x: MAP_WIDTH * 0.34, y: MAP_HEIGHT * 0.34, rx: 360, ry: 155, color: '#9E7BFF' },
  { x: MAP_WIDTH * 0.45, y: MAP_HEIGHT * 0.75, rx: 340, ry: 165, color: '#FF8CDA' },
  { x: MAP_WIDTH * 0.58, y: MAP_HEIGHT * 0.24, rx: 370, ry: 160, color: '#FFD36A' },
  { x: MAP_WIDTH * 0.66, y: MAP_HEIGHT * 0.62, rx: 360, ry: 165, color: '#8DFFB0' },
  { x: MAP_WIDTH * 0.78, y: MAP_HEIGHT * 0.84, rx: 300, ry: 145, color: '#74E7FF' },
  { x: MAP_WIDTH * 0.9, y: MAP_HEIGHT * 0.31, rx: 280, ry: 135, color: '#C7A5FF' },
];

const RUNE_CIRCLES = [
  { x: MAP_WIDTH * 0.32, y: MAP_HEIGHT * 0.5, color: '#8B5CF6' },
  { x: MAP_WIDTH * 0.58, y: MAP_HEIGHT * 0.5, color: '#7CFFB0' },
  { x: MAP_WIDTH * 0.72, y: MAP_HEIGHT * 0.75, color: '#74E7FF' },
];

export function DrawMap({ camera }: DrawMapProps) {
  return (
    <G>
      <Rect x={0} y={0} width={camera.width} height={camera.height} fill="#173D2D" />
      <G transform={projectedMapTransform(camera)}>
        <MemoStaticMapContent />
      </G>
      <ScreenVignette camera={camera} />
    </G>
  );
}

const MemoStaticMapContent = memo(StaticMapContent);

function StaticMapContent() {
  return (
    <G>
      <Rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#173A2D" />
      <Path d={`M0 0 H${MAP_WIDTH} V${MAP_HEIGHT} H0 Z`} fill="#071713" opacity={0.38} />
      <BaseZone team="blue" x={0} />
      <BaseZone team="red" x={MAP_WIDTH - 380} />

      {MAGIC_GLADES.map((glade, index) => (
        <Ellipse
          key={`fallback-glade-${index}`}
          cx={glade.x}
          cy={glade.y}
          rx={glade.rx}
          ry={glade.ry}
          fill={glade.color}
          opacity={0.045}
        />
      ))}

      {TERRAIN_DOTS.map((dot) => (
        <Circle key={dot.id} cx={dot.x} cy={dot.y} r={dot.r} fill={dot.color} opacity={dot.opacity} />
      ))}

      {RUNE_CIRCLES.map((rune, index) => (
        <G key={`fallback-rune-${index}`}>
          <Ellipse cx={rune.x} cy={rune.y} rx={94} ry={52} fill={rune.color} opacity={0.08} />
          <Ellipse cx={rune.x} cy={rune.y} rx={74} ry={40} fill="none" stroke={rune.color} strokeWidth={5} opacity={0.18} />
          {Array.from({ length: 8 }).map((_, glyph) => {
            const angle = glyph * (Math.PI / 4);
            return (
              <Rect
                key={`fallback-rune-${index}-${glyph}`}
                x={rune.x + Math.cos(angle) * 70 - 5}
                y={rune.y + Math.sin(angle) * 38 - 5}
                width={10}
                height={10}
                rx={2}
                fill={glyph % 2 === 0 ? '#EAF8F5' : rune.color}
                opacity={0.34}
              />
            );
          })}
        </G>
      ))}

      {Object.entries(LANE_RENDER_PATHS).map(([lane, path]) => (
        <G key={lane}>
          <Path d={path.road} stroke="#183F31" strokeWidth={100} strokeLinecap="round" fill="none" opacity={0.82} />
          <G transform="translate(12 28)">
            <Path d={path.road} stroke="rgba(0,0,0,0.42)" strokeWidth={86} strokeLinecap="round" fill="none" />
          </G>
          <Path d={path.road} stroke="#3F4537" strokeWidth={84} strokeLinecap="round" fill="none" opacity={0.94} />
          <Path d={path.road} stroke="#8F7A52" strokeWidth={56} strokeLinecap="round" fill="none" opacity={0.88} />
          <Path d={path.road} stroke="#D1B071" strokeWidth={26} strokeLinecap="round" fill="none" opacity={0.28} />
          <Path d={path.center} stroke={ART.laneGlow} strokeWidth={4} strokeDasharray="26 22" strokeLinecap="round" fill="none" opacity={0.58} />
        </G>
      ))}

      {JUNGLE_CONNECTOR_RENDER_PATHS.map((path) => (
        <G key={path.id}>
          <Path d={path.road} stroke="#173629" strokeWidth={74} strokeLinecap="round" fill="none" opacity={0.68} />
          <Path d={path.road} stroke="#4B4638" strokeWidth={54} strokeLinecap="round" fill="none" opacity={0.78} />
          <Path d={path.road} stroke="#8C724E" strokeWidth={34} strokeLinecap="round" fill="none" opacity={0.58} />
          <Path d={path.center} stroke="#7CFFB0" strokeWidth={3} strokeDasharray="18 28" strokeLinecap="round" fill="none" opacity={0.2} />
        </G>
      ))}

      {RIDGE_PLATES.map((path, index) => (
        <Path
          key={`ridge-${index}`}
          d={path}
          fill={index % 2 === 0 ? '#1A4937' : '#193E37'}
          stroke="#071713"
          strokeWidth={7}
          opacity={0.84}
        />
      ))}

      {TERRAIN_PATCHES.map((patch) => {
        const color = TERRAIN_COLORS[patch.kind];
        return (
          <G key={patch.id} transform={`translate(${patch.position.x} ${patch.position.y}) rotate(${patch.rotate ?? 0})`}>
            <Ellipse
              cx={0}
              cy={0}
              rx={patch.width / 2}
              ry={patch.height / 2}
              fill={color.fill}
              stroke={color.stroke}
              strokeWidth={5}
              opacity={patch.kind === 'water' ? 0.92 : 0.78}
            />
            {patch.kind === 'ruin' ? (
              <Path d="M-35 -10 H-12 V12 H6 V-18 H32" fill="none" stroke="#C1BBAA" strokeWidth={7} opacity={0.28} />
            ) : null}
            {patch.kind === 'brush' ? (
              <G>
                <Ellipse cx={-15} cy={-5} rx={patch.width * 0.2} ry={patch.height * 0.3} fill="#1F704A" opacity={0.42} />
                <Ellipse cx={18} cy={3} rx={patch.width * 0.15} ry={patch.height * 0.25} fill="#195F3E" opacity={0.34} />
              </G>
            ) : null}
            {patch.kind === 'water' ? (
              <G>
                <Ellipse cx={0} cy={0} rx={patch.width * 0.35} ry={patch.height * 0.3} fill="#1A5870" opacity={0.6} />
                <Path d="M-40 -3 Q-20 -8 0 -3 Q20 2 40 -3" fill="none" stroke="#3AA8C4" strokeWidth={2} opacity={0.2} />
              </G>
            ) : null}
          </G>
        );
      })}

      {TREE_CLUSTERS.map((cluster) => (
        <StaticTreeCluster key={cluster.id} cluster={cluster} />
      ))}

      {WALL_SEGMENTS.map((wall) => (
        <G key={wall.id} transform={`translate(${wall.position.x} ${wall.position.y}) rotate(${wall.rotate ?? 0})`}>
          <Rect x={-wall.width / 2} y={-wall.height / 2} width={wall.width} height={wall.height} rx={7} fill="#57594E" stroke="#343B34" strokeWidth={5} />
          <Path d={`M${-wall.width / 2 + 12} 0 H${wall.width / 2 - 12}`} stroke="#A4A18F" strokeWidth={3} opacity={0.3} />
        </G>
      ))}
    </G>
  );
}

function StaticTreeCluster({ cluster }: { cluster: (typeof TREE_CLUSTERS)[number] }) {
  const treeCount = cluster.count * 2;

  return (
    <G>
      {Array.from({ length: treeCount }).map((_, index) => {
        const offsetX = seededBetween(index + cluster.position.x, -54, 54);
        const offsetY = seededBetween(index + cluster.position.y, -28, 28);
        const x = cluster.position.x + offsetX;
        const y = cluster.position.y + offsetY;
        const size = seededBetween(index * 3 + cluster.position.x, 12, 18) * cluster.scale;
        const trunkHeight = size * 0.9;
        const highlight = index % 2 === 0 ? '#1F6A42' : '#23744A';

        return (
          <G key={`${cluster.id}-${index}`}>
            <Ellipse cx={x + size * 0.2} cy={y + size * 0.42} rx={size * 0.86} ry={size * 0.28} fill="rgba(0,0,0,0.24)" />
            <Rect x={x - size * 0.07} y={y - trunkHeight * 0.02} width={size * 0.14} height={trunkHeight * 0.58} rx={2} fill="#3C2D1C" opacity={0.72} />
            <Circle cx={x - size * 0.22} cy={y - size * 0.52} r={size * 0.72} fill="#123B29" />
            <Circle cx={x + size * 0.16} cy={y - size * 0.62} r={size * 0.74} fill="#174F32" />
            <Circle cx={x - size * 0.02} cy={y - size * 0.88} r={size * 0.64} fill="#1F6A42" />
            <Circle cx={x + size * 0.28} cy={y - size * 0.88} r={size * 0.34} fill={highlight} opacity={0.58} />
          </G>
        );
      })}
    </G>
  );
}

function BaseZone({ team, x }: { team: 'blue' | 'red'; x: number }) {
  const color = TEAM_COLORS[team];
  const platformWidth = 380;
  const platformY = MAP_HEIGHT * 0.09;
  const platformHeight = MAP_HEIGHT * 0.82;
  const tileCols = 8;
  const tileRows = 6;
  const tileWidth = platformWidth / tileCols;
  const tileHeight = platformHeight / tileRows;
  const exitWidth = 340;
  const coreX = BASE_POSITIONS[team].x;
  const spawn = HERO_START[team];
  const direction = team === 'blue' ? 1 : -1;
  const exitX = direction > 0 ? x + platformWidth - 12 : x - exitWidth + 12;

  return (
    <G opacity={0.94}>
      <Rect x={x} y={platformY} width={platformWidth} height={platformHeight} rx={12} fill="#252D2F" opacity={0.94} />
      <Rect x={x + 18} y={platformY + 18} width={platformWidth - 36} height={platformHeight - 36} rx={10} fill={color.dark} opacity={0.38} />

      {Array.from({ length: tileCols * tileRows }).map((_, index) => {
        const col = index % tileCols;
        const row = Math.floor(index / tileCols);
        return (
          <Rect
            key={`${team}-base-tile-${index}`}
            x={x + col * tileWidth + 4}
            y={platformY + row * tileHeight + 4}
            width={tileWidth - 8}
            height={tileHeight - 8}
            rx={5}
            fill={(col + row) % 2 === 0 ? color.dark : color.main}
            opacity={(col + row) % 2 === 0 ? 0.34 : 0.14}
          />
        );
      })}

      {Object.values(LANE_Y).map((laneY) => (
        <G key={`${team}-base-exit-${laneY}`}>
          <Rect x={exitX} y={laneY - 39} width={exitWidth} height={78} rx={10} fill="#172A25" opacity={0.88} />
          <Rect x={exitX} y={laneY - 24} width={exitWidth} height={48} rx={8} fill="#635D4F" opacity={0.58} />
          <Path d={`M${exitX + 28} ${laneY} H${exitX + exitWidth - 28}`} stroke={color.soft} strokeWidth={4} strokeDasharray="26 22" opacity={0.2} fill="none" />
        </G>
      ))}

      <Rect x={x} y={platformY} width={platformWidth} height={18} fill="#0E1718" opacity={0.82} />
      <Rect x={x} y={platformY + platformHeight - 18} width={platformWidth} height={18} fill="#0E1718" opacity={0.82} />
      <Rect x={x} y={platformY} width={18} height={platformHeight} fill="#0E1718" opacity={0.82} />
      <Rect x={x + platformWidth - 18} y={platformY} width={18} height={platformHeight} fill="#0E1718" opacity={0.82} />

      <Circle cx={spawn.x} cy={spawn.y} r={92} fill={color.glow} opacity={0.28} />
      <Circle cx={spawn.x} cy={spawn.y} r={56} fill="none" stroke={color.soft} strokeWidth={8} opacity={0.28} />
      <Circle cx={spawn.x} cy={spawn.y} r={28} fill={color.main} opacity={0.16} />

      <Path
        d={`M${x + 22} ${platformY + 24} H${x + platformWidth - 22} V${platformY + platformHeight - 24} H${x + 22} Z`}
        stroke={color.soft}
        strokeWidth={6}
        opacity={0.24}
        fill="none"
      />

      <Circle cx={coreX} cy={MAP_HEIGHT / 2} r={146} fill={color.glow} opacity={0.34} />
      <Circle cx={coreX} cy={MAP_HEIGHT / 2} r={82} fill="none" stroke={color.soft} strokeWidth={9} opacity={0.25} />
      <Circle cx={coreX} cy={MAP_HEIGHT / 2} r={28} fill={color.main} opacity={0.3} />
      <Path
        d={`M${coreX - 118} ${MAP_HEIGHT / 2 - 92} C${coreX - 70} ${MAP_HEIGHT / 2 - 138} ${coreX + 72} ${MAP_HEIGHT / 2 - 132} ${coreX + 116} ${MAP_HEIGHT / 2 - 84}`}
        stroke={color.soft}
        strokeWidth={8}
        opacity={0.22}
        fill="none"
      />

      {[-1, 1].map((side) => (
        <G key={`${team}-base-lamp-${side}`}>
          <Rect x={coreX + direction * 104 - 8} y={MAP_HEIGHT / 2 + side * 220 - 44} width={16} height={68} rx={6} fill="#121A1C" opacity={0.9} />
          <Rect
            x={coreX + direction * 104 - 14}
            y={MAP_HEIGHT / 2 + side * 220 - 58}
            width={28}
            height={28}
            rx={5}
            fill={color.soft}
            opacity={0.38}
            transform={`rotate(45 ${coreX + direction * 104} ${MAP_HEIGHT / 2 + side * 220 - 44})`}
          />
        </G>
      ))}

      {[
        [x + 48, platformY + 58],
        [x + platformWidth - 48, platformY + 58],
        [x + 48, platformY + platformHeight - 58],
        [x + platformWidth - 48, platformY + platformHeight - 58],
      ].map(([pillarX, pillarY], index) => (
        <G key={`${team}-base-pillar-${index}`}>
          <Circle cx={pillarX} cy={pillarY} r={24} fill="#121A1C" opacity={0.82} />
          <Circle cx={pillarX} cy={pillarY} r={10} fill={color.soft} opacity={0.28} />
        </G>
      ))}
    </G>
  );
}

function ScreenVignette({ camera }: DrawMapProps) {
  return (
    <G>
      <SkiaRect x={0} y={0} width={camera.width} height={camera.height}>
        <RadialGradient
          c={{ x: camera.width * 0.52, y: camera.height * 0.5 }}
          r={Math.max(camera.width, camera.height) * 0.78}
          colors={['#00000000', '#102D2218', '#0A171A55', '#02040782']}
          positions={[0, 0.48, 0.78, 1]}
        />
      </SkiaRect>
      <Rect x={0} y={0} width={camera.width} height={78} fill="rgba(4,10,24,0.2)" />
      <Rect x={0} y={camera.height - 88} width={camera.width} height={88} fill="rgba(2,6,16,0.18)" />
      <Rect x={0} y={0} width={70} height={camera.height} fill="rgba(4,9,23,0.2)" />
      <Rect x={camera.width - 70} y={0} width={70} height={camera.height} fill="rgba(13,8,31,0.18)" />
      <Ellipse cx={camera.width * 0.08} cy={camera.height * 0.12} rx={camera.width * 0.22} ry={camera.height * 0.16} fill="rgba(61,229,255,0.03)" />
      <Ellipse cx={camera.width * 0.92} cy={camera.height * 0.86} rx={camera.width * 0.24} ry={camera.height * 0.18} fill="rgba(139,92,246,0.035)" />
    </G>
  );
}
