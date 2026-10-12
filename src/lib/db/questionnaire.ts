import { getSupabase } from '@/lib/supabase/client';
import type { QuestionnaireDifficulty, QuestionnaireTheme } from '@/lib/types';
import { unwrap } from './errors';

export async function listThemes(options: { includeInactive?: boolean } = {}): Promise<QuestionnaireTheme[]> {
  const res = await getSupabase()
    .from('questionnaire_themes')
    .select('*, difficulties:questionnaire_difficulties(*)')
    .order('sort_order')
    .order('title');
  const themes = unwrap(res) as QuestionnaireTheme[];
  return themes
    .filter((t) => options.includeInactive || t.is_active)
    .map((t) => ({
      ...t,
      difficulties: [...(t.difficulties ?? [])]
        .filter((d) => options.includeInactive || d.is_active)
        .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)),
    }));
}

export async function createTheme(input: Pick<QuestionnaireTheme, 'title' | 'emoji' | 'description'>, sortOrder: number) {
  const res = await getSupabase()
    .from('questionnaire_themes')
    .insert({ ...input, sort_order: sortOrder })
    .select('*')
    .single();
  return unwrap(res) as QuestionnaireTheme;
}

export async function updateTheme(
  id: string,
  patch: Partial<Pick<QuestionnaireTheme, 'title' | 'emoji' | 'description' | 'is_active' | 'sort_order'>>
) {
  unwrap(await getSupabase().from('questionnaire_themes').update(patch).eq('id', id));
}

export async function deleteTheme(id: string) {
  unwrap(await getSupabase().from('questionnaire_themes').delete().eq('id', id));
}

export async function createDifficulty(themeId: string, label: string, sortOrder: number) {
  const res = await getSupabase()
    .from('questionnaire_difficulties')
    .insert({ theme_id: themeId, label, sort_order: sortOrder })
    .select('*')
    .single();
  return unwrap(res) as QuestionnaireDifficulty;
}

export async function updateDifficulty(
  id: string,
  patch: Partial<Pick<QuestionnaireDifficulty, 'label' | 'is_active' | 'sort_order'>>
) {
  unwrap(await getSupabase().from('questionnaire_difficulties').update(patch).eq('id', id));
}

export async function deleteDifficulty(id: string) {
  unwrap(await getSupabase().from('questionnaire_difficulties').delete().eq('id', id));
}

/** Persist a new order for themes or difficulties. */
export async function reorder(
  table:
    | 'questionnaire_themes'
    | 'questionnaire_difficulties'
    | 'kyc_sections'
    | 'kyc_fields'
    | 'boxes'
    | 'acquisition_sources'
    | 'packs'
    | 'message_templates',
  ids: string[]
) {
  const supabase = getSupabase();
  await Promise.all(
    ids.map((id, index) =>
      supabase.from(table).update({ sort_order: index + 1 }).eq('id', id).then((r) => unwrap(r))
    )
  );
}
