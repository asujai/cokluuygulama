import { ToolDefinition } from '../../registry/types';
import { PdfToolboxTool } from './PdfToolboxTool';

export const pdfToolboxTool: ToolDefinition = {
  id: 'pdf-toolbox',
  name: 'PDF Araç Kutusu',
  description: 'PDF birleştirme, sayfa silme/ayıklama, döndürme, fotoğraflardan PDF, filigran ve imza ekleme',
  icon: 'document-text-outline',
  categoryId: 'document',
  route: 'pdf-toolbox',
  keywords: [
    'pdf',
    'birlestir',
    'birleştir',
    'bol',
    'böl',
    'ayikla',
    'ayıkla',
    'dondur',
    'döndür',
    'filigran',
    'watermark',
    'imza',
    'signature',
    'gorsel',
    'görsel',
    'donustur',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Galeri & Dosyalar',
      description: 'PDF belgelerini ve görselleri seçmek ve kaydetmek için gereklidir.',
    },
  ],
  supportedInputTypes: ['pdf', 'image', 'document'],
  component: PdfToolboxTool,
};

export { PdfToolboxTool };
export * from './types';
