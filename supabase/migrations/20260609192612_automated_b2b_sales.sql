create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.calculate_b2b_score(
  p_business_type text,
  p_city text,
  p_state text,
  p_premium_positioning boolean,
  p_retails_products boolean,
  p_social_active boolean,
  p_has_email boolean,
  p_has_phone boolean,
  p_location_count integer
)
returns integer
language sql
immutable
set search_path = pg_catalog
as $$
  select least(
    100,
    greatest(
      0,
      (case when lower(coalesce(p_business_type, '')) in ('salon', 'spa', 'salon_spa', 'aesthetic_studio') then 20 else 5 end) +
      (case when lower(coalesce(p_city, '')) in ('bangalore', 'bengaluru') then 20
            when lower(coalesce(p_state, '')) = 'karnataka' then 10
            else 2 end) +
      (case when coalesce(p_premium_positioning, false) then 15 else 0 end) +
      (case when coalesce(p_retails_products, false) then 15 else 0 end) +
      (case when coalesce(p_social_active, false) then 10 else 0 end) +
      (case when coalesce(p_has_email, false) then 8 else 0 end) +
      (case when coalesce(p_has_phone, false) then 7 else 0 end) +
      (case when coalesce(p_location_count, 1) >= 3 then 5
            when coalesce(p_location_count, 1) >= 2 then 3
            else 0 end)
    )
  )::integer;
$$;

create table if not exists public.b2b_accounts (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  business_type text not null default 'salon_spa'
    check (business_type in ('salon', 'spa', 'salon_spa', 'aesthetic_studio', 'wellness', 'other')),
  source text not null default 'trade_application',
  source_reference text not null default '',
  website_url text not null default '',
  instagram_handle text not null default '',
  address text not null default '',
  locality text not null default '',
  city text not null default 'Bangalore',
  state text not null default 'Karnataka',
  pin_code text not null default '',
  premium_positioning boolean not null default false,
  retails_products boolean not null default false,
  social_active boolean not null default false,
  location_count integer not null default 1 check (location_count > 0),
  score integer not null default 0 check (score between 0 and 100),
  stage text not null default 'new'
    check (stage in (
      'new', 'researched', 'qualified', 'approved_for_outreach', 'contacted',
      'replied', 'discovery_booked', 'sample_paid', 'sample_sent',
      'proposal_sent', 'won', 'lost', 'nurture', 'suppressed'
    )),
  notes text not null default '',
  assigned_to_email text not null default '',
  last_contacted_at timestamptz null,
  last_replied_at timestamptz null,
  next_action_at timestamptz null,
  opt_out_at timestamptz null,
  won_at timestamptz null,
  lost_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists b2b_accounts_stage_score_idx
  on public.b2b_accounts(stage, score desc, created_at desc);
create index if not exists b2b_accounts_next_action_idx
  on public.b2b_accounts(next_action_at)
  where next_action_at is not null;
create unique index if not exists b2b_accounts_name_city_uidx
  on public.b2b_accounts(lower(trim(business_name)), lower(trim(city)));

create table if not exists public.b2b_contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.b2b_accounts(id) on delete cascade,
  full_name text not null default '',
  job_title text not null default '',
  email text null,
  phone text null,
  whatsapp_phone text null,
  is_primary boolean not null default true,
  is_public_business_contact boolean not null default false,
  email_consent boolean not null default false,
  whatsapp_consent boolean not null default false,
  consent_source text not null default '',
  consent_recorded_at timestamptz null,
  opted_out_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is null or position('@' in email) > 1)
);

create index if not exists b2b_contacts_account_idx on public.b2b_contacts(account_id);
create unique index if not exists b2b_contacts_email_uidx
  on public.b2b_contacts(lower(trim(email)))
  where email is not null and trim(email) <> '';
create unique index if not exists b2b_contacts_phone_uidx
  on public.b2b_contacts(regexp_replace(coalesce(phone, whatsapp_phone, ''), '\D', '', 'g'))
  where coalesce(trim(phone), trim(whatsapp_phone), '') <> '';

