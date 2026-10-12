'use client';

import { ChevronRight, Search, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type MouseEvent, useMemo, useState } from 'react';
import { ClientStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { listClientsWithStats } from '@/lib/db/clients';
import { errorMessage } from '@/lib/db/errors';
import { listSources } from '@/lib/db/sources';
import { getClientStatuses } from '@/lib/db/status';
import { useAsync } from '@/lib/hooks';
import { calculateAge, fmt, todayKey } from '@/lib/time';
import { getInitials, normalizeSearch } from '@/lib/utils';

type Sort = 'name' | 'code' | 'recent' | 'next';
type StatusFilter = 'all' | 'active' | 'inactive';

export default function ClientsPage() {
  const { data, loading, error } = useAsync(async () => {
    const [clients, statuses, sources] = await Promise.all([
      listClientsWithStats(),
      getClientStatuses(todayKey()),
      listSources({ includeInactive: true }),
    ]);
    return { clients, statuses, sources: new Map(sources.map((s) => [s.id, s.label])) };
  }, []);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState('');
  const router = useRouter();

  const all = useMemo(() => {
    if (!data) return [];
    const now = new Date().toISOString();
    return data.clients.map((c) => {
      const active = c.sessions.filter((s) => s.status !== 'cancelled').sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      return {
        client: c,
        status: data.statuses.get(c.id) ?? null,
        source: c.source_id ? (data.sources.get(c.source_id) ?? null) : null,
        count: active.length,
        next: active.find((s) => s.starts_at >= now)?.starts_at ?? null,
        last: [...active].reverse().find((s) => s.starts_at < now)?.starts_at ?? null,
      };
    });
  }, [data]);

  const counts = useMemo(
    () => ({
      all: all.length,
      active: all.filter((r) => r.status?.status === 'active').length,
      inactive: all.filter((r) => r.status?.status !== 'active').length,
    }),
    [all]
  );

  const rows = useMemo(() => {
    const q = normalizeSearch(query);
    const list = all.filter(({ client: c, status }) => {
      if (statusFilter === 'active' && status?.status !== 'active') return false;
      if (statusFilter === 'inactive' && status?.status === 'active') return false;
      if (sourceFilter && c.source_id !== sourceFilter) return false;
      return !q || normalizeSearch(`${c.code} ${c.first_name} ${c.last_name} ${c.last_name} ${c.first_name} ${c.phone} ${c.email} ${c.city}`).includes(q);
    });
    if (sort === 'code') list.sort((a, b) => a.client.code.localeCompare(b.client.code, 'fr', { numeric: true }));
    if (sort === 'recent') list.sort((a, b) => b.client.created_at.localeCompare(a.client.created_at));
    if (sort === 'next') list.sort((a, b) => (a.next ?? '9999').localeCompare(b.next ?? '9999'));
    return list;
  }, [all, query, sort, statusFilter, sourceFilter]);

  const filtered = Boolean(query || sourceFilter || statusFilter !== 'all');

  function openRow(e: MouseEvent, id: string) {
    if ((e.target as HTMLElement).closest('a, button')) return;
    const href = `/clients/${id}`;
    if (e.metaKey || e.ctrlKey) window.open(href, '_blank');
    else router.push(href);
  }

  return (
    <>
      <PageHeader
        eyebrow="Clients"
        title="Clients"
        description={data ? `${counts.all} client${counts.all > 1 ? 's' : ''} · ${counts.active} actif${counts.active > 1 ? 's' : ''}` : undefined}
        actions={
          <Button icon={UserPlus} href="/clients/new">
            Nouveau client
          </Button>
        }
      />

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Code, nom, téléphone, email…" className="pl-9" />
            </div>
            <Segmented
              size="sm"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'Tous', count: counts.all },
                { value: 'active', label: 'Actifs', count: counts.active },
                { value: 'inactive', label: 'Inactifs', count: counts.inactive },
              ]}
            />
            <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="h-9 text-[13px] sm:w-48">
              <option value="">Toutes les origines</option>
              {[...(data?.sources ?? new Map<string, string>())].map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <Segmented
            size="sm"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'name', label: 'A → Z' },
              { value: 'code', label: 'Code' },
              { value: 'next', label: 'Prochaine séance' },
              { value: 'recent', label: 'Récents' },
            ]}
          />
        </div>

        {error ? (
          <div className="p-5">
            <Alert tone="error">{errorMessage(error)}</Alert>
          </div>
        ) : loading ? (
          <PageLoader />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filtered ? 'Aucun résultat' : 'Aucun client'}
            description={filtered ? 'Modifiez la recherche ou les filtres.' : 'Créez la première fiche client pour commencer.'}
            action={!filtered && <Button icon={UserPlus} href="/clients/new">Nouveau client</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  <th className="px-5 py-3">Client</th>
                  <th className="px-3 py-3">Statut</th>
                  <th className="px-3 py-3">Téléphone</th>
                  <th className="px-3 py-3">Origine</th>
                  <th className="px-3 py-3 text-center">Séances</th>
                  <th className="px-3 py-3">Prochaine séance</th>
                  <th className="px-3 py-3">Dernière séance</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ client: c, status, source, count, next, last }) => (
                  <tr
                    key={c.id}
                    onClick={(e) => openRow(e, c.id)}
                    className="group cursor-pointer hover:bg-surface-muted/70"
                  >
                    <td className="px-5 py-3">
                      <Link href={`/clients/${c.id}`} className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-50 text-[12px] font-semibold text-navy">
                          {getInitials(c.first_name, c.last_name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium text-ink">
                            {c.first_name} {c.last_name}
                          </span>
                          <span className="block truncate text-[12px] text-ink-muted">
                            <span className="tabular font-medium text-gold-700">{c.code}</span> · {calculateAge(c.date_of_birth)} ans · {c.city}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {status && <ClientStatusBadge status={status.status} forced={status.is_override} title={status.reason} />}
                    </td>
                    <td className="tabular px-3 py-3 text-[13px] text-ink-soft">{c.phone}</td>
                    <td className="px-3 py-3 text-[13px] text-ink-soft">{source ?? <span className="text-ink-muted/60">—</span>}</td>
                    <td className="tabular px-3 py-3 text-center text-[13px] font-medium text-ink">{count}</td>
                    <td className="px-3 py-3 text-[13px]">
                      {next ? <span className="text-navy">{fmt(next, "d MMM yyyy 'à' HH:mm")}</span> : <span className="text-ink-muted/60">—</span>}
                    </td>
                    <td className="px-3 py-3 text-[13px] text-ink-soft">{last ? fmt(last, 'd MMM yyyy') : <span className="text-ink-muted/60">—</span>}</td>
                    <td className="pr-4">
                      <ChevronRight className="h-4 w-4 text-ink-muted/40 group-hover:text-ink-muted" />
                    </td>
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
