import type { AbilityId, MinionKind } from './types';

export const HERO_BALANCE = {
  maxHp: 700,
  radius: 16,
  speed: 208,
  damage: 30,
  attackRange: 154,
  attackSpeed: 0.6,
  xpPerLevel: 110,
  levelHp: 92,
  levelDamage: 10,
};

export const ENEMY_HERO_BALANCE = {
  maxHp: 740,
  speed: 192,
  damage: 30,
};

export const MINION_BALANCE: Record<MinionKind, {
  maxHp: number;
  speed: number;
  damage: number;
  range: number;
  cooldown: number;
  bountyXp: number;
  radius: number;
}> = {
  blade: {
    maxHp: 126,
    speed: 65,
    damage: 16,
    range: 42,
    cooldown: 1,
    bountyXp: 12,
    radius: 13,
  },
  spark: {
    maxHp: 86,
    speed: 59,
    damage: 20,
    range: 150,
    cooldown: 1.35,
    bountyXp: 16,
    radius: 12,
  },
  guard: {
    maxHp: 260,
    speed: 54,
    damage: 30,
    range: 54,
    cooldown: 1.15,
    bountyXp: 34,
    radius: 18,
  },
};

export const STRUCTURE_BALANCE = {
  towerHp: 1500,
  towerRange: 455,
  towerDamage: 78,
  towerCooldown: 0.86,
  towerHeroDamageMultiplier: 1.35,
  coreHp: 1480,
  coreRange: 210,
  coreDamage: 58,
  coreCooldown: 1,
};

export const WAVE_BALANCE = {
  firstDelay: 1.2,
  interval: 16,
  bladeCount: 3,
  sparkEvery: 2,
  guardFirstWave: 4,
  guardEvery: 3,
  guardMaxPerLane: 2,
};

export const GOLD_BOUNTY = {
  blade: 18,
  spark: 24,
  guard: 36,
  hero: 150,
  tower: 200,
  boss: 250,
};

export const BOSS_BALANCE = {
  baseHp: 2800,
  radius: 72,
  damage: 65,
  attackRange: 120,
  attackCooldown: 1.5,
  initialAttackDelay: 0.5,
  spawnSeconds: 120,
  respawnSeconds: 90,
  aggroRange: 200,
  spawnYRatio: 0.22,
  buffSeconds: 30,
  xpReward: 300,
};

export const JUNGLE_CREATURE_BALANCE = {
  bear: {
    maxHp: 520,
    radius: 34,
    speed: 78,
    damage: 54,
    attackRange: 86,
    attackCooldown: 0.9,
    aggroRange: 300,
    leashRange: 410,
    respawnSeconds: 42,
    bountyXp: 64,
    bountyGold: 42,
  },
  dragon: {
    maxHp: 1640,
    radius: 84,
    speed: 68,
    damage: 136,
    attackRange: 190,
    attackCooldown: 1.05,
    aggroRange: 390,
    leashRange: 500,
    respawnSeconds: 58,
    bountyXp: 150,
    bountyGold: 96,
  },
} as const;

export const JUNGLE_BUFF_BALANCE = {
  bearSeconds: 22,
  bearRegenPerSecond: 0.045,
  bearDamageTakenMultiplier: 0.92,
  dragonSeconds: 24,
  dragonDamageMultiplier: 1.14,
  dragonDamageTakenMultiplier: 0.9,
};

export const WARNING_BALANCE = {
  towerLeadSeconds: 0.35,
  jungleLeadSeconds: 0.28,
  heroLeadSeconds: 0.22,
};

export const POWERUP_BALANCE = {
  radius: 34,
  shieldHealthMultiplier: 0.5,
  speedSeconds: 20,
  attackCooldownMultiplier: 0.5,
  projectileSpeedMultiplier: 1.35,
};

