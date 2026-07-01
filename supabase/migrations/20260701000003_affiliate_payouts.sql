-- Add payout tracking columns to general_coupon_usages
alter table public.general_coupon_usages
add column if not exists is_affiliate_paid boolean not null default false,
add column if not exists affiliate_paid_at timestamptz;
