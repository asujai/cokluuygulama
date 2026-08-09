export type BackgroundFillMode = 'transparent' | 'white' | 'solid';

export interface BackgroundRemoverOptions {
  fillMode: BackgroundFillMode;
  solidColor: string; // Hex color e.g. '#FFFFFF', '#000000', '#3B82F6'
  tolerance: number; // 0-100 threshold for color distance matching
  feather: number; // 0-10 edge smoothing radius
  sampleKeyColor?: string; // Hex color sampled for chroma key removal
  preserveSubjectSkin?: boolean; // Heuristic to protect skin tones from removal
}

export interface SegmentationResult {
  outputUri: string;
  width: number;
  height: number;
  removedPixelsPercentage: number;
}
