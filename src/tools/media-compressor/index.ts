import { ToolDefinition } from '../../registry/types';
import { MediaCompressorTool } from './MediaCompressorTool';

export const mediaCompressorTool: ToolDefinition = {
  id: 'media-compressor',
  name: 'Video & Fotoğraf Sıkıştırıcı',
  description: 'Görsel ve videoların dosya boyutunu kalite kaybını minimize ederek küçültme ve optimize etme',
  icon: 'contract-outline',
  categoryId: 'conversion',
  route: 'media-compressor',
  keywords: [
    'video',
    'fotoğraf',
    'fotograf',
    'sıkıştır',
    'sikistir',
    'kompres',
    'boyut',
    'küçült',
    'kucult',
    'mb',
    'optimize',
    'media',
    'resim',
    'görsel',
    'gorsel',
    'kalite',
    'alan',
    'depolama',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Medya Kitaplığı',
      description: 'Fotoğraf ve videoları seçmek ve kaydetmek için medya kitaplığı izni gereklidir.',
    },
  ],
  supportedInputTypes: ['image', 'video'],
  component: MediaCompressorTool,
};

export { MediaCompressorTool };
export * from './types';
