import { getSupabase } from '@/lib/supabase/client';
import type {
  Session,
  SessionInput,
  SessionStatus,
  SessionWithRelations,
  SlotIssue,
} from '@/lib/types';
import { unwrap } from './errors';

const SESSION_SELECT =
  '*, client:clients(id, first_name, last_name, phone), box:boxes(id, name, color, is_active), assessments(id)';

type RawSession = SessionWithRelations & { assessments?: { id: string }[] | { id: string } | null };

function normalize(row: RawSession): SessionWithRelations {
  const { assessments, ...rest } = row;
  const has = Array.isArray(assessments) ? assessments.length > 0 : Boolean(assessments);
  return { ...rest, has_assessment: has };
}

export async function listSessionsBetween(startIso: string, endIso: string): Promise<SessionWithRelations[]> {
  const res = await getSupabase()
    .from('sessions')
    .select(SESSION_SELECT)
    .gte('starts_at', startIso)
    .lt('starts_at', endIso)
    .order('starts_at');
  return (unwrap(res) as RawSession[]).map(normalize);
}

export async function listClientSessions(clientId: string): Promise<SessionWithRelations[]> {
  const res = await getSupabase()
    .from('sessions')
    .select(SESSION_SELECT)
    .eq('client_id', clientId)
    .order('starts_at');
  return (unwrap(res) as RawSession[]).map(normalize);
}

export async function listUpcomingSessions(limit = 8): Promise<SessionWithRelations[]> {
  const res = await getSupabase()
    .from('sessions')
    .select(SESSION_SELECT)
    .gte('starts_at', new Date().toISOString())
    .neq('status', 'cancelled')
    .order('starts_at')
    .limit(limit);
  return (unwrap(res) as RawSession[]).map(normalize);
}

export async function getSession(id: string): Promise<SessionWithRelations | null> {
  const res = await getSupabase().from('sessions').select(SESSION_SELECT).eq('id', id).maybeSingle();
  const row = unwrap(res) as RawSession | null;
  return row ? normalize(row) : null;
}

export async function checkSlot(params: {
  boxId: string;
  startsAt: string;
  duration: number;
  excludeId?: string | null;
}): Promise<SlotIssue[]> {
  const res = await getSupabase().rpc('session_slot_issues', {
    p_box_id: params.boxId,
    p_starts_at: params.startsAt,
    p_duration: params.duration,
    p_exclude_id: params.excludeId ?? null,
  });
  return unwrap(res) as SlotIssue[];
}

export async function createSession(input: SessionInput): Promise<Session> {
  const res = await getSupabase().from('sessions').insert(input).select('*').single();
  return unwrap(res) as Session;
}

export async function updateSession(
  id: string,
  patch: Partial<SessionInput> & { status?: SessionStatus }
): Promise<Session> {
  const res = await getSupabase().from('sessions').update(patch).eq('id', id).select('*').single();
  return unwrap(res) as Session;
}

export async function setSessionStatus(id: string, status: SessionStatus) {
  return updateSession(id, { status });
}

export async function deleteSession(id: string) {
  unwrap(await getSupabase().from('sessions').delete().eq('id', id));
}