export type AspectRatioOption = 'original' | '1:1' | '16:9' | '9:16' | '4:3';
export type RotationOption = 0 | 90 | 180 | 270;

export interface VideoMetadata {
  uri: string;
  name: string;
  size?: number;
  duration: number; // in seconds
  width: number;
  height: number;
  file?: File | Blob;
}

export interface VideoEditOptions {
  trimStart: number; // in seconds
  trimEnd: number; // in seconds
  cropAspect: AspectRatioOption;
  rotation: RotationOption;
  muteAudio: boolean;
}

export interface ProcessResult {
  uri: string;
  name: string;
  type: 'video' | 'audio';
  mimeType: string;
  size?: number;
  duration?: number;
}

export interface PlatformCapabilities {
  isWeb: boolean;
  canReencodeVideo: boolean;
  canExtractAudio: boolean;
  canShare: boolean;
  note: string;
}
