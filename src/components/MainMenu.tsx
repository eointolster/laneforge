import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Canvas } from '@shopify/react-native-skia';

import { playSfx } from '@/audio/sfx';
import { ABILITY_LABELS } from '@/game/constants';
import { getHeroDefinition } from '@/game/heroes';
import { generateLevelConfig } from '@/game/levels';
import { ABILITY_ORDER, ABILITY_UNLOCK_LEVELS, DEFAULT_PROFILE, getNextCampaignLevel, loadProfile, saveProfile, type PlayerProfile } from '@/game/playerProfile';
import { Circle, Ellipse, G, Path, Polygon, Rect } from '@/rendering/skiaElements';
import { HeroPreviewBadge } from './HeroPreviewBadge';

const PARTICLES = Array.from({ length: 28 }, (_, index) => ({
  id: `menu-particle-${index}`,
  left: 7 + ((index * 31) % 88),
  top: 8 + ((index * 47) % 80),
  size: 2 + (index % 4),
  delay: index * 120,
  color: index % 4 === 0 ? '#3DE5FF' : index % 4 === 1 ? '#FFD36A' : index % 4 === 2 ? '#8B5CF6' : '#34D399',
}));

export function MainMenu() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const compactMenu = width < 760 || height < 430;
  const portraitMenu = width < 620;
  const previewSize = portraitMenu ? (height < 700 ? 76 : 90) : compactMenu ? 94 : 126;
  const drift = useRef(new Animated.Value(0)).current;
  const startPulse = useRef(new Animated.Value(0)).current;
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PROFILE);
  const [name, setName] = useState('');

  useEffect(() => {
    let mounted = true;
    loadProfile().then((loaded) => {
      if (!mounted) return;
      setProfile(loaded);
      setName(loaded.name);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 5200, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 5200, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [drift]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(startPulse, { toValue: 1, duration: 860, useNativeDriver: true }),
        Animated.timing(startPulse, { toValue: 0, duration: 860, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [startPulse]);

  const particleTranslate = useMemo(() => drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -18],
  }), [drift]);
  const backdropTranslate = useMemo(() => drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  }), [drift]);
  const logoShimmerTranslate = useMemo(() => drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-140, 280],
  }), [drift]);
  const logoShimmerOpacity = useMemo(() => drift.interpolate({
    inputRange: [0, 0.18, 0.34, 1],
    outputRange: [0, 0.48, 0, 0],
  }), [drift]);
  const nextBattleLevel = useMemo(() => getNextCampaignLevel(profile), [profile]);
  const nextLevel = useMemo(() => generateLevelConfig(nextBattleLevel), [nextBattleLevel]);
  const selectedHero = useMemo(() => getHeroDefinition(profile.selectedHero), [profile.selectedHero]);
  const nextUnlock = useMemo(
    () => ABILITY_ORDER.find((ability) => ABILITY_UNLOCK_LEVELS[ability] > profile.currentLevel),
    [profile.currentLevel],
  );

  const handleNameChange = (nextName: string) => {
    setName(nextName);
    const nextProfile = { ...profile, name: nextName };
    setProfile(nextProfile);
    void saveProfile(nextProfile);
  };

  const displayName = name.trim() || 'Unnamed Champion';

  return (
    <LinearGradient colors={['#1A0A2E', '#0D1F2A', '#071013']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          scrollEnabled={false}
          bounces={false}
          alwaysBounceVertical={false}
          showsVerticalScrollIndicator={false}
          persistentScrollbar={false}
          style={styles.scroll}
          contentContainerStyle={[styles.root, compactMenu && styles.rootCompact, portraitMenu && styles.rootPortrait, { minHeight: height }]}
        >
          <Animated.View pointerEvents="none" style={[styles.menuBackdrop, { transform: [{ translateY: backdropTranslate }] }]}>
            <Canvas style={styles.menuBackdropCanvas}>
              <MenuBackdropLayer width={width} height={height} />
            </Canvas>
          </Animated.View>
          {PARTICLES.map((particle) => (
            <Animated.View
              key={particle.id}
              style={[
                styles.particle,
                {
                  left: `${particle.left}%` as const,
                  top: `${particle.top}%` as const,
                  width: particle.size,
                  height: particle.size,
                  borderRadius: particle.size,
                  backgroundColor: particle.color,
                  transform: [{ translateY: particleTranslate }],
                },
              ]}
            />
          ))}

          <View style={[styles.leftPane, compactMenu && styles.leftPaneCompact, portraitMenu && styles.leftPanePortrait]}>
            <View style={styles.logoWrap}>
              <Text style={[styles.logo, compactMenu && styles.logoCompact, portraitMenu && styles.logoPortrait]}>Laneforge</Text>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.logoShimmer,
                  {
                    opacity: logoShimmerOpacity,
                    transform: [
                      { translateX: logoShimmerTranslate },
                      { rotate: '18deg' },
                    ],
                  },
                ]}
              />
            </View>
            <Text style={[styles.subtitle, portraitMenu && styles.subtitlePortrait]} numberOfLines={2}>Arcane lanes. Living jungle. One champion.</Text>

            <View style={[styles.namePanel, compactMenu && styles.namePanelCompact, portraitMenu && styles.fullWidthPanel]}>
              <Text style={styles.label}>Champion Name</Text>
              <TextInput
                value={name}
                onChangeText={handleNameChange}
                placeholder="Enter your name, Champion"
                placeholderTextColor="rgba(234,248,245,0.48)"
                selectionColor="#3DE5FF"
                style={styles.input}
                maxLength={24}
              />
            </View>

            <View style={[styles.campaignPanel, compactMenu && styles.campaignPanelCompact, portraitMenu && styles.fullWidthPanel]}>
              <View style={[styles.campaignHeader, portraitMenu && styles.campaignHeaderPortrait]}>
                <View style={styles.campaignTitleWrap}>
                  <Text style={styles.label}>Next Battle</Text>
                  <Text style={styles.campaignTitle} numberOfLines={2}>Level {nextLevel.level}: {nextLevel.levelTitle}</Text>
                </View>
                <View style={styles.rewardStack}>
                  <Text style={styles.rewardValue}>+{nextLevel.rewardUpgradePoints}</Text>
                  <Text style={styles.rewardLabel}>Points</Text>
                </View>
                <View style={styles.rewardStack}>
                  <Text style={styles.rewardValue}>{nextLevel.rewardGold}</Text>
                  <Text style={styles.rewardLabel}>Gold</Text>
                </View>
              </View>
              <View style={[styles.campaignStats, portraitMenu && styles.campaignStatsPortrait]}>
                <CampaignStat label="Enemy" value={`${Math.round(nextLevel.enemyHpMultiplier * 100)}%`} color="#FFB096" />
                <CampaignStat label="Wave" value={formatWavePreview(nextLevel.minionWaveSize, nextLevel.sparkFrequency)} color="#9CEEFF" />
                <CampaignStat label="Boss" value={nextLevel.bossEnabled ? 'Open' : 'Locked'} color={nextLevel.bossEnabled ? '#C7A5FF' : 'rgba(234,248,245,0.46)'} />
                <CampaignStat
                  label="Next Unlock"
                  value={nextUnlock ? `${ABILITY_LABELS[nextUnlock]} L${ABILITY_UNLOCK_LEVELS[nextUnlock]}` : 'All Open'}
                  color="#FFD36A"
                />
              </View>
            </View>

            <View style={[styles.buttonGrid, compactMenu && styles.buttonGridCompact, portraitMenu && styles.fullWidthPanel]}>
              <MenuButton label="Start" accent="#D71920" highlightPulse={startPulse} onPress={() => router.push({ pathname: '/hero-select' as never, params: { level: String(nextBattleLevel) } })} />
              <MenuButton label="Customize" accent="#8B5CF6" onPress={() => router.push('/customize')} />
              <MenuButton label="Upgrades" accent="#FFD36A" onPress={() => router.push('/upgrades')} />
              <MenuButton label="Ladder" accent="#34D399" onPress={() => router.push('/ladder')} />
            </View>
          </View>

          <View style={[styles.playerCard, compactMenu && styles.playerCardCompact, portraitMenu && styles.playerCardPortrait]}>
            <View style={[styles.heroPreview, compactMenu && styles.heroPreviewCompact, portraitMenu && styles.heroPreviewPortrait, { boxShadow: `0 0 18px ${selectedHero.color}` }]}>
              <HeroPreviewBadge color={selectedHero.color} design={selectedHero.design} size={previewSize} />
            </View>
            <Text style={[styles.cardName, portraitMenu && styles.cardNamePortrait]} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>{selectedHero.name} - {selectedHero.role}</Text>
            <View style={[styles.statRow, compactMenu && styles.statRowCompact]}>
              <Stat label="Wins" value={profile.totalWins} color="#34D399" compact={compactMenu} />
              <Stat label="Kills" value={profile.totalKills} color="#3DE5FF" compact={compactMenu} />
              <Stat label="Gold" value={profile.gold} color="#FFD36A" compact={compactMenu} />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function MenuBackdropLayer({ width, height }: { width: number; height: number }) {
  const w = Math.max(760, width);
  const h = Math.max(360, height);
  const horizon = h * 0.56;
  const forestBase = h * 0.9;

  return (
    <G>
      <Rect x={0} y={0} width={w} height={h} fill="rgba(2,8,10,0.16)" />
      <Ellipse cx={w * 0.26} cy={h * 0.48} rx={w * 0.24} ry={h * 0.18} fill="rgba(61,229,255,0.08)" />
      <Ellipse cx={w * 0.66} cy={h * 0.34} rx={w * 0.3} ry={h * 0.2} fill="rgba(139,92,246,0.1)" />
      <Ellipse cx={w * 0.72} cy={h * 0.78} rx={w * 0.28} ry={h * 0.2} fill="rgba(52,211,153,0.08)" />

      <Path
        d={`M${w * -0.04} ${h * 0.78} C${w * 0.2} ${h * 0.66} ${w * 0.37} ${h * 0.72} ${w * 0.54} ${h * 0.59} C${w * 0.73} ${h * 0.44} ${w * 0.88} ${h * 0.49} ${w * 1.08} ${h * 0.35}`}
        fill="none"
        stroke="rgba(199,165,255,0.13)"
        strokeWidth={Math.max(14, h * 0.045)}
        strokeLinecap="round"
      />
      <Path
        d={`M${w * -0.08} ${h * 0.89} C${w * 0.14} ${h * 0.72} ${w * 0.34} ${h * 0.8} ${w * 0.54} ${h * 0.67} C${w * 0.76} ${h * 0.52} ${w * 0.9} ${h * 0.62} ${w * 1.08} ${h * 0.45}`}
        fill="none"
        stroke="rgba(61,229,255,0.1)"
        strokeWidth={Math.max(11, h * 0.034)}
        strokeLinecap="round"
      />

      <Rect x={-40} y={horizon} width={w + 80} height={h - horizon + 40} fill="rgba(3,16,18,0.62)" />
      <Ellipse cx={w * 0.28} cy={forestBase} rx={w * 0.48} ry={h * 0.2} fill="rgba(10,47,35,0.68)" />
      <Ellipse cx={w * 0.75} cy={forestBase * 0.98} rx={w * 0.44} ry={h * 0.19} fill="rgba(12,59,42,0.56)" />

      {BACKDROP_TREES.map((tree, index) => (
        <BackdropTree
          key={`menu-tree-${tree.x}-${index}`}
          x={tree.x * w}
          y={horizon + tree.y * (h - horizon)}
          size={tree.size * h}
          color={tree.magic ? '#1C7B4C' : '#115B3A'}
          glow={tree.magic}
        />
      ))}

      {BACKDROP_MOTES.map((mote, index) => (
        <Circle
          key={`menu-mote-${index}`}
          cx={mote.x * w}
          cy={mote.y * h}
          r={Math.max(1.4, mote.r * h)}
          fill={mote.color}
          opacity={mote.opacity}
        />
      ))}

      <Rect x={0} y={h * 0.58} width={w} height={h * 0.22} fill="rgba(61,229,255,0.035)" />
      <Rect x={0} y={h * 0.72} width={w} height={h * 0.18} fill="rgba(199,165,255,0.032)" />
      <Ellipse cx={w * 0.52} cy={h * 0.92} rx={w * 0.7} ry={h * 0.16} fill="rgba(4,10,12,0.56)" />
    </G>
  );
}

