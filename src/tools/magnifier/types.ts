export interface MagnifierState {
  zoom: number; // 0.0 to 1.0 for CameraView
  isTorchOn: boolean;
  isFrozen: boolean;
  facing: 'back' | 'front';
  frozenImageUri: string | null;
}

export type ZoomPreset = 1 | 2 | 4 | 8 | 10;
