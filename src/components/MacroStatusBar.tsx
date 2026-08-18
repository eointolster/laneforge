import { StyleSheet, Text, View } from 'react-native';

import { COLORS, TEAM_COLORS } from '@/game/constants';
import type { GameState, Team } from '@/game/types';

type MacroStatusBarProps = {
  state: GameState;
};

export function MacroStatusBar({ state }: MacroStatusBarProps) {
  const blueCore = state.structures.find((structure) => structure.id === 'blue-core');
  const redCore = state.structures.find((structure) => structure.id === 'red-core');
  const blueRatio = blueCore ? Math.max(0, Math.min(1, blueCore.hp / blueCore.maxHp)) : 0;
  const redRatio = redCore ? Math.max(0, Math.min(1, redCore.hp / redCore.maxHp)) : 0;
  const minutes = Math.floor(state.time / 60);
  const seconds = Math.floor(state.time % 60).toString().padStart(2, '0');

  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.killBlue}>{state.teamKills.blue}</Text>
        <View style={styles.timerStack}>
          <Text style={styles.level}>L{state.levelConfig.level}  W{state.waveNumber}</Text>
          <Text style={styles.timer}>{minutes}:{seconds}</Text>
        </View>
        <Text style={styles.killRed}>{state.teamKills.red}</Text>
      </View>
      <View style={styles.coreTrack}>
        <View style={styles.coreHalf}>
          <View style={[styles.blueCoreFill, { width: `${blueRatio * 100}%` }]} />
        </View>
        <View style={styles.midLine} />
        <View style={styles.coreHalf}>
          <View style={[styles.redCoreFill, { width: `${redRatio * 100}%` }]} />
        </View>
      </View>
      <View style={styles.towerRow}>
        <TowerPips state={state} team="blue" />
        <Text style={styles.coreLabel}>CORES</Text>
        <TowerPips state={state} team="red" />
      </View>
    </View>
  );
}

function TowerPips({ state, team }: { state: GameState; team: Team }) {
  const towers = state.structures.filter((structure) => structure.team === team && structure.kind === 'tower');

  return (
    <View style={[styles.pips, team === 'red' && styles.pipsReverse]}>
      {towers.map((tower) => (
        <View
          key={tower.id}
          style={[
            styles.pip,
            { borderColor: TEAM_COLORS[team].soft },
            tower.alive && { backgroundColor: TEAM_COLORS[team].main },
            !tower.alive && styles.pipDown,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 330,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.14)',
    backgroundColor: 'rgba(5,12,17,0.68)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  killBlue: {
    color: TEAM_COLORS.blue.soft,
    fontSize: 17,
    fontWeight: '900',
    minWidth: 32,
    textAlign: 'left',
  },
  killRed: {
    color: TEAM_COLORS.red.soft,
    fontSize: 17,
    fontWeight: '900',
    minWidth: 32,
    textAlign: 'right',
  },
  timerStack: {
    alignItems: 'center',
  },
  level: {
    color: COLORS.warning,
    fontSize: 12,
    fontWeight: '900',
  },
  timer: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  coreTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(234,248,245,0.12)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  coreHalf: {
    flex: 1,
    justifyContent: 'center',
  },
  blueCoreFill: {
    alignSelf: 'flex-end',
    height: '100%',
    backgroundColor: TEAM_COLORS.blue.main,
  },
  redCoreFill: {
    alignSelf: 'flex-start',
    height: '100%',
    backgroundColor: TEAM_COLORS.red.main,
  },
  midLine: {
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  towerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pips: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  pipsReverse: {
    justifyContent: 'flex-end',
  },
  pip: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
    backgroundColor: 'transparent',
  },
  pipDown: {
    opacity: 0.28,
  },
  coreLabel: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '900',
  },
});
