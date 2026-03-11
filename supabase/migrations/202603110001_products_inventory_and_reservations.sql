create extension if not exists pgcrypto;

create table if not exists public.products (
  id text primary key,
  name text not null,
  price_inr numeric(10,2) not null check (price_inr >= 0),
  filter_tags text[] not null default '{}',
  images text[] not null default '{}',
  one_line_summary text not null default '',
  ingredients text not null default '',
  benefits_brief text not null default '',
  benefits_detail text not null default '',
  use_cases text not null default '',
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (stock_quantity >= reserved_quantity)
);

create index if not exists products_active_idx on public.products (is_active);
create index if not exists products_stock_idx on public.products ((stock_quantity - reserved_quantity));

create table if not exists public.product_stock_events (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  event_type text not null check (event_type in ('reserve', 'release', 'finalize', 'restock', 'adjustment')),
  quantity_change integer not null,
  quantity_before integer not null,
  quantity_after integer not null,
  order_id uuid null,
  notes text not null default '',
  actor_email text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists product_stock_events_product_idx
  on public.product_stock_events(product_id, created_at desc);

create table if not exists public.order_inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  product_id text not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  status text not null default 'reserved' check (status in ('reserved', 'released', 'finalized')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  released_at timestamptz null,
  finalized_at timestamptz null,
  unique (order_id, product_id)
);

create index if not exists order_inventory_reservations_order_idx
  on public.order_inventory_reservations(order_id);

create index if not exists order_inventory_reservations_status_idx
  on public.order_inventory_reservations(status);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'orders'
  ) then
    alter table public.orders
      add column if not exists inventory_status text not null default 'none' check (inventory_status in ('none', 'reserved', 'released', 'finalized')),
      add column if not exists inventory_reserved_at timestamptz null,
      add column if not exists inventory_released_at timestamptz null,
      add column if not exists inventory_finalized_at timestamptz null,
      add column if not exists inventory_error text not null default '';

    create index if not exists orders_inventory_status_idx on public.orders(inventory_status);
  end if;
end $$;

create or replace function public.set_products_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row
execute function public.set_products_updated_at();

drop trigger if exists trg_order_inventory_reservations_updated_at on public.order_inventory_reservations;
create trigger trg_order_inventory_reservations_updated_at
before update on public.order_inventory_reservations
for each row
execute function public.set_products_updated_at();

