ALTER TABLE public.products ADD COLUMN IF NOT EXISTS compare_at_price numeric(10,2) DEFAULT 0;
