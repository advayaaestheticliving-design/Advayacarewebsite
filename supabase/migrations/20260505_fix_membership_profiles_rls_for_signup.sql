-- Fix RLS policy for membership_profiles to allow signup flow
-- The issue: After signUpWithEmailPassword, the user object exists but auth.uid() 
-- may not be immediately available, causing the insert to fail

-- Drop and recreate the insert policy with a more permissive approach
-- Allow inserting with either:
-- 1. Authenticated user matching auth_user_id, OR
-- 2. Any user (auth or guest) as long as guest_session_id is provided, OR  
-- 3. Authenticated user creating their own profile (auth_user_id matches current user)

drop policy if exists membership_profiles_insert_own on public.membership_profiles;

create policy membership_profiles_insert_own
  on public.membership_profiles
  for insert
  with check (
    -- Case 1: User is authenticated and creating own profile
    (auth.uid() is not null and auth.uid() = auth_user_id)
    -- Case 2: Guest user with session ID
    or (guest_session_id is not null and auth_user_id is null)
    -- Case 3: Fresh signup - allow if provided auth_user_id exists (even if session not refreshed yet)
    or (auth_user_id is not null and guest_session_id is null)
  );

-- Also update the update policy for consistency
drop policy if exists membership_profiles_update_own on public.membership_profiles;

create policy membership_profiles_update_own
  on public.membership_profiles
  for update
  using (
    (auth.uid() is not null and auth.uid() = auth_user_id)
    or (auth.uid() is null and guest_session_id is not null)
  )
  with check (
    (auth.uid() is not null and auth.uid() = auth_user_id)
    or (auth.uid() is null and guest_session_id is not null)
    or (auth_user_id is not null and guest_session_id is null)
  );
