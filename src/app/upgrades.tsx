import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';

import { playSfx } from '@/audio/sfx';
import { AbilityIcon } from '@/assets/icons';
import { MenuRouteScreen } from '@/components/MenuRouteScreen';
import { ABILITY_LABELS } from '@/game/constants';
import { getAbilityStats } from '@/game/balance';
import {
  ABILITY_ORDER,
  ABILITY_UNLOCK_LEVELS,
  DEFAULT_PROFILE,
  MAX_ABILITY_LEVEL,
  REGULAR_ABILITIES,
  getNextCampaignLevel,
  loadProfile,
  normalizeEquippedAbilities,
  saveProfile,
  type PlayerProfile,
} from '@/game/playerProfile';
import type { AbilityId } from '@/game/types';

const CREATOR_LINKS = [
  {
    label: 'YouTube',
    detail: 'youtube.com/@eointolster',
    url: 'https://www.youtube.com/@eointolster',
    badge: 'YT',
    color: '#FF4E45',
  },
  {
    label: 'LinkedIn',
    detail: 'linkedin.com/in/eoin-tolster-2290b6221',
    url: 'https://www.linkedin.com/in/eoin-tolster-2290b6221/',
    badge: 'in',
    color: '#3DE5FF',
  },
  {
    label: 'App Store',
    detail: 'apps.apple.com/au/developer/eoin-j-tolster/id1867338583',
    url: 'https://apps.apple.com/au/developer/eoin-j-tolster/id1867338583',
    badge: 'A',
    color: '#34D399',
  },
] as const;

