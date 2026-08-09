import { ToolDefinition } from '../../registry/types';
import { ContactsBackupTool } from './ContactsBackupTool';

export const contactsBackupTool: ToolDefinition = {
  id: 'contacts-backup',
  name: 'Kişi Rehberi Yedekleme (VCF)',
  description: 'Rehber kişilerini VCF (vCard) formatında yedekleyin, VCF dosyalarını önizleyin ve kullanıcı onayı ile rehbere aktarın',
  icon: 'people-circle-outline',
  categoryId: 'privacy',
  route: 'contacts-backup',
  keywords: [
    'kisi',
    'rehber',
    'vcf',
    'vcard',
    'yedek',
    'yedekleme',
    'contact',
    'contacts',
    'backup',
    'export',
    'import',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'contacts',
      name: 'Rehber',
      description: 'Cihaz kişilerini yedeklemek ve VCF dosyalarını rehbere aktarmak için rehber izni gereklidir.',
    },
  ],
  supportedInputTypes: ['document'],
  component: ContactsBackupTool,
};

export { ContactsBackupTool };
export * from './types';
