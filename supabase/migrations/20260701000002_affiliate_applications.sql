-- Create affiliate_applications table
create table if not exists public.affiliate_applications (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  social_links text,
  reason text,
  status text not null default 'pending', -- 'pending', 'approved', 'rejected'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.affiliate_applications enable row level security;

-- Policies for affiliate_applications
-- Allow anyone to insert an application
drop policy if exists affiliate_applications_public_insert on public.affiliate_applications;
create policy affiliate_applications_public_insert on public.affiliate_applications for insert with check (true);

-- Admin only access for everything else
drop policy if exists affiliate_applications_admin_all on public.affiliate_applications;
create policy affiliate_applications_admin_all on public.affiliate_applications for all using (true);

-- Updated_at trigger
create or replace function public.set_updated_at_affiliate_applications()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_affiliate_applications_updated_at on public.affiliate_applications;
create trigger trg_affiliate_applications_updated_at
before update on public.affiliate_applications
for each row
execute function public.set_updated_at_affiliate_applications();
