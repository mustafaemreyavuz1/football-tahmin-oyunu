import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Platform } from 'react-native';

const TICK_VOLUME = 0.3;
const MIN_TICK_INTERVAL_MS = 48;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TICK_ASSET = require('../../../assets/sounds/tick.wav');

let soundInstance: Audio.Sound | null = null;
let audioConfigured = false;
let isLoading = false;
let lastPlayAt = 0;

async function ensureAudioMode(): Promise<void> {
  if (audioConfigured) return;
  audioConfigured = true;
  if (Platform.OS === 'web') return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      shouldDuckAndroid: false,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    });
  } catch {
    // Silent fallback if audio mode configuration fails
  }
}

/**
 * Preloads the procedural tick sound so the first countdown step has no latency.
 * Never throws; failures are silently ignored.
 */
export async function preloadTickSound(): Promise<void> {
  if (soundInstance || isLoading) return;
  isLoading = true;
  try {
    await ensureAudioMode();
    const { sound } = await Audio.Sound.createAsync(TICK_ASSET, {
      volume: TICK_VOLUME,
      shouldPlay: false,
    });
    soundInstance = sound;
  } catch {
    soundInstance = null;
  } finally {
    isLoading = false;
  }
}

/**
 * Plays a single short, quiet tick sound if enough time has elapsed since the previous tick.
 * Safe on Web (silently skips if autoplay is restricted) and native iOS/Android.
 */
export async function playTickSound(): Promise<void> {
  const now = Date.now();
  if (now - lastPlayAt < MIN_TICK_INTERVAL_MS) return;
  lastPlayAt = now;

  try {
    if (!soundInstance) {
      await preloadTickSound();
    }
    if (!soundInstance) return;

    const status = await soundInstance.getStatusAsync();
    if (!status.isLoaded) return;

    await soundInstance.setVolumeAsync(TICK_VOLUME);
    await soundInstance.setPositionAsync(0);
    await soundInstance.playAsync();
  } catch {
    // Silent fallback (e.g. Web autoplay policy or unavailable audio hardware)
  }
}

/**
 * Stops any currently playing tick immediately (used when user taps to skip animation).
 */
export async function stopTickSound(): Promise<void> {
  if (!soundInstance) return;
  try {
    const status = await soundInstance.getStatusAsync();
    if (status.isLoaded && status.isPlaying) {
      await soundInstance.stopAsync();
    }
  } catch {
    // Ignore stop errors
  }
}

/**
 * Releases audio resources on screen unmount.
 */
export async function unloadTickSound(): Promise<void> {
  const current = soundInstance;
  soundInstance = null;
  if (!current) return;
  try {
    await current.unloadAsync();
  } catch {
    // Ignore unload errors
  }
}
