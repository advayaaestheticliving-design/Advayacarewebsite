# Gift Card + Coupon Rollout (Supabase)

This runbook deploys the new wallet system end-to-end:
- `member_coupons`, `coupon_redemptions`, `gift_cards`, `gift_card_transactions`
- order discount metadata columns
- `issue-signup-coupon` edge function
- `validate-discounts` edge function
- updated `verify-razorpay-payment` edge function behavior

## 0) Prerequisites

```bash
# from repo root
cd d:\GitHub\repo\advayacarewebsite

# install/update Supabase CLI (if needed)
npm install -g supabase
supabase --version
```

If your project is not linked yet:

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

## 1) Set required secrets

Set (or re-set) all required secrets before deploying functions:

```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxxxxxx
supabase secrets set RAZORPAY_KEY_SECRET=xxxxxxxx
supabase secrets set SUPABASE_URL=https://<your-project-ref>.supabase.co
supabase secrets set SUPABASE_ANON_KEY=<your-anon-key>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

## 2) Deploy database migration

```bash
supabase db push
```

Migration included in this release:
- `supabase/migrations/20260218_gift_cards_and_member_coupons.sql`

## 3) Deploy edge functions

```bash
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
supabase functions deploy issue-signup-coupon
supabase functions deploy validate-discounts
```

Optional verification:

```bash
supabase functions list
```

## 4) Smoke test checklist

1. Sign up a **new** member account from `/membership`.
2. Go to `/account` and verify one active `₹100` member coupon exists with ~30-day expiry.
3. Add products to cart; apply coupon and verify status = `applied`.
4. Buy a gift card from `/gift-card` and complete payment.
5. Reopen `/account` and confirm issued gift card appears with `active` status and full balance.
6. Use gift card code in cart; verify discount is applied and status shown.
7. Complete payment and verify:
   - gift card balance debits correctly
   - coupon transitions to `consumed` after use

## 5) SQL verification queries

```sql
-- latest coupons
select code, amount_inr, status, expires_at, issued_at, consumed_at
from public.member_coupons
order by issued_at desc
limit 20;

-- coupon redemptions
select code, amount_inr, redeemed_at, order_id
from public.coupon_redemptions
order by redeemed_at desc
limit 20;

-- gift cards
select code, initial_amount_inr, balance_amount_inr, status, purchased_order_id, created_at
from public.gift_cards
order by created_at desc
limit 20;

-- gift card transactions
select gift_card_id, tx_type, amount_inr, balance_after_inr, order_id, created_at
from public.gift_card_transactions
order by created_at desc
limit 50;

-- discount snapshots on orders
select id, status, amount, coupon_code, gift_card_code, coupon_amount_inr, gift_card_amount_inr, discount_total_inr, paid_at
from public.orders
order by created_at desc
limit 20;
```

## 6) Rollback path (fast)

If wallet behavior needs temporary rollback:

```bash
# deploy prior stable verify behavior from your previous commit if needed
# example flow:
# git checkout <stable-commit> -- supabase/functions/verify-razorpay-payment/index.ts
# supabase functions deploy verify-razorpay-payment
```

Frontend fallback (temporary): hide coupon/gift card input blocks in cart and keep checkout open.

## 7) Production release order

1. Push code to `main`
2. `supabase db push`
3. Deploy 4 functions
4. Run smoke tests
5. Announce wallet/coupon feature live
