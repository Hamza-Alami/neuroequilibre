'use client';

import { History } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/Field';
import { ACTION_LABELS, ENTITY_LABELS, listAudit } from '@/lib/db/audit';
import { errorMessage } from '@/lib/db/errors';
import { useAsync } from '@/lib/hooks';
import { fmt } from '@/lib/time';
import type { AuditEntry } from '@/lib/types';

const PAGE = 100;

function actionTone(action: string) {
  if (['delete', 'cancel', 'deactivate'].includes(action)) return 'danger' as const;
  if (['create', 'import', 'activate', 'restore'].includes(action)) return 'success' as const;
  if (action === 'complete') return 'info' as const;
  return 'neutral' as const;
}

export default function JournalPage() {
  const [entity, setEntity] = useState('');
  const [extra, setExtra] = useState<AuditEntry[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const first = useAsync(async () => {
    const rows = await listAudit({ entity: entity || undefined, limit: PAGE });
    setExtra([]);
    setHasMore(rows.length === PAGE);
    return rows;
  }, [entity]);

  const rows = [...(first.data ?? []), ...extra];

  async function loadMore() {
    const last = rows[rows.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const more = await listAudit({ entity: entity || undefined, limit: PAGE, before: last.id });
      setExtra((e) => [...e, ...more]);
      setHasMore(more.length === PAGE);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Journal des actions"
        description="Qui a fait quoi et quand : réservations, annulations, fiches clients, configuration et utilisateurs."
        actions={
          <Select value={entity} onChange={(e) => setEntity(e.target.value)} className="w-56">
            <option value="">Tous les éléments</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        }
      />
      <Card padded={false} className="overflow-hidden">
        {first.error ? (
          <div className="p-5">
            <Alert tone="error">{errorMessage(first.error)}</Alert>
          </div>
        ) : first.loading ? (
          <PageLoader />
        ) : rows.length === 0 ? (
          <EmptyState icon={History} title="Aucune action enregistrée" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-line bg-surface-muted text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-3 py-3">Utilisateur</th>
                    <th className="px-3 py-3">Action</th>
                    <th className="px-3 py-3">Élément</th>
                    <th className="px-5 py-3">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.id} className="text-[13px]">
                      <td className="tabular whitespace-nowrap px-5 py-2.5 text-ink-soft">{fmt(r.created_at, 'dd/MM/yyyy HH:mm')}</td>
                      <td className="px-3 py-2.5 font-medium text-ink">{r.actor_name ?? 'Système'}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={actionTone(r.action)}>{ACTION_LABELS[r.action] ?? r.action}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-ink-soft">{ENTITY_LABELS[r.entity] ?? r.entity}</td>
                      <td className="px-5 py-2.5 text-ink">{r.label ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <div className="border-t border-line p-3 text-center">
                <Button variant="ghost" size="sm" onClick={loadMore} loading={loadingMore}>
                  Charger plus
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
