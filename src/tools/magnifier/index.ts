import { ToolDefinition } from '../../registry/types';
import { MagnifierTool } from './MagnifierTool';

export const magnifierTool: ToolDefinition = {
  id: 'magnifier',
  name: 'Büyüteç',
  description: 'Canlı kamera büyüteci, zoom kaydırıcısı, flaş kontrolü ve kare dondurma',
  icon: 'search-outline',
  categoryId: 'daily',
  route: 'magnifier',
  keywords: [
    'büyüteç',
    'buyutec',
    'magnifier',
    'zoom',
    'kamera',
    'flaş',
    'flas',
    'dondur',
    'incele',
    'okuma',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'camera',
      name: 'Kamera',
      description: 'Büyüteç özelliğini kullanabilmek için kamera izni gereklidir.',
      required: true,
    },
  ],
  supportedInputTypes: ['camera'],
  component: MagnifierTool,
};

export { MagnifierTool };
export * from './types';
export * from './magnifierService';
