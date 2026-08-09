export type MediaType = 'image' | 'video';

export type CompressionLevel = 'light' | 'medium' | 'strong';

export type VideoResolution = 'original' | '1080p' | '720p' | '480p';

export interface MediaItem {
  uri: string;
  name: string;
  type: MediaType;
  originalSize: number; // in bytes
  width?: number;
  height?: number;
  duration?: number; // in seconds
  mimeType?: string;
}

export interface CompressionResult {
  compressedUri: string;
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  savedPercentage: number;
  width?: number;
  height?: number;
  duration?: number;
}

export interface CompressionLevelOption {
  id: CompressionLevel;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  quality: number;
  scale: number;
}

export interface ResolutionOption {
  id: VideoResolution;
  label: string;
  maxWidth: number;
  maxHeight: number;
}
