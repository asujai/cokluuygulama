export type ExportAudioFormat = 'wav' | 'mp3' | 'm4a';

export type RingtonePresetType = 'ringtone' | 'alarm' | 'notification' | 'custom';

export interface AudioMetadata {
  name: string;
  duration: number; // in seconds
  sampleRate: number;
  channels: number;
  size: number; // in bytes
  mimeType?: string;
}

export interface TrimConfig {
  startTime: number; // seconds
  endTime: number; // seconds
  fadeInSec: number; // 0 - 5 sec
  fadeOutSec: number; // 0 - 5 sec
  gain: number; // 0.5 - 2.0 (50% - 200%)
  format: ExportAudioFormat;
  preset: RingtonePresetType;
}

export interface SampleAudioItem {
  id: string;
  name: string;
  subtitle: string;
  durationSec: number;
  presetType: RingtonePresetType;
}

export interface ProcessedAudioResult {
  uri: string;
  fileName: string;
  fileSizeBytes: number;
  durationSec: number;
  format: ExportAudioFormat;
  presetType: RingtonePresetType;
}
