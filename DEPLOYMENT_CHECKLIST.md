# Deployment Checklist - Supabase + Razorpay

## Pre-Deployment ✅

- [x] Code implemented and tested
- [x] React build successful (no errors)
- [x] Payment flow documented
- [x] Security measures in place
- [x] Database schema ready

## Immediate Actions (Do This First)

### 0. Deploy Wallet + Coupon System (NEW)
```bash
# Link project once (if not already linked)
supabase login
supabase link --project-ref <your-project-ref>

# Apply latest DB migrations (includes wallet tables + order discount metadata)
supabase db push

# Deploy wallet-related functions
supabase functions deploy issue-signup-coupon
supabase functions deploy validate-discounts

# Redeploy payment functions (verify now settles coupons/gift cards and mints purchased gift cards)
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
```
- [ ] Wallet migration deployed
- [ ] `issue-signup-coupon` deployed
- [ ] `validate-discounts` deployed
- [ ] Payment functions redeployed
- [ ] Wallet smoke tests completed (`WALLET_COUPON_ROLLOUT.md`)

### 1. Add Razorpay Secrets to Supabase (5 min)
- [ ] Go to https://supabase.com/dashboard
- [ ] Select your project
- [ ] Navigate to **Settings > Secrets**
- [ ] Create secret: `RAZORPAY_KEY_ID` = your_key_id
- [ ] Create secret: `RAZORPAY_KEY_SECRET` = your_key_secret
- [ ] Ensure secret: `SUPABASE_URL`
- [ ] Ensure secret: `SUPABASE_ANON_KEY`
- [ ] Ensure secret: `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Click Save

### 2. Deploy Supabase Edge Functions (5 min)
```bash
# Terminal
npm install -g supabase
supabase login
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
```
- [ ] Check both functions deployed successfully

### 3. Test Locally (15 min)
```bash
npm run dev
```
- [ ] Open http://localhost:5173
- [ ] Add products to cart
- [ ] Go to checkout
- [ ] Fill customer details
- [ ] Click "Proceed to Checkout"
- [ ] Click "Pay Now"
- [ ] Use test card: 4111 1111 1111 1111
- [ ] Verify success message
- [ ] Check Supabase dashboard for order

### 4. Push to GitHub (2 min)
```bash
git add .
git commit -m "Complete Supabase + Razorpay payment integration"
git push origin main
```
- [ ] Code pushed successfully

### 5. Switch Razorpay to Live (1 min)
- [ ] Go to https://dashboard.razorpay.com
- [ ] Settings > Account & Billing
- [ ] Switch to live mode
- [ ] Update VITE_RAZORPAY_KEY_ID in `.env.local` with live key
- [ ] Redeploy if necessary

## Verification Steps

### Check Frontend Build
```bash
npm run build
```
Expected output: ✓ built successfully

### Check Edge Functions Deployed
```bash
supabase functions list
```
Expected output: Both functions listed as deployed

### Test Payment Flow
1. Visit your live site
2. Add products to cart
3. Test payment with real or test card
4. Check Supabase orders table
5. Verify payment in Razorpay dashboard

### Monitor Logs
- **Supabase**: Dashboard > Edge Functions > Logs
- **Razorpay**: Dashboard > Payments
- **Browser**: DevTools > Console (check for errors)

## Production Checklist

- [ ] All secrets added to Supabase
- [ ] Edge Functions deployed
- [ ] Local test successful
- [ ] Code pushed to GitHub
- [ ] Razorpay in live mode
- [ ] Live site tested with payment
- [ ] Order appears in Supabase
- [ ] Payment appears in Razorpay dashboard
- [ ] Customer receives confirmation
- [ ] Analytics tracking working

## Rollback Plan (If Needed)

If issues occur:

1. **Disable payments** (temporary):
   - Remove Cart checkout button (quick fix)
   - Or set Razorpay to test mode

2. **Check logs**:
   - Supabase Edge Functions logs
   - Browser console
   - Razorpay dashboard

3. **Verify database**:
   ```sql
   SELECT * FROM orders ORDER BY created_at DESC LIMIT 5;
   ```

4. **Redeploy functions**:
   ```bash
   supabase functions deploy create-razorpay-order --no-verify-jwt
   supabase functions deploy verify-razorpay-payment --no-verify-jwt
   ```

## Support Contacts

- **Razorpay Issues**: https://razorpay.com/support
- **Supabase Issues**: https://supabase.com/support
- **GitHub Issues**: GitHub repository issues

## Post-Deployment

### Day 1
- Monitor all test payments
- Check Supabase logs for errors
- Verify email notifications (if set up)
- Monitor Razorpay dashboard

### Week 1
- Verify all payments processed correctly
- Check customer feedback
- Monitor payment failure rates
- Review analytics

### Ongoing
- Set up payment alerts
- Monitor transaction volumes
- Check for fraud/chargebacks
- Update documentation

## Success Indicators

✅ Payment modal appears on checkout
✅ Test payment completes successfully
✅ Order created in Supabase
✅ Order status changes to "paid"
✅ Payment visible in Razorpay
✅ Customer email sent (if configured)
✅ No console errors
✅ Edge Function logs show success

## Quick Reference

| Component | Location | Status |
|-----------|----------|--------|
| Frontend Code | `src/` | ✅ Ready |
| Payment Modal | `src/components/RazorpayCheckout.jsx` | ✅ Ready |
| Payment Service | `src/lib/razorpayApi.js` | ✅ Ready |
| Create Order Function | `supabase/functions/create-razorpay-order/` | ✅ Ready |
| Verify Payment Function | `supabase/functions/verify-razorpay-payment/` | ✅ Ready |
| Database | Supabase PostgreSQL | ✅ Ready |
| Frontend Config | `.env.local` | ✅ Configured |
| Backend Secrets | Supabase Secrets | ⏳ Pending Setup |
| Documentation | `SUPABASE_RAZORPAY_GUIDE.md` | ✅ Complete |

## Deployment Order

1. ✅ Code implemented
2. ⏳ Add Supabase secrets (DO THIS)
3. ⏳ Deploy Edge Functions (DO THIS)
4. ⏳ Test locally
5. ⏳ Push to GitHub
6. ⏳ Switch Razorpay to live
7. ⏳ Monitor production

---

**Status**: Ready to deploy! Follow the "Immediate Actions" section above.

See `SUPABASE_RAZORPAY_GUIDE.md` for detailed setup instructions.
