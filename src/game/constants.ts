import type { AbilityId, LaneId, Team } from './types';

export const MAP_WIDTH = 4200;
export const MAP_HEIGHT = 2700;
const MAP_CENTER_Y = MAP_HEIGHT / 2;
const LANE_EDGE_OFFSET = 480;

export const LANES: LaneId[] = ['top', 'middle', 'bottom'];

export const LANE_Y: Record<LaneId, number> = {
  top: LANE_EDGE_OFFSET,
  middle: MAP_CENTER_Y,
  bottom: MAP_HEIGHT - LANE_EDGE_OFFSET,
};

export const TEAM_DIRECTION: Record<Team, 1 | -1> = {
  blue: 1,
  red: -1,
};

export const TEAM_COLORS: Record<Team, { main: string; soft: string; dark: string; glow: string }> = {
  blue: {
    main: '#3DE5FF',
    soft: '#9CEEFF',
    dark: '#12677B',
    glow: 'rgba(61,229,255,0.44)',
  },
  red: {
    main: '#FF5533',
    soft: '#FFB096',
    dark: '#802C1C',
    glow: 'rgba(255,85,51,0.42)',
  },
};

export const COLORS = {
  void: '#071112',
  field: '#1B4B36',
  fieldDark: '#102D22',
  lane: '#9B8F73',
  laneEdge: '#47513F',
  stone: '#8C887B',
  brush: '#1B5E3D',
  brushDark: '#12402C',
  water: '#0E3848',
  panel: 'rgba(5, 12, 17, 0.72)',
  panelStrong: 'rgba(6, 16, 22, 0.9)',
  text: '#EAF8F5',
  mutedText: '#9CB7B2',
  warning: '#FFD36A',
  shadow: 'rgba(0,0,0,0.28)',
};

export const ABILITY_LABELS: Record<AbilityId, string> = {
  bolt: 'Bolt',
  dash: 'Dash',
  pulse: 'Heal',
  fireball: 'Fireball',
  shield: 'Shield',
  chain: 'Chain',
  trap: 'Trap',
  ult: 'Storm',
};

export const BASE_POSITIONS: Record<Team, { x: number; y: number }> = {
  blue: { x: 200, y: MAP_CENTER_Y },
  red: { x: 4000, y: MAP_CENTER_Y },
};

export const HERO_START: Record<Team, { x: number; y: number }> = {
  blue: { x: 380, y: MAP_CENTER_Y },
  red: { x: 3820, y: MAP_CENTER_Y },
};

export const SIMULATION = {
  maxDelta: 0.033,
  respawnSeconds: 8,
  minionCleanupPadding: 90,
};

export const ENTITY_LIMITS = {
  minions: 84,
  projectiles: 48,
  traps: 24,
  effects: 36,
  chainArcs: 26,
  warnings: 24,
  floatingText: 12,
};
