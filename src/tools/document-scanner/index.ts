import { ToolDefinition } from '../../registry/types';
import { DocumentScannerTool } from './DocumentScannerTool';

export const documentScannerTool: ToolDefinition = {
  id: 'document-scanner',
  name: 'Belge & PDF Tarayıcı',
  description: 'Kamera ve galeriden belge tarama, sayfa filtreleme, çok sayfalı PDF oluşturma ve OCR metin tanıma',
  icon: 'scan-outline',
  categoryId: 'document',
  route: 'document-scanner',
  keywords: [
    'pdf',
    'tarayıcı',
    'tarayici',
    'ocr',
    'belge',
    'doküman',
    'dokuman',
    'tara',
    'scanner',
    'scan',
    'metin',
    'fotoğraf',
    'kamera',
    'evrak',
    'çıktı',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'camera',
      name: 'Kamera',
      description: 'Belgeleri fotoğraflamak için kamera izni gereklidir.',
    },
    {
      type: 'media_library',
      name: 'Medya Kitaplığı',
      description: 'Galeriden belge seçmek ve dışa aktarmak için izin gereklidir.',
    },
  ],
  supportedInputTypes: ['image', 'camera'],
  component: DocumentScannerTool,
};

export { DocumentScannerTool };
export * from './types';
