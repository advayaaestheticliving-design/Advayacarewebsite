-- Seed dummy affiliate and orders for testing
do $$
declare
  v_coupon_id uuid := gen_random_uuid();
  v_order1_id uuid := gen_random_uuid();
  v_order2_id uuid := gen_random_uuid();
  v_order3_id uuid := gen_random_uuid();
begin
  -- 1. Create a general coupon for the dummy affiliate
  insert into public.general_coupons (id, code, description, discount_type, percentage_discount, is_active, all_orders, require_membership)
  values (v_coupon_id, 'TESTAFFILIATE10', 'Dummy affiliate coupon', 'percentage', 10, true, true, false);

  -- 2. Create the affiliate_coupons record
  insert into public.affiliate_coupons (coupon_id, affiliate_name, commission_type, commission_rate)
  values (v_coupon_id, 'Test Dummy Affiliate', 'percentage', 15);

  insert into public.orders (id, amount, status, customer_email, customer_phone)
  values 
    (v_order1_id, 2500.00, 'paid', 'customer1@example.com', '+919999999991'),
    (v_order2_id, 5000.00, 'paid', 'customer2@example.com', '+919999999992'),
    (v_order3_id, 1200.00, 'paid', 'customer3@example.com', '+919999999993');

  -- 4. Insert dummy coupon usages linking the orders to the coupon
  insert into public.general_coupon_usages (coupon_id, coupon_code, order_id, discount_amount_inr, used_at, is_affiliate_paid)
  values
    (v_coupon_id, 'TESTAFFILIATE10', v_order1_id, 250.00, now() - interval '5 days', true), -- Paid one
    (v_coupon_id, 'TESTAFFILIATE10', v_order2_id, 500.00, now() - interval '2 days', false), -- Unpaid
    (v_coupon_id, 'TESTAFFILIATE10', v_order3_id, 120.00, now() - interval '1 day', false); -- Unpaid

  -- Update paid timestamp for the paid one
  update public.general_coupon_usages
  set affiliate_paid_at = now() - interval '1 day'
  where order_id = v_order1_id;

end;
$$;
