import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { localDb } from '@/lib/data/local-store';
import type { Client, Session, Assessment, AssessmentResponse } from '@/lib/types';

export const db = {
  async getClients(): Promise<Client[]> {
    if (!isSupabaseConfigured()) return localDb.getClients();
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Client[];
  },

  async getClient(id: string): Promise<Client | null> {
    if (!isSupabaseConfigured()) return localDb.getClient(id) ?? null;
    const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
    if (error) return null;
    return data as Client;
  },

  async createClient(
    client: Omit<Client, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Client> {
    if (!isSupabaseConfigured()) return localDb.createClient(client);
    const { data, error } = await supabase.from('clients').insert(client).select().single();
    if (error) throw error;
    return data as Client;
  },

  async getSessions(clientId?: string): Promise<Session[]> {
    if (!isSupabaseConfigured()) return localDb.getSessions(clientId);
    let query = supabase.from('sessions').select('*').order('session_date', { ascending: false });
    if (clientId) query = query.eq('client_id', clientId);
    const { data, error } = await query;
    if (error) throw error;
    return data as Session[];
  },

  async createSession(data: {
    client_id: string;
    session_date: string;
    is_first_session?: boolean;
    notes?: string;
  }): Promise<Session> {
    if (!isSupabaseConfigured()) return localDb.createSession(data);
    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        client_id: data.client_id,
        session_date: data.session_date,
        is_first_session: data.is_first_session ?? false,
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return session as Session;
  },

  async getSession(id: string): Promise<Session | null> {
    if (!isSupabaseConfigured()) return localDb.getSession(id) ?? null;
    const { data, error } = await supabase.from('sessions').select('*').eq('id', id).single();
    if (error) return null;
    return data as Session;
  },

  async getAssessmentBySession(sessionId: string): Promise<Assessment | null> {
    if (!isSupabaseConfigured()) return localDb.getAssessmentBySession(sessionId) ?? null;
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error) return null;
    return data as Assessment | null;
  },

  async getLatestAssessment(
    clientId: string,
    excludeSessionId?: string
  ): Promise<Assessment | null> {
    if (!isSupabaseConfigured()) {
      return localDb.getLatestAssessment(clientId, excludeSessionId) ?? null;
    }

    let query = supabase
      .from('assessments')
      .select('*, sessions!inner(session_date, session_number)')
      .eq('client_id', clientId)
      .order('session_date', { referencedTable: 'sessions', ascending: false })
      .limit(1);

    if (excludeSessionId) {
      query = query.neq('session_id', excludeSessionId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) return null;
    return data as Assessment | null;
  },

  async getAssessmentResponses(assessmentId: string): Promise<AssessmentResponse[]> {
    if (!isSupabaseConfigured()) return localDb.getAssessmentResponses(assessmentId);
    const { data, error } = await supabase
      .from('assessment_responses')
      .select('*')
      .eq('assessment_id', assessmentId);
    if (error) throw error;
    return data as AssessmentResponse[];
  },

  async saveAssessment(
    assessmentData: {
      client_id: string;
      session_id: string;
      selected_themes: string[];
    },
    responses: {
      theme_id: string;
      difficulty_id: string;
      score: number;
      is_selected: boolean;
    }[]
  ): Promise<Assessment> {
    if (!isSupabaseConfigured()) {
      return localDb.saveAssessment(assessmentData, responses);
    }

    const existing = await this.getAssessmentBySession(assessmentData.session_id);
    let assessment: Assessment;

    if (existing) {
      const { data, error } = await supabase
        .from('assessments')
        .update({
          selected_themes: assessmentData.selected_themes,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      assessment = data as Assessment;

      await supabase.from('assessment_responses').delete().eq('assessment_id', existing.id);
    } else {
      const { data, error } = await supabase
        .from('assessments')
        .insert(assessmentData)
        .select()
        .single();
      if (error) throw error;
      assessment = data as Assessment;
    }

    if (responses.length > 0) {
      const rows = responses.map((r) => ({
        ...r,
        assessment_id: assessment.id,
      }));
      const { error } = await supabase.from('assessment_responses').insert(rows);
      if (error) throw error;
    }

    return assessment;
  },

  getClientAssessments(clientId: string): Assessment[] {
    return localDb.getClientAssessments(clientId);
  },

  getEvolutionData(clientId: string) {
    return localDb.getEvolutionData(clientId);
  },
};
