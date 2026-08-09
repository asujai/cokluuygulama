export type SoundTrackId =
  | 'rain'
  | 'fireplace'
  | 'waves'
  | 'forest'
  | 'wind'
  | 'thunder'
  | 'cafe'
  | 'white_noise'
  | 'pink_noise'
  | 'brown_noise'
  | 'crickets'
  | 'stream';

export type SoundCategory = 'nature' | 'noise' | 'urban';

export interface SoundTrackDefinition {
  id: SoundTrackId;
  name: string;
  subtitle: string;
  icon: string;
  color: string;
  category: SoundCategory;
}

export interface SoundMixPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  volumes: Partial<Record<SoundTrackId, number>>;
  isCustom?: boolean;
  createdAt?: number;
}
