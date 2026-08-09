import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { SpiritLevelData, LevelCalibration, AngleUnit } from './types';

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

export function playLevelBeep(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // High C (C6)

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

export async function triggerLevelHaptic(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

export async function triggerSoftHaptic(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

/**
 * Calculates smoothed pitch, roll and incline from accelerometer readings with calibration.
 */
export function processAccelerometerData(
  x: number,
  y: number,
  z: number,
  calibration: LevelCalibration,
  tolerance = 0.4
): SpiritLevelData {
  // Clamp values
  const clampedX = Math.max(-1, Math.min(1, x));
  const clampedY = Math.max(-1, Math.min(1, y));
  const clampedZ = Math.max(-1, Math.min(1, z));

  // Compute angles in degrees
  // Pitch: tilt forward/backward (Y-axis)
  // Roll: tilt left/right (X-axis)
  let rawPitch = Math.atan2(clampedY, Math.sqrt(clampedX * clampedX + clampedZ * clampedZ)) * (180 / Math.PI);
  let rawRoll = Math.atan2(-clampedX, Math.sqrt(clampedY * clampedY + clampedZ * clampedZ)) * (180 / Math.PI);

  // Apply calibration tare offset
  let pitch = rawPitch - calibration.pitchOffset;
  let roll = rawRoll - calibration.rollOffset;

  // Incline: total angle deviation from level surface
  const incline = Math.sqrt(pitch * pitch + roll * roll);
  const isLevel = incline <= tolerance;

  return {
    pitch,
    roll,
    incline,
    isLevel,
    rawX: x,
    rawY: y,
    rawZ: z,
  };
}

/**
 * Formats angle into the selected display unit
 */
export function formatAngle(deg: number, unit: AngleUnit): string {
  const absDeg = Math.abs(deg);
  switch (unit) {
    case 'deg':
      return `${deg >= 0 ? '+' : '-'}${absDeg.toFixed(1)}°`;
    case 'percent': {
      const rad = (absDeg * Math.PI) / 180;
      const pct = Math.tan(rad) * 100;
      return `${pct > 999 ? '>999' : pct.toFixed(1)}%`;
    }
    case 'roofPitch': {
      const rad = (absDeg * Math.PI) / 180;
      const riseIn12 = Math.tan(rad) * 12;
      return `${riseIn12.toFixed(1)}:12`;
    }
    case 'mmPerMeter': {
      const rad = (absDeg * Math.PI) / 180;
      const mm = Math.tan(rad) * 1000;
      return `${mm > 9999 ? '>9999' : mm.toFixed(1)} mm/m`;
    }
  }
}
