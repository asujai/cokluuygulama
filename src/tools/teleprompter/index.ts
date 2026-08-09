import { ToolDefinition } from '../../registry/types';
import { TeleprompterTool } from './TeleprompterTool';

export const teleprompterTool: ToolDefinition = {
  id: 'teleprompter',
  name: 'Kamera Teleprompter',
  description:
    'Ön kamera video kaydı sırasında ekranda kayan konuşma metni, ayarlanabilir hız, ayna modu ve ses takip modu',
  icon: 'videocam-outline',
  categoryId: 'visual',
  route: 'teleprompter',
  keywords: [
    'teleprompter',
    'prompter',
    'kamera',
    'video kaydı',
    'video kaydi',
    'konuşma',
    'konusma',
    'sunum',
    'metin okuyucu',
    'vlog',
    'youtube',
    'ayna modu',
    'ses takip',
    'speech',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'camera',
      name: 'Kamera',
      description: 'Ön kamera teleprompter kaydı için kamera izni gereklidir.',
    },
  ],
  supportedInputTypes: ['text', 'camera'],
  component: TeleprompterTool,
};

export { TeleprompterTool };
export * from './types';
export * from './speechRecognition';
