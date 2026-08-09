import { ToolDefinition } from '../../registry/types';
import { HabitTrackerTool } from './HabitTrackerTool';

export const habitTrackerTool: ToolDefinition = {
  id: 'habit-tracker',
  name: 'Alışkanlık & Rutin Takipçisi',
  description: 'Günlük hedefler, seri (streak) takibi, başarı analizleri ve yerel depolama ile pratik rutin yöneticisi',
  icon: 'flame-outline',
  categoryId: 'daily',
  route: 'habit-tracker',
  keywords: [
    'alışkanlık',
    'aliskanlik',
    'rutin',
    'streak',
    'habit',
    'hedef',
    'takip',
    'günlük',
    'gunluk',
    'zincir',
    'seri',
    'gelişim',
    'gelisim',
    'motivasyon',
    'plan',
    'aktivite',
  ],
  enabled: true,
  requiresPermission: [],
  supportedInputTypes: ['text'],
  component: HabitTrackerTool,
};

export { HabitTrackerTool };
export * from './types';
