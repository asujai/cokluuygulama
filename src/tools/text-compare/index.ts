import { ToolDefinition } from '../../registry/types';
import { TextCompareTool } from './TextCompareTool';

export const textCompareTool: ToolDefinition = {
  id: 'text-compare',
  name: 'Metin Karşılaştırma',
  description: 'İki metin veya belge arasındaki satır ve kelime farklarını görselleştirme',
  icon: 'git-compare-outline',
  categoryId: 'daily',
  route: 'text-compare',
  keywords: [
    'metin',
    'karşılaştırma',
    'karsilastirma',
    'diff',
    'compare',
    'fark',
    'farklar',
    'metin karşılaştır',
    'satır',
    'kelime',
    'benzerlik',
  ],
  enabled: true,
  requiresPermission: [],
  supportedInputTypes: ['text', 'file'],
  component: TextCompareTool,
};

export { TextCompareTool };
export * from './types';
export * from './diffService';
