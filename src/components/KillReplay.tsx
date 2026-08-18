import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@shopify/react-native-skia';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS, MAP_HEIGHT, MAP_WIDTH, TEAM_COLORS } from '@/game/constants';
import { LANE_RENDER_PATHS } from '@/game/map/lanePaths';
import type { Team } from '@/game/types';
import { Circle, G, Path, Rect } from '@/rendering/skiaElements';

export type KillReplayFrame = {
  capturedAt: number;
  player: { x: number; y: number; hp: number };
  enemy: { x: number; y: number; hp: number };
  minions: Array<{ id: string; team: Team; x: number; y: number }>;
  projectiles: Array<{ id: string; team: Team; x: number; y: number }>;
};

export type KillReplayData = {
  id: string;
  team: Team;
  frames: KillReplayFrame[];
};

type KillReplayProps = {
  replay: KillReplayData | null;
  onComplete: () => void;
};

const REPLAY_WIDTH = 168;
const REPLAY_HEIGHT = Math.round((REPLAY_WIDTH * MAP_HEIGHT) / MAP_WIDTH);
const REPLAY_SCALE_X = REPLAY_WIDTH / MAP_WIDTH;
const REPLAY_SCALE_Y = REPLAY_HEIGHT / MAP_HEIGHT;

export function KillReplay({ replay, onComplete }: KillReplayProps) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    setFrameIndex(0);
    if (!replay) return undefined;

    const frameTimer = setInterval(() => {
      setFrameIndex((current) => Math.min(replay.frames.length - 1, current + 1));
    }, 180);
    const closeTimer = setTimeout(onComplete, 4200);

    return () => {
      clearInterval(frameTimer);
      clearTimeout(closeTimer);
    };
  }, [onComplete, replay]);

  const frame = useMemo(() => {
    if (!replay || replay.frames.length === 0) return null;
    return replay.frames[Math.min(frameIndex, replay.frames.length - 1)];
  }, [frameIndex, replay]);

  if (!replay || !frame) return null;

  const playerDown = frame.player.hp <= 0;
  const enemyDown = frame.enemy.hp <= 0;

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.header}>
        <View style={[styles.teamDot, { backgroundColor: TEAM_COLORS[replay.team].main }]} />
        <Text style={styles.title}>REPLAY</Text>
        <Text style={styles.subtitle}>Champion slain</Text>
      </View>
      <Canvas style={styles.canvas}>
        <G transform={`scale(${REPLAY_SCALE_X} ${REPLAY_SCALE_Y})`}>
          <Rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#0B2119" />
          {Object.entries(LANE_RENDER_PATHS).map(([lane, path]) => (
            <Path key={lane} d={path.road} stroke={COLORS.lane} strokeWidth={34} strokeLinecap="round" fill="none" opacity={0.74} />
          ))}
          <G opacity={0.78}>
            {frame.minions.map((minion) => (
              <Rect
                key={minion.id}
                x={minion.x - 10}
                y={minion.y - 10}
                width={20}
                height={20}
                fill={TEAM_COLORS[minion.team].main}
              />
            ))}
          </G>
          <G opacity={0.92}>
            {frame.projectiles.map((projectile) => (
              <Circle
                key={projectile.id}
                cx={projectile.x}
                cy={projectile.y}
                r={14}
                fill={TEAM_COLORS[projectile.team].soft}
              />
            ))}
          </G>
          <Circle cx={frame.player.x} cy={frame.player.y} r={playerDown ? 42 : 34} fill={playerDown ? '#FFFFFF' : TEAM_COLORS.blue.main} opacity={playerDown ? 0.62 : 1} />
          <Circle cx={frame.enemy.x} cy={frame.enemy.y} r={enemyDown ? 42 : 34} fill={enemyDown ? '#FFFFFF' : TEAM_COLORS.red.main} opacity={enemyDown ? 0.62 : 1} />
          <Circle cx={frame.player.x} cy={frame.player.y} r={72} fill="none" stroke={TEAM_COLORS.blue.soft} strokeWidth={8} opacity={0.45} />
          <Circle cx={frame.enemy.x} cy={frame.enemy.y} r={72} fill="none" stroke={TEAM_COLORS.red.soft} strokeWidth={8} opacity={0.45} />
        </G>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 18,
    bottom: 176,
    width: REPLAY_WIDTH,
    height: REPLAY_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.34)',
    backgroundColor: 'rgba(5,12,17,0.82)',
  },
  canvas: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    position: 'absolute',
    zIndex: 2,
    top: 0,
    left: 0,
    right: 0,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(5,12,17,0.78)',
  },
  teamDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  title: {
    color: COLORS.warning,
    fontSize: 10,
    fontWeight: '900',
  },
  subtitle: {
    color: COLORS.mutedText,
    fontSize: 8,
    fontWeight: '900',
    marginLeft: 'auto',
  },
});
