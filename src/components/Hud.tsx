import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ECONOMY_BALANCE, HERO_BALANCE } from '@/game/balance';
import { BASE_POSITIONS, COLORS, TEAM_COLORS } from '@/game/constants';
import { canBuyBaseForge, canBuyBaseWard } from '@/game/systems/economySystem';
import type { AbilityId, CameraState, GameState, GraphicsQuality } from '@/game/types';
import { distance } from '@/utils/math';
import { EventBanner } from './EventBanner';
import { HealthBar } from './HealthBar';
import { KillFeed } from './KillFeed';
import { MacroStatusBar } from './MacroStatusBar';
import { MiniMap } from './MiniMap';

type HudProps = {
  state: GameState;
  camera: CameraState;
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSurrender: () => void;
  onQuitToMenu: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  fpsMeterEnabled: boolean;
  onToggleFpsMeter: () => void;
  graphicsQuality: GraphicsQuality;
  onToggleGraphicsQuality: () => void;
  onBuyBaseWard: () => void;
  onBuyBaseForge: () => void;
  equippedAbilities: AbilityId[];
};

type UtilityPanel = 'surrender' | 'controls' | 'settings' | null;

export function Hud({
  state,
  camera,
  paused,
  onPause,
  onResume,
  onReset,
  onSurrender,
  onQuitToMenu,
  soundEnabled,
  onToggleSound,
  fpsMeterEnabled,
  onToggleFpsMeter,
  graphicsQuality,
  onToggleGraphicsQuality,
  onBuyBaseWard,
  onBuyBaseForge,
  equippedAbilities,
}: HudProps) {
  const insets = useSafeAreaInsets();
  const [panel, setPanel] = useState<UtilityPanel>(null);
  const hero = state.heroes.player;
  const xpNeeded = HERO_BALANCE.xpPerLevel + (hero.level - 1) * 58;
  const xpRatio = Math.max(0, Math.min(1, hero.xp / xpNeeded));
  const bossStatus = state.jungleBoss && Number.isFinite(state.jungleBoss.respawnTimer)
    ? state.jungleBoss.alive
      ? 'Boss up'
      : `Boss ${Math.ceil(state.jungleBoss.respawnTimer)}s`
    : null;
  const heroActive = hero.hp > 0 && hero.respawnTimer <= 0;
  const baseDistance = distance(hero.position, BASE_POSITIONS.blue);
  const inBase = heroActive && baseDistance <= ECONOMY_BALANCE.baseHealRadius;
  const canBuyWard = canBuyBaseWard(hero);
  const canBuyForge = canBuyBaseForge(hero);
  const wardGoldShortfall = Math.max(0, Math.ceil(ECONOMY_BALANCE.baseArmoryGoldCost - hero.gold));
  const forgeGoldShortfall = Math.max(0, Math.ceil(ECONOMY_BALANCE.baseForgeGoldCost - hero.gold));
  const canArmWardSoon = inBase && hero.shieldTimer <= 0;
  const canForgeSoon = inBase && hero.weaponBoostTimer <= 0;
  const baseStatus = inBase
    ? canBuyWard
        ? `Ward ${ECONOMY_BALANCE.baseArmoryGoldCost}g`
        : hero.hp < hero.maxHp - 1
          ? 'Fountain'
          : canArmWardSoon
            ? `Need ${wardGoldShortfall}g`
            : `Ward ${Math.ceil(hero.shieldTimer)}s`
    : null;
  const forgeStatus = hero.weaponBoostTimer > 0
    ? `Power ${Math.ceil(hero.weaponBoostTimer)}s`
    : inBase
      ? canBuyForge
          ? `Power ${ECONOMY_BALANCE.baseForgeGoldCost}g`
          : canForgeSoon
            ? `Need ${forgeGoldShortfall}g`
            : null
      : null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={[styles.topLeft, { top: 8 + insets.top }]}>
        <View style={styles.utilityRow}>
          <UtilityButton label={paused ? 'Paused' : 'Pause'} onPress={onPause} />
          <UtilityButton label="Controls" onPress={() => setPanel(panel === 'controls' ? null : 'controls')} />
          <UtilityButton label="Settings" onPress={() => setPanel(panel === 'settings' ? null : 'settings')} />
        </View>
        <UtilityOverlay
          panel={panel}
          soundEnabled={soundEnabled}
          onCancel={() => setPanel(null)}
          onConfirmSurrender={() => {
            setPanel(null);
            onSurrender();
          }}
          onToggleSound={onToggleSound}
          fpsMeterEnabled={fpsMeterEnabled}
          onToggleFpsMeter={onToggleFpsMeter}
          graphicsQuality={graphicsQuality}
          onToggleGraphicsQuality={onToggleGraphicsQuality}
        />
        <KillFeed events={state.events} time={state.time} />
      </View>

      <EventBanner events={state.events} time={state.time} />
      <View style={[styles.macroWrap, { top: 8 + insets.top }]}>
        <MacroStatusBar state={state} />
      </View>

      {paused ? (
        <PauseOverlay
          soundEnabled={soundEnabled}
          fpsMeterEnabled={fpsMeterEnabled}
          graphicsQuality={graphicsQuality}
          onResume={onResume}
          onRestart={() => {
            onResume();
            onReset();
          }}
          onQuitToMenu={onQuitToMenu}
          onSurrender={() => {
            onResume();
            onSurrender();
          }}
          onToggleSound={onToggleSound}
          onToggleFpsMeter={onToggleFpsMeter}
          onToggleGraphicsQuality={onToggleGraphicsQuality}
        />
      ) : null}

      <View style={[styles.topRight, { top: 8 + insets.top }]}>
        <View style={styles.redRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Restart" onPress={onReset} style={styles.resetButton}>
            <Text style={styles.resetText}>R</Text>
          </Pressable>
        </View>
        <View style={styles.minimapStack}>
          <MiniMap state={state} camera={camera} />
          {bossStatus ? (
            <View style={[styles.bossStatusPill, state.jungleBoss?.alive && styles.bossStatusPillActive]}>
              <View style={[styles.bossStatusGem, state.jungleBoss?.alive && styles.bossStatusGemActive]} />
              <Text style={[styles.bossStatusText, state.jungleBoss?.alive && styles.bossStatusTextActive]}>
                {bossStatus}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.heroChip, { bottom: 8 + insets.bottom }]}>
        <View style={[styles.heroPortrait, { borderColor: hero.heroColor ?? TEAM_COLORS.blue.soft, backgroundColor: `${hero.heroColor ?? TEAM_COLORS.blue.main}26` }]}>
          <View style={[styles.heroPortraitDiamond, { backgroundColor: hero.heroColor ?? TEAM_COLORS.blue.main }]} />
          <View style={[styles.heroPortraitCore, { backgroundColor: hero.heroColor ?? TEAM_COLORS.blue.soft }]} />
        </View>
        <View style={styles.heroPanel}>
          <View style={styles.heroLine}>
            <View style={styles.heroNameWrap}>
              <Text style={styles.heroName} numberOfLines={1}>{hero.name}</Text>
              <View style={styles.cooldownDots}>
                {equippedAbilities.map((ability) => {
                  const cooldown = hero.cooldowns[ability] ?? 0;
                  const ready = cooldown <= 0;
                  return <View key={ability} style={[styles.cooldownDot, ready && styles.cooldownDotReady, ability === 'ult' && styles.ultimateDot]} />;
                })}
              </View>
            </View>
          </View>
          <HealthBar value={hero.hp} max={hero.maxHp} color={TEAM_COLORS.blue.soft} compact />
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${xpRatio * 100}%` }]} />
          </View>
          <View style={styles.heroMetaRow}>
            <Text style={styles.heroMeta}>LV {hero.level}  XP {Math.floor(hero.xp)}/{xpNeeded}</Text>
            {hero.shield > 0 && hero.shieldTimer > 0 ? (
              <View style={styles.shieldPill}>
                <Text style={styles.shieldText}>Shield {Math.ceil(hero.shield)}</Text>
              </View>
            ) : null}
            {hero.powerShield > 0 ? (
              <View style={styles.powerShieldPill}>
                <Text style={styles.powerShieldText}>Sphere {Math.ceil(hero.powerShield)}</Text>
              </View>
            ) : null}
            {hero.attackSpeedBoostTimer > 0 ? (
              <View style={styles.speedBuffPill}>
                <Text style={styles.speedBuffText}>Rapid {Math.ceil(hero.attackSpeedBoostTimer)}s</Text>
              </View>
            ) : null}
            {hero.respawnTimer > 0 ? (
              <View style={styles.respawnPill}>
                <Text style={styles.respawnText}>Respawn {Math.ceil(hero.respawnTimer)}s</Text>
              </View>
            ) : null}
            {hero.bossBuffTimer > 0 ? (
              <View style={styles.bossBuffPill}>
                <Text style={styles.bossBuffText}>Dragon +10% {Math.ceil(hero.bossBuffTimer)}s</Text>
              </View>
            ) : null}
            {hero.bearBuffTimer > 0 ? (
              <View style={styles.bearBuffPill}>
                <Text style={styles.bearBuffText}>Bear Regen {Math.ceil(hero.bearBuffTimer)}s</Text>
              </View>
            ) : null}
            {hero.dragonBuffTimer > 0 ? (
              <View style={styles.dragonBuffPill}>
                <Text style={styles.dragonBuffText}>Dragon Fire {Math.ceil(hero.dragonBuffTimer)}s</Text>
              </View>
            ) : null}
            {forgeStatus ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={canBuyForge ? 'Buy base power' : forgeStatus}
                disabled={!canBuyForge}
                onPress={onBuyBaseForge}
                style={({ pressed }) => [styles.forgePill, canBuyForge && styles.forgePillReady, pressed && canBuyForge && styles.basePillPressed]}
              >
                <Text style={[styles.forgeText, canBuyForge && styles.forgeTextReady]}>{forgeStatus}</Text>
              </Pressable>
            ) : null}
            {baseStatus ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={canBuyWard ? 'Buy base ward' : baseStatus}
                disabled={!canBuyWard}
                onPress={onBuyBaseWard}
                style={({ pressed }) => [styles.basePill, canBuyWard && styles.basePillReady, pressed && canBuyWard && styles.basePillPressed]}
              >
                <Text style={[styles.baseText, canBuyWard && styles.baseTextReady]}>{baseStatus}</Text>
              </Pressable>
            ) : null}
            <View style={styles.goldPill}>
              <View style={styles.goldDiamond} />
              <Text style={styles.goldLabel}>Gold</Text>
              <Text style={styles.goldText}>{Math.floor(hero.gold)}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function UtilityButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.utilityButton, pressed && styles.utilityButtonPressed]}>
      <Text style={styles.utilityText}>{label}</Text>
    </Pressable>
  );
}

function UtilityOverlay({
  panel,
  soundEnabled,
  fpsMeterEnabled,
  onCancel,
  onConfirmSurrender,
  onToggleSound,
  onToggleFpsMeter,
  graphicsQuality,
  onToggleGraphicsQuality,
}: {
  panel: UtilityPanel;
  soundEnabled: boolean;
  fpsMeterEnabled: boolean;
  onCancel: () => void;
  onConfirmSurrender: () => void;
  onToggleSound: () => void;
  onToggleFpsMeter: () => void;
  graphicsQuality: GraphicsQuality;
  onToggleGraphicsQuality: () => void;
}) {
  if (!panel) return null;

  if (panel === 'surrender') {
    return (
      <View style={styles.utilityPanel}>
        <Text style={styles.panelTitle}>Surrender match?</Text>
        <Text style={styles.panelText}>This counts as a defeat for the current campaign level.</Text>
        <View style={styles.panelActions}>
          <PanelButton label="Cancel" onPress={onCancel} />
          <PanelButton label="Surrender" onPress={onConfirmSurrender} danger />
        </View>
      </View>
    );
  }

  if (panel === 'controls') {
    return (
      <View style={styles.utilityPanel}>
        <Text style={styles.panelTitle}>Controls</Text>
        <Text style={styles.panelText}>Left joystick moves your champion. Ability buttons cast your equipped loadout. Clear jungle camps for Bear Regen or Dragon Fire, and finish match goals for bonus rewards. At base, tap Ward or Power.</Text>
        <View style={styles.panelActions}>
          <PanelButton label="Close" onPress={onCancel} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.utilityPanel}>
      <Text style={styles.panelTitle}>Settings</Text>
      <View style={styles.settingRow}>
        <Text style={styles.panelText}>Sound effects</Text>
        <Toggle checked={soundEnabled} onPress={onToggleSound} />
      </View>
      <View style={styles.settingRow}>
        <Text style={styles.panelText}>FPS meter</Text>
        <Toggle checked={fpsMeterEnabled} onPress={onToggleFpsMeter} />
      </View>
      <View style={styles.settingRow}>
        <View>
          <Text style={styles.panelText}>Graphics</Text>
          <Text style={styles.settingHint}>{graphicsQuality === 'high' ? 'High detail' : 'Performance'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Toggle graphics quality" onPress={onToggleGraphicsQuality} style={styles.segmentedToggle}>
          <View style={[styles.segment, graphicsQuality === 'performance' && styles.segmentActive]}>
            <Text style={[styles.segmentText, graphicsQuality === 'performance' && styles.segmentTextActive]}>FPS</Text>
          </View>
          <View style={[styles.segment, graphicsQuality === 'high' && styles.segmentActive]}>
            <Text style={[styles.segmentText, graphicsQuality === 'high' && styles.segmentTextActive]}>FX</Text>
          </View>
        </Pressable>
      </View>
      <View style={styles.panelActions}>
        <PanelButton label="Close" onPress={onCancel} />
      </View>
    </View>
  );
}

function PauseOverlay({
  soundEnabled,
  fpsMeterEnabled,
  graphicsQuality,
  onResume,
  onRestart,
  onQuitToMenu,
  onSurrender,
  onToggleSound,
  onToggleFpsMeter,
  onToggleGraphicsQuality,
}: {
  soundEnabled: boolean;
  fpsMeterEnabled: boolean;
  graphicsQuality: GraphicsQuality;
  onResume: () => void;
  onRestart: () => void;
  onQuitToMenu: () => void;
  onSurrender: () => void;
  onToggleSound: () => void;
  onToggleFpsMeter: () => void;
  onToggleGraphicsQuality: () => void;
}) {
  return (
    <View style={styles.pauseScrim}>
      <View style={styles.pausePanel}>
        <Text style={styles.pauseTitle}>Paused</Text>
        <View style={styles.pauseActions}>
          <PanelButton label="Resume" onPress={onResume} />
          <PanelButton label="Restart" onPress={onRestart} />
          <PanelButton label="Menu" onPress={onQuitToMenu} />
          <PanelButton label="Surrender" onPress={onSurrender} danger />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.panelText}>Sound effects</Text>
          <Toggle checked={soundEnabled} onPress={onToggleSound} />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.panelText}>FPS meter</Text>
          <Toggle checked={fpsMeterEnabled} onPress={onToggleFpsMeter} />
        </View>
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.panelText}>Graphics</Text>
            <Text style={styles.settingHint}>{graphicsQuality === 'high' ? 'High detail' : 'Performance'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Toggle graphics quality" onPress={onToggleGraphicsQuality} style={styles.segmentedToggle}>
            <View style={[styles.segment, graphicsQuality === 'performance' && styles.segmentActive]}>
              <Text style={[styles.segmentText, graphicsQuality === 'performance' && styles.segmentTextActive]}>FPS</Text>
            </View>
            <View style={[styles.segment, graphicsQuality === 'high' && styles.segmentActive]}>
              <Text style={[styles.segmentText, graphicsQuality === 'high' && styles.segmentTextActive]}>FX</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Toggle({ checked, onPress }: { checked: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked }} onPress={onPress} style={[styles.toggle, checked && styles.toggleOn]}>
      <View style={[styles.toggleKnob, checked && styles.toggleKnobOn]} />
    </Pressable>
  );
}

function PanelButton({ label, onPress, danger = false }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.panelButton, danger && styles.panelDangerButton, pressed && styles.utilityButtonPressed]}>
      <Text style={[styles.panelButtonText, danger && styles.panelDangerText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  topLeft: {
    position: 'absolute',
    left: 10,
    gap: 6,
  },
  macroWrap: {
    position: 'absolute',
    alignSelf: 'center',
  },
  utilityRow: {
    flexDirection: 'row',
    gap: 5,
  },
  utilityButton: {
    height: 28,
    borderRadius: 7,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,12,17,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.16)',
  },
  utilityButtonPressed: {
    opacity: 0.72,
  },
  utilityText: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '900',
  },
  utilityPanel: {
    width: 250,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.18)',
    backgroundColor: 'rgba(5,12,17,0.88)',
    padding: 10,
    gap: 8,
  },
  panelTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
  },
  panelText: {
    color: COLORS.mutedText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
  },
  panelActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  panelButton: {
    height: 28,
    minWidth: 68,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.16)',
    backgroundColor: 'rgba(234,248,245,0.08)',
  },
  panelDangerButton: {
    borderColor: 'rgba(255,85,51,0.42)',
    backgroundColor: 'rgba(255,85,51,0.16)',
  },
  panelButtonText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '900',
  },
  panelDangerText: {
    color: TEAM_COLORS.red.soft,
  },
  settingRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingHint: {
    color: 'rgba(156,183,178,0.62)',
    fontSize: 8,
    fontWeight: '800',
    marginTop: -1,
  },
  segmentedToggle: {
    height: 24,
    width: 70,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.18)',
    backgroundColor: 'rgba(234,248,245,0.08)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: 'rgba(61,229,255,0.24)',
  },
  segmentText: {
    color: COLORS.mutedText,
    fontSize: 9,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: COLORS.text,
  },
  toggle: {
    width: 42,
    height: 22,
    borderRadius: 11,
    padding: 2,
    backgroundColor: 'rgba(234,248,245,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.18)',
  },
  toggleOn: {
    backgroundColor: 'rgba(61,229,255,0.22)',
    borderColor: TEAM_COLORS.blue.soft,
  },
  toggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.mutedText,
  },
  toggleKnobOn: {
    transform: [{ translateX: 18 }],
    backgroundColor: TEAM_COLORS.blue.soft,
  },
  pauseScrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  pausePanel: {
    width: 310,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.2)',
    backgroundColor: 'rgba(5,12,17,0.94)',
    padding: 14,
    gap: 12,
  },
  pauseTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  pauseActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  centerPill: {
    position: 'absolute',
    alignSelf: 'center',
    minWidth: 178,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.15)',
    backgroundColor: 'rgba(5,12,17,0.62)',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  blueAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: TEAM_COLORS.blue.main,
  },
  redAccent: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: TEAM_COLORS.red.main,
  },
  timerStack: {
    alignItems: 'center',
    minWidth: 96,
  },
  levelLabel: {
    color: COLORS.warning,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: -1,
  },
  timer: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
  },
  wave: {
    color: COLORS.mutedText,
    fontSize: 8,
    fontWeight: '800',
    marginTop: -1,
    maxWidth: 118,
  },
  scoreBlue: {
    color: TEAM_COLORS.blue.soft,
    fontSize: 13,
    fontWeight: '900',
    minWidth: 30,
    textAlign: 'center',
  },
  scoreRed: {
    color: TEAM_COLORS.red.soft,
    fontSize: 13,
    fontWeight: '900',
    minWidth: 30,
    textAlign: 'center',
  },
  goalStrip: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: 330,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  goalPill: {
    minHeight: 18,
    maxWidth: 104,
    borderRadius: 6,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(5,12,17,0.54)',
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.2)',
  },
  goalPillComplete: {
    backgroundColor: 'rgba(124,255,176,0.14)',
    borderColor: 'rgba(124,255,176,0.36)',
  },
  goalProgress: {
    color: COLORS.warning,
    fontSize: 8,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  goalProgressComplete: {
    color: '#BFFFD4',
  },
  goalLabel: {
    color: COLORS.mutedText,
    fontSize: 8,
    fontWeight: '900',
    maxWidth: 72,
  },
  goalLabelComplete: {
    color: '#D7FFE4',
  },
  topRight: {
    position: 'absolute',
    right: 10,
    alignItems: 'flex-end',
    gap: 6,
  },
  redRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resetButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,12,17,0.54)',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.18)',
  },
  resetText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '900',
  },
  minimapStack: {
    alignItems: 'flex-end',
    gap: 4,
    opacity: 0.85,
  },
  bossStatusPill: {
    minHeight: 18,
    borderRadius: 9,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(11,19,24,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(217,194,255,0.22)',
  },
  bossStatusPillActive: {
    backgroundColor: 'rgba(73,34,120,0.46)',
    borderColor: 'rgba(217,194,255,0.46)',
  },
  bossStatusGem: {
    width: 7,
    height: 7,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1,
    borderColor: 'rgba(217,194,255,0.54)',
  },
  bossStatusGemActive: {
    backgroundColor: '#9B5CFF',
    borderColor: '#F0E4FF',
  },
  bossStatusText: {
    color: 'rgba(217,194,255,0.72)',
    fontSize: 9,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  bossStatusTextActive: {
    color: '#F0E4FF',
  },
  heroChip: {
    position: 'absolute',
    alignSelf: 'center',
    width: 286,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(5,12,17,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroPortrait: {
    width: 34,
    height: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(71,216,255,0.18)',
    borderWidth: 1,
    borderColor: TEAM_COLORS.blue.soft,
  },
  heroPortraitDiamond: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  heroPortraitCore: {
    width: 8,
    height: 8,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  heroPanel: {
    flex: 1,
    gap: 3,
  },
  heroLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroNameWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroName: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '900',
    maxWidth: 86,
  },
  cooldownDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cooldownDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(156,183,178,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.14)',
  },
  cooldownDotReady: {
    backgroundColor: TEAM_COLORS.blue.soft,
    borderColor: 'rgba(234,248,245,0.72)',
  },
  ultimateDot: {
    backgroundColor: COLORS.warning,
  },
  xpTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,211,106,0.12)',
    overflow: 'hidden',
    marginTop: -1,
  },
  xpFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: COLORS.warning,
  },
  heroMeta: {
    color: COLORS.mutedText,
    fontSize: 9,
    fontWeight: '800',
    flexShrink: 1,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 5,
  },
  bossBuffPill: {
    minHeight: 14,
    borderRadius: 7,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,211,106,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.32)',
  },
  bossBuffText: {
    color: '#FFE9A8',
    fontSize: 8,
    fontWeight: '900',
  },
  bearBuffPill: {
    minHeight: 14,
    borderRadius: 7,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,255,176,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(124,255,176,0.34)',
  },
  bearBuffText: {
    color: '#D7FFE4',
    fontSize: 8,
    fontWeight: '900',
  },
  dragonBuffPill: {
    minHeight: 14,
    borderRadius: 7,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,159,47,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.36)',
  },
  dragonBuffText: {
    color: '#FFE9A8',
    fontSize: 8,
    fontWeight: '900',
  },
  forgePill: {
    minHeight: 14,
    borderRadius: 7,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(199,165,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(199,165,255,0.28)',
  },
  forgePillReady: {
    backgroundColor: 'rgba(255,211,106,0.14)',
    borderColor: 'rgba(255,211,106,0.34)',
  },
  forgeText: {
    color: '#DECFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  forgeTextReady: {
    color: '#FFE9A8',
  },
  shieldPill: {
    minHeight: 14,
    borderRadius: 7,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(136,238,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(136,238,255,0.32)',
  },
  shieldText: {
    color: '#D8FBFF',
    fontSize: 8,
    fontWeight: '900',
  },
  powerShieldPill: {
    minHeight: 14,
    borderRadius: 7,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(136,238,255,0.17)',
    borderWidth: 1,
    borderColor: 'rgba(216,251,255,0.42)',
  },
  powerShieldText: {
    color: '#EAFBFF',
    fontSize: 8,
    fontWeight: '900',
  },
  speedBuffPill: {
    minHeight: 14,
    borderRadius: 7,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,211,106,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,211,106,0.38)',
  },
  speedBuffText: {
    color: '#FFF7D6',
    fontSize: 8,
    fontWeight: '900',
  },
  basePill: {
    minHeight: 14,
    borderRadius: 7,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,255,176,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124,255,176,0.28)',
  },
  basePillReady: {
    backgroundColor: 'rgba(255,211,106,0.14)',
    borderColor: 'rgba(255,211,106,0.34)',
  },
  basePillPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.97 }],
  },
  baseText: {
    color: '#BFFFD4',
    fontSize: 8,
    fontWeight: '900',
  },
  baseTextReady: {
    color: '#FFE9A8',
  },
  respawnPill: {
    minHeight: 14,
    borderRadius: 7,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,85,51,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,176,150,0.34)',
  },
  respawnText: {
    color: TEAM_COLORS.red.soft,
    fontSize: 8,
    fontWeight: '900',
  },
  goldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  goldDiamond: {
    width: 7,
    height: 7,
    backgroundColor: COLORS.warning,
    transform: [{ rotate: '45deg' }],
  },
  goldLabel: {
    color: 'rgba(255,211,106,0.72)',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  goldText: {
    color: COLORS.warning,
    fontSize: 9,
    fontWeight: '900',
  },
});
