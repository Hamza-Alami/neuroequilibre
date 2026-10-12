'use client';

import { ChevronRight, Search, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { listClientsWithStats } from '@/lib/db/clients';
import { errorMessage } from '@/lib/db/errors';
import { useAsync } from '@/lib/hooks';
import { calculateAge, fmt } from '@/lib/time';
import { getInitials, normalizeSearch } from '@/lib/utils';

type Sort = 'name' | 'recent' | 'next';

export default function ClientsPage() {
  const { data, loading, error } = useAsync(listClientsWithStats, []);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('name');

  const rows = useMemo(() => {
    const now = new Date().toISOString();
    const q = normalizeSearch(query);
    const list = (data ?? [])
      .map((c) => {
        const active = c.sessions.filter((s) => s.status !== 'cancelled').sort((a, b) => a.starts_at.localeCompare(b.starts_at));
        return {
          client: c,
          count: active.length,
          next: active.find((s) => s.starts_at >= now)?.starts_at ?? null,
          last: [...active].reverse().find((s) => s.starts_at < now)?.starts_at ?? null,
        };
      })
      .filter(({ client: c }) =>
        !q || normalizeSearch(`${c.first_name} ${c.last_name} ${c.last_name} ${c.first_name} ${c.phone} ${c.email} ${c.city}`).includes(q)
      );
    if (sort === 'recent') list.sort((a, b) => b.client.created_at.localeCompare(a.client.created_at));
    if (sort === 'next') list.sort((a, b) => (a.next ?? '9999').localeCompare(b.next ?? '9999'));
    return list;
  }, [data, query, sort]);

  return (
    <>
      <PageHeader
        eyebrow="Clients"
        title="Clients"
        description={data ? `${data.length} client${data.length > 1 ? 's' : ''} enregistré${data.length > 1 ? 's' : ''}` : undefined}
        actions={
          <Button icon={UserPlus} href="/clients/new">
            Nouveau client
          </Button>
        }
      />

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nom, téléphone, email, ville…"
              className="pl-9"
            />
          </div>
          <Segmented
            size="sm"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'name', label: 'A → Z' },
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
            title={query ? 'Aucun résultat' : 'Aucun client'}
            description={query ? 'Essayez un autre nom ou numéro.' : 'Créez la première fiche client pour commencer.'}
            action={!query && <Button icon={UserPlus} href="/clients/new">Nouveau client</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  <th className="px-5 py-3">Client</th>
                  <th className="px-3 py-3">Téléphone</th>
                  <th className="px-3 py-3">Ville</th>
                  <th className="px-3 py-3 text-center">Séances</th>
                  <th className="px-3 py-3">Prochaine séance</th>
                  <th className="px-3 py-3">Dernière séance</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ client: c, count, next, last }) => (
                  <tr key={c.id} className="group relative hover:bg-surface-muted/70">
                    <td className="px-5 py-3">
                      <Link href={`/clients/${c.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-50 text-[12px] font-semibold text-navy">
                          {getInitials(c.first_name, c.last_name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium text-ink">
                            {c.first_name} {c.last_name}
                          </span>
                          <span className="block truncate text-[12px] text-ink-muted">
                            {calculateAge(c.date_of_birth)} ans · {c.email}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="tabular px-3 py-3 text-[13px] text-ink-soft">{c.phone}</td>
                    <td className="px-3 py-3 text-[13px] text-ink-soft">{c.city}</td>
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
