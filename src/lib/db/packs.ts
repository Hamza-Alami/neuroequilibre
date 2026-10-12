import { getSupabase } from '@/lib/supabase/client';
import type { ClientPack, Pack, PackPayment, PaymentMethod } from '@/lib/types';
import { unwrap } from './errors';

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  especes: 'Espèces',
  carte: 'Carte bancaire',
  virement: 'Virement',
  cheque: 'Chèque',
  autre: 'Autre',
};

/** PostgREST returns numeric columns as numbers or strings depending on precision. */
function num(v: unknown) {
  return v === null || v === undefined ? 0 : Number(v);
}

function toPack(row: Record<string, unknown>): Pack {
  return { ...(row as unknown as Pack), reference_price: num(row.reference_price) };
}

function toClientPack(row: Record<string, unknown>): ClientPack {
  return {
    ...(row as unknown as ClientPack),
    reference_price: num(row.reference_price),
    agreed_price: num(row.agreed_price),
    paid_amount: num(row.paid_amount),
    remaining_amount: num(row.remaining_amount),
    total_sessions: num(row.total_sessions),
    booked_sessions: num(row.booked_sessions),
    used_sessions: num(row.used_sessions),
  };
}

function toPayment(row: Record<string, unknown>): PackPayment {
  return { ...(row as unknown as PackPayment), amount: num(row.amount) };
}

// ---- Catalogue -------------------------------------------------------------

export async function listPacks({ includeInactive = false } = {}): Promise<Pack[]> {
  let q = getSupabase().from('packs').select('*').order('sort_order').order('name');
  if (!includeInactive) q = q.eq('is_active', true);
  return (unwrap(await q) as Record<string, unknown>[]).map(toPack);
}

export type PackInput = Pick<Pack, 'name' | 'description' | 'reference_price' | 'session_count'>;

export async function createPack(input: PackInput, sortOrder: number) {
  unwrap(await getSupabase().from('packs').insert({ ...input, sort_order: sortOrder }));
}

export async function updatePack(id: string, patch: Partial<PackInput & Pick<Pack, 'is_active'>>) {
  unwrap(await getSupabase().from('packs').update(patch).eq('id', id));
}

export async function deletePack(id: string) {
  unwrap(await getSupabase().from('packs').delete().eq('id', id));
}

// ---- Packs vendus ----------------------------------------------------------

export async function listClientPacks(clientId: string): Promise<ClientPack[]> {
  const res = await getSupabase()
    .from('client_pack_summary')
    .select('*')
    .eq('client_id', clientId)
    .order('sold_on', { ascending: false })
    .order('created_at', { ascending: false });
  return (unwrap(res) as Record<string, unknown>[]).map(toClientPack);
}

export async function listPackSales(from?: string, to?: string): Promise<ClientPack[]> {
  let q = getSupabase().from('client_pack_summary').select('*').order('sold_on', { ascending: false });
  if (from) q = q.gte('sold_on', from);
  if (to) q = q.lte('sold_on', to);
  return (unwrap(await q) as Record<string, unknown>[]).map(toClientPack);
}

export interface SellPackInput {
  clientId: string;
  packId: string;
  offeredSessions: number;
  agreedPrice: number;
  soldOn: string;
  notes: string;
  advance: number;
  advanceOn: string;
  method: PaymentMethod;
}

export async function sellPack(input: SellPackInput) {
  const res = await getSupabase().rpc('sell_pack', {
    p_client_id: input.clientId,
    p_pack_id: input.packId,
    p_offered: input.offeredSessions,
    p_agreed: input.agreedPrice,
    p_sold_on: input.soldOn,
    p_notes: input.notes,
    p_advance: input.advance,
    p_advance_on: input.advanceOn,
    p_method: input.method,
  });
  return unwrap(res) as string;
}

export async function updateClientPack(
  id: string,
  patch: Partial<Pick<ClientPack, 'offered_sessions' | 'agreed_price' | 'sold_on' | 'notes'>>
) {
  unwrap(await getSupabase().from('client_packs').update(patch).eq('id', id));
}

export async function deleteClientPack(id: string) {
  const res = await getSupabase().from('client_packs').delete().eq('id', id).select('id');
  const rows = unwrap(res) as { id: string }[];
  if (!rows.length) {
    throw new Error('Ce pack a des règlements enregistrés : seul l’administrateur peut le supprimer.');
  }
}

// ---- Règlements ------------------------------------------------------------

export async function listPayments(clientPackIds: string[]): Promise<PackPayment[]> {
  if (!clientPackIds.length) return [];
  const res = await getSupabase()
    .from('pack_payments')
    .select('*')
    .in('client_pack_id', clientPackIds)
    .order('paid_on')
    .order('created_at');
  return (unwrap(res) as Record<string, unknown>[]).map(toPayment);
}

export interface PaymentWithContext extends PackPayment {
  client_pack: {
    pack_name: string;
    client: { id: string; code: string; first_name: string; last_name: string } | null;
  } | null;
}

export async function listPaymentsBetween(from: string, to: string): Promise<PaymentWithContext[]> {
  const res = await getSupabase()
    .from('pack_payments')
    .select('*, client_pack:client_packs(pack_name, client:clients(id, code, first_name, last_name))')
    .gte('paid_on', from)
    .lte('paid_on', to)
    .order('paid_on')
    .order('created_at');
  return (unwrap(res) as Record<string, unknown>[]).map((r) => ({
    ...(toPayment(r) as PackPayment),
    client_pack: r.client_pack as PaymentWithContext['client_pack'],
  }));
}

export async function addPayment(input: { clientPackId: string; amount: number; paidOn: string; method: PaymentMethod; note: string }) {
  unwrap(
    await getSupabase().from('pack_payments').insert({
      client_pack_id: input.clientPackId,
      amount: input.amount,
      paid_on: input.paidOn,
      method: input.method,
      note: input.note.trim() || null,
    })
  );
}

export async function deletePayment(id: string) {
  const res = await getSupabase().from('pack_payments').delete().eq('id', id).select('id');
  const rows = unwrap(res) as { id: string }[];
  if (!rows.length) throw new Error('Seul l’administrateur peut supprimer un règlement.');
}
