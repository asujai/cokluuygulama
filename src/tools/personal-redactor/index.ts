import { ToolDefinition } from '../../registry/types';
import { PersonalRedactorTool } from './PersonalRedactorTool';

export const personalRedactorTool: ToolDefinition = {
  id: 'personal-redactor',
  name: 'Kişisel Veri Maskeleyici (Redactor)',
  description: 'Görsel ve ekran görüntülerindeki T.C., kimlik, telefon ve yüz gibi hassas alanları karartın veya buzlayın',
  icon: 'eye-off-outline',
  categoryId: 'privacy',
  route: 'personal-redactor',
  keywords: [
    'redact',
    'redactor',
    'maskele',
    'karart',
    'buzla',
    'blur',
    'pixelate',
    'gizlilik',
    'kvkk',
    'sansür',
    'sansur',
    'tc',
    'kimlik',
    'ekran görüntüsü',
    'görsel',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Medya Kitaplığı',
      description: 'Galeriden görsel seçmek ve maskelenmiş görseli kaydetmek için izin gereklidir.',
    },
  ],
  supportedInputTypes: ['image', 'camera'],
  component: PersonalRedactorTool,
};

export { PersonalRedactorTool };
export * from './types';
export * from './redactorService';
