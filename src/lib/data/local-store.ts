import { computeClientEvolution } from '@/lib/evolution';
import { sortSessionsChronologically } from '@/lib/session-validation';
import type { Client, Session, Assessment, AssessmentResponse, ClientEvolutionData } from '@/lib/types';

const STORAGE_KEY = 'neuroequilibre_data';

interface LocalStore {
  clients: Client[];
  sessions: Session[];
  assessments: Assessment[];
  responses: AssessmentResponse[];
}

function getStore(): LocalStore {
  if (typeof window === 'undefined') {
    return { clients: [], sessions: [], assessments: [], responses: [] };
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { clients: [], sessions: [], assessments: [], responses: [] };
  return JSON.parse(raw) as LocalStore;
}

function saveStore(store: LocalStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function uuid(): string {
  return crypto.randomUUID();
}

function renumberClientSessions(store: LocalStore, clientId: string) {
  const clientSessions = store.sessions
    .filter((s) => s.client_id === clientId)
    .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime());

  clientSessions.forEach((session, index) => {
    const idx = store.sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      store.sessions[idx] = {
        ...store.sessions[idx],
        session_number: index + 1,
        is_first_session: index === 0,
      };
    }
  });
}

export const localDb = {
  getClients(): Client[] {
    return getStore().clients.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  getClient(id: string): Client | undefined {
    return getStore().clients.find((c) => c.id === id);
  },

  createClient(data: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Client {
    const store = getStore();
    const now = new Date().toISOString();
    const client: Client = { ...data, id: uuid(), created_at: now, updated_at: now };
    store.clients.push(client);
    saveStore(store);
    return client;
  },

  updateClient(id: string, data: Partial<Client>): Client | undefined {
    const store = getStore();
    const idx = store.clients.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    store.clients[idx] = { ...store.clients[idx], ...data, updated_at: new Date().toISOString() };
    saveStore(store);
    return store.clients[idx];
  },

  deleteClient(id: string): boolean {
    const store = getStore();
    const clientIdx = store.clients.findIndex((c) => c.id === id);
    if (clientIdx === -1) return false;

    const sessionIds = store.sessions.filter((s) => s.client_id === id).map((s) => s.id);
    const assessmentIds = store.assessments
      .filter((a) => a.client_id === id)
      .map((a) => a.id);

    store.clients.splice(clientIdx, 1);
    store.sessions = store.sessions.filter((s) => s.client_id !== id);
    store.assessments = store.assessments.filter((a) => a.client_id !== id);
    store.responses = store.responses.filter(
      (r) => !assessmentIds.includes(r.assessment_id)
    );

    saveStore(store);
    return true;
  },

  getSessions(clientId?: string): Session[] {
    let sessions = getStore().sessions;
    if (clientId) sessions = sessions.filter((s) => s.client_id === clientId);
    return sessions.sort(
      (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
    );
  },

  getSessionsChronological(clientId: string): Session[] {
    return sortSessionsChronologically(getStore().sessions.filter((s) => s.client_id === clientId));
  },

  createSession(data: {
    client_id: string;
    session_date: string;
    is_first_session?: boolean;
    notes?: string;
  }): Session {
    const store = getStore();
    const clientSessions = store.sessions.filter((s) => s.client_id === data.client_id);
    const sessionNumber = clientSessions.length + 1;
    const now = new Date().toISOString();
    const session: Session = {
      id: uuid(),
      client_id: data.client_id,
      session_date: data.session_date,
      session_number: sessionNumber,
      status: 'scheduled',
      is_first_session: data.is_first_session ?? sessionNumber === 1,
      notes: data.notes ?? null,
      created_at: now,
    };
    store.sessions.push(session);
    renumberClientSessions(store, data.client_id);
    saveStore(store);
    return store.sessions.find((s) => s.id === session.id)!;
  },

  getSession(id: string): Session | undefined {
    return getStore().sessions.find((s) => s.id === id);
  },

  updateSession(
    id: string,
    data: { session_date?: string; notes?: string | null; status?: Session['status'] }
  ): Session | undefined {
    const store = getStore();
    const idx = store.sessions.findIndex((s) => s.id === id);
    if (idx === -1) return undefined;

    const clientId = store.sessions[idx].client_id;
    store.sessions[idx] = { ...store.sessions[idx], ...data };
    renumberClientSessions(store, clientId);
    saveStore(store);
    return store.sessions.find((s) => s.id === id);
  },

  deleteSession(id: string): boolean {
    const store = getStore();
    const session = store.sessions.find((s) => s.id === id);
    if (!session) return false;

    const assessmentIds = store.assessments
      .filter((a) => a.session_id === id)
      .map((a) => a.id);

    store.sessions = store.sessions.filter((s) => s.id !== id);
    store.assessments = store.assessments.filter((a) => a.session_id !== id);
    store.responses = store.responses.filter((r) => !assessmentIds.includes(r.assessment_id));

    renumberClientSessions(store, session.client_id);
    saveStore(store);
    return true;
  },

  getAssessmentBySession(sessionId: string): Assessment | undefined {
    return getStore().assessments.find((a) => a.session_id === sessionId);
  },

  /** Most recent assessment by session calendar date (not last saved/edited). */
  getLatestAssessment(clientId: string, excludeSessionId?: string): Assessment | undefined {
    const store = getStore();
    const sessions = store.sessions
      .filter((s) => s.client_id === clientId && s.id !== excludeSessionId)
      .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

    for (const session of sessions) {
      const assessment = store.assessments.find((a) => a.session_id === session.id);
      if (assessment) return assessment;
    }
    return undefined;
  },

  getAssessmentResponses(assessmentId: string): AssessmentResponse[] {
    return getStore().responses.filter((r) => r.assessment_id === assessmentId);
  },

  saveAssessment(
    data: {
      client_id: string;
      session_id: string;
      selected_themes: string[];
    },
    responses: { theme_id: string; difficulty_id: string; score: number; is_selected: boolean }[]
  ): Assessment {
    const store = getStore();
    const now = new Date().toISOString();

    const existingIdx = store.assessments.findIndex((a) => a.session_id === data.session_id);
    let assessment: Assessment;

    if (existingIdx >= 0) {
      assessment = { ...store.assessments[existingIdx], ...data, submitted_at: now };
      store.assessments[existingIdx] = assessment;
      store.responses = store.responses.filter((r) => r.assessment_id !== assessment.id);
    } else {
      assessment = {
        id: uuid(),
        client_id: data.client_id,
        session_id: data.session_id,
        selected_themes: data.selected_themes,
        submitted_at: now,
        created_at: now,
      };
      store.assessments.push(assessment);
    }

    for (const r of responses) {
      store.responses.push({
        id: uuid(),
        assessment_id: assessment.id,
        theme_id: r.theme_id,
        difficulty_id: r.difficulty_id,
        score: r.score,
        is_selected: r.is_selected,
      });
    }

    saveStore(store);
    return assessment;
  },

  getClientAssessments(clientId: string): Assessment[] {
    return getStore()
      .assessments.filter((a) => a.client_id === clientId)
      .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
  },

  getClientEvolution(clientId: string): ClientEvolutionData {
    const store = getStore();
    return computeClientEvolution({
      sessions: store.sessions.filter((s) => s.client_id === clientId),
      assessments: store.assessments.filter((a) => a.client_id === clientId),
      responses: store.responses.filter((r) =>
        store.assessments.some((a) => a.client_id === clientId && a.id === r.assessment_id)
      ),
    });
  },

  /** @deprecated Use getClientEvolution instead */
  getEvolutionData(clientId: string) {
    const evolution = this.getClientEvolution(clientId);
    const legacy: Record<
      string,
      { label: string; themeId: string; points: { sessionNumber: number; score: number }[] }
    > = {};

    for (const d of evolution.difficulties) {
      legacy[d.difficultyId] = {
        label: d.label,
        themeId: d.themeId,
        points: d.history.map((h) => ({
          sessionNumber: h.sessionNumber,
          score: h.score,
        })),
      };
    }
    return legacy;
  },
};
