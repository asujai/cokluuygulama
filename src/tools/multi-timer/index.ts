import { ToolDefinition } from '../../registry/types';
import { MultiTimerTool } from './MultiTimerTool';

export const multiTimerTool: ToolDefinition = {
  id: 'multi-timer',
  name: 'Kronometre & Çoklu Sayaç',
  description: 'Hassas tur kayıtlı kronometre, eşzamanlı bağımsız geri sayım sayaçları ve sesli/titreşimli uyarılar',
  icon: 'stopwatch-outline',
  categoryId: 'daily',
  route: 'multi-timer',
  keywords: [
    'kronometre',
    'sayac',
    'sayaç',
    'timer',
    'stopwatch',
    'tur',
    'lap',
    'geri sayim',
    'alarm',
    'dakika',
    'saniye',
    'cay',
    'yumurta',
    'firin',
  ],
  enabled: true,
  requiresPermission: [],
  supportedInputTypes: ['number'],
  component: MultiTimerTool,
};

export { MultiTimerTool };
export * from './types';
