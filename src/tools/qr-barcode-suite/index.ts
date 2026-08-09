import { ToolDefinition } from '../../registry/types';
import { QrBarcodeSuiteTool } from './QrBarcodeSuiteTool';

export const qrBarcodeSuiteTool: ToolDefinition = {
  id: 'qr-barcode-suite',
  name: 'QR & Barkod Araçları',
  description: 'Gelişmiş QR kod oluşturucu, renk özelleştirme ve kamera/galeri barkod okuyucu',
  icon: 'qr-code-outline',
  categoryId: 'daily',
  route: 'qr-barcode-suite',
  keywords: [
    'qr',
    'barkod',
    'barcode',
    'karekod',
    'tara',
    'okuyucu',
    'uretici',
    'üretici',
    'wifi',
    'scanner',
    'generator',
    'baglanti',
    'link',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'camera',
      name: 'Kamera',
      description: 'QR kod ve barkodları doğrudan kamerayla okumak için gereklidir.',
    },
    {
      type: 'media_library',
      name: 'Galeri',
      description: 'Kayıtlı fotoğraflardaki kodları okumak veya oluşturulan QR kodları kaydetmek için gereklidir.',
    },
  ],
  supportedInputTypes: ['camera', 'image', 'text'],
  component: QrBarcodeSuiteTool,
};

export { QrBarcodeSuiteTool };
export * from './types';
