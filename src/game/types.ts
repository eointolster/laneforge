export type Team = 'blue' | 'red';
export type LaneId = 'top' | 'middle' | 'bottom';
export type AbilityId = 'bolt' | 'dash' | 'pulse' | 'fireball' | 'shield' | 'chain' | 'trap' | 'ult';
export type HeroClassId = 'arc-knight' | 'ember-sage' | 'stone-herald';
export type HeroDesignId = 'knight' | 'mage' | 'berserker' | 'ranger' | 'warlock' | 'paladin';
export type GraphicsQuality = 'high' | 'performance';

export type Point = {
  x: number;
  y: number;
};

export type Vector = Point;

export type JoystickVector = Vector & {
  magnitude: number;
};

export type TargetKind = 'hero' | 'minion' | 'structure' | 'boss' | 'jungle';

export type TargetRef = {
  kind: TargetKind;
  id: string;
};

export type Hero = {
  id: string;
  team: Team;
  heroClass: HeroClassId;
  name: string;
  heroColor?: string;
  heroDesign?: HeroDesignId;
  abilityLevels: Record<AbilityId, number>;
  position: Point;
  radius: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  gold: number;
  attackCooldown: number;
  warningTargetRef?: TargetRef | null;
  warningTimer?: number;
  respawnTimer: number;
  shield: number;
  shieldTimer: number;
  powerShield: number;
  powerShieldMax: number;
  attackSpeedBoostTimer: number;
  cooldowns: Record<AbilityId, number>;
  intent: Vector;
  facing: Vector;
  lastAttackTime: number;
  lastDamageTime: number;
  lastCastTime: number;
  lastCastAbility: AbilityId | null;
  deathTime: number;
  dashTimer: number;
  dashVelocity: Vector;
  dashImpactTimer: number;
  dashImpactDamage: number;
  channelTimer: number;
  channelAbility: AbilityId | null;
  channelRadius: number;
  channelDamage: number;
  lastTargetRef: TargetRef | null;
  lastTargetTime: number;
  bossBuffTimer: number;
  bearBuffTimer: number;
  dragonBuffTimer: number;
  weaponBoostTimer: number;
  rootTimer: number;
};

export type MinionKind = 'blade' | 'spark' | 'guard';

export type Minion = {
  id: string;
  team: Team;
  lane: LaneId;
  kind: MinionKind;
  position: Point;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  bountyXp: number;
  facing: Vector;
  lastAttackTime: number;
  lastDamageTime: number;
  deathTime: number;
  rootTimer: number;
  dead: boolean;
};

export type StructureKind = 'tower' | 'core';

export type Structure = {
  id: string;
  team: Team;
  kind: StructureKind;
  lane?: LaneId;
  position: Point;
  radius: number;
  hp: number;
  maxHp: number;
  range: number;
  damage: number;
  attackCooldown: number;
  warningTargetRef?: TargetRef | null;
  warningTimer?: number;
  lastDamageTime: number;
  alive: boolean;
};

export type JungleBoss = {
  id: string;
  position: Point;
  radius: number;
  hp: number;
  maxHp: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  warningTargetRef?: TargetRef | null;
  warningTimer?: number;
  alive: boolean;
  respawnTimer: number;
  lastAttackTime: number;
  lastDamageTime: number;
  targetRef: TargetRef | null;
  deathTime: number;
};

export type JungleCreatureKind = 'bear' | 'dragon';

export type JungleCreature = {
  id: string;
  kind: JungleCreatureKind;
  position: Point;
  homePosition: Point;
  facing: Vector;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackRange: number;
  aggroRange: number;
  leashRange: number;
  attackCooldown: number;
  warningTargetRef?: TargetRef | null;
  warningTimer?: number;
  alive: boolean;
  respawnTimer: number;
  lastAttackTime: number;
  lastDamageTime: number;
  targetRef: TargetRef | null;
  deathTime: number;
  bountyXp: number;
  bountyGold: number;
};

export type ProjectileKind = 'basic' | 'tower' | 'bolt' | 'spark' | 'fireball' | 'chain';

