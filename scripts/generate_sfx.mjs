import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SAMPLE_RATE = 44100;
const OUT_DIR = join(process.cwd(), 'src/assets/sfx');

const specs = {
  victory: [
    { type: 'square', freq: 523, start: 0, duration: 0.14, gain: 0.22 },
    { type: 'square', freq: 659, start: 0.13, duration: 0.15, gain: 0.22 },
    { type: 'square', freq: 784, start: 0.27, duration: 0.23, gain: 0.24 },
    { type: 'sine', freq: 1046, start: 0.32, duration: 0.18, gain: 0.18 },
  ],
  defeat: [
    { type: 'saw', freq: 196, start: 0, duration: 0.2, gain: 0.22, slide: 0.7 },
    { type: 'saw', freq: 147, start: 0.16, duration: 0.24, gain: 0.24, slide: 0.64 },
    { type: 'sine', freq: 98, start: 0.32, duration: 0.32, gain: 0.22, slide: 0.62 },
  ],
  tower: [
    { type: 'triangle', freq: 180, start: 0, duration: 0.12, gain: 0.26, slide: 0.55 },
    { type: 'noise', freq: 0, start: 0.04, duration: 0.22, gain: 0.18 },
    { type: 'sine', freq: 392, start: 0.08, duration: 0.18, gain: 0.12, slide: 0.8 },
  ],
  boss: [
    { type: 'saw', freq: 110, start: 0, duration: 0.36, gain: 0.25, slide: 0.72 },
    { type: 'sine', freq: 55, start: 0.08, duration: 0.42, gain: 0.22 },
    { type: 'square', freq: 330, start: 0.2, duration: 0.16, gain: 0.12, slide: 1.4 },
  ],
  levelup: [
    { type: 'sine', freq: 587, start: 0, duration: 0.12, gain: 0.2 },
    { type: 'sine', freq: 880, start: 0.1, duration: 0.14, gain: 0.22 },
    { type: 'sine', freq: 1175, start: 0.2, duration: 0.18, gain: 0.2 },
    { type: 'triangle', freq: 1760, start: 0.28, duration: 0.12, gain: 0.12 },
  ],
  upgrade: [
    { type: 'triangle', freq: 440, start: 0, duration: 0.1, gain: 0.16 },
    { type: 'triangle', freq: 660, start: 0.08, duration: 0.1, gain: 0.18 },
    { type: 'triangle', freq: 990, start: 0.16, duration: 0.12, gain: 0.18 },
  ],
  hit: [
    { type: 'noise', freq: 0, start: 0, duration: 0.09, gain: 0.14 },
    { type: 'triangle', freq: 220, start: 0.01, duration: 0.08, gain: 0.11, slide: 0.58 },
    { type: 'sine', freq: 880, start: 0.025, duration: 0.055, gain: 0.08, slide: 0.72 },
  ],
};

mkdirSync(OUT_DIR, { recursive: true });

for (const [name, layers] of Object.entries(specs)) {
  const duration = Math.max(...layers.map((layer) => layer.start + layer.duration)) + 0.08;
  const samples = new Int16Array(Math.ceil(duration * SAMPLE_RATE));

  for (let i = 0; i < samples.length; i += 1) {
    const t = i / SAMPLE_RATE;
    let sample = 0;

    for (const layer of layers) {
      if (t < layer.start || t > layer.start + layer.duration) continue;
      const local = (t - layer.start) / layer.duration;
      const envelope = Math.sin(Math.PI * local) * Math.pow(1 - local, layer.type === 'noise' ? 0.3 : 0.18);
      const freq = layer.freq * (layer.slide ? 1 + (layer.slide - 1) * local : 1);
      const phase = Math.PI * 2 * freq * (t - layer.start);
      sample += oscillator(layer.type, phase, i) * layer.gain * envelope;
    }

    samples[i] = Math.max(-32767, Math.min(32767, Math.round(sample * 32767)));
  }

  writeFileSync(join(OUT_DIR, `${name}.wav`), wavBuffer(samples));
}

function oscillator(type, phase, index) {
  if (type === 'square') return Math.sin(phase) >= 0 ? 1 : -1;
  if (type === 'triangle') return 2 * Math.abs(2 * ((phase / (Math.PI * 2)) % 1) - 1) - 1;
  if (type === 'saw') return 2 * ((phase / (Math.PI * 2)) % 1) - 1;
  if (type === 'noise') return pseudoNoise(index);
  return Math.sin(phase);
}

function pseudoNoise(index) {
  const x = Math.sin(index * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function wavBuffer(samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i += 1) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }

  return buffer;
}
