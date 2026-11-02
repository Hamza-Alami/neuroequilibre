import { getSupabase } from '@/lib/supabase/client';
import type { Invoice } from '@/lib/types';
import { unwrap } from './errors';

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

function toInvoice(row: Record<string, unknown>): Invoice {
  const inv = row as unknown as Invoice;
  return {
    ...inv,
    total_ht: num(row.total_ht),
    tva_rate: num(row.tva_rate),
    tva_amount: num(row.tva_amount),
    total_ttc: num(row.total_ttc),
    paid_amount: num(row.paid_amount),
    lines: (inv.lines ?? []).map((l) => ({
      ...l,
      amount: num(l.amount),
      quantity: num(l.quantity) || 1,
      reference_price: num(l.reference_price),
      discount: num(l.discount),
    })),
    payments: (inv.payments ?? []).map((p) => ({ ...p, amount: num(p.amount) })),
  };
}

export async function listClientInvoices(clientId: string): Promise<Invoice[]> {
  const res = await getSupabase()
    .from('invoices')
    .select('*')
    .eq('client_id', clientId)
    .order('issued_on', { ascending: false })
    .order('number', { ascending: false });
  return (unwrap(res) as Record<string, unknown>[]).map(toInvoice);
}

export async function listInvoicesBetween(from: string, to: string): Promise<Invoice[]> {
  const res = await getSupabase()
    .from('invoices')
    .select('*')
    .gte('issued_on', from)
    .lte('issued_on', to)
    .order('issued_on')
    .order('number');
  return (unwrap(res) as Record<string, unknown>[]).map(toInvoice);
}

export async function getInvoice(id: string): Promise<Invoice> {
  return toInvoice(unwrap(await getSupabase().from('invoices').select('*').eq('id', id).single()) as Record<string, unknown>);
}

export interface IssueInvoiceInput {
  clientPackId: string;
  issuedOn: string;
  billedName: string;
  billedCompany: string;
  billedIce: string;
  billedAddress: string;
  notes: string;
}

/** Numbers, totals and snapshots are computed by the database. */
export async function issueInvoice(input: IssueInvoiceInput): Promise<Invoice> {
  const res = await getSupabase().rpc('issue_invoice', {
    p_client_pack_id: input.clientPackId,
    p_issued_on: input.issuedOn,
    p_billed_name: input.billedName,
    p_billed_company: input.billedCompany,
    p_billed_ice: input.billedIce,
    p_billed_address: input.billedAddress,
    p_notes: input.notes,
  });
  return getInvoice(unwrap(res) as string);
}

export async function cancelInvoice(id: string, reason: string) {
  unwrap(await getSupabase().rpc('cancel_invoice', { p_invoice_id: id, p_reason: reason }));
}
