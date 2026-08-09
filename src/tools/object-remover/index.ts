import { ToolDefinition } from '../../registry/types';
import { ObjectRemoverTool } from './ObjectRemoverTool';

export const objectRemoverTool: ToolDefinition = {
  id: 'object-remover',
  name: 'Fotoğraftan Nesne Silme',
  description: 'Fotoğraflardaki istenmeyen nesne, insan, yazı veya lekeleri yapay zeka ve doku sentezi ile doğal bir şekilde temizleme',
  icon: 'color-wand-outline',
  categoryId: 'visual',
  route: 'object-remover',
  keywords: [
    'nesne sil',
    'nesne',
    'sil',
    'fotoğraf',
    'fotograf',
    'resim',
    'silme',
    'temizle',
    'inpainting',
    'leke',
    'kaldır',
    'obje',
    'görsel',
    'eraser',
    'object',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Medya Kitaplığı',
      description: 'Fotoğraf seçmek ve temizlenen görseli kaydetmek için medya kitaplığı izni gereklidir.',
    },
  ],
  supportedInputTypes: ['image'],
  component: ObjectRemoverTool,
};

export { ObjectRemoverTool };
export * from './types';
export * from './inpaintingService';
