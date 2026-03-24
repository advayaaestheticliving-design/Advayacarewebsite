delete from auth.users
where email_confirmed_at is null
  and (
    email like 'copilot-home-%@example.com'
    or email like 'copilot-product-%@example.com'
  );