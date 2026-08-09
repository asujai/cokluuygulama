export type FrequencyType = 'daily' | 'weekdays' | 'custom';

export interface Habit {
  id: string;
  title: string;
  description?: string;
  icon: string;
  color: string;
  frequency: FrequencyType;
  customDays?: number[]; // 0: Paz, 1: Pzt, 2: Sal, 3: Çar, 4: Per, 5: Cum, 6: Cmt
  reminderTime?: string; // e.g. "08:30"
  createdAt: string; // ISO string
  completions: Record<string, boolean>; // key: 'YYYY-MM-DD'
}

export interface HabitStats {
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  weeklyRate: number; // 0 - 100
  monthlyRate: number; // 0 - 100
}

export interface DayItem {
  date: Date;
  dateKey: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
}
