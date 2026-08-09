import * as Haptics from 'expo-haptics';
import { WheelPreset, DiceType } from './types';

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

export function playWheelTickSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch {}
}

export function playCoinFlipSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {}
}

export function playDiceRollSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [300, 420, 350, 500];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.06);
      }, i * 60);
    });
  } catch {}
}

export function playCelebrationFanfare(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }, i * 120);
    });
  } catch {}
}

export async function triggerLightHaptic(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

export async function triggerMediumHaptic(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
}

export async function triggerSuccessHaptic(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

// Wheel Presets
export const WHEEL_PRESETS: WheelPreset[] = [
  {
    id: 'yes-no-maybe',
    title: 'Evet / Hayır / Belki',
    slices: [
      { label: 'Evet! ✅', color: '#10B981' },
      { label: 'Hayır! ❌', color: '#EF4444' },
      { label: 'Belki... 🤔', color: '#F59E0B' },
      { label: 'Kesinlikle! 🌟', color: '#06B6D4' },
      { label: 'Asla! ⛔', color: '#8B5CF6' },
      { label: 'Yarın Tekrar Dene ⏳', color: '#EC4899' },
    ],
  },
  {
    id: 'food',
    title: 'Ne Yesek? 🍕',
    slices: [
      { label: 'Pizza 🍕', color: '#EF4444' },
      { label: 'Burger 🍔', color: '#F59E0B' },
      { label: 'Kebap / Döner 🥙', color: '#EA580C' },
      { label: 'Ev Yemeği 🍲', color: '#10B981' },
      { label: 'Makarna 🍝', color: '#06B6D4' },
      { label: 'Salata 🥗', color: '#84CC16' },
      { label: 'Sushi 🍣', color: '#EC4899' },
      { label: 'Tavuk Dünyası 🍗', color: '#8B5CF6' },
    ],
  },
  {
    id: 'activity',
    title: 'Hafta Sonu Aktivitesi 🎯',
    slices: [
      { label: 'Film / Dizi İzle 🎬', color: '#6366F1' },
      { label: 'Doğa Yürüyüşü 🌲', color: '#10B981' },
      { label: 'Kitap Oku 📖', color: '#D97706' },
      { label: 'Oyun Oyna 🎮', color: '#EC4899' },
      { label: 'Arkadaşlarla Buluş ☕', color: '#06B6D4' },
      { label: 'Yeni Tarif Dene 🍳', color: '#EF4444' },
    ],
  },
  {
    id: 'turn',
    title: 'Kimin Sırası? 🎲',
    slices: [
      { label: 'Ben 🙋‍♂️', color: '#10B981' },
      { label: 'Sen 👉', color: '#6366F1' },
      { label: 'O 👤', color: '#F59E0B' },
      { label: 'Herkes Birlikte! 🤝', color: '#EC4899' },
    ],
  },
];

/**
 * Generates random numbers with constraints
 */
export function generateRandomNumbers(
  min: number,
  max: number,
  count: number,
  unique = true,
  sorted = true
): number[] {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  const range = high - low + 1;

  const actualCount = unique ? Math.min(count, range) : count;
  const results: number[] = [];

  if (unique) {
    const pool = Array.from({ length: range }, (_, i) => low + i);
    for (let i = 0; i < actualCount; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      results.push(pool[idx]);
      pool.splice(idx, 1);
    }
  } else {
    for (let i = 0; i < actualCount; i++) {
      const val = Math.floor(Math.random() * range) + low;
      results.push(val);
    }
  }

  if (sorted) {
    results.sort((a, b) => a - b);
  }

  return results;
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Splits items into N balanced teams / groups
 */
export function divideIntoTeams(items: string[], numTeams: number): { teamNumber: number; members: string[] }[] {
  const shuffled = shuffleArray(items.filter((i) => i.trim().length > 0));
  const teams: { teamNumber: number; members: string[] }[] = Array.from(
    { length: Math.max(1, numTeams) },
    (_, i) => ({ teamNumber: i + 1, members: [] })
  );

  shuffled.forEach((item, index) => {
    teams[index % numTeams].members.push(item);
  });

  return teams;
}

/**
 * Rolls dice of any standard polyhedral size
 */
export function rollDice(type: DiceType, count: number): number[] {
  let sides = 6;
  switch (type) {
    case 'd4': sides = 4; break;
    case 'd6': sides = 6; break;
    case 'd8': sides = 8; break;
    case 'd10': sides = 10; break;
    case 'd12': sides = 12; break;
    case 'd20': sides = 20; break;
    case 'd100': sides = 100; break;
  }

  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(Math.random() * sides) + 1);
  }
  return results;
}
