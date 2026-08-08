import { ToolDefinition } from '../../registry/types';
import { UnitConverterTool } from './UnitConverterTool';

export const unitConverterTool: ToolDefinition = {
  id: 'unit-converter',
  name: 'Birim Dönüştürücü',
  description: 'Metre, kilometre, santimetre, mil ve fit uzunluk birimi dönüştürücü',
  icon: 'swap-horizontal-outline',
  categoryId: 'conversion',
  route: 'unit-converter',
  keywords: [
    'birim',
    'donusturucu',
    'dönüştürücü',
    'uzunluk',
    'metre',
    'kilometre',
    'santimetre',
    'mil',
    'fit',
    'inc',
    'inç',
    'yarda',
    'olcu',
    'ölçü',
  ],
  enabled: true,
  requiresPermission: [],
  supportedInputTypes: ['number'],
  component: UnitConverterTool,
};

export { UnitConverterTool };
