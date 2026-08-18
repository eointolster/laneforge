import type { ExpoWebGLRenderingContext } from 'expo-gl';

import { getVisibleWorldRect } from '@/game/camera';
import { BASE_POSITIONS, HERO_START, MAP_HEIGHT, MAP_WIDTH, TEAM_COLORS } from '@/game/constants';
import { cubicPoint, getLaneYAtX, JUNGLE_CONNECTORS, LANE_END_X, LANE_START_X, type JungleConnector } from '@/game/map/lanePaths';
import type { CameraState, ChainArc, Effect, GameState, GraphicsQuality, Hero, JungleBoss, JungleCreature, Minion, Point, PowerUp, Projectile, Structure, TargetRef, Team, Trap, WarningIndicator } from '@/game/types';
import { seededBetween } from '@/utils/random';

type Vec3 = [number, number, number];
type Vec4 = [number, number, number, number];
type GL = ExpoWebGLRenderingContext & { [key: string]: any };

type ArenaRenderer = {
  start: () => void;
  stop: () => void;
  resize: () => void;
};

const WORLD_SCALE = 0.012;
const VERTEX_STRIDE = 10;
const FLOAT_BYTES = 4;
const INITIAL_DYNAMIC_FLOAT_CAPACITY = 180000;

class DynamicVertexSink {
  private values: Float32Array;
  private cursor = 0;

  constructor(initialCapacity: number) {
    this.values = new Float32Array(initialCapacity);
  }

  get length() {
    return this.cursor;
  }

  set length(value: number) {
    this.cursor = Math.max(0, value);
    this.ensureCapacity(this.cursor);
  }

  push(...values: number[]) {
    this.ensureCapacity(this.cursor + values.length);
    for (let index = 0; index < values.length; index += 1) {
      this.values[this.cursor + index] = values[index];
    }
    this.cursor += values.length;
    return this.cursor;
  }

  asNumberArray() {
    return this as unknown as number[];
  }

  pushVertex(position: Vec3, normal: Vec3, color: Vec4) {
    this.ensureCapacity(this.cursor + VERTEX_STRIDE);
    const offset = this.cursor;
    this.values[offset] = position[0];
    this.values[offset + 1] = position[1];
    this.values[offset + 2] = position[2];
    this.values[offset + 3] = normal[0];
    this.values[offset + 4] = normal[1];
    this.values[offset + 5] = normal[2];
    this.values[offset + 6] = color[0];
    this.values[offset + 7] = color[1];
    this.values[offset + 8] = color[2];
    this.values[offset + 9] = color[3];
    this.cursor += VERTEX_STRIDE;
  }

  uploadView() {
    return this.values.subarray(0, this.cursor);
  }

  private ensureCapacity(required: number) {
    if (required <= this.values.length) return;
    const next = new Float32Array(Math.ceil(required * 1.35));
    next.set(this.values);
    this.values = next;
  }
}

const LANES: Array<'top' | 'middle' | 'bottom'> = ['top', 'middle', 'bottom'];
const MYSTICAL_POOLS = [
  { x: MAP_WIDTH * 0.23, y: MAP_HEIGHT * 0.33 },
  { x: MAP_WIDTH * 0.36, y: MAP_HEIGHT * 0.72 },
  { x: MAP_WIDTH * 0.49, y: MAP_HEIGHT * 0.25 },
  { x: MAP_WIDTH * 0.61, y: MAP_HEIGHT * 0.68 },
  { x: MAP_WIDTH * 0.74, y: MAP_HEIGHT * 0.38 },
];
const FOREST_CLUSTERS = [
  { x: 440, y: 260, rx: 230, rz: 150, count: 13 },
  { x: 520, y: MAP_HEIGHT - 280, rx: 260, rz: 160, count: 15 },
  { x: 760, y: 900, rx: 210, rz: 130, count: 10 },
  { x: 820, y: 1540, rx: 210, rz: 130, count: 11 },
  { x: 1180, y: 250, rx: 280, rz: 150, count: 16 },
  { x: 1220, y: MAP_HEIGHT - 280, rx: 300, rz: 160, count: 17 },
  { x: 1540, y: 910, rx: 255, rz: 142, count: 12 },
  { x: 1680, y: 1560, rx: 265, rz: 145, count: 13 },
  { x: 2050, y: 260, rx: 300, rz: 150, count: 16 },
  { x: 2100, y: MAP_HEIGHT - 260, rx: 300, rz: 150, count: 16 },
  { x: 2440, y: 910, rx: 250, rz: 142, count: 12 },
  { x: 2600, y: 1560, rx: 260, rz: 145, count: 13 },
  { x: 3000, y: 260, rx: 300, rz: 150, count: 16 },
  { x: 3040, y: MAP_HEIGHT - 280, rx: 300, rz: 160, count: 17 },
  { x: MAP_WIDTH - 760, y: 900, rx: 210, rz: 130, count: 10 },
  { x: MAP_WIDTH - 820, y: 1540, rx: 210, rz: 130, count: 11 },
  { x: MAP_WIDTH - 450, y: 270, rx: 230, rz: 150, count: 13 },
  { x: MAP_WIDTH - 460, y: MAP_HEIGHT - 290, rx: 250, rz: 160, count: 15 },
  { x: MAP_WIDTH * 0.5, y: MAP_HEIGHT * 0.12, rx: 280, rz: 130, count: 11 },
  { x: MAP_WIDTH * 0.5, y: MAP_HEIGHT * 0.88, rx: 280, rz: 130, count: 11 },
];
const TOWER_CLEAR_X = [580, 1460, MAP_WIDTH - 1460, MAP_WIDTH - 580];

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec4 aColor;

uniform mat4 uViewProjection;

varying vec3 vNormal;
varying vec4 vColor;
varying float vDepth;

