-- Create function to issue signup coupon
create or replace function public.trigger_issue_signup_coupon()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_code text;
begin
  v_code := 'WELCOME-' || upper(substr(md5(random()::text), 1, 8));
  
  insert into public.member_coupons (
    auth_user_id,
    code,
    amount_inr,
    status,
    issued_reason,
    expires_at,
    issued_at,
    updated_at
  ) values (
    new.id,
    v_code,
    100.00,
    'active',
    'Signup bonus',
    now() + interval '30 days',
    now(),
    now()
  );
  
  return new;
end;
$$;

-- Drop existing trigger if it exists
drop trigger if exists trg_on_auth_user_created_issue_coupon on auth.users;

-- Create trigger on auth.users
create trigger trg_on_auth_user_created_issue_coupon
after insert on auth.users
for each row
execute function public.trigger_issue_signup_coupon();
