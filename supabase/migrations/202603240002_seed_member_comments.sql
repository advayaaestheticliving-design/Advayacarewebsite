do $$
declare
  v_first record;
  v_second record;
  v_third record;
  v_inserted_count integer := 0;
begin
  select
    id,
    email,
    coalesce(
      nullif(trim(raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(raw_user_meta_data ->> 'name'), ''),
      nullif(trim(raw_user_meta_data ->> 'display_name'), ''),
      initcap(replace(split_part(coalesce(email, ''), '@', 1), '.', ' '))
    ) as display_name
  into v_first
  from auth.users
  where email_confirmed_at is not null
  order by coalesce(last_sign_in_at, created_at) asc
  limit 1;

  if v_first.id is null then
    raise notice 'No confirmed auth users found; skipping member comment seed.';
    return;
  end if;

  select
    id,
    email,
    coalesce(
      nullif(trim(raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(raw_user_meta_data ->> 'name'), ''),
      nullif(trim(raw_user_meta_data ->> 'display_name'), ''),
      initcap(replace(split_part(coalesce(email, ''), '@', 1), '.', ' '))
    ) as display_name
  into v_second
  from auth.users
  where email_confirmed_at is not null
  order by coalesce(last_sign_in_at, created_at) asc
  offset 1
  limit 1;

  if v_second.id is null then
    v_second := v_first;
  end if;

  select
    id,
    email,
    coalesce(
      nullif(trim(raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(raw_user_meta_data ->> 'name'), ''),
      nullif(trim(raw_user_meta_data ->> 'display_name'), ''),
      initcap(replace(split_part(coalesce(email, ''), '@', 1), '.', ' '))
    ) as display_name
  into v_third
  from auth.users
  where email_confirmed_at is not null
  order by coalesce(last_sign_in_at, created_at) asc
  offset 2
  limit 1;

  if v_third.id is null then
    v_third := v_second;
  end if;

  if not exists (
    select 1
    from public.member_comments
    where auth_user_id = v_first.id
      and target_type = 'home'
      and headline = 'Quiet luxury for my everyday routine'
  ) then
    insert into public.member_comments (
      target_type,
      auth_user_id,
      display_name,
      city,
      headline,
      body,
      status,
      moderation_notes,
      moderated_by_email,
      moderated_at,
      created_at,
      updated_at
    ) values (
      'home',
      v_first.id,
      v_first.display_name,
      'Mumbai',
      'Quiet luxury for my everyday routine',
      'The products feel thoughtful instead of flashy. I keep a small Advaya routine on my shelf because it works well in humid weather and still feels calming at night.',
      'approved',
      'Seeded from confirmed member account for launch verification.',
      'advaya.aestheticliving@gmail.com',
      now(),
      now() - interval '6 days',
      now() - interval '6 days'
    );
    v_inserted_count := v_inserted_count + 1;
  end if;

  if not exists (
    select 1
    from public.member_comments
    where auth_user_id = v_second.id
      and target_type = 'product'
      and product_id = '24k-gold-glowing-gel'
      and headline = 'Cooling without any tackiness'
  ) then
    insert into public.member_comments (
      target_type,
      product_id,
      auth_user_id,
      display_name,
      city,
      headline,
      body,
      rating,
      status,
      moderation_notes,
      moderated_by_email,
      moderated_at,
      created_at,
      updated_at
    ) values (
      'product',
      '24k-gold-glowing-gel',
      v_second.id,
      v_second.display_name,
      'Bengaluru',
      'Cooling without any tackiness',
      'The gel settles fast, gives an immediate cooling feel, and does not leave the sticky finish I usually expect from aloe-heavy products.',
      5,
      'approved',
      'Seeded from confirmed member account for launch verification.',
      'advaya.aestheticliving@gmail.com',
      now(),
      now() - interval '4 days',
      now() - interval '4 days'
    );
    v_inserted_count := v_inserted_count + 1;
  end if;

  if not exists (
    select 1
    from public.member_comments
    where auth_user_id = v_third.id
      and target_type = 'product'
      and product_id = 'glow-skin-toner'
      and headline = 'Balanced well under sunscreen'
  ) then
    insert into public.member_comments (
      target_type,
      product_id,
      auth_user_id,
      display_name,
      city,
      headline,
      body,
      rating,
      status,
      moderation_notes,
      created_at,
      updated_at
    ) values (
      'product',
      'glow-skin-toner',
      v_third.id,
      v_third.display_name,
      'Pune',
      'Balanced well under sunscreen',
      'I submitted this after a full week of use because the toner layered cleanly in the morning and never made my sunscreen pill. Leaving it pending keeps the moderation queue populated for review.',
      4,
      'pending',
      'Seeded pending review from confirmed member account for moderation testing.',
      now() - interval '1 day',
      now() - interval '1 day'
    );
    v_inserted_count := v_inserted_count + 1;
  end if;

  raise notice 'Seeded % member comment rows.', v_inserted_count;
end $$;