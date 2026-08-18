import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_HERO_CLASS, HERO_ROSTER, sanitizeHeroClassId } from './heroes';
import type { AbilityId, GraphicsQuality, HeroClassId, HeroDesignId } from './types';

export type HeroRecord = {
  wins: number;
  kills: number;
  bestLevel: number;
};

export type PlayerProfile = {
  name: string;
  currentLevel: number;
  completedLevels: number[];
  selectedHero: HeroClassId;
  heroRecords: Record<HeroClassId, HeroRecord>;
  heroColor: string;
  heroDesign: HeroDesignId;
  upgradePoints: number;
  abilityLevels: Record<AbilityId, number>;
  unlockedAbilities: AbilityId[];
  equippedAbilities: AbilityId[];
  totalKills: number;
  totalDeaths: number;
  totalWins: number;
  gold: number;
  sfxEnabled: boolean;
  fpsMeterEnabled: boolean;
  graphicsQuality: GraphicsQuality;
  tutorialDone: boolean;
};

const PROFILE_KEY = 'battle-legends.player-profile.v1';
export const MAX_ABILITY_LEVEL = 10;
export const ABILITY_ORDER: AbilityId[] = ['bolt', 'dash', 'pulse', 'fireball', 'shield', 'chain', 'trap', 'ult'];
export const REGULAR_ABILITIES: AbilityId[] = ['bolt', 'dash', 'pulse', 'fireball', 'shield', 'chain', 'trap'];
export const ULTIMATE_ABILITIES: AbilityId[] = ['ult'];
export const ABILITY_UNLOCK_LEVELS: Record<AbilityId, number> = {
  bolt: 1,
  dash: 1,
  pulse: 1,
  fireball: 5,
  shield: 12,
  chain: 20,
  trap: 35,
  ult: 50,
};

export const DEFAULT_PROFILE: PlayerProfile = {
  name: '',
  currentLevel: 1,
  completedLevels: [],
  selectedHero: DEFAULT_HERO_CLASS,
  heroRecords: createDefaultHeroRecords(),
  heroColor: '#3DE5FF',
  heroDesign: 'knight',
  upgradePoints: 0,
  abilityLevels: {
    bolt: 1,
    dash: 1,
    pulse: 1,
    fireball: 1,
    shield: 1,
    chain: 1,
    trap: 1,
    ult: 1,
  },
  unlockedAbilities: ['bolt', 'dash', 'pulse'],
  equippedAbilities: ['bolt', 'dash', 'pulse'],
  totalKills: 0,
  totalDeaths: 0,
  totalWins: 0,
  gold: 0,
  sfxEnabled: true,
  fpsMeterEnabled: false,
  graphicsQuality: 'high',
  tutorialDone: false,
};