create or replace function public.reserve_inventory_for_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_order record;
  v_requested_count integer := 0;
  v_requested_group_count integer := 0;
  v_reserved_count integer := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  select id, items, inventory_status
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'order_not_found'
    );
  end if;

  if v_order.inventory_status in ('reserved', 'finalized') then
    return jsonb_build_object(
      'success', true,
      'status', v_order.inventory_status,
      'alreadyProcessed', true
    );
  end if;

  with requested as (
    select
      trim(coalesce(item.value->>'product_id', item.value->>'productId', '')) as product_id,
      greatest(1, floor(coalesce((item.value->>'quantity')::numeric, 1)))::integer as quantity
    from jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb)) as item(value)
    where trim(coalesce(item.value->>'product_id', item.value->>'productId', '')) <> ''
      and trim(coalesce(item.value->>'product_id', item.value->>'productId', '')) not like 'gift-card-%'
  ),
  aggregated as (
    select product_id, sum(quantity)::integer as quantity
    from requested
    group by product_id
  )
  select coalesce(sum(quantity), 0), count(*)
  into v_requested_count, v_requested_group_count
  from aggregated;

  if v_requested_count = 0 then
    update public.orders
    set inventory_status = 'none',
        inventory_error = '',
        updated_at = v_now
    where id = p_order_id;

    return jsonb_build_object(
      'success', true,
      'status', 'none',
      'reservedItems', 0
    );
  end if;

  with requested as (
    select
      trim(coalesce(item.value->>'product_id', item.value->>'productId', '')) as product_id,
      greatest(1, floor(coalesce((item.value->>'quantity')::numeric, 1)))::integer as quantity
    from jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb)) as item(value)
    where trim(coalesce(item.value->>'product_id', item.value->>'productId', '')) <> ''
      and trim(coalesce(item.value->>'product_id', item.value->>'productId', '')) not like 'gift-card-%'
  ),
  aggregated as (
    select product_id, sum(quantity)::integer as quantity
    from requested
    group by product_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'productId', r.product_id,
        'requestedQuantity', r.quantity,
        'availableQuantity', greatest(0, coalesce(p.stock_quantity, 0) - coalesce(p.reserved_quantity, 0)),
        'reason', case
          when p.id is null then 'missing_product'
          when p.is_active = false then 'inactive_product'
          when (p.stock_quantity - p.reserved_quantity) < r.quantity then 'insufficient_stock'
          else 'unknown'
        end
      )
    ),
    '[]'::jsonb
  )
  into v_errors
  from aggregated r
  left join public.products p on p.id = r.product_id
  where p.id is null
     or p.is_active = false
     or (p.stock_quantity - p.reserved_quantity) < r.quantity;

  if jsonb_array_length(v_errors) > 0 then
    update public.orders
    set inventory_status = 'none',
        inventory_error = 'Stock unavailable for one or more items.',
        updated_at = v_now
    where id = p_order_id;

    return jsonb_build_object(
      'success', false,
      'error', 'insufficient_stock',
      'items', v_errors
    );
  end if;

  with requested as (
    select
      trim(coalesce(item.value->>'product_id', item.value->>'productId', '')) as product_id,
      greatest(1, floor(coalesce((item.value->>'quantity')::numeric, 1)))::integer as quantity
    from jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb)) as item(value)
    where trim(coalesce(item.value->>'product_id', item.value->>'productId', '')) <> ''
      and trim(coalesce(item.value->>'product_id', item.value->>'productId', '')) not like 'gift-card-%'
  ),
  aggregated as (
    select product_id, sum(quantity)::integer as quantity
    from requested
    group by product_id
  ),
  updated as (
    update public.products p
    set reserved_quantity = p.reserved_quantity + a.quantity,
        updated_at = v_now
    from aggregated a
    where p.id = a.product_id
      and p.is_active = true
      and (p.stock_quantity - p.reserved_quantity) >= a.quantity
    returning p.id, p.stock_quantity, p.reserved_quantity, a.quantity
  )
  select count(*) into v_reserved_count from updated;

  if v_reserved_count <> v_requested_group_count
  then
    raise exception 'Inventory changed during reservation. Please retry.';
  end if;

  with requested as (
    select
      trim(coalesce(item.value->>'product_id', item.value->>'productId', '')) as product_id,
      greatest(1, floor(coalesce((item.value->>'quantity')::numeric, 1)))::integer as quantity
    from jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb)) as item(value)
    where trim(coalesce(item.value->>'product_id', item.value->>'productId', '')) <> ''
      and trim(coalesce(item.value->>'product_id', item.value->>'productId', '')) not like 'gift-card-%'
  ),
  aggregated as (
    select product_id, sum(quantity)::integer as quantity
    from requested
    group by product_id
  )
  insert into public.order_inventory_reservations (
    order_id,
    product_id,
    quantity,
    status,
    notes,
    created_at,
    updated_at,
    released_at,
    finalized_at
  )
  select
    p_order_id,
    a.product_id,
    a.quantity,
    'reserved',
    'Reserved before Razorpay checkout',
    v_now,
    v_now,
    null,
    null
  from aggregated a
  on conflict (order_id, product_id)
  do update
    set quantity = excluded.quantity,
        status = 'reserved',
        notes = excluded.notes,
        updated_at = v_now,
        released_at = null,
        finalized_at = null;

  update public.orders
  set inventory_status = 'reserved',
      inventory_reserved_at = v_now,
      inventory_error = '',
      updated_at = v_now
  where id = p_order_id;

  return jsonb_build_object(
    'success', true,
    'status', 'reserved'
  );
exception
  when others then
    update public.orders
    set inventory_status = 'none',
        inventory_error = coalesce(sqlerrm, 'reservation_failed'),
        updated_at = now()
    where id = p_order_id;

    return jsonb_build_object(
      'success', false,
      'error', 'reservation_failed',
      'message', sqlerrm
    );
end;
$$;

