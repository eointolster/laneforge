import { memo } from 'react';
import { Canvas } from '@shopify/react-native-skia';
import { Platform, StyleSheet, View } from 'react-native';

import { getVisibleWorldRect } from '@/game/camera';
import { COLORS, MAP_HEIGHT, MAP_WIDTH, TEAM_COLORS } from '@/game/constants';
import { JUNGLE_CONNECTOR_RENDER_PATHS, LANE_RENDER_PATHS } from '@/game/map/lanePaths';
import type { CameraState, GameState } from '@/game/types';
import { Circle, Ellipse, G, Path, Rect } from '@/rendering/skiaElements';

type MiniMapProps = {
  state: GameState;
  camera: CameraState;
};

const JUNGLE_PATCHES = [
  { x: MAP_WIDTH * 0.18, y: MAP_HEIGHT * 0.22, rx: 360, ry: 190 },
  { x: MAP_WIDTH * 0.23, y: MAP_HEIGHT * 0.76, rx: 410, ry: 220 },
  { x: MAP_WIDTH * 0.42, y: MAP_HEIGHT * 0.34, rx: 430, ry: 210 },
  { x: MAP_WIDTH * 0.56, y: MAP_HEIGHT * 0.68, rx: 450, ry: 220 },
  { x: MAP_WIDTH * 0.74, y: MAP_HEIGHT * 0.25, rx: 410, ry: 190 },
  { x: MAP_WIDTH * 0.82, y: MAP_HEIGHT * 0.78, rx: 360, ry: 210 },
];

const MINIMAP_WIDTH = 170;
const MINIMAP_HEIGHT = Math.round((MINIMAP_WIDTH * MAP_HEIGHT) / MAP_WIDTH);
const MINIMAP_SCALE_X = MINIMAP_WIDTH / MAP_WIDTH;
const MINIMAP_SCALE_Y = MINIMAP_HEIGHT / MAP_HEIGHT;
const VISION_RADIUS = 760;
const INNER_VISION_RADIUS = 320;

