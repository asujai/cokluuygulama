import { ToolDefinition } from '../../registry/types';
import { ColorPickerPaletteTool } from './ColorPickerPaletteTool';

export const colorPickerPaletteTool: ToolDefinition = {
  id: 'color-picker-palette',
  name: 'Renk Paleti & Seçici',
  description: 'Görselden ve renk dairesinden renk seçme, HEX/RGB/HSL/HSV/CMYK dönüştürme, uyumlu paletler ve WCAG kontrast analizi',
  icon: 'color-palette-outline',
  categoryId: 'visual',
  route: 'color-picker-palette',
  keywords: [
    'renk',
    'color',
    'hex',
    'rgb',
    'hsl',
    'hsv',
    'cmyk',
    'palet',
    'eyedropper',
    'damlalık',
    'kontrast',
    'wcag',
    'görsel',
  ],
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'mediaLibrary',
      description: 'Görsellerden renk seçebilmek için galeri erişimi gereklidir.',
    },
  ],
  supportedInputTypes: ['image', 'text'],
  component: ColorPickerPaletteTool,
};

export { ColorPickerPaletteTool };
export * from './colorUtils';
