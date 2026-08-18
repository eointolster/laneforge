import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { playSfx } from '@/audio/sfx';
import { MenuRouteScreen } from '@/components/MenuRouteScreen';
import { generateCampaignLevels, levelModifierSummary } from '@/game/levels';
import { DEFAULT_PROFILE, getNextCampaignLevel, loadProfile, type PlayerProfile } from '@/game/playerProfile';

const LEVELS = generateCampaignLevels();

export default function LadderRoute() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 620;
  const scrollRef = useRef<ScrollView>(null);
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    let mounted = true;
    loadProfile().then((loaded) => {
      if (mounted) setProfile(loaded);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const nextCampaignLevel = getNextCampaignLevel(profile);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: estimateLevelScrollOffset(nextCampaignLevel),
        animated: true,
      });
    }, 140);

    return () => clearTimeout(timer);
  }, [nextCampaignLevel]);

  const launchLevel = (level: number) => {
    playSfx('button');
    router.push({ pathname: '/hero-select' as never, params: { level: String(level) } });
  };
  const currentTier = tierLabel(nextCampaignLevel);

  return (
    <MenuRouteScreen title="Level Ladder" accent="#34D399">
      <View style={[styles.summary, compact && styles.summaryCompact]}>
        <View>
          <Text style={styles.summaryLabel}>Campaign</Text>
          <Text style={styles.summaryValue}>Level {nextCampaignLevel}/100</Text>
        </View>
        <View style={[styles.summaryStats, compact && styles.summaryStatsCompact]}>
          <Text style={styles.summaryStat}>Wins {profile.totalWins}</Text>
          <Text style={styles.summaryStat}>Kills {profile.totalKills}</Text>
          <Text style={styles.summaryStat}>Gold {profile.gold}</Text>
          <Text style={styles.tierBadge}>{currentTier}</Text>
        </View>
      </View>
      <Text style={[styles.replayHint, compact && styles.replayHintCompact]}>Completed nodes can be replayed for campaign gold.</Text>

      <ScrollView
        ref={scrollRef}
        style={[styles.scroll, compact && styles.scrollCompact]}
        contentInsetAdjustmentBehavior="automatic"
        indicatorStyle="white"
        persistentScrollbar
        showsVerticalScrollIndicator
        contentContainerStyle={styles.ladder}
      >
        {LEVELS.map((level) => {
          const completed = profile.completedLevels.includes(level.level);
          const current = level.level === nextCampaignLevel;
          const locked = level.level > nextCampaignLevel && !completed;
          const firstInTier = level.level === 1 || level.level === 11 || level.level === 31 || level.level === 51 || level.level === 71 || level.level === 91;
          const rewardLabel = completed ? `Replay +${level.rewardGold}g` : `+${level.rewardUpgradePoints} pts`;

          return (
            <View key={level.level}>
              {firstInTier ? (
                <View style={[styles.tierBand, tierBandStyle(level.level)]}>
                  <Text style={styles.tierLabel}>{tierLabel(level.level)}</Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Level ${level.level}`}
                disabled={locked}
                onPress={() => launchLevel(level.level)}
                style={({ pressed }) => [
                  styles.levelRow,
                  completed && styles.completedRow,
                  current && styles.currentRow,
                  locked && styles.lockedRow,
                  pressed && !locked && styles.pressed,
                ]}
              >
                <View style={styles.lineWrap}>
                  <View style={[styles.line, completed && styles.completedLine]} />
                  <View style={[styles.node, completed && styles.completedNode, current && styles.currentNode, locked && styles.lockedNode]}>
                    <Text style={styles.nodeText}>{completed ? '✓' : locked ? 'L' : level.level}</Text>
                  </View>
                </View>
                <Text style={[styles.levelText, compact && styles.levelTextCompact]}>Level {level.level}</Text>
                <View style={styles.titleWrap}>
                  <Text style={styles.titleText} numberOfLines={1}>{level.levelTitle}</Text>
                  {compact ? null : <Text style={styles.modifierText} numberOfLines={1}>{levelModifierSummary(level)}</Text>}
                </View>
                <Text style={[styles.rewardText, compact && styles.rewardTextCompact, completed && styles.replayRewardText]} numberOfLines={1}>{rewardLabel}</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </MenuRouteScreen>
  );
}

function estimateLevelScrollOffset(level: number) {
  const safeLevel = Math.max(1, Math.min(100, level));
  const levelIndex = safeLevel - 1;
  const tierLabelsBefore = [1, 11, 31, 51, 71, 91].filter((tierStart) => tierStart < safeLevel).length;
  return Math.max(0, levelIndex * 48 + tierLabelsBefore * 24 - 108);
}

function tierLabel(level: number) {
  if (level >= 91) return 'Legend 91-100';
  if (level >= 71) return 'Platinum 71-90';
  if (level >= 51) return 'Gold 51-70';
  if (level >= 31) return 'Silver 31-50';
  if (level >= 11) return 'Bronze 11-30';
  return 'Tutorial 1-10';
}

function tierBandStyle(level: number) {
  if (level >= 91) return { borderColor: 'rgba(255,211,106,0.5)', backgroundColor: 'rgba(255,211,106,0.13)' };
  if (level >= 71) return { borderColor: 'rgba(139,92,246,0.46)', backgroundColor: 'rgba(139,92,246,0.13)' };
  if (level >= 51) return { borderColor: 'rgba(255,211,106,0.42)', backgroundColor: 'rgba(255,211,106,0.1)' };
  if (level >= 31) return { borderColor: 'rgba(221,231,240,0.36)', backgroundColor: 'rgba(221,231,240,0.08)' };
  if (level >= 11) return { borderColor: 'rgba(255,176,150,0.38)', backgroundColor: 'rgba(255,85,51,0.09)' };
  return { borderColor: 'rgba(61,229,255,0.4)', backgroundColor: 'rgba(61,229,255,0.1)' };
}

const styles = StyleSheet.create({
  summary: {
    width: 520,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.32)',
    backgroundColor: 'rgba(5,12,17,0.62)',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryCompact: {
    width: '100%',
    alignItems: 'flex-start',
    gap: 8,
  },
  summaryLabel: {
    color: 'rgba(234,248,245,0.58)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: '#34D399',
    fontSize: 20,
    fontWeight: '900',
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryStatsCompact: {
    flexWrap: 'wrap',
    gap: 7,
  },
  summaryStat: {
    color: '#EAF8F5',
    fontSize: 12,
    fontWeight: '900',
  },
  tierBadge: {
    color: '#071013',
    fontSize: 11,
    fontWeight: '900',
    backgroundColor: '#34D399',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  replayHint: {
    width: 520,
    color: 'rgba(234,248,245,0.6)',
    fontSize: 10,
    fontWeight: '800',
    marginTop: -4,
    marginBottom: 8,
  },
  replayHintCompact: {
    width: '100%',
  },
  scroll: {
    width: 520,
  },
  scrollCompact: {
    width: '100%',
  },
  ladder: {
    gap: 6,
    paddingBottom: 28,
  },
  tierBand: {
    minHeight: 28,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 2,
  },
  tierLabel: {
    color: '#FFD36A',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  levelRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(5,12,17,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.08)',
    paddingHorizontal: 12,
  },
  completedRow: {
    borderColor: 'rgba(255,211,106,0.38)',
  },
  currentRow: {
    borderColor: 'rgba(61,229,255,0.52)',
    backgroundColor: 'rgba(61,229,255,0.1)',
  },
  lockedRow: {
    opacity: 0.42,
  },
  pressed: {
    opacity: 0.75,
  },
  lineWrap: {
    width: 28,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    position: 'absolute',
    top: -8,
    bottom: -8,
    width: 2,
    backgroundColor: 'rgba(234,248,245,0.14)',
  },
  completedLine: {
    backgroundColor: 'rgba(255,211,106,0.58)',
  },
  node: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234,248,245,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.28)',
  },
  completedNode: {
    backgroundColor: '#34D399',
    borderColor: '#FFD36A',
  },
  currentNode: {
    backgroundColor: '#3DE5FF',
    boxShadow: '0 0 10px rgba(61,229,255,0.7)',
  },
  lockedNode: {
    backgroundColor: 'rgba(234,248,245,0.18)',
  },
  nodeText: {
    color: '#071013',
    fontSize: 9,
    fontWeight: '900',
  },
  levelText: {
    width: 76,
    color: '#EAF8F5',
    fontSize: 13,
    fontWeight: '900',
  },
  levelTextCompact: {
    width: 56,
    fontSize: 12,
  },
  titleText: {
    color: 'rgba(234,248,245,0.66)',
    fontSize: 12,
    fontWeight: '800',
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  modifierText: {
    color: 'rgba(52,211,153,0.66)',
    fontSize: 9,
    fontWeight: '800',
  },
  rewardText: {
    color: '#FFD36A',
    fontSize: 11,
    fontWeight: '900',
    minWidth: 82,
    textAlign: 'right',
  },
  rewardTextCompact: {
    minWidth: 58,
    maxWidth: 74,
    fontSize: 10,
  },
  replayRewardText: {
    color: '#34D399',
  },
});
