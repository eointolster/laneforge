import { TEAM_COLORS } from '@/game/constants';
import type { Team } from '@/game/types';

export type CharacterPalette = {
  main: string;
  dark: string;
  mid: string;
  light: string;
  trim: string;
  weapon: string;
  glow: string;
  face: string;
};

export function heroPalette(team: Team, customMain?: string): CharacterPalette {
  if (team === 'blue') {
    if (customMain && /^#[0-9A-Fa-f]{6}$/.test(customMain)) {
      return {
        main: customMain,
        dark: blendHex(customMain, '#061012', 0.58),
        mid: blendHex(customMain, '#0D5265', 0.32),
        light: blendHex(customMain, '#FFFFFF', 0.72),
        trim: blendHex(customMain, '#FFFFFF', 0.86),
        weapon: blendHex(customMain, '#FFFFFF', 0.9),
        glow: `${customMain}66`,
        face: blendHex(customMain, '#FFFFFF', 0.82),
      };
    }

    return {
      main: '#39D9FF',
      dark: '#0D5265',
      mid: '#178BA7',
      light: '#B9F7FF',
      trim: '#F4FFFF',
      weapon: '#D7FBFF',
      glow: TEAM_COLORS.blue.glow,
      face: '#DDFBFF',
    };
  }

  return {
    main: '#FF7045',
    dark: '#6E2118',
    mid: '#B33C25',
    light: '#FFC1A8',
    trim: '#FFE6D8',
    weapon: '#FFD2A3',
    glow: TEAM_COLORS.red.glow,
    face: '#FFD8C8',
  };
}

export function minionPalette(team: Team): CharacterPalette {
  const base = heroPalette(team);

  return {
    ...base,
    trim: team === 'blue' ? '#D9FCFF' : '#FFE1D3',
    weapon: team === 'blue' ? '#BEEBF2' : '#FFC28F',
    face: team === 'blue' ? '#CFF7FF' : '#FFD4BE',
  };
}

function blendHex(a: string, b: string, amount: number) {
  const ac = parseHex(a);
  const bc = parseHex(b);
  const t = Math.max(0, Math.min(1, amount));
  return `#${toHex(ac.r + (bc.r - ac.r) * t)}${toHex(ac.g + (bc.g - ac.g) * t)}${toHex(ac.b + (bc.b - ac.b) * t)}`;
}

function parseHex(value: string) {
  const normalized = value.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function toHex(value: number) {
  return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0');
}
