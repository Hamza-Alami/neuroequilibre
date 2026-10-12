'use client';

import { ArrowDown, ArrowUp, Lock, Pencil, Plus, SquareStack, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { BlockModal, type BlockDraft } from '@/components/booking/BlockModal';
import { Badge, BoxTag } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback';
import { Field, Input, Switch } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/db/errors';
import { reorder } from '@/lib/db/questionnaire';
import { createBox, deleteBlock, deleteBox, listBlocks, updateBox } from '@/lib/db/settings';
import { useAsync } from '@/lib/hooks';
import { dateKey, fmt, todayKey } from '@/lib/time';
import type { Box, BoxBlock } from '@/lib/types';

const PALETTE = ['#2F4A6D', '#C8963E', '#3F7D6E', '#8A5A83', '#B4553A', '#4F6D9A', '#6B7A3A', '#7C8597'];

function BoxModal({ box, open, onClose, onSaved }: { box: Box | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { boxes } = useApp();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [initFor, setInitFor] = useState<string | null>(null);

  const key = open ? box?.id ?? 'new' : null;
  if (key !== initFor) {
    setInitFor(key);
    if (open) {
      setName(box?.name ?? `Box ${boxes.length + 1}`);
      setColor(box?.color ?? PALETTE[boxes.length % PALETTE.length]);
      setError(null);
    }
  }

  async function submit() {
    if (!name.trim()) return setError('Le nom est requis.');
    setSaving(true);
    setError(null);
    try {
      if (box) await updateBox(box.id, { name: name.trim(), color });
      else await createBox({ name: name.trim(), color });
      toast.success(box ? 'Box mis à jour.' : 'Box ajouté.');
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
      size="sm"
      title={box ? 'Modifier le box' : 'Ajouter un box'}
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
        <Field label="Nom">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Couleur dans le planning">
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-lg ring-offset-2 ${color === c ? 'ring-2 ring-navy' : ''}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

export default function BoxesPage() {
  const { boxes, refreshConfig } = useApp();
  const toast = useToast();
  const [editing, setEditing] = useState<Box | null>(null);
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<Box | null>(null);
  const [blockDraft, setBlockDraft] = useState<BlockDraft | null>(null);
  const [blockScope, setBlockScope] = useState<'upcoming' | 'past'>('upcoming');
  const [busy, setBusy] = useState(false);

  const blocks = useAsync(() => listBlocks(), []);
  const now = new Date().toISOString();
  const visibleBlocks = (blocks.data ?? [])
    .filter((b) => (blockScope === 'upcoming' ? b.ends_at >= now : b.ends_at < now))
    .sort((a, b) => (blockScope === 'upcoming' ? a.starts_at.localeCompare(b.starts_at) : b.starts_at.localeCompare(a.starts_at)));

  async function guarded(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      await refreshConfig();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const ids = boxes.map((b) => b.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await guarded(() => reorder('boxes', ids), 'Ordre mis à jour.');
  }

  function blockLabel(b: BoxBlock) {
    const sameDay = dateKey(b.starts_at) === dateKey(b.ends_at);
    return sameDay
      ? `${fmt(b.starts_at, 'EEEE d MMMM yyyy')} · ${fmt(b.starts_at, 'HH:mm')} – ${fmt(b.ends_at, 'HH:mm')}`
      : `Du ${fmt(b.starts_at, "d MMM yyyy 'à' HH:mm")} au ${fmt(b.ends_at, "d MMM yyyy 'à' HH:mm")}`;
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Boxes & blocages"
        description="Les boxes désactivés n’apparaissent plus à la réservation mais leur historique est conservé."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Boxes"
            description={`${boxes.filter((b) => b.is_active).length} actif(s) sur ${boxes.length}`}
            action={
              <Button size="sm" icon={Plus} onClick={() => setAdding(true)}>
                Ajouter
              </Button>
            }
          />
          {boxes.length === 0 ? (
            <EmptyState icon={SquareStack} title="Aucun box" />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {boxes.map((b, i) => (
                <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex flex-col">
                    <button type="button" disabled={i === 0 || busy} onClick={() => move(i, -1)} className="text-ink-muted hover:text-ink disabled:opacity-30" aria-label="Monter">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" disabled={i === boxes.length - 1 || busy} onClick={() => move(i, 1)} className="text-ink-muted hover:text-ink disabled:opacity-30" aria-label="Descendre">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <BoxTag name={b.name} color={b.color} muted={!b.is_active} />
                    {!b.is_active && (
                      <Badge tone="neutral" className="ml-2">
                        Désactivé
                      </Badge>
                    )}
                  </div>
                  <Switch
                    checked={b.is_active}
                    disabled={busy}
                    label={b.is_active ? 'Désactiver' : 'Activer'}
                    onChange={(v) => guarded(() => updateBox(b.id, { is_active: v }), v ? `${b.name} activé.` : `${b.name} désactivé.`)}
                  />
                  <Button variant="ghost" size="sm" icon={Pencil} title="Modifier" onClick={() => setEditing(b)} />
                  <Button variant="ghost" size="sm" icon={Trash2} title="Supprimer" onClick={() => setToDelete(b)} className="hover:bg-danger-50 hover:text-danger" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Créneaux bloqués"
            description="Période grisée dans le planning : aucune réservation possible."
            action={
              <Button size="sm" icon={Lock} onClick={() => setBlockDraft({ boxId: null, date: todayKey(), start: '09:00', end: '10:00' })}>
                Bloquer
              </Button>
            }
          />
          <Segmented
            size="sm"
            className="mb-4"
            value={blockScope}
            onChange={setBlockScope}
            options={[
              { value: 'upcoming', label: 'En cours et à venir' },
              { value: 'past', label: 'Passés' },
            ]}
          />
          {blocks.loading ? (
            <PageLoader />
          ) : blocks.error ? (
            <Alert tone="error">{errorMessage(blocks.error)}</Alert>
          ) : visibleBlocks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-ink-muted">
              Aucun blocage {blockScope === 'upcoming' ? 'à venir' : 'passé'}.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {visibleBlocks.map((bl) => {
                const box = boxes.find((b) => b.id === bl.box_id);
                return (
                  <li key={bl.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="hatched mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted">
                      <Lock className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium capitalize text-ink">{blockLabel(bl)}</p>
                      <p className="text-[12px] text-ink-muted">
                        {box ? box.name : 'Tout le centre'}
                        {bl.reason ? ` · ${bl.reason}` : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      title="Retirer le blocage"
                      className="hover:bg-danger-50 hover:text-danger"
                      onClick={async () => {
                        try {
                          await deleteBlock(bl.id);
                          toast.success('Blocage retiré.');
                          void blocks.reload({ silent: true });
                        } catch (e) {
                          toast.error(e);
                        }
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <BoxModal box={editing} open={adding || Boolean(editing)} onClose={() => { setAdding(false); setEditing(null); }} onSaved={refreshConfig} />
      <BlockModal draft={blockDraft} onClose={() => setBlockDraft(null)} onCreated={() => blocks.reload({ silent: true })} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Supprimer ${toDelete?.name} ?`}
        message="Possible uniquement si aucune séance n’y a jamais été réservée. Sinon, désactivez-le : il disparaîtra des réservations en gardant l’historique."
        confirmLabel="Supprimer"
        loading={busy}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          const b = toDelete!;
          setToDelete(null);
          await guarded(() => deleteBox(b.id), `${b.name} supprimé.`);
        }}
      />
    </>
  );
}
