import { ToolDefinition } from '../../registry/types';
import { FileEncryptionTool } from './FileEncryptionTool';

export const fileEncryptionTool: ToolDefinition = {
  id: 'file-encryption',
  name: 'Dosya Şifreleme',
  description: 'Web Crypto AES-GCM 256-bit ve yerel parola ile güvenli dosya ve metin şifreleme',
  icon: 'lock-closed-outline',
  categoryId: 'daily',
  route: 'file-encryption',
  keywords: [
    'dosya',
    'şifreleme',
    'sifreleme',
    'encryption',
    'decrypt',
    'aes',
    'aes-gcm',
    'crypto',
    'güvenlik',
    'gizli',
    'parola',
  ],
  enabled: true,
  requiresPermission: [],
  supportedInputTypes: ['file', 'text'],
  component: FileEncryptionTool,
};

export { FileEncryptionTool };
export * from './types';
export * from './encryptionService';