void main() {
  gl_Position = uViewProjection * vec4(aPosition, 1.0);
  vNormal = normalize(aNormal);
  vColor = aColor;
  vDepth = gl_Position.z / gl_Position.w;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

varying vec3 vNormal;
varying vec4 vColor;
varying float vDepth;

uniform vec3 uLightDirection;

void main() {
  float diffuse = max(dot(normalize(vNormal), normalize(uLightDirection)), 0.0);
  float topLight = max(vNormal.y, 0.0);
  float rimLight = pow(1.0 - max(vNormal.y, 0.0), 2.0);
  vec3 lit = vColor.rgb * (0.58 + diffuse * 0.38 + topLight * 0.36 + rimLight * 0.16);
  lit += vec3(0.012, 0.024, 0.02) * topLight;
  float fog = smoothstep(0.78, 1.14, vDepth);
  lit = mix(lit, vec3(0.055, 0.13, 0.105), fog * 0.13);
  gl_FragColor = vec4(lit, vColor.a);
}
`;

export function createArena3DRenderer(
  rawGl: ExpoWebGLRenderingContext,
  getState: () => GameState,
  getCamera: () => CameraState,
  getQuality: () => GraphicsQuality,
): ArenaRenderer {
  const gl = rawGl as GL;
  const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
  const locations = {
    position: gl.getAttribLocation(program, 'aPosition'),
    normal: gl.getAttribLocation(program, 'aNormal'),
    color: gl.getAttribLocation(program, 'aColor'),
    viewProjection: gl.getUniformLocation(program, 'uViewProjection'),
    lightDirection: gl.getUniformLocation(program, 'uLightDirection'),
  };

  const staticBuffer = gl.createBuffer();
  const dynamicBuffer = gl.createBuffer();
  if (!staticBuffer || !dynamicBuffer) {
    throw new Error('Unable to allocate GL buffers');
  }

  const staticVertices = new Float32Array(buildStaticScene());
  gl.bindBuffer(gl.ARRAY_BUFFER, staticBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, staticVertices, gl.STATIC_DRAW);

  let frameId = 0;
  let running = false;
  let lastWidth = 0;
  let lastHeight = 0;
  const dynamicVertexSink = new DynamicVertexSink(INITIAL_DYNAMIC_FLOAT_CAPACITY);

  function resize() {
    const width = gl.drawingBufferWidth || 1;
    const height = gl.drawingBufferHeight || 1;
    if (width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    gl.viewport(0, 0, width, height);
  }

  function draw() {
    if (!running) return;

    resize();
    const state = getState();
    const camera = getCamera();
    const quality = getQuality();
    const viewProjection = cameraMatrix(camera, lastWidth / Math.max(1, lastHeight));
    buildDynamicScene(state, camera, quality, dynamicVertexSink.asNumberArray());
    const dynamicVertexCount = dynamicVertexSink.length / VERTEX_STRIDE;

    gl.clearColor(0.025, 0.055, 0.045, 1);
    gl.clearDepth(1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(program);
    gl.uniformMatrix4fv(locations.viewProjection, false, viewProjection);
    gl.uniform3f(locations.lightDirection, -0.26, 1.04, 0.48);

    bindVertexLayout(gl, staticBuffer, locations);
    gl.drawArrays(gl.TRIANGLES, 0, staticVertices.length / VERTEX_STRIDE);

    if (dynamicVertexCount > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, dynamicBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, dynamicVertexSink.uploadView(), gl.DYNAMIC_DRAW);
      bindVertexLayout(gl, dynamicBuffer, locations);
      gl.drawArrays(gl.TRIANGLES, 0, dynamicVertexCount);
    }

    gl.flush();
    gl.endFrameEXP();
    frameId = requestAnimationFrame(draw);
  }

  return {
    start() {
      if (running) return;
      running = true;
      resize();
      frameId = requestAnimationFrame(draw);
    },
    stop() {
      running = false;
      if (frameId) cancelAnimationFrame(frameId);
    },
    resize,
  };
}

function bindVertexLayout(
  gl: GL,
  buffer: unknown,
  locations: { position: number; normal: number; color: number },
) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const stride = VERTEX_STRIDE * FLOAT_BYTES;

  gl.enableVertexAttribArray(locations.position);
  gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, stride, 0);

  gl.enableVertexAttribArray(locations.normal);
  gl.vertexAttribPointer(locations.normal, 3, gl.FLOAT, false, stride, 3 * FLOAT_BYTES);

  gl.enableVertexAttribArray(locations.color);
  gl.vertexAttribPointer(locations.color, 4, gl.FLOAT, false, stride, 6 * FLOAT_BYTES);
}

function buildStaticScene() {
  const out: number[] = [];

  addPlane(out, worldX(MAP_WIDTH / 2), 0, worldZ(MAP_HEIGHT / 2), MAP_WIDTH * WORLD_SCALE, MAP_HEIGHT * WORLD_SCALE, hex('#173A2D'));
  addPlane(out, worldX(MAP_WIDTH / 2), -0.012, worldZ(MAP_HEIGHT / 2), MAP_WIDTH * WORLD_SCALE + 1.3, MAP_HEIGHT * WORLD_SCALE + 1.3, hex('#071713'));
  addEdgeVoid(out);
  addMagicGround(out);
  addAmbientLightPockets(out);

  addBasePlate(out, 'blue');
  addBasePlate(out, 'red');

  for (const lane of LANES) {
    addLane(out, lane, 1.92, hex('#183F31'), 0.034);
    addLane(out, lane, 1.34, hex('#5A533D'), 0.07);
    addLane(out, lane, 0.86, hex('#A78A5A'), 0.112);
    addLane(out, lane, 0.24, hex('#FFE1A0', 0.34), 0.166);
    addLaneTexture(out, lane);
    addLaneShoulders(out, lane);
  }

  for (const connector of JUNGLE_CONNECTORS) {
    addJungleConnector(out, connector, 1.24, hex('#173629'), 0.05);
    addJungleConnector(out, connector, 0.9, hex('#4B4638'), 0.088);
    addJungleConnector(out, connector, 0.54, hex('#8C724E', 0.72), 0.13);
    addJungleConnectorTexture(out, connector);
  }

  for (let index = 0; index < 360; index += 1) {
    const x = seededBetween(index * 17 + 3, 80, MAP_WIDTH - 80);
    const y = seededBetween(index * 19 + 5, 48, MAP_HEIGHT - 48);
    const size = seededBetween(index * 23 + 7, 0.015, 0.04);
    const color = index % 5 === 0 ? hex('#92966F', 0.3) : index % 2 === 0 ? hex('#23543C', 0.34) : hex('#102D22', 0.4);
    addDisc(out, worldX(x), 0.014, worldZ(y), size, size * 0.8, color, 8);
  }

  addForest(out);
  addLaneEdgeGroves(out);

  for (let index = 0; index < 20; index += 1) {
    const x = seededBetween(index * 67 + 4, 360, MAP_WIDTH - 360);
    const y = seededBetween(index * 41 + 8, 190, MAP_HEIGHT - 190);
    addBox(out, worldX(x), 0.075, worldZ(y), 0.58, 0.15, 0.18, hex('#2C332C'));
  }

  return out;
}

function addEdgeVoid(out: number[]) {
  const glowColor = hex('#3DE5FF', 0.072);
  const stepCount = 13;
  for (let index = 0; index <= stepCount; index += 1) {
    const t = index / stepCount;
    addDisc(out, worldX(MAP_WIDTH * t), 0.01, worldZ(0), 1.5, 0.27, glowColor, 12);
    addDisc(out, worldX(MAP_WIDTH * t), 0.01, worldZ(MAP_HEIGHT), 1.5, 0.27, hex('#8B5CF6', 0.06), 12);
  }

  for (let index = 0; index <= 6; index += 1) {
    const t = index / 6;
    addDisc(out, worldX(0), 0.01, worldZ(MAP_HEIGHT * t), 0.28, 1.18, hex('#34D399', 0.052), 12);
    addDisc(out, worldX(MAP_WIDTH), 0.01, worldZ(MAP_HEIGHT * t), 0.28, 1.18, hex('#FF5533', 0.052), 12);
  }

  for (let index = 0; index < 24; index += 1) {
    const t = (index + 0.5) / 24;
    const topColor = index % 3 === 0 ? hex('#7CFFB0', 0.18) : hex('#8EF7FF', 0.14);
    const bottomColor = index % 3 === 0 ? hex('#C7A5FF', 0.18) : hex('#FFD36A', 0.12);
    addGroundRect(out, worldX(MAP_WIDTH * t), 0.038, worldZ(42), [0.72, 0.3], 0.24, 0.034, topColor);
    addGroundRect(out, worldX(MAP_WIDTH * t), 0.038, worldZ(MAP_HEIGHT - 42), [0.72, -0.3], 0.24, 0.034, bottomColor);
  }

  for (let index = 0; index < 12; index += 1) {
    const t = (index + 0.5) / 12;
    addGroundRect(out, worldX(42), 0.038, worldZ(MAP_HEIGHT * t), [0.22, 0.82], 0.22, 0.034, hex('#7CFFB0', 0.14));
    addGroundRect(out, worldX(MAP_WIDTH - 42), 0.038, worldZ(MAP_HEIGHT * t), [0.22, -0.82], 0.22, 0.034, hex('#FFB096', 0.14));
  }
}

function addMagicGround(out: number[]) {
  const glades = [
    { x: MAP_WIDTH * 0.14, y: MAP_HEIGHT * 0.17, rx: 3.5, rz: 2.1, color: hex('#5FE9FF', 0.04) },
    { x: MAP_WIDTH * 0.2, y: MAP_HEIGHT * 0.79, rx: 3.8, rz: 2.1, color: hex('#7CFFB0', 0.034) },
    { x: MAP_WIDTH * 0.34, y: MAP_HEIGHT * 0.34, rx: 3.9, rz: 1.95, color: hex('#9E7BFF', 0.035) },
    { x: MAP_WIDTH * 0.45, y: MAP_HEIGHT * 0.75, rx: 3.7, rz: 2.1, color: hex('#FF8CDA', 0.03) },
    { x: MAP_WIDTH * 0.58, y: MAP_HEIGHT * 0.24, rx: 4.1, rz: 2.05, color: hex('#FFD36A', 0.03) },
    { x: MAP_WIDTH * 0.66, y: MAP_HEIGHT * 0.62, rx: 4.0, rz: 2.1, color: hex('#8DFFB0', 0.034) },
    { x: MAP_WIDTH * 0.78, y: MAP_HEIGHT * 0.84, rx: 3.4, rz: 1.85, color: hex('#74E7FF', 0.033) },
    { x: MAP_WIDTH * 0.9, y: MAP_HEIGHT * 0.31, rx: 3.0, rz: 1.65, color: hex('#C7A5FF', 0.032) },
  ];

  for (const glade of glades) {
    addDisc(out, worldX(glade.x), 0.018, worldZ(glade.y), glade.rx, glade.rz, glade.color, 32);
  }

  for (let index = 0; index < 70; index += 1) {
    const x = seededBetween(index * 47 + 5, 180, MAP_WIDTH - 180);
    const y = seededBetween(index * 59 + 9, 120, MAP_HEIGHT - 120);
    if (!isClearOfLane(x, y, 62)) continue;

    const color = index % 3 === 0 ? hex('#87F7FF', 0.5) : index % 3 === 1 ? hex('#73FFA4', 0.42) : hex('#C7A5FF', 0.42);
    addOctahedron(out, worldX(x), 0.18, worldZ(y), seededBetween(index * 19 + 1, 0.045, 0.085), color);
    addDisc(out, worldX(x), 0.024, worldZ(y), 0.34, 0.2, [...color.slice(0, 3), 0.08] as Vec4, 14);
  }

  addMysticalPools(out);
  addRuneCircles(out);
  addMushrooms(out);
}

function addAmbientLightPockets(out: number[]) {
  const pockets = [
    { x: MAP_WIDTH * 0.18, y: MAP_HEIGHT * 0.36, rx: 2.9, rz: 1.42, color: hex('#A9F4FF', 0.032) },
    { x: MAP_WIDTH * 0.28, y: MAP_HEIGHT * 0.62, rx: 3.25, rz: 1.52, color: hex('#FFF1B7', 0.034) },
    { x: MAP_WIDTH * 0.4, y: MAP_HEIGHT * 0.24, rx: 2.7, rz: 1.3, color: hex('#8DFFB0', 0.03) },
    { x: MAP_WIDTH * 0.5, y: MAP_HEIGHT * 0.5, rx: 4.1, rz: 1.82, color: hex('#C7A5FF', 0.028) },
    { x: MAP_WIDTH * 0.6, y: MAP_HEIGHT * 0.76, rx: 2.7, rz: 1.34, color: hex('#A9F4FF', 0.03) },
    { x: MAP_WIDTH * 0.72, y: MAP_HEIGHT * 0.38, rx: 3.25, rz: 1.48, color: hex('#FFF1B7', 0.032) },
    { x: MAP_WIDTH * 0.82, y: MAP_HEIGHT * 0.68, rx: 2.9, rz: 1.42, color: hex('#8DFFB0', 0.028) },
  ];

  for (const pocket of pockets) {
    addDisc(out, worldX(pocket.x), 0.026, worldZ(pocket.y), pocket.rx, pocket.rz, pocket.color, 28);
  }
}

function addForest(out: number[]) {
  for (let clusterIndex = 0; clusterIndex < FOREST_CLUSTERS.length; clusterIndex += 1) {
    const cluster = FOREST_CLUSTERS[clusterIndex];
    for (let index = 0; index < cluster.count; index += 1) {
      const seed = clusterIndex * 211 + index * 37;
      const x = cluster.x + seededBetween(seed, -cluster.rx, cluster.rx);
      const y = cluster.y + seededBetween(seed + 13, -cluster.rz, cluster.rz);
      if (!isTreePositionClear(x, y)) continue;

      const scale = seededBetween(seed + 29, index % 7 === 0 ? 1.3 : 0.48, index % 7 === 0 ? 1.8 : 1.08);
      if (index % 9 === 0) {
        addMagicTree(out, worldX(x), worldZ(y), scale * 1.15);
      } else {
        addTree(out, worldX(x), worldZ(y), scale);
      }
    }
  }

  const ancientTrees = [
    { x: MAP_WIDTH * 0.2, y: MAP_HEIGHT * 0.33 },
    { x: MAP_WIDTH * 0.3, y: MAP_HEIGHT * 0.72 },
    { x: MAP_WIDTH * 0.5, y: MAP_HEIGHT * 0.14 },
    { x: MAP_WIDTH * 0.58, y: MAP_HEIGHT * 0.83 },
    { x: MAP_WIDTH * 0.72, y: MAP_HEIGHT * 0.34 },
    { x: MAP_WIDTH * 0.84, y: MAP_HEIGHT * 0.72 },
  ];

  for (const tree of ancientTrees) {
    if (isTreePositionClear(tree.x, tree.y)) {
      addMagicTree(out, worldX(tree.x), worldZ(tree.y), 2.1);
    }
  }
}

function addLaneEdgeGroves(out: number[]) {
  const marksPerLane = 14;

  for (let laneIndex = 0; laneIndex < LANES.length; laneIndex += 1) {
    const lane = LANES[laneIndex];
    for (let index = 0; index < marksPerLane; index += 1) {
      const t = (index + 0.62) / marksPerLane;
      if (t < 0.07 || t > 0.93) continue;

      const mapX = LANE_START_X + (LANE_END_X - LANE_START_X) * t;
      const mapY = getLaneYAtX(lane, mapX);
      const basis = laneBasis(lane, mapX);

      for (const sideSign of [-1, 1]) {
        const seed = laneIndex * 913 + index * 71 + (sideSign > 0 ? 17 : 43);
        if ((index + laneIndex + (sideSign > 0 ? 0 : 1)) % 4 === 0) continue;

        const offset = seededBetween(seed, 220, 345);
        const jitterAlong = seededBetween(seed + 11, -34, 34);
        const jitterSide = seededBetween(seed + 19, -14, 14);
        const x = mapX + basis.normal[0] * (offset + jitterSide) * sideSign + basis.tangent[0] * jitterAlong;
        const y = mapY + basis.normal[1] * (offset + jitterSide) * sideSign + basis.tangent[1] * jitterAlong;
        if (!isLaneEdgeTreePositionClear(x, y)) continue;

        const scale = seededBetween(seed + 29, 0.58, 1.18);
        if ((index + laneIndex + (sideSign > 0 ? 2 : 0)) % 6 === 0) {
          addMagicTree(out, worldX(x), worldZ(y), scale * 0.92);
        } else {
          addTree(out, worldX(x), worldZ(y), scale);
        }

        if (index % 3 === 0) {
          addDisc(out, worldX(x), 0.032, worldZ(y), 0.32 * scale, 0.18 * scale, hex(sideSign > 0 ? '#7CFFB0' : '#8EF7FF', 0.095), 12);
        }
      }
    }
  }
}

function isTreePositionClear(x: number, y: number) {
  if (x < 80 || x > MAP_WIDTH - 80 || y < 58 || y > MAP_HEIGHT - 58) return false;
  if (!isClearOfLane(x, y, 185)) return false;

  for (const team of ['blue', 'red'] as Team[]) {
    const base = BASE_POSITIONS[team];
    if (Math.abs(x - base.x) < 440 && Math.abs(y - base.y) < MAP_HEIGHT * 0.34) return false;
  }

  if (isNearTowerSlot(x, y, 340, 360)) {
    return false;
  }

  return true;
}

function isLaneEdgeTreePositionClear(x: number, y: number) {
  if (x < 110 || x > MAP_WIDTH - 110 || y < 72 || y > MAP_HEIGHT - 72) return false;
  if (!isClearOfLane(x, y, 150)) return false;

  for (const team of ['blue', 'red'] as Team[]) {
    const base = BASE_POSITIONS[team];
    if (Math.abs(x - base.x) < 520 && Math.abs(y - base.y) < MAP_HEIGHT * 0.42) return false;
  }

  if (isNearTowerSlot(x, y, 340, 330)) {
    return false;
  }

  return true;
}

function isNearTowerSlot(x: number, y: number, paddingX: number, paddingY: number) {
  for (const towerX of TOWER_CLEAR_X) {
    for (const lane of LANES) {
      const towerY = getLaneYAtX(lane, towerX);
      if (Math.abs(x - towerX) < paddingX && Math.abs(y - towerY) < paddingY) {
        return true;
      }
    }
  }

  return false;
}

function addMysticalPools(out: number[]) {
  for (const pool of MYSTICAL_POOLS) {
    if (!isClearOfLane(pool.x, pool.y, 96)) continue;
    const x = worldX(pool.x);
    const z = worldZ(pool.y);
    addDisc(out, x, 0.035, z, 0.86, 0.46, hex('#164A56', 0.75), 28);
    addDisc(out, x, 0.04, z, 0.66, 0.34, hex('#4DCFFF', 0.3), 28);
    addDisc(out, x, 0.045, z, 0.28, 0.12, hex('#D8FBFF', 0.12), 18);
  }
}

function addRuneCircles(out: number[]) {
  const circles = [
    { x: MAP_WIDTH * 0.32, y: MAP_HEIGHT * 0.5 },
    { x: MAP_WIDTH * 0.58, y: MAP_HEIGHT * 0.5 },
    { x: MAP_WIDTH * 0.72, y: MAP_HEIGHT * 0.75 },
  ];

  for (const circle of circles) {
    if (!isClearOfLane(circle.x, circle.y, 118)) continue;
    const x = worldX(circle.x);
    const z = worldZ(circle.y);
    addDisc(out, x, 0.03, z, 0.92, 0.5, hex('#8B5CF6', 0.08), 30);
    for (let index = 0; index < 10; index += 1) {
      const angle = index * ((Math.PI * 2) / 10);
      addOctahedron(out, x + Math.cos(angle) * 0.72, 0.16, z + Math.sin(angle) * 0.4, 0.055, hex(index % 2 === 0 ? '#C7A5FF' : '#7CFFB0', 0.62));
    }
  }
}

function addMushrooms(out: number[]) {
  for (let index = 0; index < 46; index += 1) {
    const x = seededBetween(index * 101 + 3, 240, MAP_WIDTH - 240);
    const y = seededBetween(index * 109 + 7, 150, MAP_HEIGHT - 150);
    if (!isClearOfLane(x, y, 92)) continue;

    const wx = worldX(x);
    const wz = worldZ(y);
    const scale = seededBetween(index * 19 + 11, 0.55, 1.2);
    addCylinder(out, wx, 0.08 * scale, wz, 0.025 * scale, 0.16 * scale, 5, hex('#DDE7F0', 0.76));
    addCone(out, wx, 0.2 * scale, wz, 0.09 * scale, 0.1 * scale, 7, hex(index % 2 === 0 ? '#7CFFB0' : '#C7A5FF', 0.8));
    addDisc(out, wx, 0.034, wz, 0.22 * scale, 0.12 * scale, hex('#7CFFB0', 0.14), 10);
  }
}

function isClearOfLane(x: number, y: number, padding: number) {
  return LANES.every((lane) => Math.abs(y - getLaneYAtX(lane, x)) > padding);
}

function buildDynamicScene(state: GameState, camera: CameraState, quality: GraphicsQuality, out: number[] = []) {
  out.length = 0;
  const isPerformance = quality === 'performance';
  const renderBounds = getPaddedVisibleBounds(camera, isPerformance ? 700 : 1040);

  for (const structure of state.structures) {
    drawStructure(out, structure, state.time);
  }

  if (state.jungleBoss && (state.jungleBoss.alive || state.time - state.jungleBoss.deathTime < 0.9)) {
    if (isInRenderBounds(state.jungleBoss.position, renderBounds, 420)) {
      drawJungleBoss(out, state.jungleBoss, state.time);
      drawBossTargetTether(out, state, state.jungleBoss, state.time);
    }
  }

  for (const creature of state.jungleCreatures) {
    if (!creature.alive && state.time - creature.deathTime > 0.8) continue;
    if (!isInRenderBounds(creature.position, renderBounds, 260)) continue;
    drawJungleCreature(out, state, creature, state.time);
  }

  for (const minion of state.minions) {
    if (minion.dead && state.time - minion.deathTime > 0.25) continue;
    if (!isInRenderBounds(minion.position, renderBounds, 160)) continue;
    const farDistance = isPerformance ? 740 : 1040;
    const farFromCamera = distanceSq(minion.position, camera.center) > farDistance * farDistance;
    drawMinion(out, minion, state.time, farFromCamera);
  }

  if (isInRenderBounds(state.heroes.enemy.position, renderBounds, 260)) {
    drawHero(out, state.heroes.enemy, false, state.time);
  }
  drawHero(out, state.heroes.player, true, state.time);
  drawPlayerTargetingIndicator(out, state, state.time);

  for (const warning of state.warnings) {
    if (
      !isInRenderBounds(warning.sourcePosition, renderBounds, warning.radius + 220) &&
      !isInRenderBounds(warning.targetPosition, renderBounds, warning.radius + 220)
    ) {
      continue;
    }
    drawWarningIndicator(out, warning);
  }

  for (const projectile of state.projectiles) {
    if (!isInRenderBounds(projectile.position, renderBounds, 190)) continue;
    drawProjectile(out, projectile, state.time, quality);
  }

  for (const trap of state.traps) {
    if (!isInRenderBounds(trap.position, renderBounds, trap.radius + 160)) continue;
    drawTrap(out, trap, state.time);
  }

  for (const powerUp of state.powerUps) {
    if (!powerUp.active) continue;
    if (!isInRenderBounds(powerUp.position, renderBounds, powerUp.radius + 180)) continue;
    drawPowerUp(out, powerUp, state.time);
  }

  for (const arc of state.chainArcs) {
    if (
      !isInRenderBounds(arc.start, renderBounds, 220) &&
      !isInRenderBounds(arc.end, renderBounds, 220)
    ) {
      continue;
    }
    drawChainArc(out, arc, state.time, quality);
  }

  for (const effect of state.effects) {
    if (!isInRenderBounds(effect.position, renderBounds, effect.radius + 200)) continue;
    drawEffect(out, effect, state.time, quality);
  }

  addCameraLight(out, camera);
  addMagicalSkyWash(out, camera, state.time, quality, state.levelConfig.level);
  addBaseFountainParticles(out, state.time, renderBounds);
  if (!isPerformance) {
    addLaneTorches(out, state.time, renderBounds);
    addWaterShimmer(out, state.time, renderBounds);
    addForestWind(out, state.time, renderBounds);
  }
  addMagicMotes(out, camera, state.time, quality);

  return out;
}

type RenderBounds = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

function getPaddedVisibleBounds(camera: CameraState, padding: number): RenderBounds {
  const visible = getVisibleWorldRect(camera);
  return {
    x0: Math.max(0, visible.x - padding),
    y0: Math.max(0, visible.y - padding),
    x1: Math.min(MAP_WIDTH, visible.x + visible.width + padding),
    y1: Math.min(MAP_HEIGHT, visible.y + visible.height + padding),
  };
}

function isInRenderBounds(position: Point, bounds: RenderBounds, padding: number) {
  return (
    position.x >= bounds.x0 - padding &&
    position.x <= bounds.x1 + padding &&
    position.y >= bounds.y0 - padding &&
    position.y <= bounds.y1 + padding
  );
}

function distanceSq(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function drawPlayerTargetingIndicator(out: number[], state: GameState, time: number) {
  const hero = state.heroes.player;
  if (hero.hp <= 0 || hero.respawnTimer > 0 || !hero.lastTargetRef) return;

  const age = time - hero.lastTargetTime;
  if (age < 0 || age > 0.85) return;

  const target = resolveRenderTarget(state, hero.lastTargetRef);
  if (!target) return;

  const startX = worldX(hero.position.x);
  const startZ = worldZ(hero.position.y);
  const endX = worldX(target.position.x);
  const endZ = worldZ(target.position.y);
  const dx = endX - startX;
  const dz = endZ - startZ;
  const length = Math.hypot(dx, dz);
  if (length < 0.15) return;

  const color = teamColor(hero.team, hero.heroColor);
  const tangent: [number, number] = [dx / length, dz / length];
  const alpha = 0.34 * (1 - age / 0.85);
  const segmentCount = Math.max(3, Math.min(8, Math.floor(length / 0.45)));
  const segmentStep = length / segmentCount;
  const segmentLength = segmentStep * 0.52;

  for (let index = 0; index < segmentCount; index += 1) {
    const t = (index + 0.5) / segmentCount;
    const sx = startX + dx * t;
    const sz = startZ + dz * t;
    addGroundRect(out, sx, 0.236 + index * 0.002, sz, tangent, segmentLength, 0.052, [...color.soft.slice(0, 3), alpha * (0.76 + index / segmentCount * 0.24)] as Vec4);
  }

  const targetRadius = Math.max(0.2, target.radius * WORLD_SCALE * 1.55);
  addDisc(out, endX, 0.068, endZ, targetRadius, targetRadius * 0.58, [...color.main.slice(0, 3), alpha * 0.72] as Vec4, 22);
  addDisc(out, endX, 0.074, endZ, targetRadius * 0.62, targetRadius * 0.36, hex('#071013', 0.68), 22);
}

function drawWarningIndicator(out: number[], warning: WarningIndicator) {
  const startX = worldX(warning.sourcePosition.x);
  const startZ = worldZ(warning.sourcePosition.y);
  const endX = worldX(warning.targetPosition.x);
  const endZ = worldZ(warning.targetPosition.y);
  const dx = endX - startX;
  const dz = endZ - startZ;
  const length = Math.hypot(dx, dz);
  if (length < 0.08) return;

  const progress = Math.max(0, Math.min(1, warning.ttl / warning.maxTtl));
  const age = 1 - progress;
  const color = hex(warning.color || '#FFD36A');
  const direction: [number, number] = [dx / length, dz / length];
  const midX = (startX + endX) * 0.5;
  const midZ = (startZ + endZ) * 0.5;
  const baseAlpha = warning.kind === 'tower' ? 0.28 : warning.kind === 'jungle' ? 0.22 : 0.18;
  const ringRadius = Math.max(0.26, warning.radius * WORLD_SCALE * (1.05 + age * 0.2));

  addGroundRect(out, midX, 0.25, midZ, direction, length * 0.94, warning.kind === 'tower' ? 0.048 : 0.036, [...color.slice(0, 3), baseAlpha * progress] as Vec4);
  addGroundRect(out, midX, 0.262, midZ, direction, length * 0.64, warning.kind === 'tower' ? 0.018 : 0.014, hex('#FFFFFF', 0.18 * progress));
  addDisc(out, endX, 0.142, endZ, ringRadius, ringRadius * 0.58, [...color.slice(0, 3), 0.34 * progress] as Vec4, 26);
  addDisc(out, endX, 0.152, endZ, ringRadius * 0.72, ringRadius * 0.42, hex('#071013', 0.54), 24);
  addDisc(out, endX, 0.164, endZ, ringRadius * 0.25, ringRadius * 0.15, hex('#FFFFFF', 0.16 * progress), 14);
}

function resolveRenderTarget(state: GameState, ref: TargetRef): { position: Point; radius: number } | null {
  if (ref.kind === 'hero') {
    const hero = ref.id === state.heroes.player.id ? state.heroes.player : state.heroes.enemy;
    if (hero.hp <= 0 || hero.respawnTimer > 0) return null;
    return { position: hero.position, radius: hero.radius };
  }

  if (ref.kind === 'minion') {
    const minion = state.minions.find((candidate) => candidate.id === ref.id && !candidate.dead && candidate.hp > 0);
    return minion ? { position: minion.position, radius: minion.radius } : null;
  }

  if (ref.kind === 'structure') {
    const structure = state.structures.find((candidate) => candidate.id === ref.id && candidate.alive && candidate.hp > 0);
    return structure ? { position: structure.position, radius: structure.radius } : null;
  }

  if (ref.kind === 'jungle') {
    const creature = state.jungleCreatures.find((candidate) => candidate.id === ref.id && candidate.alive && candidate.hp > 0);
    return creature ? { position: creature.position, radius: creature.radius } : null;
  }

  const boss = state.jungleBoss;
  if (!boss || !boss.alive || boss.hp <= 0) return null;
  return { position: boss.position, radius: boss.radius };
}

function drawStructure(out: number[], structure: Structure, time: number) {
  const color = teamColor(structure.team);
  const x = worldX(structure.position.x);
  const z = worldZ(structure.position.y);
  const aliveAlpha = structure.alive ? 1 : 0.22;
  const hpRatio = Math.max(0, Math.min(1, structure.hp / structure.maxHp));
  const coreWarning = structure.kind === 'core' && hpRatio < 0.5 ? (0.5 - hpRatio) * 2 : 0;
  const damageFlash = Math.max(0, 1 - (time - structure.lastDamageTime) / 0.3);

  const pulse = 0.5 + Math.sin(time * 3 + structure.position.x * 0.01) * 0.5;
  if (!structure.alive) {
    addCylinder(out, x, 0.14, z, structure.kind === 'core' ? 0.52 : 0.42, 0.28, 9, hex('#4A4D4B', 0.42));
    addCylinder(out, x, 0.48, z, structure.kind === 'core' ? 0.34 : 0.24, 0.58, 8, hex('#676B67', 0.34));
    addRubble(out, structure.position, structure.kind === 'core' ? 7 : 5);
    return;
  }

  if (structure.kind === 'core') {
    addDisc(out, x, 0.018, z, 1.68, 0.98, hex('#020607', 0.36), 32);
    addDisc(out, x, 0.034, z, 1.42 + pulse * 0.12, 0.9 + pulse * 0.07, [...color.glow.slice(0, 3), 0.48 * aliveAlpha] as Vec4, 30);
  } else {
    addDisc(out, x, 0.054, z, 1.2, 0.7, hex('#020607', 0.28), 30);
    addDisc(out, x, 0.066, z, 0.96 + pulse * 0.04, 0.56 + pulse * 0.025, [...color.glow.slice(0, 3), 0.16 * aliveAlpha] as Vec4, 26);
  }
  if (coreWarning > 0) {
    addDisc(out, x, 0.042, z, 1.62 + pulse * 0.18, 0.96 + pulse * 0.1, hex('#FF5533', 0.12 * coreWarning), 34);
  }

  if (structure.kind === 'core') {
    addBox(out, x, 1.55, z, 0.1, 2.18, 0.1, [...color.soft.slice(0, 3), 0.28 + coreWarning * 0.16] as Vec4);
    if (coreWarning > 0) {
      addBox(out, x, 1.28, z, 0.12, 1.52, 0.12, hex('#FF5533', 0.12 * coreWarning));
    }
    addCylinder(out, x, 0.16, z, 0.56, 0.32, 10, hex('#303934', aliveAlpha));
    addCylinder(out, x, 0.29, z, 0.72, 0.14, 10, hex('#151B1D', aliveAlpha));
    addCylinder(out, x, 0.46, z, 0.38, 0.56, 10, hex('#4B5550', aliveAlpha));
    addOctahedron(out, x, 1.08, z, 0.6 + pulse * 0.075, [...color.main.slice(0, 3), aliveAlpha] as Vec4);
    addOctahedron(out, x, 1.54, z, 0.27, [...color.soft.slice(0, 3), aliveAlpha] as Vec4);
    for (let index = 0; index < 3; index += 1) {
      const angle = time * (0.8 + coreWarning * 0.9 + index * 0.2) + index * ((Math.PI * 2) / 3);
      addOctahedron(out, x + Math.cos(angle) * 0.72, 1.05 + index * 0.18, z + Math.sin(angle) * 0.42, 0.12, coreWarning > 0.45 && index === 0 ? hex('#FFB096') : color.soft);
    }
    for (let index = 0; index < 4; index += 1) {
      const angle = index * (Math.PI / 2);
      addBox(out, x + Math.cos(angle) * 0.62, 0.58, z + Math.sin(angle) * 0.36, 0.14, 0.74, 0.16, hex('#242C2D', aliveAlpha));
      addOctahedron(out, x + Math.cos(angle) * 0.62, 1.02, z + Math.sin(angle) * 0.36, 0.075, color.soft);
    }
    addBillboardBar(out, structure.position, 1.92, 1.05, hpRatio, coreWarning > 0 ? hex('#FF5533') : color.main, {
      flash: damageFlash,
    });
    return;
  }

  addDisc(out, x, 0.064, z, structure.range * WORLD_SCALE, structure.range * WORLD_SCALE * 0.56, [...color.main.slice(0, 3), 0.05] as Vec4, 40);
  addDisc(out, x, 0.071, z, structure.range * WORLD_SCALE * 0.985, structure.range * WORLD_SCALE * 0.552, [...color.soft.slice(0, 3), 0.024] as Vec4, 48);
  addDisc(out, x, 0.084, z, 0.9, 0.52, [...color.soft.slice(0, 3), 0.14] as Vec4, 24);
  addDisc(out, x, 0.094, z, 0.5 + pulse * 0.04, 0.3 + pulse * 0.025, hex('#FFFFFF', 0.04), 18);
  addBox(out, x, 1.7, z, 0.088, 2.22, 0.088, [...color.soft.slice(0, 3), 0.44] as Vec4);
  addCylinder(out, x, 0.09, z, 0.74, 0.18, 12, hex('#1A2021', aliveAlpha));
  addCylinder(out, x, 0.16, z, 0.62, 0.32, 10, hex('#343D3B', aliveAlpha));
  addCylinder(out, x, 0.34, z, 0.46, 0.18, 10, [...color.dark.slice(0, 3), 0.92] as Vec4);
  addCylinder(out, x, 0.5, z, 0.38, 0.62, 9, hex('#66706C', aliveAlpha));
  addCylinder(out, x, 0.83, z, 0.31, 0.12, 9, [...color.main.slice(0, 3), 0.42] as Vec4);
  addCylinder(out, x, 1.0, z, 0.25, 1.02, 8, hex('#9CA79E', aliveAlpha));
  addCone(out, x, 1.76, z, 0.52, 0.94, 8, [...color.dark.slice(0, 3), aliveAlpha] as Vec4);
  addOctahedron(out, x, 2.42, z, 0.54 + pulse * 0.14, [...color.main.slice(0, 3), aliveAlpha] as Vec4);
  addOctahedron(out, x, 2.5, z, 0.22 + pulse * 0.055, hex('#FFFFFF', 0.84));
  addDisc(out, x, 0.18, z, 0.72 + pulse * 0.08, 0.42 + pulse * 0.04, [...color.main.slice(0, 3), 0.18 * aliveAlpha] as Vec4, 22);
  for (let index = 0; index < 4; index += 1) {
    const angle = index * (Math.PI / 2);
    addBox(out, x + Math.cos(angle) * 0.27, 1.55, z + Math.sin(angle) * 0.27, 0.14, 0.22, 0.14, hex('#C0C7BD', aliveAlpha));
  }
  for (let index = 0; index < 3; index += 1) {
    const sideSign = index === 1 ? 0 : index === 0 ? -1 : 1;
    addBox(out, x + sideSign * 0.24, 1.02, z + 0.31, 0.1, 0.46, 0.045, [...color.main.slice(0, 3), 0.64] as Vec4);
  }
  addBox(out, x - 0.4, 0.72, z + 0.18, 0.08, 0.56, 0.05, [...color.soft.slice(0, 3), 0.72] as Vec4);
  addBox(out, x + 0.4, 0.72, z + 0.18, 0.08, 0.56, 0.05, [...color.soft.slice(0, 3), 0.72] as Vec4);
  addBox(out, x, 1.08, z + 0.27, 0.13, 0.34, 0.038, hex('#101516', 0.82));
  addDisc(out, x, 0.078, z, 0.62, 0.38, [...color.soft.slice(0, 3), 0.36 * aliveAlpha] as Vec4, 18);
  addBillboardBar(out, structure.position, 2.82, 0.84, hpRatio, color.main, {
    flash: damageFlash,
  });
}

function drawJungleCreature(out: number[], state: GameState, creature: JungleCreature, time: number) {
  const x = worldX(creature.position.x);
  const z = worldZ(creature.position.y);
  const fade = creature.alive ? 1 : Math.max(0, 1 - (time - creature.deathTime) / 0.8);
  const attackFlash = Math.max(0, 1 - (time - creature.lastAttackTime) / 0.32);
  const damageFlash = Math.max(0, 1 - (time - creature.lastDamageTime) / 0.24);
  const facing = creature.facing.x >= 0 ? 1 : -1;
  const stride = Math.sin(time * (creature.kind === 'dragon' ? 5.2 : 7.2) + creature.position.x * 0.018);
  const bodyBob = Math.sin(time * (creature.kind === 'dragon' ? 2.4 : 3.1) + creature.position.y * 0.014) * (creature.kind === 'dragon' ? 0.04 : 0.026);
  const lunge = attackFlash * (creature.kind === 'dragon' ? 0.16 : 0.12);
  const aggroPulse = creature.targetRef ? 0.42 + Math.sin(time * 5.2 + creature.position.x * 0.01) * 0.16 : 0;

  if (aggroPulse > 0) {
    addDisc(out, x, 0.04, z, creature.kind === 'dragon' ? 1.44 : 0.98, creature.kind === 'dragon' ? 0.78 : 0.5, hex('#FFD36A', aggroPulse * fade * 0.22), 24);
  }

  if (creature.kind === 'dragon') {
    const target = creature.targetRef ? resolveRenderTarget(state, creature.targetRef) : null;
    const wingBeat = Math.sin(time * 3.3 + creature.position.x * 0.01) * 0.08 + attackFlash * 0.08;
    const s = 1.24;
    addDisc(out, x, 0.032, z, (1.24 + attackFlash * 0.18) * s, (0.64 + attackFlash * 0.09) * s, hex('#9B5CFF', 0.2 * fade), 24);
    addBox(out, x - facing * 0.04, 0.36 + bodyBob, z, 0.7 * s * fade, 0.44 * s * fade, 0.42 * s * fade, hex('#35195A', fade));
    addBox(out, x - facing * 0.1, 0.3 + bodyBob, z, 0.5 * s * fade, 0.18 * s * fade, 0.48 * s * fade, hex('#57269A', 0.72 * fade));
    addBox(out, x + facing * (0.5 + lunge), 0.52 + bodyBob, z, 0.36 * s * fade, 0.34 * s * fade, 0.34 * s * fade, hex('#7F45B9', fade));
    addBox(out, x + facing * (0.78 + lunge), 0.46 + bodyBob, z, 0.28 * s * fade, 0.18 * s * fade, 0.24 * s * fade, hex('#8E55CB', fade));
    addBox(out, x + facing * (0.84 + lunge), 0.66 + bodyBob, z - 0.14, 0.08 * s * fade, 0.22 * s * fade, 0.08 * s * fade, hex('#D8C7FF', 0.82 * fade));
    addBox(out, x + facing * (0.84 + lunge), 0.66 + bodyBob, z + 0.14, 0.08 * s * fade, 0.22 * s * fade, 0.08 * s * fade, hex('#D8C7FF', 0.76 * fade));
    addBox(out, x - facing * 0.14, 0.76 + bodyBob + wingBeat, z - 0.52, 0.58 * s * fade, 0.12 * s * fade, 0.28 * s * fade, hex('#20133A', 0.9 * fade));
    addBox(out, x + facing * 0.18, 0.6 + bodyBob + wingBeat * 0.4, z - 0.48, 0.34 * s * fade, 0.1 * s * fade, 0.2 * s * fade, hex('#3B1F68', 0.78 * fade));
    addBox(out, x - facing * 0.14, 0.76 + bodyBob - wingBeat, z + 0.52, 0.58 * s * fade, 0.12 * s * fade, 0.28 * s * fade, hex('#241544', 0.86 * fade));
    addBox(out, x + facing * 0.18, 0.6 + bodyBob - wingBeat * 0.4, z + 0.48, 0.34 * s * fade, 0.1 * s * fade, 0.2 * s * fade, hex('#3B1F68', 0.72 * fade));
    for (let index = 0; index < 4; index += 1) {
      addBox(out, x - facing * (0.22 + index * 0.18), 0.7 + bodyBob - index * 0.035, z, 0.08 * s * fade, 0.16 * s * fade, 0.08 * s * fade, hex('#D8C7FF', (0.7 - index * 0.07) * fade));
    }
    for (let index = 0; index < 4; index += 1) {
      addBox(out, x - facing * (0.5 + index * 0.18), 0.24 + bodyBob + index * 0.01, z + (index % 2 === 0 ? 0.05 : -0.05), (0.22 - index * 0.03) * s * fade, (0.13 - index * 0.012) * s * fade, (0.13 - index * 0.012) * s * fade, hex(index === 0 ? '#2A164A' : '#20133A', fade));
    }
    for (let index = 0; index < 4; index += 1) {
      const legX = x + facing * (-0.34 + index * 0.28);
      const legZ = z + (index % 2 === 0 ? -0.25 : 0.25);
      addBox(out, legX, 0.14 + bodyBob + stride * (index % 2 === 0 ? 0.012 : -0.012), legZ, 0.1 * s * fade, 0.28 * s * fade, 0.08 * s * fade, hex('#1A0E30', fade));
      addBox(out, legX + facing * 0.1, 0.045 + bodyBob, legZ, 0.08 * s * fade, 0.035 * s * fade, 0.07 * s * fade, hex('#D8C7FF', 0.72 * fade));
    }
    if (attackFlash > 0) {
      addBox(out, x + facing * 1.04, 0.52 + bodyBob, z, 0.22 * fade, 0.14 * fade, 0.18 * fade, hex('#FFD36A', 0.82 * attackFlash * fade));
      if (target) {
        addDragonFlameBreath(out, creature, target.position, time, attackFlash * fade);
      } else {
        addGroundRect(out, x + facing * 1.14, 0.34, z, [facing, 0], 0.78, 0.08, hex('#FFB15F', 0.42 * attackFlash * fade));
      }
    }
    addBillboardBar(out, creature.position, 1.28, 0.82, creature.hp / creature.maxHp, hex('#C7A5FF'), { flash: damageFlash });
    return;
  }

  addDisc(out, x, 0.026, z, 0.82 + attackFlash * 0.14, 0.42 + attackFlash * 0.07, hex('#7CFFB0', 0.14 * fade), 22);
  addCylinder(out, x - facing * 0.08, 0.3 + bodyBob, z, 0.45 * fade, 0.48 * fade, 10, hex('#2B2119', fade));
  addCylinder(out, x - facing * 0.24, 0.42 + bodyBob, z, 0.3 * fade, 0.26 * fade, 8, hex('#463424', 0.78 * fade));
  addCylinder(out, x + facing * (0.42 + lunge), 0.38 + bodyBob, z, 0.26 * fade, 0.34 * fade, 9, hex('#33261B', fade));
  addCone(out, x + facing * (0.28 + lunge * 0.5), 0.66 + bodyBob, z - 0.14, 0.08 * fade, 0.16 * fade, 6, hex('#211811', fade));
  addCone(out, x + facing * (0.56 + lunge * 0.5), 0.66 + bodyBob, z + 0.14, 0.08 * fade, 0.16 * fade, 6, hex('#211811', fade));
  for (let index = 0; index < 4; index += 1) {
    const sideOffset = index < 2 ? -0.23 : 0.2;
    const frontOffset = [-0.32, 0.2, -0.04, 0.44][index];
    addBox(out, x + facing * frontOffset, 0.12 + bodyBob + stride * (index % 2 === 0 ? 0.012 : -0.012), z + sideOffset, 0.1 * fade, 0.25 * fade, 0.08 * fade, hex('#19120E', fade));
    addOctahedron(out, x + facing * (frontOffset + 0.1), 0.045 + bodyBob, z + sideOffset, 0.035 * fade, hex('#D9FCE3', 0.58 * fade));
  }
  addOctahedron(out, x + facing * (0.64 + attackFlash * 0.22), 0.4 + bodyBob, z, 0.09 * fade, hex('#D9FCE3', (0.48 + attackFlash * 0.34) * fade));
  if (attackFlash > 0) {
    addGroundRect(out, x + facing * 0.78, 0.24, z, [facing, 0], 0.58, 0.045, hex('#FFD36A', 0.26 * attackFlash * fade));
  }
  addBillboardBar(out, creature.position, 0.82, 0.58, creature.hp / creature.maxHp, hex('#7CFFB0'), { flash: damageFlash });
}

function addDragonFlameBreath(out: number[], creature: JungleCreature, targetPosition: Point, time: number, flash: number) {
  const radius = creature.radius * WORLD_SCALE * 1.24;
  const { forward } = directionBasis(creature.facing);
  const mouthX = worldX(creature.position.x) + forward[0] * radius * 1.12;
  const mouthZ = worldZ(creature.position.y) + forward[1] * radius * 1.12;
  const targetX = worldX(targetPosition.x);
  const targetZ = worldZ(targetPosition.y);
  const dx = targetX - mouthX;
  const dz = targetZ - mouthZ;
  const length = Math.hypot(dx, dz);

  if (length < 0.18 || flash <= 0) {
    return;
  }

  const direction: [number, number] = [dx / length, dz / length];
  const side: [number, number] = [-direction[1], direction[0]];
  const breathLength = Math.max(0.28, length - radius * 0.42);
  const midX = mouthX + direction[0] * breathLength * 0.52;
  const midZ = mouthZ + direction[1] * breathLength * 0.52;
  const width = radius * (0.32 + flash * 0.22);
  const pulse = 0.72 + Math.sin(time * 18) * 0.16;

  addGroundRect(out, midX, 0.38, midZ, direction, breathLength, width, hex('#D94A22', 0.34 * flash));
  addGroundRect(out, mouthX + direction[0] * breathLength * 0.46, 0.46, mouthZ + direction[1] * breathLength * 0.46, direction, breathLength * 0.78, width * 0.52, hex('#FFB15F', 0.52 * flash));
  addGroundRect(out, mouthX + direction[0] * breathLength * 0.34, 0.54, mouthZ + direction[1] * breathLength * 0.34, direction, breathLength * 0.46, width * 0.24, hex('#FFF7D6', 0.36 * flash));

  for (let index = 0; index < 7; index += 1) {
    const t = (index + 1) / 8;
    const flicker = Math.sin(time * 21 + index * 1.9) * width * 0.55;
    const taper = 1 - t * 0.42;
    const px = mouthX + direction[0] * breathLength * t + side[0] * flicker;
    const pz = mouthZ + direction[1] * breathLength * t + side[1] * flicker;
    const py = 0.42 + pulse * 0.08 + t * 0.16;
    const size = radius * (0.11 + (index % 3) * 0.025) * taper;

    addDisc(out, px, 0.2 + t * 0.1, pz, size * 2.4, size * 1.2, hex(index % 2 === 0 ? '#FF5533' : '#FFB15F', 0.18 * flash * taper), 10);
    addOctahedron(out, px, py, pz, size, hex(index % 3 === 0 ? '#FFF7D6' : index % 2 === 0 ? '#FFD36A' : '#FFB15F', 0.74 * flash * taper));
  }
}

function drawJungleBoss(out: number[], boss: JungleBoss, time: number) {
  const x = worldX(boss.position.x);
  const z = worldZ(boss.position.y);
  const fade = boss.alive ? 1 : Math.max(0, 1 - (time - boss.deathTime) / 0.9);
  const bob = Math.sin(time * 1.6) * 0.08;
  const attackFlash = Math.max(0, 1 - (time - boss.lastAttackTime) / 0.36);
  const purple = hex('#6E35A8', fade);
  const darkPurple = hex('#3A1854', fade);

  addDisc(out, x, 0.04, z, (2.55 + attackFlash * 0.32) * fade, (1.34 + attackFlash * 0.16) * fade, hex('#9B5CFF', (0.2 + attackFlash * 0.12) * fade), 36);
  addCylinder(out, x, 0.56 + bob, z, (0.82 + attackFlash * 0.06) * fade, 0.78 * fade, 12, darkPurple);
  addOctahedron(out, x + 0.84 + attackFlash * 0.12, 0.78 + bob + attackFlash * 0.05, z, (0.38 + attackFlash * 0.06) * fade, purple);
  if (attackFlash > 0) {
    addOctahedron(out, x + 1.08, 0.88 + bob, z, 0.18 * fade, hex('#F0E4FF', 0.82 * attackFlash * fade));
  }

  addCone(out, x - 0.15, 1.12 + bob, z - 0.72, 0.46 * fade, 0.9 * fade, 4, hex('#2A0F3F', 0.86 * fade));
  addCone(out, x - 0.15, 1.12 + bob, z + 0.72, 0.46 * fade, 0.9 * fade, 4, hex('#2A0F3F', 0.86 * fade));

  for (let index = 1; index <= 4; index += 1) {
    addBox(out, x - index * 0.42, 0.42 + bob - index * 0.02, z, 0.42 - index * 0.05, 0.22, 0.24 - index * 0.025, darkPurple);
  }

  for (let index = 0; index < 5; index += 1) {
    addCone(out, x - 0.42 + index * 0.2, 1.08 + bob, z, 0.12 * fade, 0.32 * fade, 5, hex('#B58CFF', 0.72 * fade));
  }

  if (boss.alive) {
    addBillboardBar(out, boss.position, 1.78, 1.55, boss.hp / boss.maxHp, hex('#B58CFF'), {
      flash: Math.max(0, 1 - (time - boss.lastDamageTime) / 0.3),
    });
  }
}

function drawBossTargetTether(out: number[], state: GameState, boss: JungleBoss, time: number) {
  if (!boss.alive || !boss.targetRef) return;

  const target = resolveRenderTarget(state, boss.targetRef);
  if (!target) return;

  const startX = worldX(boss.position.x);
  const startZ = worldZ(boss.position.y);
  const endX = worldX(target.position.x);
  const endZ = worldZ(target.position.y);
  const dx = endX - startX;
  const dz = endZ - startZ;
  const length = Math.hypot(dx, dz);
  if (length < 0.12) return;

  const direction: [number, number] = [dx / length, dz / length];
  const attackFlash = Math.max(0, 1 - (time - boss.lastAttackTime) / 0.36);
  const pulse = 0.72 + Math.sin(time * 5.8) * 0.16;
  const alpha = 0.1 + pulse * 0.05 + attackFlash * 0.42;
  const midX = startX + dx * 0.5;
  const midZ = startZ + dz * 0.5;

  addGroundRect(out, midX, 0.205, midZ, direction, length, 0.045 + attackFlash * 0.055, hex('#B58CFF', alpha));
  addGroundRect(out, midX, 0.218, midZ, direction, length * 0.78, 0.022 + attackFlash * 0.025, hex('#F0E4FF', 0.09 + attackFlash * 0.2));

  const targetRadius = Math.max(0.34, target.radius * WORLD_SCALE * (1.15 + attackFlash * 0.2));
  addDisc(out, endX, 0.112, endZ, targetRadius, targetRadius * 0.58, hex('#9B5CFF', 0.18 + attackFlash * 0.22), 22);
  addDisc(out, endX, 0.122, endZ, targetRadius * 0.66, targetRadius * 0.38, hex('#071013', 0.42), 20);

  if (attackFlash <= 0) return;

  for (let index = 1; index <= 5; index += 1) {
    const t = index / 6;
    const side = Math.sin(time * 18 + index * 1.7) * 0.08;
    addOctahedron(
      out,
      startX + dx * t - direction[1] * side,
      0.34 + index * 0.045,
      startZ + dz * t + direction[0] * side,
      0.045 + index * 0.004,
      hex(index % 2 === 0 ? '#F0E4FF' : '#B58CFF', 0.72 * attackFlash),
    );
  }
}

function drawHero(out: number[], hero: Hero, isPlayer: boolean, time: number) {
  if (hero.hp <= 0 && hero.respawnTimer > 0) return;

  const color = teamColor(hero.team, hero.heroColor);
  const x = worldX(hero.position.x);
  const z = worldZ(hero.position.y);
  const moveAmount = Math.min(1, Math.hypot(hero.intent.x, hero.intent.y) + (hero.dashTimer > 0 ? 1 : 0));
  const bob = Math.sin(time * 10 + hero.position.x * 0.02) * 0.032 * moveAmount + Math.sin(time * 2.3) * 0.008;
  const radius = hero.radius * WORLD_SCALE * (isPlayer ? 0.98 : 0.96);
  const legWalkAmount = hero.rootTimer > 0
    ? 0.08
    : hero.dashTimer > 0
      ? 1
      : moveAmount > 0.08
        ? Math.max(0.62, moveAmount)
        : 0;
  const castFlash = Math.max(0, 1 - (time - hero.lastCastTime) * 5);
  const attackFlash = Math.max(0, 1 - (time - hero.lastAttackTime) / 0.28);
  const modelX = x + hero.facing.x * radius * 0.32 * attackFlash;
  const modelZ = z + hero.facing.y * radius * 0.32 * attackFlash;

  addSelectionRing(out, x, z, radius * 2.08, color.main, isPlayer ? 0.62 : 0.44, isPlayer ? 0.24 + Math.sin(time * 2.2) * 0.06 : 0);
  addHeroSilhouetteHalo(out, x, z, radius, color, isPlayer, time);
  if (hero.bossBuffTimer > 0) {
    addBossBuffAura(out, x, z, radius, time, hero.bossBuffTimer);
  }
  if (hero.bearBuffTimer > 0) {
    addJungleBuffAura(out, x, z, radius, time, hero.bearBuffTimer, 'bear');
  }
  if (hero.dragonBuffTimer > 0) {
    addJungleBuffAura(out, x, z, radius, time, hero.dragonBuffTimer, 'dragon');
  }
  if (hero.weaponBoostTimer > 0) {
    addWeaponBoostAura(out, x, z, radius, time, hero.weaponBoostTimer);
  }
  if (hero.powerShield > 0) {
    addPowerShieldShell(out, x, z, radius, time, hero.powerShield, hero.powerShieldMax, color);
  }
  if (hero.attackSpeedBoostTimer > 0) {
    addAttackSpeedAura(out, x, z, radius, time, hero.attackSpeedBoostTimer);
  }
  if (hero.shield > 0 && hero.shieldTimer > 0) {
    addActiveShieldShell(out, x, z, radius, time, hero.shieldTimer, color);
  }
  if (hero.rootTimer > 0) {
    addRootSnare(out, x, z, radius, time, hero.rootTimer);
  }
  if (hero.channelTimer > 0) {
    addChannelAura(out, x, z, radius, color, time, hero.channelTimer);
  }
  if (castFlash > 0) {
    addAbilityCastFlare(out, x, z, hero.facing, radius, color, hero.lastCastAbility, castFlash, time);
  }
  addLegPair(out, modelX, modelZ, hero.facing, radius, color.dark, time * 16 + hero.position.x * 0.03, legWalkAmount, bob);
  if (hero.team === 'blue') {
    drawPlayerHeroDesign(out, modelX, modelZ, hero.facing, radius, bob, color, time, hero.heroDesign ?? 'knight');
  } else {
    drawCinderWarden(out, modelX, modelZ, hero.facing, radius, bob, color, time);
  }
  if (attackFlash > 0) {
    addAttackArc(out, modelX, modelZ, hero.facing, radius, color.soft, attackFlash);
  }
  if (hero.dashTimer > 0) {
    addDashAfterimage(out, x, z, hero.facing, radius, color.main);
  }
  if (isPlayer) {
    addPlayerChevron(out, x, z, color.soft, time);
  } else {
    addEnemyThreatMarker(out, x, z, color.main, time);
  }
  addBillboardBar(out, hero.position, 1.36, isPlayer ? 0.74 : 0.66, hero.hp / hero.maxHp, color.main, {
    shieldRatio: (hero.shield + hero.powerShield) / hero.maxHp,
    flash: Math.max(0, 1 - (time - hero.lastDamageTime) / 0.3),
  });
}

function addAbilityCastFlare(
  out: number[],
  x: number,
  z: number,
  facing: Point,
  radius: number,
  color: ReturnType<typeof teamColor>,
  ability: Hero['lastCastAbility'],
  flash: number,
  time: number,
) {
  const { forward, side } = directionBasis(facing);
  const castColor = abilityCastColor(ability, color);
  const handX = x + forward[0] * radius * 1.16 + side[0] * radius * 0.52;
  const handZ = z + forward[1] * radius * 1.16 + side[1] * radius * 0.52;
  const frontX = x + forward[0] * radius * 1.65;
  const frontZ = z + forward[1] * radius * 1.65;
  const pulse = 0.72 + Math.sin(time * 16) * 0.18;

  addDisc(out, x, 0.12, z, radius * (1.85 + flash * 0.64), radius * (1.05 + flash * 0.34), [...castColor.slice(0, 3), 0.1 * flash] as Vec4, 22);

  if (ability === 'bolt') {
    for (let index = 0; index < 5; index += 1) {
      const zig = index % 2 === 0 ? 1 : -1;
      addGroundRect(
        out,
        x + forward[0] * radius * (0.58 + index * 0.32) + side[0] * zig * radius * 0.12,
        0.52 + index * 0.04,
        z + forward[1] * radius * (0.58 + index * 0.32) + side[1] * zig * radius * 0.12,
        [forward[0] + side[0] * zig * 0.42, forward[1] + side[1] * zig * 0.42],
        radius * 0.46,
        radius * 0.05,
        hex(index % 2 === 0 ? '#FFFFFF' : '#9CEEFF', (0.42 - index * 0.04) * flash),
      );
    }
    addGroundRect(out, handX + forward[0] * radius * 0.2, 0.82 + pulse * 0.04, handZ + forward[1] * radius * 0.2, forward, radius * 0.72, radius * 0.065, hex('#FFFFFF', 0.72 * flash));
    return;
  }

  if (ability === 'fireball') {
    addFireballCastFlare(out, frontX, frontZ, forward, side, radius, flash, time);
    return;
  }

  if (ability === 'pulse') {
    addDisc(out, x, 0.15, z, radius * (2.2 + flash * 0.7), radius * (1.26 + flash * 0.36), hex('#67F58F', 0.18 * flash), 32);
    for (let index = 0; index < 8; index += 1) {
      const angle = time * 2.8 + index * ((Math.PI * 2) / 8);
      addOctahedron(out, x + Math.cos(angle) * radius * 1.45, 0.32 + Math.sin(time * 5 + index) * 0.05, z + Math.sin(angle) * radius * 0.82, radius * 0.075, hex('#D7FFE4', 0.7 * flash));
    }
    return;
  }

  if (ability === 'shield') {
    addDisc(out, x, 0.16, z, radius * (2.0 + flash * 0.38), radius * (1.14 + flash * 0.22), hex('#88EEFF', 0.2 * flash), 32);
    addDisc(out, x, 0.18, z, radius * (1.3 + flash * 0.22), radius * (0.74 + flash * 0.12), hex('#071013', 0.38 * flash), 28);
    for (let index = 0; index < 4; index += 1) {
      const angle = time * 4.4 + index * (Math.PI / 2);
      addBox(out, x + Math.cos(angle) * radius * 1.28, 0.6 + Math.sin(angle + time) * 0.05, z + Math.sin(angle) * radius * 0.74, radius * 0.18, radius * 0.46, radius * 0.06, hex('#D8FBFF', 0.76 * flash));
    }
    return;
  }

  if (ability === 'chain') {
    for (let index = 0; index < 6; index += 1) {
      const zig = index % 2 === 0 ? 1 : -1;
      addGroundRect(
        out,
        x + forward[0] * radius * (0.6 + index * 0.26) + side[0] * zig * radius * 0.2,
        0.34 + index * 0.025,
        z + forward[1] * radius * (0.6 + index * 0.26) + side[1] * zig * radius * 0.2,
        [forward[0] + side[0] * zig * 0.4, forward[1] + side[1] * zig * 0.4],
        radius * 0.34,
        radius * 0.05,
        hex(index % 2 === 0 ? '#D8FBFF' : '#9CEEFF', 0.26 * flash),
      );
    }
    addOctahedron(out, handX, 0.78, handZ, radius * 0.18, hex('#FFFFFF', 0.82 * flash));
    return;
  }

  if (ability === 'trap') {
    addDisc(out, frontX, 0.13, frontZ, radius * 1.02, radius * 0.58, hex('#C7A5FF', 0.18 * flash), 24);
    for (let index = 0; index < 6; index += 1) {
      const angle = index * ((Math.PI * 2) / 6) + time * 0.7;
      addGroundRect(out, frontX + Math.cos(angle) * radius * 0.58, 0.2, frontZ + Math.sin(angle) * radius * 0.34, [Math.cos(angle + Math.PI / 2), Math.sin(angle + Math.PI / 2)], radius * 0.36, radius * 0.05, hex('#FFD36A', 0.24 * flash));
    }
    return;
  }

  if (ability === 'dash') {
    addGroundRect(out, x - forward[0] * radius * 0.3, 0.22, z - forward[1] * radius * 0.3, forward, radius * 3.0, radius * 0.18, [...color.main.slice(0, 3), 0.24 * flash] as Vec4);
    addGroundRect(out, x + side[0] * radius * 0.42, 0.24, z + side[1] * radius * 0.42, [forward[0] + side[0] * 0.18, forward[1] + side[1] * 0.18], radius * 1.4, radius * 0.06, hex('#FFFFFF', 0.18 * flash));
    return;
  }

  if (ability === 'ult') {
    addDisc(out, x, 0.16, z, radius * (2.7 + flash), radius * (1.54 + flash * 0.48), hex('#8B5CF6', 0.22 * flash), 40);
    for (let index = 0; index < 9; index += 1) {
      const angle = time * 2.6 + index * ((Math.PI * 2) / 9);
      const bx = x + Math.cos(angle) * radius * 1.65;
      const bz = z + Math.sin(angle) * radius * 0.94;
      addBox(out, bx, 0.72 + (index % 3) * 0.12, bz, radius * 0.06, 1.04 * flash, radius * 0.06, hex(index % 2 === 0 ? '#C7A5FF' : '#FFD36A', 0.36 * flash));
    }
    return;
  }

  addOctahedron(out, handX, 0.72 + pulse * 0.04, handZ, radius * 0.22, castColor);
}

function abilityCastColor(ability: Hero['lastCastAbility'], color: ReturnType<typeof teamColor>) {
  if (ability === 'fireball') return hex('#FFB15F');
  if (ability === 'pulse') return hex('#67F58F');
  if (ability === 'shield') return hex('#88EEFF');
  if (ability === 'chain') return hex('#9CEEFF');
  if (ability === 'trap') return hex('#C7A5FF');
  if (ability === 'ult') return hex('#FFD36A');
  if (ability === 'dash') return color.main;
  return color.soft;
}

function drawPlayerHeroDesign(
  out: number[],
  x: number,
  z: number,
  facing: Point,
  radius: number,
  bob: number,
  color: ReturnType<typeof teamColor>,
  time: number,
  design: Hero['heroDesign'],
) {
  if (design === 'mage') {
    drawMageHero(out, x, z, facing, radius, bob, color, time);
    return;
  }
  if (design === 'berserker') {
    drawBerserkerHero(out, x, z, facing, radius, bob, color, time);
    return;
  }
  if (design === 'ranger') {
    drawRangerHero(out, x, z, facing, radius, bob, color, time);
    return;
  }
  if (design === 'warlock') {
    drawWarlockHero(out, x, z, facing, radius, bob, color, time);
    return;
  }
  if (design === 'paladin') {
    drawPaladinHero(out, x, z, facing, radius, bob, color, time);
    return;
  }

  drawArcKnight(out, x, z, facing, radius, bob, color);
}

function drawArcKnight(out: number[], x: number, z: number, facing: Point, radius: number, bob: number, color: ReturnType<typeof teamColor>) {
  const { forward, side } = directionBasis(facing);
  addDisc(out, x, 0.058, z, radius * 1.55, radius * 0.82, [...color.main.slice(0, 3), 0.12] as Vec4, 22);
  addBox(out, x, 0.3 + bob, z, radius * 1.04, 0.42, radius * 0.76, color.dark);
  addBox(out, x + forward[0] * radius * 0.08, 0.62 + bob, z + forward[1] * radius * 0.08, radius * 0.78, 0.52, radius * 0.56, color.main);
  addBox(out, x - forward[0] * radius * 0.42, 0.55 + bob, z - forward[1] * radius * 0.42, radius * 0.54, 0.48, radius * 0.18, hex('#041B23', 0.48));
  addCone(out, x + side[0] * radius * 0.55, 0.82 + bob, z + side[1] * radius * 0.55, radius * 0.24, 0.2, 6, color.soft);
  addCone(out, x - side[0] * radius * 0.55, 0.82 + bob, z - side[1] * radius * 0.55, radius * 0.24, 0.2, 6, color.soft);
  addOctahedron(out, x + forward[0] * radius * 0.08, 0.68 + bob, z + forward[1] * radius * 0.08, radius * 0.16, color.soft);
  addOctahedron(out, x, 0.98 + bob, z, radius * 0.34, hex('#D8FBFF'));
  addBox(out, x, 1.22 + bob, z, radius * 0.12, 0.22, radius * 0.12, color.soft);
  addCone(out, x - forward[0] * radius * 0.05, 1.4 + bob, z - forward[1] * radius * 0.05, radius * 0.12, 0.36, 5, color.soft);

  const swordX = x + forward[0] * radius * 1.34 + side[0] * radius * 0.42;
  const swordZ = z + forward[1] * radius * 1.34 + side[1] * radius * 0.42;
  addBox(out, swordX - forward[0] * radius * 0.04, 0.56 + bob, swordZ - forward[1] * radius * 0.04, radius * 0.56, 0.1, radius * 0.14, color.dark);
  addBox(out, swordX, 0.76 + bob, swordZ, radius * 0.18, 0.9, radius * 0.12, hex('#EAF8F5'));
  addOctahedron(out, swordX + forward[0] * radius * 0.06, 1.28 + bob, swordZ + forward[1] * radius * 0.06, radius * 0.12, color.soft);

  const shieldX = x + forward[0] * radius * 0.5 - side[0] * radius * 0.72;
  const shieldZ = z + forward[1] * radius * 0.5 - side[1] * radius * 0.72;
  addOctahedron(out, shieldX, 0.62 + bob, shieldZ, radius * 0.42, color.dark);
  addOctahedron(out, shieldX, 0.65 + bob, shieldZ, radius * 0.29, color.main);
  addOctahedron(out, shieldX, 0.64 + bob, shieldZ, radius * 0.18, color.soft);
}

function drawMageHero(out: number[], x: number, z: number, facing: Point, radius: number, bob: number, color: ReturnType<typeof teamColor>, time: number) {
  const { side } = directionBasis(facing);
  addDisc(out, x, 0.22 + bob, z, radius * 0.72, radius * 0.42, [...color.soft.slice(0, 3), 0.18] as Vec4, 18);
  addCylinder(out, x, 0.42 + bob, z, radius * 0.46, 0.72, 8, color.dark);
  addCone(out, x, 0.9 + bob, z, radius * 0.42, 0.56, 8, color.main);
  addOctahedron(out, x, 1.28 + bob, z, radius * 0.25, hex('#EAF8F5'));
  addBox(out, x + side[0] * radius * 0.9, 0.74 + bob, z + side[1] * radius * 0.9, radius * 0.1, 1.12, radius * 0.1, hex('#D8FBFF'));
  addOctahedron(out, x + side[0] * radius * 0.9, 1.42 + bob, z + side[1] * radius * 0.9, radius * 0.22, color.soft);
  const orbAngle = time * 2.8;
  addOctahedron(out, x - side[0] * radius * 1.12 + Math.cos(orbAngle) * radius * 0.18, 0.9 + bob + Math.sin(orbAngle) * 0.08, z - side[1] * radius * 1.12, radius * 0.2, color.main);
}

function drawBerserkerHero(out: number[], x: number, z: number, facing: Point, radius: number, bob: number, color: ReturnType<typeof teamColor>, time: number) {
  const { forward, side } = directionBasis(facing);
  const ragePulse = 0.72 + Math.sin(time * 5.2) * 0.12;
  addDisc(out, x, 0.06, z, radius * (1.72 + ragePulse * 0.12), radius * (0.92 + ragePulse * 0.06), [...color.main.slice(0, 3), 0.11] as Vec4, 20);
  addBox(out, x, 0.34 + bob, z, radius * 1.22, 0.48, radius * 0.94, color.dark);
  addBox(out, x, 0.74 + bob, z, radius * 0.98, 0.54, radius * 0.76, color.main);
  addOctahedron(out, x, 1.12 + bob, z, radius * 0.32, hex('#EAF8F5'));
  for (const spikeOffset of [-0.42, 0, 0.42]) {
    addCone(out, x + side[0] * radius * spikeOffset, 1.35 + bob, z + side[1] * radius * spikeOffset, radius * 0.12, 0.28, 5, color.soft);
  }
  for (const sideSign of [-1, 1]) {
    const handX = x + side[0] * radius * sideSign * 0.88 + forward[0] * radius * 0.52;
    const handZ = z + side[1] * radius * sideSign * 0.88 + forward[1] * radius * 0.52;
    addBox(out, handX, 0.64 + bob, handZ, radius * 0.16, 0.7, radius * 0.12, color.dark);
    addBox(out, handX + forward[0] * radius * 0.44, 0.9 + bob, handZ + forward[1] * radius * 0.44, radius * 0.18, 0.7, radius * 0.18, hex('#EAF8F5'));
    addOctahedron(out, handX + forward[0] * radius * 0.72, 0.72 + bob, handZ + forward[1] * radius * 0.72, radius * 0.28, color.soft);
    addGroundRect(out, handX + forward[0] * radius * 0.78, 0.23, handZ + forward[1] * radius * 0.78, [forward[0] + side[0] * sideSign * 0.5, forward[1] + side[1] * sideSign * 0.5], radius * 0.72, radius * 0.05, [...color.soft.slice(0, 3), 0.17] as Vec4);
  }
}

function drawRangerHero(out: number[], x: number, z: number, facing: Point, radius: number, bob: number, color: ReturnType<typeof teamColor>, time: number) {
  const { forward, side } = directionBasis(facing);
  const focusPulse = 0.68 + Math.sin(time * 3.6) * 0.1;
  addDisc(out, x, 0.052, z, radius * (1.44 + focusPulse * 0.12), radius * (0.78 + focusPulse * 0.05), hex('#7CFFB0', 0.12), 20);
  addCone(out, x - forward[0] * radius * 0.32, 0.42 + bob, z - forward[1] * radius * 0.32, radius * 0.56, 0.76, 8, color.dark);
  addCylinder(out, x, 0.74 + bob, z, radius * 0.38, 0.54, 8, color.main);
  addCone(out, x, 1.12 + bob, z, radius * 0.34, 0.32, 8, color.dark);
  addOctahedron(out, x + forward[0] * radius * 0.12, 1.06 + bob, z + forward[1] * radius * 0.12, radius * 0.18, hex('#EAF8F5'));
  const bowX = x + side[0] * radius * 0.78 + forward[0] * radius * 0.2;
  const bowZ = z + side[1] * radius * 0.78 + forward[1] * radius * 0.2;
  addBox(out, bowX, 0.72 + bob, bowZ, radius * 0.08, 1.12, radius * 0.08, color.soft);
  addOctahedron(out, bowX + side[0] * radius * 0.08, 1.28 + bob, bowZ + side[1] * radius * 0.08, radius * 0.08, hex('#D7FFE4', 0.82));
  addOctahedron(out, bowX - side[0] * radius * 0.08, 0.28 + bob, bowZ - side[1] * radius * 0.08, radius * 0.08, hex('#D7FFE4', 0.82));
  addGroundRect(out, x + forward[0] * radius * 0.92, 0.36, z + forward[1] * radius * 0.92, forward, radius * 1.15, radius * 0.035, hex('#D7FFE4', 0.28));
  addGroundRect(out, x - forward[0] * radius * 0.56 - side[0] * radius * 0.44, 0.54 + bob, z - forward[1] * radius * 0.56 - side[1] * radius * 0.44, [forward[0] + side[0] * 0.26, forward[1] + side[1] * 0.26], radius * 0.7, radius * 0.055, color.soft);
  for (let index = 0; index < 3; index += 1) {
    const leafAngle = time * 1.7 + index * 2.1;
    addOctahedron(out, x + Math.cos(leafAngle) * radius * 1.05, 0.3 + Math.sin(time * 2.4 + index) * 0.06, z + Math.sin(leafAngle) * radius * 0.58, radius * 0.055, hex(index % 2 === 0 ? '#7CFFB0' : '#D7FFE4', 0.64));
  }
}

function drawWarlockHero(out: number[], x: number, z: number, facing: Point, radius: number, bob: number, color: ReturnType<typeof teamColor>, time: number) {
  const { forward, side } = directionBasis(facing);
  const floatBob = bob + Math.sin(time * 2.2) * 0.05;
  addDisc(out, x, 0.25, z, radius * 1.08, radius * 0.58, hex('#8B5CF6', 0.18), 22);
  addDisc(out, x, 0.29, z, radius * 0.62, radius * 0.34, hex('#071013', 0.56), 20);
  addCone(out, x, 0.62 + floatBob, z, radius * 0.62, 1.0, 9, color.dark);
  addOctahedron(out, x, 1.24 + floatBob, z, radius * 0.34, color.main);
  addOctahedron(out, x, 1.5 + floatBob, z, radius * 0.15, hex('#C7A5FF', 0.78));
  for (let index = -2; index <= 2; index += 1) {
    addGroundRect(out, x - forward[0] * radius * 0.66 + side[0] * index * radius * 0.24, 0.2, z - forward[1] * radius * 0.66 + side[1] * index * radius * 0.24, [forward[0] + side[0] * index * 0.3, forward[1] + side[1] * index * 0.3], radius * 0.62, 0.04, hex('#C7A5FF', 0.2));
  }
  for (let index = 0; index < 4; index += 1) {
    const angle = time * 2.4 + index * (Math.PI / 2);
    const ox = x + Math.cos(angle) * radius * 1.05;
    const oz = z + Math.sin(angle) * radius * 0.6;
    addOctahedron(out, ox, 0.78 + floatBob + Math.sin(angle) * 0.08, oz, radius * 0.09, hex(index % 2 === 0 ? '#C7A5FF' : '#8B5CF6', 0.74));
    addGroundRect(out, x + (ox - x) * 0.5, 0.26, z + (oz - z) * 0.5, [ox - x, oz - z], radius * 0.82, radius * 0.032, hex('#C7A5FF', 0.12));
  }
}

function drawPaladinHero(out: number[], x: number, z: number, facing: Point, radius: number, bob: number, color: ReturnType<typeof teamColor>, time: number) {
  const { forward, side } = directionBasis(facing);
  const holyPulse = 0.74 + Math.sin(time * 3.2) * 0.12;
  addDisc(out, x, 0.056, z, radius * (1.84 + holyPulse * 0.16), radius * (1.0 + holyPulse * 0.08), hex('#FFD36A', 0.14), 24);
  addCylinder(out, x, 0.34 + bob, z, radius * 0.74, 0.48, 9, color.dark);
  addCylinder(out, x, 0.78 + bob, z, radius * 0.56, 0.62, 9, color.main);
  addOctahedron(out, x, 1.22 + bob, z, radius * 0.32, hex('#FFF7D6'));
  addDisc(out, x, 1.58 + bob + Math.sin(time * 2) * 0.02, z, radius * 0.54, radius * 0.22, hex('#FFD36A', 0.34), 18);
  addBox(out, x + forward[0] * radius * 1.18 + side[0] * radius * 0.52, 0.74 + bob, z + forward[1] * radius * 1.18 + side[1] * radius * 0.52, radius * 0.18, 0.92, radius * 0.14, hex('#EAF8F5'));
  addOctahedron(out, x + forward[0] * radius * 1.36 + side[0] * radius * 0.52, 0.36 + bob, z + forward[1] * radius * 1.36 + side[1] * radius * 0.52, radius * 0.28, color.soft);
  const shieldX = x + forward[0] * radius * 0.42 - side[0] * radius * 0.78;
  const shieldZ = z + forward[1] * radius * 0.42 - side[1] * radius * 0.78;
  addOctahedron(out, shieldX, 0.72 + bob, shieldZ, radius * 0.4, hex('#FFF7D6', 0.9));
  addOctahedron(out, shieldX, 0.73 + bob, shieldZ, radius * 0.22, color.main);
  addGroundRect(out, x, 0.22, z, side, radius * 1.35, radius * 0.05, hex('#FFD36A', 0.18));
}

function drawCinderWarden(out: number[], x: number, z: number, facing: Point, radius: number, bob: number, color: ReturnType<typeof teamColor>, time: number) {
  const { forward, side } = directionBasis(facing);
  const flamePulse = 0.76 + Math.sin(time * 4.2) * 0.14;
  addDisc(out, x, 0.06, z, radius * (1.72 + flamePulse * 0.14), radius * (0.9 + flamePulse * 0.08), hex('#FF5533', 0.13), 24);
  addBox(out, x - forward[0] * radius * 0.5, 0.56 + bob, z - forward[1] * radius * 0.5, radius * 1.22, 0.78, radius * 0.26, hex('#190706', 0.68));
  addBox(out, x, 0.32 + bob, z, radius * 1.0, 0.46, radius * 0.82, color.dark);
  addBox(out, x, 0.68 + bob, z, radius * 0.82, 0.5, radius * 0.64, color.main);
  addOctahedron(out, x + forward[0] * radius * 0.06, 0.72 + bob, z + forward[1] * radius * 0.06, radius * 0.18, hex('#FFB15F', 0.92));
  addOctahedron(out, x + forward[0] * radius * 0.08, 0.74 + bob, z + forward[1] * radius * 0.08, radius * 0.08, hex('#FFF0C8', 0.86));
  addOctahedron(out, x, 1.03 + bob, z, radius * 0.34, hex('#FFE0D4'));
  for (const offset of [-0.32, 0, 0.32]) {
    addCone(out, x + side[0] * radius * offset, 1.28 + bob, z + side[1] * radius * offset, radius * 0.13, 0.24, 5, color.soft);
  }
  for (let index = 0; index < 3; index += 1) {
    addCone(out, x - forward[0] * radius * (0.24 + index * 0.22), 0.92 + bob - index * 0.12, z - forward[1] * radius * (0.24 + index * 0.22), radius * (0.12 - index * 0.02), 0.28 - index * 0.035, 5, hex('#FFB15F', 0.72 - index * 0.12));
  }

  for (const sideSign of [-1, 1]) {
    const armX = x + side[0] * radius * sideSign * 0.72 + forward[0] * radius * 0.34;
    const armZ = z + side[1] * radius * sideSign * 0.72 + forward[1] * radius * 0.34;
    addBox(out, armX, 0.68 + bob, armZ, radius * 0.22, 0.54, radius * 0.18, color.dark);
    for (let claw = -1; claw <= 1; claw += 1) {
      addBox(out, armX + forward[0] * radius * 0.48 + side[0] * claw * radius * 0.1, 0.42 + bob, armZ + forward[1] * radius * 0.48 + side[1] * claw * radius * 0.1, radius * 0.08, 0.34, radius * 0.08, color.soft);
      addOctahedron(out, armX + forward[0] * radius * 0.66 + side[0] * claw * radius * 0.1, 0.28 + bob, armZ + forward[1] * radius * 0.66 + side[1] * claw * radius * 0.1, radius * 0.065, hex('#FFD36A', 0.78));
    }
  }

  const orbAngle = time * 2.2;
  addOctahedron(out, x - side[0] * radius * 1.15 + Math.cos(orbAngle) * radius * 0.2, 0.82 + bob + Math.sin(orbAngle) * 0.05, z - side[1] * radius * 1.15, radius * 0.22, color.soft);
  addOctahedron(out, x + side[0] * radius * 1.08 + Math.sin(orbAngle) * radius * 0.16, 0.72 + bob + Math.cos(orbAngle) * 0.04, z + side[1] * radius * 1.08, radius * 0.14, hex('#FFB15F', 0.76));

  for (let index = 1; index <= 3; index += 1) {
    addOctahedron(out, x - forward[0] * radius * index * 0.8, 0.18 + index * 0.05, z - forward[1] * radius * index * 0.8, radius * (0.22 - index * 0.035), [...color.main.slice(0, 3), 0.18 / index] as Vec4);
  }
}

function addAttackArc(out: number[], x: number, z: number, facing: Point, radius: number, color: Vec4, flash: number) {
  const { forward, side } = directionBasis(facing);
  for (let index = -2; index <= 2; index += 1) {
    const arcX = x + forward[0] * radius * 1.7 + side[0] * radius * index * 0.25;
    const arcZ = z + forward[1] * radius * 1.7 + side[1] * radius * index * 0.25;
    addGroundRect(out, arcX, 0.2 + Math.abs(index) * 0.012, arcZ, [forward[0] + side[0] * index * 0.18, forward[1] + side[1] * index * 0.18], radius * 0.62, 0.04, [...color.slice(0, 3), 0.28 * flash] as Vec4);
  }
}

function addChannelAura(out: number[], x: number, z: number, radius: number, color: ReturnType<typeof teamColor>, time: number, channelTimer: number) {
  const charge = Math.max(0, Math.min(1, 1 - channelTimer));
  const pulse = 0.74 + Math.sin(time * 9) * 0.16;
  const ringRadius = radius * (2.3 + charge * 2.1);

  addDisc(out, x, 0.066, z, ringRadius, ringRadius * 0.58, [...color.main.slice(0, 3), 0.16 * pulse] as Vec4, 34);
  addDisc(out, x, 0.074, z, ringRadius * 0.58, ringRadius * 0.34, hex('#071013', 0.5), 28);

  for (let index = 0; index < 8; index += 1) {
    const angle = time * 3.5 + index * ((Math.PI * 2) / 8);
    const sparkRadius = radius * (1.45 + charge * 1.25);
    addOctahedron(
      out,
      x + Math.cos(angle) * sparkRadius,
      0.32 + Math.sin(time * 4 + index) * 0.08,
      z + Math.sin(angle) * sparkRadius * 0.58,
      0.046 + charge * 0.024,
      index % 2 === 0 ? color.soft : hex('#C7A5FF', 0.86),
    );
  }

  addBox(out, x, 0.78 + charge * 0.24, z, radius * 0.16, 1.1 + charge * 0.7, radius * 0.16, [...color.soft.slice(0, 3), 0.16] as Vec4);
}

function addBossBuffAura(out: number[], x: number, z: number, radius: number, time: number, timer: number) {
  const fade = Math.min(1, timer / 2.5);
  const pulse = 0.7 + Math.sin(time * 4.2) * 0.16;
  const ringRadius = radius * (2.45 + pulse * 0.2);

  addDisc(out, x, 0.082, z, ringRadius, ringRadius * 0.58, hex('#FFD36A', 0.14 * fade), 34);
  addDisc(out, x, 0.09, z, ringRadius * 0.72, ringRadius * 0.42, hex('#071013', 0.38 * fade), 30);

  for (let index = 0; index < 4; index += 1) {
    const angle = time * 2.1 + index * (Math.PI / 2);
    const orbitX = x + Math.cos(angle) * radius * 1.55;
    const orbitZ = z + Math.sin(angle) * radius * 0.9;
    const color = index % 2 === 0 ? '#FFD36A' : '#B58CFF';
    addOctahedron(out, orbitX, 0.48 + Math.sin(time * 3.2 + index) * 0.055, orbitZ, radius * 0.12, hex(color, 0.82 * fade));
  }
}

function addWeaponBoostAura(out: number[], x: number, z: number, radius: number, time: number, timer: number) {
  const fade = Math.min(1, timer / 1.8);
  const pulse = 0.72 + Math.sin(time * 7.4) * 0.14;
  const ringRadius = radius * (2.05 + pulse * 0.16);

  addDisc(out, x, 0.088, z, ringRadius, ringRadius * 0.56, hex('#C7A5FF', 0.11 * fade), 30);
  addDisc(out, x, 0.096, z, ringRadius * 0.62, ringRadius * 0.35, hex('#071013', 0.34 * fade), 26);

  for (let index = 0; index < 5; index += 1) {
    const angle = time * 3.1 + index * ((Math.PI * 2) / 5);
    const orbitX = x + Math.cos(angle) * radius * 1.28;
    const orbitZ = z + Math.sin(angle) * radius * 0.74;
    const color = index % 2 === 0 ? '#FFD36A' : '#EAF8F5';
    addOctahedron(out, orbitX, 0.42 + Math.sin(time * 4.6 + index) * 0.05, orbitZ, radius * 0.082, hex(color, 0.72 * fade));
  }
}

function addJungleBuffAura(out: number[], x: number, z: number, radius: number, time: number, timer: number, kind: 'bear' | 'dragon') {
  const fade = Math.min(1, timer / 1.6);
  const pulse = 0.72 + Math.sin(time * (kind === 'dragon' ? 7.2 : 5.4)) * 0.14;
  const ringRadius = radius * (kind === 'dragon' ? 2.72 : 2.36) + pulse * radius * 0.16;
  const auraColor = kind === 'dragon' ? '#FF9F2F' : '#7CFFB0';
  const moteColor = kind === 'dragon' ? '#FFD36A' : '#D7FFE4';

  addDisc(out, x, 0.102, z, ringRadius, ringRadius * 0.58, hex(auraColor, 0.13 * fade), 34);
  addDisc(out, x, 0.11, z, ringRadius * 0.68, ringRadius * 0.4, hex('#071013', 0.34 * fade), 30);

  for (let index = 0; index < 5; index += 1) {
    const angle = time * (kind === 'dragon' ? 3.8 : 2.5) + index * ((Math.PI * 2) / 5);
    const orbitX = x + Math.cos(angle) * radius * (kind === 'dragon' ? 1.62 : 1.42);
    const orbitZ = z + Math.sin(angle) * radius * (kind === 'dragon' ? 0.94 : 0.82);
    const y = 0.42 + Math.sin(time * 4.3 + index) * 0.06;
    if (kind === 'dragon') {
      addCone(out, orbitX, y, orbitZ, radius * 0.1, radius * 0.22, 6, hex(moteColor, 0.7 * fade));
    } else {
      addOctahedron(out, orbitX, y, orbitZ, radius * 0.09, hex(moteColor, 0.72 * fade));
    }
  }
}

function addPowerShieldShell(
  out: number[],
  x: number,
  z: number,
  radius: number,
  time: number,
  shield: number,
  maxShield: number,
  color: ReturnType<typeof teamColor>,
) {
  const ratio = maxShield > 0 ? Math.max(0.2, Math.min(1, shield / maxShield)) : 1;
  const pulse = 0.78 + Math.sin(time * 5.8) * 0.08;
  const shellRadius = radius * (2.32 + pulse * 0.08);

  addDisc(out, x, 0.13, z, shellRadius, shellRadius * 0.58, hex('#88EEFF', 0.12 + 0.08 * ratio), 38);
  addDisc(out, x, 0.14, z, shellRadius * 0.78, shellRadius * 0.45, hex('#071013', 0.22), 34);
  addCylinder(out, x, 0.84, z, shellRadius * 0.62, 1.58, 24, hex('#88EEFF', 0.08 + ratio * 0.08));

  for (let index = 0; index < 8; index += 1) {
    const angle = time * 1.8 + index * ((Math.PI * 2) / 8);
    addOctahedron(
      out,
      x + Math.cos(angle) * radius * 1.72,
      0.45 + Math.sin(time * 3.6 + index) * 0.08,
      z + Math.sin(angle) * radius * 0.98,
      radius * 0.06,
      index % 2 === 0 ? hex('#D8FBFF', 0.76 * ratio) : [...color.soft.slice(0, 3), 0.62 * ratio] as Vec4,
    );
  }
}

function addAttackSpeedAura(out: number[], x: number, z: number, radius: number, time: number, timer: number) {
  const fade = Math.min(1, timer / 1.4);
  const pulse = 0.72 + Math.sin(time * 11.2) * 0.16;
  const ringRadius = radius * (2.18 + pulse * 0.14);

  addDisc(out, x, 0.118, z, ringRadius, ringRadius * 0.58, hex('#FFD36A', 0.14 * fade), 32);
  addDisc(out, x, 0.128, z, ringRadius * 0.66, ringRadius * 0.38, hex('#071013', 0.34 * fade), 28);

  for (let index = 0; index < 6; index += 1) {
    const angle = time * 6.2 + index * ((Math.PI * 2) / 6);
    const forward = [Math.cos(angle), Math.sin(angle)] as [number, number];
    addGroundRect(
      out,
      x + forward[0] * radius * 1.35,
      0.36 + index * 0.01,
      z + forward[1] * radius * 0.78,
      forward,
      radius * 0.48,
      radius * 0.036,
      hex(index % 2 === 0 ? '#FFFFFF' : '#FFD36A', 0.24 * fade),
    );
  }
}

function addActiveShieldShell(out: number[], x: number, z: number, radius: number, time: number, timer: number, color: ReturnType<typeof teamColor>) {
  const fade = Math.min(1, timer / 0.7);
  const pulse = 0.78 + Math.sin(time * 5.4) * 0.12;
  const shellRadius = radius * (1.86 + pulse * 0.08);

  addDisc(out, x, 0.096, z, shellRadius, shellRadius * 0.56, hex('#88EEFF', 0.16 * fade), 30);
  addDisc(out, x, 0.104, z, shellRadius * 0.72, shellRadius * 0.42, hex('#071013', 0.38 * fade), 26);

  for (let index = 0; index < 6; index += 1) {
    const angle = time * 1.35 + index * ((Math.PI * 2) / 6);
    const sx = x + Math.cos(angle) * radius * 1.32;
    const sz = z + Math.sin(angle) * radius * 0.76;
    const alpha = 0.52 + Math.sin(time * 4 + index) * 0.18;
    addOctahedron(out, sx, 0.68 + Math.sin(time * 3.1 + index) * 0.05, sz, radius * 0.075, [...color.soft.slice(0, 3), alpha * fade] as Vec4);
    addGroundRect(out, sx, 0.18, sz, [Math.cos(angle + Math.PI / 2), Math.sin(angle + Math.PI / 2)], radius * 0.46, radius * 0.035, hex('#D8FBFF', 0.11 * fade));
  }
}

function addRootSnare(out: number[], x: number, z: number, radius: number, time: number, timer: number) {
  const fade = Math.min(1, timer / 0.5);
  const pulse = 0.8 + Math.sin(time * 7.2) * 0.12;
  const snareRadius = radius * (1.72 + pulse * 0.08);

  addDisc(out, x, 0.112, z, snareRadius, snareRadius * 0.58, hex('#C7A5FF', 0.18 * fade), 28);
  addDisc(out, x, 0.12, z, snareRadius * 0.62, snareRadius * 0.36, hex('#071013', 0.54 * fade), 24);

  for (let index = 0; index < 6; index += 1) {
    const angle = time * 0.8 + index * ((Math.PI * 2) / 6);
    const gx = x + Math.cos(angle) * radius * 1.05;
    const gz = z + Math.sin(angle) * radius * 0.62;
    addGroundRect(out, gx, 0.19 + index * 0.002, gz, [Math.cos(angle), Math.sin(angle)], radius * 0.52, radius * 0.045, hex('#FFD36A', 0.18 * fade));
  }
}

function directionBasis(facing: Point) {
  const length = Math.hypot(facing.x, facing.y) || 1;
  const forward = [facing.x / length, facing.y / length] as [number, number];
  const side = [-forward[1], forward[0]] as [number, number];
  return { forward, side };
}

function drawMinion(out: number[], minion: Minion, time: number, simple = false) {
  const color = teamColor(minion.team);
  const x = worldX(minion.position.x);
  const z = worldZ(minion.position.y);
  const radius = minion.radius * WORLD_SCALE * 0.94;
  const bob = Math.sin(time * 12 + minion.position.x * 0.018) * 0.02;
  const attackFlash = Math.max(0, 1 - (time - minion.lastAttackTime) / 0.32);
  const walkAmount = minion.rootTimer > 0 ? 0.2 : attackFlash > 0 ? 0.48 : 1;

  const deathProgress = minion.dead ? Math.max(0, 1 - (time - minion.deathTime) / 0.3) : 1;
  addSelectionRing(out, x, z, radius * 1.42 * deathProgress, color.main, 0.35 * deathProgress);
  if (!minion.dead && minion.rootTimer > 0) {
    addRootSnare(out, x, z, radius, time, minion.rootTimer);
  }
  if (minion.dead) {
    addMinionDeathParticles(out, minion, radius, time, color);
    return;
  }

  if (simple) {
    addBox(out, x, 0.28 + bob, z, radius * 1.1, 0.46, radius * 0.78, minion.kind === 'spark' ? color.main : color.dark);
    addOctahedron(out, x, 0.62 + bob, z, radius * 0.2, color.soft);
    addBillboardBar(out, minion.position, 0.82, 0.34, minion.hp / minion.maxHp, color.main, {
      flash: Math.max(0, 1 - (time - minion.lastDamageTime) / 0.3),
    });
    return;
  }

  addLegPair(out, x, z, minion.facing, radius, color.dark, time * 15 + minion.position.x * 0.035, walkAmount, bob);
  if (minion.kind === 'guard') {
    const { forward, side } = directionBasis(minion.facing);
    const shieldX = x - side[0] * radius * 0.82 + forward[0] * radius * 0.18;
    const shieldZ = z - side[1] * radius * 0.82 + forward[1] * radius * 0.18;
    const weaponX = x + side[0] * radius * 0.58 + forward[0] * radius * (0.66 + attackFlash * 0.24);
    const weaponZ = z + side[1] * radius * 0.58 + forward[1] * radius * (0.66 + attackFlash * 0.24);

    addDisc(out, x, 0.22, z, radius * 1.05, radius * 0.58, [...color.main.slice(0, 3), 0.13] as Vec4, 20);
    addBox(out, x, 0.34 + bob, z, radius * 1.12, 0.44, radius * 0.84, color.dark);
    addBox(out, x + forward[0] * radius * 0.08, 0.68 + bob, z + forward[1] * radius * 0.08, radius * 0.82, 0.58, radius * 0.58, color.main);
    addOctahedron(out, x + forward[0] * radius * 0.08, 1.1 + bob, z + forward[1] * radius * 0.08, radius * 0.3, color.soft);
    addOctahedron(out, shieldX, 0.56 + bob, shieldZ, radius * 0.45, color.dark);
    addOctahedron(out, shieldX + forward[0] * radius * 0.08, 0.58 + bob, shieldZ + forward[1] * radius * 0.08, radius * 0.28, color.main);
    addBox(out, weaponX, 0.74 + bob, weaponZ, radius * 0.12, 1.08, radius * 0.1, color.soft);
    addOctahedron(out, weaponX + forward[0] * radius * 0.18, 1.28 + bob, weaponZ + forward[1] * radius * 0.18, radius * 0.18, attackFlash > 0 ? hex('#FFFFFF', 0.88) : color.soft);
    if (attackFlash > 0) {
      addGroundRect(
        out,
        x + forward[0] * radius * 1.48,
        0.24,
        z + forward[1] * radius * 1.48,
        forward,
        radius * (1.05 + attackFlash * 0.4),
        radius * 0.055,
        [...color.soft.slice(0, 3), 0.3 * attackFlash] as Vec4,
      );
    }
  } else if (minion.kind === 'spark') {
    const { forward, side } = directionBasis(minion.facing);
    const staffX = x - side[0] * radius * 0.78;
    const staffZ = z - side[1] * radius * 0.78;
    addDisc(out, x, 0.4 + bob, z, radius * 0.95, radius * 0.5, [...color.soft.slice(0, 3), 0.28] as Vec4, 18);
    addCone(out, x, 0.34 + bob, z, radius * 0.62, 0.48, 7, color.main);
    addOctahedron(out, x, 0.72 + bob, z, radius * 0.32, color.soft);
    addBox(out, staffX, 0.48 + bob, staffZ, radius * 0.1, 0.78, radius * 0.1, color.dark);
    addOctahedron(out, staffX, 0.94 + bob + attackFlash * 0.08, staffZ, radius * (0.18 + attackFlash * 0.08), attackFlash > 0 ? hex('#FFFFFF', 0.82) : color.soft);
    if (attackFlash > 0) {
      addGroundRect(
        out,
        x + forward[0] * radius * 1.08,
        0.26,
        z + forward[1] * radius * 1.08,
        forward,
        radius * (1.28 + attackFlash * 0.38),
        radius * 0.045,
        [...color.soft.slice(0, 3), 0.28 * attackFlash] as Vec4,
      );
      addDisc(out, x + forward[0] * radius * 1.42, 0.12, z + forward[1] * radius * 1.42, radius * 0.42, radius * 0.22, [...color.soft.slice(0, 3), 0.18 * attackFlash] as Vec4, 12);
    }
  } else {
    const { forward, side } = directionBasis(minion.facing);
    addBox(out, x, 0.28 + bob, z, radius * 1.0, 0.36, radius * 0.72, color.dark);
    addOctahedron(out, x, 0.58 + bob, z, radius * 0.24, color.soft);
    addBox(out, x + forward[0] * radius * 0.34, 0.4 + bob, z + forward[1] * radius * 0.34, radius * 0.72, 0.2, radius * 0.1, color.main);
    addBox(out, x + forward[0] * radius * 0.82, 0.42 + bob, z + forward[1] * radius * 0.82, radius * 0.48, 0.42, radius * 0.1, color.dark);
    addBox(out, x + forward[0] * radius * (1.36 + attackFlash * 0.3), 0.52 + bob, z + forward[1] * radius * (1.36 + attackFlash * 0.3), radius * 0.14, 0.62, radius * 0.1, attackFlash > 0 ? hex('#FFFFFF', 0.86) : color.soft);
    if (attackFlash > 0) {
      for (let index = -1; index <= 1; index += 1) {
        addGroundRect(
          out,
          x + forward[0] * radius * 1.58 + side[0] * radius * index * 0.26,
          0.22 + Math.abs(index) * 0.012,
          z + forward[1] * radius * 1.58 + side[1] * radius * index * 0.26,
          [forward[0] + side[0] * index * 0.2, forward[1] + side[1] * index * 0.2],
          radius * 0.68,
          radius * 0.045,
          [...color.soft.slice(0, 3), 0.24 * attackFlash] as Vec4,
        );
      }
    }
  }
  addBillboardBar(out, minion.position, 0.98, 0.42, minion.hp / minion.maxHp, color.main, {
    flash: Math.max(0, 1 - (time - minion.lastDamageTime) / 0.3),
  });
}

function drawProjectile(out: number[], projectile: Projectile, time: number, quality: GraphicsQuality) {
  const isPerformance = quality === 'performance';
  const color = projectile.team === 'blue' ? teamColor('blue') : teamColor('red');
  const masteryTier = projectile.masteryTier ?? 0;
  const masteryColor = masteryTier >= 2 ? hex('#FFD36A') : masteryTier >= 1 ? hex('#C7A5FF') : color.soft;
  const x = worldX(projectile.position.x);
  const z = worldZ(projectile.position.y);
  const speed = Math.hypot(projectile.velocity.x, projectile.velocity.y) || 1;
  const dir = [projectile.velocity.x / speed, projectile.velocity.y / speed] as [number, number];
  const pulse = 0.5 + Math.sin(time * 18 + projectile.position.x * 0.02) * 0.5;

  if (projectile.kind === 'bolt') {
    const side = [-dir[1], dir[0]] as [number, number];
    const pointCount = isPerformance ? 5 + masteryTier : 7 + masteryTier;
    const flightY = 0.78;
    const points = Array.from({ length: pointCount }, (_, index) => {
      const t = index / (pointCount - 1);
      const jitter = index === 0 || index === pointCount - 1
        ? 0
        : (index % 2 === 0 ? 1 : -1) * (0.11 + masteryTier * 0.02 + Math.abs(Math.sin(time * 18 + index)) * 0.04);
      return {
        x: x - dir[0] * t * (1.05 + masteryTier * 0.18) + side[0] * jitter,
        y: flightY + Math.sin(time * 14 + index * 1.3) * 0.05,
        z: z - dir[1] * t * (1.05 + masteryTier * 0.18) + side[1] * jitter,
      };
    });

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const length = Math.hypot(dx, dz) || 0.001;
      const segmentDir: [number, number] = [dx / length, dz / length];
      const segmentColor = index % 2 === 0 ? hex('#FFFFFF', 0.8) : masteryColor;
      addGroundRect(out, (start.x + end.x) * 0.5, (start.y + end.y) * 0.5, (start.z + end.z) * 0.5, segmentDir, length, 0.055 + masteryTier * 0.008, segmentColor);
      addGroundRect(out, (start.x + end.x) * 0.5, 0.34 + index * 0.006, (start.z + end.z) * 0.5, segmentDir, length * 0.78, 0.026, [...masteryColor.slice(0, 3), 0.18] as Vec4);
    }

    for (let branch = -1; branch <= 1; branch += 2) {
      const anchor = points[Math.max(1, Math.min(points.length - 2, 2 + branch))];
      const branchDir: [number, number] = [dir[0] + side[0] * branch * 0.72, dir[1] + side[1] * branch * 0.72];
      addGroundRect(out, anchor.x + side[0] * branch * 0.08, anchor.y + 0.03, anchor.z + side[1] * branch * 0.08, branchDir, 0.42 + masteryTier * 0.08, 0.038, hex('#E6FBFF', 0.42));
    }

    if (masteryTier >= 2) {
      addGroundRect(out, x - dir[0] * 0.08, 0.4, z - dir[1] * 0.08, [dir[0] - dir[1] * 0.32, dir[1] + dir[0] * 0.32], 0.58, 0.034, hex('#FFD36A', 0.34));
    }
    addDisc(out, x, 0.052, z, 0.48 + masteryTier * 0.1, 0.26 + masteryTier * 0.05, [...masteryColor.slice(0, 3), 0.16 + masteryTier * 0.04] as Vec4, 20);
    return;
  }

  if (projectile.kind === 'fireball') {
    addFireballProjectile(out, x, z, dir, masteryTier, pulse, time, isPerformance, projectile.position.x + projectile.position.y);
    return;
  }

  if (projectile.kind === 'tower') {
    const side = [-dir[1], dir[0]] as [number, number];
    const chainCount = isPerformance ? 3 : 5;
    const chainColors = projectile.team === 'blue'
      ? [hex('#9CEEFF', 0.5), hex('#C7A5FF', 0.42), hex('#7CFFB0', 0.34)]
      : [hex('#FFB096', 0.5), hex('#FFD36A', 0.42), hex('#FF70C8', 0.34)];

    for (let index = 1; index <= chainCount; index += 1) {
      const flicker = Math.sin(time * 27 + projectile.position.x * 0.03 + index * 1.7);
      const offset = flicker * 0.08 + (index % 2 === 0 ? 0.04 : -0.04);
      const segmentColor = chainColors[index % chainColors.length];
      addDisc(out, x - dir[0] * index * 0.14 + side[0] * offset, 0.3 + index * 0.022, z - dir[1] * index * 0.14 + side[1] * offset, 0.16 - index * 0.014, 0.08 - index * 0.007, segmentColor, 10);
      addGroundRect(out, x - dir[0] * index * 0.17 + side[0] * offset, 0.27 + index * 0.016, z - dir[1] * index * 0.17 + side[1] * offset, [dir[0] + side[0] * flicker * 0.4, dir[1] + side[1] * flicker * 0.4], 0.42 - index * 0.035, 0.028, segmentColor);
    }
    addGroundRect(out, x - dir[0] * 0.1, 0.37, z - dir[1] * 0.1, dir, 0.62, 0.026, hex('#FFFFFF', 0.34));
    addOctahedron(out, x, 0.54 + pulse * 0.05, z, 0.17, projectile.team === 'blue' ? hex('#D8FBFF') : hex('#FFE2B8'));
    addOctahedron(out, x, 0.55, z, 0.075, hex('#FFFFFF', 0.86));
    addDisc(out, x, 0.045, z, 0.54, 0.3, [...color.main.slice(0, 3), 0.18] as Vec4, 16);
    return;
  }

  if (projectile.kind === 'chain') {
    for (let index = 1; index <= (isPerformance ? 2 : 4); index += 1) {
      const offset = Math.sin(time * 18 + index) * 0.04;
      addGroundRect(out, x - dir[0] * index * 0.16 - dir[1] * offset, 0.24 + index * 0.018, z - dir[1] * index * 0.16 + dir[0] * offset, dir, 0.18, 0.026, hex('#9CEEFF', 0.28 / index));
    }
    addOctahedron(out, x, 0.42 + pulse * 0.08, z, 0.12, hex('#D8FBFF'));
    return;
  }

  const radius = projectile.kind === 'spark' ? 0.1 : 0.075;
  for (let index = 1; index <= (isPerformance ? 2 : 3); index += 1) {
    addDisc(out, x - dir[0] * index * 0.12, 0.22 + index * 0.012, z - dir[1] * index * 0.12, radius * (1.2 - index * 0.18), radius * (0.62 - index * 0.1), [...color.soft.slice(0, 3), 0.16 / index] as Vec4, 8);
  }
  if (projectile.kind === 'spark') {
    const arcCount = isPerformance ? 2 : 3;
    for (let index = 0; index < arcCount; index += 1) {
      const flicker = Math.sin(time * 22 + projectile.position.x * 0.04 + index * 1.9);
      const sideOffset = (index - (arcCount - 1) / 2) * 0.08 + flicker * 0.025;
      addGroundRect(
        out,
        x - dir[0] * 0.06 - dir[1] * sideOffset,
        0.32 + index * 0.035,
        z - dir[1] * 0.06 + dir[0] * sideOffset,
        [dir[0] - dir[1] * flicker * 0.55, dir[1] + dir[0] * flicker * 0.55],
        0.22 + Math.abs(flicker) * 0.06,
        0.022,
        hex('#D8FBFF', 0.22 + Math.abs(flicker) * 0.16),
      );
    }
  }
  addDisc(out, x - dir[0] * 0.1, 0.24, z - dir[1] * 0.1, radius * 1.6, radius * 0.8, [...color.glow.slice(0, 3), 0.18] as Vec4, 10);
  addOctahedron(out, x, projectile.kind === 'spark' ? 0.36 : 0.3, z, radius, projectile.kind === 'spark' ? color.soft : color.main);
}

function addFireballCastFlare(
  out: number[],
  x: number,
  z: number,
  forward: [number, number],
  side: [number, number],
  radius: number,
  flash: number,
  time: number,
) {
  addDisc(out, x - forward[0] * radius * 0.12, 0.105, z - forward[1] * radius * 0.12, radius * 1.12, radius * 0.62, hex('#30170D', 0.2 * flash), 22);
  addDisc(out, x + forward[0] * radius * 0.18, 0.14, z + forward[1] * radius * 0.18, radius * 0.88, radius * 0.48, hex('#FF5533', 0.28 * flash), 20);

  for (let index = 0; index < 4; index += 1) {
    const drift = (index - 1.5) * radius * 0.16 + Math.sin(time * 4.6 + index) * radius * 0.06;
    const distance = radius * (0.34 + index * 0.26);
    addCone(
      out,
      x - forward[0] * distance + side[0] * drift,
      0.42 + index * 0.035,
      z - forward[1] * distance + side[1] * drift,
      radius * (0.22 - index * 0.026),
      radius * (0.56 - index * 0.055),
      7,
      hex(index % 2 === 0 ? '#3A241B' : '#543322', 0.18 * flash / (index + 1)),
    );
  }

  const coreY = 0.64 + Math.sin(time * 13) * 0.035;
  addFlameTongue(out, x, coreY, z, forward, side, radius * 0.78, radius * 1.32, radius * 0.5, hex('#D94A22', 0.8 * flash));
  addFlameTongue(out, x + side[0] * radius * 0.22, coreY + radius * 0.06, z + side[1] * radius * 0.22, forward, side, radius * 0.52, radius * 1.04, radius * 0.62, hex('#FFB15F', 0.86 * flash));
  addFlameTongue(out, x - side[0] * radius * 0.18, coreY + radius * 0.08, z - side[1] * radius * 0.18, forward, side, radius * 0.34, radius * 0.76, radius * 0.76, hex('#FFF7D6', 0.78 * flash));

  for (let index = 0; index < 6; index += 1) {
    const angle = time * 6.4 + index * ((Math.PI * 2) / 6);
    const travel = radius * (0.44 + (index % 3) * 0.14);
    addOctahedron(
      out,
      x + Math.cos(angle) * travel,
      0.46 + Math.sin(time * 5.8 + index) * 0.055,
      z + Math.sin(angle) * travel * 0.58,
      radius * 0.055,
      hex(index % 2 === 0 ? '#FFB15F' : '#FFD36A', 0.56 * flash),
    );
  }
}

function addFireballProjectile(
  out: number[],
  x: number,
  z: number,
  dir: [number, number],
  masteryTier: number,
  pulse: number,
  time: number,
  isPerformance: boolean,
  seed: number,
) {
  const side = [-dir[1], dir[0]] as [number, number];
  const fireColor = masteryTier >= 2 ? '#FFD36A' : masteryTier >= 1 ? '#FFB12E' : '#FF7A1A';
  const midColor = masteryTier >= 1 ? '#EF5A18' : '#D94A22';
  const emberColor = masteryTier >= 1 ? '#FFD36A' : '#FFB15F';
  const flightY = 0.9 + pulse * 0.045;
  const bodyScale = 1 + masteryTier * 0.09;
  const bodyRadius = 0.29 * bodyScale;

  addDisc(out, x, 0.07, z, bodyRadius * 1.5, bodyRadius * 0.84, hex(midColor, 0.16 + masteryTier * 0.035), 24);
  addSphere(out, x, flightY, z, bodyRadius, isPerformance ? 5 : 7, isPerformance ? 9 : 13, hex(midColor, 0.94));
  addSphere(out, x + dir[0] * bodyRadius * 0.24, flightY + bodyRadius * 0.04, z + dir[1] * bodyRadius * 0.24, bodyRadius * 0.66, isPerformance ? 4 : 5, isPerformance ? 8 : 10, hex(fireColor, 0.92));
  addSphere(out, x + dir[0] * bodyRadius * 0.38 - side[0] * bodyRadius * 0.16, flightY + bodyRadius * 0.16, z + dir[1] * bodyRadius * 0.38 - side[1] * bodyRadius * 0.16, bodyRadius * 0.28, 4, 8, hex('#FFF7D6', 0.86));

  const spikeCount = (isPerformance ? 8 : 12) + masteryTier * 2;
  for (let index = 0; index < spikeCount; index += 1) {
    const angle = index * ((Math.PI * 2) / spikeCount) + time * 1.2 + seed * 0.004;
    const spikeDir: [number, number] = [Math.cos(angle), Math.sin(angle)];
    const spikeLength = bodyRadius * (0.74 + (index % 3) * 0.13);
    const sx = x + spikeDir[0] * bodyRadius * 0.72;
    const sz = z + spikeDir[1] * bodyRadius * 0.42;
    const sy = flightY + Math.sin(angle + time * 2) * bodyRadius * 0.28;
    addCone(
      out,
      sx + spikeDir[0] * spikeLength * 0.28,
      sy,
      sz + spikeDir[1] * spikeLength * 0.16,
      bodyRadius * (0.12 + (index % 2) * 0.025),
      spikeLength,
      7,
      hex(index % 3 === 0 ? '#D94A22' : index % 2 === 0 ? fireColor : '#FFD36A', 0.78),
    );
  }

  const emberCount = (isPerformance ? 4 : 7) + masteryTier;
  for (let index = 1; index <= emberCount; index += 1) {
    const flicker = Math.sin(time * 16 + index * 1.9 + seed * 0.02) * 0.13;
    const trail = index * (0.16 + masteryTier * 0.01);
    addOctahedron(
      out,
      x - dir[0] * trail + side[0] * flicker,
      flightY - 0.22 + index * 0.018 + Math.cos(time * 9 + index) * 0.02,
      z - dir[1] * trail + side[1] * flicker,
      Math.max(0.035, 0.13 - index * 0.01),
      hex(index % 2 === 0 ? emberColor : fireColor, 0.48 / Math.sqrt(index)),
    );
  }
}

function addFireballImpact(
  out: number[],
  x: number,
  z: number,
  radius: number,
  progress: number,
  age: number,
  time: number,
  isPerformance: boolean,
  effectColorValue: string,
) {
  const outerColor = effectColorValue.startsWith('#') ? effectColorValue : '#FFB15F';
  const shock = radius * (0.86 + age * 0.42);

  addDisc(out, x, 0.074, z, shock, shock * 0.58, hex('#30170D', 0.2 * progress), 30);
  addDisc(out, x, 0.1, z, radius * (0.58 + age * 0.34), radius * (0.34 + age * 0.18), hex('#FF5533', 0.26 * progress), 26);
  addDisc(out, x, 0.13, z, radius * (0.3 + age * 0.2), radius * (0.18 + age * 0.12), hex(outerColor, 0.28 * progress), 20);

  const tongueCount = isPerformance ? 4 : 7;
  for (let index = 0; index < tongueCount; index += 1) {
    const angle = index * ((Math.PI * 2) / tongueCount) + time * 2.6;
    const forward = [Math.cos(angle), Math.sin(angle)] as [number, number];
    const side = [-forward[1], forward[0]] as [number, number];
    const distance = radius * (0.16 + age * 0.28);
    addFlameTongue(
      out,
      x + forward[0] * distance,
      0.46 + Math.sin(time * 5 + index) * 0.04,
      z + forward[1] * distance * 0.58,
      forward,
      side,
      radius * (0.18 + (index % 3) * 0.035),
      radius * (0.52 + age * 0.24),
      radius * 0.22,
      hex(index % 3 === 0 ? '#D94A22' : index % 2 === 0 ? outerColor : '#FFD36A', (0.66 - index * 0.018) * progress),
    );
  }

  for (let index = 0; index < (isPerformance ? 4 : 8); index += 1) {
    const angle = time * 4.0 + index * ((Math.PI * 2) / 8);
    const travel = radius * (0.24 + age * (0.46 + (index % 2) * 0.1));
    addOctahedron(
      out,
      x + Math.cos(angle) * travel,
      0.36 + Math.sin(time * 5 + index) * 0.06,
      z + Math.sin(angle) * travel * 0.58,
      radius * 0.05,
      hex(index % 3 === 0 ? '#3A241B' : '#FFB15F', (index % 3 === 0 ? 0.24 : 0.58) * progress),
    );
  }
}

function addFlameTongue(
  out: number[],
  x: number,
  y: number,
  z: number,
  forward: [number, number],
  side: [number, number],
  width: number,
  height: number,
  lean: number,
  color: Vec4,
) {
  const baseX = x - forward[0] * lean * 0.28;
  const baseZ = z - forward[1] * lean * 0.28;
  const tipX = x + forward[0] * lean;
  const tipZ = z + forward[1] * lean;
  const bottomY = y - height * 0.42;
  const topY = y + height * 0.58;
  const halfWidth = width / 2;

  addTriAuto(
    out,
    [tipX, topY, tipZ],
    [baseX + side[0] * halfWidth, bottomY, baseZ + side[1] * halfWidth],
    [baseX - side[0] * halfWidth, bottomY, baseZ - side[1] * halfWidth],
    color,
  );
  addTriAuto(
    out,
    [tipX + side[0] * halfWidth * 0.12, topY + height * 0.08, tipZ + side[1] * halfWidth * 0.12],
    [baseX - forward[0] * halfWidth * 0.45, bottomY + height * 0.12, baseZ - forward[1] * halfWidth * 0.45],
    [baseX + forward[0] * halfWidth * 0.45, bottomY + height * 0.12, baseZ + forward[1] * halfWidth * 0.45],
    color,
  );
}

function drawChainArc(out: number[], arc: ChainArc, time: number, quality: GraphicsQuality) {
  const isPerformance = quality === 'performance';
  const progress = Math.max(0, Math.min(1, arc.ttl / arc.maxTtl));
  const startX = worldX(arc.start.x);
  const startZ = worldZ(arc.start.y);
  const endX = worldX(arc.end.x);
  const endZ = worldZ(arc.end.y);
  const dx = endX - startX;
  const dz = endZ - startZ;
  const length = Math.hypot(dx, dz);
  if (length < 0.06) return;

  const direction: [number, number] = [dx / length, dz / length];
  const normal: [number, number] = [-direction[1], direction[0]];
  const color = arc.color.startsWith('#') ? hex(arc.color) : teamColor(arc.team).soft;
  const segmentCount = isPerformance ? 5 : 8;
  let previousX = startX;
  let previousZ = startZ;

  addDisc(out, startX, 0.14, startZ, 0.24, 0.13, [...color.slice(0, 3), 0.16 * progress] as Vec4, 12);
  addDisc(out, endX, 0.15, endZ, 0.32, 0.18, [...color.slice(0, 3), 0.22 * progress] as Vec4, 14);

  for (let index = 1; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    const taper = 1 - Math.abs(t - 0.5) * 0.58;
    const jitter = Math.sin(time * 30 + index * 2.3 + arc.start.x * 0.013 + arc.end.y * 0.009) * 0.08 * taper;
    const nextX = startX + dx * t + normal[0] * jitter;
    const nextZ = startZ + dz * t + normal[1] * jitter;
    const midX = (previousX + nextX) * 0.5;
    const midZ = (previousZ + nextZ) * 0.5;
    const segDx = nextX - previousX;
    const segDz = nextZ - previousZ;
    const segLength = Math.hypot(segDx, segDz);
    const segDir: [number, number] = segLength > 0.001 ? [segDx / segLength, segDz / segLength] : direction;
    const alpha = (0.34 + taper * 0.26) * progress;

    addGroundRect(out, midX, 0.43 + index * 0.012, midZ, segDir, segLength, 0.042 + taper * 0.018, [...color.slice(0, 3), alpha] as Vec4);
    addGroundRect(out, midX, 0.46 + index * 0.01, midZ, segDir, segLength * 0.72, 0.018, hex('#FFFFFF', 0.18 * progress));

    if (!isPerformance || index % 2 === 0) {
      addOctahedron(out, nextX, 0.58 + taper * 0.2, nextZ, 0.04 + taper * 0.02, [...color.slice(0, 3), 0.74 * progress] as Vec4);
    }

    previousX = nextX;
    previousZ = nextZ;
  }
}

function drawEffect(out: number[], effect: Effect, time: number, quality: GraphicsQuality) {
  const isPerformance = quality === 'performance';
  const progress = Math.max(0, effect.ttl / effect.maxTtl);
  const age = 1 - progress;
  const color = effectColor(effect);
  const x = worldX(effect.position.x);
  const z = worldZ(effect.position.y);
  const radius = effect.radius * WORLD_SCALE;

  if (effect.kind === 'bolt') {
    addDisc(out, x, 0.08, z, radius * (0.74 + age * 0.18), radius * (0.42 + age * 0.1), hex('#9CEEFF', 0.13 * progress), 22);
    for (let index = isPerformance ? -2 : -3; index <= (isPerformance ? 2 : 3); index += 1) {
      const angle = -Math.PI / 2 + index * 0.34 + Math.sin(time * 18 + index) * 0.1;
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      const length = radius * (0.5 + Math.abs(index) * 0.08);
      const midX = x + dx * length * 0.5;
      const midZ = z + dz * length * 0.32;
      addGroundRect(out, midX, 0.5 + Math.abs(index) * 0.035, midZ, [dx, dz], length, 0.035, hex(index === 0 ? '#FFFFFF' : '#9CEEFF', 0.34 * progress));
      if (index !== 0) {
        addGroundRect(out, midX + dz * radius * 0.08, 0.56 + Math.abs(index) * 0.025, midZ - dx * radius * 0.08, [dx - dz * 0.42, dz + dx * 0.42], length * 0.42, 0.026, hex('#E6FBFF', 0.22 * progress));
      }
    }
    return;
  }

  if (effect.kind === 'fireball') {
    addFireballImpact(out, x, z, radius, progress, age, time, isPerformance, effect.color);
    return;
  }

  if (effect.kind === 'chain') {
    addDisc(out, x, 0.07, z, radius * (0.76 + age * 0.2), radius * (0.44 + age * 0.1), hex('#9CEEFF', 0.12 * progress), 24);
    addOctahedron(out, x, 0.66, z, radius * 0.1, hex('#FFFFFF', 0.72 * progress));
    for (let branch = isPerformance ? 0 : -1; branch <= (isPerformance ? 2 : 1); branch += 1) {
      const branchOffset = branch - (isPerformance ? 1 : 0);
      let prevX = x;
      let prevZ = z;
      for (let index = 1; index <= 3; index += 1) {
        const nextX = x + radius * index * 0.24;
        const nextZ = z + branchOffset * radius * 0.16 + (index % 2 === 0 ? -1 : 1) * radius * 0.09;
        const dx = nextX - prevX;
        const dz = nextZ - prevZ;
        const length = Math.hypot(dx, dz);
        const dir: [number, number] = length > 0.001 ? [dx / length, dz / length] : [1, 0];
        addGroundRect(out, (prevX + nextX) * 0.5, 0.42 + index * 0.04, (prevZ + nextZ) * 0.5, dir, length, 0.034, hex(branchOffset === 0 ? '#FFFFFF' : '#9CEEFF', 0.28 * progress));
        prevX = nextX;
        prevZ = nextZ;
      }
    }
    return;
  }

  if (effect.kind === 'pulse') {
    addDisc(out, x, 0.062, z, radius * (1.1 - progress * 0.1), radius * (0.62 - progress * 0.06), [...color.slice(0, 3), 0.18 * progress] as Vec4, 28);
    addDisc(out, x, 0.12, z, radius * (0.62 + progress * 0.18), radius * (0.34 + progress * 0.1), hex('#D7FFE4', 0.12 * progress), 22);
    for (let index = 0; index < (isPerformance ? 4 : 7); index += 1) {
      const angle = time * 2.3 + index * ((Math.PI * 2) / 7);
      const ring = radius * (0.42 + (1 - progress) * 0.42);
      addOctahedron(out, x + Math.cos(angle) * ring, 0.22 + Math.sin(time * 4 + index) * 0.04, z + Math.sin(angle) * ring * 0.62, 0.045, hex('#8DFFB7', 0.72 * progress));
    }
    return;
  }

  if (effect.kind === 'dash') {
    const slashColor = effect.color.startsWith('#') ? hex(effect.color, 0.42 * progress) : color;
    addDisc(out, x, 0.055, z, radius * (0.9 + (1 - progress) * 0.35), radius * 0.28, slashColor, 20);
    for (let index = isPerformance ? -1 : -2; index <= (isPerformance ? 1 : 2); index += 1) {
      addGroundRect(out, x + index * 0.18, 0.14 + Math.abs(index) * 0.004, z + index * 0.06, [0.96, 0.28], radius * 0.28, 0.035, hex('#E6FBFF', 0.18 * progress));
    }
    return;
  }

  if (effect.kind === 'shield') {
    addDisc(out, x, 0.058, z, radius * (1.0 + age * 0.18), radius * (0.58 + age * 0.08), hex('#88EEFF', 0.2 * progress), 32);
    for (let index = 0; index < (isPerformance ? 4 : 8); index += 1) {
      const angle = time * 1.8 + index * ((Math.PI * 2) / 8);
      addOctahedron(out, x + Math.cos(angle) * radius * 0.88, 0.34 + Math.sin(time * 3 + index) * 0.08, z + Math.sin(angle) * radius * 0.5, 0.055, hex('#D8FBFF', 0.72 * progress));
    }
    addBox(out, x, 0.78, z, radius * 0.08, 1.18 * progress, radius * 0.08, hex('#B8F7FF', 0.18 * progress));
    return;
  }

  if (effect.kind === 'trap') {
    addDisc(out, x, 0.07, z, radius * (0.8 + age * 0.45), radius * (0.46 + age * 0.22), [...color.slice(0, 3), 0.22 * progress] as Vec4, 26);
    for (let index = 0; index < (isPerformance ? 4 : 6); index += 1) {
      const angle = index * ((Math.PI * 2) / 6) - time * 1.3;
      addGroundRect(out, x + Math.cos(angle) * radius * 0.38, 0.18, z + Math.sin(angle) * radius * 0.22, [Math.cos(angle + Math.PI / 2), Math.sin(angle + Math.PI / 2)], radius * 0.36, 0.035, [...color.slice(0, 3), 0.34 * progress] as Vec4);
    }
    return;
  }

  if (effect.kind === 'ult') {
    addDisc(out, x, 0.06, z, radius * (0.86 + age * 0.56), radius * (0.5 + age * 0.32), hex('#8B5CF6', 0.22 * progress), 42);
    addDisc(out, x, 0.13, z, radius * (0.46 + age * 0.26), radius * (0.26 + age * 0.16), hex('#E9D5FF', 0.16 * progress), 32);
    for (let index = 0; index < (isPerformance ? 6 : 10); index += 1) {
      const angle = time * 3.0 + index * ((Math.PI * 2) / 10);
      const boltRadius = radius * (0.32 + (index % 3) * 0.12);
      const bx = x + Math.cos(angle) * boltRadius;
      const bz = z + Math.sin(angle) * boltRadius * 0.58;
      addBox(out, bx, 0.72 + (index % 2) * 0.14, bz, 0.035, 1.2 * progress, 0.035, hex(index % 2 === 0 ? '#C7A5FF' : '#7CFFB0', 0.44 * progress));
      addOctahedron(out, bx, 1.38 * progress + 0.2, bz, 0.08, hex('#FFFFFF', 0.62 * progress));
    }
    return;
  }

  if (effect.kind === 'level' || effect.kind === 'spawn') {
    addDisc(out, x, 0.052, z, radius * (0.95 - progress * 0.18), radius * 0.52, [...color.slice(0, 3), 0.2 * progress] as Vec4, 24);
    addOctahedron(out, x, 0.62 + (1 - progress) * 0.35, z, 0.14, [...color.slice(0, 3), 0.72 * progress] as Vec4);
    return;
  }

  if (effect.kind === 'hit') {
    addDisc(out, x, 0.054, z, radius * (0.72 + age * 0.48), radius * (0.4 + age * 0.22), [...color.slice(0, 3), 0.24 * progress] as Vec4, 22);
    addDisc(out, x, 0.062, z, radius * (0.34 + age * 0.24), radius * (0.18 + age * 0.12), hex('#FFFFFF', 0.12 * progress), 16);
    for (let index = 0; index < (isPerformance ? 5 : 8); index += 1) {
      const angle = effect.position.x * 0.017 + effect.position.y * 0.011 + index * ((Math.PI * 2) / 8);
      const travel = radius * (0.16 + age * (0.48 + (index % 3) * 0.08));
      const px = x + Math.cos(angle) * travel;
      const pz = z + Math.sin(angle) * travel * 0.66;
      addOctahedron(out, px, 0.24 + age * 0.48 + (index % 2) * 0.08, pz, 0.035 + (index % 3) * 0.012, [...color.slice(0, 3), 0.66 * progress] as Vec4);
      addGroundRect(out, px, 0.13, pz, [Math.cos(angle), Math.sin(angle)], radius * 0.18, 0.032, [...color.slice(0, 3), 0.2 * progress] as Vec4);
    }
    if (!isPerformance) {
      for (let index = 0; index < 5; index += 1) {
        const seed = effect.position.x * 0.031 + effect.position.y * 0.019 + index * 1.47;
        const angle = seed + index * ((Math.PI * 2) / 5);
        const outward = radius * (0.12 + age * (0.42 + index * 0.035));
        const debrisX = x + Math.cos(angle) * outward;
        const debrisZ = z + Math.sin(angle) * outward * 0.62;
        const height = 0.16 + age * (0.92 + index * 0.08) - age * age * 0.42;
        const debrisColor = index % 2 === 0 ? hex('#D0C492', 0.42 * progress) : [...color.slice(0, 3), 0.5 * progress] as Vec4;
        addOctahedron(out, debrisX, height, debrisZ, 0.03 + index * 0.004, debrisColor);
      }
    }
    return;
  }

  addDisc(out, x, 0.052, z, radius * (0.86 - progress * 0.18), radius * (0.48 - progress * 0.08), [...color.slice(0, 3), 0.2 * progress] as Vec4, 20);
  for (let index = 0; index < 5; index += 1) {
    const angle = -Math.PI / 2 + index * 0.55;
    addGroundRect(out, x + Math.cos(angle) * radius * 0.35, 0.15, z + Math.sin(angle) * radius * 0.22, [Math.cos(angle), Math.sin(angle)], radius * 0.22, 0.035, [...color.slice(0, 3), 0.28 * progress] as Vec4);
  }
}

function drawTrap(out: number[], trap: Trap, time: number) {
  const color = teamColor(trap.team);
  const x = worldX(trap.position.x);
  const z = worldZ(trap.position.y);
  const pulse = 0.5 + Math.sin(time * 4 + trap.position.x * 0.01) * 0.5;
  const radius = trap.radius * WORLD_SCALE;
  addDisc(out, x, 0.058, z, radius * (1 + pulse * 0.08), radius * 0.58, [...color.main.slice(0, 3), 0.18] as Vec4, 24);
  addDisc(out, x, 0.064, z, radius * 0.62, radius * 0.34, hex('#071013', 0.62), 24);
  for (let index = 0; index < 6; index += 1) {
    const angle = index * ((Math.PI * 2) / 6) + time * 0.4;
    addOctahedron(out, x + Math.cos(angle) * radius * 0.74, 0.16 + pulse * 0.035, z + Math.sin(angle) * radius * 0.42, 0.04, color.soft);
  }
}

function drawPowerUp(out: number[], powerUp: PowerUp, time: number) {
  const team = teamColor(powerUp.team);
  const x = worldX(powerUp.position.x);
  const z = worldZ(powerUp.position.y);
  const radius = powerUp.radius * WORLD_SCALE;
  const pulse = 0.72 + Math.sin(time * (powerUp.kind === 'speed' ? 7.2 : 4.2) + powerUp.position.x * 0.01) * 0.14;
  const color = powerUp.kind === 'shield' ? hex('#88EEFF') : hex('#FFD36A');

  addDisc(out, x, 0.07, z, radius * (1.65 + pulse * 0.16), radius * (0.92 + pulse * 0.08), [...color.slice(0, 3), 0.16] as Vec4, 28);
  addDisc(out, x, 0.078, z, radius * 1.08, radius * 0.62, hex('#071013', 0.48), 24);
  addDisc(out, x, 0.092, z, radius * 1.25, radius * 0.7, [...team.soft.slice(0, 3), 0.16] as Vec4, 28);

  if (powerUp.kind === 'shield') {
    addCylinder(out, x, 0.5 + pulse * 0.06, z, radius * 0.58, 0.76, 18, hex('#88EEFF', 0.16));
    addOctahedron(out, x, 0.54 + pulse * 0.08, z, radius * 0.38, hex('#D8FBFF', 0.88));
    addOctahedron(out, x, 0.58 + pulse * 0.08, z, radius * 0.16, hex('#FFFFFF', 0.86));
  } else {
    const bolt = [
      { x: x + radius * 0.12, y: 0.98, z: z },
      { x: x - radius * 0.4, y: 0.56, z: z + radius * 0.1 },
      { x: x - radius * 0.02, y: 0.56, z: z },
      { x: x - radius * 0.32, y: 0.18, z: z - radius * 0.1 },
      { x: x + radius * 0.46, y: 0.68, z: z },
      { x: x + radius * 0.08, y: 0.66, z: z + radius * 0.08 },
    ];
    for (let index = 0; index < bolt.length - 1; index += 1) {
      const start = bolt[index];
      const end = bolt[index + 1];
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const length = Math.hypot(dx, dz) || 0.001;
      addGroundRect(out, (start.x + end.x) * 0.5, (start.y + end.y) * 0.5, (start.z + end.z) * 0.5, [dx / length, dz / length], length, radius * 0.08, hex('#FFD36A', 0.78));
      addOctahedron(out, end.x, end.y, end.z, radius * 0.08, hex('#FFF7D6', 0.82));
    }
  }
}

function addCameraLight(out: number[], camera: CameraState) {
  addDisc(out, worldX(camera.center.x + 120), 0.02, worldZ(camera.center.y), 3.9, 2.22, hex('#A9F4FF', 0.075), 28);
  addDisc(out, worldX(camera.center.x - 140), 0.021, worldZ(camera.center.y + 120), 3.2, 1.75, hex('#A77DFF', 0.05), 24);
  addDisc(out, worldX(camera.center.x + 20), 0.022, worldZ(camera.center.y - 180), 2.62, 1.34, hex('#FFD36A', 0.042), 22);
}

function addMagicalSkyWash(out: number[], camera: CameraState, time: number, quality: GraphicsQuality, level: number) {
  const isPerformance = quality === 'performance';
  const tierColors = levelAtmosphereColors(level);
  const washes = [
    { dx: -340, dy: -230, rx: 2.75, rz: 1.18, color: tierColors.primary, alpha: 0.032, speed: 0.34 },
    { dx: 280, dy: -150, rx: 3.15, rz: 1.28, color: tierColors.secondary, alpha: 0.029, speed: 0.28 },
    { dx: -180, dy: 230, rx: 3.35, rz: 1.38, color: tierColors.accent, alpha: 0.03, speed: 0.31 },
    { dx: 420, dy: 250, rx: 2.55, rz: 1.04, color: tierColors.warm, alpha: 0.024, speed: 0.24 },
  ];

  for (let index = 0; index < (isPerformance ? 2 : washes.length); index += 1) {
    const wash = washes[index];
    const driftX = Math.sin(time * wash.speed + index * 1.7) * 36;
    const driftY = Math.cos(time * (wash.speed + 0.07) + index * 2.1) * 28;
    const mapX = Math.max(80, Math.min(MAP_WIDTH - 80, camera.center.x + wash.dx + driftX));
    const mapY = Math.max(80, Math.min(MAP_HEIGHT - 80, camera.center.y + wash.dy + driftY));
    const pulse = 0.74 + Math.sin(time * (0.9 + index * 0.13) + index) * 0.16;
    const x = worldX(mapX);
    const z = worldZ(mapY);

    addDisc(out, x, 0.028 + index * 0.002, z, wash.rx * pulse, wash.rz * pulse, hex(wash.color, wash.alpha), isPerformance ? 18 : 28);
    addGroundRect(out, x, 0.17 + index * 0.01, z, [0.94, index % 2 === 0 ? 0.32 : -0.26], wash.rx * 1.42, 0.032, hex('#EAF8F5', wash.alpha * 0.5));
  }
}

function levelAtmosphereColors(level: number) {
  if (level >= 91) {
    return { primary: '#FF70C8', secondary: '#FFD36A', accent: '#C7A5FF', warm: '#FF5533' };
  }
  if (level >= 71) {
    return { primary: '#C7A5FF', secondary: '#8EF7FF', accent: '#FFD36A', warm: '#FFB096' };
  }
  if (level >= 51) {
    return { primary: '#FFD36A', secondary: '#7CFFB0', accent: '#8EF7FF', warm: '#FFB096' };
  }
  if (level >= 31) {
    return { primary: '#8EF7FF', secondary: '#C7A5FF', accent: '#7CFFB0', warm: '#FFD36A' };
  }
  if (level >= 11) {
    return { primary: '#7CFFB0', secondary: '#8EF7FF', accent: '#FFD36A', warm: '#C7A5FF' };
  }
  return { primary: '#8EF7FF', secondary: '#7CFFB0', accent: '#C7A5FF', warm: '#FFD36A' };
}

function addMagicMotes(out: number[], camera: CameraState, time: number, quality: GraphicsQuality) {
  const moteCount = quality === 'performance' ? 16 : 40;
  const rangeX = quality === 'performance' ? 500 : 620;
  const rangeY = quality === 'performance' ? 400 : 500;

  for (let index = 0; index < moteCount; index += 1) {
    const x = camera.center.x + seededBetween(index * 71 + 3, -rangeX, rangeX);
    const y = camera.center.y + seededBetween(index * 83 + 5, -rangeY, rangeY);
    if (x < 80 || x > MAP_WIDTH - 80 || y < 80 || y > MAP_HEIGHT - 80) continue;

    const bob = Math.sin(time * (1.1 + index * 0.017) + index * 1.7) * 0.075;
    const color = index % 4 === 0 ? hex('#8EF7FF', 0.58) : index % 4 === 1 ? hex('#8DFFB0', 0.5) : index % 4 === 2 ? hex('#C2A5FF', 0.46) : hex('#FFD36A', 0.45);
    addOctahedron(out, worldX(x), 0.22 + bob, worldZ(y), 0.02 + (index % 4) * 0.01, color);
  }
}

function addLaneTorches(out: number[], time: number, bounds: RenderBounds) {
  for (let laneIndex = 0; laneIndex < LANES.length; laneIndex += 1) {
    const lane = LANES[laneIndex];
    for (let index = 0; index < 8; index += 1) {
      const t = (index + 0.55) / 8;
      const mapX = LANE_START_X + (LANE_END_X - LANE_START_X) * t;
      const mapY = getLaneYAtX(lane, mapX);
      if (!isInRenderBounds({ x: mapX, y: mapY }, bounds, 190)) continue;

      const basis = laneBasis(lane, mapX);
      const sideSign = (index + laneIndex) % 2 === 0 ? 1 : -1;
      const wx = worldX(mapX) + basis.normal[0] * 1.18 * sideSign;
      const wz = worldZ(mapY) + basis.normal[1] * 1.18 * sideSign;
      const flicker = 0.9 + Math.sin(time * 1.6 + index * 1.7 + laneIndex * 0.9) * 0.045;
      const flameColor = laneIndex === 1 ? '#C7A5FF' : index % 3 === 0 ? '#7CFFB0' : '#FFD36A';

      addCylinder(out, wx, 0.22, wz, 0.035, 0.44, 6, hex('#252D28', 0.84));
      addOctahedron(out, wx, 0.54 + flicker * 0.018, wz, 0.078 + flicker * 0.008, hex(flameColor, 0.78));
      addDisc(out, wx, 0.06, wz, 0.4 + flicker * 0.025, 0.23 + flicker * 0.014, hex(flameColor, 0.092), 14);
    }
  }
}

function addWaterShimmer(out: number[], time: number, bounds: RenderBounds) {
  for (let index = 0; index < MYSTICAL_POOLS.length; index += 1) {
    const pool = MYSTICAL_POOLS[index];
    if (!isInRenderBounds(pool, bounds, 220) || !isClearOfLane(pool.x, pool.y, 96)) continue;

    const x = worldX(pool.x);
    const z = worldZ(pool.y);
    const shimmer = 0.55 + Math.sin(time * 2.4 + index * 1.3) * 0.45;
    addDisc(out, x, 0.072, z, 0.74 + shimmer * 0.12, 0.38 + shimmer * 0.05, hex('#A9F4FF', 0.06 + shimmer * 0.04), 24);

    for (let ripple = 0; ripple < 3; ripple += 1) {
      const phase = time * 0.7 + ripple * 1.1 + index;
      const rx = Math.cos(phase) * (0.16 + ripple * 0.12);
      const rz = Math.sin(phase * 1.2) * (0.08 + ripple * 0.06);
      addGroundRect(out, x + rx, 0.086 + ripple * 0.004, z + rz, [0.92, 0.34], 0.34 - ripple * 0.04, 0.028, hex('#D8FBFF', 0.085));
    }
  }
}

function addForestWind(out: number[], time: number, bounds: RenderBounds) {
  for (let clusterIndex = 0; clusterIndex < FOREST_CLUSTERS.length; clusterIndex += 1) {
    const cluster = FOREST_CLUSTERS[clusterIndex];
    const padding = Math.max(cluster.rx, cluster.rz) + 220;
    if (!isInRenderBounds({ x: cluster.x, y: cluster.y }, bounds, padding)) continue;

    const phase = time * (0.42 + (clusterIndex % 5) * 0.035) + clusterIndex * 1.73;
    const glow = 0.5 + Math.sin(phase * 1.9) * 0.5;
    const driftX = Math.cos(phase) * cluster.rx * 0.08;
    const driftY = Math.sin(phase * 0.77) * cluster.rz * 0.1;
    const x = worldX(cluster.x + driftX);
    const z = worldZ(cluster.y + driftY);
    const rx = Math.max(0.42, cluster.rx * WORLD_SCALE * 0.34);
    const rz = Math.max(0.26, cluster.rz * WORLD_SCALE * 0.31);

    addDisc(out, x, 0.086, z, rx, rz, hex('#8DFFB0', 0.032 + glow * 0.034), 12);
    addGroundRect(out, x, 0.31, z, [0.96, 0.28], rx * 1.05, 0.026, hex('#D8FBFF', 0.045 + glow * 0.026));

    for (let leaf = 0; leaf < 2; leaf += 1) {
      const seed = clusterIndex * 419 + leaf * 97;
      const leafPhase = time * (0.72 + leaf * 0.18) + seed * 0.013;
      const mapX = cluster.x + seededBetween(seed, -cluster.rx * 0.48, cluster.rx * 0.48) + Math.cos(leafPhase) * 24;
      const mapY = cluster.y + seededBetween(seed + 31, -cluster.rz * 0.48, cluster.rz * 0.48) + Math.sin(leafPhase * 0.84) * 18;
      if (!isInRenderBounds({ x: mapX, y: mapY }, bounds, 90)) continue;

      const sparkle = 0.55 + Math.sin(time * 1.5 + seed) * 0.45;
      addOctahedron(out, worldX(mapX), 0.66 + sparkle * 0.16, worldZ(mapY), 0.026 + sparkle * 0.013, hex(leaf === 0 ? '#B7FFD1' : '#7CFFB0', 0.42 + sparkle * 0.28));
    }
  }
}

function addBaseFountainParticles(out: number[], time: number, bounds: RenderBounds) {
  for (const team of ['blue', 'red'] as Team[]) {
    const spawn = HERO_START[team];
    if (!isInRenderBounds(spawn, bounds, 220)) continue;

    const color = teamColor(team);
    const x = worldX(spawn.x);
    const z = worldZ(spawn.y);
    const pulse = 0.7 + Math.sin(time * 2.8 + spawn.x * 0.01) * 0.18;

    addDisc(out, x, 0.16, z, 0.82 + pulse * 0.12, 0.48 + pulse * 0.06, [...color.glow.slice(0, 3), 0.14] as Vec4, 28);
    addDisc(out, x, 0.18, z, 0.58 + pulse * 0.08, 0.34 + pulse * 0.04, [...color.glow.slice(0, 3), 0.22] as Vec4, 22);
    addDisc(out, x, 0.195, z, 0.34 + pulse * 0.06, 0.2 + pulse * 0.035, hex('#EAF8F5', 0.12), 20);
    addBox(out, x, 0.78, z, 0.045, 1.15, 0.045, [...color.soft.slice(0, 3), 0.18] as Vec4);

    for (let index = 0; index < 7; index += 1) {
      const phase = (time * 0.72 + index / 7) % 1;
      const angle = index * 2.21 + time * 0.55;
      const radius = 0.12 + Math.sin(index * 1.7) * 0.04;
      const particleX = x + Math.cos(angle) * radius;
      const particleZ = z + Math.sin(angle) * radius * 0.62;
      const height = 0.3 + phase * 1.08;
      const fade = Math.sin(phase * Math.PI);

      addOctahedron(out, particleX, height, particleZ, 0.035 + fade * 0.018, [...color.soft.slice(0, 3), 0.22 + fade * 0.5] as Vec4);
    }
  }
}

function laneBasis(lane: 'top' | 'middle' | 'bottom', mapX: number) {
  const prevX = Math.max(LANE_START_X, mapX - 24);
  const nextX = Math.min(LANE_END_X, mapX + 24);
  const prevY = getLaneYAtX(lane, prevX);
  const nextY = getLaneYAtX(lane, nextX);
  const tx = (nextX - prevX) * WORLD_SCALE;
  const tz = (nextY - prevY) * WORLD_SCALE;
  const length = Math.hypot(tx, tz) || 1;
  const tangent: [number, number] = [tx / length, tz / length];
  const normal: [number, number] = [-tangent[1], tangent[0]];
  return { tangent, normal };
}

function addLegPair(out: number[], x: number, z: number, facing: Point, radius: number, color: Vec4, phase: number, walkAmount: number, bob: number) {
  const length = Math.hypot(facing.x, facing.y) || 1;
  const forward = [facing.x / length, facing.y / length] as [number, number];
  const side = [-forward[1], forward[0]] as [number, number];
  const stride = Math.sin(phase) * radius * 0.76 * walkAmount;
  const lift = Math.abs(Math.cos(phase)) * 0.05 * walkAmount;

  for (const sideSign of [-1, 1]) {
    const legX = x + side[0] * radius * 0.46 * sideSign + forward[0] * stride * sideSign;
    const legZ = z + side[1] * radius * 0.46 * sideSign + forward[1] * stride * sideSign;
    const footX = legX + forward[0] * radius * 0.2 * sideSign;
    const footZ = legZ + forward[1] * radius * 0.2 * sideSign;
    addBox(out, legX, 0.16 + bob + lift * (sideSign > 0 ? 1 : 0.55), legZ, radius * 0.22, 0.34, radius * 0.18, color);
    addBox(out, footX, 0.045 + lift * 0.25, footZ, radius * 0.34, 0.08, radius * 0.22, color);
  }
}

function addDashAfterimage(out: number[], x: number, z: number, facing: Point, radius: number, color: Vec4) {
  const length = Math.hypot(facing.x, facing.y) || 1;
  const dir = [facing.x / length, facing.y / length] as [number, number];

  for (let index = 1; index <= 3; index += 1) {
    addDisc(out, x - dir[0] * radius * index * 1.25, 0.08 + index * 0.018, z - dir[1] * radius * index * 1.25, radius * (1.7 - index * 0.28), radius * (0.8 - index * 0.13), [...color.slice(0, 3), 0.13 / index] as Vec4, 16);
  }
}

function addSelectionRing(out: number[], x: number, z: number, radius: number, color: Vec4, alpha: number, pulse = 0) {
  const outerRx = radius + pulse;
  const outerRz = radius * 0.58 + pulse * 0.42;
  addDisc(out, x, 0.044, z, outerRx, outerRz, [...color.slice(0, 3), alpha] as Vec4, 28);
  addDisc(out, x, 0.048, z, outerRx * 0.76, outerRz * 0.72, hex('#1D4C36', 0.86), 28);
}

function addHeroSilhouetteHalo(
  out: number[],
  x: number,
  z: number,
  radius: number,
  color: ReturnType<typeof teamColor>,
  isPlayer: boolean,
  time: number,
) {
  const pulse = 0.74 + Math.sin(time * (isPlayer ? 2.8 : 3.5)) * 0.1;
  const ringRadius = radius * (isPlayer ? 2.58 : 2.34);
  addDisc(out, x, 0.116, z, ringRadius + pulse * radius * 0.08, (ringRadius * 0.58) + pulse * radius * 0.04, [...color.soft.slice(0, 3), isPlayer ? 0.13 : 0.11] as Vec4, 32);
  addDisc(out, x, 0.126, z, ringRadius * 0.72, ringRadius * 0.4, hex('#071013', 0.4), 28);

  if (isPlayer) {
    addBox(out, x, 1.78 + Math.sin(time * 3.2) * 0.04, z, radius * 0.12, 0.26, radius * 0.12, color.soft);
    addOctahedron(out, x, 2.02 + Math.sin(time * 3.2) * 0.04, z, radius * 0.18, color.soft);
    return;
  }

  addBox(out, x, 1.62 + Math.sin(time * 3.6) * 0.04, z, radius * 0.48, 0.1, radius * 0.1, color.main);
  addOctahedron(out, x, 1.76 + Math.sin(time * 3.6) * 0.04, z, radius * 0.16, hex('#FFD0BD', 0.86));
}

function addPlayerChevron(out: number[], x: number, z: number, color: Vec4, time: number) {
  const y = 1.86 + Math.sin(time * 3.2) * 0.04;
  addOctahedron(out, x, y, z, 0.13, color);
  addBox(out, x, y - 0.13, z, 0.08, 0.18, 0.08, color);
}

function addEnemyThreatMarker(out: number[], x: number, z: number, color: Vec4, time: number) {
  const y = 1.76 + Math.sin(time * 3.4) * 0.035;
  const pulse = 0.82 + Math.sin(time * 4.2) * 0.12;
  addOctahedron(out, x, y, z, 0.12 * pulse, color);
  addOctahedron(out, x, y + 0.02, z, 0.06 * pulse, hex('#FFE0D4', 0.82));
}

function addMinionDeathParticles(out: number[], minion: Minion, radius: number, time: number, color: ReturnType<typeof teamColor>) {
  const x = worldX(minion.position.x);
  const z = worldZ(minion.position.y);
  const elapsed = Math.max(0, time - minion.deathTime);
  const fade = Math.max(0, 1 - elapsed / 0.3);
  addDisc(out, x, 0.052, z, radius * (1.9 - fade * 0.4), radius, hex('#FFFFFF', 0.18 * fade), 16);

  for (let index = 0; index < 5; index += 1) {
    const angle = index * ((Math.PI * 2) / 5) + minion.position.x * 0.01;
    const spread = elapsed * (0.55 + index * 0.04);
    addOctahedron(
      out,
      x + Math.cos(angle) * spread,
      0.24 + elapsed * 1.1 + index * 0.02,
      z + Math.sin(angle) * spread * 0.7,
      radius * 0.22,
      [...color.soft.slice(0, 3), fade] as Vec4,
    );
  }
}

function addRubble(out: number[], position: Point, count: number) {
  const x = worldX(position.x);
  const z = worldZ(position.y);
  for (let index = 0; index < count; index += 1) {
    const angle = index * ((Math.PI * 2) / count) + position.x * 0.003;
    const distance = 0.24 + (index % 3) * 0.14;
    const width = 0.16 + (index % 2) * 0.08;
    addBox(out, x + Math.cos(angle) * distance, 0.08, z + Math.sin(angle) * distance * 0.68, width, 0.12, 0.13, hex(index % 2 === 0 ? '#555A55' : '#373C38', 0.72));
  }
}

function addBasePlate(out: number[], team: Team) {
  const color = teamColor(team);
  const x = worldX(BASE_POSITIONS[team].x);
  const z = worldZ(BASE_POSITIONS[team].y);
  const platformWidth = 380 * WORLD_SCALE;
  const platformDepth = MAP_HEIGHT * 0.82 * WORLD_SCALE;
  const tileWidth = platformWidth / 8;
  const tileDepth = platformDepth / 6;
  const edgeColor = [...color.dark.slice(0, 3), 0.95] as Vec4;

  addBox(out, x, 0.035, z, platformWidth, 0.07, platformDepth, hex('#282D31'));

  for (let col = 0; col < 8; col += 1) {
    for (let row = 0; row < 6; row += 1) {
      const tileX = x - platformWidth / 2 + tileWidth * (col + 0.5);
      const tileZ = z - platformDepth / 2 + tileDepth * (row + 0.5);
      const tileColor = (col + row) % 2 === 0
        ? [...color.dark.slice(0, 3), 0.62] as Vec4
        : hex(team === 'blue' ? '#1D4268' : '#642519', 0.7);
      addBox(out, tileX, 0.088, tileZ, tileWidth * 0.94, 0.025, tileDepth * 0.94, tileColor);
    }
  }

  addBox(out, x, 0.14, z - platformDepth / 2, platformWidth, 0.12, 0.14, hex('#151B1D'));
  addBox(out, x, 0.14, z + platformDepth / 2, platformWidth, 0.12, 0.14, hex('#151B1D'));
  addBox(out, x - platformWidth / 2, 0.14, z, 0.14, 0.12, platformDepth, hex('#151B1D'));
  addBox(out, x + platformWidth / 2, 0.14, z, 0.14, 0.12, platformDepth, hex('#151B1D'));

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = x + sx * platformWidth * 0.43;
      const pz = z + sz * platformDepth * 0.43;
      addCylinder(out, px, 0.28, pz, 0.13, 0.38, 8, hex('#394147'));
      addOctahedron(out, px, 0.58, pz, 0.1, edgeColor);
    }
  }

  addDisc(out, worldX(HERO_START[team].x), 0.13, worldZ(HERO_START[team].y), 0.86, 0.5, [...color.glow.slice(0, 3), 0.3] as Vec4, 30);
  addDisc(out, worldX(HERO_START[team].x), 0.148, worldZ(HERO_START[team].y), 0.52, 0.3, hex('#EAF8F5', 0.08), 24);

  const direction = team === 'blue' ? 1 : -1;
  for (const lane of LANES) {
    const laneY = getLaneYAtX(lane, team === 'blue' ? LANE_START_X : LANE_END_X);
    const pathCenterX = BASE_POSITIONS[team].x + direction * 240;
    const pathLength = 320 * WORLD_SCALE;
    addBox(out, worldX(pathCenterX), 0.055, worldZ(laneY), pathLength, 0.035, 0.52, hex('#4F5046', 0.72));
    addGroundRect(out, worldX(pathCenterX + direction * 12), 0.112, worldZ(laneY), [direction, 0], pathLength * 0.74, 0.045, [...color.soft.slice(0, 3), 0.17] as Vec4);
    addGroundRect(out, worldX(pathCenterX + direction * 104), 0.118, worldZ(laneY), [direction, 0], 0.34, 0.085, hex('#EAF8F5', 0.09));
  }

  for (const offset of [-0.28, 0.28]) {
    const lampX = x + direction * platformWidth * 0.24;
    const lampZ = z + platformDepth * offset;
    addCylinder(out, lampX, 0.34, lampZ, 0.035, 0.56, 6, hex('#2A2D32'));
    addOctahedron(out, lampX, 0.72, lampZ, 0.08, color.soft);
    addDisc(out, lampX, 0.1, lampZ, 0.38, 0.2, [...color.glow.slice(0, 3), 0.13] as Vec4, 14);
  }
}

function addLane(out: number[], lane: 'top' | 'middle' | 'bottom', width: number, color: Vec4, y = 0.02) {
  const steps = 56;
  const half = width / 2;
  const left: Vec3[] = [];
  const right: Vec3[] = [];

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const mapX = LANE_START_X + (LANE_END_X - LANE_START_X) * t;
    const mapY = getLaneYAtX(lane, mapX);
    const prevX = Math.max(LANE_START_X, mapX - 22);
    const nextX = Math.min(LANE_END_X, mapX + 22);
    const prevY = getLaneYAtX(lane, prevX);
    const nextY = getLaneYAtX(lane, nextX);
    const tx = nextX - prevX;
    const ty = nextY - prevY;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;

    left.push([worldX(mapX + nx * half / WORLD_SCALE), y, worldZ(mapY + ny * half / WORLD_SCALE)]);
    right.push([worldX(mapX - nx * half / WORLD_SCALE), y, worldZ(mapY - ny * half / WORLD_SCALE)]);
  }

  for (let i = 0; i < steps; i += 1) {
    addQuad(out, left[i], right[i], right[i + 1], left[i + 1], [0, 1, 0], color);
  }
}

function addJungleConnector(out: number[], path: JungleConnector, width: number, color: Vec4, y = 0.04) {
  const steps = 24;
  const half = width / 2;
  const left: Vec3[] = [];
  const right: Vec3[] = [];

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const point = cubicPoint(path, t);
    const previous = cubicPoint(path, Math.max(0, t - 1 / steps));
    const next = cubicPoint(path, Math.min(1, t + 1 / steps));
    const tx = next.x - previous.x;
    const ty = next.y - previous.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;

    left.push([worldX(point.x + nx * half / WORLD_SCALE), y, worldZ(point.y + ny * half / WORLD_SCALE)]);
    right.push([worldX(point.x - nx * half / WORLD_SCALE), y, worldZ(point.y - ny * half / WORLD_SCALE)]);
  }

  for (let i = 0; i < steps; i += 1) {
    addQuad(out, left[i], right[i], right[i + 1], left[i + 1], [0, 1, 0], color);
  }
}

function addJungleConnectorTexture(out: number[], path: JungleConnector) {
  for (let index = 0; index < 9; index += 1) {
    const t = (index + 0.5) / 9;
    const point = cubicPoint(path, t);
    const previous = cubicPoint(path, Math.max(0, t - 0.04));
    const next = cubicPoint(path, Math.min(1, t + 0.04));
    const tx = next.x - previous.x;
    const ty = next.y - previous.y;
    const len = Math.hypot(tx, ty) || 1;
    const tangent: [number, number] = [tx / len, ty / len];
    const glow = index % 3 === 0 ? hex('#7CFFB0', 0.12) : hex('#D1B071', 0.16);

    addGroundRect(out, worldX(point.x), 0.19 + (index % 2) * 0.024, worldZ(point.y), tangent, 0.5, 0.048, glow);
  }
}

function addLaneTexture(out: number[], lane: 'top' | 'middle' | 'bottom') {
  const markCount = 20;

  for (let index = 0; index < markCount; index += 1) {
    const t = (index + 0.5) / markCount;
    const mapX = LANE_START_X + (LANE_END_X - LANE_START_X) * t;
    const mapY = getLaneYAtX(lane, mapX);
    const { tangent, normal } = laneBasis(lane, mapX);
    const seed = index * 97 + lane.length * 31;
    const lateral = index % 5 === 0 ? 0 : seededBetween(seed, -0.38, 0.38);
    const along = seededBetween(seed + 11, -0.14, 0.14);
    const x = worldX(mapX) + normal[0] * lateral + tangent[0] * along;
    const z = worldZ(mapY) + normal[1] * lateral + tangent[1] * along;
    const length = seededBetween(seed + 17, 0.42, 0.78);
    const width = seededBetween(seed + 23, 0.075, 0.14);
    const color = index % 4 === 0 ? hex('#E0D0A0', 0.28) : index % 3 === 0 ? hex('#4E5F46', 0.32) : hex('#243B2F', 0.42);

    addGroundRect(out, x, 0.254 + (index % 3) * 0.026, z, tangent, length, width, color);

    if (index % 5 === 0) {
      const glowColor = lane === 'middle' ? hex('#C7A5FF', 0.13) : hex('#FFF1B7', 0.12);
      addGroundRect(out, worldX(mapX), 0.336, worldZ(mapY), tangent, 0.7, 0.035, glowColor);
      addDisc(out, worldX(mapX), 0.328, worldZ(mapY), 0.22, 0.115, glowColor, 12);
    }
  }
}

function addLaneShoulders(out: number[], lane: 'top' | 'middle' | 'bottom') {
  const markerCount = 18;

  for (let index = 0; index < markerCount; index += 1) {
    const t = (index + 0.5) / markerCount;
    const mapX = LANE_START_X + (LANE_END_X - LANE_START_X) * t;
    const mapY = getLaneYAtX(lane, mapX);
    const { tangent, normal } = laneBasis(lane, mapX);
    const length = index % 5 === 0 ? 0.54 : 0.34;
    const width = index % 5 === 0 ? 0.088 : 0.062;
    const stoneColor = index % 4 === 0 ? hex('#E0D0A0', 0.34) : hex('#213D31', 0.76);

    for (const sideSign of [-1, 1]) {
      const offset = 1.08 + (index % 3) * 0.04;
      const x = worldX(mapX) + normal[0] * offset * sideSign;
      const z = worldZ(mapY) + normal[1] * offset * sideSign;
      addGroundRect(out, x, 0.286 + (index % 2) * 0.02, z, tangent, length, width, stoneColor);

      if (index % 6 === 0) {
        const glowColor = lane === 'middle'
          ? hex('#C7A5FF', 0.16)
          : sideSign > 0
            ? hex('#7CFFB0', 0.13)
            : hex('#8EF7FF', 0.13);
        addDisc(out, x, 0.17, z, 0.2, 0.105, glowColor, 10);
      }
    }
  }
}

function addGroundRect(out: number[], x: number, y: number, z: number, tangent: [number, number], length: number, width: number, color: Vec4) {
  const tangentLength = Math.hypot(tangent[0], tangent[1]) || 1;
  const tx = tangent[0] / tangentLength;
  const tz = tangent[1] / tangentLength;
  const nx = -tz;
  const nz = tx;
  const hl = length / 2;
  const hw = width / 2;

  addQuad(
    out,
    [x - tx * hl - nx * hw, y, z - tz * hl - nz * hw],
    [x + tx * hl - nx * hw, y, z + tz * hl - nz * hw],
    [x + tx * hl + nx * hw, y, z + tz * hl + nz * hw],
    [x - tx * hl + nx * hw, y, z - tz * hl + nz * hw],
    [0, 1, 0],
    color,
  );
}

function addTree(out: number[], x: number, z: number, scale: number) {
  addCylinder(out, x, 0.18 * scale, z, 0.065 * scale, 0.36 * scale, 6, hex('#5B4129'));
  addCone(out, x - 0.08 * scale, 0.56 * scale, z + 0.03 * scale, 0.34 * scale, 0.68 * scale, 8, hex('#1D5838'));
  addCone(out, x + 0.11 * scale, 0.66 * scale, z - 0.04 * scale, 0.32 * scale, 0.62 * scale, 8, hex('#29784A'));
  addCone(out, x + 0.02 * scale, 0.94 * scale, z, 0.25 * scale, 0.48 * scale, 8, hex('#34A263'));
}

function addMagicTree(out: number[], x: number, z: number, scale: number) {
  addCylinder(out, x, 0.28 * scale, z, 0.085 * scale, 0.56 * scale, 7, hex('#4C392A'));
  addCone(out, x - 0.13 * scale, 0.72 * scale, z + 0.05 * scale, 0.42 * scale, 0.82 * scale, 8, hex('#19663E'));
  addCone(out, x + 0.16 * scale, 0.84 * scale, z - 0.06 * scale, 0.4 * scale, 0.78 * scale, 8, hex('#258553'));
  addCone(out, x, 1.15 * scale, z, 0.35 * scale, 0.7 * scale, 8, hex('#2AE87A', 0.84));
  addOctahedron(out, x + 0.12 * scale, 1.28 * scale, z - 0.06 * scale, 0.08 * scale, hex('#8DFFB0', 0.8));
  addDisc(out, x, 0.05, z, 0.55 * scale, 0.32 * scale, hex('#2AE87A', 0.12), 16);
}

function addBillboardBar(
  out: number[],
  position: Point,
  height: number,
  width: number,
  ratio: number,
  color: Vec4,
  options: { shieldRatio?: number; flash?: number } = {},
) {
  const x = worldX(position.x);
  const z = worldZ(position.y);
  const y = height;
  const w = width;
  const h = 0.1;
  const filled = Math.max(0, Math.min(1, ratio));
  const shieldFilled = Math.max(0, Math.min(1, filled + (options.shieldRatio ?? 0)));
  const flash = Math.max(0, Math.min(1, options.flash ?? 0));
  const outerPad = 0.025;
  const innerPad = 0.032;

  addQuad(out, [x - w / 2 - outerPad, y - outerPad, z - 0.004], [x + w / 2 + outerPad, y - outerPad, z - 0.004], [x + w / 2 + outerPad, y + h + outerPad, z - 0.004], [x - w / 2 - outerPad, y + h + outerPad, z - 0.004], [0, 0, 1], hex('#000000', 0.88));
  addQuad(out, [x - w / 2, y, z], [x + w / 2, y, z], [x + w / 2, y + h, z], [x - w / 2, y + h, z], [0, 0, 1], hex('#061012', 0.95));
  addQuad(
    out,
    [x - w / 2 + innerPad, y + 0.02, z + 0.004],
    [x - w / 2 + innerPad + (w - innerPad * 2) * filled, y + 0.02, z + 0.004],
    [x - w / 2 + innerPad + (w - innerPad * 2) * filled, y + h - 0.02, z + 0.004],
    [x - w / 2 + innerPad, y + h - 0.02, z + 0.004],
    [0, 0, 1],
    color,
  );

  if (shieldFilled > filled) {
    addQuad(
      out,
      [x - w / 2 + innerPad + (w - innerPad * 2) * filled, y + 0.023, z + 0.006],
      [x - w / 2 + innerPad + (w - innerPad * 2) * shieldFilled, y + 0.023, z + 0.006],
      [x - w / 2 + innerPad + (w - innerPad * 2) * shieldFilled, y + h - 0.023, z + 0.006],
      [x - w / 2 + innerPad + (w - innerPad * 2) * filled, y + h - 0.023, z + 0.006],
      [0, 0, 1],
      hex('#88EEFF', 0.82),
    );
  }

  if (flash > 0) {
    addQuad(
      out,
      [x - w / 2 + innerPad, y + 0.018, z + 0.008],
      [x - w / 2 + innerPad + (w - innerPad * 2) * filled, y + 0.018, z + 0.008],
      [x - w / 2 + innerPad + (w - innerPad * 2) * filled, y + h - 0.018, z + 0.008],
      [x - w / 2 + innerPad, y + h - 0.018, z + 0.008],
      [0, 0, 1],
      hex('#FFFFFF', 0.34 * flash),
    );
  }
}

function addPlane(out: number[], x: number, y: number, z: number, width: number, depth: number, color: Vec4) {
  addQuad(
    out,
    [x - width / 2, y, z - depth / 2],
    [x + width / 2, y, z - depth / 2],
    [x + width / 2, y, z + depth / 2],
    [x - width / 2, y, z + depth / 2],
    [0, 1, 0],
    color,
  );
}

function addBox(out: number[], x: number, y: number, z: number, width: number, height: number, depth: number, color: Vec4) {
  const x0 = x - width / 2;
  const x1 = x + width / 2;
  const y0 = y - height / 2;
  const y1 = y + height / 2;
  const z0 = z - depth / 2;
  const z1 = z + depth / 2;

  addQuad(out, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], color);
  addQuad(out, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], color);
  addQuad(out, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], color);
  addQuad(out, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], color);
  addQuad(out, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], color);
  addQuad(out, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], color);
}

function addCylinder(out: number[], x: number, y: number, z: number, radius: number, height: number, segments: number, color: Vec4) {
  const bottom = y - height / 2;
  const top = y + height / 2;

  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const p0: Vec3 = [x + Math.cos(a0) * radius, bottom, z + Math.sin(a0) * radius];
    const p1: Vec3 = [x + Math.cos(a1) * radius, bottom, z + Math.sin(a1) * radius];
    const p2: Vec3 = [x + Math.cos(a1) * radius, top, z + Math.sin(a1) * radius];
    const p3: Vec3 = [x + Math.cos(a0) * radius, top, z + Math.sin(a0) * radius];
    const normal: Vec3 = [Math.cos((a0 + a1) * 0.5), 0, Math.sin((a0 + a1) * 0.5)];
    addQuad(out, p0, p1, p2, p3, normal, color);
    addTri(out, [x, top, z], p3, p2, [0, 1, 0], color);
    addTri(out, [x, bottom, z], p1, p0, [0, -1, 0], color);
  }
}

function addSphere(out: number[], x: number, y: number, z: number, radius: number, latSegments: number, lonSegments: number, color: Vec4) {
  const latCount = Math.max(3, Math.round(latSegments));
  const lonCount = Math.max(6, Math.round(lonSegments));

  for (let lat = 0; lat < latCount; lat += 1) {
    const theta0 = -Math.PI / 2 + (lat / latCount) * Math.PI;
    const theta1 = -Math.PI / 2 + ((lat + 1) / latCount) * Math.PI;

    for (let lon = 0; lon < lonCount; lon += 1) {
      const phi0 = (lon / lonCount) * Math.PI * 2;
      const phi1 = ((lon + 1) / lonCount) * Math.PI * 2;
      const p00 = spherePoint(x, y, z, radius, theta0, phi0);
      const p01 = spherePoint(x, y, z, radius, theta0, phi1);
      const p10 = spherePoint(x, y, z, radius, theta1, phi0);
      const p11 = spherePoint(x, y, z, radius, theta1, phi1);

      if (lat === 0) {
        addTriAuto(out, p00, p11, p10, color);
      } else if (lat === latCount - 1) {
        addTriAuto(out, p00, p01, p10, color);
      } else {
        addTriAuto(out, p00, p01, p11, color);
        addTriAuto(out, p00, p11, p10, color);
      }
    }
  }
}

function spherePoint(x: number, y: number, z: number, radius: number, theta: number, phi: number): Vec3 {
  const ring = Math.cos(theta) * radius;
  return [
    x + Math.cos(phi) * ring,
    y + Math.sin(theta) * radius,
    z + Math.sin(phi) * ring,
  ];
}

function addCone(out: number[], x: number, y: number, z: number, radius: number, height: number, segments: number, color: Vec4) {
  const bottom = y - height / 2;
  const top: Vec3 = [x, y + height / 2, z];

  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const p0: Vec3 = [x + Math.cos(a0) * radius, bottom, z + Math.sin(a0) * radius];
    const p1: Vec3 = [x + Math.cos(a1) * radius, bottom, z + Math.sin(a1) * radius];
    const normal = normalize3(cross(sub3(p1, top), sub3(p0, top)));
    addTri(out, top, p0, p1, normal, color);
    addTri(out, [x, bottom, z], p1, p0, [0, -1, 0], color);
  }
}

function addOctahedron(out: number[], x: number, y: number, z: number, radius: number, color: Vec4) {
  const top: Vec3 = [x, y + radius * 1.35, z];
  const bottom: Vec3 = [x, y - radius * 1.05, z];
  const points: Vec3[] = [
    [x + radius, y, z],
    [x, y, z + radius],
    [x - radius, y, z],
    [x, y, z - radius],
  ];

  for (let i = 0; i < 4; i += 1) {
    const next = (i + 1) % 4;
    addTriAuto(out, top, points[i], points[next], color);
    addTriAuto(out, bottom, points[next], points[i], color);
  }
}

function addDisc(out: number[], x: number, y: number, z: number, rx: number, rz: number, color: Vec4, segments: number) {
  const center: Vec3 = [x, y, z];
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    addTri(out, center, [x + Math.cos(a0) * rx, y, z + Math.sin(a0) * rz], [x + Math.cos(a1) * rx, y, z + Math.sin(a1) * rz], [0, 1, 0], color);
  }
}

function addQuad(out: number[], a: Vec3, b: Vec3, c: Vec3, d: Vec3, normal: Vec3, color: Vec4) {
  addTri(out, a, b, c, normal, color);
  addTri(out, a, c, d, normal, color);
}

function addTriAuto(out: number[], a: Vec3, b: Vec3, c: Vec3, color: Vec4) {
  addTri(out, a, b, c, normalize3(cross(sub3(b, a), sub3(c, a))), color);
}

function addTri(out: number[], a: Vec3, b: Vec3, c: Vec3, normal: Vec3, color: Vec4) {
  pushVertex(out, a, normal, color);
  pushVertex(out, b, normal, color);
  pushVertex(out, c, normal, color);
}

function pushVertex(out: number[], position: Vec3, normal: Vec3, color: Vec4) {
  const maybeSink = out as unknown;
  if (maybeSink instanceof DynamicVertexSink) {
    maybeSink.pushVertex(position, normal, color);
    return;
  }

  out.push(position[0], position[1], position[2], normal[0], normal[1], normal[2], color[0], color[1], color[2], color[3]);
}

function cameraMatrix(camera: CameraState, aspect: number) {
  const focusX = camera.center.x;
  const zoom = Math.max(0.56, Math.min(2.2, camera.zoom || 1.62));
  const distanceScale = Math.max(0.42, Math.min(1.58, 0.86 / zoom));
  const eyeY = 1080 * distanceScale;
  const eyeZ = camera.center.y + 1120 * distanceScale;
  const fovDegrees = Math.max(53, Math.min(67, 60 + (distanceScale - 1) * 12));

  const eye: Vec3 = [worldX(focusX), eyeY * WORLD_SCALE, worldZ(eyeZ)];
  const target: Vec3 = [worldX(focusX), 0.12, worldZ(camera.center.y - 56 * distanceScale)];
  const view = lookAt(eye, target, [0, 1, 0]);
  const projection = perspective((fovDegrees * Math.PI) / 180, aspect, 0.08, 125);
  return multiply4(projection, view);
}

function perspective(fovY: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function lookAt(eye: Vec3, target: Vec3, up: Vec3) {
  const z = normalize3(sub3(eye, target));
  const x = normalize3(cross(up, z));
  const y = cross(z, x);

  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot3(x, eye), -dot3(y, eye), -dot3(z, eye), 1,
  ]);
}

function multiply4(a: Float32Array, b: Float32Array) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function createProgram(gl: GL, vertexSource: string, fragmentSource: string) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create GL program');

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'GL program link failed');
  }

  return program;
}

function compileShader(gl: GL, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create GL shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'GL shader compile failed');
  }

  return shader;
}

function teamColor(team: Team, customMain?: string) {
  if (team === 'blue' && customMain && /^#[0-9A-Fa-f]{6}$/.test(customMain)) {
    return {
      main: hex(customMain),
      soft: hex(blendHex(customMain, '#FFFFFF', 0.48)),
      dark: hex(blendHex(customMain, '#061012', 0.58)),
      glow: hex(customMain),
    };
  }

  const raw = TEAM_COLORS[team];
  return {
    main: hex(raw.main),
    soft: hex(raw.soft),
    dark: hex(raw.dark),
    glow: hex(team === 'blue' ? '#47D8FF' : '#FF714D'),
  };
}

function effectColor(effect: Effect) {
  if (effect.color.startsWith('#')) {
    return hex(effect.color);
  }

  if (effect.kind === 'pulse') return hex('#65F59A');
  if (effect.kind === 'bolt') return hex('#9CEEFF');
  if (effect.kind === 'fireball') return hex('#FFB15F');
  if (effect.kind === 'chain') return hex('#9CEEFF');
  if (effect.kind === 'dash') return hex('#8EF7FF');
  if (effect.kind === 'shield') return hex('#88EEFF');
  if (effect.kind === 'trap') return hex('#C7A5FF');
  if (effect.kind === 'ult') return hex('#A77DFF');
  return hex('#E9FBFF');
}

function hex(value: string, alpha = 1): Vec4 {
  const normalized = value.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  return [r, g, b, alpha];
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

function worldX(x: number) {
  return (x - MAP_WIDTH / 2) * WORLD_SCALE;
}

function worldZ(y: number) {
  return (y - MAP_HEIGHT / 2) * WORLD_SCALE;
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot3(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize3(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}
