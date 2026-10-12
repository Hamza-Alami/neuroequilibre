'use client';

import { Cake, CalendarDays, CalendarPlus, ClipboardList, Clock, MessageCircle, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { SessionDetailModal } from '@/components/booking/SessionDetailModal';
import { MessageModal } from '@/components/messages/MessageModal';
import { AgendaList } from '@/components/planning/AgendaList';
import { BoxTag } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, StatCard } from '@/components/ui/Card';
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback';
import { getSupabase } from '@/lib/supabase/client';
import { upcomingBirthdays } from '@/lib/birthdays';
import { errorMessage, unwrap } from '@/lib/db/errors';
import { useLegacyData } from '@/lib/db/legacy-import';
import { listSessionsBetween } from '@/lib/db/sessions';
import { useAsync } from '@/lib/hooks';
import { addDaysToKey, fmt, formatCalendarDate, formatTime, nowInCentre, sessionEnd, todayKey, utcBounds } from '@/lib/time';
import type { Client, SessionWithRelations } from '@/lib/types';
import { fullName } from '@/lib/utils';

type BirthdayClient = Pick<Client, 'id' | 'code' | 'first_name' | 'last_name' | 'date_of_birth' | 'phone' | 'email'>;

function greeting() {
  const h = nowInCentre().getHours();
  return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
}

