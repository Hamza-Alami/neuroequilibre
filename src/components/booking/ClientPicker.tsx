'use client';

import { Check, Search, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Spinner } from '@/components/ui/Feedback';
import type { Client } from '@/lib/types';
import { cn, getInitials, normalizeSearch } from '@/lib/utils';

export function ClientPicker({
  clients,
  loading,
  value,
  onChange,
  error,
}: {
  clients: Client[];
  loading?: boolean;
  value: string | null;
  onChange: (id: string | null) => void;
  error?: string;
}) {
  const [query, setQuery] = useState('');
  const selected = clients.find((c) => c.id === value) ?? null;

  const results = useMemo(() => {
    const q = normalizeSearch(query);
    const list = q
      ? clients.filter((c) =>
          normalizeSearch(`${c.first_name} ${c.last_name} ${c.last_name} ${c.first_name} ${c.phone} ${c.email}`).includes(q)
        )
      : clients;
    return list.slice(0, 8);
  }, [clients, query]);

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-navy/20 bg-navy-50/60 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-[13px] font-semibold text-white">
          {getInitials(selected.first_name, selected.last_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-ink">
            {selected.first_name} {selected.last_name}
          </p>
          <p className="truncate text-[12px] text-ink-muted">
            {selected.phone} · {selected.city}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-navy hover:bg-navy-100"
        >
          Changer
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher par nom, téléphone ou email…"
          className={cn(
            'h-11 w-full rounded-[10px] border bg-surface pl-10 pr-9 text-[14px] text-ink placeholder:text-ink-muted/70 focus:outline-none focus:ring-[3px]',
            error ? 'border-danger/60 focus:ring-danger/15' : 'border-line-strong focus:border-navy focus:ring-navy/10'
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
            aria-label="Effacer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-[12px] text-danger">{error}</p>}

      <div className="mt-2 overflow-hidden rounded-xl border border-line">
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : results.length === 0 ? (
          <div className="px-4 py-5 text-center text-[13px] text-ink-muted">
            {clients.length === 0 ? 'Aucun client enregistré.' : 'Aucun client ne correspond.'}
          </div>
        ) : (
          <ul className="max-h-72 divide-y divide-line overflow-y-auto scrollbar-thin">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onChange(c.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-muted"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-50 text-[12px] font-semibold text-navy">
                    {getInitials(c.first_name, c.last_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-ink">
                      {c.first_name} {c.last_name}
                    </p>
                    <p className="truncate text-[12px] text-ink-muted">{c.phone}</p>
                  </div>
                  <Check className="h-4 w-4 text-transparent" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/clients/new?then=book"
          className="flex items-center gap-2 border-t border-line bg-surface-muted px-4 py-2.5 text-[13px] font-medium text-navy hover:bg-navy-50"
        >
          <UserPlus className="h-4 w-4" />
          Créer un nouveau client
        </Link>
      </div>
    </div>
  );
}
