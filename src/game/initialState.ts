import { ABILITIES, BOSS_BALANCE, JUNGLE_CREATURE_BALANCE, POWERUP_BALANCE, WAVE_BALANCE } from './balance';
import { HERO_START, MAP_HEIGHT, MAP_WIDTH } from './constants';
import { getEnemyHeroClassForLevel, getHeroDefinition } from './heroes';
import { generateLevelConfig } from './levels';
import { createStructures } from './map/mapLayout';
import { ABILITY_ORDER, ABILITY_UNLOCK_LEVELS, DEFAULT_PROFILE, type PlayerProfile } from './playerProfile';
import { seededBetween, seededUnit } from '@/utils/random';
import type { AbilityId, GameState, Hero, HeroClassId, JungleCreature, JungleCreatureKind, LevelConfig, MatchGoal, Point, PowerUp, PowerUpKind, Team } from './types';

const JUNGLE_CREATURE_SPAWNS: Array<{ id: string; kind: JungleCreatureKind; position: Point }> = [
  { id: 'blue-north-bear', kind: 'bear', position: { x: MAP_WIDTH * 0.31, y: MAP_HEIGHT * 0.32 } },
  { id: 'blue-south-bear', kind: 'bear', position: { x: MAP_WIDTH * 0.32, y: MAP_HEIGHT * 0.69 } },
  { id: 'mid-north-dragon', kind: 'dragon', position: { x: MAP_WIDTH * 0.5, y: MAP_HEIGHT * 0.36 } },
  { id: 'mid-south-bear', kind: 'bear', position: { x: MAP_WIDTH * 0.52, y: MAP_HEIGHT * 0.68 } },
  { id: 'red-north-bear', kind: 'bear', position: { x: MAP_WIDTH * 0.69, y: MAP_HEIGHT * 0.32 } },
  { id: 'red-south-dragon', kind: 'dragon', position: { x: MAP_WIDTH * 0.7, y: MAP_HEIGHT * 0.69 } },
];

function cooldownRecord(): Record<AbilityId, number> {
  return {
    bolt: 0,
    dash: 0,
    pulse: 0,
    fireball: 0,
    shield: 0,
    chain: 0,
    trap: 0,
    ult: 0,
  };
}

function enemyAbilityLevelRecord(level: number): Record<AbilityId, number> {
  const campaignTierLevel = Math.max(1, Math.min(10, 1 + Math.floor((Math.max(1, level) - 1) / 10)));

  return ABILITY_ORDER.reduce((levels, ability) => {
    const unlockLevel = ABILITY_UNLOCK_LEVELS[ability];
    levels[ability] = level >= unlockLevel ? campaignTierLevel : 1;
    return levels;
  }, {} as Record<AbilityId, number>);
}

function createHero(team: Team, levelConfig: LevelConfig, profile: PlayerProfile = DEFAULT_PROFILE): Hero {
  const isPlayer = team === 'blue';
  const heroClass: HeroClassId = isPlayer ? profile.selectedHero : getEnemyHeroClassForLevel(levelConfig.level);
  const definition = getHeroDefinition(heroClass);
  const maxHp = Math.round(definition.stats.maxHp * (isPlayer ? 1 : levelConfig.enemyHpMultiplier));

  return {
    id: `${team}-hero`,
    team,
    heroClass,
    name: isPlayer ? profile.name.trim() || definition.name : definition.name,
    heroColor: definition.color,
    heroDesign: definition.design,
    abilityLevels: isPlayer ? { ...profile.abilityLevels } : enemyAbilityLevelRecord(levelConfig.level),
    position: { ...HERO_START[team] },
    radius: definition.stats.radius,
    hp: maxHp,
    maxHp,
    level: 1,
    xp: 0,
    gold: 0,
    attackCooldown: 0,
    warningTargetRef: null,
    warningTimer: 0,
    respawnTimer: 0,
    shield: 0,
    shieldTimer: 0,
    powerShield: 0,
    powerShieldMax: 0,
    attackSpeedBoostTimer: 0,
    cooldowns: cooldownRecord(),
    intent: { x: 0, y: 0 },
    facing: { x: isPlayer ? 1 : -1, y: 0 },
    lastAttackTime: -99,
    lastDamageTime: -99,
    lastCastTime: -99,
    lastCastAbility: null,
    deathTime: -99,
    dashTimer: 0,
    dashVelocity: { x: 0, y: 0 },
    dashImpactTimer: 0,
    dashImpactDamage: ABILITIES.dash.damage,
    channelTimer: 0,
    channelAbility: null,
    channelRadius: 0,
    channelDamage: 0,
    lastTargetRef: null,
    lastTargetTime: -99,
    bossBuffTimer: 0,
    bearBuffTimer: 0,
    dragonBuffTimer: 0,
    weaponBoostTimer: 0,
    rootTimer: 0,
  };
}

