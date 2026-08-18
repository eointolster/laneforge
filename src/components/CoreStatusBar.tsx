import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS, TEAM_COLORS } from '@/game/constants';
import type { Hero, Structure, Team } from '@/game/types';

type CoreStatusBarProps = {
  team: Team;
  core?: Structure;
  hero?: Hero;
};

export function CoreStatusBar({ team, core, hero }: CoreStatusBarProps) {
  const coreRatio = core ? Math.max(0, Math.min(1, core.hp / core.maxHp)) : 0;
  const heroRatio = hero ? Math.max(0, Math.min(1, hero.hp / hero.maxHp)) : 0;
  const [coreDrainRatio, setCoreDrainRatio] = useState(coreRatio);
  const [heroDrainRatio, setHeroDrainRatio] = useState(heroRatio);
  const color = TEAM_COLORS[team].main;

  useEffect(() => {
    if (coreRatio >= coreDrainRatio) {
      setCoreDrainRatio(coreRatio);
      return undefined;
    }

    const timer = setTimeout(() => setCoreDrainRatio(coreRatio), 240);
    return () => clearTimeout(timer);
  }, [coreDrainRatio, coreRatio]);

  useEffect(() => {
    if (heroRatio >= heroDrainRatio) {
      setHeroDrainRatio(heroRatio);
      return undefined;
    }

    const timer = setTimeout(() => setHeroDrainRatio(heroRatio), 220);
    return () => clearTimeout(timer);
  }, [heroDrainRatio, heroRatio]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>{team === 'blue' ? 'BLUE' : 'RED'}</Text>
        <Text style={styles.value}>{core ? Math.ceil(core.hp) : 0}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.drain, { width: `${coreDrainRatio * 100}%` }]} />
        <View style={[styles.fill, { width: `${coreRatio * 100}%`, backgroundColor: color }]} />
      </View>
      {hero ? (
        <View style={styles.heroTrack}>
          <View style={[styles.heroDrain, { width: `${heroDrainRatio * 100}%` }]} />
          <View style={[styles.heroFill, { width: `${heroRatio * 100}%`, backgroundColor: TEAM_COLORS[hero.team].soft }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 124,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(5,12,17,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.16)',
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '900',
  },
  value: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '900',
  },
  track: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.13)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  drain: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  heroTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  heroFill: {
    height: '100%',
    borderRadius: 2,
  },
  heroDrain: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
