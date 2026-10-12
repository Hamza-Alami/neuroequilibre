import { getSupabase } from '@/lib/supabase/client';
import type { MessageChannel, MessageKind, MessageTemplate } from '@/lib/types';
import { unwrap } from './errors';

export const MESSAGE_KIND_LABELS: Record<MessageKind, string> = {
  confirmation: 'Confirmation de rendez-vous',
  reminder: 'Rappel de rendez-vous',
  birthday: 'Joyeux anniversaire',
  broadcast: 'Message groupé',
};

export async function listTemplates({ includeInactive = false } = {}): Promise<MessageTemplate[]> {
  let q = getSupabase().from('message_templates').select('*').order('sort_order').order('title');
  if (!includeInactive) q = q.eq('is_active', true);
  return unwrap(await q) as MessageTemplate[];
}

export type TemplateInput = Pick<MessageTemplate, 'kind' | 'title' | 'body' | 'email_subject' | 'email_body'>;

export async function createTemplate(input: TemplateInput, sortOrder: number) {
  unwrap(await getSupabase().from('message_templates').insert({ ...input, sort_order: sortOrder }));
}

export async function updateTemplate(id: string, patch: Partial<TemplateInput & Pick<MessageTemplate, 'is_active'>>) {
  unwrap(await getSupabase().from('message_templates').update(patch).eq('id', id));
}

export async function deleteTemplate(id: string) {
  unwrap(await getSupabase().from('message_templates').delete().eq('id', id));
}

export interface MessageLogEntry {
  clientId: string;
  templateId: string | null;
  templateTitle: string;
  channel: MessageChannel;
  batchId?: string;
}

export async function logMessages(entries: MessageLogEntry[]) {
  if (!entries.length) return;
  unwrap(
    await getSupabase().from('message_log').insert(
      entries.map((e) => ({
        client_id: e.clientId,
        template_id: e.templateId,
        template_title: e.templateTitle,
        channel: e.channel,
        batch_id: e.batchId ?? null,
      }))
    )
  );
}

export interface MessageLogRow {
  id: number;
  client_id: string | null;
  template_title: string;
  channel: MessageChannel;
  batch_id: string | null;
  sent_at: string;
}

export async function listClientMessages(clientId: string, limit = 20): Promise<MessageLogRow[]> {
  const res = await getSupabase()
    .from('message_log')
    .select('id, client_id, template_title, channel, batch_id, sent_at')
    .eq('client_id', clientId)
    .order('sent_at', { ascending: false })
    .limit(limit);
  return unwrap(res) as MessageLogRow[];
}

export async function listBatchMessages(batchId: string): Promise<MessageLogRow[]> {
  const res = await getSupabase()
    .from('message_log')
    .select('id, client_id, template_title, channel, batch_id, sent_at')
    .eq('batch_id', batchId);
  return unwrap(res) as MessageLogRow[];
}
