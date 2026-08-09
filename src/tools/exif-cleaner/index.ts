import { ToolDefinition } from '../../registry/types';
import { ExifCleanerTool } from './ExifCleanerTool';

export const exifCleanerTool: ToolDefinition = {
  id: 'exif-cleaner',
  name: 'Fotoğraf EXIF Temizleyici',
  description: 'Fotoğraflardaki GPS konumunu, çekim tarihini ve kamera meta verilerini görüntüleyin ve temizleyin',
  icon: 'shield-checkmark-outline',
  categoryId: 'privacy',
  route: 'exif-cleaner',
  keywords: [
    'exif',
    'foto',
    'fotograf',
    'fotoğraf',
    'gps',
    'konum',
    'gizlilik',
    'metadata',
    'meta',
    'kamera',
    'temizle',
    'sil',
    'guvenlik',
    'güvenlik',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Galeri',
      description: 'Fotoğrafları okumak ve temizlenmiş fotoğrafları kaydetmek için gereklidir.',
    },
  ],
  supportedInputTypes: ['image'],
  component: ExifCleanerTool,
};

export { ExifCleanerTool };
export * from './types';
