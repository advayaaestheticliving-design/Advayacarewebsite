create extension if not exists pgcrypto;

create table if not exists public.membership_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid null,
  guest_session_id text null,
  skin_type text not null,
  concerns text[] not null default '{}',
  allergies text[] not null default '{}',
  avoid_ingredients text[] not null default '{}',
  sun_exposure text not null default '',
  sleep_hours text not null default '',
  stress_level text not null default '',
  water_intake text not null default '',
  routine_steps text not null default '',
  current_products text not null default '',
  consent_to_process boolean not null default false,
  consent_to_ai boolean not null default false,
  consent_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_profile_identity_check check (
    auth_user_id is not null or guest_session_id is not null
  )
);

create unique index if not exists membership_profiles_auth_user_id_uidx
  on public.membership_profiles(auth_user_id)
  where auth_user_id is not null;

create unique index if not exists membership_profiles_guest_session_id_uidx
  on public.membership_profiles(guest_session_id)
  where guest_session_id is not null;

create table if not exists public.membership_recommendation_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.membership_profiles(id) on delete cascade,
  auth_user_id uuid null,
  guest_session_id text null,
  model_provider text not null default 'openai',
  model_name text not null default 'gpt-4o-mini',
  input_snapshot jsonb not null,
  recommendations jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.membership_profiles enable row level security;
alter table public.membership_recommendation_runs enable row level security;

drop policy if exists membership_profiles_select_own on public.membership_profiles;
create policy membership_profiles_select_own
  on public.membership_profiles
  for select
  using (
    auth.uid() is not null
    and auth.uid() = auth_user_id
  );

drop policy if exists membership_profiles_insert_own on public.membership_profiles;
create policy membership_profiles_insert_own
  on public.membership_profiles
  for insert
  with check (
    (
      auth.uid() is not null
      and auth.uid() = auth_user_id
    )
    or (
      auth.uid() is null
      and guest_session_id is not null
    )
  );

drop policy if exists membership_profiles_update_own on public.membership_profiles;
create policy membership_profiles_update_own
  on public.membership_profiles
  for update
  using (
    (
      auth.uid() is not null
      and auth.uid() = auth_user_id
    )
    or (
      auth.uid() is null
      and guest_session_id is not null
    )
  )
  with check (
    (
      auth.uid() is not null
      and auth.uid() = auth_user_id
    )
    or (
      auth.uid() is null
      and guest_session_id is not null
    )
  );

drop policy if exists membership_recommendation_runs_select_own on public.membership_recommendation_runs;
create policy membership_recommendation_runs_select_own
  on public.membership_recommendation_runs
  for select
  using (
    (
      auth.uid() is not null
      and auth.uid() = auth_user_id
    )
    or (
      auth.uid() is null
      and guest_session_id is not null
    )
  );

create or replace function public.set_updated_at_membership_profiles()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_membership_profiles_updated_at on public.membership_profiles;
create trigger trg_membership_profiles_updated_at
before update on public.membership_profiles
for each row
execute function public.set_updated_at_membership_profiles();