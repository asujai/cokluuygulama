export type RedactMode = 'blur' | 'pixelate' | 'blackout';

export interface RedactRegion {
  id: string;
  x: number; // percentage 0-100 or pixel relative to image dimensions
  y: number;
  width: number;
  height: number;
  mode: RedactMode;
  label?: string;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface RedactorOptions {
  outputQuality?: number;
  format?: 'png' | 'jpeg';
}
