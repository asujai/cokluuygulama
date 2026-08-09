import { ToolDefinition } from '../../registry/types';
import { ZipManagerTool } from './ZipManagerTool';

export const zipManagerTool: ToolDefinition = {
  id: 'zip-manager',
  name: 'ZIP Arşiv Yöneticisi',
  description: 'Çoklu dosyaları cihaz içinde güvenle ZIP arşivine sıkıştırın veya mevcut ZIP dosyalarını açıp çıkartın',
  icon: 'archive-outline',
  categoryId: 'document',
  route: 'zip-manager',
  keywords: [
    'zip',
    'arsiv',
    'arşiv',
    'sikistir',
    'sıkıştır',
    'ac',
    'aç',
    'cikar',
    'çıkar',
    'compress',
    'unzip',
    'rar',
    'dosya',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Dosyalar & Galeri',
      description: 'Arşive eklenecek veya arşivden çıkartılacak dosyaları yönetmek için gereklidir.',
    },
  ],
  supportedInputTypes: ['file', 'document', 'image'],
  component: ZipManagerTool,
};

export { ZipManagerTool };
export * from './types';
