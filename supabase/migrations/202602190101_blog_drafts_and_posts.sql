create extension if not exists pgcrypto;

create table if not exists public.blog_drafts (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  slug text null,
  short_description text not null default '',
  content text not null default '',
  image_url text not null default '',
  image_storage_path text not null default '',
  image_search_terms text[] not null default '{}',
  tags text[] not null default '{}',
  seo_title text not null default '',
  seo_description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_drafts_updated_at_idx
  on public.blog_drafts(updated_at desc);

create index if not exists blog_drafts_slug_idx
  on public.blog_drafts(slug);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  short_description text not null default '',
  content text not null,
  image_url text not null default '',
  image_storage_path text not null default '',
  image_search_terms text[] not null default '{}',
  tags text[] not null default '{}',
  seo_title text not null default '',
  seo_description text not null default '',
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists blog_posts_slug_uidx
  on public.blog_posts(slug);

create index if not exists blog_posts_published_at_idx
  on public.blog_posts(published_at desc);

alter table public.blog_drafts enable row level security;
alter table public.blog_posts enable row level security;

drop policy if exists blog_posts_select_public on public.blog_posts;
create policy blog_posts_select_public
  on public.blog_posts
  for select
  using (true);

create or replace function public.set_updated_at_blog_tables()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_blog_drafts_updated_at on public.blog_drafts;
create trigger trg_blog_drafts_updated_at
before update on public.blog_drafts
for each row
execute function public.set_updated_at_blog_tables();

drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;
create trigger trg_blog_posts_updated_at
before update on public.blog_posts
for each row
execute function public.set_updated_at_blog_tables();