function BackdropTree({ x, y, size, color, glow }: { x: number; y: number; size: number; color: string; glow: boolean }) {
  const trunkWidth = Math.max(3, size * 0.08);
  const trunkHeight = size * 0.55;

  return (
    <G>
      {glow ? <Ellipse cx={x} cy={y - size * 0.48} rx={size * 0.46} ry={size * 0.3} fill="rgba(124,255,176,0.08)" /> : null}
      <Rect x={x - trunkWidth / 2} y={y - trunkHeight} width={trunkWidth} height={trunkHeight} fill="#092219" opacity={0.9} />
      <Polygon points={`${x},${y - size * 1.24} ${x - size * 0.46},${y - size * 0.46} ${x + size * 0.46},${y - size * 0.46}`} fill={color} opacity={0.9} />
      <Polygon points={`${x},${y - size * 0.95} ${x - size * 0.58},${y - size * 0.12} ${x + size * 0.58},${y - size * 0.12}`} fill={glow ? '#218E59' : '#164B34'} opacity={0.94} />
      <Polygon points={`${x},${y - size * 0.62} ${x - size * 0.66},${y + size * 0.16} ${x + size * 0.66},${y + size * 0.16}`} fill={glow ? '#176B45' : '#0F3D2C'} opacity={0.96} />
    </G>
  );
}