export function MiniMap({ state, camera }: MiniMapProps) {
  const visible = getVisibleWorldRect(camera);
  const canUseSkiaMinimap = Platform.OS !== 'web' || typeof (globalThis as typeof globalThis & { CanvasKit?: unknown }).CanvasKit !== 'undefined';

  if (!canUseSkiaMinimap) {
    return <WebMiniMapFallback state={state} visible={visible} />;
  }

  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        <G transform={`scale(${MINIMAP_SCALE_X} ${MINIMAP_SCALE_Y})`}>
          <MemoMiniMapStaticLayer />
          {state.structures.map((structure) => {
            const markerSize = structure.kind === 'core' ? 56 : Math.max(24, structure.radius * 2.1);
            return (
              <Rect
                key={structure.id}
                x={structure.position.x - markerSize / 2}
                y={structure.position.y - markerSize / 2}
                width={markerSize}
                height={markerSize}
                fill={structure.kind === 'core' ? TEAM_COLORS[structure.team].main : TEAM_COLORS[structure.team].soft}
                stroke={structure.team === 'blue' ? '#EAF8F5' : '#FFD8CC'}
                strokeWidth={structure.kind === 'core' ? 7 : 5}
                opacity={structure.alive ? 1 : 0.24}
                transform={`rotate(45 ${structure.position.x} ${structure.position.y})`}
              />
            );
          })}
          <G opacity={0.82}>
            {state.minions.map((minion) => (
              <Rect
                key={minion.id}
                x={minion.position.x - 7}
                y={minion.position.y - 7}
                width={14}
                height={14}
                fill={TEAM_COLORS[minion.team].main}
              />
            ))}
          </G>
          {state.jungleBoss && Number.isFinite(state.jungleBoss.respawnTimer) ? (
            <G opacity={state.jungleBoss.alive ? 1 : 0.34}>
              <Rect
                x={state.jungleBoss.position.x - 30}
                y={state.jungleBoss.position.y - 30}
                width={60}
                height={60}
                fill={state.jungleBoss.alive ? '#130B25' : 'none'}
                stroke="#D9C2FF"
                strokeWidth={state.jungleBoss.alive ? 8 : 6}
                transform={`rotate(45 ${state.jungleBoss.position.x} ${state.jungleBoss.position.y})`}
              />
              <Rect
                x={state.jungleBoss.position.x - 20}
                y={state.jungleBoss.position.y - 20}
                width={40}
                height={40}
                fill={state.jungleBoss.alive ? '#9B5CFF' : 'none'}
                stroke={state.jungleBoss.alive ? '#F0E4FF' : '#9B5CFF'}
                strokeWidth={5}
                transform={`rotate(45 ${state.jungleBoss.position.x} ${state.jungleBoss.position.y})`}
              />
            </G>
          ) : null}
          {state.jungleCreatures.map((creature) => {
            const engaged = creature.alive && Boolean(creature.targetRef);
            const size = creature.kind === 'dragon' ? 34 : 26;
            return (
              <Rect
                key={creature.id}
                x={creature.position.x - size / 2}
                y={creature.position.y - size / 2}
                width={size}
                height={size}
                fill={creature.alive ? (creature.kind === 'dragon' ? '#9B5CFF' : '#23613E') : 'none'}
                stroke={engaged ? '#FFD36A' : creature.kind === 'dragon' ? '#D9C2FF' : '#7CFFB0'}
                strokeWidth={engaged ? 8 : creature.alive ? 5 : 4}
                opacity={engaged ? 1 : creature.alive ? 0.92 : 0.28}
                transform={`rotate(45 ${creature.position.x} ${creature.position.y})`}
              />
            );
          })}
          {state.powerUps.map((powerUp) => powerUp.active ? (
            <Circle
              key={powerUp.id}
              cx={powerUp.position.x}
              cy={powerUp.position.y}
              r={powerUp.kind === 'shield' ? 22 : 18}
              fill={powerUp.kind === 'shield' ? '#88EEFF' : '#FFD36A'}
              stroke={TEAM_COLORS[powerUp.team].main}
              strokeWidth={5}
              opacity={0.95}
            />
          ) : null)}
          <Rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#02080A" opacity={0.24} />
          <Circle cx={state.heroes.player.position.x} cy={state.heroes.player.position.y} r={VISION_RADIUS} fill="#A9F4FF" opacity={0.08} />
          <Circle cx={state.heroes.player.position.x} cy={state.heroes.player.position.y} r={INNER_VISION_RADIUS} fill="#EAF8F5" opacity={0.055} />
          <Circle cx={state.heroes.player.position.x} cy={state.heroes.player.position.y} r={VISION_RADIUS} fill="none" stroke="#A9F4FF" strokeWidth={6} opacity={0.26} />
          <Circle cx={state.heroes.player.position.x} cy={state.heroes.player.position.y} r={INNER_VISION_RADIUS} fill="none" stroke="#EAF8F5" strokeWidth={4} opacity={0.18} />
          <Circle cx={state.heroes.player.position.x} cy={state.heroes.player.position.y} r={28} fill="#FFFFFF" />
          <Circle cx={state.heroes.enemy.position.x} cy={state.heroes.enemy.position.y} r={25} fill={TEAM_COLORS.red.main} />
          <Rect
            x={visible.x}
            y={visible.y}
            width={visible.width}
            height={visible.height}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={8}
            opacity={0.82}
          />
        </G>
      </Canvas>
    </View>
  );
}

