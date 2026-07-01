ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_percentage numeric(5,2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT 0;
