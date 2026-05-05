-- Debug migration: Temporarily make membership_profiles insert policy permissive to isolate RLS issue
-- If this fixes the error, then we know it's an RLS policy issue
-- If the error persists, then it's something else (constraint, trigger, etc.)

drop policy if exists membership_profiles_insert_own on public.membership_profiles;

create policy membership_profiles_insert_own
  on public.membership_profiles
  for insert
  with check (true);  -- Allow any insert for debugging

-- Also make update policy permissive for consistency during debugging
drop policy if exists membership_profiles_update_own on public.membership_profiles;

create policy membership_profiles_update_own
  on public.membership_profiles
  for update
  using (true)
  with check (true);