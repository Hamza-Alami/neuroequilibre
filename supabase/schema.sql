-- =============================================================================
-- NeuroÉquilibre — Schéma Supabase complet
-- À exécuter une seule fois sur un projet Supabase neuf :
--   Dashboard → SQL Editor → New query → coller ce fichier → Run
-- =============================================================================

create extension if not exists pgcrypto;

-- =============================================================================
-- TYPES
-- =============================================================================

create type public.app_role as enum ('admin', 'manager');
create type public.session_status as enum ('scheduled', 'completed', 'cancelled');
create type public.kyc_field_type as enum ('text', 'textarea', 'number', 'date', 'select', 'checkbox');

-- =============================================================================
-- UTILITAIRES
-- =============================================================================

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- UTILISATEURS & RÔLES
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role public.app_role not null default 'manager',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Le rôle vient de app_metadata (non modifiable par l'utilisateur).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, ''),
    case when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin'::public.app_role
         else 'manager'::public.app_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active and role = 'admin');
$$;

-- =============================================================================
-- PARAMÈTRES DU CENTRE (ligne unique)
-- opening_hours : clés "1" (lundi) … "7" (dimanche)
-- =============================================================================

create table public.centre_settings (
  id smallint primary key default 1 check (id = 1),
  centre_name text not null default 'NeuroÉquilibre Centre',
  welcome_message text not null default 'Bienvenue au Centre NeuroÉquilibre.',
  timezone text not null default 'Africa/Casablanca',
  default_session_minutes integer not null default 45 check (default_session_minutes between 5 and 240),
  min_gap_minutes integer not null default 44 check (min_gap_minutes between 0 and 240),
  slot_step_minutes integer not null default 15 check (slot_step_minutes in (5, 10, 15, 20, 30, 60)),
  opening_hours jsonb not null default '{
    "1": {"open": "09:00", "close": "19:00", "closed": false},
    "2": {"open": "09:00", "close": "19:00", "closed": false},
    "3": {"open": "09:00", "close": "19:00", "closed": false},
    "4": {"open": "09:00", "close": "19:00", "closed": false},
    "5": {"open": "09:00", "close": "19:00", "closed": false},
    "6": {"open": "09:00", "close": "13:00", "closed": false},
    "7": {"open": "09:00", "close": "13:00", "closed": true}
  }'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger centre_settings_touch before update on public.centre_settings
  for each row execute function public.touch_updated_at();

insert into public.centre_settings default values;

-- =============================================================================
-- BOXES & BLOCAGES
-- =============================================================================

create table public.boxes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#C8963E',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.boxes (name, color, sort_order) values
  ('Box 1', '#2F4A6D', 1),
  ('Box 2', '#C8963E', 2);

