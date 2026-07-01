-- Create affiliate_profiles table
create table if not exists public.affiliate_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  social_links text,
  reason text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS for affiliate_profiles
alter table public.affiliate_profiles enable row level security;
drop policy if exists affiliate_profiles_admin_all on public.affiliate_profiles;
create policy affiliate_profiles_admin_all on public.affiliate_profiles for all using (true);

-- Trigger for affiliate_profiles
create or replace function public.set_updated_at_affiliate_profiles()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_affiliate_profiles_updated_at on public.affiliate_profiles;
create trigger trg_affiliate_profiles_updated_at
before update on public.affiliate_profiles
for each row
execute function public.set_updated_at_affiliate_profiles();

-- Add profile_id to affiliate_coupons
alter table public.affiliate_coupons add column profile_id uuid references public.affiliate_profiles(id) on delete cascade;

-- Data Migration: Insert distinct profiles into affiliate_profiles
insert into public.affiliate_profiles (name, email, phone, social_links, reason)
select distinct on (coalesce(email, affiliate_name)) 
  affiliate_name, 
  coalesce(email, affiliate_name || '_' || id::text || '@placeholder.com'), 
  phone, 
  social_links, 
  reason
from public.affiliate_coupons;

-- Update affiliate_coupons to link to the new profile_id
update public.affiliate_coupons ac
set profile_id = ap.id
from public.affiliate_profiles ap
where coalesce(ac.email, ac.affiliate_name || '_' || ac.id::text || '@placeholder.com') = ap.email;

-- Make profile_id not null now that data is migrated
alter table public.affiliate_coupons alter column profile_id set not null;

-- Drop old duplicated columns from affiliate_coupons
alter table public.affiliate_coupons drop column affiliate_name;
alter table public.affiliate_coupons drop column email;
alter table public.affiliate_coupons drop column phone;
alter table public.affiliate_coupons drop column social_links;
alter table public.affiliate_coupons drop column reason;
