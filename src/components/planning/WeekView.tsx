'use client';

import { Lock } from 'lucide-react';
import { displayStatus } from '@/lib/status';
import { addDaysToKey, dateKey, dayHours, formatCalendarDate, formatTime, todayKey } from '@/lib/time';
import type { Box, BoxBlock, CentreSettings, SessionWithRelations } from '@/lib/types';
import { cn } from '@/lib/utils';

export function WeekView({
  from,
  boxes,
  sessions,
  blocks,
  settings,
  onSelectSession,
  onSelectDay,
}: {
  from: string;
  boxes: Box[];
  sessions: SessionWithRelations[];
  blocks: BoxBlock[];
  settings: CentreSettings;
  onSelectSession: (s: SessionWithRelations) => void;
  onSelectDay: (day: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(from, i));
  const today = todayKey();

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[900px] table-fixed border-collapse">
        <thead>
          <tr>
            <th className="w-[120px] border-b border-line" />
            {days.map((d) => (
              <th key={d} className="border-b border-l border-line px-2 py-2.5 text-left font-normal">
                <button
                  type="button"
                  onClick={() => onSelectDay(d)}
                  className={cn(
                    'flex items-baseline gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-navy-50',
                    d === today && 'text-navy'
                  )}
                >
                  <span className="text-[12px] uppercase tracking-wide text-ink-muted">{formatCalendarDate(d, 'EEE')}</span>
                  <span
                    className={cn(
                      'tabular text-[15px] font-semibold',
                      d === today ? 'flex h-6 w-6 items-center justify-center rounded-full bg-navy text-[13px] text-white' : 'text-ink'
                    )}
                  >
                    {formatCalendarDate(d, 'd')}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {boxes.map((b) => (
            <tr key={b.id}>
              <td className="border-b border-line px-3 py-3 align-top">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <span className="h-3 w-3 rounded-[4px]" style={{ background: b.color }} />
                  {b.name}
                </span>
              </td>
              {days.map((d) => {
                const closed = !dayHours(settings.opening_hours, d);
                const cellSessions = sessions
                  .filter((s) => s.box_id === b.id && dateKey(s.starts_at) === d)
                  .sort((x, y) => x.starts_at.localeCompare(y.starts_at));
                const cellBlocks = blocks.filter(
                  (bl) => (bl.box_id === null || bl.box_id === b.id) && dateKey(bl.starts_at) <= d && dateKey(bl.ends_at) >= d
                );
                return (
                  <td
                    key={d}
                    className={cn('h-28 border-b border-l border-line p-1.5 align-top', closed && 'hatched')}
                  >
                    <div className="space-y-1">
                      {cellBlocks.map((bl) => (
                        <div
                          key={bl.id}
                          className="hatched flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-ink-muted ring-1 ring-line"
                          title={bl.reason ?? undefined}
                        >
                          <Lock className="h-3 w-3" />
                          <span className="tabular truncate">
                            {dateKey(bl.starts_at) === d ? formatTime(bl.starts_at) : '…'}–
                            {dateKey(bl.ends_at) === d ? formatTime(bl.ends_at) : '…'}
                          </span>
                        </div>
                      ))}
                      {cellSessions.map((s) => {
                        const status = displayStatus(s);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => onSelectSession(s)}
                            className={cn(
                              'flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[12px] hover:ring-1 hover:ring-navy/30',
                              status === 'cancelled' && 'opacity-50'
                            )}
                            style={{ background: `color-mix(in srgb, ${b.color} 12%, white)` }}
                          >
                            <span className="tabular font-semibold text-ink">{formatTime(s.starts_at)}</span>
                            <span className={cn('truncate text-ink-soft', status === 'cancelled' && 'line-through')}>
                              {s.client ? `${s.client.first_name} ${s.client.last_name.charAt(0)}.` : '—'}
                            </span>
                          </button>
                        );
                      })}
                      {closed && cellSessions.length === 0 && (
                        <p className="px-1 pt-1 text-[11px] text-ink-muted">Fermé</p>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