-- box_id NULL = blocage de tout le centre
create table public.box_blocks (
  id uuid primary key default gen_random_uuid(),
  box_id uuid references public.boxes (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint box_blocks_range check (ends_at > starts_at)
);

create index box_blocks_range_idx on public.box_blocks (starts_at, ends_at);

-- =============================================================================
-- FORMULAIRE KYC PERSONNALISABLE
-- =============================================================================

create table public.kyc_sections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.kyc_fields (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.kyc_sections (id) on delete cascade,
  label text not null,
  field_type public.kyc_field_type not null default 'text',
  options text[] not null default '{}',
  placeholder text,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index kyc_fields_section_idx on public.kyc_fields (section_id);

with s as (
  insert into public.kyc_sections (title, description, sort_order)
  values ('Informations complémentaires', 'Champs personnalisables par l''administrateur.', 1)
  returning id
)
insert into public.kyc_fields (section_id, label, field_type, options, is_required, sort_order)
select s.id, f.label, f.field_type::public.kyc_field_type, f.options, false, f.sort_order
from s, (values
  ('Profession', 'text', '{}'::text[], 1),
  ('Comment avez-vous connu le centre ?', 'select',
    array['Bouche-à-oreille', 'Internet', 'Réseaux sociaux', 'Médecin / thérapeute', 'Autre'], 2),
  ('Médecin traitant', 'text', '{}'::text[], 3),
  ('Traitements en cours', 'textarea', '{}'::text[], 4)
) as f (label, field_type, options, sort_order);

-- =============================================================================
-- CLIENTS
-- =============================================================================

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  city text not null,
  country text not null default 'Maroc',
  phone text not null,
  email text not null,
  address_line text,
  postal_code text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  custom_fields jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_name_idx on public.clients (last_name, first_name);
create index clients_email_idx on public.clients (lower(email));

create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- SÉANCES
-- =============================================================================

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  box_id uuid not null references public.boxes (id) on delete restrict,
  starts_at timestamptz not null,
  duration_minutes integer not null default 45 check (duration_minutes between 5 and 480),
  status public.session_status not null default 'scheduled',
  session_number integer,
  gap_override boolean not null default false,
  notes text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un même box ne peut pas avoir deux séances actives à la même heure.
create unique index sessions_box_start_unique
  on public.sessions (box_id, starts_at) where status <> 'cancelled';
create index sessions_client_idx on public.sessions (client_id, starts_at);
create index sessions_start_idx on public.sessions (starts_at);

create trigger sessions_touch before update on public.sessions
  for each row execute function public.touch_updated_at();

-- Liste des problèmes d'un créneau : level = 'error' (bloquant) ou 'warning'.
create or replace function public.session_slot_issues(
  p_box_id uuid,
  p_starts_at timestamptz,
  p_duration integer,
  p_exclude_id uuid default null
)
returns table (code text, level text, message text)
language plpgsql stable security definer set search_path = public as $$
declare
  s public.centre_settings%rowtype;
  v_box public.boxes%rowtype;
  v_local timestamp;
  v_local_end timestamp;
  v_end timestamptz := p_starts_at + make_interval(mins => p_duration);
  v_day jsonb;
  v_open time;
  v_close time;
  r record;
begin
  if not public.is_staff() then
    raise exception 'Accès refusé.';
  end if;

  select * into s from public.centre_settings where id = 1;
  v_local := p_starts_at at time zone s.timezone;
  v_local_end := v_end at time zone s.timezone;

  select * into v_box from public.boxes where id = p_box_id;
  if not found then
    return query select 'BOX_NOT_FOUND', 'error', 'Box introuvable.';
    return;
  end if;
  if not v_box.is_active then
    return query select 'BOX_INACTIVE', 'error', format('%s est désactivé.', v_box.name);
  end if;

  if v_local::date < (now() at time zone s.timezone)::date then
    return query select 'PAST_DATE', 'error',
      'Impossible de réserver une date antérieure à aujourd''hui.';
    return;
  elsif p_starts_at < now() then
    return query select 'PAST_TIME', 'warning', 'Cet horaire est déjà passé aujourd''hui.';
  end if;

  v_day := s.opening_hours -> (extract(isodow from v_local)::int)::text;
  if v_day is null or coalesce((v_day ->> 'closed')::boolean, false) then
    return query select 'CLOSED_DAY', 'error', 'Le centre est fermé ce jour-là.';
  else
    v_open := (v_day ->> 'open')::time;
    v_close := (v_day ->> 'close')::time;
    if v_local::time < v_open
       or v_local_end::date > v_local::date
       or v_local_end::time > v_close then
      return query select 'OUT_OF_HOURS', 'error',
        format('En dehors des horaires d''ouverture (%s – %s).',
               to_char(v_open, 'HH24:MI'), to_char(v_close, 'HH24:MI'));
    end if;
  end if;

  for r in
    select b.reason, b.box_id
    from public.box_blocks b
    where (b.box_id = p_box_id or b.box_id is null)
      and b.starts_at < v_end
      and b.ends_at > p_starts_at
  loop
    return query select 'BLOCKED', 'error',
      format('Créneau bloqué%s%s.',
             case when r.box_id is null then ' pour tout le centre' else ' pour ' || v_box.name end,
             case when coalesce(r.reason, '') <> '' then ' (' || r.reason || ')' else '' end);
  end loop;

  for r in
    select se.starts_at, se.duration_minutes, c.first_name, c.last_name
    from public.sessions se
    join public.clients c on c.id = se.client_id
    where se.box_id = p_box_id
      and se.status <> 'cancelled'
      and (p_exclude_id is null or se.id <> p_exclude_id)
    order by se.starts_at
  loop
    if r.starts_at = p_starts_at then
      return query select 'SLOT_TAKEN', 'error',
        format('%s est déjà réservé à %s (%s %s).', v_box.name,
               to_char(r.starts_at at time zone s.timezone, 'HH24:MI'), r.first_name, r.last_name);
    elsif r.starts_at < p_starts_at
      and (p_starts_at - r.starts_at < make_interval(mins => s.min_gap_minutes)
           or r.starts_at + make_interval(mins => r.duration_minutes) > p_starts_at) then
      return query select 'GAP_PREVIOUS', 'warning',
        format('La séance précédente dans %s (%s, %s %s) ne sera pas encore terminée : %s minutes minimum entre deux débuts de séance.',
               v_box.name, to_char(r.starts_at at time zone s.timezone, 'HH24:MI'),
               r.first_name, r.last_name, s.min_gap_minutes);
    elsif r.starts_at > p_starts_at
      and (r.starts_at - p_starts_at < make_interval(mins => s.min_gap_minutes)
           or v_end > r.starts_at) then
      return query select 'GAP_NEXT', 'warning',
        format('La séance suivante dans %s commence à %s (%s %s) : cette séance ne sera pas terminée à temps.',
               v_box.name, to_char(r.starts_at at time zone s.timezone, 'HH24:MI'),
               r.first_name, r.last_name);
    end if;
  end loop;
end;
$$;

-- Validation côté base : impossible de contourner les règles depuis le navigateur.
create or replace function public.sessions_validate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_errors text[] := '{}';
  v_warnings text[] := '{}';
begin
  if coalesce(current_setting('app.skip_session_checks', true), '') = 'on' then
    return new;
  end if;
  if new.status = 'cancelled' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.status <> 'cancelled'
     and new.starts_at = old.starts_at
     and new.box_id = old.box_id
     and new.duration_minutes = old.duration_minutes then
    return new;
  end if;

  for r in
    select * from public.session_slot_issues(
      new.box_id, new.starts_at, new.duration_minutes,
      case when tg_op = 'UPDATE' then new.id end)
  loop
    if r.level = 'error' then
      v_errors := v_errors || r.message;
    elsif r.code like 'GAP_%' then
      v_warnings := v_warnings || r.message;
    end if;
  end loop;

  if cardinality(v_errors) > 0 then
    raise exception using errcode = 'P0001', message = array_to_string(v_errors, ' '), hint = 'SLOT_ERROR';
  end if;
  if cardinality(v_warnings) > 0 and not new.gap_override then
    raise exception using errcode = 'P0001', message = array_to_string(v_warnings, ' '), hint = 'GAP_WARNING';
  end if;
  return new;
end;
$$;

create trigger sessions_validate_trg
  before insert or update on public.sessions
  for each row execute function public.sessions_validate();

-- Numérotation chronologique des séances (les séances annulées ne comptent pas).
create or replace function public.renumber_client_sessions(p_client_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  with ranked as (
    select id, row_number() over (order by starts_at, created_at) as rn
    from public.sessions
    where client_id = p_client_id and status <> 'cancelled'
  )
  update public.sessions s set session_number = ranked.rn
  from ranked
  where s.id = ranked.id and s.session_number is distinct from ranked.rn;

  update public.sessions set session_number = null
  where client_id = p_client_id and status = 'cancelled' and session_number is not null;
end;
$$;

create or replace function public.sessions_renumber_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.renumber_client_sessions(old.client_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.client_id <> old.client_id) then
    perform public.renumber_client_sessions(new.client_id);
  end if;
  return null;
end;
$$;

create trigger sessions_renumber
  after insert or delete or update of starts_at, status, client_id on public.sessions
  for each row execute function public.sessions_renumber_trg();

-- =============================================================================
-- QUESTIONNAIRE D'ÉVALUATION (thèmes et sous-thèmes)
-- =============================================================================

create table public.questionnaire_themes (
  id text primary key default gen_random_uuid()::text,
  emoji text not null default '🧠',
  title text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.questionnaire_difficulties (
  id text primary key default gen_random_uuid()::text,
  theme_id text not null references public.questionnaire_themes (id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index questionnaire_difficulties_theme_idx on public.questionnaire_difficulties (theme_id);

-- =============================================================================
-- ÉVALUATIONS
-- Les libellés sont copiés dans les réponses : supprimer un thème
-- ne détruit jamais l'historique d'un client.
-- =============================================================================

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  session_id uuid not null unique references public.sessions (id) on delete cascade,
  selected_themes text[] not null default '{}',
  submitted_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assessments_client_idx on public.assessments (client_id);

create trigger assessments_touch before update on public.assessments
  for each row execute function public.touch_updated_at();

create table public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  theme_id text not null,
  theme_title text not null default '',
  theme_emoji text not null default '',
  difficulty_id text not null,
  difficulty_label text not null default '',
  score integer not null check (score between 0 and 10),
  constraint assessment_responses_unique unique (assessment_id, difficulty_id)
);

create index assessment_responses_assessment_idx on public.assessment_responses (assessment_id);

-- Enregistrement atomique d'une évaluation (création ou modification).
create or replace function public.save_assessment(
  p_session_id uuid,
  p_selected_themes text[],
  p_responses jsonb
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_client_id uuid;
  v_assessment_id uuid;
begin
  select client_id into v_client_id from public.sessions where id = p_session_id;
  if v_client_id is null then
    raise exception 'Séance introuvable.';
  end if;

  insert into public.assessments (client_id, session_id, selected_themes, submitted_at)
  values (v_client_id, p_session_id, coalesce(p_selected_themes, '{}'), now())
  on conflict (session_id) do update
    set selected_themes = excluded.selected_themes, submitted_at = now()
  returning id into v_assessment_id;

  delete from public.assessment_responses where assessment_id = v_assessment_id;

  insert into public.assessment_responses
    (assessment_id, theme_id, theme_title, theme_emoji, difficulty_id, difficulty_label, score)
  select v_assessment_id, x.theme_id,
         coalesce(t.title, x.theme_title, ''), coalesce(t.emoji, x.theme_emoji, ''),
         x.difficulty_id, coalesce(d.label, x.difficulty_label, ''), x.score
  from jsonb_to_recordset(coalesce(p_responses, '[]'::jsonb)) as x (
    theme_id text, theme_title text, theme_emoji text,
    difficulty_id text, difficulty_label text, score integer)
  left join public.questionnaire_themes t on t.id = x.theme_id
  left join public.questionnaire_difficulties d on d.id = x.difficulty_id;

  return v_assessment_id;
end;
$$;

-- =============================================================================
-- JOURNAL DES ACTIONS
-- =============================================================================

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_name text,
  action text not null,
  entity text not null,
  entity_id text,
  label text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb;
  v_old jsonb;
  v_action text;
  v_label text;
  v_actor uuid := auth.uid();
  v_tz text;
begin
  if pg_trigger_depth() > 1 or coalesce(current_setting('app.skip_session_checks', true), '') = 'on' then
    return null;
  end if;

  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_old := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_action := case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end;

  if tg_table_name = 'sessions' and tg_op = 'UPDATE' and v_row ->> 'status' <> v_old ->> 'status' then
    v_action := case v_row ->> 'status'
      when 'cancelled' then 'cancel' when 'completed' then 'complete' else 'restore' end;
  end if;

  select timezone into v_tz from public.centre_settings where id = 1;

  v_label := case tg_table_name
    when 'clients' then concat_ws(' ', v_row ->> 'first_name', v_row ->> 'last_name')
    when 'sessions' then (
      select concat_ws(' · ', c.first_name || ' ' || c.last_name, b.name,
        to_char((v_row ->> 'starts_at')::timestamptz at time zone v_tz, 'DD/MM/YYYY HH24:MI'))
      from (select 1) x
      left join public.clients c on c.id = (v_row ->> 'client_id')::uuid
      left join public.boxes b on b.id = (v_row ->> 'box_id')::uuid)
    when 'boxes' then v_row ->> 'name'
    when 'box_blocks' then concat_ws(' · ',
      coalesce((select name from public.boxes where id = (v_row ->> 'box_id')::uuid), 'Tout le centre'),
      to_char((v_row ->> 'starts_at')::timestamptz at time zone v_tz, 'DD/MM/YYYY HH24:MI') || ' → ' ||
      to_char((v_row ->> 'ends_at')::timestamptz at time zone v_tz, 'HH24:MI'),
      nullif(v_row ->> 'reason', ''))
    when 'questionnaire_themes' then v_row ->> 'title'
    when 'questionnaire_difficulties' then v_row ->> 'label'
    when 'kyc_sections' then v_row ->> 'title'
    when 'kyc_fields' then v_row ->> 'label'
    when 'centre_settings' then 'Paramètres du centre'
    when 'assessments' then (
      select c.first_name || ' ' || c.last_name from public.clients c
      where c.id = (v_row ->> 'client_id')::uuid)
    else null end;

  insert into public.audit_log (actor_id, actor_name, action, entity, entity_id, label)
  values (
    v_actor,
    coalesce((select full_name from public.profiles where id = v_actor), 'Système'),
    v_action, tg_table_name, v_row ->> 'id', v_label
  );
  return null;
end;
$$;

create trigger audit_clients after insert or update or delete on public.clients
  for each row execute function public.audit_trigger();
create trigger audit_sessions after insert or update or delete on public.sessions
  for each row execute function public.audit_trigger();
create trigger audit_boxes after insert or update or delete on public.boxes
  for each row execute function public.audit_trigger();
create trigger audit_box_blocks after insert or update or delete on public.box_blocks
  for each row execute function public.audit_trigger();
create trigger audit_themes after insert or update or delete on public.questionnaire_themes
  for each row execute function public.audit_trigger();
create trigger audit_difficulties after insert or update or delete on public.questionnaire_difficulties
  for each row execute function public.audit_trigger();
create trigger audit_kyc_sections after insert or update or delete on public.kyc_sections
  for each row execute function public.audit_trigger();
create trigger audit_kyc_fields after insert or update or delete on public.kyc_fields
  for each row execute function public.audit_trigger();
create trigger audit_settings after update on public.centre_settings
  for each row execute function public.audit_trigger();
create trigger audit_assessments after insert or update on public.assessments
  for each row execute function public.audit_trigger();

-- =============================================================================
-- IMPORT DES DONNÉES DE L'ANCIENNE VERSION (stockage navigateur)
-- =============================================================================

create or replace function public.import_legacy_data(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_box uuid;
  v_clients integer;
  v_sessions integer;
  v_assessments integer;
  v_client uuid;
begin
  if not public.is_admin() then
    raise exception 'Réservé à l''administrateur.';
  end if;

  perform set_config('app.skip_session_checks', 'on', true);

  select id into v_box from public.boxes where is_active order by sort_order, name limit 1;
  if v_box is null then
    raise exception 'Aucun box actif pour rattacher les séances importées.';
  end if;

  insert into public.clients (id, first_name, last_name, date_of_birth, city, country, phone, email,
    address_line, postal_code, emergency_contact_name, emergency_contact_phone, notes, created_at)
  select x.id, x.first_name, x.last_name, x.date_of_birth, x.city, coalesce(x.country, 'Maroc'),
    x.phone, x.email, x.address_line, x.postal_code, x.emergency_contact_name,
    x.emergency_contact_phone, x.notes, coalesce(x.created_at, now())
  from jsonb_to_recordset(coalesce(p_payload -> 'clients', '[]'::jsonb)) as x (
    id uuid, first_name text, last_name text, date_of_birth date, city text, country text,
    phone text, email text, address_line text, postal_code text, emergency_contact_name text,
    emergency_contact_phone text, notes text, created_at timestamptz)
  on conflict do nothing;
  get diagnostics v_clients = row_count;

  insert into public.sessions (id, client_id, box_id, starts_at, duration_minutes, status, notes, created_at)
  select x.id, x.client_id, v_box, x.session_date, coalesce(x.duration_minutes, 45),
    coalesce(x.status, 'scheduled')::public.session_status, x.notes, coalesce(x.created_at, now())
  from jsonb_to_recordset(coalesce(p_payload -> 'sessions', '[]'::jsonb)) as x (
    id uuid, client_id uuid, session_date timestamptz, duration_minutes integer,
    status text, notes text, created_at timestamptz)
  where exists (select 1 from public.clients c where c.id = x.client_id)
  on conflict do nothing;
  get diagnostics v_sessions = row_count;

  insert into public.assessments (id, client_id, session_id, selected_themes, submitted_at, created_at)
  select x.id, x.client_id, x.session_id, coalesce(x.selected_themes, '{}'),
    coalesce(x.submitted_at, now()), coalesce(x.created_at, now())
  from jsonb_to_recordset(coalesce(p_payload -> 'assessments', '[]'::jsonb)) as x (
    id uuid, client_id uuid, session_id uuid, selected_themes text[],
    submitted_at timestamptz, created_at timestamptz)
  where exists (select 1 from public.sessions s where s.id = x.session_id)
  on conflict do nothing;
  get diagnostics v_assessments = row_count;

  insert into public.assessment_responses
    (assessment_id, theme_id, theme_title, theme_emoji, difficulty_id, difficulty_label, score)
  select x.assessment_id, x.theme_id, coalesce(t.title, ''), coalesce(t.emoji, ''),
    x.difficulty_id, coalesce(d.label, x.difficulty_id), x.score
  from jsonb_to_recordset(coalesce(p_payload -> 'responses', '[]'::jsonb)) as x (
    assessment_id uuid, theme_id text, difficulty_id text, score integer, is_selected boolean)
  left join public.questionnaire_themes t on t.id = x.theme_id
  left join public.questionnaire_difficulties d on d.id = x.difficulty_id
  where coalesce(x.is_selected, true)
    and exists (select 1 from public.assessments a where a.id = x.assessment_id)
  on conflict do nothing;

  for v_client in
    select distinct (x ->> 'client_id')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'sessions', '[]'::jsonb)) x
  loop
    perform public.renumber_client_sessions(v_client);
  end loop;

  insert into public.audit_log (actor_id, actor_name, action, entity, label)
  values (auth.uid(), (select full_name from public.profiles where id = auth.uid()), 'import', 'legacy',
    format('%s clients, %s séances, %s évaluations importés', v_clients, v_sessions, v_assessments));

  return jsonb_build_object('clients', v_clients, 'sessions', v_sessions, 'assessments', v_assessments);
end;
$$;

-- =============================================================================
-- SÉCURITÉ (RLS)
-- Gestionnaire : travail quotidien. Administrateur : tout, y compris la configuration.
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.centre_settings enable row level security;
alter table public.boxes enable row level security;
alter table public.box_blocks enable row level security;
alter table public.kyc_sections enable row level security;
alter table public.kyc_fields enable row level security;
alter table public.clients enable row level security;
alter table public.sessions enable row level security;
alter table public.questionnaire_themes enable row level security;
alter table public.questionnaire_difficulties enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());

create policy settings_select on public.centre_settings for select to authenticated using (public.is_staff());
create policy settings_update on public.centre_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy boxes_select on public.boxes for select to authenticated using (public.is_staff());
create policy boxes_write on public.boxes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy blocks_select on public.box_blocks for select to authenticated using (public.is_staff());
create policy blocks_write on public.box_blocks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy kyc_sections_select on public.kyc_sections for select to authenticated using (public.is_staff());
create policy kyc_sections_write on public.kyc_sections for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy kyc_fields_select on public.kyc_fields for select to authenticated using (public.is_staff());
create policy kyc_fields_write on public.kyc_fields for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy themes_select on public.questionnaire_themes for select to authenticated using (public.is_staff());
create policy themes_write on public.questionnaire_themes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy difficulties_select on public.questionnaire_difficulties for select to authenticated using (public.is_staff());
create policy difficulties_write on public.questionnaire_difficulties for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy clients_select on public.clients for select to authenticated using (public.is_staff());
create policy clients_insert on public.clients for insert to authenticated with check (public.is_staff());
create policy clients_update on public.clients for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy clients_delete on public.clients for delete to authenticated using (public.is_admin());

create policy sessions_all on public.sessions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy assessments_all on public.assessments for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy responses_all on public.assessment_responses for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy audit_select on public.audit_log for select to authenticated using (public.is_admin());

revoke execute on function public.import_legacy_data(jsonb) from public, anon;
revoke execute on function public.session_slot_issues(uuid, timestamptz, integer, uuid) from public, anon;
revoke execute on function public.save_assessment(uuid, text[], jsonb) from public, anon;
revoke execute on function public.renumber_client_sessions(uuid) from public, anon, authenticated;

-- =============================================================================
-- DONNÉES INITIALES DU QUESTIONNAIRE NEUROÉQUILIBRE
-- =============================================================================

alter table public.questionnaire_themes disable trigger audit_themes;
alter table public.questionnaire_difficulties disable trigger audit_difficulties;

insert into public.questionnaire_themes (id, emoji, title, description, sort_order) values
  ('concentration', '🧠', 'Concentration, mémoire et fonctions cognitives', null, 1),
  ('stress', '😌', 'Stress, anxiété et équilibre émotionnel', null, 2),
  ('sommeil', '😴', 'Sommeil et récupération', null, 3),
  ('scolaire', '🎓', 'Réussite scolaire et apprentissage', null, 4),
  ('professionnel', '💼', 'Performance professionnelle et entrepreneuriale', null, 5),
  ('sport', '🏃', 'Performance sportive', null, 6),
  ('bien_etre', '🌿', 'Bien-être et développement personnel', null, 7),
  ('famille', '👨‍👩‍👧', 'Enfants, adolescents et famille', null, 8),
  ('optimisation', '⭐', 'Optimisation des performances', null, 9),
  ('sante', '🩺', 'Accompagnement de certaines problématiques de santé',
    'Le neurofeedback est proposé comme un accompagnement complémentaire et ne remplace pas un suivi médical.', 10);

insert into public.questionnaire_difficulties (id, theme_id, label, sort_order) values
  ('diff_concentre', 'concentration', 'Difficulté à rester concentré', 1),
  ('distraction_frequente', 'concentration', 'Distraction fréquente', 2),
  ('manque_attention', 'concentration', 'Manque d''attention', 3),
  ('difficulte_terminer_tache', 'concentration', 'Difficulté à terminer une tâche', 4),
  ('difficulte_memoriser', 'concentration', 'Difficulté à mémoriser', 5),
  ('oublis_frequents', 'concentration', 'Oublis fréquents', 6),
  ('difficulte_apprendre', 'concentration', 'Difficulté à apprendre', 7),
  ('brouillard_mental', 'concentration', 'Brouillard mental', 8),
  ('difficulte_reflechir', 'concentration', 'Difficulté à réfléchir', 9),
  ('difficulte_mots', 'concentration', 'Difficulté à trouver ses mots', 10),
  ('difficulte_organiser', 'concentration', 'Difficulté à s''organiser', 11),
  ('difficulte_prioriser', 'concentration', 'Difficulté à prioriser', 12),
  ('stress_chronique', 'stress', 'Stress chronique', 1),
  ('stress_professionnel', 'stress', 'Stress professionnel', 2),
  ('stress_scolaire', 'stress', 'Stress scolaire', 3),
  ('charge_mentale', 'stress', 'Charge mentale importante', 4),
  ('difficulte_lacher_prise', 'stress', 'Difficulté à lâcher prise', 5),
  ('anxiete', 'stress', 'Anxiété', 6),
  ('crises_angoisse', 'stress', 'Crises d''angoisse', 7),
  ('crises_panique', 'stress', 'Crises de panique', 8),
  ('inquietudes_permanentes', 'stress', 'Inquiétudes permanentes', 9),
  ('irritabilite', 'stress', 'Irritabilité', 10),
  ('coleres_frequentes', 'stress', 'Colères fréquentes', 11),
  ('impulsivite', 'stress', 'Impulsivité', 12),
  ('hypersensibilite', 'stress', 'Hypersensibilité', 13),
  ('difficulte_emotions', 'stress', 'Difficulté à gérer ses émotions', 14),
  ('burn_out', 'stress', 'Burn-out', 15),
  ('epuisement_emotionnel', 'stress', 'Épuisement émotionnel', 16),
  ('deuil_separation', 'stress', 'Deuil ou séparation difficile', 17),
  ('difficulte_endormir', 'sommeil', 'Difficulté à s''endormir', 1),
  ('reveils_nocturnes', 'sommeil', 'Réveils nocturnes', 2),
  ('reveil_trop_tot', 'sommeil', 'Réveil trop tôt', 3),
  ('sommeil_non_reparateur', 'sommeil', 'Sommeil non réparateur', 4),
  ('cauchemars', 'sommeil', 'Cauchemars', 5),
  ('terreurs_nocturnes', 'sommeil', 'Terreurs nocturnes', 6),
  ('fatigue_chronique', 'sommeil', 'Fatigue chronique', 7),
  ('manque_energie', 'sommeil', 'Manque d''énergie', 8),
  ('difficulte_recuperer', 'sommeil', 'Difficulté à récupérer', 9),
  ('somnolence_journee', 'sommeil', 'Somnolence dans la journée', 10),
  ('difficultes_scolaires', 'scolaire', 'Difficultés scolaires', 1),
  ('difficultes_apprentissage', 'scolaire', 'Difficultés d''apprentissage', 2),
  ('difficulte_suivre_classe', 'scolaire', 'Difficulté à suivre en classe', 3),
  ('difficulte_devoirs', 'scolaire', 'Difficulté à faire les devoirs', 4),
  ('difficulte_reviser', 'scolaire', 'Difficulté à réviser', 5),
  ('difficulte_examens', 'scolaire', 'Difficulté pendant les examens', 6),
  ('manque_motivation_scolaire', 'scolaire', 'Manque de motivation', 7),
  ('stress_examens', 'scolaire', 'Stress des examens', 8),
  ('fatigue_mentale', 'professionnel', 'Fatigue mentale', 1),
  ('difficulte_decisions', 'professionnel', 'Difficulté à prendre des décisions', 2),
  ('difficulte_concentre_pro', 'professionnel', 'Difficulté à rester concentré', 3),
  ('manque_creativite', 'professionnel', 'Manque de créativité', 4),
  ('perte_motivation_pro', 'professionnel', 'Perte de motivation', 5),
  ('difficulte_projets', 'professionnel', 'Difficulté à gérer plusieurs projets', 6),
  ('gestion_pression_pro', 'professionnel', 'Gestion de la pression', 7),
  ('charge_mentale_pro', 'professionnel', 'Charge mentale importante', 8),
  ('difficulte_deconnecter', 'professionnel', 'Difficulté à déconnecter du travail', 9),
  ('difficulte_concentre_sport', 'sport', 'Difficulté à rester concentré en compétition', 1),
  ('stress_competition', 'sport', 'Gestion du stress avant compétition', 2),
  ('perte_confiance_sport', 'sport', 'Perte de confiance', 3),
  ('recuperation_mentale', 'sport', 'Difficulté à récupérer mentalement', 4),
  ('gestion_pression_sport', 'sport', 'Difficulté à gérer la pression', 5),
  ('moment_present', 'sport', 'Difficulté à rester dans le moment présent', 6),
  ('manque_confiance', 'bien_etre', 'Manque de confiance en soi', 1),
  ('manque_estime', 'bien_etre', 'Manque d''estime de soi', 2),
  ('timidite', 'bien_etre', 'Timidité', 3),
  ('peur_regard', 'bien_etre', 'Peur du regard des autres', 4),
  ('difficulte_parole', 'bien_etre', 'Difficulté à prendre la parole', 5),
  ('difficulte_affirmer', 'bien_etre', 'Difficulté à s''affirmer', 6),
  ('difficulte_communiquer', 'bien_etre', 'Difficulté à communiquer', 7),
  ('difficulte_conflits', 'bien_etre', 'Difficulté à gérer les conflits', 8),
  ('difficulte_relations', 'bien_etre', 'Difficulté à créer des relations', 9),
  ('potentiel_inexploite', 'bien_etre', 'Impression de ne pas exploiter son potentiel', 10),
  ('coleres_frequentes_famille', 'famille', 'Colères fréquentes', 1),
  ('crises_emotionnelles', 'famille', 'Crises émotionnelles', 2),
  ('hyperactivite', 'famille', 'Hyperactivité', 3),
  ('difficulte_calme', 'famille', 'Difficulté à rester calme', 4),
  ('difficulte_frustration', 'famille', 'Difficulté à gérer la frustration', 5),
  ('difficultes_relationnelles_famille', 'famille', 'Difficultés relationnelles', 6),
  ('difficultes_sommeil_famille', 'famille', 'Difficultés de sommeil', 7),
  ('cauchemars_famille', 'famille', 'Cauchemars', 8),
  ('difficultes_scolaires_famille', 'famille', 'Difficultés scolaires', 9),
  ('ameliorer_concentration', 'optimisation', 'Améliorer ma concentration', 1),
  ('ameliorer_memoire', 'optimisation', 'Améliorer ma mémoire', 2),
  ('developper_creativite', 'optimisation', 'Développer ma créativité', 3),
  ('plus_performant', 'optimisation', 'Être plus performant', 4),
  ('plus_serein', 'optimisation', 'Être plus serein', 5),
  ('plus_efficace', 'optimisation', 'Être plus efficace', 6),
  ('optimiser_cognitif', 'optimisation', 'Optimiser mes performances cognitives', 7),
  ('qualite_vie', 'optimisation', 'Améliorer ma qualité de vie', 8),
  ('tdah', 'sante', 'TDAH', 1),
  ('tsa', 'sante', 'Trouble du spectre de l''autisme (TSA)', 2),
  ('migraine', 'sante', 'Migraine', 3),
  ('cephalees', 'sante', 'Céphalées', 4),
  ('acouphenes', 'sante', 'Acouphènes', 5),
  ('fibromyalgie', 'sante', 'Fibromyalgie', 6),
  ('douleurs_chroniques', 'sante', 'Douleurs chroniques', 7),
  ('syndrome_fatigue', 'sante', 'Syndrome de fatigue chronique', 8),
  ('begaiement', 'sante', 'Bégaiement', 9),
  ('hyperhidrose', 'sante', 'Hyperhidrose', 10),
  ('psoriasis', 'sante', 'Psoriasis (lorsque le stress est un facteur aggravant)', 11),
  ('maladie_meniere', 'sante', 'Maladie de Ménière', 12),
  ('commotion', 'sante', 'Commotion cérébrale / Traumatisme crânien', 13),
  ('avc', 'sante', 'AVC (en complément de la rééducation)', 14),
  ('parkinson', 'sante', 'Maladie de Parkinson (en accompagnement)', 15),
  ('epilepsie', 'sante', 'Épilepsie (avec avis du neurologue)', 16);

alter table public.questionnaire_themes enable trigger audit_themes;
alter table public.questionnaire_difficulties enable trigger audit_difficulties;
