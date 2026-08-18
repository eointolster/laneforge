export function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export function seededBetween(seed: number, min: number, max: number) {
  return min + seededUnit(seed) * (max - min);
}
