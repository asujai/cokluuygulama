import { ToolDefinition } from '../../registry/types';
import { SrtEditorTool } from './SrtEditorTool';

export const srtEditorTool: ToolDefinition = {
  id: 'srt-editor',
  name: 'SRT Altyazı Düzenleyici',
  description: 'SRT altyazı dosyalarını içe aktarın, zaman damgalarını kaydırın (+/- saniye), metinleri düzenleyin ve kaydet/indirin',
  icon: 'document-text-outline',
  categoryId: 'text',
  route: 'srt-editor',
  keywords: [
    'srt',
    'altyazi',
    'altyazı',
    'subtitle',
    'editor',
    'zaman kaydir',
    'sync',
    'senkronizasyon',
  ],
  enabled: true,
  requiresPermission: [],
  supportedInputTypes: ['document'],
  component: SrtEditorTool,
};

export { SrtEditorTool };
export * from './types';
