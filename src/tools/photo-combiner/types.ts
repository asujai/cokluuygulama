export type StitchDirection = 'vertical' | 'horizontal';
export type ImageScalingMode = 'fit' | 'fill' | 'original';

export interface PhotoItem {
  id: string;
  uri: string;
  width: number;
  height: number;
  aspectRatio: number;
  title?: string;
}

export interface CombinerOptions {
  direction: StitchDirection;
  spacing: number; // space between images in px
  padding: number; // outer canvas padding in px
  backgroundColor: string; // hex or transparent
  borderRadius: number; // corner radius of individual images in px
  scalingMode: ImageScalingMode;
  targetMaxDimension?: number; // max canvas dimension limit
}

export interface CombinerResult {
  outputUri: string;
  width: number;
  height: number;
  totalImages: number;
}
