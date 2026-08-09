import { ToolDefinition } from '../../registry/types';
import { ContactCleanerTool } from './ContactCleanerTool';

export const contactCleanerTool: ToolDefinition = {
  id: 'contact-cleaner',
  name: 'Kişi Temizleyici',
  description: 'Rehberdeki mükerrer telefon, e-posta, isim kayıtlarını ve eksik kişileri tespit edip birleştirme veya silme',
  icon: 'people-outline',
  categoryId: 'privacy',
  route: 'contact-cleaner',
  keywords: [
    'kisi',
    'rehber',
    'temizleyici',
    'duplicate',
    'mukerrer',
    'rehber temizleme',
    'contact',
    'contacts',
    'telefon',
    'birleştirme',
    'silme',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'contacts',
      name: 'contacts',
      description: 'Rehberdeki mükerrer kişileri taramak ve temizlemek için rehber erişimi gereklidir.',
    },
  ],
  supportedInputTypes: [],
  component: ContactCleanerTool,
};
export { ContactCleanerTool };
