create or replace function public.release_stale_inventory_reservations(
  p_max_age_minutes integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_cutoff timestamptz := now() - make_interval(mins => greatest(1, p_max_age_minutes));
  v_released_count integer := 0;
begin
  with stale as (
    select
      r.id,
      r.order_id,
      r.product_id,
      r.quantity
    from public.order_inventory_reservations r
    join public.orders o on o.id = r.order_id
    where r.status = 'reserved'
      and r.created_at < v_cutoff
      and coalesce(o.status, 'pending') <> 'paid'
  ),
  totals as (
    select product_id, sum(quantity)::integer as quantity
    from stale
    group by product_id
  ),
  updated_products as (
    update public.products p
    set reserved_quantity = greatest(0, p.reserved_quantity - t.quantity),
        updated_at = v_now
    from totals t
    where p.id = t.product_id
    returning p.id
  ),
  updated_reservations as (
    update public.order_inventory_reservations r
    set status = 'released',
        notes = 'Auto-released after reservation timeout',
        released_at = v_now,
        updated_at = v_now
    where r.id in (select id from stale)
    returning r.order_id
  ),
  updated_orders as (
    update public.orders o
    set inventory_status = 'released',
        inventory_released_at = v_now,
        inventory_error = '',
        updated_at = v_now
    where o.id in (select distinct order_id from updated_reservations)
      and o.inventory_status = 'reserved'
    returning o.id
  )
  select count(*) into v_released_count
  from updated_reservations;

  return jsonb_build_object(
    'success', true,
    'releasedReservations', v_released_count,
    'cutoffIso', v_cutoff
  );
end;
$$;

grant execute on function public.release_stale_inventory_reservations(integer)
  to anon, authenticated, service_role;
