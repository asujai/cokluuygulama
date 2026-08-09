export interface DateDiffResult {
  totalDays: number;
  years: number;
  months: number;
  days: number;
  totalWeeks: number;
  remainingDays: number;
  businessDays: number;
  weekendDays: number;
  holidayCount: number;
  totalHours: number;
  totalMinutes: number;
  totalSeconds: number;
}

export interface AddSubtractResult {
  targetDate: Date;
  formattedDate: string;
  dayOfWeek: string;
  dayOfYear: number;
  weekOfYear: number;
  isLeapYear: boolean;
  daysDifference: number;
}

export interface SavedCountdown {
  id: string;
  title: string;
  targetDateIso: string;
  category?: string;
  emoji?: string;
}

export interface AgeCalculationResult {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalSeconds: number;
  nextBirthdayDays: number;
  nextBirthdayDayName: string;
  nextBirthdayDateFormatted: string;
  heartbeats: number;
  breaths: number;
  sleepYears: number;
  zodiacSign: string;
  zodiacElement: string;
  chineseZodiac: string;
}
