import { ToolDefinition } from '../../registry/types';
import { BackgroundRemoverTool } from './BackgroundRemoverTool';

export const backgroundRemoverTool: ToolDefinition = {
  id: 'background-remover',
  name: 'Arka Plan Silici',
  description: 'Görsellerden yerel renk ve kenar ayrıştırma ile arka planı kaldırın veya değiştirin',
  icon: 'color-wand-outline',
  categoryId: 'visual',
  route: 'background-remover',
  keywords: [
    'background',
    'remover',
    'arka plan',
    'sil',
    'temizle',
    'png',
    'transparent',
    'şeffaf',
    'görsel',
    'resim',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Galeri & Dosyalar',
      description: 'Fotoğrafları seçmek ve düzenlenmiş görselleri kaydetmek/paylaşmak için gereklidir.',
    },
  ],
  supportedInputTypes: ['image'],
  component: BackgroundRemoverTool,
};

export { BackgroundRemoverTool };
export * from './types';