export default function UpgradesRoute() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const burstTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PROFILE);
  const [upgradeBurst, setUpgradeBurst] = useState<{ ability: AbilityId; token: number } | null>(null);
  const [selectedRegularSlot, setSelectedRegularSlot] = useState<number | null>(null);
  const [showCreatorThanks, setShowCreatorThanks] = useState(false);
  const compact = width < 760 || height < 430;
  const narrow = width < 620;
  const nextBattleLevel = getNextCampaignLevel(profile);

  useEffect(() => {
    let mounted = true;
    loadProfile().then((loaded) => {
      if (mounted) setProfile(loaded);
    });
    return () => {
      mounted = false;
      if (burstTimeoutRef.current) {
        clearTimeout(burstTimeoutRef.current);
      }
    };
  }, []);

  const persist = (nextProfile: PlayerProfile) => {
    setProfile(nextProfile);
    void saveProfile(nextProfile);
  };

  const upgradeAbility = (ability: AbilityId) => {
    if (!profile.unlockedAbilities.includes(ability)) return;
    const currentLevel = profile.abilityLevels[ability];
    if (currentLevel >= MAX_ABILITY_LEVEL) return;
    const goldCost = getGoldUpgradeCost(ability, currentLevel);
    const spendsPoint = profile.upgradePoints > 0;
    if (!spendsPoint && profile.gold < goldCost) return;

    playSfx('upgrade');
    const burst = { ability, token: Date.now() };
    setUpgradeBurst(burst);
    if (burstTimeoutRef.current) {
      clearTimeout(burstTimeoutRef.current);
    }
    burstTimeoutRef.current = setTimeout(() => {
      setUpgradeBurst((current) => current?.token === burst.token ? null : current);
    }, 620);
    persist({
      ...profile,
      upgradePoints: spendsPoint ? profile.upgradePoints - 1 : profile.upgradePoints,
      gold: spendsPoint ? profile.gold : profile.gold - goldCost,
      abilityLevels: {
        ...profile.abilityLevels,
        [ability]: currentLevel + 1,
      },
    });
  };

  const toggleLoadout = (ability: AbilityId) => {
    if (!profile.unlockedAbilities.includes(ability)) return;

    const equipped = normalizeEquippedAbilities(profile.equippedAbilities, profile.unlockedAbilities);
    const regular = equipped.filter((candidate) => candidate !== 'ult');
    const ultimate = equipped.filter((candidate) => candidate === 'ult');
    const equippedIndex = ability === 'ult' ? -1 : regular.indexOf(ability);

    if (equipped.includes(ability)) {
      playSfx('button');
      const nextEquipped = equipped.filter((candidate) => candidate !== ability);
      persist({
        ...profile,
        equippedAbilities: normalizeEquippedAbilities(nextEquipped, profile.unlockedAbilities),
      });
      if (equippedIndex >= 0) {
        setSelectedRegularSlot(Math.min(equippedIndex, 2));
      }
      return;
    }

    let nextEquipped = equipped.filter((candidate) => candidate !== ability);

    if (ability === 'ult') {
      playSfx('button');
      nextEquipped = [...nextEquipped.filter((candidate) => candidate !== 'ult'), ability];
    } else {
      const targetSlot = selectedRegularSlot ?? (regular.length < 3 ? regular.length : null);
      if (targetSlot === null || targetSlot < 0 || targetSlot > 2) return;

      playSfx('button');
      const nextRegular = regular.slice(0, 3);
      nextRegular[targetSlot] = ability;
      nextEquipped = [...nextRegular.filter(Boolean), ...ultimate];
      setSelectedRegularSlot(targetSlot);
    }

    persist({
      ...profile,
      equippedAbilities: normalizeEquippedAbilities(nextEquipped, profile.unlockedAbilities),
    });
  };

  const startNextBattle = () => {
    playSfx('button');
    if (shouldPresentCreatorThanks(profile)) {
      setShowCreatorThanks(true);
      return;
    }

    router.push({ pathname: '/hero-select' as never, params: { level: String(nextBattleLevel) } });
  };

  const closeCreatorThanks = () => {
    playSfx('button');
    setShowCreatorThanks(false);
  };

  const startFromCreatorThanks = () => {
    playSfx('button');
    setShowCreatorThanks(false);
    router.push({ pathname: '/hero-select' as never, params: { level: String(nextBattleLevel) } });
  };

  const openCreatorLink = (url: string) => {
    playSfx('button');
    void Linking.openURL(url).catch(() => undefined);
  };

  return (
    <MenuRouteScreen title="Upgrades" accent="#FFD36A">
      <View style={[styles.routeContent, compact && styles.routeContentCompact, narrow && styles.routeContentNarrow]}>
        <View style={[styles.topRow, narrow && styles.topRowNarrow]}>
          <View style={[styles.summary, compact && styles.summaryCompact]}>
            <View>
              <Text style={styles.summaryLabel}>Unspent Points</Text>
              <Text style={styles.points}>{profile.upgradePoints}</Text>
            </View>
            <View>
              <Text style={styles.summaryLabel}>Campaign Gold</Text>
              <Text style={styles.goldText}>{profile.gold}</Text>
              <Text style={styles.summaryHint}>After points</Text>
            </View>
          </View>

          <LoadoutPanel
            profile={profile}
            compact={compact}
            selectedRegularSlot={selectedRegularSlot}
            onSelectRegularSlot={setSelectedRegularSlot}
          />

          <NextBattlePanel
            level={nextBattleLevel}
            compact={compact}
            firstFollowUp={isFirstFollowUpBattle(profile)}
            onStart={startNextBattle}
          />
        </View>

        <View style={[styles.cards, compact && styles.cardsCompact, narrow && styles.cardsNarrow]}>
          {ABILITY_ORDER.map((ability) => (
            <AbilityCard
              key={ability}
              ability={ability}
              profile={profile}
              compact={compact}
              narrow={narrow}
              celebrate={upgradeBurst?.ability === ability}
              selectedRegularSlot={selectedRegularSlot}
              onUpgrade={() => upgradeAbility(ability)}
              onToggleLoadout={() => toggleLoadout(ability)}
            />
          ))}
        </View>

        {showCreatorThanks ? (
          <CreatorThanksModal
            compact={compact}
            narrow={narrow}
            level={nextBattleLevel}
            onClose={closeCreatorThanks}
            onStart={startFromCreatorThanks}
            onOpenLink={openCreatorLink}
          />
        ) : null}
      </View>
    </MenuRouteScreen>
  );
}

