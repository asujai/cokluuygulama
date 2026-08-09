import { ToolDefinition } from '../../registry/types';
import { HiitTabataTimerTool } from './HiitTabataTimerTool';

export const hiitTabataTimerTool: ToolDefinition = {
  id: 'hiit-tabata-timer',
  name: 'HIIT & Tabata Sayacı',
  description: 'Yüksek yoğunluklu aralıklı antrenmanlar, Tabata sayaçları, sesli/titreşimli uyarılar ve özel şablonlar',
  icon: 'timer-outline',
  categoryId: 'daily',
  route: 'hiit-tabata-timer',
  keywords: [
    'hiit',
    'tabata',
    'sayac',
    'sayaç',
    'timer',
    'antrenman',
    'kronometre',
    'spor',
    'set',
    'aralık',
    'aralik',
    'interval',
    'fitness',
    'dinlenme',
    'calisma',
    'çalışma',
    'tur',
    'egzersiz',
  ],
  enabled: true,
  requiresPermission: [],
  supportedInputTypes: ['number'],
  component: HiitTabataTimerTool,
};

export { HiitTabataTimerTool };
export * from './types';
