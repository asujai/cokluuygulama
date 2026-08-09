import * as Haptics from 'expo-haptics';

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

/**
 * Plays a synthesized tone at a given frequency and duration.
 */
function playTone(freq: number, durationSec: number, type: OscillatorType = 'sine', gainVal: number = 0.3): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + durationSec);
  } catch (err) {
    // Audio synthesis fallback
  }
}

/**
 * Short tick sound for countdowns (3, 2, 1).
 */
export async function playCountdownTick(): Promise<void> {
  playTone(880, 0.12, 'sine', 0.25);
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

/**
 * High-pitch energizing double tone for Work phase start.
 */
export async function playPhaseStartAlert(): Promise<void> {
  playTone(1320, 0.15, 'triangle', 0.4);
  setTimeout(() => {
    playTone(1760, 0.3, 'triangle', 0.5);
  }, 160);

  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

/**
 * Mellow double tone for Rest phase start.
 */
export async function playRestAlert(): Promise<void> {
  playTone(660, 0.2, 'sine', 0.35);
  setTimeout(() => {
    playTone(520, 0.25, 'sine', 0.35);
  }, 220);

  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
}

/**
 * Celebratory fanfare tone on workout completion.
 */
export async function playWorkoutCompleteFanfare(): Promise<void> {
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  notes.forEach((freq, index) => {
    setTimeout(() => {
      playTone(freq, index === notes.length - 1 ? 0.6 : 0.2, 'triangle', 0.45);
    }, index * 180);
  });

  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}
