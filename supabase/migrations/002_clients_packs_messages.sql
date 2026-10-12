-- =============================================================================
-- NeuroÉquilibre — Évolution 2
-- Code client, source d'acquisition, statut actif/inactif, packs & règlements,
-- modèles de messages, états (anniversaires, statuts, packs vendus).
-- À exécuter après supabase/schema.sql (SQL Editor → coller → Run).
-- =============================================================================

-- =============================================================================
-- PARAMÈTRES
-- =============================================================================

alter table public.centre_settings
  add column if not exists currency_label text not null default 'DH',
  add column if not exists phone_country_code text not null default '212'
    check (phone_country_code ~ '^[0-9]{1,4}$');

-- =============================================================================
-- CODE CLIENT (NE-0001, NE-0002…) — attribué par la base, non modifiable
-- =============================================================================

create sequence if not exists public.client_code_seq;

create or replace function public.next_client_code()
returns text language sql volatile security definer set search_path = public as $$
  select 'NE-' || lpad(n::text, greatest(4, length(n::text)), '0')
  from (select nextval('public.client_code_seq') as n) s;
$$;

alter table public.clients add column if not exists code text;

alter table public.clients disable trigger user;
with ordered as (
  select id, row_number() over (order by created_at, id) as rn
  from public.clients
  where code is null
)
update public.clients c
set code = 'NE-' || lpad(o.rn::text, greatest(4, length(o.rn::text)), '0')
from ordered o
where o.id = c.id;
alter table public.clients enable trigger user;

select setval('public.client_code_seq', greatest((select count(*) from public.clients), 1),
              (select count(*) from public.clients) > 0);

alter table public.clients alter column code set not null;
create unique index if not exists clients_code_unique on public.clients (code);

create or replace function public.clients_code_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.code := public.next_client_code();
  else
    new.code := old.code;
  end if;
  return new;
end;
$$;

create trigger clients_code before insert or update on public.clients
  for each row execute function public.clients_code_trg();

-- =============================================================================
-- SOURCE D'ACQUISITION (« Comment le client est venu ? »)
-- =============================================================================

