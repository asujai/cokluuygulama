import { ToolDefinition } from '../../registry/types';
import { BusinessCardContactsTool } from './BusinessCardContactsTool';

export const businessCardContactsTool: ToolDefinition = {
  id: 'business-card-contacts',
  name: 'Kartvizit & Rehber Okuyucu',
  description: 'Kartvizit fotoğraflarından OCR ile isim, telefon, e-posta ve şirket bilgilerini çıkarın, doğrudan rehberinize kaydet veya vCard olarak aktarın',
  icon: 'card-outline',
  categoryId: 'daily',
  route: 'business-card-contacts',
  keywords: [
    'kartvizit',
    'kartvizit okuyucu',
    'rehber',
    'kişiler',
    'vcard',
    'vcf',
    'ocr',
    'telefon kaydet',
    'business card',
    'kontakt',
    'contact',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Medya Kitaplığı',
      description: 'Kartvizit fotoğrafı seçmek için izin gereklidir.',
    },
    {
      type: 'camera',
      name: 'Kamera',
      description: 'Kartvizit çekimi yapmak için kamera izni gereklidir.',
    },
  ],
  supportedInputTypes: ['image', 'camera'],
  component: BusinessCardContactsTool,
};

export { BusinessCardContactsTool };
export * from './types';
export * from './cardOcrService';
export * from './vcardService';
