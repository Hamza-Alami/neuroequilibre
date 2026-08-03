import type { Session, SessionDateValidation } from '@/lib/types';

function toLocalDateTimeString(date: Date): { date: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function parseSessionDateTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00`);
}

/** Sessions sorted chronologically (oldest first) */
export function sortSessionsChronologically(sessions: Session[]): Session[] {
  return [...sessions].sort(
    (a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
  );
}

export function getLatestSession(sessions: Session[]): Session | undefined {
  if (sessions.length === 0) return undefined;
  return sortSessionsChronologically(sessions)[sessions.length - 1];
}

export function validateNewSessionDate(
  sessions: Session[],
  dateStr: string,
  timeStr: string
): SessionDateValidation {
  const proposed = parseSessionDateTime(dateStr, timeStr);
  if (Number.isNaN(proposed.getTime())) {
    return { valid: false, message: 'Date ou heure invalide' };
  }

  const latest = getLatestSession(sessions);
  if (!latest) return { valid: true };

  const latestDate = new Date(latest.session_date);
  if (proposed.getTime() <= latestDate.getTime()) {
    const min = new Date(latestDate.getTime() + 60_000);
    const { date, time } = toLocalDateTimeString(min);
    return {
      valid: false,
      message: `La séance doit être planifiée après la dernière séance (${formatSessionLabel(latestDate)})`,
      minDate: date,
      minTime: time,
    };
  }

  return { valid: true };
}

export function validateEditSessionDate(
  sessions: Session[],
  sessionId: string,
  dateStr: string,
  timeStr: string
): SessionDateValidation {
  const proposed = parseSessionDateTime(dateStr, timeStr);
  if (Number.isNaN(proposed.getTime())) {
    return { valid: false, message: 'Date ou heure invalide' };
  }

  const chronological = sortSessionsChronologically(sessions);
  const index = chronological.findIndex((s) => s.id === sessionId);
  if (index === -1) return { valid: false, message: 'Séance introuvable' };

  const prev = chronological[index - 1];
  const next = chronological[index + 1];

  if (prev) {
    const prevDate = new Date(prev.session_date);
    if (proposed.getTime() <= prevDate.getTime()) {
      return {
        valid: false,
        message: `Doit être après la séance n°${prev.session_number} (${formatSessionLabel(prevDate)})`,
      };
    }
  }

  if (next) {
    const nextDate = new Date(next.session_date);
    if (proposed.getTime() >= nextDate.getTime()) {
      return {
        valid: false,
        message: `Doit être avant la séance n°${next.session_number} (${formatSessionLabel(nextDate)})`,
      };
    }
  }

  return { valid: true };
}

function formatSessionLabel(date: Date): string {
  return date.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function splitSessionDateTime(isoDate: string): { date: string; time: string } {
  const d = new Date(isoDate);
  return toLocalDateTimeString(d);
}

export function getMinBookingDefaults(sessions: Session[]): { minDate: string; minTime: string } | null {
  const latest = getLatestSession(sessions);
  if (!latest) return null;
  const min = new Date(new Date(latest.session_date).getTime() + 60_000);
  const { date, time } = toLocalDateTimeString(min);
  return { minDate: date, minTime: time };
}
