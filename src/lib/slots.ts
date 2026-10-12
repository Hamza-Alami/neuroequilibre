import { dayHours, minutesOf, timeOfMinutes, toUtcIso } from '@/lib/time';
import type { BoxBlock, CentreSettings, Session } from '@/lib/types';

export type SlotState = 'free' | 'near' | 'taken' | 'blocked' | 'past' | 'overflow';

export interface Slot {
  time: string;
  state: SlotState;
  reason?: string;
}

const MIN = 60_000;

interface SlotContext {
  dayKey: string;
  boxId: string;
  duration: number;
  settings: CentreSettings;
  sessions: Pick<Session, 'id' | 'box_id' | 'starts_at' | 'duration_minutes' | 'status'>[];
  blocks: BoxBlock[];
  excludeId?: string | null;
  now?: number;
}

export function evaluateSlot(time: string, ctx: SlotContext): Slot {
  const { dayKey, boxId, duration, settings, sessions, blocks, excludeId } = ctx;
  const now = ctx.now ?? Date.now();
  const start = new Date(toUtcIso(dayKey, time)).getTime();
  const end = start + duration * MIN;
  const hours = dayHours(settings.opening_hours, dayKey);

  if (start < now) return { time, state: 'past', reason: 'Horaire passé' };
  if (hours && minutesOf(time) + duration > minutesOf(hours.close)) {
    return { time, state: 'overflow', reason: `Se termine après la fermeture (${hours.close})` };
  }

  const block = blocks.find(
    (b) =>
      (b.box_id === null || b.box_id === boxId) &&
      new Date(b.starts_at).getTime() < end &&
      new Date(b.ends_at).getTime() > start
  );
  if (block) return { time, state: 'blocked', reason: block.reason ? `Bloqué : ${block.reason}` : 'Créneau bloqué' };

  const sameBox = sessions.filter((s) => s.box_id === boxId && s.status !== 'cancelled' && s.id !== excludeId);
  if (sameBox.some((s) => new Date(s.starts_at).getTime() === start)) {
    return { time, state: 'taken', reason: 'Déjà réservé' };
  }

  const gap = settings.min_gap_minutes * MIN;
  const near = sameBox.find((s) => {
    const sStart = new Date(s.starts_at).getTime();
    const sEnd = sStart + s.duration_minutes * MIN;
    return Math.abs(sStart - start) < gap || (sStart < end && sEnd > start);
  });
  if (near) {
    return { time, state: 'near', reason: `Moins de ${settings.min_gap_minutes} min d’écart avec une autre séance` };
  }
  return { time, state: 'free' };
}

export function buildSlots(ctx: SlotContext): Slot[] {
  const hours = dayHours(ctx.settings.opening_hours, ctx.dayKey);
  if (!hours) return [];
  const step = ctx.settings.slot_step_minutes || 15;
  const slots: Slot[] = [];
  for (let m = minutesOf(hours.open); m < minutesOf(hours.close); m += step) {
    slots.push(evaluateSlot(timeOfMinutes(m), ctx));
  }
  return slots;
}

export const SLOT_STYLES: Record<SlotState, string> = {
  free: 'border-line-strong bg-surface text-ink hover:border-navy hover:bg-navy-50',
  near: 'border-warning/30 bg-warning-50 text-warning hover:border-warning',
  taken: 'border-transparent bg-surface-muted text-ink-muted/60 line-through cursor-not-allowed',
  blocked: 'hatched border-transparent bg-surface-muted text-ink-muted/70 cursor-not-allowed',
  past: 'border-transparent bg-transparent text-ink-muted/40 cursor-not-allowed',
  overflow: 'border-transparent bg-surface-muted text-ink-muted/50 cursor-not-allowed',
};

export function isSelectable(state: SlotState) {
  return state === 'free' || state === 'near';
}
