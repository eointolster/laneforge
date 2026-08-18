import type { ReactNode } from 'react';
import { Circle, Ellipse, G, Line, Path } from './skiaElements';

import { projectedScale, worldToScreen } from '@/game/camera';
import { TEAM_COLORS } from '@/game/constants';
import type { CameraState, GameState, Point, PowerUp, TargetRef } from '@/game/types';
import { getRenderBounds, isPositionedInRenderBounds } from '@/performance/renderBudget';
import { JungleBossView, JungleCreatureView, TrapView } from './drawObjectives';
import { ProjectileView } from './drawProjectiles';
import { StructureView } from './drawStructures';
import { HeroView, MinionView } from './drawUnits';

type DrawEntitiesProps = {
  state: GameState;
  camera: CameraState;
};

export function DrawEntities({ state, camera }: DrawEntitiesProps) {
  const bounds = getRenderBounds(camera);
  const worldObjects: { id: string; y: number; node: ReactNode }[] = [];
  const groundNodes: ReactNode[] = [];
  const projectileNodes: ReactNode[] = [];

  for (const projectile of state.projectiles) {
    if (!isPositionedInRenderBounds(projectile, bounds, 120)) continue;
    projectileNodes.push(<ProjectileView key={projectile.id} camera={camera} projectile={projectile} />);
  }

  for (const trap of state.traps) {
    if (!isPositionedInRenderBounds(trap, bounds, 150)) continue;
    groundNodes.push(<TrapView key={trap.id} camera={camera} trap={trap} time={state.time} />);
  }

  for (const powerUp of state.powerUps) {
    if (!powerUp.active) continue;
    if (!isPositionedInRenderBounds(powerUp, bounds, 150)) continue;
    groundNodes.push(<PowerUpView key={powerUp.id} camera={camera} powerUp={powerUp} time={state.time} />);
  }

  const playerTarget = resolveFallbackTarget(state, state.heroes.player.lastTargetRef);
  const targetAge = state.time - state.heroes.player.lastTargetTime;
  if (playerTarget && targetAge >= 0 && targetAge <= 0.85) {
    groundNodes.push(
      <PlayerTargetRing
        key="player-target-ring"
        camera={camera}
        heroPosition={state.heroes.player.position}
        target={playerTarget}
        age={targetAge}
      />,
    );
  }

  for (const structure of state.structures) {
    worldObjects.push({
      id: structure.id,
      y: structure.position.y,
      node: <StructureView key={structure.id} camera={camera} structure={structure} version={`${structure.hp}:${structure.alive}`} />,
    });
  }

  if (state.jungleBoss && (state.jungleBoss.alive || state.time - state.jungleBoss.deathTime < 0.9)) {
    if (isPositionedInRenderBounds(state.jungleBoss, bounds, 340)) {
      worldObjects.push({
        id: state.jungleBoss.id,
        y: state.jungleBoss.position.y,
        node: <JungleBossView key={state.jungleBoss.id} camera={camera} boss={state.jungleBoss} time={state.time} />,
      });
    }
  }

  for (const creature of state.jungleCreatures) {
    if (!creature.alive && state.time - creature.deathTime >= 0.8) continue;
    if (!isPositionedInRenderBounds(creature, bounds, 240)) continue;
    const target = creature.kind === 'dragon' ? resolveFallbackTarget(state, creature.targetRef) : null;
    worldObjects.push({
      id: creature.id,
      y: creature.position.y,
      node: <JungleCreatureView key={creature.id} camera={camera} creature={creature} target={target} time={state.time} />,
    });
  }

  for (const minion of state.minions) {
    if (!isPositionedInRenderBounds(minion, bounds, 130)) continue;
    worldObjects.push({
      id: minion.id,
      y: minion.position.y,
      node: <MinionView key={minion.id} camera={camera} minion={minion} time={state.time} />,
    });
  }

  if (isPositionedInRenderBounds(state.heroes.enemy, bounds, 220)) {
    worldObjects.push({
      id: state.heroes.enemy.id,
      y: state.heroes.enemy.position.y,
      node: <HeroView key={state.heroes.enemy.id} camera={camera} hero={state.heroes.enemy} isPlayer={false} time={state.time} />,
    });
  }

  worldObjects.push({
    id: state.heroes.player.id,
    y: state.heroes.player.position.y,
    node: <HeroView key={state.heroes.player.id} camera={camera} hero={state.heroes.player} isPlayer time={state.time} />,
  });

  worldObjects.sort((a, b) => a.y - b.y);

  return (
    <G>
      {groundNodes}
      {projectileNodes}
      {worldObjects.map((item) => item.node)}
    </G>
  );
}

