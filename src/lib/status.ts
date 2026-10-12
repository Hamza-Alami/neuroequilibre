import type { DisplayStatus, Session } from '@/lib/types';

export function displayStatus(session: Pick<Session, 'status' | 'starts_at'>, now = Date.now()): DisplayStatus {
  if (session.status === 'cancelled') return 'cancelled';
  if (session.status === 'completed') return 'completed';
  return new Date(session.starts_at).getTime() >= now ? 'upcoming' : 'past';
}

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  upcoming: 'À venir',
  past: 'Passée',
  completed: 'Réalisée',
  cancelled: 'Annulée',
};
