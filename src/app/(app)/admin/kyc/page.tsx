'use client';

import { FileText, Lock, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { DeleteButton, InlineEdit, MoveButtons, swap } from '@/components/admin/ListControls';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback';
import { Checkbox, Field, Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/db/errors';
import {
  createKycField,
  createKycSection,
  deleteKycField,
  deleteKycSection,
  listKycSections,
  updateKycField,
  updateKycSection,
  type KycFieldInput,
} from '@/lib/db/kyc';
import { reorder } from '@/lib/db/questionnaire';
import { useAsync } from '@/lib/hooks';
import type { KycField, KycFieldType } from '@/lib/types';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<KycFieldType, string> = {
  text: 'Texte court',
  textarea: 'Texte long',
  number: 'Nombre',
  date: 'Date',
  select: 'Liste de choix',
  checkbox: 'Case à cocher (oui/non)',
};

const STANDARD_FIELDS = ['Prénom', 'Nom', 'Date de naissance', 'Téléphone', 'Email', 'Adresse', 'Ville', 'Code postal', 'Pays', 'Contact d’urgence', 'Notes internes'];

function FieldModal({
  open,
  sectionId,
  field,
  nextOrder,
  onClose,
  onSaved,
}: {
  open: boolean;
  sectionId: string | null;
  field: KycField | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [type, setType] = useState<KycFieldType>('text');
  const [options, setOptions] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [required, setRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [initFor, setInitFor] = useState<string | null>(null);

  const key = open ? field?.id ?? `new-${sectionId}` : null;
  if (key !== initFor) {
    setInitFor(key);
    setLabel(field?.label ?? '');
    setType(field?.field_type ?? 'text');
    setOptions((field?.options ?? []).join('\n'));
    setPlaceholder(field?.placeholder ?? '');
    setRequired(field?.is_required ?? false);
    setError(null);
  }

  async function submit() {
    if (!label.trim()) return setError('Le libellé est requis.');
    const opts = options.split('\n').map((o) => o.trim()).filter(Boolean);
    if (type === 'select' && opts.length < 2) return setError('Indiquez au moins deux choix (un par ligne).');
    if (!sectionId) return;
    const input: KycFieldInput = {
      section_id: sectionId,
      label: label.trim(),
      field_type: type,
      options: type === 'select' ? opts : [],
      placeholder: placeholder.trim() || null,
      is_required: type === 'checkbox' ? false : required,
    };
    setSaving(true);
    setError(null);
    try {
      if (field) await updateKycField(field.id, input);
      else await createKycField(input, nextOrder);
      toast.success(field ? 'Champ mis à jour.' : 'Champ ajouté au formulaire.');
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
      title={field ? 'Modifier le champ' : 'Nouveau champ'}
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
        <Field label="Libellé" required>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus placeholder="Ex. Profession" />
        </Field>
        <Field label="Type de réponse">
          <Select value={type} onChange={(e) => setType(e.target.value as KycFieldType)}>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        {type === 'select' && (
          <Field label="Choix proposés" hint="Un choix par ligne.">
            <Textarea value={options} onChange={(e) => setOptions(e.target.value)} rows={4} />
          </Field>
        )}
        {['text', 'textarea', 'number'].includes(type) && (
          <Field label="Texte d’aide (facultatif)">
            <Input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} />
          </Field>
        )}
        {type !== 'checkbox' && (
          <Checkbox checked={required} onChange={setRequired} label="Champ obligatoire" description="La fiche ne pourra pas être enregistrée sans cette information." />
        )}
      </div>
    </Modal>
  );
}

export default function KycAdminPage() {
  const toast = useToast();
  const sections = useAsync(() => listKycSections({ includeInactive: true }), []);
  const [fieldModal, setFieldModal] = useState<{ sectionId: string; field: KycField | null; nextOrder: number } | null>(null);
  const [pending, setPending] = useState<{ kind: 'section' | 'field'; id: string; label: string } | null>(null);
  const [newSection, setNewSection] = useState('');
  const [busy, setBusy] = useState(false);

  const list = sections.data ?? [];

  async function run(fn: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
      await sections.reload({ silent: true });
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Formulaire KYC"
        description="Ajoutez des sections et des champs personnalisés à la fiche d’accueil des clients."
      />

      <Card className="mb-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-ink">Champs standards</p>
            <p className="mt-0.5 text-[13px] text-ink-muted">Toujours présents, non modifiables :</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STANDARD_FIELDS.map((f) => (
                <Badge key={f}>{f}</Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {sections.loading ? (
        <PageLoader />
      ) : sections.error ? (
        <Alert tone="error">{errorMessage(sections.error)}</Alert>
      ) : (
        <div className="space-y-4">
          {list.length === 0 && (
            <Card>
              <EmptyState icon={FileText} title="Aucune section personnalisée" description="Créez une section ci-dessous pour y ajouter vos champs." />
            </Card>
          )}
          {list.map((s, i) => (
            <Card key={s.id} padded={false} className={cn('overflow-hidden', !s.is_active && 'opacity-70')}>
              <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                <MoveButtons
                  index={i}
                  count={list.length}
                  disabled={busy}
                  onMove={(dir) => {
                    const ids = swap(list.map((x) => x.id), i, dir);
                    if (ids) void run(() => reorder('kyc_sections', ids));
                  }}
                />
                <InlineEdit
                  value={s.title}
                  className="text-[15px] font-semibold text-ink"
                  onSave={(title) => run(() => updateKycSection(s.id, { title }), 'Section renommée.')}
                />
                {!s.is_active && <Badge>Masquée</Badge>}
                <Switch
                  checked={s.is_active}
                  disabled={busy}
                  label="Visible"
                  onChange={(v) => run(() => updateKycSection(s.id, { is_active: v }), v ? 'Section visible.' : 'Section masquée.')}
                />
                <DeleteButton onClick={() => setPending({ kind: 'section', id: s.id, label: s.title })} />
              </div>
              <div className="p-4">
                {s.fields.length === 0 ? (
                  <p className="mb-3 text-[13px] text-ink-muted">Aucun champ dans cette section.</p>
                ) : (
                  <ul className="mb-3 space-y-1">
                    {s.fields.map((f, j) => (
                      <li key={f.id} className="flex items-center gap-3 rounded-lg px-3 py-2 ring-1 ring-line">
                        <MoveButtons
                          index={j}
                          count={s.fields.length}
                          disabled={busy}
                          onMove={(dir) => {
                            const ids = swap(s.fields.map((x) => x.id), j, dir);
                            if (ids) void run(() => reorder('kyc_fields', ids));
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={cn('truncate text-[13px] font-medium', f.is_active ? 'text-ink' : 'text-ink-muted line-through')}>
                            {f.label}
                            {f.is_required && <span className="ml-0.5 text-danger">*</span>}
                          </p>
                          <p className="truncate text-[12px] text-ink-muted">
                            {TYPE_LABELS[f.field_type]}
                            {f.field_type === 'select' && ` · ${f.options.join(', ')}`}
                          </p>
                        </div>
                        <Switch checked={f.is_active} disabled={busy} label="Actif" onChange={(v) => run(() => updateKycField(f.id, { is_active: v }))} />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Pencil}
                          title="Modifier"
                          onClick={() => setFieldModal({ sectionId: s.id, field: f, nextOrder: s.fields.length + 1 })}
                        />
                        <DeleteButton onClick={() => setPending({ kind: 'field', id: f.id, label: f.label })} />
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="subtle" size="sm" icon={Plus} onClick={() => setFieldModal({ sectionId: s.id, field: null, nextOrder: s.fields.length + 1 })}>
                  Ajouter un champ
                </Button>
              </div>
            </Card>
          ))}

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const title = newSection.trim();
              if (!title) return;
              void run(async () => {
                await createKycSection(title, null, list.length + 1);
                setNewSection('');
              }, 'Section créée.');
            }}
          >
            <Input value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder="Nom de la nouvelle section (ex. Antécédents médicaux)" />
            <Button type="submit" icon={Plus} disabled={busy}>
              Créer la section
            </Button>
          </form>
        </div>
      )}

      <FieldModal
        open={Boolean(fieldModal)}
        sectionId={fieldModal?.sectionId ?? null}
        field={fieldModal?.field ?? null}
        nextOrder={fieldModal?.nextOrder ?? 1}
        onClose={() => setFieldModal(null)}
        onSaved={() => sections.reload({ silent: true })}
      />

      <ConfirmDialog
        open={Boolean(pending)}
        title={`Supprimer « ${pending?.label} » ?`}
        message={
          pending?.kind === 'section'
            ? 'La section et tous ses champs seront supprimés. Les réponses déjà saisies dans les fiches ne seront plus affichées. Préférez « masquer » pour les conserver.'
            : 'Le champ sera supprimé et les réponses déjà saisies ne seront plus affichées. Préférez la désactivation pour les conserver.'
        }
        confirmLabel="Supprimer"
        loading={busy}
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          const p = pending!;
          setPending(null);
          await run(() => (p.kind === 'section' ? deleteKycSection(p.id) : deleteKycField(p.id)), 'Supprimé.');
        }}
      />
    </>
  );
}