function AbilityCard({
  ability,
  profile,
  compact,
  narrow,
  onUpgrade,
  onToggleLoadout,
  celebrate,
  selectedRegularSlot,
}: {
  ability: AbilityId;
  profile: PlayerProfile;
  compact: boolean;
  narrow: boolean;
  celebrate: boolean;
  selectedRegularSlot: number | null;
  onUpgrade: () => void;
  onToggleLoadout: () => void;
}) {
  const unlocked = profile.unlockedAbilities.includes(ability);
  const equippedAbilities = normalizeEquippedAbilities(profile.equippedAbilities, profile.unlockedAbilities);
  const equipped = equippedAbilities.includes(ability);
  const regular = equippedAbilities.filter((candidate) => candidate !== 'ult');
  const regularFull = regular.length >= 3;
  const level = profile.abilityLevels[ability];
  const current = getAbilityStats(ability, level);
  const next = getAbilityStats(ability, Math.min(MAX_ABILITY_LEVEL, level + 1));
  const goldCost = getGoldUpgradeCost(ability, level);
  const costLabel = profile.upgradePoints > 0 ? '1 Point' : `${goldCost}g`;
  const canUpgrade = unlocked && level < MAX_ABILITY_LEVEL && (profile.upgradePoints > 0 || profile.gold >= goldCost);
  const canPreviewNext = level < MAX_ABILITY_LEVEL;
  const statLabel = ability === 'shield' ? 'Shield' : ability === 'pulse' ? 'Heal' : 'Dmg';
  const slotLabel = ability === 'ult' ? 'Ult' : REGULAR_ABILITIES.includes(ability) ? 'Reg' : 'Locked';
  const needsSelectedSlot = unlocked && !equipped && ability !== 'ult' && regularFull && selectedRegularSlot === null;
  const actionLabel = getLoadoutActionLabel(ability, profile, unlocked, equipped, selectedRegularSlot);

  return (
    <View style={[styles.card, compact && styles.cardCompact, narrow && styles.cardNarrow, !unlocked && styles.lockedCard, equipped && styles.equippedCard, celebrate && styles.celebrateCard]}>
      {celebrate ? <UpgradeBurst ability={ability} /> : null}
      {equipped && unlocked ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Unequip ${ABILITY_LABELS[ability]}`}
          onPress={onToggleLoadout}
          style={({ pressed }) => [styles.removeBadge, pressed && styles.pressedButton]}
        >
          <Text style={styles.removeBadgeText}>x</Text>
        </Pressable>
      ) : null}
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, equipped && styles.equippedIcon]}>
          <AbilityIcon id={ability} size={24} color={unlocked ? '#FFD36A' : 'rgba(234,248,245,0.34)'} />
          {!unlocked ? (
            <View style={styles.lockBadge} pointerEvents="none">
              <View style={styles.lockShackle} />
              <View style={styles.lockBody} />
            </View>
          ) : null}
        </View>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.abilityName} numberOfLines={1}>{ABILITY_LABELS[ability]}</Text>
          <Text style={styles.meta} numberOfLines={1}>{unlocked ? `${slotLabel} Lv ${level}` : `Unlock L${ABILITY_UNLOCK_LEVELS[ability]}`}</Text>
        </View>
      </View>

      <View style={styles.statRows}>
        <Text style={styles.statText}>{statLabel} {statPreview(current.damage, next.damage, canPreviewNext)}</Text>
        <Text style={styles.statText}>CD {current.cooldown.toFixed(1)}s{canPreviewNext ? `>${next.cooldown.toFixed(1)}s` : ''}</Text>
        {current.range > 0 ? <Text style={styles.statText}>R {statPreview(current.range, next.range, canPreviewNext)}</Text> : null}
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(level / MAX_ABILITY_LEVEL) * 100}%` }]} />
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Toggle ${ABILITY_LABELS[ability]} loadout`}
          disabled={!unlocked || needsSelectedSlot}
          onPress={onToggleLoadout}
          style={({ pressed }) => [
            styles.smallButton,
            !equipped && unlocked && styles.equipButton,
            equipped && styles.unequipButton,
            (!unlocked || needsSelectedSlot) && styles.disabledButton,
            pressed && !needsSelectedSlot && styles.pressedButton,
          ]}
        >
          <Text style={[styles.smallButtonText, !equipped && unlocked && styles.equipButtonText, equipped && styles.unequipButtonText]}>{actionLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Upgrade ${ABILITY_LABELS[ability]}`}
          disabled={!canUpgrade}
          onPress={onUpgrade}
          style={({ pressed }) => [styles.upgradeButton, !canUpgrade && styles.disabledButton, pressed && canUpgrade && styles.pressedButton]}
        >
          <Text style={styles.upgradeText}>{level >= MAX_ABILITY_LEVEL ? 'MAX' : costLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LoadoutPanel({
  profile,
  compact = false,
  selectedRegularSlot,
  onSelectRegularSlot,
}: {
  profile: PlayerProfile;
  compact?: boolean;
  selectedRegularSlot: number | null;
  onSelectRegularSlot: (slot: number) => void;
}) {
  const equipped = normalizeEquippedAbilities(profile.equippedAbilities, profile.unlockedAbilities);
  const regular = equipped.filter((ability) => ability !== 'ult');
  const ultimate = equipped.find((ability) => ability === 'ult');
  const ultimateUnlocked = profile.unlockedAbilities.includes('ult');
  const selectedAbility = selectedRegularSlot === null ? null : regular[selectedRegularSlot];

  return (
    <View style={styles.loadoutPanel}>
      <View style={styles.loadoutHeader}>
        <Text style={styles.loadoutTitle}>Loadout</Text>
        <Text style={styles.loadoutMeta}>{selectedAbility ? `Replacing ${ABILITY_LABELS[selectedAbility]}` : 'Tap slot, then Equip'}</Text>
      </View>
      <View style={[styles.loadoutSlots, compact && styles.loadoutSlotsCompact]}>
        {[0, 1, 2].map((slot) => (
          <LoadoutSlot
            key={`regular-slot-${slot}`}
            label={`R${slot + 1}`}
            ability={regular[slot]}
            compact={compact}
            selected={selectedRegularSlot === slot}
            onPress={() => onSelectRegularSlot(slot)}
          />
        ))}
        <LoadoutSlot label="ULT" ability={ultimate} locked={!ultimateUnlocked} compact={compact} />
      </View>
    </View>
  );
}

function LoadoutSlot({
  label,
  ability,
  locked = false,
  compact = false,
  selected = false,
  onPress,
}: {
  label: string;
  ability?: AbilityId;
  locked?: boolean;
  compact?: boolean;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected, disabled: locked }}
      disabled={locked || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.loadoutSlot,
        compact && styles.loadoutSlotCompact,
        locked && styles.lockedLoadoutSlot,
        selected && styles.selectedLoadoutSlot,
        pressed && styles.pressedButton,
      ]}
    >
      <Text style={styles.loadoutSlotLabel}>{label}</Text>
      <View style={[styles.loadoutSlotIcon, ability === 'ult' && styles.ultimateLoadoutSlotIcon]}>
        {ability ? (
          <AbilityIcon id={ability} size={22} color={ability === 'ult' ? '#FFD36A' : '#EAF8F5'} />
        ) : (
          <Text style={styles.emptySlotText}>{locked ? 'L50' : '-'}</Text>
        )}
      </View>
      <Text style={styles.loadoutSlotName} numberOfLines={1}>
        {ability ? ABILITY_LABELS[ability] : locked ? 'Locked' : 'Open'}
      </Text>
    </Pressable>
  );
}

