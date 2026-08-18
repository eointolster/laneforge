# Laneforge

A single-player, offline lane-battle game (MOBA-style) built with React Native and Expo SDK 54.
You pick a hero, push a lane against an AI opponent, farm minions, take towers, and break the
enemy core — across a 100-level campaign with an ability unlock/upgrade system.

Released free as course material. See [LICENSE](LICENSE) (MIT).

There is no backend, no multiplayer, no accounts, no analytics, and no network calls. Everything
runs on device and progress is saved to local storage.

## Stack

| Area | Choice |
| --- | --- |
| Framework | Expo SDK 54, React Native 0.81, React 19 |
| Routing | `expo-router` (typed routes) |
| Arena rendering | WebGL via `expo-gl` (`src/rendering/gl/arena3dRenderer.ts`) |
| Fallback rendering | `@shopify/react-native-skia` |
| HUD / 2D overlays | Skia + React Native views |
| Input | `react-native-gesture-handler` (virtual joystick, ability buttons) |
| Audio | `expo-audio` (music + procedurally generated SFX) |
| Persistence | `@react-native-async-storage/async-storage` |

The arena starts in `loading`, tries to bring up the GL renderer, and falls back to the Skia
renderer if GL fails or times out — see `src/components/ArenaView.tsx`.

## Running it

```bash
npm install
npx expo start
```

Then press `i` for the iOS simulator, `a` for Android, or scan the QR code with Expo Go.
The game is **landscape only**.

Checks:

```bash
npm run typecheck   # tsc --noEmit
npm run doctor      # npx expo-doctor
```

Regenerate the sound effects (they are synthesized, not recorded):

```bash
npm run sfx:generate
```

## Building for a store

`app.json` ships with placeholder identifiers so the project builds for anyone:

```json
"bundleIdentifier": "com.example.laneforge",
"package": "com.example.laneforge"
```

To ship your own build, change both to your own reverse-domain identifier, then run
`eas init` to attach your own EAS project (`eas.json` is included but contains no project ID).

## Project layout

```text
src/
  app/                 expo-router screens (menu, hero select, game, ladder, upgrades, customize)
  components/          HUD, joystick, minimap, kill feed, result screens, overlays
  game/
    balance.ts         all tunable numbers (hero stats, ability damage, costs)
    constants.ts       map dimensions, labels, caps
    gameLoop.ts        the update function, runs every system in order
    heroes.ts          hero class definitions
    levels.ts          procedural 100-level campaign generator
    playerProfile.ts   saved profile, ability unlocks/upgrades, campaign progress
    map/               lane paths, map layout, terrain decoration
    systems/           movement, combat, minions, towers, projectiles, abilities,
                       economy, jungle creatures + boss, objectives, traps, power-ups, AI
  rendering/
    gl/                WebGL arena renderer
    characters/        procedural hero/minion sprites, palettes, animation state
    draw*.tsx          Skia draw passes for map, units, structures, effects, projectiles
  audio/               music playlist and SFX playback
  performance/         FPS meter and render budget
  utils/               math, collision, seeded random
```

## How the simulation works

`gameLoop.ts` owns a single update function that runs every system in a fixed order each frame,
with the frame delta clamped to `SIMULATION.maxDelta` so a hitch cannot teleport entities.
Simulation state lives in refs, not React state, so the sim runs every animation frame while the
arena and HUD redraw on their own throttled cadences. Rendering is a read-only view of that state.

That split is the main thing worth studying here: it is what keeps a few hundred entities,
projectiles, and effects at a playable frame rate on a phone.

Other guardrails:

- viewport culling for offscreen units, terrain, structures, projectiles, effects, and text
- hard caps on minions, projectiles, effects, and floating text
- a graphics-quality toggle (`performance` / `high`) that trades effects for frame rate
- a positional sanitizer that clamps or removes entities with out-of-bounds or `NaN` positions

## Heroes

Three classes, defined in `src/game/heroes.ts`:

- **Arc Knight** — balanced melee
- **Ember Sage** — ranged caster
- **Stone Herald** — tank bruiser

## Abilities

Eight abilities unlock by campaign level and are upgraded with earned points; you equip three at a
time. Order and unlock levels live in `src/game/playerProfile.ts`, effects in
`src/game/systems/abilitySystem.ts`, and numbers in `src/game/balance.ts`.

`bolt` · `dash` · `pulse` · `fireball` · `shield` · `chain` · `trap` · `ult`

## Where to change things

| To change | Start in |
| --- | --- |
| Any balance number | `src/game/balance.ts`, `src/game/constants.ts` |
| A new ability | `src/game/types.ts` → `balance.ts` → `systems/abilitySystem.ts` → `src/assets/icons.tsx` |
| A new hero | `src/game/heroes.ts` → `balance.ts` → `rendering/characters/HeroSprite.tsx` → `characterPalettes.ts` |
| A new minion look | `rendering/characters/MinionSprite.tsx`, `characterPalettes.ts` |
| Campaign pacing | `src/game/levels.ts` |
| Map shape | `src/game/map/` |

## Known limitations

- Terrain is decorative and does not block movement.
- The AI approximates lane pressure; it is deliberately simple and readable.
- Unit attack facing is approximate, derived from movement/target direction.
- Character animation is procedural, not frame-based sprite animation.
- The FPS meter is a diagnostic overlay, not a profiler.
- HUD and minimap values update on a throttled cadence, so they can lag the sim slightly by design.

## Asset credits

Background music in `assets/audio/` was generated with [ElevenLabs](https://elevenlabs.io) and
carries C2PA provenance metadata identifying it as AI-generated. If you redistribute this project
with the music included, check that it is permitted under the ElevenLabs plan the tracks were
generated on. All other art is procedural — drawn in code at runtime, with no third-party sprite
packs bundled. Sound effects are synthesized by `scripts/generate_sfx.mjs`.