export default function DashboardPage() {
  const { profile, settings, activeBoxes, isAdmin } = useApp();
  const [selected, setSelected] = useState<SessionWithRelations | null>(null);
  const legacy = useLegacyData();
  const hasLegacy = isAdmin && Boolean(legacy);
  const today = todayKey();

  const data = useAsync(async () => {
    const recent = utcBounds(addDaysToKey(today, -30), addDaysToKey(today, 14));
    const [sessions, clients] = await Promise.all([
      listSessionsBetween(recent.start, recent.end),
      getSupabase().from('clients').select('id, code, first_name, last_name, date_of_birth, phone, email'),
    ]);
    const list = unwrap(clients) as BirthdayClient[];
    return { sessions, clientCount: list.length, birthdays: upcomingBirthdays(list, today).filter((b) => b.daysUntil < 7) };
  }, [today]);
  const [wishing, setWishing] = useState<BirthdayClient | null>(null);

  const view = useMemo(() => {
    const sessions = (data.data?.sessions ?? []).filter((s) => s.status !== 'cancelled');
    const now = new Date().toISOString();
    const todayList = sessions.filter((s) => fmt(s.starts_at, 'yyyy-MM-dd') === today);
    const weekEnd = addDaysToKey(today, 7);
    const upcoming = sessions.filter((s) => s.starts_at >= now && fmt(s.starts_at, 'yyyy-MM-dd') > today && fmt(s.starts_at, 'yyyy-MM-dd') <= weekEnd);
    const pendingEval = sessions
      .filter((s) => s.starts_at < now && !s.has_assessment)
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    const nextStart = todayList.find((s) => s.starts_at >= now)?.starts_at;
    const nextToday = nextStart
      ? todayList
          .filter((s) => s.starts_at === nextStart)
          .sort((a, b) => (a.box?.name ?? '').localeCompare(b.box?.name ?? '', 'fr', { numeric: true }))
      : [];
    return { todayList, upcoming, pendingEval, nextToday };
  }, [data.data, today]);

  const firstName = profile.full_name.split(' ')[0] || '';

  return (
    <>
      <div className="mb-8">
        <p className="text-[13px] font-medium capitalize text-gold-700">{formatCalendarDate(today, 'EEEE d MMMM yyyy')}</p>
        <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.02em] text-ink sm:text-[30px]">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        {settings.welcome_message && <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-muted">{settings.welcome_message}</p>}
      </div>

      {hasLegacy && (
        <Alert
          tone="info"
          className="mb-6"
          title="Données de l’ancienne version détectées sur ce navigateur"
          action={
            <Button size="sm" variant="secondary" href="/admin/parametres#import">
              Importer dans la base
            </Button>
          }
        >
          Des clients enregistrés avant la mise en place de la base de données peuvent être importés.
        </Alert>
      )}

      {data.error ? (
        <Alert tone="error">{errorMessage(data.error)}</Alert>
      ) : data.loading && !data.data ? (
        <PageLoader />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={CalendarDays} label="Séances aujourd’hui" value={view.todayList.length} hint={`${activeBoxes.length} box${activeBoxes.length > 1 ? 'es' : ''} actif${activeBoxes.length > 1 ? 's' : ''}`} />
            <StatCard
              icon={Clock}
              tone="gold"
              label={view.nextToday.length > 1 ? `Prochaines séances (${view.nextToday.length})` : 'Prochaine séance'}
              value={<span className="text-[18px]">{view.nextToday.length ? formatTime(view.nextToday[0].starts_at) : '—'}</span>}
              hint={
                view.nextToday.length
                  ? view.nextToday.map((s) => (
                      <span key={s.id} className="block">
                        {s.box?.name} · {fullName(s.client)}
                      </span>
                    ))
                  : 'Plus de séance aujourd’hui'
              }
            />
            <StatCard icon={CalendarPlus} tone="success" label="7 prochains jours" value={view.upcoming.length} hint="séances réservées" />
            <StatCard icon={Users} tone="muted" label="Clients" value={data.data?.clientCount ?? 0} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card padded={false} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-ink">Aujourd’hui par box</h2>
                  <p className="text-[12px] text-ink-muted">Cliquez sur une séance pour la gérer.</p>
                </div>
                <Button variant="ghost" size="sm" href={`/planning?view=day&date=${today}`}>
                  Planning du jour
                </Button>
              </div>
              {activeBoxes.length === 0 ? (
                <EmptyState title="Aucun box actif" />
              ) : (
                <div className="grid divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
                  {activeBoxes.map((b) => {
                    const list = view.todayList.filter((s) => s.box_id === b.id);
                    return (
                      <div key={b.id} className="min-w-0">
                        <div className="flex items-center justify-between px-5 py-3">
                          <BoxTag name={b.name} color={b.color} />
                          <span className="tabular text-[12px] text-ink-muted">{list.length}</span>
                        </div>
                        {list.length === 0 ? (
                          <p className="px-5 pb-5 text-[13px] text-ink-muted">Aucune séance.</p>
                        ) : (
                          <ul className="space-y-1.5 px-3 pb-4">
                            {list.map((s) => {
                              const past = s.starts_at < new Date().toISOString();
                              return (
                                <li key={s.id}>
                                  <button
                                    type="button"
                                    onClick={() => setSelected(s)}
                                    className="flex w-full items-center gap-3 rounded-lg border-l-[3px] px-3 py-2 text-left hover:shadow-card"
                                    style={{ borderLeftColor: b.color, background: `color-mix(in srgb, ${b.color} 8%, white)`, opacity: past ? 0.7 : 1 }}
                                  >
                                    <span className="tabular w-[86px] shrink-0 text-[12px] font-semibold text-ink">
                                      {formatTime(s.starts_at)} – {formatTime(sessionEnd(s.starts_at, s.duration_minutes))}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{fullName(s.client)}</span>
                                    {s.session_number && <span className="text-[11px] text-ink-muted">S{s.session_number}</span>}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader title="Actions rapides" className="mb-3" />
                <div className="grid gap-2">
                  <Button icon={CalendarPlus} href="/sessions/new" fullWidth className="justify-start">
                    Réserver une séance
                  </Button>
                  <Button variant="secondary" icon={UserPlus} href="/clients/new" fullWidth className="justify-start">
                    Nouveau client
                  </Button>
                  <Button variant="secondary" icon={Users} href="/clients" fullWidth className="justify-start">
                    Rechercher un client
                  </Button>
                </div>
              </Card>

              {(data.data?.birthdays.length ?? 0) > 0 && (
                <Card padded={false} className="overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-line px-5 py-4">
                    <Cake className="h-4 w-4 text-gold" />
                    <h2 className="text-[15px] font-semibold text-ink">Anniversaires</h2>
                    <Link href="/etats/anniversaires" className="ml-auto text-[12px] font-medium text-navy hover:underline">
                      Tout voir
                    </Link>
                  </div>
                  <ul className="divide-y divide-line">
                    {data.data!.birthdays.map((b) => (
                      <li key={b.client.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                        <Link href={`/clients/${b.client.id}`} className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-ink hover:text-navy">
                            {b.client.first_name} {b.client.last_name}
                          </span>
                          <span className="block text-[12px] text-ink-muted">
                            {b.daysUntil === 0 ? 'Aujourd’hui' : b.daysUntil === 1 ? 'Demain' : formatCalendarDate(b.next, 'EEEE d MMMM')} · {b.age} ans
                          </span>
                        </Link>
                        <Button
                          size="sm"
                          variant={b.daysUntil === 0 ? 'accent' : 'ghost'}
                          icon={MessageCircle}
                          title="Souhaiter un joyeux anniversaire"
                          onClick={() => setWishing(b.client)}
                        />
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card padded={false} className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-line px-5 py-4">
                  <ClipboardList className="h-4 w-4 text-warning" />
                  <h2 className="text-[15px] font-semibold text-ink">Évaluations à compléter</h2>
                  <span className="tabular ml-auto rounded-full bg-warning-50 px-2 text-[12px] font-medium text-warning">{view.pendingEval.length}</span>
                </div>
                {view.pendingEval.length === 0 ? (
                  <p className="px-5 py-5 text-[13px] text-ink-muted">Tout est à jour.</p>
                ) : (
                  <ul className="max-h-72 divide-y divide-line overflow-y-auto scrollbar-thin">
                    {view.pendingEval.slice(0, 12).map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/clients/${s.client_id}/evaluation/${s.id}`}
                          className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-surface-muted"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium text-ink">{fullName(s.client)}</span>
                            <span className="block text-[12px] text-ink-muted">
                              S{s.session_number} · {fmt(s.starts_at, "d MMM 'à' HH:mm")}
                            </span>
                          </span>
                          <span className="text-[12px] font-medium text-navy">Remplir</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          <Card padded={false} className="mt-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-semibold text-ink">Les 7 prochains jours</h2>
              <Button variant="ghost" size="sm" href="/planning?view=week">
                Vue semaine
              </Button>
            </div>
            {view.upcoming.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Aucune séance prévue" description="Les prochaines réservations apparaîtront ici." />
            ) : (
              <AgendaList sessions={view.upcoming} onSelectSession={setSelected} />
            )}
          </Card>
        </>
      )}

      <SessionDetailModal session={selected} onClose={() => setSelected(null)} onChanged={() => data.reload({ silent: true })} />
      {wishing && <MessageModal open client={wishing} sessions={[]} initialKind="birthday" onClose={() => setWishing(null)} />}
    </>
  );
}
