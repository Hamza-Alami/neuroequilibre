'use client';

import { Cake, MessageCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { MessageModal } from '@/components/messages/MessageModal';
import { ExportButtons } from '@/components/reports/ExportButtons';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, StatCard } from '@/components/ui/Card';
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { upcomingBirthdays } from '@/lib/birthdays';
import { listClients } from '@/lib/db/clients';
import { errorMessage } from '@/lib/db/errors';
import { useAsync } from '@/lib/hooks';
import { formatCalendarDate, todayKey } from '@/lib/time';
import type { Client } from '@/lib/types';
import { normalizeSearch } from '@/lib/utils';

type Range = '30' | '90' | '365';

function whenLabel(days: number) {
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Demain';
  return `Dans ${days} jours`;
}

export default function BirthdaysPage() {
  const { settings } = useApp();
  const clients = useAsync(() => listClients(), []);
  const [range, setRange] = useState<Range>('365');
  const [query, setQuery] = useState('');
  const [messaging, setMessaging] = useState<Client | null>(null);
  const today = todayKey();

  const all = useMemo(() => upcomingBirthdays(clients.data ?? [], today), [clients.data, today]);
  const rows = useMemo(() => {
    const q = normalizeSearch(query);
    return all.filter(
      (r) =>
        r.daysUntil < Number(range) &&
        (!q || normalizeSearch(`${r.client.code} ${r.client.first_name} ${r.client.last_name}`).includes(q))
    );
  }, [all, range, query]);

  const byMonth = useMemo(() => {
    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      if (!groups.has(r.month)) groups.set(r.month, []);
      groups.get(r.month)!.push(r);
    }
    return [...groups.entries()];
  }, [rows]);

  const todayCount = all.filter((r) => r.daysUntil === 0).length;
  const weekCount = all.filter((r) => r.daysUntil < 7).length;
  const monthCount = all.filter((r) => r.month === today.slice(0, 7)).length;

  function buildExport() {
    return {
      title: 'Anniversaires des clients',
      subtitle: `À partir du ${formatCalendarDate(today)}`,
      centreName: settings.centre_name,
      fileBase: `anniversaires-${today}`,
      columns: [
        { header: 'Date', width: 34 },
        { header: 'Code', width: 22 },
        { header: 'Client' },
        { header: 'Âge', width: 16, align: 'center' as const },
        { header: 'Téléphone', width: 34 },
        { header: 'Échéance', width: 28 },
      ],
      rows: byMonth.flatMap(([month, list]) => [
        { group: `${formatCalendarDate(`${month}-01`, 'MMMM yyyy')} · ${list.length} anniversaire(s)` },
        ...list.map((r) => [
          formatCalendarDate(r.next, 'EEEE d MMMM'),
          r.client.code,
          `${r.client.first_name} ${r.client.last_name}`,
          `${r.age} ans`,
          r.client.phone,
          whenLabel(r.daysUntil),
        ]),
      ]),
      summary: [`${rows.length} anniversaire(s)`, `${todayCount} aujourd'hui`, `${weekCount} dans les 7 jours`],
    };
  }

  if (clients.loading) return <PageLoader />;
  if (clients.error) return <Alert tone="error">{errorMessage(clients.error)}</Alert>;

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Cake} tone="gold" label="Aujourd’hui" value={todayCount} />
        <StatCard icon={Cake} label="7 prochains jours" value={weekCount} />
        <StatCard icon={Cake} tone="muted" label={`En ${formatCalendarDate(today, 'MMMM')}`} value={monthCount} />
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un client…" className="h-9 pl-9 text-[13px]" />
            </div>
            <Segmented
              size="sm"
              value={range}
              onChange={setRange}
              options={[
                { value: '30', label: '30 jours' },
                { value: '90', label: '3 mois' },
                { value: '365', label: '12 mois' },
              ]}
            />
          </div>
          <ExportButtons build={buildExport} disabled={!rows.length} />
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Cake} title="Aucun anniversaire" description="Aucun anniversaire sur la période ou pour cette recherche." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-3 py-3">Client</th>
                  <th className="px-3 py-3">Âge</th>
                  <th className="px-3 py-3">Téléphone</th>
                  <th className="px-3 py-3">Échéance</th>
                  <th className="w-24" />
                </tr>
              </thead>
              {byMonth.map(([month, list]) => (
                <tbody key={month} className="divide-y divide-line border-b border-line">
                  <tr className="bg-gold-50/60">
                    <td colSpan={6} className="px-5 py-2 text-[12px] font-semibold uppercase tracking-wide text-gold-700">
                      {formatCalendarDate(`${month}-01`, 'MMMM yyyy')}
                      <span className="ml-2 font-normal normal-case tracking-normal text-ink-muted">
                        {list.length} anniversaire{list.length > 1 ? 's' : ''}
                      </span>
                    </td>
                  </tr>
                  {list.map((r) => (
                    <tr key={r.client.id} className={r.daysUntil === 0 ? 'bg-gold-50/30' : undefined}>
                      <td className="px-5 py-2.5 text-[13px] capitalize text-ink">{formatCalendarDate(r.next, 'EEEE d MMMM')}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/clients/${r.client.id}`} className="text-[14px] font-medium text-ink hover:text-navy hover:underline">
                          {r.client.first_name} {r.client.last_name}
                        </Link>
                        <span className="tabular ml-2 text-[12px] text-ink-muted">{r.client.code}</span>
                      </td>
                      <td className="tabular px-3 py-2.5 text-[13px] text-ink-soft">{r.age} ans</td>
                      <td className="tabular px-3 py-2.5 text-[13px] text-ink-soft">{r.client.phone}</td>
                      <td className="px-3 py-2.5">
                        {r.daysUntil === 0 ? (
                          <Badge tone="gold">Aujourd’hui</Badge>
                        ) : (
                          <span className="text-[13px] text-ink-muted">{whenLabel(r.daysUntil)}</span>
                        )}
                      </td>
                      <td className="pr-4 text-right">
                        <Button size="sm" variant={r.daysUntil === 0 ? 'primary' : 'ghost'} icon={MessageCircle} onClick={() => setMessaging(r.client)}>
                          Souhaiter
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </Card>

      {messaging && (
        <MessageModal open client={messaging} sessions={[]} initialKind="birthday" onClose={() => setMessaging(null)} />
      )}
    </>
  );
}