create table public.acquisition_sources (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.acquisition_sources (label, sort_order) values
  ('Fouad', 1),
  ('Majdouline', 2),
  ('Oumnia', 3),
  ('Réseaux sociaux', 4),
  ('Bouche à oreille', 5);

alter table public.clients
  add column if not exists source_id uuid references public.acquisition_sources (id) on delete set null;

create index if not exists clients_source_idx on public.clients (source_id);

-- L'ancien champ KYC équivalent est remplacé par la liste ci-dessus.
update public.kyc_fields set is_active = false
where label = 'Comment avez-vous connu le centre ?';

-- =============================================================================
-- STATUT CLIENT
-- Automatique (pack en cours ou séance prévue) sauf statut forcé.
-- mode 'auto' = retour au calcul automatique à partir de effective_date.
-- =============================================================================

create table public.client_status_changes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  mode text not null check (mode in ('active', 'inactive', 'auto')),
  effective_date date not null,
  reason text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index client_status_changes_idx
  on public.client_status_changes (client_id, effective_date desc, created_at desc);

-- =============================================================================
-- PACKS (catalogue) ET PACKS VENDUS
-- =============================================================================

create table public.packs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  reference_price numeric(12, 2) not null check (reference_price >= 0),
  session_count integer not null check (session_count between 1 and 500),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger packs_touch before update on public.packs
  for each row execute function public.touch_updated_at();

-- Les caractéristiques du pack sont copiées à la vente :
-- modifier ou supprimer le catalogue ne change jamais une vente passée.
create table public.client_packs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  pack_id uuid references public.packs (id) on delete set null,
  pack_name text not null,
  reference_price numeric(12, 2) not null check (reference_price >= 0),
  session_count integer not null check (session_count between 1 and 500),
  offered_sessions integer not null default 0 check (offered_sessions between 0 and 500),
  agreed_price numeric(12, 2) not null check (agreed_price >= 0),
  sold_on date not null,
  notes text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_packs_client_idx on public.client_packs (client_id, sold_on);
create index client_packs_sold_idx on public.client_packs (sold_on);

create trigger client_packs_touch before update on public.client_packs
  for each row execute function public.touch_updated_at();

create table public.pack_payments (
  id uuid primary key default gen_random_uuid(),
  client_pack_id uuid not null references public.client_packs (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  paid_on date not null,
  method text not null default 'especes'
    check (method in ('especes', 'carte', 'virement', 'cheque', 'autre')),
  note text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index pack_payments_pack_idx on public.pack_payments (client_pack_id);
create index pack_payments_paid_idx on public.pack_payments (paid_on);

create or replace function public.money_text(p numeric)
returns text language sql stable security definer set search_path = public as $$
  select trim(to_char(p, '999999999990.00')) || ' ' || coalesce((select currency_label from public.centre_settings where id = 1), '');
$$;

-- Le total réglé ne peut pas dépasser le montant convenu ; pas de règlement daté dans le futur.
create or replace function public.pack_payments_check()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_agreed numeric;
  v_paid numeric;
  v_today date;
begin
  select (now() at time zone timezone)::date into v_today from public.centre_settings where id = 1;
  if new.paid_on > v_today then
    raise exception using errcode = 'P0001', hint = 'PAYMENT_ERROR',
      message = 'La date de règlement ne peut pas être dans le futur.';
  end if;

  select agreed_price into v_agreed from public.client_packs where id = new.client_pack_id for update;
  select coalesce(sum(amount), 0) into v_paid
  from public.pack_payments
  where client_pack_id = new.client_pack_id and id <> new.id;

  if v_paid + new.amount > v_agreed then
    raise exception using errcode = 'P0001', hint = 'PAYMENT_ERROR',
      message = format('Le total réglé (%s) dépasserait le montant convenu (%s). Reste à payer : %s.',
                       public.money_text(v_paid + new.amount), public.money_text(v_agreed),
                       public.money_text(v_agreed - v_paid));
  end if;
  return new;
end;
$$;

create trigger pack_payments_check_trg before insert or update on public.pack_payments
  for each row execute function public.pack_payments_check();

create or replace function public.client_packs_check()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_paid numeric;
begin
  select coalesce(sum(amount), 0) into v_paid from public.pack_payments where client_pack_id = new.id;
  if new.agreed_price < v_paid then
    raise exception using errcode = 'P0001', hint = 'PAYMENT_ERROR',
      message = format('Le montant convenu ne peut pas être inférieur au total déjà réglé (%s).',
                       public.money_text(v_paid));
  end if;
  return new;
end;
$$;

create trigger client_packs_check_trg before update of agreed_price on public.client_packs
  for each row execute function public.client_packs_check();

-- Vente d'un pack (avec avance éventuelle) en une seule opération.
create or replace function public.sell_pack(
  p_client_id uuid,
  p_pack_id uuid,
  p_offered integer,
  p_agreed numeric,
  p_sold_on date,
  p_notes text,
  p_advance numeric,
  p_advance_on date,
  p_method text
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_pack public.packs%rowtype;
  v_id uuid;
begin
  select * into v_pack from public.packs where id = p_pack_id;
  if not found then
    raise exception 'Pack introuvable.';
  end if;

  insert into public.client_packs (client_id, pack_id, pack_name, reference_price, session_count,
    offered_sessions, agreed_price, sold_on, notes)
  values (p_client_id, v_pack.id, v_pack.name, v_pack.reference_price, v_pack.session_count,
    coalesce(p_offered, 0), coalesce(p_agreed, v_pack.reference_price), p_sold_on, nullif(trim(p_notes), ''))
  returning id into v_id;

  if coalesce(p_advance, 0) > 0 then
    insert into public.pack_payments (client_pack_id, amount, paid_on, method)
    values (v_id, p_advance, coalesce(p_advance_on, p_sold_on), coalesce(p_method, 'especes'));
  end if;
  return v_id;
end;
$$;

-- Consommation des packs : les séances (non annulées) à partir de la date du
-- premier pack sont attribuées aux packs dans l'ordre chronologique.
create or replace function public.client_pack_usage(p_until timestamptz default now())
returns table (client_pack_id uuid, total_sessions integer, booked_sessions integer, used_sessions integer)
language sql stable security invoker set search_path = public as $$
  with tz as (
    select timezone from public.centre_settings where id = 1
  ),
  p as (
    select cp.id, cp.client_id,
      cp.session_count + cp.offered_sessions as total,
      sum(cp.session_count + cp.offered_sessions)
        over (partition by cp.client_id order by cp.sold_on, cp.created_at, cp.id) as cum_end,
      min(cp.sold_on) over (partition by cp.client_id) as first_sold
    from public.client_packs cp
  ),
  firsts as (
    select distinct client_id, first_sold from p
  ),
  s as (
    select se.client_id, se.starts_at,
      row_number() over (partition by se.client_id order by se.starts_at, se.id) as rn
    from public.sessions se
    join firsts f on f.client_id = se.client_id
    cross join tz
    where se.status <> 'cancelled'
      and se.starts_at >= (f.first_sold::timestamp at time zone tz.timezone)
  )
  select p.id,
    p.total::integer,
    count(s.rn)::integer,
    count(s.rn) filter (where s.starts_at < p_until)::integer
  from p
  left join s on s.client_id = p.client_id and s.rn > p.cum_end - p.total and s.rn <= p.cum_end
  group by p.id, p.total;
$$;

create view public.client_pack_summary with (security_invoker = true) as
select cp.*,
  u.total_sessions,
  u.booked_sessions,
  u.used_sessions,
  coalesce(pay.paid, 0)::numeric(12, 2) as paid_amount,
  (cp.agreed_price - coalesce(pay.paid, 0))::numeric(12, 2) as remaining_amount,
  pay.last_paid_on
from public.client_packs cp
left join public.client_pack_usage(now()) u on u.client_pack_id = cp.id
left join (
  select client_pack_id, sum(amount) as paid, max(paid_on) as last_paid_on
  from public.pack_payments
  group by client_pack_id
) pay on pay.client_pack_id = cp.id;

-- Statut de chaque client à une date donnée.
create or replace function public.client_statuses(p_date date)
returns table (client_id uuid, status text, is_override boolean, reason text)
language sql stable security invoker set search_path = public as $$
  with tz as (
    select timezone from public.centre_settings where id = 1
  ),
  b as (
    select (p_date::timestamp at time zone tz.timezone) as d_start,
           ((p_date + 1)::timestamp at time zone tz.timezone) as d_end
    from tz
  ),
  usage as (
    select * from public.client_pack_usage((select d_end from b))
  ),
  ovr as (
    select distinct on (ch.client_id) ch.client_id, ch.mode, ch.reason
    from public.client_status_changes ch
    where ch.effective_date <= p_date
    order by ch.client_id, ch.effective_date desc, ch.created_at desc
  ),
  a as (
    select c.id,
      exists (
        select 1 from public.client_packs cp
        join usage u on u.client_pack_id = cp.id
        where cp.client_id = c.id and cp.sold_on <= p_date and u.used_sessions < u.total_sessions
      ) as has_pack,
      exists (
        select 1 from public.sessions se
        where se.client_id = c.id and se.status <> 'cancelled' and se.starts_at >= b.d_start
      ) as has_upcoming
    from public.clients c
    cross join b
    where c.created_at < b.d_end
       or exists (select 1 from public.sessions se where se.client_id = c.id and se.starts_at < b.d_end)
  )
  select a.id,
    case when o.mode in ('active', 'inactive') then o.mode
         when a.has_pack or a.has_upcoming then 'active'
         else 'inactive' end,
    coalesce(o.mode in ('active', 'inactive'), false),
    case when o.mode in ('active', 'inactive') then coalesce(nullif(o.reason, ''), 'Statut défini manuellement')
         when a.has_pack then 'Pack en cours'
         when a.has_upcoming then 'Séance prévue'
         else 'Aucun pack en cours ni séance prévue' end
  from a
  left join ovr o on o.client_id = a.id;
$$;

-- Un client forcé « inactif » redevient automatique dès qu'il reprend (séance ou pack).
create or replace function public.client_status_auto_resume()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_today date;
  v_mode text;
begin
  if coalesce(current_setting('app.skip_session_checks', true), '') = 'on' then
    return null;
  end if;
  if tg_table_name = 'sessions' then
    if (to_jsonb(new) ->> 'status') = 'cancelled' then
      return null;
    end if;
  end if;

  select (now() at time zone timezone)::date into v_today from public.centre_settings where id = 1;
  select mode into v_mode
  from public.client_status_changes
  where client_id = new.client_id and effective_date <= v_today
  order by effective_date desc, created_at desc
  limit 1;

  if v_mode = 'inactive' then
    insert into public.client_status_changes (client_id, mode, effective_date, reason)
    values (new.client_id, 'auto', v_today,
            case when tg_table_name = 'sessions' then 'Reprise : nouvelle séance réservée'
                 else 'Reprise : nouveau pack attribué' end);
  end if;
  return null;
end;
$$;

create trigger sessions_status_resume after insert on public.sessions
  for each row execute function public.client_status_auto_resume();
create trigger client_packs_status_resume after insert on public.client_packs
  for each row execute function public.client_status_auto_resume();

-- =============================================================================
-- MESSAGES
-- kind : confirmation, reminder, birthday (individuels) ou broadcast (groupés).
-- Variables : {prenom} {nom} {code} {date} {heure} {box} {centre}
-- =============================================================================

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('confirmation', 'reminder', 'birthday', 'broadcast')),
  title text not null,
  body text not null,
  email_subject text,
  email_body text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger message_templates_touch before update on public.message_templates
  for each row execute function public.touch_updated_at();

insert into public.message_templates (kind, title, body, email_subject, sort_order) values
  ('confirmation', 'Confirmation de rendez-vous',
   'Bonjour {prenom}, nous vous confirmons votre séance de neurofeedback le {date} à {heure} au centre {centre}. À très bientôt !',
   'Confirmation de votre séance du {date}', 1),
  ('reminder', 'Rappel de rendez-vous',
   'Bonjour {prenom}, petit rappel : votre séance de neurofeedback a lieu le {date} à {heure}. En cas d''empêchement, merci de nous prévenir. {centre}',
   'Rappel : votre séance du {date}', 2),
  ('birthday', 'Joyeux anniversaire',
   'Joyeux anniversaire {prenom} ! Toute l''équipe de {centre} vous souhaite une excellente année, pleine de sérénité.',
   'Joyeux anniversaire {prenom} !', 3),
  ('broadcast', 'Information du centre',
   'Bonjour {prenom}, le centre {centre} vous informe : …',
   'Information du centre {centre}', 10);

create table public.message_log (
  id bigint generated always as identity primary key,
  client_id uuid references public.clients (id) on delete cascade,
  template_id uuid references public.message_templates (id) on delete set null,
  template_title text not null default '',
  channel text not null check (channel in ('whatsapp', 'email')),
  batch_id uuid,
  sent_by uuid default auth.uid() references auth.users (id) on delete set null,
  sent_at timestamptz not null default now()
);

create index message_log_client_idx on public.message_log (client_id, sent_at desc);
create index message_log_batch_idx on public.message_log (batch_id);

-- =============================================================================
-- JOURNAL DES ACTIONS (libellés des nouvelles tables)
-- =============================================================================

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
    when 'clients' then concat_ws(' ', v_row ->> 'code', '·', v_row ->> 'first_name', v_row ->> 'last_name')
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
    when 'acquisition_sources' then v_row ->> 'label'
    when 'packs' then v_row ->> 'name'
    when 'message_templates' then v_row ->> 'title'
    when 'client_packs' then concat_ws(' · ',
      (select c.first_name || ' ' || c.last_name from public.clients c where c.id = (v_row ->> 'client_id')::uuid),
      v_row ->> 'pack_name',
      public.money_text((v_row ->> 'agreed_price')::numeric))
    when 'pack_payments' then concat_ws(' · ',
      (select c.first_name || ' ' || c.last_name || ' — ' || cp.pack_name
       from public.client_packs cp join public.clients c on c.id = cp.client_id
       where cp.id = (v_row ->> 'client_pack_id')::uuid),
      public.money_text((v_row ->> 'amount')::numeric),
      to_char((v_row ->> 'paid_on')::date, 'DD/MM/YYYY'))
    when 'client_status_changes' then concat_ws(' · ',
      (select c.first_name || ' ' || c.last_name from public.clients c where c.id = (v_row ->> 'client_id')::uuid),
      case v_row ->> 'mode' when 'active' then 'Actif' when 'inactive' then 'Inactif' else 'Automatique' end,
      'à partir du ' || to_char((v_row ->> 'effective_date')::date, 'DD/MM/YYYY'))
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

create trigger audit_sources after insert or update or delete on public.acquisition_sources
  for each row execute function public.audit_trigger();
create trigger audit_packs after insert or update or delete on public.packs
  for each row execute function public.audit_trigger();
create trigger audit_client_packs after insert or update or delete on public.client_packs
  for each row execute function public.audit_trigger();
create trigger audit_pack_payments after insert or update or delete on public.pack_payments
  for each row execute function public.audit_trigger();
create trigger audit_status_changes after insert or delete on public.client_status_changes
  for each row execute function public.audit_trigger();
create trigger audit_message_templates after insert or update or delete on public.message_templates
  for each row execute function public.audit_trigger();

-- =============================================================================
-- SÉCURITÉ (RLS)
-- =============================================================================

alter table public.acquisition_sources enable row level security;
alter table public.client_status_changes enable row level security;
alter table public.packs enable row level security;
alter table public.client_packs enable row level security;
alter table public.pack_payments enable row level security;
alter table public.message_templates enable row level security;
alter table public.message_log enable row level security;

create policy sources_select on public.acquisition_sources for select to authenticated using (public.is_staff());
create policy sources_write on public.acquisition_sources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy packs_select on public.packs for select to authenticated using (public.is_staff());
create policy packs_write on public.packs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy client_packs_select on public.client_packs for select to authenticated using (public.is_staff());
create policy client_packs_insert on public.client_packs for insert to authenticated with check (public.is_staff());
create policy client_packs_update on public.client_packs for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
-- Le gestionnaire ne peut supprimer qu'un pack sans règlement.
create policy client_packs_delete on public.client_packs for delete to authenticated
  using (public.is_admin() or (public.is_staff()
    and not exists (select 1 from public.pack_payments pp where pp.client_pack_id = client_packs.id)));

create policy payments_select on public.pack_payments for select to authenticated using (public.is_staff());
create policy payments_insert on public.pack_payments for insert to authenticated with check (public.is_staff());
create policy payments_update on public.pack_payments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy payments_delete on public.pack_payments for delete to authenticated using (public.is_admin());

create policy status_select on public.client_status_changes for select to authenticated using (public.is_staff());
create policy status_insert on public.client_status_changes for insert to authenticated with check (public.is_staff());
create policy status_delete on public.client_status_changes for delete to authenticated using (public.is_admin());

create policy templates_select on public.message_templates for select to authenticated using (public.is_staff());
create policy templates_write on public.message_templates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy message_log_select on public.message_log for select to authenticated using (public.is_staff());
create policy message_log_insert on public.message_log for insert to authenticated with check (public.is_staff());

revoke execute on function public.next_client_code() from public, anon, authenticated;
revoke execute on function public.client_pack_usage(timestamptz) from public, anon;
revoke execute on function public.client_statuses(date) from public, anon;
revoke execute on function public.sell_pack(uuid, uuid, integer, numeric, date, text, numeric, date, text) from public, anon;
revoke all on public.client_pack_summary from anon;
