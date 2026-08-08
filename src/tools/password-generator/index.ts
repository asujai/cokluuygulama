import { ToolDefinition } from '../../registry/types';
import { PasswordGeneratorTool } from './PasswordGeneratorTool';

export const passwordGeneratorTool: ToolDefinition = {
  id: 'password-generator',
  name: 'Güçlü Şifre',
  description: 'Kriptografik olarak güvenli, özelleştirilebilir şifre üretici',
  icon: 'shield-checkmark-outline',
  categoryId: 'privacy',
  route: 'password-generator',
  keywords: [
    'sifre',
    'şifre',
    'guvenlik',
    'güvenlik',
    'password',
    'parola',
    'kripto',
    'rastgele',
    'random',
    'gizlilik',
    'uretici',
    'üretici',
  ],
  enabled: true,
  requiresPermission: [],
  supportedInputTypes: ['settings'],
  component: PasswordGeneratorTool,
};

export { PasswordGeneratorTool };
