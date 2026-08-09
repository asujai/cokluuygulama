export type CardinalDirection = 'K' | 'KD' | 'D' | 'GD' | 'G' | 'GB' | 'B' | 'KB';

export interface CompassData {
  heading: number; // 0 to 359.9 degrees
  trueHeading: number; // Heading with declination offset
  cardinal: CardinalDirection;
  cardinalName: string; // "Kuzey", "Kuzeydoğu", etc.
  rawX: number;
  rawY: number;
  rawZ: number;
  magnitude: number; // in microteslas (µT)
  accuracy: 'low' | 'medium' | 'high';
  isFlat: boolean; // Device is held horizontally level for accurate readings
}

export interface HeadingLock {
  locked: boolean;
  targetHeading: number;
  deviation: number; // Difference from target (-180 to +180)
}

export type CompassSensorStatus = 'active' | 'unavailable' | 'simulated';
