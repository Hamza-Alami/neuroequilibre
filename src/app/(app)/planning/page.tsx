'use client';

import {
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
  List,
  Lock,
  Search,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { BlockModal, type BlockDraft } from '@/components/booking/BlockModal';
import { SessionDetailModal } from '@/components/booking/SessionDetailModal';
import { AgendaList } from '@/components/planning/AgendaList';
import { DayView } from '@/components/planning/DayView';
import { WeekView } from '@/components/planning/WeekView';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/db/errors';
import { listSessionsBetween } from '@/lib/db/sessions';
import { listBlocks } from '@/lib/db/settings';
import { exportPlanningCsv, exportPlanningPdf } from '@/lib/export/planning';
import { useAsync } from '@/lib/hooks';
import { STATUS_LABELS, displayStatus } from '@/lib/status';
import {
  addDaysToKey,
  formatCalendarDate,
  minutesOf,
  rangeFor,
  timeOfMinutes,
  isPastSlot,
  todayKey,
  utcBounds,
} from '@/lib/time';
import type { DisplayStatus, SessionWithRelations } from '@/lib/types';
import { normalizeSearch } from '@/lib/utils';

type View = 'day' | 'week' | 'month';
type StatusFilter = 'all' | DisplayStatus;

function shift(view: View, date: string, dir: 1 | -1) {
  if (view === 'day') return addDaysToKey(date, dir);
  if (view === 'week') return addDaysToKey(date, 7 * dir);
  const [y, m] = date.split('-').map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function periodLabel(view: View, from: string, to: string) {
  if (view === 'day') return formatCalendarDate(from, 'EEEE d MMMM yyyy');
  if (view === 'week') {
    return `Du ${formatCalendarDate(from, 'd MMM')} au ${formatCalendarDate(to, 'd MMM yyyy')}`;
  }
  return formatCalendarDate(from, 'MMMM yyyy');
}

function PlanningContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { settings, boxes, isAdmin } = useApp();
  const toast = useToast();

  const view = (['day', 'week', 'month'].includes(params.get('view') ?? '') ? params.get('view') : 'day') as View;
  const date = params.get('date') ?? todayKey();
  const boxFilter = params.get('box') ?? 'all';
  const statusFilter = (params.get('status') ?? 'all') as StatusFilter;
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SessionWithRelations | null>(null);
  const [slotAction, setSlotAction] = useState<{ boxId: string; time: string } | null>(null);
  const [blockDraft, setBlockDraft] = useState<BlockDraft | null>(null);
  const [exporting, setExporting] = useState(false);

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === 'all') next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const { from, to } = rangeFor(view, date);
  const data = useAsync(async () => {
    const { start, end } = utcBounds(from, to);
    const [sessions, blocks] = await Promise.all([listSessionsBetween(start, end), listBlocks(start, end)]);
    return { sessions, blocks };
  }, [from, to]);

  const allSessions = useMemo(() => data.data?.sessions ?? [], [data.data]);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    return allSessions.filter((s) => {
      if (boxFilter !== 'all' && s.box_id !== boxFilter) return false;
      if (statusFilter !== 'all' && displayStatus(s) !== statusFilter) return false;
      if (q && !normalizeSearch(`${s.client?.first_name} ${s.client?.last_name}`).includes(q)) return false;
      return true;
    });
  }, [allSessions, boxFilter, statusFilter, query]);

  const visibleBoxes = useMemo(() => {
    const withSessions = new Set(allSessions.map((s) => s.box_id));
    return boxes.filter(
      (b) => (boxFilter === 'all' || b.id === boxFilter) && (b.is_active || withSessions.has(b.id))
    );
  }, [boxes, allSessions, boxFilter]);

  const counts = useMemo(() => {
    const base = allSessions.filter((s) => boxFilter === 'all' || s.box_id === boxFilter);
    const c: Record<StatusFilter, number> = { all: base.length, upcoming: 0, past: 0, completed: 0, cancelled: 0 };
    base.forEach((s) => c[displayStatus(s)]++);
    return c;
  }, [allSessions, boxFilter]);

  const label = periodLabel(view, from, to);

  async function doExport(kind: 'csv' | 'pdf') {
    const filters = [
      boxFilter !== 'all' ? `Box : ${boxes.find((b) => b.id === boxFilter)?.name}` : '',
      statusFilter !== 'all' ? `Statut : ${STATUS_LABELS[statusFilter]}` : '',
      query ? `Recherche : ${query}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const ctx = {
      sessions: filtered,
      periodLabel: label.charAt(0).toUpperCase() + label.slice(1),
      filtersLabel: filters,
      centreName: settings.centre_name,
      fileBase: `planning-${from}${to !== from ? `_${to}` : ''}`,
    };
    setExporting(true);
    try {
      if (kind === 'csv') exportPlanningCsv(ctx);
      else await exportPlanningPdf(ctx);
    } catch (e) {
      toast.error(e);
    } finally {
      setExporting(false);
    }
  }

  function onEmptyClick(boxId: string, time: string) {
    if (isPastSlot(date, time) && !isAdmin) {
      toast.info('Ce créneau est déjà passé.');
      return;
    }
    setSlotAction({ boxId, time });
  }

  const slotBox = slotAction ? boxes.find((b) => b.id === slotAction.boxId) : null;
  const slotPast = slotAction ? isPastSlot(date, slotAction.time) : false;

  return (
    <>
      <PageHeader
        eyebrow="Activité"
        title="Planning"
        description="Toutes les réservations passées et à venir, par box."
        actions={
          <>
            <Button variant="secondary" icon={FileSpreadsheet} onClick={() => doExport('csv')} disabled={exporting}>
              CSV
            </Button>
            <Button variant="secondary" icon={FileDown} onClick={() => doExport('pdf')} loading={exporting}>
              PDF
            </Button>
            {isAdmin && (
              <Button
                variant="secondary"
                icon={Lock}
                onClick={() => setBlockDraft({ boxId: null, date, start: '09:00', end: '10:00' })}
              >
                Bloquer
              </Button>
            )}
            <Button icon={CalendarPlus} href={`/sessions/new?date=${date >= todayKey() ? date : todayKey()}`}>
              Réserver
            </Button>
          </>
        }
      />

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={view}
              onChange={(v) => setParams({ view: v })}
              options={[
                { value: 'day', label: 'Jour', icon: CalendarDays },
                { value: 'week', label: 'Semaine', icon: CalendarRange },
                { value: 'month', label: 'Mois', icon: List },
              ]}
            />
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" icon={ChevronLeft} title="Période précédente" onClick={() => setParams({ date: shift(view, date, -1) })} />
              <Button variant="secondary" size="sm" onClick={() => setParams({ date: null })}>
                Aujourd’hui
              </Button>
              <Button variant="ghost" size="sm" icon={ChevronRight} title="Période suivante" onClick={() => setParams({ date: shift(view, date, 1) })} />
            </div>
            <Input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setParams({ date: e.target.value })}
              className="h-8 w-[150px] text-[13px]"
            />
            <p className="ml-1 text-[15px] font-semibold capitalize text-ink">{label}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Client…"
                className="h-8 w-40 pl-8 text-[13px]"
              />
            </div>
            <Select value={boxFilter} onChange={(e) => setParams({ box: e.target.value })} className="h-8 w-36 text-[13px]">
              <option value="all">Tous les boxes</option>
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="border-b border-line px-4 py-2.5">
          <Segmented
            size="sm"
            value={statusFilter}
            onChange={(v) => setParams({ status: v })}
            options={[
              { value: 'all', label: 'Toutes', count: counts.all },
              { value: 'upcoming', label: 'À venir', count: counts.upcoming },
              { value: 'past', label: 'Passées', count: counts.past },
              { value: 'completed', label: 'Réalisées', count: counts.completed },
              { value: 'cancelled', label: 'Annulées', count: counts.cancelled },
            ]}
          />
        </div>

        {data.error ? (
          <div className="p-6">
            <Alert tone="error" title="Impossible de charger le planning">
              {errorMessage(data.error)}
            </Alert>
          </div>
        ) : data.loading && !data.data ? (
          <PageLoader />
        ) : view === 'day' ? (
          visibleBoxes.length === 0 ? (
            <EmptyState title="Aucun box actif" description="Ajoutez ou activez un box dans l’administration." />
          ) : (
            <DayView
              day={date}
              boxes={visibleBoxes}
              sessions={filtered}
              blocks={data.data?.blocks ?? []}
              settings={settings}
              onSelectSession={setSelected}
              onEmptyClick={onEmptyClick}
            />
          )
        ) : view === 'week' ? (
          <WeekView
            from={from}
            boxes={visibleBoxes}
            sessions={filtered}
            blocks={data.data?.blocks ?? []}
            settings={settings}
            onSelectSession={setSelected}
            onSelectDay={(d) => setParams({ view: 'day', date: d })}
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Aucune séance" description="Aucune séance ne correspond à ces filtres sur cette période." />
        ) : (
          <AgendaList sessions={filtered} onSelectSession={setSelected} />
        )}
      </Card>

      <SessionDetailModal session={selected} onClose={() => setSelected(null)} onChanged={() => data.reload({ silent: true })} />

      <Modal
        open={Boolean(slotAction)}
        onClose={() => setSlotAction(null)}
        size="sm"
        title={slotBox ? `${slotBox.name} · ${slotAction?.time}` : 'Créneau'}
        description={formatCalendarDate(date, 'EEEE d MMMM yyyy')}
      >
        <div className="space-y-2">
          {slotPast ? (
            <Alert tone="info">Ce créneau est déjà passé : la réservation n’est plus possible.</Alert>
          ) : (
            <Button
              fullWidth
              icon={CalendarPlus}
              href={`/sessions/new?box=${slotAction?.boxId}&date=${date}&time=${slotAction?.time}`}
            >
              Réserver ce créneau
            </Button>
          )}
          {isAdmin && slotAction && (
            <Button
              fullWidth
              variant="secondary"
              icon={Lock}
              onClick={() => {
                const start = slotAction.time;
                setBlockDraft({
                  boxId: slotAction.boxId,
                  date,
                  start,
                  end: timeOfMinutes(Math.min(minutesOf(start) + settings.default_session_minutes, 23 * 60 + 55)),
                });
                setSlotAction(null);
              }}
            >
              Bloquer ce créneau
            </Button>
          )}
        </div>
      </Modal>

      <BlockModal draft={blockDraft} onClose={() => setBlockDraft(null)} onCreated={() => data.reload({ silent: true })} />
    </>
  );
}

export default function PlanningPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PlanningContent />
    </Suspense>
  );
}