export async function loadProfile(): Promise<PlayerProfile> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) return DEFAULT_PROFILE;

  try {
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function saveProfile(profile: PlayerProfile) {
  const normalized = normalizeProfile(profile);
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function updateProfile(updater: (profile: PlayerProfile) => PlayerProfile) {
  const current = await loadProfile();
  return saveProfile(updater(current));
}

function normalizeProfile(value: unknown): PlayerProfile {
  const profile = isRecord(value) ? value as Partial<PlayerProfile> : {};
  const completedLevels = normalizeCompletedLevels(profile.completedLevels);
  const requestedLevel = clampInt(profile.currentLevel, 1, 100, DEFAULT_PROFILE.currentLevel);
  const progressLevel = completedLevels.length > 0
    ? Math.min(100, Math.max(...completedLevels) + 1)
    : DEFAULT_PROFILE.currentLevel;
  const currentLevel = Math.max(requestedLevel, progressLevel);
  const unlockedAbilities = sanitizeAbilities([
    ...getUnlockedAbilitiesForLevel(currentLevel),
    ...(profile.unlockedAbilities ?? []),
  ]);
  const abilityLevels = normalizeAbilityLevels(profile.abilityLevels);

  return {
    ...DEFAULT_PROFILE,
    name: typeof profile.name === 'string' ? profile.name : DEFAULT_PROFILE.name,
    currentLevel,
    completedLevels,
    selectedHero: sanitizeHeroClassId(profile.selectedHero),
    heroRecords: normalizeHeroRecords(profile.heroRecords),
    heroColor: typeof profile.heroColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(profile.heroColor) ? profile.heroColor : DEFAULT_PROFILE.heroColor,
    heroDesign: isHeroDesign(profile.heroDesign) ? profile.heroDesign : DEFAULT_PROFILE.heroDesign,
    abilityLevels,
    unlockedAbilities,
    equippedAbilities: normalizeEquippedAbilities(profile.equippedAbilities, unlockedAbilities),
    totalKills: clampInt(profile.totalKills, 0, 999999, DEFAULT_PROFILE.totalKills),
    totalDeaths: clampInt(profile.totalDeaths, 0, 999999, DEFAULT_PROFILE.totalDeaths),
    totalWins: clampInt(profile.totalWins, 0, 999999, DEFAULT_PROFILE.totalWins),
    upgradePoints: clampInt(profile.upgradePoints, 0, 999999, DEFAULT_PROFILE.upgradePoints),
    gold: clampInt(profile.gold, 0, 9999999, DEFAULT_PROFILE.gold),
    sfxEnabled: typeof profile.sfxEnabled === 'boolean' ? profile.sfxEnabled : DEFAULT_PROFILE.sfxEnabled,
    fpsMeterEnabled: typeof profile.fpsMeterEnabled === 'boolean' ? profile.fpsMeterEnabled : DEFAULT_PROFILE.fpsMeterEnabled,
    graphicsQuality: isGraphicsQuality(profile.graphicsQuality) ? profile.graphicsQuality : DEFAULT_PROFILE.graphicsQuality,
    tutorialDone: typeof profile.tutorialDone === 'boolean' ? profile.tutorialDone : completedLevels.length > 0,
  };
}

export function getUnlockedAbilitiesForLevel(level: number): AbilityId[] {
  return ABILITY_ORDER.filter((ability) => level >= ABILITY_UNLOCK_LEVELS[ability]);
}

export function getNextCampaignLevel(profile: Pick<PlayerProfile, 'currentLevel' | 'completedLevels'>) {
  const completedLevels = normalizeCompletedLevels(profile.completedLevels);
  const requestedLevel = clampInt(profile.currentLevel, 1, 100, DEFAULT_PROFILE.currentLevel);
  if (completedLevels.length === 0) return requestedLevel;

  for (let level = 1; level <= 100; level += 1) {
    if (!completedLevels.includes(level)) {
      return level;
    }
  }

  return 100;
}

export function normalizeEquippedAbilities(value: unknown, unlockedAbilities: AbilityId[]): AbilityId[] {
  const unlocked = new Set(unlockedAbilities);
  const requested = Array.isArray(value)
    ? value.filter((ability): ability is AbilityId => ABILITY_ORDER.includes(ability as AbilityId) && unlocked.has(ability as AbilityId))
    : DEFAULT_PROFILE.equippedAbilities.filter((ability) => unlocked.has(ability));

  const regular: AbilityId[] = [];
  const ultimate: AbilityId[] = [];
  for (const ability of requested) {
    if (ability === 'ult') {
      if (ultimate.length === 0) ultimate.push(ability);
    } else if (regular.length < 3 && !regular.includes(ability)) {
      regular.push(ability);
    }
  }

  return [...regular, ...ultimate];
}

function sanitizeAbilities(value: unknown): AbilityId[] {
  if (!Array.isArray(value)) return DEFAULT_PROFILE.unlockedAbilities;

  const unique = new Set(value.filter((ability): ability is AbilityId => ABILITY_ORDER.includes(ability as AbilityId)));
  return unique.size > 0 ? Array.from(unique) : DEFAULT_PROFILE.unlockedAbilities;
}

function normalizeAbilityLevels(value: Partial<Record<AbilityId, number>> | undefined): Record<AbilityId, number> {
  return ABILITY_ORDER.reduce((levels, ability) => {
    levels[ability] = clampInt(value?.[ability], 1, MAX_ABILITY_LEVEL, DEFAULT_PROFILE.abilityLevels[ability]);
    return levels;
  }, {} as Record<AbilityId, number>);
}

function normalizeCompletedLevels(value: unknown): number[] {
  if (!Array.isArray(value)) return DEFAULT_PROFILE.completedLevels;

  return Array.from(
    new Set(value.filter((level): level is number => Number.isInteger(level) && level >= 1 && level <= 100)),
  ).sort((a, b) => a - b);
}

function createDefaultHeroRecords(): Record<HeroClassId, HeroRecord> {
  return HERO_ROSTER.reduce((records, hero) => {
    records[hero.id] = {
      wins: 0,
      kills: 0,
      bestLevel: 0,
    };
    return records;
  }, {} as Record<HeroClassId, HeroRecord>);
}

function normalizeHeroRecords(value: unknown): Record<HeroClassId, HeroRecord> {
  const source = isRecord(value) ? value : {};
  const defaults = createDefaultHeroRecords();

  return HERO_ROSTER.reduce((records, hero) => {
    const raw = isRecord(source[hero.id]) ? source[hero.id] as Partial<HeroRecord> : {};
    records[hero.id] = {
      wins: clampInt(raw.wins, 0, 999999, defaults[hero.id].wins),
      kills: clampInt(raw.kills, 0, 999999, defaults[hero.id].kills),
      bestLevel: clampInt(raw.bestLevel, 0, 100, defaults[hero.id].bestLevel),
    };
    return records;
  }, {} as Record<HeroClassId, HeroRecord>);
}

function isHeroDesign(value: unknown): value is HeroDesignId {
  return ['knight', 'mage', 'berserker', 'ranger', 'warlock', 'paladin'].includes(value as HeroDesignId);
}

function isGraphicsQuality(value: unknown): value is GraphicsQuality {
  return value === 'high' || value === 'performance';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(Number(value))));
}