create or replace function public.release_inventory_for_order(
  p_order_id uuid,
  p_reason text default 'checkout_cancelled'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_order record;
  v_has_reservations boolean := false;
begin
  select id, inventory_status
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    return jsonb_build_object('success', false, 'error', 'order_not_found');
  end if;

  if v_order.inventory_status = 'finalized' then
    return jsonb_build_object('success', true, 'status', 'finalized', 'alreadyProcessed', true);
  end if;

  select exists (
    select 1
    from public.order_inventory_reservations
    where order_id = p_order_id
      and status = 'reserved'
  ) into v_has_reservations;

  if v_has_reservations then
    with released_rows as (
      select product_id, quantity
      from public.order_inventory_reservations
      where order_id = p_order_id
        and status = 'reserved'
    )
    update public.products p
    set reserved_quantity = greatest(0, p.reserved_quantity - r.quantity),
        updated_at = v_now
    from released_rows r
    where p.id = r.product_id;

    update public.order_inventory_reservations
    set status = 'released',
        notes = coalesce(nullif(trim(p_reason), ''), 'checkout_cancelled'),
        released_at = v_now,
        updated_at = v_now
    where order_id = p_order_id
      and status = 'reserved';
  end if;

  update public.orders
  set inventory_status = case when v_has_reservations then 'released' else coalesce(inventory_status, 'none') end,
      inventory_released_at = case when v_has_reservations then v_now else inventory_released_at end,
      inventory_error = '',
      updated_at = v_now
  where id = p_order_id;

  return jsonb_build_object(
    'success', true,
    'status', case when v_has_reservations then 'released' else coalesce(v_order.inventory_status, 'none') end,
    'released', v_has_reservations
  );
end;
$$;

create or replace function public.finalize_inventory_for_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_order record;
  v_pending_count integer := 0;
  v_updated_count integer := 0;
begin
  select id, inventory_status
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    return jsonb_build_object('success', false, 'error', 'order_not_found');
  end if;

  if v_order.inventory_status = 'finalized' then
    return jsonb_build_object('success', true, 'status', 'finalized', 'alreadyProcessed', true);
  end if;

  select count(*) into v_pending_count
  from public.order_inventory_reservations
  where order_id = p_order_id
    and status = 'reserved';

  if v_pending_count = 0 then
    update public.orders
    set inventory_status = 'finalized',
        inventory_finalized_at = v_now,
        inventory_error = '',
        updated_at = v_now
    where id = p_order_id;

    return jsonb_build_object('success', true, 'status', 'finalized', 'finalizedItems', 0);
  end if;

  with reservation_totals as (
    select product_id, sum(quantity)::integer as quantity
    from public.order_inventory_reservations
    where order_id = p_order_id
      and status = 'reserved'
    group by product_id
  ),
  updated as (
    update public.products p
    set stock_quantity = p.stock_quantity - r.quantity,
        reserved_quantity = greatest(0, p.reserved_quantity - r.quantity),
        updated_at = v_now
    from reservation_totals r
    where p.id = r.product_id
      and p.stock_quantity >= r.quantity
      and p.reserved_quantity >= r.quantity
    returning p.id
  )
  select count(*) into v_updated_count from updated;

  if v_updated_count <> (
    select count(*)
    from (
      select product_id
      from public.order_inventory_reservations
      where order_id = p_order_id
        and status = 'reserved'
      group by product_id
    ) as grouped
  ) then
    raise exception 'Inventory could not be finalized due to insufficient stock state.';
  end if;

  update public.order_inventory_reservations
  set status = 'finalized',
      notes = 'Finalized after successful payment',
      finalized_at = v_now,
      updated_at = v_now
  where order_id = p_order_id
    and status = 'reserved';

  update public.orders
  set inventory_status = 'finalized',
      inventory_finalized_at = v_now,
      inventory_error = '',
      updated_at = v_now
  where id = p_order_id;

  return jsonb_build_object('success', true, 'status', 'finalized', 'finalizedItems', v_pending_count);
exception
  when others then
    update public.orders
    set inventory_error = coalesce(sqlerrm, 'finalization_failed'),
        updated_at = now()
    where id = p_order_id;

    return jsonb_build_object(
      'success', false,
      'error', 'finalization_failed',
      'message', sqlerrm
    );
end;
$$;

grant execute on function public.reserve_inventory_for_order(uuid) to anon, authenticated, service_role;
grant execute on function public.release_inventory_for_order(uuid, text) to anon, authenticated, service_role;
grant execute on function public.finalize_inventory_for_order(uuid) to anon, authenticated, service_role;
