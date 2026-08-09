import { ToolDefinition } from '../../registry/types';
import { NfcTool } from './NfcTool';

export const nfcTool: ToolDefinition = {
  id: 'nfc-tool',
  name: 'NFC Araç Kutusu',
  description: 'NFC etiket ve kartlarından NDEF verilerini (Metin, URL, Telefon) okuyun ve yazın',
  icon: 'hardware-chip-outline',
  categoryId: 'daily',
  route: 'nfc-tool',
  keywords: [
    'nfc',
    'ndef',
    'rfid',
    'oku',
    'yaz',
    'tag',
    'kart',
    'etiket',
    'url',
    'text',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'nfc',
      name: 'NFC Donanımı',
      description: 'NFC etiketlerini okumak ve veri yazmak için gereklidir.',
    },
  ],
  supportedInputTypes: ['hardware'],
  component: NfcTool,
};

export { NfcTool };
export * from './types';
