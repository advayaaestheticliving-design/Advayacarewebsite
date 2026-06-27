-- Create affiliate_coupons table
create table if not exists public.affiliate_coupons (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.general_coupons(id) on delete cascade,
  affiliate_name text not null,
  commission_type text not null check (commission_type in ('percentage', 'fixed')),
  commission_rate numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists affiliate_coupons_coupon_id_idx on public.affiliate_coupons(coupon_id);

-- Enable RLS
alter table public.affiliate_coupons enable row level security;

-- Policies for affiliate_coupons (Admin only access)
drop policy if exists affiliate_coupons_admin_all on public.affiliate_coupons;
create policy affiliate_coupons_admin_all on public.affiliate_coupons for all using (true);

-- Update trigger
create or replace function public.set_updated_at_affiliate_coupons()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_affiliate_coupons_updated_at on public.affiliate_coupons;
create trigger trg_affiliate_coupons_updated_at
before update on public.affiliate_coupons
for each row
execute function public.set_updated_at_affiliate_coupons();
