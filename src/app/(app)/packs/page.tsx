'use client';

import { Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { MoveButtons } from '@/components/admin/ListControls';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback';
import { Field, Input, Switch, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/db/errors';
import { createPack, deletePack, listPacks, updatePack } from '@/lib/db/packs';
import { reorder } from '@/lib/db/questionnaire';
import { useAsync } from '@/lib/hooks';
import { formatMoney, parseAmount } from '@/lib/money';
import type { Pack } from '@/lib/types';
import { cn } from '@/lib/utils';

function PackModal({
  open,
  pack,
  nextOrder,
  onClose,
  onSaved,
}: {
  open: boolean;
  pack: Pack | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { settings } = useApp();
  const toast = useToast();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [sessions, setSessions] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [initFor, setInitFor] = useState<string | null>(null);

  const key = open ? (pack?.id ?? 'new') : null;
  if (key !== initFor) {
    setInitFor(key);
    if (open) {
      setName(pack?.name ?? '');
      setPrice(pack ? String(pack.reference_price) : '');
      setSessions(pack ? String(pack.session_count) : '');
      setDescription(pack?.description ?? '');
      setError(null);
    }
  }

  const priceN = parseAmount(price);
  const sessionsN = Number(sessions);
  const unit = Number.isFinite(priceN) && sessionsN > 0 ? priceN / sessionsN : null;

  async function submit() {
    if (!name.trim()) return setError('Le nom du pack est requis.');
    if (!Number.isFinite(priceN) || priceN < 0) return setError('Tarif de référence invalide.');
    if (!Number.isInteger(sessionsN) || sessionsN < 1) return setError('Le nombre de séances doit être un entier supérieur à 0.');
    setSaving(true);
    setError(null);
    try {
      const input = { name: name.trim(), reference_price: priceN, session_count: sessionsN, description: description.trim() || null };
      if (pack) await updatePack(pack.id, input);
      else await createPack(input, nextOrder);
      toast.success(pack ? 'Pack mis à jour.' : 'Pack créé.');
      onSaved();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={pack ? 'Modifier le pack' : 'Nouveau pack'}
      description={pack ? 'Les packs déjà vendus conservent leurs conditions d’origine.' : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Nom du pack" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Pack Découverte" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre de séances" required>
            <Input type="number" min={1} step={1} value={sessions} onChange={(e) => setSessions(e.target.value)} />
          </Field>
          <Field
            label={`Tarif de référence (${settings.currency_label})`}
            required
            hint={unit !== null ? `Soit ${formatMoney(unit, settings.currency_label)} par séance` : undefined}
          >
            <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="tabular" />
          </Field>
        </div>
        <Field label="Description" hint="Visible par les gestionnaires lors de l’attribution.">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </Field>
      </div>
    </Modal>
  );
}

export default function PacksPage() {
  const { isAdmin, settings } = useApp();
  const toast = useToast();
  const currency = settings.currency_label;
  const packs = useAsync(() => listPacks({ includeInactive: isAdmin }), [isAdmin]);
  const [editing, setEditing] = useState<Pack | null>(null);
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<Pack | null>(null);
  const [busy, setBusy] = useState(false);

  const list = packs.data ?? [];

  async function guarded(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      await packs.reload({ silent: true });
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
      setToDelete(null);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const ids = list.map((p) => p.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await guarded(() => reorder('packs', ids), 'Ordre mis à jour.');
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Packs"
        description={
          isAdmin
            ? 'Créez et tarifez les packs proposés. Les gestionnaires les attribuent depuis la fiche client (onglet « Packs & règlements »).'
            : 'Liste des packs proposés par le centre. Pour attribuer un pack, ouvrez la fiche du client puis l’onglet « Packs & règlements ».'
        }
        actions={
          isAdmin && (
            <Button icon={Plus} onClick={() => setAdding(true)}>
              Nouveau pack
            </Button>
          )
        }
      />

      {packs.loading ? (
        <PageLoader />
      ) : packs.error ? (
        <Alert tone="error">{errorMessage(packs.error)}</Alert>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="Aucun pack"
            description={isAdmin ? 'Créez votre premier pack : nom, nombre de séances et tarif de référence.' : 'L’administrateur n’a pas encore créé de pack.'}
            action={isAdmin && <Button icon={Plus} onClick={() => setAdding(true)}>Nouveau pack</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p, i) => (
            <Card key={p.id} className={cn('flex flex-col', !p.is_active && 'opacity-60')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-gold-700">
                    <Package className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold text-ink">{p.name}</h3>
                    <p className="text-[13px] text-ink-muted">
                      {p.session_count} séance{p.session_count > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {isAdmin && <MoveButtons index={i} count={list.length} onMove={(d) => move(i, d)} disabled={busy} />}
              </div>
              <p className="tabular mt-4 text-[24px] font-semibold tracking-tight text-navy">{formatMoney(p.reference_price, currency)}</p>
              <p className="text-[12px] text-ink-muted">
                soit {formatMoney(p.reference_price / p.session_count, currency)} par séance
              </p>
              {p.description && <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">{p.description}</p>}
              <div className="flex-1" />
              {isAdmin && (
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
                  <label className="flex items-center gap-2 text-[13px] text-ink-soft">
                    <Switch
                      checked={p.is_active}
                      onChange={(v) => guarded(() => updatePack(p.id, { is_active: v }), v ? 'Pack activé.' : 'Pack désactivé.')}
                      disabled={busy}
                      label="Actif"
                    />
                    {p.is_active ? 'Proposé' : <Badge>Désactivé</Badge>}
                  </label>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" icon={Pencil} title="Modifier" onClick={() => setEditing(p)} />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      title="Supprimer"
                      onClick={() => setToDelete(p)}
                      className="text-ink-muted hover:bg-danger-50 hover:text-danger"
                    />
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {isAdmin && (
        <>
          <PackModal
            open={adding || Boolean(editing)}
            pack={editing}
            nextOrder={list.length + 1}
            onClose={() => {
              setAdding(false);
              setEditing(null);
            }}
            onSaved={() => packs.reload({ silent: true })}
          />
          <ConfirmDialog
            open={Boolean(toDelete)}
            title={`Supprimer « ${toDelete?.name ?? ''} » ?`}
            message="Le pack disparaîtra du catalogue. Les packs déjà vendus à des clients sont conservés avec leurs conditions. Pour simplement ne plus le proposer, désactivez-le."
            confirmLabel="Supprimer"
            loading={busy}
            onConfirm={() => toDelete && guarded(() => deletePack(toDelete.id), 'Pack supprimé.')}
            onCancel={() => setToDelete(null)}
          />
        </>
      )}
    </>
  );
}
