'use client';

import { Compass, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { DeleteButton, InlineEdit, MoveButtons } from '@/components/admin/ListControls';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback';
import { Input, Switch } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/db/errors';
import { reorder } from '@/lib/db/questionnaire';
import { countClientsBySource, createSource, deleteSource, listSources, updateSource } from '@/lib/db/sources';
import { useAsync } from '@/lib/hooks';
import type { AcquisitionSource } from '@/lib/types';

export default function SourcesPage() {
  const toast = useToast();
  const data = useAsync(async () => {
    const [sources, counts] = await Promise.all([listSources({ includeInactive: true }), countClientsBySource()]);
    return { sources, counts };
  }, []);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<AcquisitionSource | null>(null);

  const sources = data.data?.sources ?? [];
  const counts = data.data?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  async function guarded(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      await data.reload({ silent: true });
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
      setToDelete(null);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const value = label.trim();
    if (!value) return;
    await guarded(() => createSource(value, sources.length + 1), 'Source ajoutée.');
    setLabel('');
  }

  async function move(index: number, dir: -1 | 1) {
    const ids = sources.map((s) => s.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await guarded(() => reorder('acquisition_sources', ids), 'Ordre mis à jour.');
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Origine des clients"
        description="Options proposées pour « Comment le client est venu ? » dans la fiche client."
      />

      <div className="max-w-2xl">
        <Card>
          <CardHeader title="Sources" description="Désactivez une source pour ne plus la proposer sans perdre l’historique des clients concernés." />
          {data.loading ? (
            <PageLoader />
          ) : data.error ? (
            <Alert tone="error">{errorMessage(data.error)}</Alert>
          ) : sources.length === 0 ? (
            <EmptyState icon={Compass} title="Aucune source" description="Ajoutez la première option ci-dessous." />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {sources.map((s, i) => {
                const n = counts[s.id] ?? 0;
                return (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                    <MoveButtons index={i} count={sources.length} onMove={(d) => move(i, d)} disabled={busy} />
                    <InlineEdit
                      value={s.label}
                      muted={!s.is_active}
                      className="text-[14px] text-ink"
                      onSave={(v) => guarded(() => updateSource(s.id, { label: v }), 'Source renommée.')}
                    />
                    <span className="tabular shrink-0 text-[12px] text-ink-muted">
                      {n} client{n > 1 ? 's' : ''}
                      {total > 0 && ` · ${Math.round((n / total) * 100)} %`}
                    </span>
                    <Switch
                      checked={s.is_active}
                      onChange={(v) => guarded(() => updateSource(s.id, { is_active: v }), v ? 'Source activée.' : 'Source désactivée.')}
                      disabled={busy}
                      label="Active"
                    />
                    <DeleteButton onClick={() => setToDelete(s)} />
                  </li>
                );
              })}
            </ul>
          )}

          <form onSubmit={add} className="mt-4 flex gap-2">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nouvelle source (ex. : Médecin, Instagram…)" />
            <Button type="submit" icon={Plus} loading={busy} disabled={!label.trim()}>
              Ajouter
            </Button>
          </form>
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Supprimer « ${toDelete?.label ?? ''} » ?`}
        message={
          toDelete && (counts[toDelete.id] ?? 0) > 0
            ? `${counts[toDelete.id]} client(s) utilisent cette source : leur origine deviendra vide. Préférez la désactivation pour garder l’historique.`
            : 'Cette option ne sera plus proposée.'
        }
        confirmLabel="Supprimer"
        loading={busy}
        onConfirm={() => toDelete && guarded(() => deleteSource(toDelete.id), 'Source supprimée.')}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
