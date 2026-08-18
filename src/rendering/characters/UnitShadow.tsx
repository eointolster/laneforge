import { Ellipse, G } from '../skiaElements';

type UnitShadowProps = {
  x: number;
  y: number;
  radius: number;
  opacity?: number;
};

export function UnitShadow({ x, y, radius, opacity = 0.34 }: UnitShadowProps) {
  return (
    <G opacity={opacity}>
      <Ellipse cx={x + radius * 0.2} cy={y + radius * 0.22} rx={radius * 1.45} ry={radius * 0.55} fill="rgba(0,0,0,0.72)" />
      <Ellipse cx={x} cy={y + radius * 0.08} rx={radius * 1.05} ry={radius * 0.36} fill="rgba(0,0,0,0.4)" />
    </G>
  );
}
