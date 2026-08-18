import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { playSfx } from '@/audio/sfx';
import { HeroPreviewBadge } from '@/components/HeroPreviewBadge';
import { MenuRouteScreen } from '@/components/MenuRouteScreen';
import { DEFAULT_PROFILE, loadProfile, saveProfile, type PlayerProfile } from '@/game/playerProfile';
import type { HeroDesignId } from '@/game/types';

const COLORS = ['#3DE5FF', '#FFD36A', '#8B5CF6', '#34D399', '#FF5533', '#DDE7F0', '#FF8CDA', '#7CFFB0', '#74E7FF', '#C7A5FF', '#F97316', '#A3E635'];
const DESIGNS: Array<{ id: HeroDesignId; label: string; meta: string }> = [
  { id: 'knight', label: 'Knight', meta: 'Sword and shield' },
  { id: 'mage', label: 'Mage', meta: 'Staff and orb' },
  { id: 'berserker', label: 'Berserker', meta: 'Dual heavy weapons' },
  { id: 'ranger', label: 'Ranger', meta: 'Bow and hood' },
  { id: 'warlock', label: 'Warlock', meta: 'Floating dark magic' },
  { id: 'paladin', label: 'Paladin', meta: 'Hammer and halo' },
];

export default function CustomizeRoute() {
  const { width } = useWindowDimensions();
  const compact = width < 620;
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

  const persist = (nextProfile: PlayerProfile) => {
    setProfile(nextProfile);
    void saveProfile(nextProfile);
  };

  const selectColor = (color: string) => {
    playSfx('button');
    persist({ ...profile, heroColor: color });
  };

  const selectDesign = (design: HeroDesignId) => {
    playSfx('button');
    persist({ ...profile, heroDesign: design });
  };

  return (
    <MenuRouteScreen title="Customize" accent="#8B5CF6">
      <ScrollView
        horizontal={!compact}
        contentInsetAdjustmentBehavior="automatic"
        indicatorStyle="white"
        persistentScrollbar
        showsHorizontalScrollIndicator={!compact}
        showsVerticalScrollIndicator={compact}
        style={styles.scroll}
        contentContainerStyle={[styles.grid, compact && styles.gridCompact]}
      >
        <View style={[styles.previewPanel, compact && styles.previewPanelCompact]}>
          <View style={[styles.heroPreview, { boxShadow: `0 0 16px ${profile.heroColor}` }]}>
            <HeroPreviewBadge color={profile.heroColor} design={profile.heroDesign} size={compact ? 104 : 126} />
          </View>
          <Text style={styles.previewName} numberOfLines={1}>{profile.name.trim() || 'Arc Knight'}</Text>
          <Text style={styles.previewMeta}>{DESIGNS.find((design) => design.id === profile.heroDesign)?.label ?? 'Knight'} champion</Text>
        </View>
        <View style={[styles.panel, compact && styles.panelCompact]}>
          <Text style={styles.heading}>Hero Color</Text>
          <View style={styles.swatches}>
            {COLORS.map((color) => (
              <Pressable
                key={color}
                accessibilityRole="button"
                accessibilityLabel={`Select ${color}`}
                onPress={() => selectColor(color)}
                style={({ pressed }) => [
                  styles.swatch,
                  { backgroundColor: color },
                  profile.heroColor === color && styles.selectedSwatch,
                  pressed && styles.pressed,
                ]}
              />
            ))}
          </View>
        </View>
        <View style={[styles.panel, compact && styles.panelCompact]}>
          <Text style={styles.heading}>Hero Design</Text>
          <View style={styles.designGrid}>
            {DESIGNS.map((design) => (
              <Pressable
                key={design.id}
                accessibilityRole="button"
                accessibilityLabel={`Select ${design.label}`}
                onPress={() => selectDesign(design.id)}
                style={({ pressed }) => [
                  styles.designPill,
                  profile.heroDesign === design.id && styles.selectedDesign,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.designText}>{design.label}</Text>
                <Text style={styles.designMeta}>{design.meta}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </MenuRouteScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'stretch',
    paddingRight: 42,
    paddingBottom: 8,
  },
  gridCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingRight: 12,
    paddingBottom: 30,
  },
  previewPanel: {
    width: 190,
    minHeight: 220,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.4)',
    backgroundColor: 'rgba(5,12,17,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewPanelCompact: {
    width: '100%',
    minHeight: 170,
  },
  heroPreview: {
    width: 116,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewGlow: {
    position: 'absolute',
    width: 100,
    height: 62,
    borderRadius: 50,
    borderWidth: 2,
    opacity: 0.76,
    boxShadow: '0 0 12px rgba(199,165,255,0.7)',
  },
  previewCape: {
    position: 'absolute',
    width: 58,
    height: 70,
    borderRadius: 8,
    transform: [{ rotate: '-16deg' }],
  },
  previewBody: {
    width: 48,
    height: 58,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(234,248,245,0.72)',
  },
  previewHead: {
    position: 'absolute',
    top: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EAF8F5',
  },
  previewWeapon: {
    position: 'absolute',
    right: 18,
    width: 8,
    height: 66,
    borderRadius: 4,
    transform: [{ rotate: '24deg' }],
  },
  previewName: {
    color: '#EAF8F5',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 10,
    maxWidth: '100%',
  },
  previewMeta: {
    color: 'rgba(234,248,245,0.58)',
    fontSize: 11,
    fontWeight: '800',
  },
  panel: {
    width: 286,
    minHeight: 180,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.16)',
    backgroundColor: 'rgba(5,12,17,0.62)',
    padding: 16,
  },
  panelCompact: {
    width: '100%',
    minHeight: 0,
  },
  heading: {
    color: '#EAF8F5',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 16,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'rgba(234,248,245,0.62)',
  },
  selectedSwatch: {
    borderColor: '#FFFFFF',
    borderWidth: 4,
  },
  pressed: {
    opacity: 0.72,
  },
  designGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  designPill: {
    minWidth: 108,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.52)',
    backgroundColor: 'rgba(139,92,246,0.16)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectedDesign: {
    borderColor: '#FFD36A',
    backgroundColor: 'rgba(255,211,106,0.16)',
  },
  designText: {
    color: '#EAF8F5',
    fontSize: 13,
    fontWeight: '900',
  },
  designMeta: {
    color: 'rgba(234,248,245,0.52)',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
  },
});
