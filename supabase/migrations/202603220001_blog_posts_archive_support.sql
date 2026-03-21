alter table public.blog_posts
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz null;

create index if not exists blog_posts_archived_published_at_idx
  on public.blog_posts(is_archived, published_at desc);

create index if not exists blog_posts_archived_at_idx
  on public.blog_posts(archived_at desc)
  where archived_at is not null;