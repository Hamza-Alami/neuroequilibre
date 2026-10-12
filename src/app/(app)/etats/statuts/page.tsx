'use client';

import { Search, UserCheck, UserMinus, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { ExportButtons } from '@/components/reports/ExportButtons';
import { ClientStatusBadge } from '@/components/ui/Badge';
import { Card, StatCard } from '@/components/ui/Card';
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { listClients } from '@/lib/db/clients';
import { errorMessage } from '@/lib/db/errors';
import { listSources } from '@/lib/db/sources';
import { CLIENT_STATUS_LABELS, getClientStatuses } from '@/lib/db/status';
import { useAsync, useDebounced } from '@/lib/hooks';
import { presetRange } from '@/lib/periods';
import { formatCalendarDate, todayKey } from '@/lib/time';
import { cn, normalizeSearch } from '@/lib/utils';

type Filter = 'all' | 'active' | 'inactive';

export default function StatusReportPage() {
  const { settings } = useApp();
  const today = todayKey();
  const [date, setDate] = useState(today);
  const debouncedDate = useDebounced(date, 300);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const base = useAsync(async () => {
    const [clients, sources] = await Promise.all([listClients(), listSources({ includeInactive: true })]);
    return { clients, sources: new Map(sources.map((s) => [s.id, s.label])) };
  }, []);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(debouncedDate) ? debouncedDate : today;
  const statuses = useAsync(() => getClientStatuses(validDate), [validDate]);

  const all = useMemo(() => {
    if (!base.data || !statuses.data) return [];
    return base.data.clients
      .filter((c) => statuses.data!.has(c.id))
      .map((c) => ({ client: c, status: statuses.data!.get(c.id)!, source: c.source_id ? base.data!.sources.get(c.source_id) : undefined }))
      .sort((a, b) => a.client.last_name.localeCompare(b.client.last_name, 'fr') || a.client.first_name.localeCompare(b.client.first_name, 'fr'));
  }, [base.data, statuses.data]);

  const active = all.filter((r) => r.status.status === 'active').length;
  const inactive = all.length - active;
  const rows = useMemo(() => {
    const q = normalizeSearch(query);
    return all.filter(
      (r) =>
        (filter === 'all' || r.status.status === filter) &&
        (!q || normalizeSearch(`${r.client.code} ${r.client.first_name} ${r.client.last_name} ${r.client.phone}`).includes(q))
    );
  }, [all, filter, query]);

  const shortcuts = [
    { label: 'Aujourd’hui', value: today },
    { label: 'Fin du mois dernier', value: presetRange('last_month', today).to },
    { label: 'Fin du trimestre dernier', value: presetRange('last_quarter', today).to },
    { label: 'Fin de l’année dernière', value: presetRange('last_year', today).to },
  ];

  function buildExport() {
    return {
      title: 'État des clients actifs / inactifs',
      subtitle: `Au ${formatCalendarDate(validDate)}${filter !== 'all' ? ` · ${filter === 'active' ? 'actifs' : 'inactifs'} uniquement` : ''}`,
      centreName: settings.centre_name,
      fileBase: `clients-statuts-${validDate}`,
      columns: [
        { header: 'Code', width: 22 },
        { header: 'Client' },
        { header: 'Téléphone', width: 32 },
        { header: 'Origine', width: 30 },
        { header: 'Statut', width: 20 },
        { header: 'Motif', width: 48 },
      ],
      rows: rows.map((r) => [
        r.client.code,
        `${r.client.first_name} ${r.client.last_name}`,
        r.client.phone,
        r.source ?? '',
        CLIENT_STATUS_LABELS[r.status.status] + (r.status.is_override ? ' (manuel)' : ''),
        r.status.reason,
      ]),
      summary: [`${all.length} client(s)`, `${active} actif(s)`, `${inactive} inactif(s)`],
    };
  }

  if (base.loading) return <PageLoader />;
  if (base.error) return <Alert tone="error">{errorMessage(base.error)}</Alert>;

  return (
    <>
      <Card className="mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <Field label="Statut des clients au" className="md:w-56">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {shortcuts.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setDate(s.value)}
                className={cn(
                  'h-8 rounded-full border px-3 text-[12px] font-medium transition-colors',
                  date === s.value ? 'border-navy bg-navy-50 text-navy' : 'border-line text-ink-soft hover:bg-surface-muted'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
          Un client est <strong>actif</strong> à cette date s’il avait un pack en cours ou une séance prévue (sauf statut forcé
          manuellement). Les clients enregistrés après cette date ne sont pas comptés.
        </p>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Clients à cette date" value={statuses.loading ? '…' : all.length} />
        <StatCard
          icon={UserCheck}
          tone="success"
          label="Actifs"
          value={statuses.loading ? '…' : active}
          hint={all.length ? `${Math.round((active / all.length) * 100)} % des clients` : undefined}
        />
        <StatCard icon={UserMinus} tone="muted" label="Inactifs" value={statuses.loading ? '…' : inactive} />
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
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'Tous', count: all.length },
                { value: 'active', label: 'Actifs', count: active },
                { value: 'inactive', label: 'Inactifs', count: inactive },
              ]}
            />
          </div>
          <ExportButtons build={buildExport} disabled={!rows.length || statuses.loading} />
        </div>

        {statuses.error ? (
          <div className="p-5">
            <Alert tone="error">{errorMessage(statuses.error)}</Alert>
          </div>
        ) : statuses.loading ? (
          <PageLoader />
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title="Aucun client" description="Aucun client ne correspond à ces critères à cette date." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  <th className="px-5 py-3">Code</th>
                  <th className="px-3 py-3">Client</th>
                  <th className="px-3 py-3">Téléphone</th>
                  <th className="px-3 py-3">Origine</th>
                  <th className="px-3 py-3">Statut</th>
                  <th className="px-3 py-3">Motif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.client.id} className="hover:bg-surface-muted/60">
                    <td className="tabular px-5 py-2.5 text-[13px] font-medium text-gold-700">{r.client.code}</td>
                    <td className="px-3 py-2.5">
                      <Link href={`/clients/${r.client.id}`} className="text-[14px] font-medium text-ink hover:text-navy hover:underline">
                        {r.client.first_name} {r.client.last_name}
                      </Link>
                    </td>
                    <td className="tabular px-3 py-2.5 text-[13px] text-ink-soft">{r.client.phone}</td>
                    <td className="px-3 py-2.5 text-[13px] text-ink-soft">{r.source ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <ClientStatusBadge status={r.status.status} forced={r.status.is_override} />
                    </td>
                    <td className="px-3 py-2.5 text-[13px] text-ink-muted">{r.status.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
