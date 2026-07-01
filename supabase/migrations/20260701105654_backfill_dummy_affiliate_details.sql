update public.affiliate_coupons
set 
  email = 'dummy.affiliate@advayacare.com',
  phone = '+919999999999',
  social_links = 'instagram.com/dummyaffiliate',
  reason = 'I love the products and have a large audience to share them with!'
where affiliate_name = 'Test Dummy Affiliate' and email is null;
