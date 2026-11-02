-- =============================================================================
-- NeuroÉquilibre — Migration 004
--   · Messages : variable {genre}, versions arabe et anglaise des modèles
--   · Reçus numérotés pour chaque règlement (R-AAAA-0001)
--   · Factures sur demande (F-AAAA-0001), immuables, annulables par l'administrateur
--   · Mentions légales du centre (ICE, IF, RC, patente, TVA…)
-- À exécuter une seule fois dans Supabase → SQL Editor, après la migration 003.
-- =============================================================================

-- =============================================================================
-- PARAMÈTRES : MENTIONS LÉGALES ET TVA
-- =============================================================================

alter table public.centre_settings
  add column if not exists legal_name text not null default '',
  add column if not exists legal_address text not null default '',
  add column if not exists legal_phone text not null default '',
  add column if not exists legal_email text not null default '',
  add column if not exists legal_ice text not null default '',
  add column if not exists legal_if text not null default '',
  add column if not exists legal_rc text not null default '',
  add column if not exists legal_patente text not null default '',
  add column if not exists legal_cnss text not null default '',
  add column if not exists invoice_tva_rate numeric(5, 2) not null default 0
    check (invoice_tva_rate >= 0 and invoice_tva_rate <= 100),
  add column if not exists invoice_tva_mention text not null default 'TVA non applicable',
  add column if not exists invoice_footer text not null default '';

-- =============================================================================
-- MESSAGES : LANGUES ET CIVILITÉ
-- Variables : {genre} {prenom} {nom} {code} {date} {heure} {box} {centre}
-- =============================================================================

alter table public.message_templates
  add column if not exists body_ar text,
  add column if not exists body_en text,
  add column if not exists email_subject_ar text,
  add column if not exists email_subject_en text,
  add column if not exists email_body_ar text,
  add column if not exists email_body_en text;

alter table public.message_log
  add column if not exists language text not null default 'fr' check (language in ('fr', 'ar', 'en'));

-- Les modèles d'origine passent à la civilité ; un texte déjà personnalisé n'est pas modifié.
update public.message_templates set body =
  'Bonjour {genre} {nom}, nous vous confirmons votre séance de neurofeedback le {date} à {heure} au centre {centre}. À très bientôt !'
where kind = 'confirmation'
  and body = 'Bonjour {prenom}, nous vous confirmons votre séance de neurofeedback le {date} à {heure} au centre {centre}. À très bientôt !';

update public.message_templates set body =
  'Bonjour {genre} {nom}, petit rappel : votre séance de neurofeedback a lieu le {date} à {heure}. En cas d''empêchement, merci de nous prévenir. {centre}'
where kind = 'reminder'
  and body = 'Bonjour {prenom}, petit rappel : votre séance de neurofeedback a lieu le {date} à {heure}. En cas d''empêchement, merci de nous prévenir. {centre}';

update public.message_templates set body =
  'Bonjour {genre} {nom}, joyeux anniversaire ! Toute l''équipe de {centre} vous souhaite une excellente année, pleine de sérénité.'
where kind = 'birthday'
  and body = 'Joyeux anniversaire {prenom} ! Toute l''équipe de {centre} vous souhaite une excellente année, pleine de sérénité.';

update public.message_templates set email_subject = 'Joyeux anniversaire !'
where kind = 'birthday' and email_subject = 'Joyeux anniversaire {prenom} !';

update public.message_templates set body =
  'Bonjour {genre} {nom}, le centre {centre} vous informe : …'
where kind = 'broadcast' and body = 'Bonjour {prenom}, le centre {centre} vous informe : …';

-- Traductions des modèles d'origine (uniquement si elles sont encore vides).
update public.message_templates set
  body_ar = coalesce(nullif(body_ar, ''),
    'مرحباً {genre} {nom}، نؤكد لكم موعد جلسة النوروفيدباك يوم {date} على الساعة {heure} في مركز {centre}. إلى اللقاء قريباً!'),
  email_subject_ar = coalesce(nullif(email_subject_ar, ''), 'تأكيد جلستكم يوم {date}'),
  body_en = coalesce(nullif(body_en, ''),
    'Hello {genre} {nom}, we are pleased to confirm your neurofeedback session on {date} at {heure} at {centre}. See you soon!'),
  email_subject_en = coalesce(nullif(email_subject_en, ''), 'Confirmation of your session on {date}')