const BACKDROP_TREES = [
  { x: 0.04, y: 0.7, size: 0.2, magic: false },
  { x: 0.09, y: 0.55, size: 0.26, magic: true },
  { x: 0.15, y: 0.66, size: 0.18, magic: false },
  { x: 0.22, y: 0.44, size: 0.24, magic: false },
  { x: 0.3, y: 0.62, size: 0.16, magic: true },
  { x: 0.38, y: 0.5, size: 0.21, magic: false },
  { x: 0.47, y: 0.72, size: 0.18, magic: false },
  { x: 0.56, y: 0.48, size: 0.25, magic: true },
  { x: 0.65, y: 0.63, size: 0.18, magic: false },
  { x: 0.73, y: 0.42, size: 0.27, magic: false },
  { x: 0.82, y: 0.62, size: 0.2, magic: true },
  { x: 0.9, y: 0.52, size: 0.24, magic: false },
  { x: 0.97, y: 0.7, size: 0.19, magic: false },
] as const;

const BACKDROP_MOTES = Array.from({ length: 34 }, (_, index) => ({
  x: 0.06 + ((index * 37) % 88) / 100,
  y: 0.1 + ((index * 53) % 68) / 100,
  r: 0.003 + (index % 4) * 0.0014,
  opacity: 0.28 + (index % 5) * 0.08,
  color: index % 4 === 0 ? '#8EF7FF' : index % 4 === 1 ? '#FFD36A' : index % 4 === 2 ? '#C7A5FF' : '#7CFFB0',
}));

