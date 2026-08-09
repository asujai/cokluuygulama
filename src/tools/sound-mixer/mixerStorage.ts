import AsyncStorage from '@react-native-async-storage/async-storage';
import { SoundMixPreset } from './types';

const CUSTOM_MIXES_STORAGE_KEY = '@gundelik_sound_mixer_custom_presets_v1';

export const DEFAULT_PRESETS: SoundMixPreset[] = [
  {
    id: 'deep_sleep',
    name: 'Derin Uyku',
    description: 'Kesintisiz, derin bir uyku için pembe gürültü ve yağmur dalgaları',
    icon: 'bed-outline',
    volumes: {
      pink_noise: 0.55,
      rain: 0.45,
      waves: 0.35,
    },
  },
  {
    id: 'rainforest',
    name: 'Yağmurlu Orman',
    description: 'Yeşil ormanın içinde huzurlu yağmur, akarsu ve uzak gök gürültüsü',
    icon: 'rainy-outline',
    volumes: {
      rain: 0.6,
      forest: 0.5,
      stream: 0.4,
      thunder: 0.25,
    },
  },
  {
    id: 'cozy_fireplace',
    name: 'Şömine Başı',
    description: 'Dışarıda rüzgar eserken çıtırdayan şöminenin sıcak huzuru',
    icon: 'flame-outline',
    volumes: {
      fireplace: 0.65,
      wind: 0.3,
      crickets: 0.2,
    },
  },
  {
    id: 'cafe_focus',
    name: 'Kafe & Odaklanma',
    description: 'Çalışma ve okuma seansları için kafe canlılığı ve derin kahverengi gürültü',
    icon: 'cafe-outline',
    volumes: {
      cafe: 0.5,
      brown_noise: 0.45,
      rain: 0.25,
    },
  },
];

export async function getCustomMixes(): Promise<SoundMixPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_MIXES_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (error) {
    console.warn('Error loading custom sound mixes:', error);
  }
  return [];
}

export async function saveCustomMix(preset: SoundMixPreset): Promise<SoundMixPreset[]> {
  try {
    const current = await getCustomMixes();
    const filtered = current.filter((p) => p.id !== preset.id);
    const updated = [preset, ...filtered];
    await AsyncStorage.setItem(CUSTOM_MIXES_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.warn('Error saving custom sound mix:', error);
    return [];
  }
}

export async function deleteCustomMix(id: string): Promise<SoundMixPreset[]> {
  try {
    const current = await getCustomMixes();
    const updated = current.filter((p) => p.id !== id);
    await AsyncStorage.setItem(CUSTOM_MIXES_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.warn('Error deleting custom sound mix:', error);
    return [];
  }
}
