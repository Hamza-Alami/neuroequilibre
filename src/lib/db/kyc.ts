import { getSupabase } from '@/lib/supabase/client';
import type { KycField, KycSection } from '@/lib/types';
import { unwrap } from './errors';

export async function listKycSections(options: { includeInactive?: boolean } = {}): Promise<KycSection[]> {
  const res = await getSupabase()
    .from('kyc_sections')
    .select('*, fields:kyc_fields(*)')
    .order('sort_order');
  const sections = unwrap(res) as KycSection[];
  return sections
    .filter((s) => options.includeInactive || s.is_active)
    .map((s) => ({
      ...s,
      fields: [...(s.fields ?? [])]
        .filter((f) => options.includeInactive || f.is_active)
        .sort((a, b) => a.sort_order - b.sort_order),
    }));
}

export async function createKycSection(title: string, description: string | null, sortOrder: number) {
  const res = await getSupabase()
    .from('kyc_sections')
    .insert({ title, description, sort_order: sortOrder })
    .select('*')
    .single();
  return unwrap(res) as KycSection;
}

export async function updateKycSection(
  id: string,
  patch: Partial<Pick<KycSection, 'title' | 'description' | 'is_active' | 'sort_order'>>
) {
  unwrap(await getSupabase().from('kyc_sections').update(patch).eq('id', id));
}

export async function deleteKycSection(id: string) {
  unwrap(await getSupabase().from('kyc_sections').delete().eq('id', id));
}

export type KycFieldInput = Pick<
  KycField,
  'section_id' | 'label' | 'field_type' | 'options' | 'placeholder' | 'is_required'
>;

export async function createKycField(input: KycFieldInput, sortOrder: number) {
  const res = await getSupabase()
    .from('kyc_fields')
    .insert({ ...input, sort_order: sortOrder })
    .select('*')
    .single();
  return unwrap(res) as KycField;
}

export async function updateKycField(id: string, patch: Partial<KycFieldInput & Pick<KycField, 'is_active' | 'sort_order'>>) {
  unwrap(await getSupabase().from('kyc_fields').update(patch).eq('id', id));
}

export async function deleteKycField(id: string) {
  unwrap(await getSupabase().from('kyc_fields').delete().eq('id', id));
}
