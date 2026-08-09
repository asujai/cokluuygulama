import { ToolDefinition } from '../../registry/types';
import { SoundMixerTool } from './SoundMixerTool';

export const soundMixerTool: ToolDefinition = {
  id: 'sound-mixer',
  name: 'Doğa & Uyku Sesi Mikseri',
  description:
    '12 farklı doğa, ortam ve gürültü sesini eşzamanlı karıştırın, uyku zamanlayıcısı ile rahatlayın',
  icon: 'musical-notes-outline',
  categoryId: 'daily',
  route: 'sound-mixer',
  keywords: [
    'uyku',
    'doğa sesi',
    'doga sesi',
    'yağmur',
    'yagmur',
    'şömine',
    'somine',
    'dalga',
    'beyaz gürültü',
    'pembe gürültü',
    'kahverengi gürültü',
    'white noise',
    'pink noise',
    'brown noise',
    'zamanlayıcı',
    'rahatlama',
    'meditasyon',
    'odaklanma',
    'çalışma sesi',
    'calisma sesi',
    'sound mixer',
  ],
  enabled: true,
  requiresPermission: [],
  supportedInputTypes: ['audio'],
  component: SoundMixerTool,
};

export { SoundMixerTool };
export * from './types';
export * from './soundSynthesizer';
export * from './mixerStorage';
