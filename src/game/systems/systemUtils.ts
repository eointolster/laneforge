import type { EffectKind, GameEvent, GameState, Point, Team, WarningKind } from '../types';
import { BASE_POSITIONS, ENTITY_LIMITS, MAP_HEIGHT, MAP_WIDTH, TEAM_COLORS } from '../constants';
import { clampToMap } from '@/utils/math';

export function makeId(state: GameState, prefix: string) {
  state.nextId += 1;
  return `${prefix}-${state.nextId}`;
}

export function otherTeam(team: Team): Team {
  return team === 'blue' ? 'red' : 'blue';
}

export function pushEffect(
  state: GameState,
  kind: EffectKind,
  position: Point,
  radius: number,
  ttl: number,
  color: string,
) {
  if (!isFinitePoint(position)) return;
  const safeRadius = sanitizeVisualNumber(radius, 1, Math.max(MAP_WIDTH, MAP_HEIGHT) * 0.25);
  const safeTtl = sanitizeVisualNumber(ttl, 0.05, 3);
  if (safeRadius === null || safeTtl === null) return;

  state.effects.push({
    id: makeId(state, kind),
    kind,
    position: { ...position },
    radius: safeRadius,
    ttl: safeTtl,
    maxTtl: safeTtl,
    color,
  });
  if (state.effects.length > ENTITY_LIMITS.effects) {
    state.effects = state.effects.slice(state.effects.length - ENTITY_LIMITS.effects);
  }
}

export function pushChainArc(state: GameState, team: Team, start: Point, end: Point, ttl: number, color: string) {
  if (!isFinitePoint(start) || !isFinitePoint(end)) return;
  const safeTtl = sanitizeVisualNumber(ttl, 0.05, 1.5);
  if (safeTtl === null) return;

  state.chainArcs.push({
    id: makeId(state, 'chain-arc'),
    team,
    start: { ...start },
    end: { ...end },
    ttl: safeTtl,
    maxTtl: safeTtl,
    color,
  });

  if (state.chainArcs.length > ENTITY_LIMITS.chainArcs) {
    state.chainArcs = state.chainArcs.slice(state.chainArcs.length - ENTITY_LIMITS.chainArcs);
  }
}

export function pushWarning(
  state: GameState,
  kind: WarningKind,
  team: Team,
  sourcePosition: Point,
  targetPosition: Point,
  radius: number,
  ttl: number,
  color: string,
) {
  if (!isFinitePoint(sourcePosition) || !isFinitePoint(targetPosition)) return;
  const safeRadius = sanitizeVisualNumber(radius, 6, Math.max(MAP_WIDTH, MAP_HEIGHT) * 0.16);
  const safeTtl = sanitizeVisualNumber(ttl, 0.05, 1.2);
  if (safeRadius === null || safeTtl === null) return;

  state.warnings.push({
    id: makeId(state, 'warning'),
    kind,
    team,
    sourcePosition: { ...sourcePosition },
    targetPosition: { ...targetPosition },
    radius: safeRadius,
    ttl: safeTtl,
    maxTtl: safeTtl,
    color,
  });

  if (state.warnings.length > ENTITY_LIMITS.warnings) {
    state.warnings = state.warnings.slice(state.warnings.length - ENTITY_LIMITS.warnings);
  }
}

export function pushFloatingText(state: GameState, text: string, position: Point, team?: Team, colorOverride?: string, size: 'small' | 'normal' | 'large' = 'normal') {
  if (!isFinitePoint(position)) return;

  const spawnPosition = {
    x: position.x,
    y: position.y - 22,
  };
  const nearby = state.floatingText.filter((candidate) => {
    const dx = candidate.position.x - spawnPosition.x;
    const dy = candidate.position.y - spawnPosition.y;
    return dx * dx + dy * dy <= 34 * 34 && candidate.ttl > 0.45;
  });

  if (nearby.length >= 2) {
    const target = nearby[nearby.length - 1];
    target.text = mergeFloatingText(target.text, text);
    target.ttl = Math.max(target.ttl, 0.9);
    target.color = colorOverride ?? (team ? TEAM_COLORS[team].soft : target.color);
    target.size = target.size === 'large' || size === 'large' ? 'large' : target.size ?? size;
    return;
  }

  state.floatingText.push({
    id: makeId(state, 'text'),
    text,
    position: spawnPosition,
    ttl: 0.9,
    color: colorOverride ?? (team ? TEAM_COLORS[team].soft : '#F4FAF8'),
    size,
  });
  if (state.floatingText.length > ENTITY_LIMITS.floatingText) {
    state.floatingText = state.floatingText.slice(state.floatingText.length - ENTITY_LIMITS.floatingText);
  }
}

function mergeFloatingText(current: string, next: string) {
  const currentNumber = parsePlainNumber(current);
  const nextNumber = parsePlainNumber(next);
  if (currentNumber !== null && nextNumber !== null) {
    const prefix = current.startsWith('+') || next.startsWith('+') ? '+' : '';
    return `${prefix}${currentNumber + nextNumber}`;
  }
  return next.length > current.length ? next : current;
}

function parsePlainNumber(value: string) {
  const match = value.match(/^(\+?)(\d+)$/);
  return match ? Number.parseInt(match[2], 10) : null;
}

