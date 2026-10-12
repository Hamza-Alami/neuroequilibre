import { getSupabase } from '@/lib/supabase/client';
import type { Box, BoxBlock, CentreSettings } from '@/lib/types';
import { unwrap } from './errors';

export async function getSettings(): Promise<CentreSettings> {
  const res = await getSupabase().from('centre_settings').select('*').eq('id', 1).single();
  return unwrap(res) as CentreSettings;
}

export async function updateSettings(patch: Partial<CentreSettings>) {
  const res = await getSupabase()
    .from('centre_settings')
    .update(patch)
    .eq('id', 1)
    .select('*')
    .single();
  return unwrap(res) as CentreSettings;
}

export async function listBoxes(): Promise<Box[]> {
  const res = await getSupabase().from('boxes').select('*').order('sort_order').order('name');
  return unwrap(res) as Box[];
}

export async function createBox(input: Pick<Box, 'name' | 'color'>) {
  const boxes = await listBoxes();
  const sort_order = Math.max(0, ...boxes.map((b) => b.sort_order)) + 1;
  const res = await getSupabase()
    .from('boxes')
    .insert({ ...input, sort_order })
    .select('*')
    .single();
  return unwrap(res) as Box;
}

export async function updateBox(id: string, patch: Partial<Pick<Box, 'name' | 'color' | 'is_active' | 'sort_order'>>) {
  const res = await getSupabase().from('boxes').update(patch).eq('id', id).select('*').single();
  return unwrap(res) as Box;
}

export async function deleteBox(id: string) {
  const res = await getSupabase().from('boxes').delete().eq('id', id);
  unwrap(res, 'box');
}

export async function listBlocks(fromIso?: string, toIso?: string): Promise<BoxBlock[]> {
  let q = getSupabase().from('box_blocks').select('*').order('starts_at');
  if (toIso) q = q.lt('starts_at', toIso);
  if (fromIso) q = q.gt('ends_at', fromIso);
  const res = await q;
  return unwrap(res) as BoxBlock[];
}

export async function createBlock(input: Pick<BoxBlock, 'box_id' | 'starts_at' | 'ends_at' | 'reason'>) {
  const res = await getSupabase().from('box_blocks').insert(input).select('*').single();
  return unwrap(res) as BoxBlock;
}

export async function deleteBlock(id: string) {
  unwrap(await getSupabase().from('box_blocks').delete().eq('id', id));
}
