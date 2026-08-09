import { storageRepository } from '../../core/storage/storageRepository';
import { Habit } from './types';
import { formatDateKey } from './streakCalculator';

const STORAGE_KEY_HABITS = '@gundelik/habits_data_v1';

export const INITIAL_DEFAULT_HABITS: Habit[] = [
  {
    id: 'habit_water',
    title: 'Günde 2 Litre Su İç',
    description: 'Vücudun su dengesini korumak için gün boyu düzenli su iç.',
    icon: 'water-outline',
    color: '#0284C7',
    frequency: 'daily',
    reminderTime: '09:00',
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    completions: (() => {
      const c: Record<string, boolean> = {};
      const now = new Date();
      for (let i = 1; i <= 6; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        c[formatDateKey(d)] = true;
      }
      return c;
    })(),
  },
  {
    id: 'habit_reading',
    title: '30 Dk Kitap Oku',
    description: 'Kişisel gelişim veya kurgu bir kitaptan her gün 30 dakika oku.',
    icon: 'book-outline',
    color: '#7C3AED',
    frequency: 'daily',
    reminderTime: '21:30',
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    completions: (() => {
      const c: Record<string, boolean> = {};
      const now = new Date();
      for (let i = 1; i <= 4; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        c[formatDateKey(d)] = true;
      }
      return c;
    })(),
  },
  {
    id: 'habit_walk',
    title: '8.000 Adım & Yürüyüş',
    description: 'Günlük aktiflik hedefini tamamlamak için yürüyüş yap.',
    icon: 'fitness-outline',
    color: '#16A34A',
    frequency: 'daily',
    reminderTime: '18:00',
    createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    completions: (() => {
      const c: Record<string, boolean> = {};
      const now = new Date();
      for (let i = 1; i <= 3; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        c[formatDateKey(d)] = true;
      }
      return c;
    })(),
  },
];

/**
 * Loads all habits from local storage.
 */
export async function getHabits(): Promise<Habit[]> {
  const habits = await storageRepository.get<Habit[]>(
    STORAGE_KEY_HABITS,
    INITIAL_DEFAULT_HABITS
  );
  return habits;
}

/**
 * Saves habit list to storage.
 */
export async function saveHabits(habits: Habit[]): Promise<void> {
  await storageRepository.set(STORAGE_KEY_HABITS, habits);
}

/**
 * Adds a new habit or updates an existing one.
 */
export async function upsertHabit(habit: Habit): Promise<Habit[]> {
  const current = await getHabits();
  const exists = current.findIndex((h) => h.id === habit.id);
  let updated: Habit[];

  if (exists >= 0) {
    updated = current.map((h) => (h.id === habit.id ? habit : h));
  } else {
    updated = [habit, ...current];
  }

  await saveHabits(updated);
  return updated;
}

/**
 * Toggles completion status for a habit on a specific date.
 */
export async function toggleHabitCompletion(
  habitId: string,
  dateKey: string
): Promise<Habit[]> {
  const current = await getHabits();
  const updated = current.map((h) => {
    if (h.id === habitId) {
      const completions = { ...(h.completions || {}) };
      if (completions[dateKey]) {
        delete completions[dateKey];
      } else {
        completions[dateKey] = true;
      }
      return { ...h, completions };
    }
    return h;
  });

  await saveHabits(updated);
  return updated;
}

/**
 * Deletes a habit by ID.
 */
export async function deleteHabit(habitId: string): Promise<Habit[]> {
  const current = await getHabits();
  const updated = current.filter((h) => h.id !== habitId);
  await saveHabits(updated);
  return updated;
}
