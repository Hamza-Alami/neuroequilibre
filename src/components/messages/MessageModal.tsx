'use client';

import { CalendarCheck, BellRing, Cake, Mail, MessageCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Button } from '@/components/ui/Button';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { listClientMessages, listTemplates, logMessages } from '@/lib/db/messages';
import { useAsync } from '@/lib/hooks';
import {
  isValidEmail,
  mailtoUrl,
  messageVars,
  normalizePhone,
  openMessage,
  renderForChannel,
  templateUsesSession,
  whatsappUrl,
} from '@/lib/messaging';
import { fmt } from '@/lib/time';
import type { Client, MessageChannel, MessageKind, SessionWithRelations } from '@/lib/types';
import { cn } from '@/lib/utils';

type IndividualKind = Exclude<MessageKind, 'broadcast'>;

const KINDS: { value: IndividualKind; label: string; icon: typeof CalendarCheck }[] = [
  { value: 'confirmation', label: 'Confirmation', icon: CalendarCheck },
  { value: 'reminder', label: 'Rappel', icon: BellRing },
  { value: 'birthday', label: 'Anniversaire', icon: Cake },
];

export function MessageModal({
  open,
  client,
  sessions,
  initialKind = 'confirmation',
  initialSessionId,
  onClose,
}: {
  open: boolean;
  client: Pick<Client, 'id' | 'code' | 'first_name' | 'last_name' | 'phone' | 'email'>;
  sessions: SessionWithRelations[];
  initialKind?: IndividualKind;
  initialSessionId?: string | null;
  onClose: () => void;
}) {
  const { settings, boxById } = useApp();
  const toast = useToast();
  const [kind, setKind] = useState<IndividualKind>(initialKind);
  const [templateId, setTemplateId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [channel, setChannel] = useState<MessageChannel>('whatsapp');
  const [edit, setEdit] = useState<{ key: string; body: string; subject: string } | null>(null);
  const [openedFor, setOpenedFor] = useState(false);

  const upcoming = useMemo(() => {
    const now = new Date().toISOString();
    return sessions.filter((s) => s.status !== 'cancelled' && s.starts_at >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [sessions]);

  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      setKind(initialKind);
      setTemplateId('');
      setSessionId(initialSessionId ?? upcoming[0]?.id ?? '');
      setChannel('whatsapp');
      setEdit(null);
    }
  }

  const data = useAsync(
    async () => (open ? Promise.all([listTemplates(), listClientMessages(client.id, 5)]) : null),
    [open, client.id]
  );
  const templates = (data.data?.[0] ?? []).filter((t) => t.kind === kind);
  const history = data.data?.[1] ?? [];
  const template = templates.find((t) => t.id === templateId) ?? templates[0] ?? null;
  const session = sessions.find((s) => s.id === sessionId) ?? null;
  const needsSession = Boolean(template && (kind !== 'birthday' || templateUsesSession(template)));

  const generated = template
    ? renderForChannel(
        template,
        channel,
        messageVars({
          client,
          session,
          boxName: session ? (session.box?.name ?? boxById.get(session.box_id)?.name) : null,
          centreName: settings.centre_name,
        })
      )
    : { subject: '', body: '' };
  const genKey = `${template?.id}|${channel}|${sessionId}`;
  const body = edit?.key === genKey ? edit.body : generated.body;
  const subject = edit?.key === genKey ? edit.subject : generated.subject;

  const phone = normalizePhone(client.phone, settings.phone_country_code);
  const emailOk = isValidEmail(client.email);
  const blocker =
    channel === 'whatsapp' && !phone
      ? `Le numéro « ${client.phone} » n’est pas utilisable pour WhatsApp. Corrigez-le dans la fiche client.`
      : channel === 'email' && !emailOk
        ? 'Adresse e-mail invalide : corrigez-la dans la fiche client.'
        : needsSession && !session
          ? 'Ce message mentionne une séance : choisissez la séance concernée.'
          : null;

  async function send() {
    if (!template || blocker) return;
    const url =
      channel === 'whatsapp' ? whatsappUrl(phone!, body) : mailtoUrl({ to: [client.email.trim()], subject, body });
    openMessage(url);
    try {
      await logMessages([{ clientId: client.id, templateId: template.id, templateTitle: template.title, channel }]);
    } catch {
      // the message itself was opened; a missing log entry is not worth blocking the user
    }
    toast.success(channel === 'whatsapp' ? 'WhatsApp ouvert : vérifiez puis cliquez sur Envoyer.' : 'Messagerie ouverte : vérifiez puis envoyez.');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Envoyer un message"
      description={`${client.first_name} ${client.last_name} · ${channel === 'whatsapp' ? client.phone : client.email}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            icon={channel === 'whatsapp' ? MessageCircle : Mail}
            onClick={send}
            disabled={!template || Boolean(blocker) || !body.trim()}
            className={channel === 'whatsapp' ? 'bg-[#1f8f4e] hover:bg-[#187a41]' : undefined}
          >
            {channel === 'whatsapp' ? 'Ouvrir dans WhatsApp' : 'Ouvrir l’e-mail'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => {
                setKind(k.value);
                setTemplateId('');
              }}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-[13px] font-medium transition-colors',
                kind === k.value ? 'border-navy bg-navy-50/60 text-navy ring-2 ring-navy/15' : 'border-line text-ink-soft hover:bg-surface-muted'
              )}
            >
              <k.icon className="h-4 w-4" />
              {k.label}
            </button>
          ))}
        </div>

        {data.loading ? (
          <Spinner className="h-4 w-4" />
        ) : !template ? (
          <Alert tone="warning">Aucun modèle actif pour ce type de message. L’administrateur peut en créer dans « Modèles de messages ».</Alert>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {templates.length > 1 && (
                <Field label="Modèle">
                  <Select value={template.id} onChange={(e) => setTemplateId(e.target.value)}>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {needsSession && (
                <Field label="Séance concernée">
                  <Select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                    {!upcoming.length && <option value="">Aucune séance à venir</option>}
                    {upcoming.map((s) => (
                      <option key={s.id} value={s.id}>
                        {fmt(s.starts_at, "EEEE d MMMM 'à' HH:mm")} · {s.box?.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Envoyer par">
                <Segmented
                  value={channel}
                  onChange={setChannel}
                  options={[
                    { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                    { value: 'email', label: 'E-mail', icon: Mail },
                  ]}
                />
              </Field>
            </div>

            {channel === 'email' && (
              <Field label="Objet">
                <Input value={subject} onChange={(e) => setEdit({ key: genKey, body, subject: e.target.value })} />
              </Field>
            )}
            <Field label="Message" hint="Vous pouvez ajuster le texte avant l’envoi.">
              <Textarea value={body} onChange={(e) => setEdit({ key: genKey, body: e.target.value, subject })} rows={6} />
            </Field>

            {blocker && <Alert tone="warning">{blocker}</Alert>}
          </>
        )}

        {history.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Derniers messages envoyés</p>
            <ul className="space-y-1 text-[12px] text-ink-muted">
              {history.map((h) => (
                <li key={h.id}>
                  {fmt(h.sent_at, "d MMM yyyy 'à' HH:mm")} · {h.template_title} · {h.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
