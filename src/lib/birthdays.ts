import { differenceInCalendarDays } from 'date-fns';

export interface BirthdayRow<T> {
  client: T;
  /** Next birthday, "yyyy-MM-dd" (today included). */
  next: string;
  /** "yyyy-MM" of the next birthday, for grouping. */
  month: string;
  age: number;
  daysUntil: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * Clients ordered by their next birthday, starting from `today` and running through
 * the following twelve months. 29 February is celebrated on the 28th in non-leap years.
 */
export function upcomingBirthdays<T extends { date_of_birth: string; last_name: string; first_name: string }>(
  clients: T[],
  today: string
): BirthdayRow<T>[] {
  const [ty, tm, td] = today.split('-').map(Number);
  const todayDate = new Date(ty, tm - 1, td);

  const rows = clients
    .filter((c) => /^\d{4}-\d{2}-\d{2}/.test(c.date_of_birth))
    .map((client) => {
      const [by, bm, bd] = client.date_of_birth.slice(0, 10).split('-').map(Number);
      const dayIn = (y: number) => (bm === 2 && bd === 29 && !isLeap(y) ? 28 : bd);
      let year = ty;
      if (bm < tm || (bm === tm && dayIn(ty) < td)) year = ty + 1;
      const day = dayIn(year);
      const next = `${year}-${pad(bm)}-${pad(day)}`;
      return {
        client,
        next,
        month: next.slice(0, 7),
        age: year - by,
        daysUntil: differenceInCalendarDays(new Date(year, bm - 1, day), todayDate),
      };
    });

  return rows.sort(
    (a, b) =>
      a.next.localeCompare(b.next) ||
      a.client.last_name.localeCompare(b.client.last_name, 'fr') ||
      a.client.first_name.localeCompare(b.client.first_name, 'fr')
  );
}