export type Projectile = {
  id: string;
  team: Team;
  kind: ProjectileKind;
  position: Point;
  velocity: Vector;
  radius: number;
  damage: number;
  target?: TargetRef;
  splashRadius?: number;
  masteryTier?: 0 | 1 | 2;
  pierceRemaining?: number;
  hitRefs?: string[];
  ttl: number;
};

export type EffectKind = 'hit' | 'bolt' | 'fireball' | 'chain' | 'pulse' | 'dash' | 'spawn' | 'level' | 'shield' | 'trap' | 'ult';

export type Effect = {
  id: string;
  kind: EffectKind;
  position: Point;
  radius: number;
  ttl: number;
  maxTtl: number;
  color: string;
};

export type ChainArc = {
  id: string;
  team: Team;
  start: Point;
  end: Point;
  ttl: number;
  maxTtl: number;
  color: string;
};

export type FloatingText = {
  id: string;
  text: string;
  position: Point;
  ttl: number;
  color: string;
  size?: 'small' | 'normal' | 'large';
};

export type Trap = {
  id: string;
  team: Team;
  position: Point;
  radius: number;
  damage: number;
  rootDuration: number;
  ttl: number;
  triggered: boolean;
};

export type PowerUpKind = 'shield' | 'speed';

export type PowerUp = {
  id: string;
  team: Team;
  kind: PowerUpKind;
  position: Point;
  radius: number;
  active: boolean;
  pickedBy?: Team;
  pickedAt?: number;
};

export type WarningKind = 'tower' | 'jungle' | 'hero';

export type WarningIndicator = {
  id: string;
  kind: WarningKind;
  team: Team;
  sourcePosition: Point;
  targetPosition: Point;
  radius: number;
  ttl: number;
  maxTtl: number;
  color: string;
};

export type MatchGoalId = 'jungle-clears' | 'top-tower' | 'dragon-hunt';

export type MatchGoal = {
  id: MatchGoalId;
  label: string;
  progress: number;
  target: number;
  rewardGold: number;
  rewardXp: number;
  completed: boolean;
};

export type GameEvent = {
  id: string;
  kind: 'hero_kill' | 'structure_destroy' | 'boss_kill' | 'level_up' | 'goal_complete';
  team: Team;
  message: string;
  time: number;
};

export type GameInput = {
  move: JoystickVector;
  queuedAbilities: AbilityId[];
};

export type LevelConfig = {
  level: number;
  enemyHpMultiplier: number;
  enemyDamageMultiplier: number;
  enemySpeedMultiplier: number;
  minionWaveSize: number;
  sparkFrequency: number;
  towerHpMultiplier: number;
  bossEnabled: boolean;
  bossHpMultiplier: number;
  rewardUpgradePoints: number;
  rewardGold: number;
  levelTitle: string;
};

export type CameraState = {
  center: Point;
  lastTarget: Point;
  width: number;
  height: number;
  zoom: number;
  yScale: number;
  skewX: number;
  anchorX: number;
  anchorY: number;
};

export type CameraBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GameState = {
  time: number;
  nextId: number;
  levelConfig: LevelConfig;
  waveTimer: number;
  waveNumber: number;
  heroes: {
    player: Hero;
    enemy: Hero;
  };
  minions: Minion[];
  structures: Structure[];
  jungleBoss: JungleBoss | null;
  jungleCreatures: JungleCreature[];
  powerUps: PowerUp[];
  projectiles: Projectile[];
  traps: Trap[];
  effects: Effect[];
  chainArcs: ChainArc[];
  warnings: WarningIndicator[];
  floatingText: FloatingText[];
  matchGoals: MatchGoal[];
  events: GameEvent[];
  matchStats: {
    heroUsed: HeroClassId;
    damageDealt: number;
    damageTaken: number;
    towersDestroyed: number;
  };
  teamKills: Record<Team, number>;
  heroDeaths: Record<Team, number>;
  winner: Team | null;
  gameOverReason: string | null;
};