function createJungleCreatures(levelConfig: LevelConfig): JungleCreature[] {
  const hpScale = 1 + Math.min(0.75, (levelConfig.level - 1) * 0.012);
  const damageScale = 1 + Math.min(0.55, (levelConfig.level - 1) * 0.01);

  return JUNGLE_CREATURE_SPAWNS.map((spawn) => {
    const stats = JUNGLE_CREATURE_BALANCE[spawn.kind];
    const maxHp = Math.round(stats.maxHp * hpScale);

    return {
      id: spawn.id,
      kind: spawn.kind,
      position: { ...spawn.position },
      homePosition: { ...spawn.position },
      facing: { x: spawn.position.x < MAP_WIDTH / 2 ? 1 : -1, y: 0 },
      radius: stats.radius,
      hp: maxHp,
      maxHp,
      speed: stats.speed,
      damage: Math.round(stats.damage * damageScale),
      attackRange: stats.attackRange,
      aggroRange: stats.aggroRange,
      leashRange: stats.leashRange,
      attackCooldown: 0,
      warningTargetRef: null,
      warningTimer: 0,
      alive: true,
      respawnTimer: 0,
      lastAttackTime: -99,
      lastDamageTime: -99,
      targetRef: null,
      deathTime: -99,
      bountyXp: Math.round(stats.bountyXp * hpScale),
      bountyGold: stats.bountyGold,
    };
  });
}

function createMatchGoals(): MatchGoal[] {
  return [
    {
      id: 'jungle-clears',
      label: 'Clear 2 camps',
      progress: 0,
      target: 2,
      rewardGold: 60,
      rewardXp: 55,
      completed: false,
    },
    {
      id: 'top-tower',
      label: 'Break top tower',
      progress: 0,
      target: 1,
      rewardGold: 85,
      rewardXp: 75,
      completed: false,
    },
    {
      id: 'dragon-hunt',
      label: 'Defeat dragon',
      progress: 0,
      target: 1,
      rewardGold: 95,
      rewardXp: 95,
      completed: false,
    },
  ];
}

function createPowerUps(levelConfig: LevelConfig): PowerUp[] {
  const kinds: PowerUpKind[] = ['shield', 'speed'];
  const teams: Team[] = ['blue', 'red'];
  const sideRanges: Record<Team, { xMin: number; xMax: number }> = {
    blue: { xMin: MAP_WIDTH * 0.18, xMax: MAP_WIDTH * 0.43 },
    red: { xMin: MAP_WIDTH * 0.57, xMax: MAP_WIDTH * 0.82 },
  };

  return teams.flatMap((team, teamIndex) => kinds.map((kind, kindIndex) => {
    const seedBase = levelConfig.level * 100 + teamIndex * 20 + kindIndex * 7 + (kind === 'shield' ? 3 : 11);
    const upperHalf = seededUnit(seedBase) > 0.5;
    const yMin = upperHalf ? MAP_HEIGHT * 0.22 : MAP_HEIGHT * 0.58;
    const yMax = upperHalf ? MAP_HEIGHT * 0.42 : MAP_HEIGHT * 0.78;
    const range = sideRanges[team];

    return {
      id: `${team}-${kind}-powerup`,
      team,
      kind,
      position: {
        x: seededBetween(seedBase + 1, range.xMin, range.xMax),
        y: seededBetween(seedBase + 2, yMin, yMax),
      },
      radius: POWERUP_BALANCE.radius,
      active: true,
    };
  }));
}

