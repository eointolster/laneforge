import { Children, type ReactNode } from 'react';
import {
  Circle as SkCircle,
  DashPathEffect,
  Group as SkGroup,
  Line as SkLine,
  matchFont,
  Oval,
  Path as SkPath,
  Rect as SkRect,
  RoundedRect,
  Text as SkText,
  type Transforms3d,
} from '@shopify/react-native-skia';

type SvgTransform = string | Transforms3d;

type CommonProps = {
  opacity?: number;
  transform?: SvgTransform;
  pointerEvents?: string;
};

type PaintProps = CommonProps & {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeLinejoin?: 'miter' | 'round' | 'bevel';
  strokeDasharray?: string | number[];
};

type ParsedTransform = {
  transform?: Transforms3d;
  matrix?: number[];
};

const FONT_CACHE = new Map<string, ReturnType<typeof matchFont>>();

function parseTransform(transform?: SvgTransform): ParsedTransform {
  if (!transform) return {};
  if (Array.isArray(transform)) return { transform };

  const commands = [...transform.matchAll(/([a-zA-Z]+)\(([^)]*)\)/g)];
  if (commands.length === 1 && commands[0][1] === 'matrix') {
    const [a, b, c, d, e, f] = parseNumbers(commands[0][2]);
    return { matrix: [a, c, e, b, d, f, 0, 0, 1] };
  }

  const transforms: Transforms3d = [];
  for (const [, name, raw] of commands) {
    const values = parseNumbers(raw);

    if (name === 'translate') {
      transforms.push({ translate: [values[0] ?? 0, values[1] ?? 0] });
    } else if (name === 'scale') {
      const sx = values[0] ?? 1;
      const sy = values[1] ?? sx;
      if (Math.abs(sx - sy) < 0.0001) {
        transforms.push({ scale: sx });
      } else {
        transforms.push({ scaleX: sx }, { scaleY: sy });
      }
    } else if (name === 'rotate') {
      const angle = ((values[0] ?? 0) * Math.PI) / 180;
      if (values.length >= 3) {
        const cx = values[1] ?? 0;
        const cy = values[2] ?? 0;
        transforms.push({ translate: [cx, cy] }, { rotate: angle }, { translate: [-cx, -cy] });
      } else {
        transforms.push({ rotate: angle });
      }
    } else if (name === 'skewX') {
      transforms.push({ skewX: ((values[0] ?? 0) * Math.PI) / 180 });
    } else if (name === 'skewY') {
      transforms.push({ skewY: ((values[0] ?? 0) * Math.PI) / 180 });
    }
  }

  return transforms.length > 0 ? { transform: transforms } : {};
}

function parseNumbers(value: string) {
  return value
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
}

function dashIntervals(strokeDasharray?: string | number[]) {
  if (!strokeDasharray) return null;
  const values = Array.isArray(strokeDasharray) ? strokeDasharray : parseNumbers(strokeDasharray);
  return values.length > 1 ? values : null;
}

function renderShape(
  keyPrefix: string,
  props: PaintProps,
  render: (paint: { color: string; style?: 'fill' | 'stroke' }) => ReactNode,
) {
  const nodes: ReactNode[] = [];
  if (props.fill && props.fill !== 'none' && !props.fill.startsWith('url(')) {
    nodes.push(render({ color: normalizeColor(props.fill), style: 'fill' }));
  }

  if (props.stroke && props.stroke !== 'none') {
    nodes.push(render({ color: normalizeColor(props.stroke), style: 'stroke' }));
  }

  if (nodes.length === 0) return null;
  if (!props.transform) return nodes.length === 1 ? nodes[0] : <SkGroup>{nodes}</SkGroup>;

  return (
    <G transform={props.transform} key={`${keyPrefix}-transform`}>
      {nodes}
    </G>
  );
}

export function G({ children, opacity, transform }: CommonProps & { children?: ReactNode }) {
  const parsed = parseTransform(transform);
  return (
    <SkGroup opacity={opacity} transform={parsed.transform} matrix={parsed.matrix}>
      {children}
    </SkGroup>
  );
}

export function Rect(props: PaintProps & { x: number; y: number; width: number; height: number; rx?: number; ry?: number }) {
  const { x, y, width, height, rx = 0, ry = rx, opacity, strokeWidth = 1, strokeLinecap, strokeLinejoin } = props;
  const radius = Math.max(rx, ry);

  return renderShape('rect', props, ({ color, style }) => {
    const common = {
      color,
      opacity,
      style,
      strokeWidth,
      strokeCap: strokeLinecap,
      strokeJoin: strokeLinejoin,
    };

    return radius > 0 ? (
      <RoundedRect key={`${style}-${color}`} x={x} y={y} width={width} height={height} r={radius} {...common} />
    ) : (
      <SkRect key={`${style}-${color}`} x={x} y={y} width={width} height={height} {...common} />
    );
  });
}

