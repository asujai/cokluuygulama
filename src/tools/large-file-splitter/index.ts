import { ToolDefinition } from '../../registry/types';
import { LargeFileSplitterTool } from './LargeFileSplitterTool';

export const largeFileSplitterTool: ToolDefinition = {
  id: 'large-file-splitter',
  name: 'Büyük Dosya Bölücü',
  description: 'Büyük dosyaları seçtiğiniz boyut veya parça sayısına göre bölün ve birleştirin',
  icon: 'cut-outline',
  categoryId: 'productivity',
  route: 'large-file-splitter',
  keywords: [
    'splitter',
    'böl',
    'bölücü',
    'birleştir',
    'large file',
    'part',
    'chunk',
    'sha256',
    'checksum',
    'merge',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Galeri & Dosyalar',
      description: 'Bölünecek dosyaları seçmek ve parçaları kaydetmek için gereklidir.',
    },
  ],
  supportedInputTypes: ['document', 'any'],
  component: LargeFileSplitterTool,
};

export { LargeFileSplitterTool };
export * from './types';