export function createInitialState(levelConfig = generateLevelConfig(1), profile: PlayerProfile = DEFAULT_PROFILE): GameState {
  return {
    time: 0,
    nextId: 1,
    levelConfig,
    waveTimer: WAVE_BALANCE.firstDelay,
    waveNumber: 0,
    heroes: {
      player: createHero('blue', levelConfig, profile),
      enemy: createHero('red', levelConfig),
    },
    minions: [],
    structures: createStructures(levelConfig),
    jungleCreatures: createJungleCreatures(levelConfig),
    powerUps: createPowerUps(levelConfig),
    jungleBoss: {
      id: 'jungle-boss',
      position: { x: MAP_WIDTH / 2, y: MAP_HEIGHT * BOSS_BALANCE.spawnYRatio },
      radius: BOSS_BALANCE.radius,
      hp: Math.round(BOSS_BALANCE.baseHp * Math.max(1, levelConfig.bossHpMultiplier || 1)),
      maxHp: Math.round(BOSS_BALANCE.baseHp * Math.max(1, levelConfig.bossHpMultiplier || 1)),
      damage: BOSS_BALANCE.damage,
      attackRange: BOSS_BALANCE.attackRange,
      attackCooldown: 0,
      alive: false,
      respawnTimer: levelConfig.bossEnabled ? BOSS_BALANCE.spawnSeconds : Number.POSITIVE_INFINITY,
      lastAttackTime: -99,
      lastDamageTime: -99,
      targetRef: null,
      deathTime: -99,
    },
    projectiles: [],
    traps: [],
    effects: [],
    chainArcs: [],
    warnings: [],
    floatingText: [],
    matchGoals: createMatchGoals(),
    events: [],
    matchStats: {
      heroUsed: profile.selectedHero,
      damageDealt: 0,
      damageTaken: 0,
      towersDestroyed: 0,
    },
    teamKills: {
      blue: 0,
      red: 0,
    },
    heroDeaths: {
      blue: 0,
      red: 0,
    },
    winner: null,
    gameOverReason: null,
  };
}

export function cloneForRender(state: GameState): GameState {
  return {
    ...state,
    heroes: {
      player: {
        ...state.heroes.player,
        abilityLevels: { ...state.heroes.player.abilityLevels },
        position: { ...state.heroes.player.position },
        intent: { ...state.heroes.player.intent },
        facing: { ...state.heroes.player.facing },
        lastCastAbility: state.heroes.player.lastCastAbility,
        lastTargetRef: state.heroes.player.lastTargetRef ? { ...state.heroes.player.lastTargetRef } : null,
        warningTargetRef: state.heroes.player.warningTargetRef ? { ...state.heroes.player.warningTargetRef } : null,
      },
      enemy: {
        ...state.heroes.enemy,
        abilityLevels: { ...state.heroes.enemy.abilityLevels },
        position: { ...state.heroes.enemy.position },
        intent: { ...state.heroes.enemy.intent },
        facing: { ...state.heroes.enemy.facing },
        lastCastAbility: state.heroes.enemy.lastCastAbility,
        lastTargetRef: state.heroes.enemy.lastTargetRef ? { ...state.heroes.enemy.lastTargetRef } : null,
        warningTargetRef: state.heroes.enemy.warningTargetRef ? { ...state.heroes.enemy.warningTargetRef } : null,
      },
    },
    minions: state.minions.map((minion) => ({
      ...minion,
      position: { ...minion.position },
      facing: { ...minion.facing },
    })),
    structures: state.structures.map((structure) => ({
      ...structure,
      position: { ...structure.position },
      warningTargetRef: structure.warningTargetRef ? { ...structure.warningTargetRef } : null,
    })),
    jungleCreatures: state.jungleCreatures.map((creature) => ({
      ...creature,
      position: { ...creature.position },
      homePosition: { ...creature.homePosition },
      facing: { ...creature.facing },
      targetRef: creature.targetRef ? { ...creature.targetRef } : null,
      warningTargetRef: creature.warningTargetRef ? { ...creature.warningTargetRef } : null,
    })),
    powerUps: state.powerUps.map((powerUp) => ({
      ...powerUp,
      position: { ...powerUp.position },
    })),
    jungleBoss: state.jungleBoss ? {
      ...state.jungleBoss,
      position: { ...state.jungleBoss.position },
      targetRef: state.jungleBoss.targetRef ? { ...state.jungleBoss.targetRef } : null,
    } : null,
    projectiles: state.projectiles.map((projectile) => ({
      ...projectile,
      position: { ...projectile.position },
      velocity: { ...projectile.velocity },
      target: projectile.target ? { ...projectile.target } : undefined,
      hitRefs: projectile.hitRefs ? [...projectile.hitRefs] : undefined,
    })),
    traps: state.traps.map((trap) => ({ ...trap, position: { ...trap.position } })),
    effects: state.effects.map((effect) => ({ ...effect, position: { ...effect.position } })),
    chainArcs: state.chainArcs.map((arc) => ({
      ...arc,
      start: { ...arc.start },
      end: { ...arc.end },
    })),
    warnings: state.warnings.map((warning) => ({
      ...warning,
      sourcePosition: { ...warning.sourcePosition },
      targetPosition: { ...warning.targetPosition },
    })),
    floatingText: state.floatingText.map((text) => ({ ...text, position: { ...text.position } })),
    matchGoals: state.matchGoals.map((goal) => ({ ...goal })),
    events: state.events.map((event) => ({ ...event })),
    matchStats: { ...state.matchStats },
    teamKills: { ...state.teamKills },
    heroDeaths: { ...state.heroDeaths },
  };
}
