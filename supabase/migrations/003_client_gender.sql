-- =============================================================================
-- NeuroÉquilibre — Migration 003 : genre du client, email facultatif
-- À exécuter une seule fois dans Supabase → SQL Editor, après la migration 002.
-- =============================================================================

alter table public.clients
  add column if not exists gender text check (gender in ('male', 'female'));

-- Email facultatif : la colonne reste non nulle, une chaîne vide signifie « aucun email ».
alter table public.clients alter column email set default '';

notify pgrst, 'reload schema';
