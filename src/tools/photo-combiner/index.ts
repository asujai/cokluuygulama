import { ToolDefinition } from '../../registry/types';
import { PhotoCombinerTool } from './PhotoCombinerTool';

export const photoCombinerTool: ToolDefinition = {
  id: 'photo-combiner',
  name: 'Fotoğraf Birleştirici (Stitcher)',
  description: 'Çoklu fotoğrafları dikey veya yatay olarak boşluk, köşe ve renk ayarlarıyla tek bir uzun görselde birleştirin',
  icon: 'images-outline',
  categoryId: 'visual',
  route: 'photo-combiner',
  keywords: [
    'fotoğraf birleştirme',
    'foto birleştir',
    'stitch',
    'stitching',
    'kolaj',
    'collage',
    'uzun görsel',
    'dikey birleştirme',
    'yatay birleştirme',
    'ekran görüntüsü birleştir',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Medya Kitaplığı',
      description: 'Galeriden fotoğrafları seçmek ve birleştirilmiş görseli kaydetmek için izin gereklidir.',
    },
  ],
  supportedInputTypes: ['image'],
  component: PhotoCombinerTool,
};

export { PhotoCombinerTool };
export { combinePhotos, shareOrDownloadCombinedImage } from './combinerService';
