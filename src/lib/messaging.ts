import { arMA, enUS, fr } from 'date-fns/locale';
import { fmt } from '@/lib/time';
import type { Client, Gender, MessageChannel, MessageLanguage, MessageTemplate, Session } from '@/lib/types';

/*
 * Messages are opened pre-filled in WhatsApp or the e-mail client; the user clicks
 * "Envoyer". An automatic provider (WhatsApp Business API, e-mail service) can later
 * replace `openMessage` without changing templates, variables or the message log.
 */

export const TEMPLATE_VARIABLES = [
  { key: 'genre', label: 'Civilité : Monsieur / Madame (selon le genre du client)' },
  { key: 'prenom', label: 'Prénom du client' },
  { key: 'nom', label: 'Nom du client' },
  { key: 'code', label: 'Code client' },
  { key: 'date', label: 'Date de la séance' },
  { key: 'heure', label: 'Heure de la séance' },
  { key: 'box', label: 'Box de la séance' },
  { key: 'centre', label: 'Nom du centre' },
] as const;

export type TemplateVars = Partial<Record<(typeof TEMPLATE_VARIABLES)[number]['key'], string>>;

export const MESSAGE_LANGUAGES: { value: MessageLanguage; label: string; short: string }[] = [
  { value: 'fr', label: 'Français', short: 'FR' },
  { value: 'ar', label: 'العربية', short: 'AR' },
  { value: 'en', label: 'English', short: 'EN' },
];

export const LANGUAGE_NAMES: Record<MessageLanguage, string> = { fr: 'français', ar: 'arabe', en: 'anglais' };

export const isRtl = (language: MessageLanguage) => language === 'ar';

/** Used when the gender is unknown, and in group e-mails where the text is the same for everyone. */
const CIVILITY: Record<MessageLanguage, Record<Gender | 'unknown', string>> = {
  fr: { male: 'Monsieur', female: 'Madame', unknown: 'Madame, Monsieur' },
  ar: { male: 'السيد', female: 'السيدة', unknown: 'السيد(ة)' },
  en: { male: 'Mr', female: 'Mrs', unknown: 'Mr/Mrs' },
};

export function civility(gender: Gender | null | undefined, language: MessageLanguage = 'fr') {
  return CIVILITY[language][gender ?? 'unknown'];
}

const DATE_FORMATS: Record<MessageLanguage, { locale: typeof fr; date: string; time: string }> = {
  fr: { locale: fr, date: 'EEEE d MMMM', time: "HH'h'mm" },
  ar: { locale: arMA, date: 'EEEE d MMMM', time: 'HH:mm' },
  en: { locale: enUS, date: 'EEEE, MMMM d', time: 'h:mm a' },
};

export function messageVars({
  client,
  session,
  boxName,
  centreName,
  language = 'fr',
}: {
  client?: Pick<Client, 'first_name' | 'last_name' | 'code' | 'gender'> | null;
  session?: Pick<Session, 'starts_at'> | null;
  boxName?: string | null;
  centreName: string;
  language?: MessageLanguage;
}): TemplateVars {
  const f = DATE_FORMATS[language];
  return {
    genre: civility(client?.gender, language),
    prenom: client?.first_name ?? '',
    nom: client?.last_name ?? '',
    code: client?.code ?? '',
    date: session ? fmt(session.starts_at, f.date, f.locale) : '',
    heure: session ? fmt(session.starts_at, f.time, f.locale) : '',
    box: boxName ?? '',
    centre: centreName,
  };
}

export function renderTemplate(text: string, vars: TemplateVars) {
  return text
    .replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? (vars[key as keyof TemplateVars] ?? '') : match))
    .replace(/[ \t]+([,.!?;:،؟])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function usesVariable(text: string | null | undefined, key: string) {
  return Boolean(text?.includes(`{${key}}`));
}

/** Raw texts of a template in one language; empty strings when that version is missing. */
export function templateTexts(template: MessageTemplate, language: MessageLanguage) {
  if (language === 'fr') {
    return { body: template.body, emailSubject: template.email_subject ?? '', emailBody: template.email_body ?? '' };
  }
  return {
    body: template[`body_${language}`] ?? '',
    emailSubject: template[`email_subject_${language}`] ?? '',
    emailBody: template[`email_body_${language}`] ?? '',
  };
}

/** A language is available as soon as its WhatsApp text exists; the e-mail reuses it if needed. */
export function hasLanguage(template: MessageTemplate | null | undefined, language: MessageLanguage) {
  return Boolean(template && templateTexts(template, language).body.trim());
}

/** Raw (unrendered) subject and body for a channel, with the documented fallbacks. */
export function rawForChannel(template: MessageTemplate, channel: MessageChannel, language: MessageLanguage) {
  const t = templateTexts(template, language);
  if (channel === 'whatsapp') return { subject: '', body: t.body };
  return {
    subject: t.emailSubject || (language === 'fr' ? template.title : templateTexts(template, 'fr').emailSubject || template.title),
    body: t.emailBody || t.body,
  };
}

export function templateUsesSession(template: MessageTemplate) {
  const all = MESSAGE_LANGUAGES.map((l) => Object.values(templateTexts(template, l.value)).join(' ')).join(' ');
  return /\{(date|heure|box)\}/.test(all);
}

export function renderForChannel(template: MessageTemplate, channel: MessageChannel, vars: TemplateVars, language: MessageLanguage = 'fr') {
  const raw = rawForChannel(template, channel, language);
  return { subject: renderTemplate(raw.subject, vars), body: renderTemplate(raw.body, vars) };
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
