'use client';

import { Lock } from 'lucide-react';
import { useEffect, useState, type MouseEvent } from 'react';
import { displayStatus } from '@/lib/status';
import { dayHours, formatTime, minutesOf, sessionEnd, timeKey, timeOfMinutes, todayKey, dateKey } from '@/lib/time';
import type { Box, BoxBlock, CentreSettings, SessionWithRelations } from '@/lib/types';
import { cn, fullName } from '@/lib/utils';

const PX_PER_MIN = 1.5;

interface Placed {
  session: SessionWithRelations;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

function localMinutes(iso: string) {
  return minutesOf(timeKey(iso));
}

function placeSessions(sessions: SessionWithRelations[], startMin: number): Placed[] {
  const sorted = [...sessions].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];

  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    cluster.forEach((p) => (p.lanes = lanes));
    cluster = [];
    laneEnds = [];
  };

  for (const s of sorted) {
    const start = localMinutes(s.starts_at);
    const end = start + s.duration_minutes;
    if (start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    const p: Placed = {
      session: s,
      top: (start - startMin) * PX_PER_MIN,
      height: Math.max(s.duration_minutes * PX_PER_MIN, 28),
      lane,
      lanes: 1,
    };
    cluster.push(p);
    placed.push(p);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return placed;
}

export function DayView({
  day,
  boxes,
  sessions,
  blocks,
  settings,
  onSelectSession,
  onEmptyClick,
}: {
  day: string;
  boxes: Box[];
  sessions: SessionWithRelations[];
  blocks: BoxBlock[];
  settings: CentreSettings;
  onSelectSession: (s: SessionWithRelations) => void;
  onEmptyClick: (boxId: string, time: string) => void;
}) {
  const hours = dayHours(settings.opening_hours, day);
  const sessionMins = sessions.map((s) => localMinutes(s.starts_at));
  const sessionEnds = sessions.map((s) => localMinutes(s.starts_at) + s.duration_minutes);
  const startMin = Math.floor(Math.min(hours ? minutesOf(hours.open) : 9 * 60, ...sessionMins) / 60) * 60;
  const endMin = Math.ceil(Math.max(hours ? minutesOf(hours.close) : 18 * 60, ...sessionEnds) / 60) * 60;
  const height = (endMin - startMin) * PX_PER_MIN;
  const hourMarks = Array.from({ length: (endMin - startMin) / 60 + 1 }, (_, i) => startMin + i * 60);

  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNowMin(day === todayKey() ? localMinutes(new Date().toISOString()) : null);
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [day]);

  function handleColumnClick(e: MouseEvent<HTMLDivElement>, boxId: string) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const step = settings.slot_step_minutes || 15;
    const minute = startMin + Math.floor(y / PX_PER_MIN / step) * step;
    onEmptyClick(boxId, timeOfMinutes(minute));
  }

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <div className="min-w-fit" style={{ minWidth: 64 + boxes.length * 200 }}>
        <div className="sticky top-0 z-10 flex border-b border-line bg-surface">
          <div className="w-16 shrink-0" />
          {boxes.map((b) => {
            const count = sessions.filter((s) => s.box_id === b.id && s.status !== 'cancelled').length;
            return (
              <div key={b.id} className="flex min-w-[200px] flex-1 items-center gap-2 border-l border-line px-3 py-3">
                <span className="h-3 w-3 rounded-[4px]" style={{ background: b.color }} />
                <span className="text-[14px] font-semibold text-ink">{b.name}</span>
                {!b.is_active && <span className="text-[11px] text-ink-muted">(désactivé)</span>}
                <span className="tabular ml-auto text-[12px] text-ink-muted">
                  {count} séance{count > 1 ? 's' : ''}
                </span>
              </div>
            );
          })}
        </div>

        <div className="relative flex" style={{ height }}>
          <div className="relative w-16 shrink-0">
            {hourMarks.map((m) => (
              <span
                key={m}
                className="tabular absolute right-3 -translate-y-1/2 text-[11px] text-ink-muted"
                style={{ top: (m - startMin) * PX_PER_MIN }}
              >
                {timeOfMinutes(m)}
              </span>
            ))}
          </div>

          {boxes.map((b) => {
            const boxSessions = sessions.filter((s) => s.box_id === b.id);
            const boxBlocks = blocks.filter((bl) => bl.box_id === null || bl.box_id === b.id);
            const placed = placeSessions(boxSessions, startMin);
            return (
              <div
                key={b.id}
                className="relative min-w-[200px] flex-1 cursor-pointer border-l border-line hover:bg-navy-50/30"
                style={{
                  backgroundImage: `repeating-linear-gradient(to bottom, var(--line) 0, var(--line) 1px, transparent 1px, transparent ${60 * PX_PER_MIN}px), repeating-linear-gradient(to bottom, transparent 0, transparent ${30 * PX_PER_MIN}px, rgba(232,229,222,0.5) ${30 * PX_PER_MIN}px, rgba(232,229,222,0.5) ${30 * PX_PER_MIN + 1}px, transparent ${30 * PX_PER_MIN + 1}px, transparent ${60 * PX_PER_MIN}px)`,
                }}
                onClick={(e) => handleColumnClick(e, b.id)}
              >
                {hours && minutesOf(hours.open) > startMin && (
                  <div className="hatched absolute inset-x-0 top-0" style={{ height: (minutesOf(hours.open) - startMin) * PX_PER_MIN }} />
                )}
                {hours && minutesOf(hours.close) < endMin && (
                  <div
                    className="hatched absolute inset-x-0"
                    style={{ top: (minutesOf(hours.close) - startMin) * PX_PER_MIN, bottom: 0 }}
                  />
                )}
                {!hours && <div className="hatched absolute inset-0" />}

                {boxBlocks.map((bl) => {
                  const blStart = dateKey(bl.starts_at) < day ? startMin : localMinutes(bl.starts_at);
                  const blEnd = dateKey(bl.ends_at) > day ? endMin : localMinutes(bl.ends_at);
                  const top = (Math.max(blStart, startMin) - startMin) * PX_PER_MIN;
                  const h = (Math.min(blEnd, endMin) - Math.max(blStart, startMin)) * PX_PER_MIN;
                  if (h <= 0) return null;
                  return (
                    <div
                      key={bl.id}
                      className="hatched absolute inset-x-1 flex items-start gap-1.5 rounded-md border border-line-strong/70 bg-surface-muted/80 px-2 py-1 text-[11px] font-medium text-ink-muted"
                      style={{ top, height: h }}
                      onClick={(e) => e.stopPropagation()}
                      title={bl.reason ?? 'Bloqué'}
                    >
                      <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {bl.box_id === null ? 'Centre fermé' : 'Bloqué'}
                        {bl.reason ? ` · ${bl.reason}` : ''}
                      </span>
                    </div>
                  );
                })}

                {placed.map(({ session: s, top, height: h, lane, lanes }) => {
                  const status = displayStatus(s);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSession(s);
                      }}
                      className={cn(
                        'absolute overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-left shadow-[0_1px_2px_rgba(21,35,58,0.08)] transition-shadow hover:z-10 hover:shadow-pop',
                        status === 'cancelled' && 'opacity-55',
                        status === 'past' && 'opacity-80'
                      )}
                      style={{
                        top: top + 1,
                        height: h - 2,
                        left: `calc(${(lane / lanes) * 100}% + 4px)`,
                        width: `calc(${100 / lanes}% - 8px)`,
                        borderLeftColor: b.color,
                        background: `color-mix(in srgb, ${b.color} 12%, white)`,
                      }}
                    >
                      <p className={cn('truncate text-[12px] font-semibold text-ink', status === 'cancelled' && 'line-through')}>
                        {fullName(s.client)}
                      </p>
                      <p className="tabular truncate text-[11px] text-ink-soft">
                        {formatTime(s.starts_at)} – {formatTime(sessionEnd(s.starts_at, s.duration_minutes))}
                        {s.session_number ? ` · S${s.session_number}` : ''}
                        {status === 'completed' ? ' · ✓' : status === 'cancelled' ? ' · annulée' : ''}
                      </p>
                    </button>
                  );
                })}

                {nowMin !== null && nowMin >= startMin && nowMin <= endMin && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 h-px bg-danger"
                    style={{ top: (nowMin - startMin) * PX_PER_MIN }}
                  >
                    <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-danger" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
