import { getSupabase } from '@/lib/supabase/client';
import type { AcquisitionSource } from '@/lib/types';
import { unwrap } from './errors';

export async function listSources({ includeInactive = false } = {}): Promise<AcquisitionSource[]> {
  let q = getSupabase().from('acquisition_sources').select('*').order('sort_order').order('label');
  if (!includeInactive) q = q.eq('is_active', true);
  return unwrap(await q) as AcquisitionSource[];
}

export async function createSource(label: string, sortOrder: number) {
  const res = await getSupabase()
    .from('acquisition_sources')
    .insert({ label, sort_order: sortOrder })
    .select('*')
    .single();
  return unwrap(res) as AcquisitionSource;
}

export async function updateSource(id: string, patch: Partial<Pick<AcquisitionSource, 'label' | 'is_active'>>) {
  unwrap(await getSupabase().from('acquisition_sources').update(patch).eq('id', id));
}

export async function deleteSource(id: string) {
  unwrap(await getSupabase().from('acquisition_sources').delete().eq('id', id));
}

export async function countClientsBySource(): Promise<Record<string, number>> {
  const res = await getSupabase().from('clients').select('source_id');
  const rows = unwrap(res) as { source_id: string | null }[];
  const counts: Record<string, number> = {};
  for (const r of rows) if (r.source_id) counts[r.source_id] = (counts[r.source_id] ?? 0) + 1;
  return counts;
}
