import { ToolDefinition } from '../../registry/types';
import { TextCounterTool } from './TextCounterTool';

export const textCounterTool: ToolDefinition = {
  id: 'text-counter',
  name: 'Metin Sayacı',
  description: 'Karakter, kelime, satır, cümle ve tahmini okuma süresi hesaplayıcı, Türkçe büyük/küçük harf, sıralama ve CSV dönüştürücü',
  icon: 'stats-chart-outline',
  categoryId: 'text',
  route: 'text-counter',
  keywords: [
    'metin',
    'kelime',
    'karakter',
    'sayac',
    'sayacı',
    'cumle',
    'satir',
    'harf',
    'yazi',
    'istatistik',
    'uzunluk',
    'csv',
    'turkce',
    'sirala',
    'ters',
  ],
  enabled: true,
  requiresPermission: [],
  supportedInputTypes: ['text'],
  component: TextCounterTool,
};

export { TextCounterTool };
export * from './textProcessing';
