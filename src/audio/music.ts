import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const MUSIC_SOURCES = [
  require('../../assets/audio/Background_music1.mp3'),
  require('../../assets/audio/Background_music2.mp3'),
  require('../../assets/audio/Background_music3.mp3'),
  require('../../assets/audio/Background_music4.mp3'),
  require('../../assets/audio/Background_music5hindu.mp3'),
  require('../../assets/audio/Background_music6polyesian.mp3'),
  require('../../assets/audio/Background_music7Norse.mp3'),
  require('../../assets/audio/Background_music8Norse.mp3'),
  require('../../assets/audio/Background_music9Egyptian.mp3'),
  require('../../assets/audio/Background_music10Egyptian.mp3'),
  require('../../assets/audio/Background_music11Chinese.mp3'),
  require('../../assets/audio/Background_music12Inuit.mp3'),
  require('../../assets/audio/Background_music13Chinese.mp3'),
] as const;

type AudioPlayerInstance = ReturnType<typeof createAudioPlayer>;

let player: AudioPlayerInstance | null = null;
let enabled = true;
let configured = false;
let currentSourceIndex: number | null = null;

export async function initMusic() {
  if (configured) {
    if (enabled) {
      playMusic();
    }
    return;
  }

  configured = true;

  try {
    await setAudioModeAsync({
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: true,
      allowsRecording: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
  } catch {
    // Background music is optional; audio setup failures should not block the app.
  }

  setMusicSource(pickRandomSourceIndex());

  if (enabled) {
    playMusic();
  }
}

export async function playRandomMusic() {
  if (!configured) {
    await initMusic();
    return;
  }

  setMusicSource(pickRandomSourceIndex());
  playMusic();
}

export function setMusicEnabled(value: boolean) {
  enabled = value;

  if (enabled) {
    void initMusic();
    playMusic();
    return;
  }

  try {
    player?.pause();
  } catch {
    // Ignore native audio races during fast refresh or route changes.
  }
}

export function releaseMusic() {
  try {
    player?.remove();
  } catch {
    // Ignore native teardown races during fast refresh.
  }

  player = null;
  configured = false;
  currentSourceIndex = null;
}

function playMusic() {
  if (!enabled || !player) return;

  try {
    player.play();
  } catch {
    // Music should never interrupt gameplay if native playback rejects.
  }
}

function setMusicSource(sourceIndex: number) {
  try {
    player?.remove();
  } catch {
    // Ignore native teardown races during fast refresh.
  }

  currentSourceIndex = sourceIndex;
  player = createAudioPlayer(MUSIC_SOURCES[sourceIndex], { updateInterval: 1000 });
  player.volume = 0.14;
  player.loop = true;
}

function pickRandomSourceIndex() {
  if (MUSIC_SOURCES.length <= 1) return 0;

  let nextIndex = Math.floor(Math.random() * MUSIC_SOURCES.length);
  if (nextIndex === currentSourceIndex) {
    nextIndex = (nextIndex + 1 + Math.floor(Math.random() * (MUSIC_SOURCES.length - 1))) % MUSIC_SOURCES.length;
  }

  return nextIndex;
}
