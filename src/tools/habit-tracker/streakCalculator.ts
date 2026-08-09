import { Habit, HabitStats, DayItem } from './types';

const TURKISH_DAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const TURKISH_MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

/**
 * Formats a Date object into YYYY-MM-DD string key.
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formats date into Turkish readable string (e.g. "9 Ağustos 2026, Pazar").
 */
export function formatTurkishDate(date: Date): string {
  const day = date.getDate();
  const month = TURKISH_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  const dayName = TURKISH_DAYS_SHORT[date.getDay()];
  return `${day} ${month} ${year}, ${dayName}`;
}

/**
 * Checks if a habit is scheduled for a specific date.
 */
export function isHabitScheduledForDate(habit: Habit, date: Date): boolean {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday

  if (habit.frequency === 'daily') {
    return true;
  }
  if (habit.frequency === 'weekdays') {
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }
  if (habit.frequency === 'custom' && habit.customDays) {
    return habit.customDays.includes(dayOfWeek);
  }
  return true;
}

/**
 * Returns an array of the last N days ending at referenceDate.
 */
export function getLastNDays(count: number, referenceDate: Date = new Date()): DayItem[] {
  const items: DayItem[] = [];
  const todayKey = formatDateKey(new Date());

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    const dateKey = formatDateKey(d);

    items.push({
      date: d,
      dateKey,
      dayName: TURKISH_DAYS_SHORT[d.getDay()],
      dayNumber: d.getDate(),
      isToday: dateKey === todayKey,
    });
  }

  return items;
}

/**
 * Computes current streak, longest streak, total completions, weekly and monthly success rates.
 */
export function calculateHabitStats(habit: Habit, referenceDate: Date = new Date()): HabitStats {
  const completions = habit.completions || {};
  const totalCompletions = Object.values(completions).filter(Boolean).length;

  // 1. Calculate Current Streak
  let currentStreak = 0;
  const today = new Date(referenceDate);
  const todayKey = formatDateKey(today);

  const isTodayScheduled = isHabitScheduledForDate(habit, today);
  const isTodayCompleted = !!completions[todayKey];

  let checkDate = new Date(today);

  if (isTodayScheduled && isTodayCompleted) {
    currentStreak++;
    checkDate.setDate(checkDate.getDate() - 1);
  } else if (!isTodayScheduled) {
    // If today is not scheduled, start looking from yesterday
    checkDate.setDate(checkDate.getDate() - 1);
  } else {
    // Today is scheduled but not completed yet; check if yesterday had an active streak
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Count consecutive past scheduled completed days
  const maxDaysBack = 365;
  let daysChecked = 0;

  while (daysChecked < maxDaysBack) {
    if (isHabitScheduledForDate(habit, checkDate)) {
      const key = formatDateKey(checkDate);
      if (completions[key]) {
        currentStreak++;
      } else {
        break; // Streak broken
      }
    }
    checkDate.setDate(checkDate.getDate() - 1);
    daysChecked++;
  }

  // 2. Calculate Longest Streak
  let longestStreak = currentStreak;
  let runningStreak = 0;

  // Scan history from creation or past 365 days
  const startDate = habit.createdAt ? new Date(habit.createdAt) : new Date();
  startDate.setHours(0, 0, 0, 0);

  const iterDate = new Date(startDate);
  // Ensure we don't start too far in future
  if (iterDate.getTime() > today.getTime()) {
    iterDate.setTime(today.getTime());
  }

  while (iterDate.getTime() <= today.getTime()) {
    if (isHabitScheduledForDate(habit, iterDate)) {
      const key = formatDateKey(iterDate);
      if (completions[key]) {
        runningStreak++;
        if (runningStreak > longestStreak) {
          longestStreak = runningStreak;
        }
      } else {
        runningStreak = 0;
      }
    }
    iterDate.setDate(iterDate.getDate() + 1);
  }

  // 3. Weekly Success Rate (Past 7 days)
  const last7 = getLastNDays(7, referenceDate);
  let scheduledLast7 = 0;
  let completedLast7 = 0;

  last7.forEach((item) => {
    if (isHabitScheduledForDate(habit, item.date)) {
      scheduledLast7++;
      if (completions[item.dateKey]) {
        completedLast7++;
      }
    }
  });

  const weeklyRate =
    scheduledLast7 > 0 ? Math.round((completedLast7 / scheduledLast7) * 100) : 0;

  // 4. Monthly Success Rate (Past 30 days)
  const last30 = getLastNDays(30, referenceDate);
  let scheduledLast30 = 0;
  let completedLast30 = 0;

  last30.forEach((item) => {
    if (isHabitScheduledForDate(habit, item.date)) {
      scheduledLast30++;
      if (completions[item.dateKey]) {
        completedLast30++;
      }
    }
  });

  const monthlyRate =
    scheduledLast30 > 0 ? Math.round((completedLast30 / scheduledLast30) * 100) : 0;

  return {
    currentStreak,
    longestStreak,
    totalCompletions,
    weeklyRate,
    monthlyRate,
  };
}
