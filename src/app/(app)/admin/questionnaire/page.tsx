'use client';

import { ChevronDown, ClipboardList, Pencil, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { DeleteButton, InlineEdit, MoveButtons, swap } from '@/components/admin/ListControls';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback';
import { Field, Input, Switch, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/db/errors';
import {
  createDifficulty,
  createTheme,
  deleteDifficulty,
  deleteTheme,
  listThemes,
  reorder,
  updateDifficulty,
  updateTheme,
} from '@/lib/db/questionnaire';
import { useAsync } from '@/lib/hooks';
import type { QuestionnaireTheme } from '@/lib/types';
import { cn } from '@/lib/utils';

type Pending = { kind: 'theme' | 'difficulty'; id: string; label: string } | null;

function ThemeModal({
  theme,
  open,
  onClose,
  onSubmit,
}: {
  theme: QuestionnaireTheme | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (v: { title: string; emoji: string; description: string | null }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🧠');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [initFor, setInitFor] = useState<string | null>(null);
  const key = open ? theme?.id ?? 'new' : null;
  if (key !== initFor) {
    setInitFor(key);
    setTitle(theme?.title ?? '');
    setEmoji(theme?.emoji ?? '🧠');
    setDescription(theme?.description ?? '');
    setError(null);
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!title.trim()) return setError('Le titre est requis.');
    setSaving(true);
    try {
      await onSubmit({ title: title.trim(), emoji: emoji.trim() || '🧠', description: description.trim() || null });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={theme ? 'Modifier le thème' : 'Nouveau thème'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => submit()} loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid grid-cols-[80px_1fr] gap-3">
          <Field label="Icône">
            <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} className="text-center text-[18px]" maxLength={4} />
          </Field>
          <Field label="Titre" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
        </div>
        <Field label="Description (facultatif)" hint="Affichée sous le titre pendant l’évaluation.">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
      </form>
    </Modal>
  );
}

export default function QuestionnaireAdminPage() {
  const toast = useToast();
  const themes = useAsync(() => listThemes({ includeInactive: true }), []);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ theme: QuestionnaireTheme | null } | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [newDifficulty, setNewDifficulty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const list = themes.data ?? [];

  async function run(fn: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
      await themes.reload({ silent: true });
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  }

  const toggleOpen = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Questionnaire d’évaluation"
        description="Thèmes et difficultés (sous-thèmes) proposés lors des évaluations. Les historiques clients sont conservés même si un élément est désactivé ou supprimé."
        actions={
          <Button icon={Plus} onClick={() => setModal({ theme: null })}>
            Nouveau thème
          </Button>
        }
      />

      {themes.loading ? (
        <PageLoader />
      ) : themes.error ? (
        <Alert tone="error">{errorMessage(themes.error)}</Alert>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="Aucun thème" action={<Button icon={Plus} onClick={() => setModal({ theme: null })}>Créer un thème</Button>} />
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((t, i) => {
            const expanded = open.has(t.id);
            const activeCount = t.difficulties.filter((d) => d.is_active).length;
            return (
              <Card key={t.id} padded={false} className={cn('overflow-hidden', !t.is_active && 'opacity-70')}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <MoveButtons
                    index={i}
                    count={list.length}
                    disabled={busy}
                    onMove={(dir) => {
                      const ids = swap(list.map((x) => x.id), i, dir);
                      if (ids) void run(() => reorder('questionnaire_themes', ids));
                    }}
                  />
                  <button type="button" onClick={() => toggleOpen(t.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="text-[20px]">{t.emoji}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-ink">{t.title}</span>
                      <span className="block text-[12px] text-ink-muted">
                        {activeCount} difficulté{activeCount > 1 ? 's' : ''} active{activeCount > 1 ? 's' : ''}
                        {t.difficulties.length > activeCount ? ` · ${t.difficulties.length - activeCount} désactivée(s)` : ''}
                      </span>
                    </span>
                    {!t.is_active && <Badge>Désactivé</Badge>}
                    <ChevronDown className={cn('ml-auto h-4 w-4 text-ink-muted transition-transform', expanded && 'rotate-180')} />
                  </button>
                  <Switch
                    checked={t.is_active}
                    disabled={busy}
                    label="Actif"
                    onChange={(v) => run(() => updateTheme(t.id, { is_active: v }), v ? 'Thème activé.' : 'Thème désactivé.')}
                  />
                  <Button variant="ghost" size="sm" icon={Pencil} title="Modifier" onClick={() => setModal({ theme: t })} />
                  <DeleteButton onClick={() => setPending({ kind: 'theme', id: t.id, label: t.title })} />
                </div>

                {expanded && (
                  <div className="border-t border-line bg-surface-muted/50 px-4 py-3">
                    {t.description && <p className="mb-3 text-[12px] italic text-ink-muted">{t.description}</p>}
                    <ul className="space-y-1">
                      {t.difficulties.map((d, j) => (
                        <li key={d.id} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2 ring-1 ring-line">
                          <MoveButtons
                            index={j}
                            count={t.difficulties.length}
                            disabled={busy}
                            onMove={(dir) => {
                              const ids = swap(t.difficulties.map((x) => x.id), j, dir);
                              if (ids) void run(() => reorder('questionnaire_difficulties', ids));
                            }}
                          />
                          <InlineEdit
                            value={d.label}
                            muted={!d.is_active}
                            className="text-[13px] text-ink"
                            onSave={(label) => run(() => updateDifficulty(d.id, { label }), 'Difficulté renommée.')}
                          />
                          <Switch
                            checked={d.is_active}
                            disabled={busy}
                            label="Active"
                            onChange={(v) => run(() => updateDifficulty(d.id, { is_active: v }))}
                          />
                          <DeleteButton onClick={() => setPending({ kind: 'difficulty', id: d.id, label: d.label })} />
                        </li>
                      ))}
                    </ul>
                    <form
                      className="mt-3 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const label = (newDifficulty[t.id] ?? '').trim();
                        if (!label) return;
                        void run(async () => {
                          await createDifficulty(t.id, label, t.difficulties.length + 1);
                          setNewDifficulty((m) => ({ ...m, [t.id]: '' }));
                        }, 'Difficulté ajoutée.');
                      }}
                    >
                      <Input
                        value={newDifficulty[t.id] ?? ''}
                        onChange={(e) => setNewDifficulty((m) => ({ ...m, [t.id]: e.target.value }))}
                        placeholder="Nouvelle difficulté…"
                        className="h-9 text-[13px]"
                      />
                      <Button type="submit" size="sm" icon={Plus} className="h-9" disabled={busy}>
                        Ajouter
                      </Button>
                    </form>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ThemeModal
        open={Boolean(modal)}
        theme={modal?.theme ?? null}
        onClose={() => setModal(null)}
        onSubmit={async (v) => {
          if (modal?.theme) {
            await updateTheme(modal.theme.id, v);
            toast.success('Thème mis à jour.');
          } else {
            const created = await createTheme(v, list.length + 1);
            setOpen((s) => new Set(s).add(created.id));
            toast.success('Thème créé. Ajoutez maintenant ses difficultés.');
          }
          await themes.reload({ silent: true });
        }}
      />

      <ConfirmDialog
        open={Boolean(pending)}
        title={`Supprimer « ${pending?.label} » ?`}
        message={
          pending?.kind === 'theme'
            ? 'Le thème et ses difficultés ne seront plus proposés. Les évaluations déjà enregistrées gardent leurs libellés. Astuce : la désactivation est réversible.'
            : 'La difficulté ne sera plus proposée. Les évaluations déjà enregistrées gardent leur libellé.'
        }
        confirmLabel="Supprimer"
        loading={busy}
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          const p = pending!;
          setPending(null);
          await run(() => (p.kind === 'theme' ? deleteTheme(p.id) : deleteDifficulty(p.id)), 'Supprimé.');
        }}
      />
    </>
  );
}
