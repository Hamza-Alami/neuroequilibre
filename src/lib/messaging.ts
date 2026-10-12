import { fmt } from '@/lib/time';
import type { Client, MessageChannel, MessageTemplate, Session } from '@/lib/types';

/*
 * Messages are opened pre-filled in WhatsApp or the e-mail client; the user clicks
 * "Envoyer". An automatic provider (WhatsApp Business API, e-mail service) can later
 * replace `openMessage` without changing templates, variables or the message log.
 */

export const TEMPLATE_VARIABLES = [
  { key: 'prenom', label: 'Prénom du client' },
  { key: 'nom', label: 'Nom du client' },
  { key: 'code', label: 'Code client' },
  { key: 'date', label: 'Date de la séance' },
  { key: 'heure', label: 'Heure de la séance' },
  { key: 'box', label: 'Box de la séance' },
  { key: 'centre', label: 'Nom du centre' },
] as const;

export type TemplateVars = Partial<Record<(typeof TEMPLATE_VARIABLES)[number]['key'], string>>;

export function messageVars({
  client,
  session,
  boxName,
  centreName,
}: {
  client?: Pick<Client, 'first_name' | 'last_name' | 'code'> | null;
  session?: Pick<Session, 'starts_at'> | null;
  boxName?: string | null;
  centreName: string;
}): TemplateVars {
  return {
    prenom: client?.first_name ?? '',
    nom: client?.last_name ?? '',
    code: client?.code ?? '',
    date: session ? fmt(session.starts_at, 'EEEE d MMMM') : '',
    heure: session ? fmt(session.starts_at, "HH'h'mm") : '',
    box: boxName ?? '',
    centre: centreName,
  };
}

export function renderTemplate(text: string, vars: TemplateVars) {
  return text
    .replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? (vars[key as keyof TemplateVars] ?? '') : match))
    .replace(/[ \t]+([,.!?;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function templateUsesSession(template: Pick<MessageTemplate, 'body' | 'email_body' | 'email_subject'>) {
  const all = `${template.body} ${template.email_body ?? ''} ${template.email_subject ?? ''}`;
  return /\{(date|heure|box)\}/.test(all);
}

export function renderForChannel(template: MessageTemplate, channel: MessageChannel, vars: TemplateVars) {
  if (channel === 'whatsapp') return { subject: '', body: renderTemplate(template.body, vars) };
  return {
    subject: renderTemplate(template.email_subject || template.title, vars),
    body: renderTemplate(template.email_body || template.body, vars),
  };
}

/** International digits for wa.me, e.g. "06 12 34 56 78" → "212612345678". */
export function normalizePhone(phone: string | null | undefined, countryCode: string) {
  if (!phone) return null;
  const trimmed = phone.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) {
    // already international
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = countryCode + digits.slice(1);
  } else if (digits.length <= 9) {
    digits = countryCode + digits;
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function whatsappUrl(phone: string, text: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function mailtoUrl({ to = [], bcc = [], subject, body }: { to?: string[]; bcc?: string[]; subject: string; body: string }) {
  const params = new URLSearchParams();
  if (bcc.length) params.set('bcc', bcc.join(','));
  params.set('subject', subject);
  params.set('body', body);
  return `mailto:${to.map(encodeURIComponent).join(',')}?${params.toString().replace(/\+/g, '%20')}`;
}

export function isValidEmail(email: string | null | undefined) {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
}

export function openMessage(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