create table if not exists public.b2b_opportunities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.b2b_accounts(id) on delete cascade,
  contact_id uuid null references public.b2b_contacts(id) on delete set null,
  kind text not null default 'opening_order'
    check (kind in ('sample_kit', 'opening_order', 'reorder')),
  stage text not null default 'new'
    check (stage in (
      'new', 'qualified', 'discovery_booked', 'sample_paid', 'sample_sent',
      'proposal_sent', 'payment_pending', 'won', 'lost', 'nurture'
    )),
  estimated_value_inr numeric(12,2) not null default 0 check (estimated_value_inr >= 0),
  probability_percent integer not null default 10 check (probability_percent between 0 and 100),
  expected_close_date date null,
  next_step text not null default '',
  lost_reason text not null default '',
  won_order_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists b2b_opportunities_account_idx
  on public.b2b_opportunities(account_id, created_at desc);
create index if not exists b2b_opportunities_stage_idx
  on public.b2b_opportunities(stage, expected_close_date);

create table if not exists public.b2b_activities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.b2b_accounts(id) on delete cascade,
  contact_id uuid null references public.b2b_contacts(id) on delete set null,
  opportunity_id uuid null references public.b2b_opportunities(id) on delete set null,
  activity_type text not null
    check (activity_type in (
      'note', 'stage_change', 'task', 'email', 'whatsapp', 'call', 'meeting',
      'sample', 'quote', 'payment', 'fulfillment', 'reorder_reminder'
    )),
  title text not null,
  details text not null default '',
  status text not null default 'completed'
    check (status in ('open', 'completed', 'cancelled')),
  due_at timestamptz null,
  completed_at timestamptz null,
  created_by_email text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists b2b_activities_account_idx
  on public.b2b_activities(account_id, created_at desc);
create index if not exists b2b_activities_open_tasks_idx
  on public.b2b_activities(status, due_at)
  where status = 'open';

create table if not exists public.b2b_outreach (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.b2b_accounts(id) on delete cascade,
  contact_id uuid null references public.b2b_contacts(id) on delete set null,
  channel text not null check (channel in ('email', 'whatsapp')),
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  sequence_step integer not null default 0 check (sequence_step between 0 and 3),
  subject text not null default '',
  body text not null,
  status text not null default 'draft'
    check (status in (
      'draft', 'approved', 'sent', 'opened', 'replied', 'bounced',
      'failed', 'cancelled', 'suppressed'
    )),
  scheduled_for timestamptz null,
  approved_at timestamptz null,
  approved_by_email text not null default '',
  sent_at timestamptz null,
  sent_by_email text not null default '',
  provider_message_id text not null default '',
  response_classification text not null default '',
  error_message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, channel, sequence_step, direction)
);

create index if not exists b2b_outreach_queue_idx
  on public.b2b_outreach(status, scheduled_for);
create index if not exists b2b_outreach_account_idx
  on public.b2b_outreach(account_id, created_at desc);