export function Circle(props: PaintProps & { cx: number; cy: number; r: number }) {
  const { cx, cy, r, opacity, strokeWidth = 1, strokeLinecap, strokeLinejoin } = props;

  return renderShape('circle', props, ({ color, style }) => (
    <SkCircle
      key={`${style}-${color}`}
      cx={cx}
      cy={cy}
      r={r}
      color={color}
      opacity={opacity}
      style={style}
      strokeWidth={strokeWidth}
      strokeCap={strokeLinecap}
      strokeJoin={strokeLinejoin}
    />
  ));
}

export function Ellipse(props: PaintProps & { cx: number; cy: number; rx: number; ry: number }) {
  const { cx, cy, rx, ry, opacity, strokeWidth = 1, strokeLinecap, strokeLinejoin } = props;

  return renderShape('ellipse', props, ({ color, style }) => (
    <Oval
      key={`${style}-${color}`}
      x={cx - rx}
      y={cy - ry}
      width={rx * 2}
      height={ry * 2}
      color={color}
      opacity={opacity}
      style={style}
      strokeWidth={strokeWidth}
      strokeCap={strokeLinecap}
      strokeJoin={strokeLinejoin}
    />
  ));
}

export function Path(props: PaintProps & { d: string }) {
  const { d, opacity, strokeWidth = 1, strokeLinecap, strokeLinejoin, strokeDasharray } = props;
  const intervals = dashIntervals(strokeDasharray);

  return renderShape('path', props, ({ color, style }) => (
    <SkPath
      key={`${style}-${color}`}
      path={d}
      color={color}
      opacity={opacity}
      style={style}
      strokeWidth={strokeWidth}
      strokeCap={strokeLinecap}
      strokeJoin={strokeLinejoin}
    >
      {style === 'stroke' && intervals ? <DashPathEffect intervals={intervals} /> : null}
    </SkPath>
  ));
}

export function Line(props: CommonProps & {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth?: number;
  strokeLinecap?: 'butt' | 'round' | 'square';
}) {
  const { x1, y1, x2, y2, stroke, strokeWidth = 1, strokeLinecap, opacity, transform } = props;
  const node = (
    <SkLine
      p1={{ x: x1, y: y1 }}
      p2={{ x: x2, y: y2 }}
      color={normalizeColor(stroke)}
      strokeWidth={strokeWidth}
      strokeCap={strokeLinecap}
      opacity={opacity}
    />
  );

  return transform ? <G transform={transform}>{node}</G> : node;
}

export function Polygon(props: PaintProps & { points: string }) {
  return <Path {...props} d={pointsToPath(props.points)} />;
}

export function Text({
  children,
  x,
  y,
  fill,
  opacity,
  fontSize = 12,
  fontWeight = 'normal',
  textAnchor,
}: CommonProps & {
  children?: ReactNode;
  x: number;
  y: number;
  fill: string;
  fontSize?: number;
  fontWeight?: string | number;
  textAnchor?: 'start' | 'middle' | 'end';
}) {
  const text = Children.toArray(children).join('');
  const weight = typeof fontWeight === 'number' ? String(fontWeight) : fontWeight;
  const font = getFont(fontSize, weight === '900' ? '900' : weight === 'bold' ? 'bold' : '700');
  const bounds = font.measureText(text);
  const alignedX = textAnchor === 'middle' ? x - bounds.width / 2 : textAnchor === 'end' ? x - bounds.width : x;

  return <SkText x={alignedX} y={y} text={text} font={font} color={normalizeColor(fill)} opacity={opacity} />;
}

function getFont(fontSize: number, fontWeight: '700' | '900' | 'bold') {
  const key = `${fontSize}:${fontWeight}`;
  const cached = FONT_CACHE.get(key);
  if (cached) return cached;

  const font = matchFont({ fontSize, fontWeight });
  FONT_CACHE.set(key, font);
  return font;
}

function normalizeColor(color: string) {
  const match = color.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return color;

  const [r = 0, g = 0, b = 0, a = 1] = match[1]
    .split(',')
    .map((part) => Number(part.trim()));
  const alpha = a <= 1 ? a : a / 255;

  return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(alpha * 255)}`;
}

function toHex(value: number) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

function pointsToPath(points: string) {
  const pairs = points
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map(Number))
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

  if (pairs.length === 0) return '';
  const [first, ...rest] = pairs;
  return `M${first[0]} ${first[1]} ${rest.map(([x, y]) => `L${x} ${y}`).join(' ')} Z`;
}
