import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './config';

/** Service-role client. Bypasses RLS: only use after checking the caller is an admin. */
export function createAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY manquante : la gestion des utilisateurs est indisponible.'
    );
  }
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
