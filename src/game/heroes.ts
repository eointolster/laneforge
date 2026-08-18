import type { AbilityId, HeroClassId, HeroDesignId } from './types';

export type HeroClassStats = {
  maxHp: number;
  radius: number;
  speed: number;
  damage: number;
  attackRange: number;
  attackSpeed: number;
  levelHp: number;
  levelDamage: number;
  abilityDamageMultiplier: number;
  regenMultiplier: number;
  minionAuraRadius?: number;
  minionDamageMultiplier?: number;
  minionSpeedMultiplier?: number;
};

export type HeroClassDefinition = {
  id: HeroClassId;
  name: string;
  role: string;
  passiveName: string;
  passiveDescription: string;
  color: string;
  design: HeroDesignId;
  recommendedAbilities: AbilityId[];
  abilityPool: AbilityId[];
  stats: HeroClassStats;
};

export const HERO_ROSTER: HeroClassDefinition[] = [
  {
    id: 'arc-knight',
    name: 'Arc Knight',
    role: 'Balanced melee',
    passiveName: 'Arc Discipline',
    passiveDescription: 'Reliable health, damage, and recovery with the full starter loadout.',
    color: '#3DE5FF',
    design: 'knight',
    recommendedAbilities: ['bolt', 'dash', 'pulse'],
    abilityPool: ['bolt', 'dash', 'pulse', 'fireball', 'shield', 'chain', 'trap', 'ult'],
    stats: {
      maxHp: 700,
      radius: 16,
      speed: 208,
      damage: 30,
      attackRange: 154,
      attackSpeed: 0.6,
      levelHp: 92,
      levelDamage: 10,
      abilityDamageMultiplier: 1,
      regenMultiplier: 1,
    },
  },
  {
    id: 'ember-sage',
    name: 'Ember Sage',
    role: 'Ranged caster',
    passiveName: 'Kindled Focus',
    passiveDescription: 'Longer basic attacks and stronger spells, but lower health and weaker weapon hits.',
    color: '#FF8B3D',
    design: 'mage',
    recommendedAbilities: ['bolt', 'fireball', 'pulse'],
    abilityPool: ['bolt', 'pulse', 'fireball', 'chain', 'trap', 'ult'],
    stats: {
      maxHp: 560,
      radius: 15,
      speed: 216,
      damage: 20,
      attackRange: 260,
      attackSpeed: 0.82,
      levelHp: 70,
      levelDamage: 7,
      abilityDamageMultiplier: 1.16,
      regenMultiplier: 0.9,
    },
  },
  {
    id: 'stone-herald',
    name: 'Stone Herald',
    role: 'Tank bruiser',
    passiveName: 'Marching Bulwark',
    passiveDescription: 'High health and nearby minion buffs, trading speed and spell burst for wave pressure.',
    color: '#A3E635',
    design: 'paladin',
    recommendedAbilities: ['dash', 'shield', 'pulse'],
    abilityPool: ['dash', 'pulse', 'shield', 'chain', 'trap', 'ult'],
    stats: {
      maxHp: 880,
      radius: 18,
      speed: 184,
      damage: 34,
      attackRange: 132,
      attackSpeed: 0.74,
      levelHp: 118,
      levelDamage: 8,
      abilityDamageMultiplier: 0.92,
      regenMultiplier: 1.18,
      minionAuraRadius: 360,
      minionDamageMultiplier: 1.12,
      minionSpeedMultiplier: 1.08,
    },
  },
];

export const DEFAULT_HERO_CLASS: HeroClassId = 'arc-knight';

const HERO_BY_ID = HERO_ROSTER.reduce((map, hero) => {
  map[hero.id] = hero;
  return map;
}, {} as Record<HeroClassId, HeroClassDefinition>);

export function getHeroDefinition(id: HeroClassId | null | undefined): HeroClassDefinition {
  return HERO_BY_ID[id ?? DEFAULT_HERO_CLASS] ?? HERO_BY_ID[DEFAULT_HERO_CLASS];
}

export function isHeroClassId(value: unknown): value is HeroClassId {
  return value === 'arc-knight' || value === 'ember-sage' || value === 'stone-herald';
}

export function sanitizeHeroClassId(value: unknown): HeroClassId {
  return isHeroClassId(value) ? value : DEFAULT_HERO_CLASS;
}

export function getEnemyHeroClassForLevel(level: number): HeroClassId {
  const index = Math.max(0, Math.round(level) - 1) % HERO_ROSTER.length;
  return HERO_ROSTER[index].id;
}
