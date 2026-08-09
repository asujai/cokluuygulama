import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { MultiTimerItem, TimerPreset } from './types';

const TIMERS_STORAGE_KEY = '@gundelik_active_multi_timers';
const PRESETS_STORAGE_KEY = '@gundelik_custom_timer_presets';

export const DEFAULT_PRESETS: TimerPreset[] = [
  { id: 'tea', title: 'Çay Demleme', seconds: 240, color: '#D97706', icon: 'cafe-outline' },
  { id: 'egg', title: 'Yumurta (Rafadan)', seconds: 360, color: '#F59E0B', icon: 'restaurant-outline' },
  { id: 'oven', title: 'Fırın & Yemek', seconds: 1800, color: '#EA580C', icon: 'flame-outline' },
  { id: 'pomodoro', title: 'Pomodoro Odak', seconds: 1500, color: '#EF4444', icon: 'alarm-outline' },
  { id: 'rest', title: 'Kısa Mola', seconds: 300, color: '#10B981', icon: 'leaf-outline' },
  { id: 'workout', title: 'Egzersiz Set', seconds: 45, color: '#6366F1', icon: 'barbell-outline' },
];

let audioCtx: any = null;

function getAudioContext(): any {
  if (typeof window !== 'undefined') {
    const AudioContextClass =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      if (!audioCtx) {
        audioCtx = new AudioContextClass();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      return audioCtx;
    }
  }
  return null;
}

export function playTimerFinishAlarm(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Multi-tone chime alert
    const notes = [659.25, 783.99, 1046.5]; // E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }, idx * 140);
    });
  } catch {}
}

export function playLapTickSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch {}
}

export async function triggerHapticNotification(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

export async function triggerHapticImpact(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
}

/**
 * Format milliseconds to stopwatch format (HH:MM:SS.ss or MM:SS.ss)
 */
export function formatStopwatchMs(ms: number): { main: string; msPart: string } {
  const totalSeconds = Math.floor(ms / 1000);
  const hundredths = Math.floor((ms % 1000) / 10);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  const main =
    hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`;

  const msPart = `.${pad(hundredths)}`;

  return { main, msPart };
}

/**
 * Format seconds to timer duration string (HH:MM:SS or MM:SS)
 */
export function formatDurationSeconds(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

// Storage helpers
export async function loadSavedTimers(): Promise<MultiTimerItem[]> {
  try {
    const json = await AsyncStorage.getItem(TIMERS_STORAGE_KEY);
    if (json) {
      return JSON.parse(json);
    }
  } catch {}
  return [];
}

export async function saveActiveTimers(timers: MultiTimerItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(TIMERS_STORAGE_KEY, JSON.stringify(timers));
  } catch {}
}

export async function loadSavedPresets(): Promise<TimerPreset[]> {
  try {
    const json = await AsyncStorage.getItem(PRESETS_STORAGE_KEY);
    if (json) {
      return JSON.parse(json);
    }
  } catch {}
  return DEFAULT_PRESETS;
}

export async function saveCustomPresets(presets: TimerPreset[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {}
}
