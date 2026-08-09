import { ToolDefinition } from '../../registry/types';
import { PdfFormFillerTool } from './PdfFormFillerTool';

export const pdfFormFillerTool: ToolDefinition = {
  id: 'pdf-form-filler',
  name: 'PDF Form Doldurucu',
  description: 'PDF belgelerine metin, onay kutusu ve dijital imza ekleyip yeni PDF olarak dışa aktarın',
  icon: 'create-outline',
  categoryId: 'document',
  route: 'pdf-form-filler',
  keywords: [
    'pdf',
    'form',
    'doldur',
    'imza',
    'signature',
    'metin',
    'onay',
    'checkbox',
    'edit',
    'düzenle',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Galeri & Dosyalar',
      description: 'PDF belgelerini seçmek ve doldurulmuş formları kaydetmek/paylaşmak için gereklidir.',
    },
  ],
  supportedInputTypes: ['pdf', 'document'],
  component: PdfFormFillerTool,
};

export { PdfFormFillerTool };
export * from './types';