function NextBattlePanel({
  level,
  compact,
  firstFollowUp,
  onStart,
}: {
  level: number;
  compact: boolean;
  firstFollowUp: boolean;
  onStart: () => void;
}) {
  return (
    <View style={[styles.nextBattlePanel, compact && styles.nextBattlePanelCompact]}>
      <View>
        <Text style={styles.nextBattleLabel}>Next Fight</Text>
        <Text style={styles.nextBattleTitle}>Level {level}</Text>
        <Text style={styles.nextBattleHint}>{firstFollowUp ? 'First build locked in.' : 'Carry this loadout forward.'}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Start level ${level}`}
        onPress={onStart}
        style={({ pressed }) => [styles.startBattleButton, pressed && styles.pressedButton]}
      >
        <Text style={styles.startBattleText}>Start</Text>
      </Pressable>
    </View>
  );
}

function CreatorThanksModal({
  compact,
  narrow,
  level,
  onClose,
  onStart,
  onOpenLink,
}: {
  compact: boolean;
  narrow: boolean;
  level: number;
  onClose: () => void;
  onStart: () => void;
  onOpenLink: (url: string) => void;
}) {
  return (
    <View style={styles.thanksOverlay}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close thank you message"
        onPress={onClose}
        style={styles.thanksScrim}
      />
      <View style={[styles.thanksPanel, compact && styles.thanksPanelCompact, narrow && styles.thanksPanelNarrow]}>
        <View pointerEvents="none" style={styles.thanksGlow} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close thank you message"
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressedButton]}
        >
          <Text style={styles.closeButtonText}>x</Text>
        </Pressable>

        <View style={styles.thanksHeader}>
          <View style={styles.creatorMark}>
            <Text style={styles.creatorMarkText}>ET</Text>
          </View>
          <View style={styles.thanksTitleWrap}>
            <Text style={styles.thanksEyebrow}>A note from the creator</Text>
            <Text style={[styles.thanksTitle, compact && styles.thanksTitleCompact]}>Thank you for playing Laneforge</Text>
          </View>
        </View>

        <Text style={styles.thanksBody}>
          I'm Eoin Tolster. Thanks for giving this game your time. If you enjoy the project,
          you can find more of my work and videos here.
        </Text>

        <View style={[styles.creatorLinks, narrow && styles.creatorLinksNarrow]}>
          {CREATOR_LINKS.map((link) => (
            <Pressable
              key={link.url}
              accessibilityRole="link"
              accessibilityLabel={`Open ${link.label}`}
              onPress={() => onOpenLink(link.url)}
              style={({ pressed }) => [styles.creatorLink, pressed && styles.pressedButton]}
            >
              <View style={[styles.linkBadge, { borderColor: link.color, backgroundColor: `${link.color}24` }]}>
                <Text style={[styles.linkBadgeText, { color: link.color }]}>{link.badge}</Text>
              </View>
              <View style={styles.linkCopy}>
                <Text style={styles.linkLabel}>{link.label}</Text>
                <Text style={styles.linkDetail} numberOfLines={1}>{link.detail}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={[styles.thanksActions, narrow && styles.thanksActionsNarrow]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close thank you message"
            onPress={onClose}
            style={({ pressed }) => [styles.secondaryThanksButton, pressed && styles.pressedButton]}
          >
            <Text style={styles.secondaryThanksText}>Close</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Start level ${level}`}
            onPress={onStart}
            style={({ pressed }) => [styles.primaryThanksButton, pressed && styles.pressedButton]}
          >
            <Text style={styles.primaryThanksText}>Start Level {level}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function getLoadoutActionLabel(ability: AbilityId, profile: PlayerProfile, unlocked: boolean, equipped: boolean, selectedRegularSlot: number | null) {
  if (!unlocked) return `L${ABILITY_UNLOCK_LEVELS[ability]}`;
  if (equipped) return 'Unequip?';
  if (ability === 'ult') return 'Equip';

  const regular = normalizeEquippedAbilities(profile.equippedAbilities, profile.unlockedAbilities).filter((candidate) => candidate !== 'ult');
  if (regular.length >= 3) return selectedRegularSlot === null ? 'Pick Slot' : 'Equip';
  return 'Equip';
}

function getGoldUpgradeCost(ability: AbilityId, currentLevel: number) {
  const base = ability === 'ult' ? 420 : ability === 'shield' || ability === 'chain' ? 260 : 220;
  return base + Math.max(0, currentLevel - 1) * (ability === 'ult' ? 120 : 70);
}

function statPreview(current: number, next: number, showNext: boolean, suffix = '', decimals = 0) {
  const format = (value: number) => decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
  return `${format(current)}${suffix}${showNext ? ` -> ${format(next)}${suffix}` : ''}`;
}

function shouldPresentCreatorThanks(profile: PlayerProfile) {
  const nextLevel = getNextCampaignLevel(profile);
  return nextLevel > 1 && profile.completedLevels.includes(nextLevel - 1);
}

function isFirstFollowUpBattle(profile: PlayerProfile) {
  return profile.currentLevel === 2 && profile.completedLevels.includes(1);
}

function UpgradeBurst({ ability }: { ability: AbilityId }) {
  const label = ability === 'ult' ? 'STORM RISES' : 'UPGRADED';

  return (
    <View pointerEvents="none" style={styles.burstLayer}>
      <View style={styles.burstWash} />
      <Text style={styles.burstText}>{label}</Text>
      {Array.from({ length: 9 }).map((_, index) => {
        const angle = index * 40;
        const distance = 18 + (index % 3) * 10;
        return (
          <View
            key={`burst-${ability}-${index}`}
            style={[
              styles.burstParticle,
              {
                left: 102 + Math.cos((angle * Math.PI) / 180) * distance,
                top: 62 + Math.sin((angle * Math.PI) / 180) * distance * 0.64,
                opacity: 0.92 - index * 0.055,
                transform: [{ rotate: `${45 + angle}deg` }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  routeContent: {
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  routeContentCompact: {
    gap: 8,
  },
  routeContentNarrow: {
    justifyContent: 'flex-start',
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  topRowNarrow: {
    flexDirection: 'column',
    gap: 8,
  },
  summary: {
    flex: 0.74,
    minWidth: 170,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.28)',
    backgroundColor: 'rgba(5,12,17,0.62)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  summaryCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  summaryLabel: {
    color: 'rgba(234,248,245,0.58)',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  summaryHint: {
    color: 'rgba(255,211,106,0.62)',
    fontSize: 8,
    fontWeight: '800',
    textAlign: 'right',
    marginTop: 1,
  },
  points: {
    color: '#FFD36A',
    fontSize: 21,
    fontWeight: '900',
  },
  goldText: {
    color: '#EAF8F5',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  loadoutPanel: {
    flex: 1.26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.28)',
    backgroundColor: 'rgba(5,12,17,0.62)',
    padding: 8,
    gap: 6,
  },
  loadoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  loadoutTitle: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '900',
  },
  loadoutMeta: {
    color: 'rgba(234,248,245,0.58)',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  loadoutSlots: {
    flexDirection: 'row',
    gap: 6,
  },
  loadoutSlotsCompact: {
    gap: 5,
  },
  loadoutSlot: {
    flex: 1,
    minWidth: 66,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.16)',
    backgroundColor: 'rgba(234,248,245,0.07)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  loadoutSlotCompact: {
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 5,
  },
  selectedLoadoutSlot: {
    borderColor: '#FFD36A',
    backgroundColor: 'rgba(255,211,106,0.16)',
  },
  lockedLoadoutSlot: {
    opacity: 0.52,
    borderColor: 'rgba(255,211,106,0.18)',
  },
  loadoutSlotLabel: {
    color: 'rgba(234,248,245,0.52)',
    fontSize: 9,
    fontWeight: '900',
  },
  loadoutSlotIcon: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.36)',
    backgroundColor: 'rgba(52,211,153,0.12)',
  },
  ultimateLoadoutSlotIcon: {
    borderColor: 'rgba(255,211,106,0.5)',
    backgroundColor: 'rgba(255,211,106,0.14)',
  },
  emptySlotText: {
    color: 'rgba(234,248,245,0.58)',
    fontSize: 9,
    fontWeight: '900',
  },
  loadoutSlotName: {
    maxWidth: '100%',
    color: '#EAF8F5',
    fontSize: 9,
    fontWeight: '900',
  },
  nextBattlePanel: {
    flex: 0.68,
    minWidth: 148,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(61,229,255,0.32)',
    backgroundColor: 'rgba(5,12,17,0.62)',
    padding: 8,
    gap: 7,
    justifyContent: 'space-between',
  },
  nextBattlePanelCompact: {
    minWidth: 132,
    padding: 7,
    gap: 5,
  },
  nextBattleLabel: {
    color: 'rgba(234,248,245,0.58)',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  nextBattleTitle: {
    color: '#3DE5FF',
    fontSize: 18,
    lineHeight: 21,
    fontWeight: '900',
    marginTop: 2,
  },
  nextBattleHint: {
    color: 'rgba(234,248,245,0.62)',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    marginTop: 1,
  },
  startBattleButton: {
    minHeight: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.58)',
    backgroundColor: 'rgba(255,211,106,0.2)',
  },
  startBattleText: {
    color: '#FFD36A',
    fontSize: 12,
    fontWeight: '900',
  },
  thanksOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  thanksScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  thanksPanel: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '94%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.46)',
    backgroundColor: '#0A1519',
    padding: 18,
    gap: 13,
    overflow: 'hidden',
  },
  thanksPanelCompact: {
    maxWidth: 520,
    padding: 14,
    gap: 10,
  },
  thanksPanelNarrow: {
    maxWidth: 360,
  },
  thanksGlow: {
    position: 'absolute',
    left: -46,
    top: -38,
    width: 190,
    height: 150,
    borderRadius: 8,
    backgroundColor: 'rgba(61,229,255,0.16)',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.24)',
    backgroundColor: 'rgba(234,248,245,0.08)',
  },
  closeButtonText: {
    color: '#EAF8F5',
    fontSize: 18,
    lineHeight: 19,
    fontWeight: '900',
  },
  thanksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 34,
  },
  creatorMark: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(61,229,255,0.58)',
    backgroundColor: 'rgba(61,229,255,0.14)',
  },
  creatorMarkText: {
    color: '#3DE5FF',
    fontSize: 17,
    fontWeight: '900',
  },
  thanksTitleWrap: {
    flex: 1,
  },
  thanksEyebrow: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  thanksTitle: {
    color: '#FFD36A',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 2,
  },
  thanksTitleCompact: {
    fontSize: 20,
    lineHeight: 24,
  },
  thanksBody: {
    color: 'rgba(234,248,245,0.82)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  creatorLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  creatorLinksNarrow: {
    flexDirection: 'column',
  },
  creatorLink: {
    flexGrow: 1,
    flexBasis: '31%',
    minWidth: 150,
    minHeight: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.15)',
    backgroundColor: 'rgba(234,248,245,0.07)',
    padding: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  linkCopy: {
    flex: 1,
    minWidth: 0,
  },
  linkLabel: {
    color: '#EAF8F5',
    fontSize: 12,
    fontWeight: '900',
  },
  linkDetail: {
    color: 'rgba(61,229,255,0.8)',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
  },
  thanksActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  thanksActionsNarrow: {
    flexDirection: 'column-reverse',
  },
  secondaryThanksButton: {
    minWidth: 96,
    minHeight: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.2)',
    backgroundColor: 'rgba(234,248,245,0.08)',
  },
  secondaryThanksText: {
    color: '#EAF8F5',
    fontSize: 12,
    fontWeight: '900',
  },
  primaryThanksButton: {
    minWidth: 132,
    minHeight: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.7)',
    backgroundColor: 'rgba(255,211,106,0.24)',
  },
  primaryThanksText: {
    color: '#FFD36A',
    fontSize: 12,
    fontWeight: '900',
  },
  cards: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cardsCompact: {
    gap: 6,
  },
  cardsNarrow: {
    alignContent: 'flex-start',
  },
  card: {
    width: '23%',
    minWidth: 130,
    minHeight: 104,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.28)',
    backgroundColor: 'rgba(5,12,17,0.68)',
    padding: 8,
    gap: 5,
    overflow: 'hidden',
  },
  cardCompact: {
    minWidth: 0,
    minHeight: 88,
    padding: 7,
    gap: 4,
  },
  cardNarrow: {
    width: '48%',
    minHeight: 88,
  },
  lockedCard: {
    opacity: 0.54,
    borderColor: 'rgba(234,248,245,0.12)',
  },
  equippedCard: {
    borderColor: '#34D399',
  },
  celebrateCard: {
    borderColor: '#FFD36A',
    backgroundColor: 'rgba(255,211,106,0.16)',
  },
  removeBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    zIndex: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,85,51,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,176,150,0.64)',
  },
  removeBadgeText: {
    color: '#FFD0BD',
    fontSize: 12,
    lineHeight: 13,
    fontWeight: '900',
  },
  burstLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,211,106,0.2)',
  },
  burstText: {
    color: '#FFF7D6',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textShadowColor: 'rgba(255,211,106,0.75)',
    textShadowRadius: 8,
  },
  burstParticle: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 2,
    backgroundColor: '#FFD36A',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,211,106,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.28)',
    position: 'relative',
  },
  equippedIcon: {
    borderColor: '#34D399',
  },
  cardTitleWrap: {
    flex: 1,
  },
  abilityName: {
    color: '#FFD36A',
    fontSize: 12,
    fontWeight: '900',
  },
  meta: {
    color: 'rgba(234,248,245,0.58)',
    fontSize: 9,
    fontWeight: '800',
  },
  lockBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,12,17,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.46)',
  },
  lockShackle: {
    position: 'absolute',
    top: 3,
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#FFD36A',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  lockBody: {
    position: 'absolute',
    bottom: 4,
    width: 10,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#FFD36A',
  },
  statRows: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  statText: {
    color: 'rgba(234,248,245,0.72)',
    fontSize: 8,
    fontWeight: '800',
    borderRadius: 5,
    backgroundColor: 'rgba(234,248,245,0.07)',
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  masteryText: {
    color: 'rgba(234,248,245,0.5)',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 12,
  },
  masteryUnlocked: {
    color: '#7CFFB0',
  },
  progressTrack: {
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFD36A',
  },
  actions: {
    flexDirection: 'row',
    gap: 5,
  },
  smallButton: {
    flex: 1,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.16)',
    backgroundColor: 'rgba(234,248,245,0.08)',
  },
  equippedButton: {
    borderColor: '#34D399',
    backgroundColor: 'rgba(52,211,153,0.16)',
  },
  equipButton: {
    borderColor: 'rgba(52,211,153,0.56)',
    backgroundColor: 'rgba(52,211,153,0.18)',
  },
  unequipButton: {
    borderColor: 'rgba(255,85,51,0.52)',
    backgroundColor: 'rgba(255,85,51,0.17)',
  },
  upgradeButton: {
    flex: 1,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.42)',
    backgroundColor: 'rgba(255,211,106,0.18)',
  },
  disabledButton: {
    opacity: 0.45,
  },
  pressedButton: {
    opacity: 0.72,
  },
  smallButtonText: {
    color: '#EAF8F5',
    fontSize: 9,
    fontWeight: '900',
  },
  equipButtonText: {
    color: '#BFFFD4',
  },
  unequipButtonText: {
    color: '#FFD0BD',
  },
  upgradeText: {
    color: '#FFD36A',
    fontSize: 9,
    fontWeight: '900',
  },
});
