import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DateDiffResult,
  AddSubtractResult,
  AgeCalculationResult,
  SavedCountdown,
} from './types';

const COUNTDOWNS_STORAGE_KEY = '@gundelik_saved_countdowns';

export const TURKISH_MONTHS = [
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

export const TURKISH_DAYS = [
  'Pazar',
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
];

// Fixed official national holidays in Turkey (Month-Day: 0-indexed month)
export const TURKISH_HOLIDAYS = [
  { month: 0, day: 1, name: 'Yılbaşı' },
  { month: 3, day: 23, name: 'Ulusal Egemenlik ve Çocuk Bayramı' },
  { month: 4, day: 1, name: 'Emek ve Dayanışma Günü' },
  { month: 4, day: 19, name: 'Atatürk’ü Anma, Gençlik ve Spor Bayramı' },
  { month: 6, day: 15, name: 'Demokrasi ve Milli Birlik Günü' },
  { month: 7, day: 30, name: 'Zafer Bayramı' },
  { month: 9, day: 29, name: 'Cumhuriyet Bayramı' },
];

export function formatDateTurkish(date: Date, includeDayName = true): string {
  const day = date.getDate();
  const month = TURKISH_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  const dayName = TURKISH_DAYS[date.getDay()];

  if (includeDayName) {
    return `${day} ${month} ${year}, ${dayName}`;
  }
  return `${day} ${month} ${year}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

export function getWeekOfYear(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

/**
 * Calculates exact date difference breakdown
 */
export function calculateDateDifference(
  startDate: Date,
  endDate: Date,
  includeEndDate = false,
  excludeHolidays = false
): DateDiffResult {
  // Normalize dates to start of day
  const d1 = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const d2 = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  const isReversed = d1 > d2;
  const start = isReversed ? d2 : d1;
  const end = isReversed ? d1 : d2;

  // Day step loop for business days & weekends
  let businessDays = 0;
  let weekendDays = 0;
  let holidayCount = 0;

  const current = new Date(start.getTime());
  const stopDate = new Date(end.getTime());

  if (!includeEndDate) {
    // Exclude the last day from the loop if not included
    stopDate.setDate(stopDate.getDate() - 1);
  }

  while (current <= stopDate) {
    const dayOfWeek = current.getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const isHoliday = TURKISH_HOLIDAYS.some(
      (h) => h.month === current.getMonth() && h.day === current.getDate()
    );

    if (isWeekend) {
      weekendDays++;
    } else if (isHoliday && excludeHolidays) {
      holidayCount++;
    } else {
      businessDays++;
    }

    current.setDate(current.getDate() + 1);
  }

  // Total calendar days
  const diffTime = Math.abs(end.getTime() - start.getTime());
  let totalDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  if (includeEndDate) {
    totalDays += 1;
  }

  // Exact Years, Months, Days breakdown
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (includeEndDate) {
    days += 1;
  }

  if (days < 0) {
    months -= 1;
    // Get days in previous month
    const prevMonthLastDay = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalWeeks = Math.floor(totalDays / 7);
  const remainingDays = totalDays % 7;

  const totalHours = totalDays * 24;
  const totalMinutes = totalHours * 60;
  const totalSeconds = totalMinutes * 60;

  return {
    totalDays,
    years: Math.max(0, years),
    months: Math.max(0, months),
    days: Math.max(0, days),
    totalWeeks,
    remainingDays,
    businessDays,
    weekendDays,
    holidayCount,
    totalHours,
    totalMinutes,
    totalSeconds,
  };
}

/**
 * Adds or subtracts time from a base date
 */
export function addSubtractDate(
  baseDate: Date,
  operation: 'add' | 'subtract',
  years: number,
  months: number,
  weeks: number,
  days: number
): AddSubtractResult {
  const result = new Date(baseDate.getTime());
  const factor = operation === 'add' ? 1 : -1;

  if (years !== 0) {
    result.setFullYear(result.getFullYear() + factor * years);
  }
  if (months !== 0) {
    result.setMonth(result.getMonth() + factor * months);
  }
  const totalDays = weeks * 7 + days;
  if (totalDays !== 0) {
    result.setDate(result.getDate() + factor * totalDays);
  }

  const diffTime = result.getTime() - baseDate.getTime();
  const daysDifference = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return {
    targetDate: result,
    formattedDate: formatDateTurkish(result),
    dayOfWeek: TURKISH_DAYS[result.getDay()],
    dayOfYear: getDayOfYear(result),
    weekOfYear: getWeekOfYear(result),
    isLeapYear: isLeapYear(result.getFullYear()),
    daysDifference,
  };
}

/**
 * Calculates detailed age and life trivia milestones
 */
export function calculateDetailedAge(birthDate: Date, now = new Date()): AgeCalculationResult {
  const diffTime = Math.max(0, now.getTime() - birthDate.getTime());
  const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const totalHours = totalDays * 24;
  const totalMinutes = totalHours * 60;
  const totalSeconds = totalMinutes * 60;

  // Exact Years, Months, Days
  let years = now.getFullYear() - birthDate.getFullYear();
  let months = now.getMonth() - birthDate.getMonth();
  let days = now.getDate() - birthDate.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  // Next birthday calculation
  const currentYear = now.getFullYear();
  let nextBirthday = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
  if (nextBirthday < now) {
    nextBirthday = new Date(currentYear + 1, birthDate.getMonth(), birthDate.getDate());
  }

  const nextDiffMs = nextBirthday.getTime() - now.getTime();
  const nextBirthdayDays = Math.ceil(nextDiffMs / (1000 * 60 * 60 * 24));
  const nextBirthdayDayName = TURKISH_DAYS[nextBirthday.getDay()];
  const nextBirthdayDateFormatted = formatDateTurkish(nextBirthday);

  // Life Milestones
  // Average resting heartbeat ~72 bpm
  const heartbeats = Math.round(totalMinutes * 72);
  // Average breaths ~16 per minute
  const breaths = Math.round(totalMinutes * 16);
  // Sleep ~8 hours per day (1/3 of life)
  const sleepYears = Number((years / 3).toFixed(1));

  // Western Zodiac
  const bMonth = birthDate.getMonth() + 1; // 1-12
  const bDay = birthDate.getDate();
  const { sign: zodiacSign, element: zodiacElement } = getWesternZodiac(bMonth, bDay);

  // Chinese Zodiac
  const chineseZodiac = getChineseZodiac(birthDate.getFullYear());

  return {
    years,
    months,
    days,
    totalDays,
    totalHours,
    totalMinutes,
    totalSeconds,
    nextBirthdayDays,
    nextBirthdayDayName,
    nextBirthdayDateFormatted,
    heartbeats,
    breaths,
    sleepYears,
    zodiacSign,
    zodiacElement,
    chineseZodiac,
  };
}

export function getWesternZodiac(month: number, day: number): { sign: string; element: string } {
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) {
    return { sign: 'Koç ♈ (Aries)', element: 'Ateş 🔥' };
  } else if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) {
    return { sign: 'Boğa ♉ (Taurus)', element: 'Toprak 🌍' };
  } else if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) {
    return { sign: 'İkizler ♊ (Gemini)', element: 'Hava 💨' };
  } else if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) {
    return { sign: 'Yengeç ♋ (Cancer)', element: 'Su 💧' };
  } else if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) {
    return { sign: 'Aslan ♌ (Leo)', element: 'Ateş 🔥' };
  } else if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) {
    return { sign: 'Başak ♍ (Virgo)', element: 'Toprak 🌍' };
  } else if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) {
    return { sign: 'Terazi ♎ (Libra)', element: 'Hava 💨' };
  } else if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) {
    return { sign: 'Akrep ♏ (Scorpio)', element: 'Su 💧' };
  } else if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) {
    return { sign: 'Yay ♐ (Sagittarius)', element: 'Ateş 🔥' };
  } else if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) {
    return { sign: 'Oğlak ♑ (Capricorn)', element: 'Toprak 🌍' };
  } else if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) {
    return { sign: 'Kova ♒ (Aquarius)', element: 'Hava 💨' };
  } else {
    return { sign: 'Balık ♓ (Pisces)', element: 'Su 💧' };
  }
}

export function getChineseZodiac(year: number): string {
  const animals = [
    'Maymun 🐒',
    'Horoz 🐓',
    'Köpek 🐕',
    'Domuz 🐖',
    'Sıçan 🐀',
    'Öküz 🐂',
    'Kaplan 🐅',
    'Tavşan 🐇',
    'Ejderha 🐉',
    'Yılan 🐍',
    'At 🐎',
    'Keçi 🐐',
  ];
  return animals[year % 12];
}

// Storage helpers
export async function loadSavedCountdowns(): Promise<SavedCountdown[]> {
  try {
    const json = await AsyncStorage.getItem(COUNTDOWNS_STORAGE_KEY);
    if (json) {
      return JSON.parse(json);
    }
  } catch {}
  return [
    {
      id: 'ny-2027',
      title: 'Yeni Yıl (2027)',
      targetDateIso: '2027-01-01T00:00:00.000Z',
      emoji: '🎉',
    },
    {
      id: 'summer-vacation',
      title: 'Yaz Tatili',
      targetDateIso: '2026-07-01T00:00:00.000Z',
      emoji: '🏖️',
    },
    {
      id: 'republic-day',
      title: 'Cumhuriyet Bayramı (29 Ekim)',
      targetDateIso: '2026-10-29T00:00:00.000Z',
      emoji: '🇹🇷',
    },
  ];
}

export async function saveSavedCountdowns(countdowns: SavedCountdown[]): Promise<void> {
  try {
    await AsyncStorage.setItem(COUNTDOWNS_STORAGE_KEY, JSON.stringify(countdowns));
  } catch {}
}
