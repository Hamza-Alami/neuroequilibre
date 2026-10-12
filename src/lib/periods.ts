import { endOfMonth, endOfQuarter, endOfYear, format, startOfMonth, startOfQuarter, startOfYear, subMonths, subQuarters, subYears } from 'date-fns';
import { formatCalendarDate } from '@/lib/time';

export type PeriodPreset = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year' | 'custom';

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'this_month', label: 'Ce mois' },
  { value: 'last_month', label: 'Mois précédent' },
  { value: 'this_quarter', label: 'Ce trimestre' },
  { value: 'last_quarter', label: 'Trimestre précédent' },
  { value: 'this_year', label: 'Cette année' },
  { value: 'last_year', label: 'Année précédente' },
  { value: 'custom', label: 'Personnalisée' },
];

const key = (d: Date) => format(d, 'yyyy-MM-dd');

export function presetRange(preset: Exclude<PeriodPreset, 'custom'>, today: string) {
  const [y, m, d] = today.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  switch (preset) {
    case 'this_month':
      return { from: key(startOfMonth(base)), to: key(endOfMonth(base)) };
    case 'last_month': {
      const b = subMonths(base, 1);
      return { from: key(startOfMonth(b)), to: key(endOfMonth(b)) };
    }
    case 'this_quarter':
      return { from: key(startOfQuarter(base)), to: key(endOfQuarter(base)) };
    case 'last_quarter': {
      const b = subQuarters(base, 1);
      return { from: key(startOfQuarter(b)), to: key(endOfQuarter(b)) };
    }
    case 'this_year':
      return { from: key(startOfYear(base)), to: key(endOfYear(base)) };
    case 'last_year': {
      const b = subYears(base, 1);
      return { from: key(startOfYear(b)), to: key(endOfYear(b)) };
    }
  }
}

export function periodLabel(from: string, to: string) {
  if (from === to) return formatCalendarDate(from);
  return `du ${formatCalendarDate(from)} au ${formatCalendarDate(to)}`;
}

/** Month keys "yyyy-MM" covering [from, to]. */
export function monthsBetween(from: string, to: string) {
  const months: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}
