import type { CameraState, Hero, Minion } from '@/game/types';
import { HeroSprite } from './HeroSprite';
import { MinionSprite } from './MinionSprite';

type HeroRendererProps = {
  camera: CameraState;
  hero: Hero;
  time: number;
  isPlayer: boolean;
};

type MinionRendererProps = {
  camera: CameraState;
  minion: Minion;
  time: number;
};

export function CharacterHero(props: HeroRendererProps) {
  return <HeroSprite {...props} />;
}

export function CharacterMinion(props: MinionRendererProps) {
  return <MinionSprite {...props} />;
}
