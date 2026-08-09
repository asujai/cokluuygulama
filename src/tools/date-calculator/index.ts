import { ToolDefinition } from '../../registry/types';
import { DateCalculatorTool } from './DateCalculatorTool';

export const dateCalculatorTool: ToolDefinition = {
  id: 'date-calculator',
  name: 'Tarih & Gün Hesaplayıcı',
  description: 'İki tarih arası fark, iş günleri, tarihe gün/hafta ekleme-çıkarma, canlı geri sayım ve detaylı yaş analizi',
  icon: 'calendar-outline',
  categoryId: 'calc',
  route: 'date-calculator',
  keywords: [
    'tarih',
    'gun',
    'gün',
    'hesaplayici',
    'hesaplayıcı',
    'fark',
    'is gunu',
    'iş günü',
    'geri sayim',
    'yas',
    'yaş',
    'burc',
    'burç',
    'dogum gunu',
    'doğum günü',
    'takvim',
  ],
  enabled: true,
  requiresPermission: [],
  supportedInputTypes: ['date'],
  component: DateCalculatorTool,
};

export { DateCalculatorTool };
export * from './types';
