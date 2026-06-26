-- Allow admin-created comments to have no linked auth user
alter table public.member_comments
  alter column auth_user_id drop not null;
