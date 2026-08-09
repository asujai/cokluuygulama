import { ToolDefinition } from '../../registry/types';
import { CompassTool } from './CompassTool';

export const compassTool: ToolDefinition = {
  id: 'compass',
  name: 'Pusula',
  description: 'Manyetik ve gerçek kuzey yön bulucu, 360° grafik pusula gülü, rota takibi ve sapma açısı',
  icon: 'compass-outline',
  categoryId: 'daily',
  route: 'compass',
  keywords: [
    'pusula',
    'compass',
    'yon',
    'yön',
    'kuzey',
    'guney',
    'güney',
    'dogu',
    'doğu',
    'bati',
    'batı',
    'azimut',
    'heading',
    'manyetik',
    'navigasyon',
    'rota',
  ],
  enabled: true,
  requiresPermission: [],
  supportedInputTypes: ['sensor'],
  component: CompassTool,
};

export { CompassTool };
export * from './types';
