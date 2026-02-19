do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'orders'
  ) then
    alter table public.orders
      add column if not exists fulfillment_status text not null default 'pending',
      add column if not exists fulfillment_updated_at timestamptz null,
      add column if not exists fulfillment_notes text not null default '';

    create index if not exists orders_fulfillment_status_idx
      on public.orders(fulfillment_status);
  end if;
end $$;

create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null check (status in ('pending', 'paid', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'returned')),
  status_kind text not null default 'fulfillment' check (status_kind in ('payment', 'fulfillment', 'system')),
  notes text not null default '',
  changed_by_user_id uuid null,
  changed_by_email text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_status_events_order_idx
  on public.order_status_events(order_id, created_at desc);

alter table public.order_status_events enable row level security;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'auth_user_id'
  ) then
    execute 'drop policy if exists order_status_events_select_own on public.order_status_events';

    execute $policy$
      create policy order_status_events_select_own
        on public.order_status_events
        for select
        using (
          auth.uid() is not null
          and exists (
            select 1
            from public.orders o
            where o.id = order_status_events.order_id
              and o.auth_user_id = auth.uid()
          )
        )
    $policy$;
  end if;
end $$;