where kind = 'confirmation' and title = 'Confirmation de rendez-vous';

update public.message_templates set
  body_ar = coalesce(nullif(body_ar, ''),
    'مرحباً {genre} {nom}، نذكّركم بأن جلسة النوروفيدباك الخاصة بكم ستكون يوم {date} على الساعة {heure}. في حال تعذّر حضوركم، يُرجى إخبارنا. {centre}'),
  email_subject_ar = coalesce(nullif(email_subject_ar, ''), 'تذكير: جلستكم يوم {date}'),
  body_en = coalesce(nullif(body_en, ''),
    'Hello {genre} {nom}, a quick reminder: your neurofeedback session is on {date} at {heure}. If you cannot make it, please let us know. {centre}'),
  email_subject_en = coalesce(nullif(email_subject_en, ''), 'Reminder: your session on {date}')
where kind = 'reminder' and title = 'Rappel de rendez-vous';

update public.message_templates set
  body_ar = coalesce(nullif(body_ar, ''),
    'مرحباً {genre} {nom}، عيد ميلاد سعيد! يتمنى لكم فريق {centre} سنة رائعة مليئة بالسكينة والطمأنينة.'),
  email_subject_ar = coalesce(nullif(email_subject_ar, ''), 'عيد ميلاد سعيد!'),
  body_en = coalesce(nullif(body_en, ''),
    'Hello {genre} {nom}, happy birthday! The whole {centre} team wishes you a wonderful year, full of serenity.'),
  email_subject_en = coalesce(nullif(email_subject_en, ''), 'Happy birthday!')
where kind = 'birthday' and title = 'Joyeux anniversaire';

update public.message_templates set
  body_ar = coalesce(nullif(body_ar, ''), 'مرحباً {genre} {nom}، يُعلمكم مركز {centre}: …'),
  email_subject_ar = coalesce(nullif(email_subject_ar, ''), 'معلومة من مركز {centre}'),
  body_en = coalesce(nullif(body_en, ''), 'Hello {genre} {nom}, {centre} would like to inform you: …'),
  email_subject_en = coalesce(nullif(email_subject_en, ''), 'Information from {centre}')
where kind = 'broadcast' and title = 'Information du centre';

-- =============================================================================
-- NUMÉROTATION DES DOCUMENTS (reçus, factures)
-- Un compteur par type et par année, verrouillé ligne par ligne : la numérotation
-- reste continue même si deux règlements sont saisis en même temps, et une
-- opération annulée (erreur, rollback) ne consomme pas de numéro.
-- =============================================================================

create table public.document_counters (
  kind text not null check (kind in ('receipt', 'invoice')),
  year integer not null,
  last_value integer not null,
  primary key (kind, year)
);

alter table public.document_counters enable row level security;

create or replace function public.next_document_number(p_kind text, p_date date)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_year integer := extract(year from p_date)::integer;
  v_n integer;
begin
  insert into public.document_counters (kind, year, last_value) values (p_kind, v_year, 1)
  on conflict (kind, year) do update set last_value = public.document_counters.last_value + 1
  returning last_value into v_n;
  return case p_kind when 'receipt' then 'R' else 'F' end || '-' || v_year || '-' || lpad(v_n::text, 4, '0');
end;
$$;

-- =============================================================================
-- REÇUS : un numéro par règlement, attribué à l'enregistrement, non modifiable
-- =============================================================================

alter table public.pack_payments add column if not exists receipt_number text;

alter table public.pack_payments disable trigger user;
do $$
declare
  r record;
  v_tz text;
begin
  select timezone into v_tz from public.centre_settings where id = 1;
  for r in
    select id, created_at from public.pack_payments
    where receipt_number is null
    order by created_at, id
  loop
    update public.pack_payments
    set receipt_number = public.next_document_number('receipt', (r.created_at at time zone coalesce(v_tz, 'Africa/Casablanca'))::date)
    where id = r.id;
  end loop;
