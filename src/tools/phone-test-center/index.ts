import { ToolDefinition } from '../../registry/types';
import { PhoneTestCenterTool } from './PhoneTestCenterTool';

export const phoneTestCenterTool: ToolDefinition = {
  id: 'phone-test-center',
  name: 'Telefon Test Merkezi',
  description: 'Ekran, ölü piksel, dokunmatik matrisi, titreşim, flaş ve sensör teşhis donanım testi',
  icon: 'hardware-chip-outline',
  categoryId: 'daily',
  route: 'phone-test-center',
  keywords: [
    'telefon',
    'test',
    'teşhis',
    'teshis',
    'donanım',
    'donanim',
    'ekran',
    'piksel',
    'dokunmatik',
    'titreşim',
    'titresim',
    'flaş',
    'flas',
    'sensör',
    'sensor',
    'ivmeölçer',
    'jiroskop',
    'donanım testi',
  ],
  enabled: true,
  requiresPermission: [],
  supportedInputTypes: ['sensor'],
  component: PhoneTestCenterTool,
};

export { PhoneTestCenterTool };
export * from './types';
export * from './testCenterService';
