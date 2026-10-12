export type Role = 'admin' | 'manager';
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';
export type DisplayStatus = 'upcoming' | 'past' | 'completed' | 'cancelled';
export type KycFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

/** Keys "1" (Monday) to "7" (Sunday), ISO weekday. */
export type OpeningHours = Record<string, DayHours>;

export interface CentreSettings {
  centre_name: string;
  welcome_message: string;
  timezone: string;
  default_session_minutes: number;
  min_gap_minutes: number;
  slot_step_minutes: number;
  opening_hours: OpeningHours;
  currency_label: string;
  phone_country_code: string;
  updated_at?: string;
}

export interface Box {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface BoxBlock {
  id: string;
  box_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_at?: string;
}

export interface KycField {
  id: string;
  section_id: string;
  label: string;
  field_type: KycFieldType;
  options: string[];
  placeholder: string | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface KycSection {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  fields: KycField[];
}

export type CustomFieldValue = string | number | boolean | null;

export type Gender = 'male' | 'female';

export interface Client {
  id: string;
  code: string;
  source_id: string | null;
  first_name: string;
  last_name: string;
  gender: Gender | null;
  date_of_birth: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  address_line: string | null;
  postal_code: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  custom_fields: Record<string, CustomFieldValue>;
  created_at: string;
  updated_at: string;
}

export type ClientInput = Omit<Client, 'id' | 'code' | 'created_at' | 'updated_at'>;

export interface AcquisitionSource {
  id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export type ClientStatus = 'active' | 'inactive';
export type StatusMode = ClientStatus | 'auto';

export interface ClientStatusInfo {
  client_id: string;
  status: ClientStatus;
  is_override: boolean;
  reason: string;
}

export interface ClientStatusChange {
  id: string;
  client_id: string;
  mode: StatusMode;
  effective_date: string;
  reason: string | null;
  created_at: string;
}

export interface Pack {
  id: string;
  name: string;
  description: string | null;
  reference_price: number;
  session_count: number;
  sort_order: number;
  is_active: boolean;
}

export type PaymentMethod = 'especes' | 'carte' | 'virement' | 'cheque' | 'autre';

export interface PackPayment {
  id: string;
  client_pack_id: string;
  amount: number;
  paid_on: string;
  method: PaymentMethod;
  note: string | null;
  created_at: string;
}

/** A pack sold to a client, with usage and balance computed by the database. */
export interface ClientPack {
  id: string;
  client_id: string;
  pack_id: string | null;
  pack_name: string;
  reference_price: number;
  session_count: number;
  offered_sessions: number;
  agreed_price: number;
  sold_on: string;
  notes: string | null;
  created_at: string;
  total_sessions: number;
  booked_sessions: number;
  used_sessions: number;
  paid_amount: number;
  remaining_amount: number;
  last_paid_on: string | null;
}

export type MessageKind = 'confirmation' | 'reminder' | 'birthday' | 'broadcast';
export type MessageChannel = 'whatsapp' | 'email';

export interface MessageTemplate {
  id: string;
  kind: MessageKind;
  title: string;
  body: string;
  email_subject: string | null;
  email_body: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Session {
  id: string;
  client_id: string;
  box_id: string;
  starts_at: string;
  duration_minutes: number;
  status: SessionStatus;
  session_number: number | null;
  gap_override: boolean;
  notes: string | null;
  created_at: string;
}

export interface SessionWithRelations extends Session {
  client: Pick<Client, 'id' | 'first_name' | 'last_name' | 'phone'> | null;
  box: Pick<Box, 'id' | 'name' | 'color' | 'is_active'> | null;
  has_assessment?: boolean;
}

export interface SessionInput {
  client_id: string;
  box_id: string;
  starts_at: string;
  duration_minutes: number;
  notes?: string | null;
  gap_override?: boolean;
}

export interface SlotIssue {
  code: string;
  level: 'error' | 'warning';
  message: string;
}

export interface QuestionnaireDifficulty {
  id: string;
  theme_id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export interface QuestionnaireTheme {
  id: string;
  emoji: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  difficulties: QuestionnaireDifficulty[];
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
  theme_title: string;
  theme_emoji: string;
  difficulty_id: string;
  difficulty_label: string;
  score: number;
}

export interface AssessmentFormState {
  selectedThemes: string[];
  selectedDifficulties: Record<string, boolean>;
  scores: Record<string, number>;
}

export interface AuditEntry {
  id: number;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  label: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
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