export function pushGameEvent(state: GameState, kind: GameEvent['kind'], team: Team, message: string) {
  state.events.push({
    id: makeId(state, 'event'),
    kind,
    team,
    message,
    time: state.time,
  });

  if (state.events.length > 12) {
    state.events = state.events.slice(state.events.length - 12);
  }
}

export function updateTransientVisuals(state: GameState, dt: number) {
  for (const effect of state.effects) {
    effect.ttl -= dt;
  }
  for (const arc of state.chainArcs) {
    arc.ttl -= dt;
  }
  for (const warning of state.warnings) {
    warning.ttl -= dt;
  }
  for (const text of state.floatingText) {
    text.ttl -= dt;
    text.position.y -= dt * 26;
  }

  state.effects = state.effects.filter((effect) => (
    effect.ttl > 0 &&
    Number.isFinite(effect.ttl) &&
    Number.isFinite(effect.maxTtl) &&
    Number.isFinite(effect.radius) &&
    effect.radius > 0
  ));
  state.chainArcs = state.chainArcs.filter((arc) => (
    arc.ttl > 0 &&
    Number.isFinite(arc.ttl) &&
    Number.isFinite(arc.maxTtl)
  ));
  state.warnings = state.warnings.filter((warning) => (
    warning.ttl > 0 &&
    Number.isFinite(warning.ttl) &&
    Number.isFinite(warning.maxTtl) &&
    Number.isFinite(warning.radius)
  ));
  state.floatingText = state.floatingText.filter((text) => text.ttl > 0 && Number.isFinite(text.ttl));
}

export function sanitizePositions(state: GameState) {
  sanitizeHeroPosition(state, state.heroes.player);
  sanitizeHeroPosition(state, state.heroes.enemy);

  for (const minion of state.minions) {
    if (!isFinitePoint(minion.position)) {
      minion.dead = true;
      minion.hp = 0;
      minion.deathTime = state.time;
      continue;
    }

    minion.position = clampToMap(minion.position, minion.radius);
  }

  for (const creature of state.jungleCreatures) {
    if (!isFinitePoint(creature.position)) {
      creature.position = { ...creature.homePosition };
      creature.targetRef = null;
      creature.facing = { x: 1, y: 0 };
      continue;
    }

    creature.position = clampToMap(creature.position, creature.radius);
  }

  state.powerUps = state.powerUps.filter((powerUp) => {
    if (!isFinitePoint(powerUp.position)) return false;
    powerUp.position = clampToMap(powerUp.position, powerUp.radius);
    return true;
  });

  state.projectiles = state.projectiles.filter((projectile) => {
    if (!isFinitePoint(projectile.position) || !isFinitePoint(projectile.velocity)) {
      return false;
    }

    projectile.position = clampToMap(projectile.position, projectile.radius);
    return true;
  });

  state.traps = state.traps.filter((trap) => {
    if (!isFinitePoint(trap.position)) return false;
    trap.position = clampToMap(trap.position, trap.radius);
    return true;
  });
  if (state.traps.length > ENTITY_LIMITS.traps) {
    state.traps = state.traps.slice(state.traps.length - ENTITY_LIMITS.traps);
  }

  state.effects = state.effects.filter((effect) => (
    isFinitePoint(effect.position) &&
    Number.isFinite(effect.radius) &&
    Number.isFinite(effect.ttl) &&
    Number.isFinite(effect.maxTtl)
  ));
  state.chainArcs = state.chainArcs.filter((arc) => (
    isFinitePoint(arc.start) &&
    isFinitePoint(arc.end) &&
    Number.isFinite(arc.ttl) &&
    Number.isFinite(arc.maxTtl)
  ));
  state.warnings = state.warnings.filter((warning) => (
    isFinitePoint(warning.sourcePosition) &&
    isFinitePoint(warning.targetPosition) &&
    Number.isFinite(warning.ttl) &&
    Number.isFinite(warning.maxTtl) &&
    Number.isFinite(warning.radius)
  ));
  state.floatingText = state.floatingText.filter((text) => isFinitePoint(text.position) && Number.isFinite(text.ttl));
}

function sanitizeHeroPosition(state: GameState, hero: GameState['heroes']['player']) {
  if (!isFinitePoint(hero.position)) {
    hero.position = { ...BASE_POSITIONS[hero.team] };
    hero.hp = Math.max(1, hero.hp);
    hero.intent = { x: 0, y: 0 };
    hero.facing = { x: hero.team === 'blue' ? 1 : -1, y: 0 };
    hero.dashTimer = 0;
    hero.dashVelocity = { x: 0, y: 0 };
    pushEffect(state, 'spawn', hero.position, 76, 0.4, TEAM_COLORS[hero.team].main);
    return;
  }

  hero.position = clampToMap(hero.position, hero.radius);
}

function isFinitePoint(point: Point) {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x > -MAP_WIDTH &&
    point.x < MAP_WIDTH * 2 &&
    point.y > -MAP_HEIGHT &&
    point.y < MAP_HEIGHT * 2
  );
}

function sanitizeVisualNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return null;
  return Math.max(min, Math.min(max, value));
}
