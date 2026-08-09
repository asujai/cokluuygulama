import { ToolDefinition } from '../../registry/types';
import { BatchFileRenamerTool } from './BatchFileRenamerTool';

export const batchFileRenamerTool: ToolDefinition = {
  id: 'batch-file-renamer',
  name: 'Toplu Yeniden Adlandırıcı',
  description: 'Birden çok dosyanın ismini şablon, numaralandırma veya metin değiştirme ile topluca düzenleyin',
  icon: 'document-text-outline',
  categoryId: 'document',
  route: 'batch-file-renamer',
  keywords: [
    'batch',
    'rename',
    'toplu',
    'yeniden adlandır',
    'dosya',
    'isim',
    'değiştir',
    'numbering',
    'prefix',
    'suffix',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Galeri & Dosyalar',
      description: 'Dosyaları seçmek ve adlandırılmış kopyaları dışa aktarmak için gereklidir.',
    },
  ],
  supportedInputTypes: ['document', 'image', 'any'],
  component: BatchFileRenamerTool,
};

export { BatchFileRenamerTool };
export * from './types';
