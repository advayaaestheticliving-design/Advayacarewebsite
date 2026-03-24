create extension if not exists pgcrypto;

create table if not exists public.member_comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('home', 'product')),
  product_id text null references public.products(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  city text not null default '',
  headline text not null default '',
  body text not null default '',
  rating integer null check (rating between 1 and 5),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'spam')),
  moderation_notes text not null default '',
  moderated_by_email text null,
  moderated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_comments_body_length check (char_length(trim(body)) between 20 and 1200),
  constraint member_comments_display_name_length check (char_length(trim(display_name)) between 2 and 80),
  constraint member_comments_target_requirements check (
    (target_type = 'home' and product_id is null and rating is null)
    or (target_type = 'product' and product_id is not null and rating is not null)
  )
);

create index if not exists member_comments_status_idx
  on public.member_comments(status, created_at desc);

create index if not exists member_comments_target_idx
  on public.member_comments(target_type, created_at desc);

create index if not exists member_comments_product_idx
  on public.member_comments(product_id, created_at desc)
  where product_id is not null;

create index if not exists member_comments_auth_user_idx
  on public.member_comments(auth_user_id, created_at desc);

create or replace function public.set_member_comments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_member_comments_updated_at on public.member_comments;
create trigger trg_member_comments_updated_at
before update on public.member_comments
for each row
execute function public.set_member_comments_updated_at();

alter table public.member_comments enable row level security;

drop policy if exists member_comments_select_public on public.member_comments;
create policy member_comments_select_public
on public.member_comments
for select
using (status = 'approved');

drop policy if exists member_comments_insert_member_own on public.member_comments;
create policy member_comments_insert_member_own
on public.member_comments
for insert
to authenticated
with check (
  auth.uid() is not null
  and auth.uid() = auth_user_id
  and status = 'pending'
  and moderation_notes = ''
  and moderated_by_email is null
  and moderated_at is null
);