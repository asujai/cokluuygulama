import { ToolDefinition } from '../../registry/types';
import { FileHashTool } from './FileHashTool';

export const fileHashTool: ToolDefinition = {
  id: 'file-hash',
  name: 'Dosya & Metin Özet (Hash)',
  description: 'Metin ve dosyaların SHA-256, SHA-1, MD5, SHA-512 özeti (checksum) hesaplama ve beklenilen hash ile doğrulama',
  icon: 'finger-print-outline',
  categoryId: 'privacy',
  route: 'file-hash',
  keywords: [
    'hash',
    'sha256',
    'sha1',
    'md5',
    'sha512',
    'checksum',
    'ozet',
    'doğrulama',
    'dosya',
    'gizlilik',
    'şifreleme',
  ],
  enabled: true,
  requiresPermission: [],
  supportedInputTypes: ['file', 'text'],
  component: FileHashTool,
};

export { FileHashTool };
export * from './hashUtils';
