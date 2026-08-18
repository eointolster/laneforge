import { LANE_Y, MAP_WIDTH } from '../constants';
import type { LaneId, Point, Team } from '../types';

export const LANE_START_X = 340;
export const LANE_END_X = MAP_WIDTH - 340;

export type LanePath = {
  id: LaneId;
  points: Point[];
};

export type JungleConnector = {
  id: string;
  start: Point;
  controlA: Point;
  controlB: Point;
  end: Point;
};

export const LANE_PATHS: Record<LaneId, LanePath> = {
  top: {
    id: 'top',
    points: [
      { x: LANE_START_X, y: LANE_Y.top },
      { x: LANE_END_X, y: LANE_Y.top },
    ],
  },
  middle: {
    id: 'middle',
    points: [
      { x: LANE_START_X, y: LANE_Y.middle },
      { x: LANE_END_X, y: LANE_Y.middle },
    ],
  },
  bottom: {
    id: 'bottom',
    points: [
      { x: LANE_START_X, y: LANE_Y.bottom },
      { x: LANE_END_X, y: LANE_Y.bottom },
    ],
  },
};

export const LANE_RENDER_PATHS: Record<LaneId, { road: string; center: string }> = {
  top: {
    road: sampledLanePath('top'),
    center: sampledLanePath('top', 18),
  },
  middle: {
    road: sampledLanePath('middle'),
    center: sampledLanePath('middle', 18),
  },
  bottom: {
    road: sampledLanePath('bottom'),
    center: sampledLanePath('bottom', 18),
  },
};

export const JUNGLE_CONNECTORS: JungleConnector[] = [
  connector('blue-top-mid', 1060, 'top', 1480, 'middle', -140, -110),
  connector('blue-mid-bottom', 1120, 'middle', 1540, 'bottom', 120, 140),
  connector('red-top-mid', 2720, 'middle', 3140, 'top', -110, -150),
  connector('red-mid-bottom', 2660, 'bottom', 3080, 'middle', 140, 100),
];

export const JUNGLE_CONNECTOR_RENDER_PATHS = JUNGLE_CONNECTORS.map((connectorPath) => ({
  id: connectorPath.id,
  road: sampledConnectorPath(connectorPath),
  center: sampledConnectorPath(connectorPath, 16),
}));

export function getLaneYAtX(lane: LaneId, x: number) {
  const t = Math.max(0, Math.min(1, (x - LANE_START_X) / (LANE_END_X - LANE_START_X)));
  const arch = Math.sin(t * Math.PI);
  const sweep = Math.sin((t - 0.5) * Math.PI) * arch;
  const ripple = Math.sin((t - 0.12) * Math.PI * 2) * arch;

  if (lane === 'top') {
    return LANE_Y.top - arch * 232 + sweep * 62 + ripple * 8;
  }

  if (lane === 'bottom') {
    return LANE_Y.bottom + arch * 232 + sweep * 62 - ripple * 8;
  }

  return LANE_Y.middle + sweep * 34 + ripple * 8;
}

function sampledLanePath(lane: LaneId, inset = 0) {
  const steps = 28;
  const start = LANE_START_X + inset;
  const end = LANE_END_X - inset;
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const x = start + (end - start) * t;
    return `${index === 0 ? 'M' : 'L'}${Math.round(x)} ${Math.round(getLaneYAtX(lane, x))}`;
  });

  return points.join(' ');
}

function connector(
  id: string,
  startX: number,
  startLane: LaneId,
  endX: number,
  endLane: LaneId,
  controlAOffsetY: number,
  controlBOffsetY: number,
): JungleConnector {
  const start = { x: startX, y: getLaneYAtX(startLane, startX) };
  const end = { x: endX, y: getLaneYAtX(endLane, endX) };

  return {
    id,
    start,
    controlA: {
      x: start.x + (end.x - start.x) * 0.34,
      y: start.y + (end.y - start.y) * 0.28 + controlAOffsetY,
    },
    controlB: {
      x: start.x + (end.x - start.x) * 0.72,
      y: start.y + (end.y - start.y) * 0.74 + controlBOffsetY,
    },
    end,
  };
}

function sampledConnectorPath(path: JungleConnector, inset = 0) {
  const steps = 18;
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const point = cubicPoint(path, t);
    return `${index === 0 ? 'M' : 'L'}${Math.round(point.x + inset * (t - 0.5))} ${Math.round(point.y)}`;
  });

  return points.join(' ');
}

export function cubicPoint(path: JungleConnector, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * path.start.x + 3 * u * u * t * path.controlA.x + 3 * u * t * t * path.controlB.x + t * t * t * path.end.x,
    y: u * u * u * path.start.y + 3 * u * u * t * path.controlA.y + 3 * u * t * t * path.controlB.y + t * t * t * path.end.y,
  };
}

export function laneSpawnPoint(team: Team, lane: LaneId, waveIndex: number): Point {
  const direction = team === 'blue' ? 1 : -1;
  const stagger = ((waveIndex % 3) - 1) * 16;
  return {
    x: team === 'blue' ? LANE_START_X - waveIndex * 30 : LANE_END_X + waveIndex * 30,
    y: getLaneYAtX(lane, team === 'blue' ? LANE_START_X : LANE_END_X) + direction * stagger,
  };
}

export function laneGoalX(team: Team) {
  return team === 'blue' ? LANE_END_X + 36 : LANE_START_X - 36;
}
