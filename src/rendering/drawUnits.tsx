import type { CameraState, Hero, Minion } from '@/game/types';
import { CharacterHero, CharacterMinion } from './characters/CharacterRenderer';

type UnitViewProps = {
  camera: CameraState;
  time: number;
};

export function MinionView({ camera, minion, time }: UnitViewProps & { minion: Minion }) {
  return <CharacterMinion camera={camera} minion={minion} time={time} />;
}

export function HeroView({ camera, hero, isPlayer, time }: UnitViewProps & { hero: Hero; isPlayer: boolean }) {
  return <CharacterHero camera={camera} hero={hero} isPlayer={isPlayer} time={time} />;
}
