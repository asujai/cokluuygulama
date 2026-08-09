export type GifResolution = '240p' | '360p' | '480p';

export type GifFps = 5 | 10 | 15 | 20;

export interface VideoInfo {
  uri: string;
  name: string;
  duration: number; // in seconds
  width: number;
  height: number;
  size?: number;
}

export interface GifConversionOptions {
  startTime: number;
  endTime: number;
  fps: GifFps;
  resolution: GifResolution;
  speed: number;
  loop: boolean;
}

export interface ConversionProgress {
  phase: 'extracting' | 'encoding' | 'done';
  percent: number;
  currentFrame: number;
  totalFrames: number;
}

export interface GifResult {
  uri: string;
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  duration: number;
  framesCount: number;
}