function MenuButton({ label, accent, onPress, highlightPulse }: { label: string; accent: string; onPress: () => void; highlightPulse?: Animated.Value }) {
  const handlePress = () => {
    playSfx('button');
    onPress();
  };
  const flashOpacity = highlightPulse?.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.48],
  });

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.menuButton, highlightPulse && styles.startMenuButton, pressed && styles.menuButtonPressed]}>
      <LinearGradient
        colors={highlightPulse ? ['#FFFFFF', '#D71920'] : [`${accent}36`, 'rgba(5,12,17,0.86)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.menuButtonGradient}
      >
        {highlightPulse ? <Animated.View pointerEvents="none" style={[styles.startFlash, { opacity: flashOpacity }]} /> : null}
        <View style={[styles.buttonDiamond, highlightPulse && styles.startButtonDiamond, { backgroundColor: highlightPulse ? '#FFFFFF' : accent }]} />
        <Text style={[styles.menuButtonText, highlightPulse && styles.startMenuButtonText]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function Stat({ label, value, color, compact = false }: { label: string; value: number; color: string; compact?: boolean }) {
  return (
    <View style={[styles.stat, compact && styles.statCompact]}>
      <Text style={[styles.statValue, compact && styles.statValueCompact, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, compact && styles.statLabelCompact]}>{label}</Text>
    </View>
  );
}

function CampaignStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.campaignStat}>
      <Text style={[styles.campaignStatValue, { color }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.campaignStatLabel}>{label}</Text>
    </View>
  );
}

function formatWavePreview(blades: number, sparkFrequency: number) {
  return sparkFrequency <= 1 ? `${blades}+S` : `${blades}+S/${sparkFrequency}`;
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  root: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
    paddingVertical: 22,
    overflow: 'hidden',
  },
  rootCompact: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  rootPortrait: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  menuBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: -20,
  },
  menuBackdropCanvas: {
    ...StyleSheet.absoluteFillObject,
  },
  particle: {
    position: 'absolute',
    opacity: 0.78,
  },
  leftPane: {
    width: '54%',
    gap: 13,
  },
  leftPaneCompact: {
    width: '60%',
    gap: 8,
  },
  leftPanePortrait: {
    width: '100%',
    gap: 9,
  },
  logoWrap: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  logo: {
    color: '#FFD36A',
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900',
    letterSpacing: 0,
    textShadowColor: 'rgba(255,211,106,0.42)',
    textShadowRadius: 12,
  },
  logoCompact: {
    fontSize: 29,
    lineHeight: 32,
  },
  logoPortrait: {
    fontSize: 31,
    lineHeight: 35,
  },
  logoShimmer: {
    position: 'absolute',
    top: -8,
    bottom: -8,
    width: 56,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  subtitle: {
    color: 'rgba(234,248,245,0.78)',
    fontSize: 14,
    fontWeight: '700',
  },
  subtitlePortrait: {
    fontSize: 13,
    lineHeight: 16,
  },
  namePanel: {
    width: '84%',
    borderWidth: 1,
    borderColor: 'rgba(61,229,255,0.38)',
    backgroundColor: 'rgba(5,12,17,0.62)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  namePanelCompact: {
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  fullWidthPanel: {
    width: '100%',
  },
  label: {
    color: 'rgba(234,248,245,0.62)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  input: {
    color: '#EAF8F5',
    fontSize: 17,
    fontWeight: '800',
    paddingVertical: 3,
  },
  campaignPanel: {
    width: '88%',
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.28)',
    backgroundColor: 'rgba(5,12,17,0.6)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  campaignPanelCompact: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 7,
  },
  campaignHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  campaignHeaderPortrait: {
    alignItems: 'flex-start',
    gap: 8,
  },
  campaignTitleWrap: {
    flex: 1,
    minWidth: 110,
  },
  campaignTitle: {
    color: '#EAF8F5',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  rewardStack: {
    minWidth: 52,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.25)',
    backgroundColor: 'rgba(255,211,106,0.1)',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  rewardValue: {
    color: '#FFD36A',
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  rewardLabel: {
    color: 'rgba(234,248,245,0.58)',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  campaignStats: {
    flexDirection: 'row',
    gap: 8,
  },
  campaignStatsPortrait: {
    gap: 6,
  },
  campaignStat: {
    flex: 1,
    minHeight: 34,
    borderRadius: 7,
    backgroundColor: 'rgba(234,248,245,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  campaignStatValue: {
    fontSize: 11,
    fontWeight: '900',
    maxWidth: '100%',
  },
  campaignStatLabel: {
    color: 'rgba(234,248,245,0.52)',
    fontSize: 8,
    fontWeight: '900',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  buttonGrid: {
    width: '88%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  buttonGridCompact: {
    gap: 8,
  },
  menuButton: {
    width: '47%',
    height: 46,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.14)',
  },
  startMenuButton: {
    borderColor: '#FFFFFF',
  },
  menuButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  menuButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 10,
  },
  startFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  buttonDiamond: {
    width: 14,
    height: 14,
    transform: [{ rotate: '45deg' }],
  },
  startButtonDiamond: {
    borderWidth: 1,
    borderColor: '#D71920',
  },
  menuButtonText: {
    color: '#EAF8F5',
    fontSize: 15,
    fontWeight: '900',
  },
  startMenuButtonText: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(80,0,0,0.55)',
    textShadowRadius: 5,
  },
  playerCard: {
    width: 260,
    padding: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.18)',
    backgroundColor: 'rgba(5,12,17,0.68)',
    alignItems: 'center',
    gap: 10,
  },
  playerCardCompact: {
    width: 190,
    padding: 9,
    gap: 5,
  },
  playerCardPortrait: {
    width: '100%',
    paddingVertical: 10,
    gap: 6,
  },
  heroPreview: {
    width: 144,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPreviewCompact: {
    width: 112,
    height: 90,
  },
  heroPreviewPortrait: {
    width: 108,
    height: 82,
  },
  previewGlow: {
    position: 'absolute',
    width: 116,
    height: 58,
    borderRadius: 58,
    borderWidth: 3,
    bottom: 12,
    opacity: 0.78,
  },
  previewCape: {
    position: 'absolute',
    width: 54,
    height: 68,
    borderRadius: 8,
    bottom: 32,
    transform: [{ skewX: '-10deg' }],
  },
  previewBody: {
    width: 52,
    height: 58,
    borderRadius: 8,
    bottom: -8,
    opacity: 0.95,
  },
  previewHead: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    top: 28,
    backgroundColor: '#EAF8F5',
  },
  previewSword: {
    position: 'absolute',
    width: 8,
    height: 72,
    right: 36,
    top: 38,
    borderRadius: 4,
    transform: [{ rotate: '18deg' }],
  },
  cardName: {
    color: '#EAF8F5',
    fontSize: 16,
    fontWeight: '900',
  },
  cardNamePortrait: {
    fontSize: 16,
    maxWidth: '100%',
  },
  cardMeta: {
    color: 'rgba(234,248,245,0.6)',
    fontSize: 11,
    fontWeight: '800',
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  statRowCompact: {
    gap: 6,
  },
  stat: {
    width: 66,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 8,
  },
  statCompact: {
    width: 48,
    paddingVertical: 5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  statValueCompact: {
    fontSize: 13,
  },
  statLabel: {
    color: 'rgba(234,248,245,0.55)',
    fontSize: 10,
    fontWeight: '800',
  },
  statLabelCompact: {
    fontSize: 8,
  },
});
