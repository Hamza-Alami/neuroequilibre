import { getSupabase } from '@/lib/supabase/client';
import type { Client, ClientInput } from '@/lib/types';
import { unwrap } from './errors';

export async function listClients(): Promise<Client[]> {
  const res = await getSupabase()
    .from('clients')
    .select('*')
    .order('last_name')
    .order('first_name');
  return unwrap(res) as Client[];
}

export interface ClientWithStats extends Client {
  sessions: { id: string; starts_at: string; status: string }[];
}

export async function listClientsWithStats(): Promise<ClientWithStats[]> {
  const res = await getSupabase()
    .from('clients')
    .select('*, sessions(id, starts_at, status)')
    .order('last_name')
    .order('first_name');
  return unwrap(res) as ClientWithStats[];
}

export async function getClient(id: string): Promise<Client | null> {
  const res = await getSupabase().from('clients').select('*').eq('id', id).maybeSingle();
  return unwrap(res) as Client | null;
}

export async function createClient(input: ClientInput): Promise<Client> {
  const res = await getSupabase().from('clients').insert(input).select('*').single();
  return unwrap(res) as Client;
}

export async function updateClient(id: string, input: Partial<ClientInput>): Promise<Client> {
  const res = await getSupabase().from('clients').update(input).eq('id', id).select('*').single();
  return unwrap(res) as Client;
}

export async function deleteClient(id: string) {
  const res = await getSupabase().from('clients').delete().eq('id', id).select('id');
  const rows = unwrap(res) as { id: string }[];
  if (rows.length === 0) {
    throw new Error('Suppression refusée : seul l\u2019administrateur peut supprimer un client.');
  }
}
