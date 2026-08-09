import { ToolDefinition } from '../../registry/types';
import { IdPhotoMakerTool } from './IdPhotoMakerTool';

export const idPhotoMakerTool: ToolDefinition = {
  id: 'id-photo-maker',
  name: 'Vesikalık & Biyometrik Fotoğraf',
  description: 'Biyometrik ve vesikalık fotoğraf hazırlama, arka plan temizleme ve 10x15 baskı şablonu (PNG/PDF)',
  icon: 'person-outline',
  categoryId: 'visual',
  route: 'id-photo-maker',
  keywords: [
    'vesikalık',
    'vesikalik',
    'biyometrik',
    'biometric',
    'pasaport',
    'ehliyet',
    'vize',
    'baskı',
    'baski',
    'fotoğraf',
    'arka plan',
    'vesika',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Medya Kitaplığı',
      description: 'Fotoğraf seçmek ve baskı şablonunu kaydetmek için izin gereklidir.',
    },
    {
      type: 'camera',
      name: 'Kamera',
      description: 'Anlık vesikalık çekim yapmak için kamera izni gereklidir.',
    },
  ],
  supportedInputTypes: ['image', 'camera'],
  component: IdPhotoMakerTool,
};

export { IdPhotoMakerTool };
export * from './types';
export * from './idPhotoService';
