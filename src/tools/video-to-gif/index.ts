import { ToolDefinition } from '../../registry/types';
import { VideoToGifTool } from './VideoToGifTool';

export const videoToGifTool: ToolDefinition = {
  id: 'video-to-gif',
  name: 'Video - GIF Dönüştürücü',
  description: 'Videoları kırpın, çözünürlük ve kare hızını belirleyerek yüksek kaliteli animasyonlu GIF üretin',
  icon: 'film-outline',
  categoryId: 'conversion',
  route: 'video-to-gif',
  keywords: [
    'video',
    'gif',
    'donusturucu',
    'dönüştürücü',
    'animasyon',
    'kirp',
    'kırp',
    'fps',
    'hareketli',
    'resim',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Galeri',
      description: 'Videoları seçmek ve oluşturulan GIF animasyonlarını kaydetmek için gereklidir.',
    },
  ],
  supportedInputTypes: ['video'],
  component: VideoToGifTool,
};

export { VideoToGifTool };
export * from './types';
