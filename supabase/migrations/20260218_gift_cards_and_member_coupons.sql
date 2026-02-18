create extension if not exists pgcrypto;

create table if not exists public.member_coupons (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  code text not null unique,
  amount_inr numeric(10,2) not null check (amount_inr > 0),
  status text not null default 'active' check (status in ('active', 'consumed', 'expired', 'revoked')),
  issued_reason text not null default 'member_signup',
  expires_at timestamptz null,
  issued_at timestamptz not null default now(),
  consumed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_coupons_auth_user_idx
  on public.member_coupons(auth_user_id);

create index if not exists member_coupons_status_idx
  on public.member_coupons(status);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.member_coupons(id) on delete cascade,
  auth_user_id uuid not null,
  code text not null,
  order_id uuid null,
  amount_inr numeric(10,2) not null check (amount_inr >= 0),
  redeemed_at timestamptz not null default now()
);

create index if not exists coupon_redemptions_auth_user_idx
  on public.coupon_redemptions(auth_user_id);

create index if not exists coupon_redemptions_coupon_idx
  on public.coupon_redemptions(coupon_id);

create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  initial_amount_inr numeric(10,2) not null check (initial_amount_inr > 0),
  balance_amount_inr numeric(10,2) not null check (balance_amount_inr >= 0),
  status text not null default 'active' check (status in ('active', 'depleted', 'expired', 'revoked')),
  owner_auth_user_id uuid null,
  owner_email text null,
  purchased_order_id uuid null,
  issued_to_name text null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gift_cards_owner_auth_user_idx
  on public.gift_cards(owner_auth_user_id);

create index if not exists gift_cards_status_idx
  on public.gift_cards(status);

create table if not exists public.gift_card_transactions (
  id uuid primary key default gen_random_uuid(),
  gift_card_id uuid not null references public.gift_cards(id) on delete cascade,
  tx_type text not null check (tx_type in ('credit', 'debit', 'adjustment')),
  amount_inr numeric(10,2) not null check (amount_inr > 0),
  balance_after_inr numeric(10,2) not null check (balance_after_inr >= 0),
  order_id uuid null,
  notes text not null default '',
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);

create index if not exists gift_card_transactions_gift_card_idx
  on public.gift_card_transactions(gift_card_id, created_at desc);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'orders'
  ) then
    alter table public.orders
      add column if not exists auth_user_id uuid null,
      add column if not exists guest_session_id text null,
      add column if not exists coupon_code text null,
      add column if not exists gift_card_code text null,
      add column if not exists coupon_amount_inr numeric(10,2) not null default 0,
      add column if not exists gift_card_amount_inr numeric(10,2) not null default 0,
      add column if not exists discount_total_inr numeric(10,2) not null default 0,
      add column if not exists discount_snapshot jsonb not null default '{}'::jsonb;

    create index if not exists orders_auth_user_idx on public.orders(auth_user_id);
    create index if not exists orders_coupon_code_idx on public.orders(coupon_code);
    create index if not exists orders_gift_card_code_idx on public.orders(gift_card_code);
  end if;
end $$;

alter table public.member_coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.gift_cards enable row level security;
alter table public.gift_card_transactions enable row level security;

drop policy if exists member_coupons_select_own on public.member_coupons;
create policy member_coupons_select_own
  on public.member_coupons
  for select
  using (auth.uid() is not null and auth.uid() = auth_user_id);

drop policy if exists coupon_redemptions_select_own on public.coupon_redemptions;
create policy coupon_redemptions_select_own
  on public.coupon_redemptions
  for select
  using (auth.uid() is not null and auth.uid() = auth_user_id);

drop policy if exists gift_cards_select_own on public.gift_cards;
create policy gift_cards_select_own
  on public.gift_cards
  for select
  using (auth.uid() is not null and auth.uid() = owner_auth_user_id);

drop policy if exists gift_card_transactions_select_owner on public.gift_card_transactions;
create policy gift_card_transactions_select_owner
  on public.gift_card_transactions
  for select
  using (
    exists (
      select 1
      from public.gift_cards gc
      where gc.id = gift_card_transactions.gift_card_id
        and gc.owner_auth_user_id = auth.uid()
    )
  );

create or replace function public.set_updated_at_wallet_tables()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_member_coupons_updated_at on public.member_coupons;
create trigger trg_member_coupons_updated_at
before update on public.member_coupons
for each row
execute function public.set_updated_at_wallet_tables();

drop trigger if exists trg_gift_cards_updated_at on public.gift_cards;
create trigger trg_gift_cards_updated_at
before update on public.gift_cards
for each row
execute function public.set_updated_at_wallet_tables();