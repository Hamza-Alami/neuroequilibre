import { getSupabase } from '@/lib/supabase/client';
import type { Assessment, AssessmentResponse } from '@/lib/types';
import { unwrap } from './errors';

export interface AssessmentWithResponses extends Assessment {
  responses: AssessmentResponse[];
}

export async function listClientAssessments(clientId: string): Promise<AssessmentWithResponses[]> {
  const res = await getSupabase()
    .from('assessments')
    .select('*, responses:assessment_responses(*)')
    .eq('client_id', clientId);
  return unwrap(res) as AssessmentWithResponses[];
}

export async function getSessionAssessment(sessionId: string): Promise<AssessmentWithResponses | null> {
  const res = await getSupabase()
    .from('assessments')
    .select('*, responses:assessment_responses(*)')
    .eq('session_id', sessionId)
    .maybeSingle();
  return unwrap(res) as AssessmentWithResponses | null;
}

/**
 * Latest evaluation of the client on a session dated before the given one
 * (calendar order, not edit order).
 */
export async function getPreviousAssessment(
  clientId: string,
  beforeIso: string,
  excludeSessionId: string
): Promise<(AssessmentWithResponses & { session_starts_at: string; session_number: number | null }) | null> {
  const res = await getSupabase()
    .from('assessments')
    .select('*, responses:assessment_responses(*), session:sessions!inner(starts_at, session_number, status)')
    .eq('client_id', clientId)
    .neq('session_id', excludeSessionId)
    .neq('session.status', 'cancelled')
    .lt('session.starts_at', beforeIso);
  const rows = unwrap(res) as (AssessmentWithResponses & {
    session: { starts_at: string; session_number: number | null };
  })[];
  if (!rows.length) return null;
  rows.sort((a, b) => b.session.starts_at.localeCompare(a.session.starts_at));
  const top = rows[0];
  return { ...top, session_starts_at: top.session.starts_at, session_number: top.session.session_number };
}

export async function saveAssessment(
  sessionId: string,
  selectedThemes: string[],
  responses: { theme_id: string; difficulty_id: string; score: number; theme_title?: string; theme_emoji?: string; difficulty_label?: string }[]
): Promise<string> {
  const res = await getSupabase().rpc('save_assessment', {
    p_session_id: sessionId,
    p_selected_themes: selectedThemes,
    p_responses: responses,
  });
  return unwrap(res) as string;
}
