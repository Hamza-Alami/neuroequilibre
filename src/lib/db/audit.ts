import { getSupabase } from '@/lib/supabase/client';
import type { AuditEntry } from '@/lib/types';
import { unwrap } from './errors';

export async function listAudit(params: { entity?: string; limit?: number; before?: number } = {}) {
  let q = getSupabase()
    .from('audit_log')
    .select('*')
    .order('id', { ascending: false })
    .limit(params.limit ?? 100);
  if (params.entity) q = q.eq('entity', params.entity);
  if (params.before) q = q.lt('id', params.before);
  return unwrap(await q) as AuditEntry[];
}

export const ENTITY_LABELS: Record<string, string> = {
  clients: 'Client',
  sessions: 'Séance',
  boxes: 'Box',
  box_blocks: 'Blocage',
  questionnaire_themes: 'Thème d\u2019évaluation',
  questionnaire_difficulties: 'Sous-thème d\u2019évaluation',
  kyc_sections: 'Section KYC',
  kyc_fields: 'Champ KYC',
  centre_settings: 'Paramètres',
  assessments: 'Évaluation',
  users: 'Utilisateur',
  legacy: 'Import',
};

export const ACTION_LABELS: Record<string, string> = {
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  cancel: 'Annulation',
  complete: 'Séance réalisée',
  restore: 'Réactivation',
  import: 'Import',
  deactivate: 'Désactivation',
  activate: 'Réactivation',
  password: 'Mot de passe',
  role: 'Changement de rôle',
};
