import { ToolDefinition } from '../../registry/types';
import { AudioTrimmerTool } from './AudioTrimmerTool';

export const audioTrimmerTool: ToolDefinition = {
  id: 'audio-trimmer',
  name: 'Ses Kesici & Zil Sesi Oluşturucu',
  description:
    'Ses ve videolardan ses kırpma, milisaniye hassasiyetli dalga formu, fade-in/out ve zil sesi/alarm dışa aktarma',
  icon: 'cut-outline',
  categoryId: 'conversion',
  route: 'audio-trimmer',
  keywords: [
    'ses kesici',
    'ses kesme',
    'zil sesi',
    'zil sesi yapma',
    'alarm sesi',
    'bildirim sesi',
    'audio trimmer',
    'ringtone',
    'wav',
    'mp3',
    'kırpma',
    'kirpma',
    'fade in',
    'fade out',
    'video ses ayırma',
    'video ses ayirma',
    'müzik kes',
    'muzik kes',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Medya Kitaplığı',
      description: 'Ses ve video dosyalarını içe aktarabilmek için izin gereklidir.',
    },
  ],
  supportedInputTypes: ['audio', 'video'],
  component: AudioTrimmerTool,
};

export { AudioTrimmerTool };
export * from './types';
export * from './audioEngine';