function WebMiniMapFallback({ state, visible }: { state: GameState; visible: ReturnType<typeof getVisibleWorldRect> }) {
  return (
    <View style={styles.container}>
      <View style={styles.webMap}>
        <View style={[styles.webLane, styles.webLaneTop]} />
        <View style={[styles.webLane, styles.webLaneMiddle]} />
        <View style={[styles.webLane, styles.webLaneBottom]} />
        {state.structures.map((structure) => (
          <View
            key={structure.id}
            style={[
              styles.webStructure,
              {
                left: structure.position.x * MINIMAP_SCALE_X - 3,
                top: structure.position.y * MINIMAP_SCALE_Y - 3,
                backgroundColor: TEAM_COLORS[structure.team].main,
                opacity: structure.alive ? 1 : 0.28,
              },
            ]}
          />
        ))}
        {state.jungleCreatures.map((creature) => (
          <View
            key={creature.id}
            style={[
              styles.webCreature,
              {
                left: creature.position.x * MINIMAP_SCALE_X - 2.5,
                top: creature.position.y * MINIMAP_SCALE_Y - 2.5,
                backgroundColor: creature.kind === 'dragon' ? '#9B5CFF' : '#7CFFB0',
                opacity: creature.alive ? 0.9 : 0.25,
              },
            ]}
          />
        ))}
        {state.powerUps.map((powerUp) => powerUp.active ? (
          <View
            key={powerUp.id}
            style={[
              styles.webPowerUp,
              {
                left: powerUp.position.x * MINIMAP_SCALE_X - 3,
                top: powerUp.position.y * MINIMAP_SCALE_Y - 3,
                backgroundColor: powerUp.kind === 'shield' ? '#88EEFF' : '#FFD36A',
                borderColor: TEAM_COLORS[powerUp.team].main,
              },
            ]}
          />
        ) : null)}
        <View
          style={[
            styles.webViewport,
            {
              left: visible.x * MINIMAP_SCALE_X,
              top: visible.y * MINIMAP_SCALE_Y,
              width: Math.max(8, visible.width * MINIMAP_SCALE_X),
              height: Math.max(6, visible.height * MINIMAP_SCALE_Y),
            },
          ]}
        />
        <View
          style={[
            styles.webHeroDot,
            {
              left: state.heroes.player.position.x * MINIMAP_SCALE_X - 4,
              top: state.heroes.player.position.y * MINIMAP_SCALE_Y - 4,
              backgroundColor: '#FFFFFF',
            },
          ]}
        />
        <View
          style={[
            styles.webHeroDot,
            {
              left: state.heroes.enemy.position.x * MINIMAP_SCALE_X - 4,
              top: state.heroes.enemy.position.y * MINIMAP_SCALE_Y - 4,
              backgroundColor: TEAM_COLORS.red.main,
            },
          ]}
        />
      </View>
    </View>
  );
}

const MemoMiniMapStaticLayer = memo(MiniMapStaticLayer);

function MiniMapStaticLayer() {
  return (
    <G>
      <Rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#173D2D" />
      {JUNGLE_PATCHES.map((patch, index) => (
        <Ellipse
          key={`jungle-${index}`}
          cx={patch.x}
          cy={patch.y}
          rx={patch.rx}
          ry={patch.ry}
          fill={index % 2 === 0 ? '#23613E' : '#28744A'}
          opacity={0.78}
        />
      ))}
      {Object.entries(LANE_RENDER_PATHS).map(([lane, path]) => (
        <Path key={lane} d={path.road} stroke="#C7B27F" strokeWidth={28} strokeLinecap="round" fill="none" opacity={0.82} />
      ))}
      {JUNGLE_CONNECTOR_RENDER_PATHS.map((path) => (
        <Path key={path.id} d={path.road} stroke="#A88C61" strokeWidth={18} strokeLinecap="round" fill="none" opacity={0.58} />
      ))}
    </G>
  );
}

const styles = StyleSheet.create({
  container: {
    width: MINIMAP_WIDTH,
    height: MINIMAP_HEIGHT,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.28)',
    backgroundColor: COLORS.fieldDark,
  },
  canvas: {
    ...StyleSheet.absoluteFillObject,
  },
  webMap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#173D2D',
  },
  webLane: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(199,178,127,0.8)',
  },
  webLaneTop: {
    top: 13,
    transform: [{ rotate: '-7deg' }],
  },
  webLaneMiddle: {
    top: Math.round(MINIMAP_HEIGHT / 2) - 2,
  },
  webLaneBottom: {
    bottom: 13,
    transform: [{ rotate: '7deg' }],
  },
  webStructure: {
    position: 'absolute',
    width: 6,
    height: 6,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1,
    borderColor: '#EAF8F5',
  },
  webCreature: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  webPowerUp: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
  },
  webViewport: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  webHeroDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.6)',
  },
});