end;
$$;
alter table public.pack_payments enable trigger user;

alter table public.pack_payments alter column receipt_number set not null;
create unique index if not exists pack_payments_receipt_unique on public.pack_payments (receipt_number);

create or replace function public.pack_payments_receipt()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_today date;
begin
  if tg_op = 'INSERT' then
    select (now() at time zone timezone)::date into v_today from public.centre_settings where id = 1;
    new.receipt_number := public.next_document_number('receipt', coalesce(v_today, current_date));
  else
    new.receipt_number := old.receipt_number;
  end if;
  return new;
end;
$$;

-- Déclenché après pack_payments_check_trg (ordre alphabétique) : un règlement refusé
-- ne consomme pas de numéro.
create trigger pack_payments_receipt_trg before insert or update on public.pack_payments
  for each row execute function public.pack_payments_receipt();

-- =============================================================================
-- FACTURES
-- Tout est copié à l'émission (vendeur, client facturé, lignes, TVA, règlements) :
-- une facture émise ne change plus, même si la fiche ou les paramètres changent.
-- =============================================================================

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  client_pack_id uuid references public.client_packs (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  client_code text not null default '',
  issued_on date not null,
  seller jsonb not null,
  billed_name text not null,
  billed_company text,
  billed_ice text,
  billed_address text,
  lines jsonb not null,
  total_ht numeric(12, 2) not null,
  tva_rate numeric(5, 2) not null,
  tva_amount numeric(12, 2) not null,
  total_ttc numeric(12, 2) not null,
  paid_amount numeric(12, 2) not null,
  payments jsonb not null default '[]'::jsonb,
  currency text not null default 'DH',
  notes text,
  status text not null default 'issued' check (status in ('issued', 'cancelled')),
  cancelled_at timestamptz,
  cancelled_reason text,
  cancelled_by uuid references auth.users (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index invoices_client_pack_idx on public.invoices (client_pack_id);
create index invoices_client_idx on public.invoices (client_id);
create index invoices_issued_idx on public.invoices (issued_on);
create unique index invoices_one_active_per_pack on public.invoices (client_pack_id)
  where status = 'issued' and client_pack_id is not null;

create or replace function public.invoices_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.number := public.next_document_number('invoice', new.issued_on);
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', hint = 'INVOICE_ERROR',
      message = 'Une facture émise ne peut pas être supprimée : annulez-la.';
  end if;
  -- Les liens vers le pack / le client peuvent disparaître (suppression de la fiche).
  if (to_jsonb(new) - array['status', 'cancelled_at', 'cancelled_reason', 'cancelled_by', 'client_pack_id', 'client_id'])
     is distinct from
     (to_jsonb(old) - array['status', 'cancelled_at', 'cancelled_reason', 'cancelled_by', 'client_pack_id', 'client_id']) then
    raise exception using errcode = 'P0001', hint = 'INVOICE_ERROR',
      message = 'Une facture émise ne peut pas être modifiée. Annulez-la puis établissez-en une nouvelle.';
  end if;
  if old.status = 'cancelled' and (new.status <> 'cancelled'
      or new.cancelled_reason is distinct from old.cancelled_reason
      or new.cancelled_at is distinct from old.cancelled_at) then
    raise exception using errcode = 'P0001', hint = 'INVOICE_ERROR',
      message = 'Cette facture est déjà annulée.';
  end if;
  return new;
end;
$$;

create trigger invoices_guard_trg before insert or update or delete on public.invoices
  for each row execute function public.invoices_guard();

-- Un pack facturé ne peut pas être supprimé tant que sa facture n'est pas annulée.
create or replace function public.client_packs_invoice_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_number text;
begin
  select number into v_number from public.invoices where client_pack_id = old.id and status = 'issued' limit 1;
  if v_number is not null then
    raise exception using errcode = 'P0001', hint = 'INVOICE_ERROR',
      message = format('La facture %s a été établie pour ce pack : l''administrateur doit d''abord l''annuler.', v_number);
  end if;
  return old;
end;
$$;

create trigger client_packs_invoice_guard_trg before delete on public.client_packs
  for each row execute function public.client_packs_invoice_guard();

-- Émission d'une facture pour un pack vendu (gestionnaire ou administrateur).
create or replace function public.issue_invoice(
  p_client_pack_id uuid,
  p_issued_on date,
  p_billed_name text,
  p_billed_company text,
  p_billed_ice text,
  p_billed_address text,
  p_notes text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_cp public.client_packs%rowtype;
  v_client public.clients%rowtype;
  v_s public.centre_settings%rowtype;
  v_today date;
  v_date date;
  v_last date;
  v_existing text;
  v_rate numeric;
  v_ht numeric;
  v_paid numeric;
  v_payments jsonb;
  v_label text;
  v_detail text;
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception using errcode = '42501', message = 'Accès refusé.';
  end if;

  select * into v_cp from public.client_packs where id = p_client_pack_id for update;
  if not found then
    raise exception using errcode = 'P0001', hint = 'INVOICE_ERROR', message = 'Pack introuvable.';
  end if;
  select * into v_client from public.clients where id = v_cp.client_id;
  select * into v_s from public.centre_settings where id = 1;

  v_today := (now() at time zone v_s.timezone)::date;
  v_date := coalesce(p_issued_on, v_today);
  if v_date > v_today then
    raise exception using errcode = 'P0001', hint = 'INVOICE_ERROR',
      message = 'La date de la facture ne peut pas être dans le futur.';
  end if;

  -- Les factures sont numérotées dans l'ordre chronologique.
  perform pg_advisory_xact_lock(hashtext('public.invoices'));
  select max(issued_on) into v_last from public.invoices;
  if v_last is not null and v_date < v_last then
    raise exception using errcode = 'P0001', hint = 'INVOICE_ERROR',
      message = format('La date ne peut pas être antérieure à celle de la dernière facture émise (%s).', to_char(v_last, 'DD/MM/YYYY'));
  end if;

  select number into v_existing from public.invoices where client_pack_id = v_cp.id and status = 'issued';
  if v_existing is not null then
    raise exception using errcode = 'P0001', hint = 'INVOICE_ERROR',
      message = format('La facture %s a déjà été établie pour ce pack. Annulez-la pour en établir une nouvelle.', v_existing);
  end if;

  if coalesce(trim(p_billed_name), '') = '' then
    raise exception using errcode = 'P0001', hint = 'INVOICE_ERROR', message = 'Indiquez le nom du client facturé.';
  end if;

  v_rate := coalesce(v_s.invoice_tva_rate, 0);
  v_ht := round(v_cp.agreed_price / (1 + v_rate / 100), 2);

  v_label := v_cp.pack_name;
  v_detail := v_cp.session_count || ' séance' || case when v_cp.session_count > 1 then 's' else '' end || ' de neurofeedback'
    || case when v_cp.offered_sessions > 0
         then ' + ' || v_cp.offered_sessions || ' offerte' || case when v_cp.offered_sessions > 1 then 's' else '' end
         else '' end;

  select coalesce(sum(amount), 0),
         coalesce(jsonb_agg(jsonb_build_object(
           'receipt_number', receipt_number, 'paid_on', paid_on, 'amount', amount, 'method', method)
           order by paid_on, created_at), '[]'::jsonb)
  into v_paid, v_payments
  from public.pack_payments
  where client_pack_id = v_cp.id and paid_on <= v_date;

  insert into public.invoices (
    number, client_pack_id, client_id, client_code, issued_on, seller,
    billed_name, billed_company, billed_ice, billed_address,
    lines, total_ht, tva_rate, tva_amount, total_ttc, paid_amount, payments, currency, notes
  ) values (
    '', v_cp.id, v_cp.client_id, coalesce(v_client.code, ''), v_date,
    jsonb_build_object(
      'name', coalesce(nullif(trim(v_s.legal_name), ''), v_s.centre_name),
      'centre_name', v_s.centre_name,
      'address', v_s.legal_address, 'phone', v_s.legal_phone, 'email', v_s.legal_email,
      'ice', v_s.legal_ice, 'if', v_s.legal_if, 'rc', v_s.legal_rc,
      'patente', v_s.legal_patente, 'cnss', v_s.legal_cnss,
      'tva_mention', v_s.invoice_tva_mention, 'footer', v_s.invoice_footer),
    trim(p_billed_name), nullif(trim(p_billed_company), ''), nullif(trim(p_billed_ice), ''),
    nullif(trim(p_billed_address), ''),
    jsonb_build_array(jsonb_build_object(
      'label', v_label, 'detail', v_detail, 'quantity', 1, 'amount', v_cp.agreed_price,
      'reference_price', v_cp.reference_price,
      'discount', greatest(v_cp.reference_price - v_cp.agreed_price, 0))),
    v_ht, v_rate, v_cp.agreed_price - v_ht, v_cp.agreed_price, v_paid, v_payments,
    coalesce(v_s.currency_label, ''), nullif(trim(p_notes), '')
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Annulation (administrateur uniquement) : la facture reste dans l'historique.
create or replace function public.cancel_invoice(p_invoice_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Seul l''administrateur peut annuler une facture.';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception using errcode = 'P0001', hint = 'INVOICE_ERROR', message = 'Indiquez le motif de l''annulation.';
  end if;
  update public.invoices
  set status = 'cancelled', cancelled_at = now(), cancelled_reason = trim(p_reason), cancelled_by = auth.uid()
  where id = p_invoice_id and status = 'issued';
  if not found then
    raise exception using errcode = 'P0001', hint = 'INVOICE_ERROR', message = 'Facture introuvable ou déjà annulée.';
  end if;
end;
$$;

-- =============================================================================
-- JOURNAL DES ACTIONS
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
  if tg_table_name = 'invoices' and tg_op = 'UPDATE' and v_row ->> 'status' = 'cancelled'
     and v_old ->> 'status' <> 'cancelled' then
    v_action := 'cancel';
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
      v_row ->> 'receipt_number',
      (select c.first_name || ' ' || c.last_name || ' — ' || cp.pack_name
       from public.client_packs cp join public.clients c on c.id = cp.client_id
       where cp.id = (v_row ->> 'client_pack_id')::uuid),
      public.money_text((v_row ->> 'amount')::numeric),
      to_char((v_row ->> 'paid_on')::date, 'DD/MM/YYYY'))
    when 'client_status_changes' then concat_ws(' · ',
      (select c.first_name || ' ' || c.last_name from public.clients c where c.id = (v_row ->> 'client_id')::uuid),
      case v_row ->> 'mode' when 'active' then 'Actif' when 'inactive' then 'Inactif' else 'Automatique' end,
      'à partir du ' || to_char((v_row ->> 'effective_date')::date, 'DD/MM/YYYY'))
    when 'invoices' then concat_ws(' · ',
      v_row ->> 'number',
      v_row ->> 'billed_name',
      public.money_text((v_row ->> 'total_ttc')::numeric),
      case when tg_op = 'UPDATE' and v_action = 'cancel' then 'Motif : ' || (v_row ->> 'cancelled_reason') end)
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

create trigger audit_invoices after insert or update on public.invoices
  for each row execute function public.audit_trigger();

-- =============================================================================
-- SÉCURITÉ (RLS)
-- Les factures ne s'écrivent que par issue_invoice / cancel_invoice.
-- =============================================================================

alter table public.invoices enable row level security;

create policy invoices_select on public.invoices for select to authenticated using (public.is_staff());

revoke all on public.document_counters from public, anon, authenticated;
revoke insert, update, delete on public.invoices from anon, authenticated;
revoke execute on function public.next_document_number(text, date) from public, anon, authenticated;
revoke execute on function public.issue_invoice(uuid, date, text, text, text, text, text) from public, anon;
revoke execute on function public.cancel_invoice(uuid, text) from public, anon;
grant execute on function public.issue_invoice(uuid, date, text, text, text, text, text) to authenticated;
grant execute on function public.cancel_invoice(uuid, text) to authenticated;

notify pgrst, 'reload schema';
