import { getSupabase } from '@/lib/supabase/client';
import type { ClientStatus, ClientStatusChange, ClientStatusInfo, StatusMode } from '@/lib/types';
import { unwrap } from './errors';

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'Actif',
  inactive: 'Inactif',
};

/** Status of every client known at that date (clients created later are excluded). */
export async function getClientStatuses(date: string): Promise<Map<string, ClientStatusInfo>> {
  const res = await getSupabase().rpc('client_statuses', { p_date: date });
  const rows = unwrap(res) as ClientStatusInfo[];
  return new Map(rows.map((r) => [r.client_id, r]));
}

export async function getClientStatus(clientId: string, date: string): Promise<ClientStatusInfo | null> {
  const map = await getClientStatuses(date);
  return map.get(clientId) ?? null;
}

export async function listStatusChanges(clientId: string): Promise<ClientStatusChange[]> {
  const res = await getSupabase()
    .from('client_status_changes')
    .select('*')
    .eq('client_id', clientId)
    .order('effective_date', { ascending: false })
    .order('created_at', { ascending: false });
  return unwrap(res) as ClientStatusChange[];
}

export async function setClientStatus(clientId: string, mode: StatusMode, effectiveDate: string, reason: string) {
  unwrap(
    await getSupabase().from('client_status_changes').insert({
      client_id: clientId,
      mode,
      effective_date: effectiveDate,
      reason: reason.trim() || null,
    })
  );
}
