import { ToolDefinition } from '../../registry/types';
import { RandomPickerTool } from './RandomPickerTool';

export const randomPickerTool: ToolDefinition = {
  id: 'random-picker',
  name: 'Rastgele Seçici & Karar Çarkı',
  description: 'Animasyonlu karar çarkı, kura çekici ve takım bölücü, loto sayı üreteci, yazı-tura ve 3D zar atma',
  icon: 'aperture-outline',
  categoryId: 'daily',
  route: 'random-picker',
  keywords: [
    'rastgele',
    'secici',
    'seçici',
    'karar',
    'cark',
    'çark',
    'kura',
    'cekilis',
    'çekiliş',
    'loto',
    'sayi',
    'sayı',
    'yazi tura',
    'yazı tura',
    'zar',
    'random',
    'dice',
  ],
  enabled: true,
  requiresPermission: [],
  supportedInputTypes: ['text', 'number'],
  component: RandomPickerTool,
};

export { RandomPickerTool };
export * from './types';