function PowerUpView({ camera, powerUp, time }: { camera: CameraState; powerUp: PowerUp; time: number }) {
  const point = worldToScreen(camera, powerUp.position);
  const scale = projectedScale(camera);
  const radius = powerUp.radius * scale;
  const teamColor = TEAM_COLORS[powerUp.team].soft;
  const pulse = 0.74 + Math.sin(time * (powerUp.kind === 'speed' ? 7.4 : 4.2) + powerUp.position.x * 0.01) * 0.12;
  const mainColor = powerUp.kind === 'shield' ? '#88EEFF' : '#FFD36A';

  return (
    <G opacity={0.92}>
      <Ellipse cx={point.x} cy={point.y + radius * 0.08} rx={radius * (1.38 + pulse * 0.18)} ry={radius * (0.72 + pulse * 0.08)} fill={mainColor} opacity={0.12} />
      <Ellipse cx={point.x} cy={point.y + radius * 0.08} rx={radius * 1.26} ry={radius * 0.66} fill="none" stroke={teamColor} strokeWidth={2.4 * scale} opacity={0.64} />
      {powerUp.kind === 'shield' ? (
        <>
          <Circle cx={point.x} cy={point.y - radius * 0.36} r={radius * 0.62} fill="#88EEFF" opacity={0.22} />
          <Circle cx={point.x} cy={point.y - radius * 0.36} r={radius * 0.46} fill="none" stroke="#D8FBFF" strokeWidth={3 * scale} opacity={0.86} />
          <Circle cx={point.x + radius * 0.14} cy={point.y - radius * 0.5} r={radius * 0.12} fill="#FFFFFF" opacity={0.78} />
        </>
      ) : (
        <Path
          d={`M${point.x + radius * 0.16} ${point.y - radius * 1.0} L${point.x - radius * 0.44} ${point.y - radius * 0.06} L${point.x - radius * 0.06} ${point.y - radius * 0.02} L${point.x - radius * 0.34} ${point.y + radius * 0.88} L${point.x + radius * 0.56} ${point.y - radius * 0.28} L${point.x + radius * 0.12} ${point.y - radius * 0.32} Z`}
          fill="#FFD36A"
          stroke="#FFF7D6"
          strokeWidth={1.6 * scale}
          opacity={0.92}
        />
      )}
    </G>
  );
}

function PlayerTargetRing({
  camera,
  heroPosition,
  target,
  age,
}: {
  camera: CameraState;
  heroPosition: Point;
  target: { position: Point; radius: number };
  age: number;
}) {
  const heroPoint = worldToScreen(camera, heroPosition);
  const targetPoint = worldToScreen(camera, target.position);
  const scale = projectedScale(camera);
  const opacity = Math.max(0, 1 - age / 0.85);
  const radius = Math.max(12, target.radius * scale * 1.72);

  return (
    <G opacity={opacity * 0.7}>
      <Line
        x1={heroPoint.x}
        y1={heroPoint.y}
        x2={targetPoint.x}
        y2={targetPoint.y}
        stroke={TEAM_COLORS.blue.soft}
        strokeWidth={3 * scale}
        strokeLinecap="round"
        opacity={0.32}
      />
      <Ellipse
        cx={targetPoint.x}
        cy={targetPoint.y + radius * 0.06}
        rx={radius}
        ry={radius * 0.52}
        fill="none"
        stroke={TEAM_COLORS.blue.soft}
        strokeWidth={3 * scale}
        opacity={0.8}
      />
      <Ellipse
        cx={targetPoint.x}
        cy={targetPoint.y + radius * 0.06}
        rx={radius * 0.58}
        ry={radius * 0.3}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.2 * scale}
        opacity={0.42}
      />
    </G>
  );
}

function resolveFallbackTarget(state: GameState, ref: TargetRef | null): { position: Point; radius: number } | null {
  if (!ref) return null;

  if (ref.kind === 'hero') {
    const hero = ref.id === state.heroes.player.id ? state.heroes.player : state.heroes.enemy;
    if (hero.hp <= 0 || hero.respawnTimer > 0) return null;
    return { position: hero.position, radius: hero.radius };
  }

  if (ref.kind === 'minion') {
    const minion = state.minions.find((candidate) => candidate.id === ref.id && !candidate.dead && candidate.hp > 0);
    return minion ? { position: minion.position, radius: minion.radius } : null;
  }

  if (ref.kind === 'structure') {
    const structure = state.structures.find((candidate) => candidate.id === ref.id && candidate.alive && candidate.hp > 0);
    return structure ? { position: structure.position, radius: structure.radius } : null;
  }

  if (ref.kind === 'jungle') {
    const creature = state.jungleCreatures.find((candidate) => candidate.id === ref.id && candidate.alive && candidate.hp > 0);
    return creature ? { position: creature.position, radius: creature.radius } : null;
  }

  const boss = state.jungleBoss;
  if (!boss || !boss.alive || boss.hp <= 0) return null;
  return { position: boss.position, radius: boss.radius };
}
