import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AbilityIcon } from '@/assets/icons';
import { ABILITY_LABELS, COLORS } from '@/game/constants';
import { getHeroDefinition, HERO_ROSTER } from '@/game/heroes';
import { DEFAULT_PROFILE, loadProfile, saveProfile, type PlayerProfile } from '@/game/playerProfile';
import type { AbilityId, HeroClassId } from '@/game/types';
import { playSfx } from '@/audio/sfx';
import { HeroPreviewBadge } from './HeroPreviewBadge';
import { MenuRouteScreen } from './MenuRouteScreen';

export function HeroSelectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ level?: string | string[] }>();
  const { width, height } = useWindowDimensions();
  const compact = width < 760 || height < 430;
  const narrow = width < 620;
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PROFILE);
  const [selectedHero, setSelectedHero] = useState<HeroClassId>(DEFAULT_PROFILE.selectedHero);
  const [selectedAbility, setSelectedAbility] = useState<AbilityId | null>(null);
  const level = useMemo(() => parseRouteLevel(params.level) ?? 1, [params.level]);
  const hero = getHeroDefinition(selectedHero);

  useEffect(() => {
    let mounted = true;
    loadProfile().then((loaded) => {
      if (!mounted) return;
      setProfile(loaded);
      setSelectedHero(loaded.selectedHero);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const chooseHero = (id: HeroClassId) => {
    playSfx('button');
    setSelectedHero(id);
    setSelectedAbility(null);
  };

  const toggleAbility = (ability: AbilityId) => {
    playSfx('button');
    setSelectedAbility((current) => current === ability ? null : ability);
  };

  const startBattle = () => {
    playSfx('button');
    const nextProfile = {
      ...profile,
      selectedHero,
    };
    setProfile(nextProfile);
    void saveProfile(nextProfile).then(() => {
      router.replace({ pathname: '/game', params: { level: String(level) } });
    });
  };

  return (
    <MenuRouteScreen title="Choose Hero" accent={hero.color}>
      <View style={styles.root}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator
          persistentScrollbar
          style={styles.scroll}
          contentContainerStyle={[styles.content, compact && styles.contentCompact, narrow && styles.contentNarrow]}
        >
          {HERO_ROSTER.map((candidate) => {
            const selected = candidate.id === selectedHero;
            const record = profile.heroRecords[candidate.id];
            return (
              <Pressable
                key={candidate.id}
                accessibilityRole="button"
                accessibilityLabel={`Select ${candidate.name}`}
                onPress={() => chooseHero(candidate.id)}
                style={({ pressed }) => [
                  styles.heroCard,
                  selected && { borderColor: candidate.color, backgroundColor: `${candidate.color}18` },
                  pressed && styles.pressed,
                ]}
              >
                <HeroPreviewBadge color={candidate.color} design={candidate.design} size={narrow ? 82 : 100} />
                <View style={styles.heroCopy}>
                  <View style={styles.heroTitleRow}>
                    <Text style={[styles.heroName, selected && { color: candidate.color }]} numberOfLines={1}>{candidate.name}</Text>
                    {selected ? <Text style={[styles.selectedBadge, { backgroundColor: candidate.color }]}>SELECTED</Text> : null}
                  </View>
                  <Text style={styles.role}>{candidate.role}</Text>
                  <Text style={styles.passive} numberOfLines={2}>{candidate.passiveName}: {candidate.passiveDescription}</Text>
                  <View style={styles.abilityRow}>
                    {candidate.recommendedAbilities.map((ability) => (
                      <Pressable
                        key={ability}
                        accessibilityRole="button"
                        accessibilityLabel={`${candidate.name} ${ABILITY_LABELS[ability]}`}
                        onPress={() => toggleAbility(ability)}
                        style={({ pressed }) => [
                          styles.abilityPill,
                          selectedAbility === ability && styles.abilityPillActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <AbilityIcon id={ability} color={selectedAbility === ability ? COLORS.warning : candidate.color} size={20} />
                      </Pressable>
                    ))}
                  </View>
                  {selectedAbility && selected ? (
                    <Text style={styles.tooltip}>{ABILITY_LABELS[selectedAbility]} stays in your normal loadout system.</Text>
                  ) : null}
                </View>
                <View style={styles.recordColumn}>
                  <Text style={styles.recordValue}>{record?.wins ?? 0}</Text>
                  <Text style={styles.recordLabel}>Wins</Text>
                  <Text style={styles.recordValue}>{record?.bestLevel ?? 0}</Text>
                  <Text style={styles.recordLabel}>Best</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <View>
            <Text style={styles.footerLabel}>Level {level}</Text>
            <Text style={styles.footerHero}>{hero.name}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Enter the Forge" onPress={startBattle} style={({ pressed }) => [styles.primaryButton, { backgroundColor: hero.color }, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>Enter the Forge</Text>
          </Pressable>
        </View>
      </View>
    </MenuRouteScreen>
  );
}

function parseRouteLevel(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(1, Math.min(100, parsed));
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: 10,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 10,
    paddingBottom: 12,
  },
  contentCompact: {
    gap: 8,
  },
  contentNarrow: {
    paddingBottom: 20,
  },
  heroCard: {
    minHeight: 132,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.14)',
    backgroundColor: 'rgba(5,12,17,0.62)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '900',
  },
  selectedBadge: {
    color: '#071013',
    fontSize: 10,
    fontWeight: '900',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  role: {
    color: COLORS.warning,
    fontSize: 14,
    fontWeight: '900',
  },
  passive: {
    color: COLORS.mutedText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  abilityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  abilityPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234,248,245,0.06)',
  },
  abilityPillActive: {
    borderColor: COLORS.warning,
    backgroundColor: 'rgba(255,211,106,0.14)',
  },
  tooltip: {
    alignSelf: 'flex-start',
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: 'rgba(255,211,106,0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  recordColumn: {
    width: 48,
    alignItems: 'center',
  },
  recordValue: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  recordLabel: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 4,
  },
  footer: {
    minHeight: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.14)',
    backgroundColor: 'rgba(5,12,17,0.76)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerLabel: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '900',
  },
  footerHero: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '900',
  },
  primaryButton: {
    minHeight: 44,
    minWidth: 170,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryText: {
    color: '#071013',
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
