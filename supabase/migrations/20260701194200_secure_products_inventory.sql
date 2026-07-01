-- Enable RLS on products, product_stock_events, and order_inventory_reservations
alter table public.products enable row level security;
alter table public.product_stock_events enable row level security;
alter table public.order_inventory_reservations enable row level security;

-- Products need to be readable by the public (anyone can view products on the store)
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select using (true);

-- We do NOT need to create 'admin' policies using (true) because the backend
-- service_role key automatically bypasses RLS for inserts/updates/deletes.
-- Creating 'using (true)' policies for writes would make them publicly editable.
-- 
-- For product_stock_events and order_inventory_reservations, since we want them 
-- to be restricted to the backend (service_role) only, we don't create ANY policies.
-- They will be completely hidden from the public anon/authenticated keys.