create table if not exists public.b2b_trade_terms (
  id uuid primary key default gen_random_uuid(),
  product_id text not null unique references public.products(id) on delete cascade,
  retail_price_inr numeric(10,2) not null default 0 check (retail_price_inr >= 0),
  unit_cost_inr numeric(10,2) not null default 0 check (unit_cost_inr >= 0),
  wholesale_price_inr numeric(10,2) null check (wholesale_price_inr is null or wholesale_price_inr >= 0),
  partner_margin_percent numeric(6,3) null,
  brand_margin_percent numeric(6,3) null,
  is_eligible boolean not null default false,
  sample_selected boolean not null default false,
  min_units_per_sku integer not null default 2 check (min_units_per_sku > 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.calculate_b2b_trade_terms()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_wholesale numeric(10,2);
begin
  if new.retail_price_inr <= 0 or new.unit_cost_inr <= 0 then
    new.wholesale_price_inr = null;
    new.partner_margin_percent = null;
    new.brand_margin_percent = null;
    new.is_eligible = false;
    return new;
  end if;

  v_wholesale := round(greatest(new.retail_price_inr * 0.65, new.unit_cost_inr / 0.55), 2);
  new.wholesale_price_inr = v_wholesale;
  new.partner_margin_percent = round((new.retail_price_inr - v_wholesale) / new.retail_price_inr, 4);
  new.brand_margin_percent = round((v_wholesale - new.unit_cost_inr) / v_wholesale, 4);
  new.is_eligible =
    new.partner_margin_percent >= 0.30
    and new.brand_margin_percent >= 0.45;
  return new;
end;
$$;

drop trigger if exists trg_b2b_trade_terms_calculate on public.b2b_trade_terms;
create trigger trg_b2b_trade_terms_calculate
before insert or update of retail_price_inr, unit_cost_inr
on public.b2b_trade_terms
for each row execute function private.calculate_b2b_trade_terms();

create table if not exists public.b2b_quotes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.b2b_accounts(id) on delete restrict,
  contact_id uuid null references public.b2b_contacts(id) on delete set null,
  opportunity_id uuid null references public.b2b_opportunities(id) on delete set null,
  quote_number text not null unique,
  quote_type text not null check (quote_type in ('sample_kit', 'opening_order', 'reorder')),
  token_hash text not null unique,
  token_hint text not null default '',
  status text not null default 'draft'
    check (status in (
      'draft', 'approved', 'sent', 'viewed', 'payment_pending',
      'paid', 'expired', 'cancelled'
    )),
  items jsonb not null default '[]'::jsonb,
  subtotal_inr numeric(12,2) not null default 0 check (subtotal_inr >= 0),
  shipping_inr numeric(12,2) not null default 0 check (shipping_inr >= 0),
  credit_inr numeric(12,2) not null default 0 check (credit_inr >= 0),
  total_inr numeric(12,2) not null default 0 check (total_inr >= 0),
  currency text not null default 'INR',
  delivery_address text not null default '',
  delivery_city text not null default '',
  delivery_state text not null default '',
  delivery_pin_code text not null default '',
  approved_at timestamptz null,
  approved_by_email text not null default '',
  sent_at timestamptz null,
  viewed_at timestamptz null,
  paid_at timestamptz null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  order_id uuid null,
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists b2b_quotes_account_idx
  on public.b2b_quotes(account_id, created_at desc);
create index if not exists b2b_quotes_status_expiry_idx
  on public.b2b_quotes(status, expires_at);

create table if not exists public.b2b_credits (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.b2b_accounts(id) on delete cascade,
  source_quote_id uuid null references public.b2b_quotes(id) on delete set null,
  amount_inr numeric(12,2) not null check (amount_inr > 0),
  remaining_inr numeric(12,2) not null check (remaining_inr >= 0),
  status text not null default 'active' check (status in ('active', 'consumed', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  consumed_quote_id uuid null references public.b2b_quotes(id) on delete set null,
  consumed_at timestamptz null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists b2b_credits_account_status_idx
  on public.b2b_credits(account_id, status, expires_at);
create unique index if not exists b2b_credits_source_quote_uidx
  on public.b2b_credits(source_quote_id)
  where source_quote_id is not null;

create table if not exists public.b2b_suppressions (
  id uuid primary key default gen_random_uuid(),
  identifier_type text not null check (identifier_type in ('email', 'phone', 'domain')),
  identifier_hash text not null,
  reason text not null default 'opt_out',
  source text not null default 'manual',
  suppressed_at timestamptz not null default now(),
  restored_at timestamptz null,
  notes text not null default '',
  unique (identifier_type, identifier_hash)
);

create table if not exists public.b2b_submission_attempts (
  id bigint generated always as identity primary key,
  fingerprint_hash text not null,
  submitted_at timestamptz not null default now()
);

create index if not exists b2b_submission_attempts_fingerprint_idx
  on public.b2b_submission_attempts(fingerprint_hash, submitted_at desc);

create table if not exists public.general_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'reviewed', 'closed', 'spam')),
  consent_to_contact boolean not null default true,
  source text not null default 'contact_page',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.refresh_b2b_account_score()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_has_email boolean;
  v_has_phone boolean;
begin
  select
    exists(select 1 from public.b2b_contacts c where c.account_id = new.id and coalesce(trim(c.email), '') <> ''),
    exists(select 1 from public.b2b_contacts c where c.account_id = new.id and coalesce(trim(c.phone), trim(c.whatsapp_phone), '') <> '')
  into v_has_email, v_has_phone;

  new.score = private.calculate_b2b_score(
    new.business_type,
    new.city,
    new.state,
    new.premium_positioning,
    new.retails_products,
    new.social_active,
    v_has_email,
    v_has_phone,
    new.location_count
  );
  return new;
end;
$$;

drop trigger if exists trg_b2b_accounts_score on public.b2b_accounts;
create trigger trg_b2b_accounts_score
before insert or update of business_type, city, state, premium_positioning,
  retails_products, social_active, location_count
on public.b2b_accounts
for each row execute function private.refresh_b2b_account_score();

create or replace function private.refresh_b2b_score_from_contact()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_account_id uuid;
begin
  v_account_id := case
    when tg_op = 'DELETE' then old.account_id
    else new.account_id
  end;
  update public.b2b_accounts
  set score = private.calculate_b2b_score(
    business_type,
    city,
    state,
    premium_positioning,
    retails_products,
    social_active,
    exists(select 1 from public.b2b_contacts c where c.account_id = v_account_id and coalesce(trim(c.email), '') <> ''),
    exists(select 1 from public.b2b_contacts c where c.account_id = v_account_id and coalesce(trim(c.phone), trim(c.whatsapp_phone), '') <> ''),
    location_count
  )
  where id = v_account_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_b2b_contacts_refresh_score on public.b2b_contacts;
create trigger trg_b2b_contacts_refresh_score
after insert or update or delete on public.b2b_contacts
for each row execute function private.refresh_b2b_score_from_contact();

do $$
declare
  v_table text;
  v_trigger text;
begin
  foreach v_table in array array[
    'b2b_accounts', 'b2b_contacts', 'b2b_opportunities', 'b2b_outreach',
    'b2b_trade_terms', 'b2b_quotes', 'b2b_credits', 'general_inquiries'
  ]
  loop
    v_trigger := 'trg_' || v_table || '_updated_at';
    execute format('drop trigger if exists %I on public.%I', v_trigger, v_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      v_trigger,
      v_table
    );
  end loop;
end;
$$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'orders'
  ) then
    alter table public.orders
      add column if not exists order_type text not null default 'retail'
        check (order_type in ('retail', 'b2b_sample', 'b2b_opening', 'b2b_reorder')),
      add column if not exists b2b_quote_id uuid null references public.b2b_quotes(id) on delete set null,
      add column if not exists b2b_account_id uuid null references public.b2b_accounts(id) on delete set null;

    create index if not exists orders_b2b_account_idx
      on public.orders(b2b_account_id, created_at desc)
      where b2b_account_id is not null;
  end if;
end;
$$;

insert into public.b2b_trade_terms (product_id, retail_price_inr)
select p.id, p.price_inr
from public.products p
on conflict (product_id)
do update set retail_price_inr = excluded.retail_price_inr;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'b2b_accounts', 'b2b_contacts', 'b2b_opportunities', 'b2b_activities',
    'b2b_outreach', 'b2b_trade_terms', 'b2b_quotes', 'b2b_credits',
    'b2b_suppressions', 'b2b_submission_attempts', 'general_inquiries'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from anon, authenticated', v_table);
    execute format('grant select, insert, update, delete on table public.%I to service_role', v_table);
  end loop;
end;
$$;

grant usage, select on all sequences in schema public to service_role;
revoke all on function private.calculate_b2b_score(text, text, text, boolean, boolean, boolean, boolean, boolean, integer)
  from public, anon, authenticated;
revoke all on function private.calculate_b2b_trade_terms() from public, anon, authenticated;
revoke all on function private.refresh_b2b_account_score() from public, anon, authenticated;
revoke all on function private.refresh_b2b_score_from_contact() from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;
