'use client';

import { BellRing, Cake, CalendarCheck, Megaphone, MessageSquareText, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/db/errors';
import { createTemplate, deleteTemplate, listTemplates, MESSAGE_KIND_LABELS, updateTemplate } from '@/lib/db/messages';
import { useAsync } from '@/lib/hooks';
import { renderTemplate, TEMPLATE_VARIABLES, type TemplateVars } from '@/lib/messaging';
import type { MessageKind, MessageTemplate } from '@/lib/types';
import { cn } from '@/lib/utils';

const KIND_ICONS: Record<MessageKind, typeof CalendarCheck> = {
  confirmation: CalendarCheck,
  reminder: BellRing,
  birthday: Cake,
  broadcast: Megaphone,
};

function VariableChips({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TEMPLATE_VARIABLES.map((v) => (
        <button
          key={v.key}
          type="button"
          title={v.label}
          onClick={() => onInsert(`{${v.key}}`)}
          className="rounded-md bg-navy-50 px-2 py-0.5 font-mono text-[11px] text-navy hover:bg-navy-100"
        >
          {`{${v.key}}`}
        </button>
      ))}
    </div>
  );
}

function TemplateModal({
  open,
  template,
  defaultKind,
  nextOrder,
  onClose,
  onSaved,
}: {
  open: boolean;
  template: MessageTemplate | null;
  defaultKind: MessageKind;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { settings } = useApp();
  const toast = useToast();
  const [kind, setKind] = useState<MessageKind>(defaultKind);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [tab, setTab] = useState<'whatsapp' | 'email'>('whatsapp');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [initFor, setInitFor] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const emailRef = useRef<HTMLTextAreaElement>(null);

  const key = open ? (template?.id ?? `new-${defaultKind}`) : null;
  if (key !== initFor) {
    setInitFor(key);
    if (open) {
      setKind(template?.kind ?? defaultKind);
      setTitle(template?.title ?? '');
      setBody(template?.body ?? '');
      setSubject(template?.email_subject ?? '');
      setEmailBody(template?.email_body ?? '');
      setTab('whatsapp');
      setError(null);
    }
  }

  function insert(ref: React.RefObject<HTMLTextAreaElement | null>, value: string, setValue: (v: string) => void, token: string) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const sample: TemplateVars = {
    prenom: 'Sara',
    nom: 'Bennani',
    code: 'NE-0042',
    date: 'mardi 14 octobre',
    heure: '10h30',
    box: 'Box 1',
    centre: settings.centre_name,
  };

  async function submit() {
    if (!title.trim()) return setError('Donnez un titre au message.');
    if (!body.trim()) return setError('Le texte WhatsApp est requis.');
    setSaving(true);
    setError(null);
    try {
      const input = {
        kind,
        title: title.trim(),
        body: body.trim(),
        email_subject: subject.trim() || null,
        email_body: emailBody.trim() || null,
      };
      if (template) await updateTemplate(template.id, input);
      else await createTemplate(input, nextOrder);
      toast.success(template ? 'Modèle mis à jour.' : 'Modèle créé.');
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
      size="lg"
      title={template ? 'Modifier le modèle' : 'Nouveau modèle de message'}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as MessageKind)}>
              {Object.entries(MESSAGE_KIND_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Titre" required hint="Visible par les gestionnaires pour choisir le message.">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. : Fête du Trône" />
          </Field>
        </div>

        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'whatsapp', label: 'Version WhatsApp' },
            { value: 'email', label: 'Version e-mail' },
          ]}
        />

        {tab === 'whatsapp' ? (
          <Field label="Texte WhatsApp" required>
            <Textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
            <VariableChips onInsert={(t) => insert(bodyRef, body, setBody, t)} />
          </Field>
        ) : (
          <>
            <Field label="Objet de l’e-mail" hint="Si vide, le titre du modèle est utilisé.">
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
            <Field label="Texte de l’e-mail" hint="Si vide, le texte WhatsApp est réutilisé.">
              <Textarea ref={emailRef} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={8} />
              <VariableChips onInsert={(t) => insert(emailRef, emailBody, setEmailBody, t)} />
            </Field>
          </>
        )}

        <div className="rounded-xl border border-line bg-surface-muted p-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Aperçu (client fictif)</p>
          {tab === 'email' && (
            <p className="mb-1 text-[13px] font-medium text-ink">{renderTemplate(subject || title, sample) || '—'}</p>
          )}
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">
            {renderTemplate(tab === 'email' ? emailBody || body : body, sample) || '—'}
          </p>
          {kind === 'broadcast' && (
            <p className="mt-2 text-[12px] text-ink-muted">
              En e-mail groupé (copie cachée), les variables du client ({'{prenom}'}, {'{nom}'}…) sont retirées.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function MessageTemplatesPage() {
  const toast = useToast();
  const templates = useAsync(() => listTemplates({ includeInactive: true }), []);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [adding, setAdding] = useState<MessageKind | null>(null);
  const [toDelete, setToDelete] = useState<MessageTemplate | null>(null);
  const [busy, setBusy] = useState(false);

  const list = templates.data ?? [];
  const individual = list.filter((t) => t.kind !== 'broadcast');
  const broadcast = list.filter((t) => t.kind === 'broadcast');

  async function guarded(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      await templates.reload({ silent: true });
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
      setToDelete(null);
    }
  }

  function renderList(items: MessageTemplate[], empty: string) {
    if (!items.length) return <EmptyState icon={MessageSquareText} title="Aucun modèle" description={empty} />;
    return (
      <ul className="divide-y divide-line">
        {items.map((t) => {
          const Icon = KIND_ICONS[t.kind];
          return (
            <li key={t.id} className={cn('flex items-start gap-4 py-4 first:pt-0 last:pb-0', !t.is_active && 'opacity-60')}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14px] font-semibold text-ink">{t.title}</p>
                  {t.kind !== 'broadcast' && <Badge tone="navy">{MESSAGE_KIND_LABELS[t.kind]}</Badge>}
                  {!t.is_active && <Badge>Désactivé</Badge>}
                  {t.email_body && <Badge tone="gold">Version e-mail dédiée</Badge>}
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-muted">{t.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  checked={t.is_active}
                  onChange={(v) => guarded(() => updateTemplate(t.id, { is_active: v }), v ? 'Modèle activé.' : 'Modèle désactivé.')}
                  disabled={busy}
                  label="Actif"
                />
                <Button size="sm" variant="ghost" icon={Pencil} title="Modifier" onClick={() => setEditing(t)} />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  title="Supprimer"
                  onClick={() => setToDelete(t)}
                  className="text-ink-muted hover:bg-danger-50 hover:text-danger"
                />
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Modèles de messages"
        description="Rédigez les messages une fois : les gestionnaires n’ont plus qu’à choisir et envoyer. Les variables entre accolades sont remplacées automatiquement."
      />

      {templates.loading ? (
        <PageLoader />
      ) : templates.error ? (
        <Alert tone="error">{errorMessage(templates.error)}</Alert>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Messages individuels"
              description="Envoyés depuis la fiche d’un client : confirmation, rappel de rendez-vous et anniversaire."
              action={
                <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAdding('confirmation')}>
                  Ajouter
                </Button>
              }
            />
            {renderList(individual, 'Ajoutez au moins un modèle de confirmation, de rappel et d’anniversaire.')}
          </Card>
          <Card>
            <CardHeader
              title="Messages groupés"
              description="Envoyés à toute la base (ou aux clients actifs / inactifs) : fêtes nationales, promotions, informations…"
              action={
                <Button size="sm" icon={Plus} onClick={() => setAdding('broadcast')}>
                  Nouveau message groupé
                </Button>
              }
            />
            {renderList(broadcast, 'Rédigez à l’avance vos messages pour les événements à venir.')}
          </Card>
        </div>
      )}

      <TemplateModal
        open={Boolean(adding) || Boolean(editing)}
        template={editing}
        defaultKind={adding ?? 'broadcast'}
        nextOrder={list.length + 1}
        onClose={() => {
          setAdding(null);
          setEditing(null);
        }}
        onSaved={() => templates.reload({ silent: true })}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Supprimer « ${toDelete?.title ?? ''} » ?`}
        message="Le modèle ne sera plus proposé. L’historique des messages déjà envoyés est conservé."
        confirmLabel="Supprimer"
        loading={busy}
        onConfirm={() => toDelete && guarded(() => deleteTemplate(toDelete.id), 'Modèle supprimé.')}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
