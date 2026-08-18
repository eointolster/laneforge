import type { LevelConfig } from './types';

const TITLE_PLACES = [
  'Whispering Woods',
  'Crimson Hollow',
  'Moonlit Crossing',
  'Dragon Reach',
  'Emerald Rift',
  'Ashen Watch',
  'Starlit Grove',
  'Runebound Vale',
  'Stormglass Path',
  'Legend Gate',
];

const TITLE_MOODS = [
  'Dawn',
  'Mist',
  'Ember',
  'Storm',
  'Twilight',
  'Runic',
  'Frost',
  'Verdant',
  'Astral',
  'Eclipse',
];

export function generateLevelConfig(level: number): LevelConfig {
  const safeLevel = Math.max(1, Math.min(100, Math.round(level)));
  const tier = getTier(safeLevel);
  const tierProgress = tier.maxLevel === tier.minLevel
    ? 1
    : (safeLevel - tier.minLevel) / (tier.maxLevel - tier.minLevel);

  return {
    level: safeLevel,
    enemyHpMultiplier: lerp(tier.hpStart, tier.hpEnd, tierProgress),
    enemyDamageMultiplier: lerp(tier.damageStart, tier.damageEnd, tierProgress),
    enemySpeedMultiplier: lerp(tier.speedStart, tier.speedEnd, tierProgress),
    minionWaveSize: tier.waveSize,
    sparkFrequency: tier.sparkFrequency,
    towerHpMultiplier: lerp(tier.towerStart, tier.towerEnd, tierProgress),
    bossEnabled: safeLevel >= 10,
    bossHpMultiplier: safeLevel < 10 ? 0 : Math.max(1, lerp(tier.bossStart, tier.bossEnd, tierProgress)),
    rewardUpgradePoints: tier.rewardUpgradePoints,
    rewardGold: tier.rewardGold + safeLevel * 8,
    levelTitle: levelTitle(safeLevel),
  };
}

export function generateCampaignLevels() {
  return Array.from({ length: 100 }, (_, index) => generateLevelConfig(index + 1));
}

export function levelModifierSummary(levelConfig: Pick<LevelConfig, 'minionWaveSize' | 'sparkFrequency' | 'bossEnabled' | 'towerHpMultiplier' | 'enemyHpMultiplier'>) {
  const parts = [
    `${levelConfig.minionWaveSize} blades`,
    levelConfig.sparkFrequency <= 1 ? 'Spark each wave' : `Spark every ${levelConfig.sparkFrequency} waves`,
  ];

  if (levelConfig.bossEnabled) {
    parts.push('Boss');
  }

  if (levelConfig.towerHpMultiplier >= 1.45) {
    parts.push('Fortified towers');
  }

  if (levelConfig.enemyHpMultiplier >= 2) {
    parts.push('Elite foes');
  }

  return parts.join(' | ');
}

function getTier(level: number) {
  if (level <= 10) {
    return {
      minLevel: 1,
      maxLevel: 10,
      hpStart: 0.85,
      hpEnd: 1.15,
      damageStart: 0.82,
      damageEnd: 1.12,
      speedStart: 0.94,
      speedEnd: 1.02,
      towerStart: 1.35,
      towerEnd: 1.52,
      bossStart: 0,
      bossEnd: 0,
      waveSize: 3,
      sparkFrequency: 2,
      rewardUpgradePoints: 2,
      rewardGold: 60,
    };
  }

  if (level <= 30) {
    return tier(11, 30, 1, 1.3, 1, 1.3, 1, 1.05, 1, 1.25, 1, 1.25, 3, 2, 3, 95);
  }

  if (level <= 50) {
    return tier(31, 50, 1.3, 1.7, 1.3, 1.7, 1.03, 1.1, 1.2, 1.6, 1.25, 1.7, 4, 2, 3, 130);
  }

  if (level <= 70) {
    return tier(51, 70, 1.7, 2.2, 1.7, 2.2, 1.08, 1.14, 1.55, 2.05, 1.7, 2.25, 4, 1, 4, 170);
  }

  if (level <= 90) {
    return tier(71, 90, 2.2, 3, 2.2, 3, 1.12, 1.18, 2, 2.8, 2.25, 3.15, 5, 1, 4, 220);
  }

  return tier(91, 100, 3, 4, 3, 4, 1.15, 1.22, 2.75, 3.8, 3.2, 4.5, 5, 1, 5, 300);
}

function tier(
  minLevel: number,
  maxLevel: number,
  hpStart: number,
  hpEnd: number,
  damageStart: number,
  damageEnd: number,
  speedStart: number,
  speedEnd: number,
  towerStart: number,
  towerEnd: number,
  bossStart: number,
  bossEnd: number,
  waveSize: number,
  sparkFrequency: number,
  rewardUpgradePoints: number,
  rewardGold: number,
) {
  return {
    minLevel,
    maxLevel,
    hpStart,
    hpEnd,
    damageStart,
    damageEnd,
    speedStart,
    speedEnd,
    towerStart,
    towerEnd,
    bossStart,
    bossEnd,
    waveSize,
    sparkFrequency,
    rewardUpgradePoints,
    rewardGold,
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function levelTitle(level: number) {
  const place = TITLE_PLACES[(level - 1) % TITLE_PLACES.length];
  const mood = TITLE_MOODS[Math.floor((level - 1) / TITLE_PLACES.length) % TITLE_MOODS.length];
  return `${mood} ${place}`;
}
