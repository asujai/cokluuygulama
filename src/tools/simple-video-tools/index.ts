import { ToolDefinition } from '../../registry/types';
import { SimpleVideoToolsTool } from './SimpleVideoToolsTool';

export const simpleVideoToolsTool: ToolDefinition = {
  id: 'simple-video-tools',
  name: 'Basit Video Düzenleyici',
  description: 'Videoları kırpın, en-boy oranını ayarlayın, 90°/180°/270° döndürün, sesi kısın ve sesi ayıklayın',
  icon: 'videocam-outline',
  categoryId: 'conversion',
  route: 'simple-video-tools',
  keywords: [
    'video',
    'kirp',
    'kırp',
    'dondur',
    'döndür',
    'crop',
    'rotate',
    'trim',
    'ses ayikla',
    'mute',
    'video edit',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Medya Kitaplığı',
      description: 'Videoları seçmek ve düzenlenmiş videoları kaydetmek için gereklidir.',
    },
  ],
  supportedInputTypes: ['video'],
  component: SimpleVideoToolsTool,
};

export { SimpleVideoToolsTool };
export * from './types';
