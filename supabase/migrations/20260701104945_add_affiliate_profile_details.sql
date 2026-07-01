alter table public.affiliate_coupons
add column if not exists email text,
add column if not exists phone text,
add column if not exists social_links text,
add column if not exists reason text;
