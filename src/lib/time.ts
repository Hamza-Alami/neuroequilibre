import { TZDate, tz } from '@date-fns/tz';
import {
  addDays,
  addMinutes,
  differenceInYears,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DayHours, OpeningHours } from '@/lib/types';

export const DEFAULT_TZ = 'Africa/Casablanca';

let currentTz = DEFAULT_TZ;

/** Set once from centre settings so every date displays in the centre's time zone. */
export function setCentreTimezone(timezone: string | undefined | null) {
  currentTz = timezone || DEFAULT_TZ;
}

export function centreTz() {
  return currentTz;
}

export function inCentre(date: Date | string | number) {
  return new TZDate(new Date(date).getTime(), currentTz);
}

export function nowInCentre() {
  return TZDate.tz(currentTz);
}

/** "yyyy-MM-dd" for today in the centre time zone. */
export function todayKey() {
  return format(nowInCentre(), 'yyyy-MM-dd');
}

export function dateKey(date: Date | string) {
  return format(inCentre(date), 'yyyy-MM-dd');
}

export function timeKey(date: Date | string) {
  return format(inCentre(date), 'HH:mm');
}

/** True if the given centre-local date + time is already in the past. */
export function isPastSlot(date: string, time: string) {
  return new Date(toUtcIso(date, time)).getTime() < Date.now();
}

/** Combine a local centre date + time into a UTC ISO string. */
export function toUtcIso(date: string, time: string) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(new TZDate(y, m - 1, d, h, min, currentTz).getTime()).toISOString();
}

export function fmt(date: Date | string, pattern: string) {
  return format(new Date(date), pattern, { locale: fr, in: tz(currentTz) });
}

export const formatDate = (date: Date | string) => fmt(date, 'd MMMM yyyy');
export const formatShortDate = (date: Date | string) => fmt(date, 'dd/MM/yyyy');
export const formatTime = (date: Date | string) => fmt(date, 'HH:mm');
export const formatDateTime = (date: Date | string) => fmt(date, "d MMM yyyy 'à' HH:mm");
export const formatWeekday = (date: Date | string) => fmt(date, 'EEEE d MMMM');

/** Format a plain "yyyy-MM-dd" calendar date (no time zone shift). */
export function formatCalendarDate(key: string, pattern = 'd MMMM yyyy') {
  const [y, m, d] = key.split('-').map(Number);
  return format(new Date(y, m - 1, d), pattern, { locale: fr });
}

export function addDaysToKey(key: string, days: number) {
  const [y, m, d] = key.split('-').map(Number);
  return format(addDays(new Date(y, m - 1, d), days), 'yyyy-MM-dd');
}

export function isoWeekday(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 ? 7 : day;
}

export function dayHours(hours: OpeningHours, key: string): DayHours | null {
  const day = hours[String(isoWeekday(key))];
  if (!day || day.closed) return null;
  return day;
}

export function minutesOf(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function timeOfMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Calendar ranges (as yyyy-MM-dd keys, inclusive). */
export function rangeFor(view: 'day' | 'week' | 'month', key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  if (view === 'day') return { from: key, to: key };
  if (view === 'week') {
    return {
      from: format(startOfWeek(base, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      to: format(endOfWeek(base, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    };
  }
  return {
    from: format(startOfMonth(base), 'yyyy-MM-dd'),
    to: format(endOfMonth(base), 'yyyy-MM-dd'),
  };
}

/** UTC bounds covering whole local days [from, to]. */
export function utcBounds(from: string, to: string) {
  return { start: toUtcIso(from, '00:00'), end: toUtcIso(addDaysToKey(to, 1), '00:00') };
}

export function sessionEnd(startsAt: string, minutes: number) {
  return addMinutes(new Date(startsAt), minutes);
}

export function calculateAge(dateOfBirth: string) {
  return differenceInYears(new Date(), new Date(dateOfBirth));
}