export const ECONOMY_BALANCE = {
  passiveGoldPerSecond: 2.2,
  baseHealRadius: 285,
  baseHealPerSecond: 132,
  baseArmoryGoldCost: 140,
  baseArmoryShield: 135,
  baseArmorySeconds: 7,
  baseForgeGoldCost: 180,
  baseForgeDamageMultiplier: 1.16,
  baseForgeSeconds: 20,
};

export type AbilityStats = {
  cooldown: number;
  range: number;
  damage: number;
  radius: number;
  rootDuration?: number;
};

export const ABILITIES: Record<AbilityId, AbilityStats> = {
  bolt: {
    cooldown: 1,
    range: 390,
    damage: 52,
    radius: 12,
  },
  dash: {
    cooldown: 6.4,
    range: 185,
    damage: 58,
    radius: 88,
  },
  pulse: {
    cooldown: 5.5,
    range: 0,
    damage: 40,
    radius: 118,
  },
  fireball: {
    cooldown: 4,
    range: 320,
    damage: 105,
    radius: 80,
  },
  shield: {
    cooldown: 8,
    range: 0,
    damage: 145,
    radius: 0,
  },
  chain: {
    cooldown: 5,
    range: 360,
    damage: 55,
    radius: 140,
  },
  trap: {
    cooldown: 10,
    range: 120,
    damage: 45,
    radius: 64,
    rootDuration: 1.5,
  },
  ult: {
    cooldown: 30,
    range: 0,
    damage: 200,
    radius: 160,
  },
};

export function getAbilityStats(ability: AbilityId, level = 1): AbilityStats {
  const safeLevel = Math.max(1, Math.min(10, Math.round(level)));
  const tier = safeLevel - 1;
  const base = ABILITIES[ability];

  if (ability === 'shield') {
    return applyMasteryBonuses(ability, {
      ...base,
      damage: Math.round(base.damage * Math.pow(1.15, tier)),
      cooldown: roundCooldown(base.cooldown * Math.pow(0.96, tier)),
    }, safeLevel);
  }

  if (ability === 'trap') {
    return applyMasteryBonuses(ability, {
      ...base,
      damage: Math.round(base.damage * Math.pow(1.1, tier)),
      cooldown: roundCooldown(base.cooldown * Math.pow(0.95, tier)),
      rootDuration: (base.rootDuration ?? 1.5) + tier * 0.2,
    }, safeLevel);
  }

  if (ability === 'ult') {
    return applyMasteryBonuses(ability, {
      ...base,
      damage: Math.round(base.damage * Math.pow(1.08, tier)),
      cooldown: roundCooldown(base.cooldown * Math.pow(0.95, tier)),
      radius: base.radius + tier * 10,
    }, safeLevel);
  }

  const damageMultiplier = ability === 'pulse' ? 1.1 : 1.12;
  return applyMasteryBonuses(ability, {
    ...base,
    damage: Math.round(base.damage * Math.pow(damageMultiplier, tier)),
    cooldown: roundCooldown(base.cooldown * Math.pow(0.95, tier)),
  }, safeLevel);
}

function applyMasteryBonuses(ability: AbilityId, stats: AbilityStats, level: number): AbilityStats {
  const mastered = { ...stats };

  if (level >= 5) {
    mastered.damage = Math.round(mastered.damage * 1.08);
    mastered.cooldown = roundCooldown(mastered.cooldown * 0.94);
    if (mastered.radius > 0) {
      mastered.radius = Math.round(mastered.radius * 1.06);
    }
  }

  if (level >= 10) {
    mastered.damage = Math.round(mastered.damage * 1.1);
    mastered.cooldown = roundCooldown(mastered.cooldown * 0.9);
    if (mastered.range > 0) {
      mastered.range += ability === 'dash' ? 22 : 36;
    }
    if (mastered.radius > 0) {
      mastered.radius = Math.round(mastered.radius * 1.08);
    }
    if (mastered.rootDuration) {
      mastered.rootDuration += 0.35;
    }
  }

  return mastered;
}

function roundCooldown(value: number) {
  return Math.max(0.3, Math.round(value * 10) / 10);
}
