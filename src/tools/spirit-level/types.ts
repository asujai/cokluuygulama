export type AngleUnit = 'deg' | 'percent' | 'roofPitch' | 'mmPerMeter';

export interface SpiritLevelData {
  pitch: number; // Y-axis tilt in degrees (-90 to +90)
  roll: number;  // X-axis tilt in degrees (-90 to +90)
  incline: number; // Total absolute inclination in degrees (0 to 90)
  isLevel: boolean; // True if within tolerance (e.g. <= 0.4°)
  rawX: number;
  rawY: number;
  rawZ: number;
}

export interface LevelCalibration {
  pitchOffset: number;
  rollOffset: number;
  isCalibrated: boolean;
}

export type SensorStatus = 'active' | 'unavailable' | 'simulated';
