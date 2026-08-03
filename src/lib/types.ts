export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  address_line?: string | null;
  postal_code?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  client_id: string;
  session_date: string;
  session_number: number;
  status: SessionStatus;
  is_first_session: boolean;
  duration_minutes?: number | null;
  notes?: string | null;
  created_at: string;
}

export interface Assessment {
  id: string;
  client_id: string;
  session_id: string;
  selected_themes: string[];
  submitted_at: string;
  created_at: string;
}

export interface AssessmentResponse {
  id: string;
  assessment_id: string;
  theme_id: string;
  difficulty_id: string;
  score: number;
  is_selected: boolean;
}

export interface QuestionnaireTheme {
  id: string;
  emoji: string;
  title: string;
  description?: string;
  difficulties: QuestionnaireDifficulty[];
}

export interface QuestionnaireDifficulty {
  id: string;
  themeId: string;
  label: string;
}

export interface AssessmentFormState {
  selectedThemes: string[];
  selectedDifficulties: Record<string, boolean>;
  scores: Record<string, number>;
}

export interface SessionHistoryPoint {
  sessionId: string;
  sessionNumber: number;
  sessionDate: string;
  score: number;
  isFirstAppearance: boolean;
  isBaseline?: boolean;
}

export interface DifficultyEvolution {
  difficultyId: string;
  themeId: string;
  label: string;
  themeEmoji: string;
  themeTitle: string;
  firstSessionNumber: number;
  firstSessionDate: string;
  history: SessionHistoryPoint[];
  debut?: number;
  seance10?: number;
  seance20?: number;
  latest?: number;
  improvement: number;
  measuredAtBaseline?: boolean;
}

export interface ThemeEvolution {
  themeId: string;
  emoji: string;
  title: string;
  firstSessionNumber: number;
  firstSessionDate: string;
  difficultyCount: number;
  measuredAtBaseline?: boolean;
}

export interface ClientEvolutionData {
  difficulties: DifficultyEvolution[];
  themes: ThemeEvolution[];
  baselineSessionNumber: number;
  maxSessionNumber: number;
  totalSessions: number;
}

export interface ClientWithSessions extends Client {
  sessions: Session[];
}

export interface SessionDateValidation {
  valid: boolean;
  message?: string;
  minDate?: string;
  minTime?: string;
}
