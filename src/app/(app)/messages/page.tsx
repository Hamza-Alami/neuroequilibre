'use client';

import { Check, ClipboardCopy, Mail, Megaphone, MessageCircle, RotateCcw, Search, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { listClients } from '@/lib/db/clients';
import { errorMessage } from '@/lib/db/errors';
import { listTemplates, logMessages } from '@/lib/db/messages';
import { getClientStatuses } from '@/lib/db/status';
import { useAsync } from '@/lib/hooks';
import {
  chunk,
  isValidEmail,
  mailtoUrl,
  messageVars,
  normalizePhone,
  openMessage,
  renderTemplate,
  whatsappUrl,
} from '@/lib/messaging';
import { todayKey } from '@/lib/time';
import type { Client, MessageChannel } from '@/lib/types';
import { cn, normalizeSearch } from '@/lib/utils';

type Audience = 'all' | 'active' | 'inactive';
const EMAIL_BATCH = 40;

interface Recipient {
  client: Client;
  phone: string | null;
  emailOk: boolean;
  active: boolean;
}

export default function GroupMessagesPage() {
  const { settings, isAdmin } = useApp();
  const toast = useToast();
  const data = useAsync(async () => {
    const [templates, clients, statuses] = await Promise.all([listTemplates(), listClients(), getClientStatuses(todayKey())]);
    return { templates: templates.filter((t) => t.kind === 'broadcast'), clients, statuses };
  }, []);

  const [templateId, setTemplateId] = useState('');
  const [channel, setChannel] = useState<MessageChannel>('whatsapp');
  const [audience, setAudience] = useState<Audience>('all');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [edit, setEdit] = useState<{ key: string; body: string; subject: string } | null>(null);
  const [batch, setBatch] = useState<{ id: string; sent: Set<string> } | null>(null);

  const templates = data.data?.templates ?? [];
  const template = templates.find((t) => t.id === templateId) ?? templates[0] ?? null;

  const genKey = `${template?.id}|${channel}`;
  const rawBody = template ? (channel === 'email' ? template.email_body || template.body : template.body) : '';
  const rawSubject = template ? template.email_subject || template.title : '';
  const body = edit?.key === genKey ? edit.body : rawBody;
  const subject = edit?.key === genKey ? edit.subject : rawSubject;

  const recipients = useMemo<Recipient[]>(() => {
    if (!data.data) return [];
    return data.data.clients
      .map((client) => ({
        client,
        phone: normalizePhone(client.phone, settings.phone_country_code),
        emailOk: isValidEmail(client.email),
        active: data.data!.statuses.get(client.id)?.status === 'active',
      }))
      .filter((r) => (audience === 'all' ? true : audience === 'active' ? r.active : !r.active));
  }, [data.data, audience, settings.phone_country_code]);

  const reachable = recipients.filter((r) => (channel === 'whatsapp' ? r.phone : r.emailOk));
  const unreachable = recipients.length - reachable.length;
  const selected = reachable.filter((r) => !excluded.has(r.client.id));
  const q = normalizeSearch(query);
  const visible = reachable.filter((r) => !q || normalizeSearch(`${r.client.code} ${r.client.first_name} ${r.client.last_name} ${r.client.phone}`).includes(q));

  const counts = useMemo(() => {
    const all = data.data?.clients.length ?? 0;
    const active = data.data ? data.data.clients.filter((c) => data.data!.statuses.get(c.id)?.status === 'active').length : 0;
    return { all, active, inactive: all - active };
  }, [data.data]);

  function resetBatch() {
    setBatch(null);
  }

  function personalised(r: Recipient) {
    return renderTemplate(body, messageVars({ client: r.client, centreName: settings.centre_name }));
  }

  function generic(text: string) {
    return renderTemplate(text, { ...messageVars({ centreName: settings.centre_name }), prenom: '', nom: '', code: '' });
  }

  function ensureBatch() {
    if (batch) return batch;
    const next = { id: crypto.randomUUID(), sent: new Set<string>() };
    setBatch(next);
    return next;
  }

  async function markSent(ids: string[], current: { id: string; sent: Set<string> }) {
    const sent = new Set(current.sent);
    ids.forEach((id) => sent.add(id));
    setBatch({ id: current.id, sent });
    try {
      await logMessages(
        ids.map((clientId) => ({ clientId, templateId: template?.id ?? null, templateTitle: template?.title ?? '', channel, batchId: current.id }))
      );
    } catch {
      // the message was opened; a missing log entry should not interrupt the sending flow
    }
  }

  function sendWhatsApp(r: Recipient) {
    if (!r.phone) return;
    const current = ensureBatch();
    openMessage(whatsappUrl(r.phone, personalised(r)));
    void markSent([r.client.id], current);
  }

  function sendNext() {
    const next = selected.find((r) => !batch?.sent.has(r.client.id));
    if (next) sendWhatsApp(next);
  }

  function sendEmailBatch(group: Recipient[]) {
    const current = ensureBatch();
    openMessage(mailtoUrl({ bcc: group.map((r) => r.client.email.trim()), subject: generic(subject), body: generic(body) }));
    void markSent(
      group.map((r) => r.client.id),
      current
    );
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copié${label.endsWith('s') ? 's' : ''}.`);
    } catch {
      toast.error('Copie impossible : sélectionnez le texte manuellement.');
    }
  }

  const sentCount = batch ? selected.filter((r) => batch.sent.has(r.client.id)).length : 0;
  const progress = selected.length ? Math.round((sentCount / selected.length) * 100) : 0;
  const preview = selected[0] ?? reachable[0] ?? null;

  if (data.loading) return <PageLoader />;
  if (data.error) return <Alert tone="error">{errorMessage(data.error)}</Alert>;

  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="Messages groupés"
        description="Envoyez un message préparé par l’administrateur à toute la base, ou aux clients actifs / inactifs."
      />

      {templates.length === 0 ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="Aucun message groupé disponible"
            description={isAdmin ? 'Rédigez d’abord vos messages (fêtes, promotions, informations).' : 'L’administrateur doit d’abord rédiger les messages groupés.'}
            action={isAdmin && <Button href="/admin/messages">Rédiger un message</Button>}
          />
        </Card>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader title="1. Message" />
              <div className="grid gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTemplateId(t.id);
                      resetBatch();
                    }}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-left transition-colors',
                      t.id === template?.id ? 'border-navy bg-navy-50/60 ring-2 ring-navy/15' : 'border-line hover:bg-surface-muted'
                    )}
                  >
                    <p className="text-[14px] font-semibold text-ink">{t.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-[12px] text-ink-muted">{t.body}</p>
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="2. Canal et texte" description="Le texte peut être ajusté pour cet envoi ; le modèle n’est pas modifié." />
              <div className="space-y-4">
                <Segmented
                  value={channel}
                  onChange={(c) => {
                    setChannel(c);
                    setExcluded(new Set());
                    resetBatch();
                  }}
                  options={[
                    { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                    { value: 'email', label: 'E-mail', icon: Mail },
                  ]}
                />
                {channel === 'email' && (
                  <Field label="Objet">
                    <Input value={subject} onChange={(e) => setEdit({ key: genKey, body, subject: e.target.value })} />
                  </Field>
                )}
                <Field label="Texte">
                  <Textarea value={body} onChange={(e) => setEdit({ key: genKey, body: e.target.value, subject })} rows={6} />
                </Field>
                <div className="rounded-xl border border-line bg-surface-muted p-4">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {channel === 'whatsapp' ? `Aperçu pour ${preview ? preview.client.first_name : 'un client'}` : 'Aperçu (identique pour tous)'}
                  </p>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">
                    {channel === 'whatsapp' && preview ? personalised(preview) : generic(body)}
                  </p>
                  {channel === 'email' && (
                    <p className="mt-2 text-[12px] text-ink-muted">
                      En copie cachée, le message est le même pour tous : les variables du client sont retirées.
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <Card padded={false} className="overflow-hidden">
            <div className="space-y-4 border-b border-line p-5 sm:p-6">
              <CardHeader className="mb-0" title="3. Destinataires et envoi" />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Segmented
                  size="sm"
                  value={audience}
                  onChange={(a) => {
                    setAudience(a);
                    setExcluded(new Set());
                    resetBatch();
                  }}
                  options={[
                    { value: 'all', label: 'Tous', count: counts.all },
                    { value: 'active', label: 'Actifs', count: counts.active },
                    { value: 'inactive', label: 'Inactifs', count: counts.inactive },
                  ]}
                />
                <p className="text-[13px] text-ink-muted">
                  <strong className="tabular text-ink">{selected.length}</strong> destinataire{selected.length > 1 ? 's' : ''}
                </p>
              </div>
              {unreachable > 0 && (
                <Alert tone="warning">
                  {unreachable} client{unreachable > 1 ? 's' : ''} sans {channel === 'whatsapp' ? 'numéro utilisable' : 'e-mail valide'} :
                  corrigez leur fiche pour les inclure.
                </Alert>
              )}

              {channel === 'whatsapp' ? (
                <div className="rounded-xl border border-line bg-surface-muted p-4">
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="font-medium text-ink">
                      {sentCount} / {selected.length} ouvert{sentCount > 1 ? 's' : ''}
                    </span>
                    {batch && (
                      <button type="button" onClick={resetBatch} className="inline-flex items-center gap-1 text-ink-muted hover:text-ink">
                        <RotateCcw className="h-3.5 w-3.5" /> Recommencer
                      </button>
                    )}
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-line/70">
                    <div className="h-full rounded-full bg-[#1f8f4e] transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <Button
                    className="mt-3 bg-[#1f8f4e] hover:bg-[#187a41]"
                    icon={Send}
                    fullWidth
                    onClick={sendNext}
                    disabled={!selected.length || sentCount >= selected.length || !body.trim()}
                  >
                    {sentCount === 0 ? 'Commencer l’envoi' : sentCount >= selected.length ? 'Tous les messages ont été ouverts' : 'Message suivant'}
                  </Button>
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
                    Chaque clic ouvre WhatsApp avec le message pré-rempli pour le client suivant : cliquez sur Envoyer dans WhatsApp,
                    puis revenez ici.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 rounded-xl border border-line bg-surface-muted p-4">
                  {chunk(selected, EMAIL_BATCH).map((group, i) => {
                    const done = batch ? group.every((r) => batch.sent.has(r.client.id)) : false;
                    const from = i * EMAIL_BATCH + 1;
                    return (
                      <div key={i} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[13px] text-ink-soft">
                          Groupe {i + 1} · destinataires {from}–{from + group.length - 1}
                        </span>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={ClipboardCopy}
                            title="Copier les adresses"
                            onClick={() => copy(group.map((r) => r.client.email.trim()).join(', '), 'Adresses')}
                          />
                          <Button size="sm" variant={done ? 'secondary' : 'primary'} icon={done ? Check : Mail} onClick={() => sendEmailBatch(group)} disabled={!body.trim()}>
                            {done ? 'Ouvert' : 'Ouvrir l’e-mail'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {!selected.length && <p className="text-[13px] text-ink-muted">Aucun destinataire.</p>}
                  <p className="pt-1 text-[12px] leading-relaxed text-ink-muted">
                    Les adresses sont placées en copie cachée (par groupes de {EMAIL_BATCH}). Si votre messagerie ne s’ouvre pas, copiez les
                    adresses et le{' '}
                    <button type="button" className="underline hover:text-ink" onClick={() => copy(generic(body), 'Message')}>
                      message
                    </button>
                    .
                  </p>
                </div>
              )}

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un destinataire…" className="h-9 pl-9 text-[13px]" />
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-line bg-surface-muted px-5 py-2 text-[12px] text-ink-muted">
              <span>Décochez les clients à exclure de cet envoi.</span>
              <span className="flex gap-3">
                <button type="button" className="hover:text-ink" onClick={() => setExcluded(new Set())}>
                  Tout cocher
                </button>
                <button type="button" className="hover:text-ink" onClick={() => setExcluded(new Set(reachable.map((r) => r.client.id)))}>
                  Tout décocher
                </button>
              </span>
            </div>
            <ul className="scrollbar-thin max-h-[520px] divide-y divide-line overflow-y-auto">
              {visible.map((r) => {
                const isSent = batch?.sent.has(r.client.id);
                const isExcluded = excluded.has(r.client.id);
                return (
                  <li key={r.client.id} className={cn('flex items-center gap-3 px-5 py-2.5', isExcluded && 'opacity-50')}>
                    <Checkbox
                      checked={!isExcluded}
                      onChange={(v) =>
                        setExcluded((prev) => {
                          const next = new Set(prev);
                          if (v) next.delete(r.client.id);
                          else next.add(r.client.id);
                          return next;
                        })
                      }
                      label={
                        <span>
                          {r.client.first_name} {r.client.last_name}{' '}
                          <span className="tabular text-[12px] text-ink-muted">
                            · {r.client.code} · {channel === 'whatsapp' ? r.client.phone : r.client.email}
                          </span>
                        </span>
                      }
                    />
                    <span className="ml-auto flex shrink-0 items-center gap-2">
                      {isSent && <Badge tone="success">Ouvert</Badge>}
                      {channel === 'whatsapp' && !isExcluded && (
                        <Button size="sm" variant="ghost" icon={MessageCircle} title="Ouvrir WhatsApp pour ce client" onClick={() => sendWhatsApp(r)} disabled={!body.trim()} />
                      )}
                    </span>
                  </li>
                );
              })}
              {!visible.length && <li className="px-5 py-8 text-center text-[13px] text-ink-muted">Aucun destinataire.</li>}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
