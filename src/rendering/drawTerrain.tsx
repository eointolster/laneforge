import { Circle, Ellipse, G, Rect } from './skiaElements';

import { worldToScreen } from '@/game/camera';
import type { CameraState } from '@/game/types';
import { TREE_CLUSTERS } from '@/game/map/terrainDecor';
import { seededBetween } from '@/utils/random';

type DrawTerrainProps = {
  camera: CameraState;
};

export function DrawTerrain({ camera }: DrawTerrainProps) {
  return (
    <G>
      {TREE_CLUSTERS.map((cluster) => (
        <TreeClusterView key={cluster.id} camera={camera} cluster={cluster} />
      ))}
    </G>
  );
}

export function TreeClusterView({
  camera,
  cluster,
}: DrawTerrainProps & { cluster: (typeof TREE_CLUSTERS)[number] }) {
  const scale = camera.zoom * cluster.scale;
  const treeCount = cluster.count * 2;

  return (
    <G>
      {Array.from({ length: treeCount }).map((_, index) => {
        const offsetX = seededBetween(index + cluster.position.x, -54, 54);
        const offsetY = seededBetween(index + cluster.position.y, -28, 28);
        const point = worldToScreen(camera, {
          x: cluster.position.x + offsetX,
          y: cluster.position.y + offsetY,
        });
        const size = seededBetween(index * 3 + cluster.position.x, 12, 18) * scale;
        const trunkHeight = size * 0.9;
        const highlight = index % 2 === 0 ? '#287E50' : '#2E8958';

        return (
          <G key={`${cluster.id}-${index}`}>
            <Ellipse cx={point.x + size * 0.2} cy={point.y + size * 0.42} rx={size * 0.86} ry={size * 0.28} fill="rgba(0,0,0,0.24)" />
            <Rect x={point.x - size * 0.07} y={point.y - trunkHeight * 0.02} width={size * 0.14} height={trunkHeight * 0.58} rx={2} fill="#3C2D1C" opacity={0.72} />
            <Circle cx={point.x - size * 0.22} cy={point.y - size * 0.52} r={size * 0.72} fill="#123B29" />
            <Circle cx={point.x + size * 0.16} cy={point.y - size * 0.62} r={size * 0.74} fill="#174F32" />
            <Circle cx={point.x - size * 0.02} cy={point.y - size * 0.88} r={size * 0.64} fill="#1F6A42" />
            <Circle cx={point.x + size * 0.28} cy={point.y - size * 0.88} r={size * 0.34} fill={highlight} opacity={0.72} />
          </G>
        );
      })}
    </G>
  );
}
