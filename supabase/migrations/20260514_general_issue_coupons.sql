-- Create general_coupons table
create table if not exists public.general_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('fixed', 'percentage', 'both')),
  fixed_amount_inr numeric(10,2),
  percentage_discount numeric(5,2),
  max_discount_inr numeric(10,2),
  min_order_amount_inr numeric(10,2),
  is_active boolean not null default true,
  require_membership boolean not null default true,
  global_usage_limit integer,
  global_usage_count integer not null default 0,
  per_member_usage_limit integer default 1,
  all_orders boolean not null default false,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists general_coupons_code_idx on public.general_coupons(code);
create index if not exists general_coupons_is_active_idx on public.general_coupons(is_active);

-- Create general_coupon_usages table
create table if not exists public.general_coupon_usages (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.general_coupons(id) on delete cascade,
  coupon_code text not null,
  auth_user_id uuid,
  guest_session_id text,
  order_id uuid null,
  discount_amount_inr numeric(10,2) not null,
  used_at timestamptz not null default now()
);

create index if not exists general_coupon_usages_coupon_id_idx on public.general_coupon_usages(coupon_id);
create index if not exists general_coupon_usages_auth_user_id_idx on public.general_coupon_usages(auth_user_id);
create index if not exists general_coupon_usages_guest_session_id_idx on public.general_coupon_usages(guest_session_id);

-- Enable RLS
alter table public.general_coupons enable row level security;
alter table public.general_coupon_usages enable row level security;

-- Policies
drop policy if exists general_coupons_admin_all on public.general_coupons;
create policy general_coupons_admin_all on public.general_coupons for all using (true);

drop policy if exists general_coupons_select_active on public.general_coupons;
create policy general_coupons_select_active on public.general_coupons for select using (is_active = true);

drop policy if exists general_coupon_usages_insert on public.general_coupon_usages;
create policy general_coupon_usages_insert on public.general_coupon_usages for insert with check (true);

drop policy if exists general_coupon_usages_select_own on public.general_coupon_usages;
create policy general_coupon_usages_select_own on public.general_coupon_usages for select using (auth.uid() = auth_user_id or guest_session_id is not null);

-- Update trigger
create or replace function public.set_updated_at_general_coupons()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_general_coupons_updated_at on public.general_coupons;
create trigger trg_general_coupons_updated_at
before update on public.general_coupons
for each row
execute function public.set_updated_at_general_coupons();
