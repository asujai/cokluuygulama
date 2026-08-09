import { ToolDefinition } from '../../registry/types';
import { DuplicatePhotoCleanerTool } from './DuplicatePhotoCleanerTool';

export const duplicatePhotoCleanerTool: ToolDefinition = {
  id: 'duplicate-photo-cleaner',
  name: 'Benzer & Kopya Fotoğraf Temizleyici',
  description:
    'Cihazdaki birebir kopya ve benzer fotoğrafları, seri çekimleri ve gereksiz ekran görüntülerini algoritmik olarak temizleyin',
  icon: 'images-outline',
  categoryId: 'visual',
  route: 'duplicate-photo-cleaner',
  keywords: [
    'kopya',
    'benzer',
    'fotoğraf',
    'fotograf',
    'temizle',
    'temizleyici',
    'galeri',
    'depolama',
    'yer aç',
    'yer ac',
    'hafıza',
    'hafiza',
    'screenshot',
    'ekran görüntüsü',
    'ekran goruntusu',
    'seri çekim',
    'burst',
    'duplicate',
    'photo cleaner',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Medya Kitaplığı',
      description: 'Galerideki kopya ve benzer fotoğrafları tarayabilmek için izin gereklidir.',
    },
  ],
  supportedInputTypes: ['image', 'media_library'],
  component: DuplicatePhotoCleanerTool,
};

export { DuplicatePhotoCleanerTool };
export * from './types';
export * from './hasher';
export * from './photoScanner';
