import { ToolDefinition } from '../../registry/types';
import { SpiritLevelTool } from './SpiritLevelTool';

export const spiritLevelTool: ToolDefinition = {
  id: 'spirit-level',
  name: 'Su Terazisi & Açı Ölçer',
  description: '2D Boğa gözü dairesel ve 1D tüp su terazisi ile hassas yüzey eğimi, açı ölçümü ve kalibrasyon',
  icon: 'speedometer-outline',
  categoryId: 'daily',
  route: 'spirit-level',
  keywords: [
    'su terazisi',
    'terazi',
    'aci',
    'açı',
    'ölçer',
    'olcer',
    'egim',
    'eğim',
    'inclinometer',
    'spirit level',
    'bubble level',
    'denge',
    'yuzey',
    'yüzey',
    'derece',
    'hizalama',
  ],
  enabled: true,
  requiresPermission: [],
  supportedInputTypes: ['sensor'],
  component: SpiritLevelTool,
};

export { SpiritLevelTool };
export * from './types';
