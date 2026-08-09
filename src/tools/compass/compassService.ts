import { Magnetometer, Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { CompassData, CardinalDirection, HeadingLock } from './types';

/**
 * Resolves degrees (0-360) to Turkish cardinal direction abbreviation and full name.
 */
export function getCardinalDirection(deg: number): {
  cardinal: CardinalDirection;
  name: string;
} {
  const normalized = (deg % 360 + 360) % 360;

  if (normalized >= 337.5 || normalized < 22.5) {
    return { cardinal: 'K', name: 'Kuzey' };
  } else if (normalized >= 22.5 && normalized < 67.5) {
    return { cardinal: 'KD', name: 'Kuzeydoğu' };
  } else if (normalized >= 67.5 && normalized < 112.5) {
    return { cardinal: 'D', name: 'Doğu' };
  } else if (normalized >= 112.5 && normalized < 157.5) {
    return { cardinal: 'GD', name: 'Güneydoğu' };
  } else if (normalized >= 157.5 && normalized < 202.5) {
    return { cardinal: 'G', name: 'Güney' };
  } else if (normalized >= 202.5 && normalized < 247.5) {
    return { cardinal: 'GB', name: 'Güneybatı' };
  } else if (normalized >= 247.5 && normalized < 292.5) {
    return { cardinal: 'B', name: 'Batı' };
  } else {
    return { cardinal: 'KB', name: 'Kuzeybatı' };
  }
}

/**
 * Calculates raw magnetic heading in degrees (0-360) from X, Y magnetometer readings.
 */
export function calculateHeading(x: number, y: number): number {
  let angle = Math.atan2(-x, -y) * (180 / Math.PI);
  if (angle < 0) {
    angle += 360;
  }
  return angle;
}

/**
 * Smooths circular angles (0-360) using unit vector decomposition (sin/cos).
 */
export function smoothAngle(prevAngle: number, newAngle: number, alpha = 0.2): number {
  const prevRad = (prevAngle * Math.PI) / 180;
  const newRad = (newAngle * Math.PI) / 180;

  const sinSum = (1 - alpha) * Math.sin(prevRad) + alpha * Math.sin(newRad);
  const cosSum = (1 - alpha) * Math.cos(prevRad) + alpha * Math.cos(newRad);

  let smoothed = Math.atan2(sinSum, cosSum) * (180 / Math.PI);
  if (smoothed < 0) smoothed += 360;
  return smoothed;
}

/**
 * Computes shortest angular deviation between two headings in range [-180, +180].
 */
export function calculateDeviation(current: number, target: number): number {
  const diff = (current - target + 540) % 360 - 180;
  return diff;
}

/**
 * Estimates magnetic field accuracy based on typical Earth field strength (30 - 65 µT).
 */
export function estimateAccuracy(magnitude: number): 'low' | 'medium' | 'high' {
  if (magnitude < 20 || magnitude > 80) return 'low';
  if (magnitude >= 30 && magnitude <= 65) return 'high';
  return 'medium';
}

export async function triggerCompassHaptic(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

export async function triggerTargetAlignedHaptic(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}
