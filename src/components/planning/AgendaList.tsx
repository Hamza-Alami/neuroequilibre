'use client';

import { ChevronRight, ClipboardCheck } from 'lucide-react';
import { BoxTag, StatusBadge } from '@/components/ui/Badge';
import { displayStatus } from '@/lib/status';
import { dateKey, formatCalendarDate, formatTime, sessionEnd, todayKey } from '@/lib/time';
import type { SessionWithRelations } from '@/lib/types';
import { cn, fullName } from '@/lib/utils';

export function AgendaList({
  sessions,
  onSelectSession,
  showClient = true,
  showDayHeaders = true,
}: {
  sessions: SessionWithRelations[];
  onSelectSession: (s: SessionWithRelations) => void;
  showClient?: boolean;
  showDayHeaders?: boolean;
}) {
  const today = todayKey();
  const groups = new Map<string, SessionWithRelations[]>();
  for (const s of sessions) {
    const k = dateKey(s.starts_at);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(s);
  }

  return (
    <div className="divide-y divide-line">
      {[...groups.entries()].map(([day, list]) => (
        <div key={day}>
          {showDayHeaders && (
            <div className="flex items-center justify-between bg-surface-muted px-5 py-2">
              <p className={cn('text-[13px] font-semibold capitalize', day === today ? 'text-navy' : 'text-ink')}>
                {day === today ? 'Aujourd’hui · ' : ''}
                {formatCalendarDate(day, 'EEEE d MMMM yyyy')}
              </p>
              <span className="tabular text-[12px] text-ink-muted">
                {list.length} séance{list.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
          <ul className="divide-y divide-line">
            {list.map((s) => {
              const status = displayStatus(s);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSession(s)}
                    className="group grid w-full grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 text-left hover:bg-surface-muted sm:grid-cols-[96px_110px_minmax(0,1fr)_auto_auto]"
                  >
                    <span className="tabular text-[13px] font-medium text-ink">
                      {formatTime(s.starts_at)}
                      <span className="block text-[11px] font-normal text-ink-muted">
                        → {formatTime(sessionEnd(s.starts_at, s.duration_minutes))}
                      </span>
                    </span>
                    <span className="hidden sm:block">
                      {s.box ? <BoxTag name={s.box.name} color={s.box.color} /> : '—'}
                    </span>
                    <span className="min-w-0">
                      {showClient && (
                        <span className={cn('block truncate text-[14px] font-medium text-ink', status === 'cancelled' && 'line-through opacity-60')}>
                          {fullName(s.client)}
                        </span>
                      )}
                      <span className="flex items-center gap-2 text-[12px] text-ink-muted">
                        {s.session_number ? `Séance n°${s.session_number}` : 'Annulée'} · {s.duration_minutes} min
                        {s.has_assessment && (
                          <span className="inline-flex items-center gap-1 text-success">
                            <ClipboardCheck className="h-3 w-3" /> Évaluée
                          </span>
                        )}
                        <span className="sm:hidden">· {s.box?.name}</span>
                      </span>
                    </span>
                    <span className="hidden sm:block">
                      <StatusBadge status={status} />
                    </span>
                    <ChevronRight className="h-4 w-4 text-ink-muted/50 group-hover:text-ink-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
