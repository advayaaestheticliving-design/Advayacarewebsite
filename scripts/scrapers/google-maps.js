const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const keyword = process.env.KEYWORD || 'Spa';
const location = process.env.LOCATION || 'Bangalore, Karnataka';
const query = `${keyword} in ${location}`;

async function run() {
  console.log(`Starting Google Maps scraper for: ${query}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`);
    await page.waitForTimeout(5000); // Wait for initial load

    // Basic logic to extract visible places on the first page
    // Note: Google Maps DOM changes frequently. This is a basic robust selector pattern.
    const elements = await page.$$('.hfpxzc');
    console.log(`Found ${elements.length} places. Extracting details...`);

    const leads = [];
    for (let i = 0; i < Math.min(elements.length, 5); i++) { // Limit to 5 for now
      const el = elements[i];
      const name = await el.getAttribute('aria-label') || 'Unknown';
      if (name === 'Unknown') continue;
      
      console.log(`Extracting details for: ${name}`);
      
      // Click to open sidebar
      await el.click();
      await page.waitForTimeout(2500); // Wait for details to populate

      let phone = '';
      let address = '';
      let website = '';
      let email = '';

      try {
        // Extract phone
        const phoneEl = await page.$('button[data-item-id^="phone:"]');
        if (phoneEl) {
           const phoneText = await phoneEl.getAttribute('aria-label');
           if (phoneText) phone = phoneText.replace(/Phone:?/i, '').trim();
        }

        // Extract address
        const addressEl = await page.$('button[data-item-id="address"]');
        if (addressEl) {
           const addressText = await addressEl.getAttribute('aria-label');
           if (addressText) address = addressText.replace(/Address:?/i, '').trim();
        }

        // Extract website
        const websiteEl = await page.$('a[data-item-id="authority"]');
        if (websiteEl) {
           const url = await websiteEl.getAttribute('href');
           if (url) website = url;
        }
      } catch (e) {
        console.log(`Could not extract basic details for ${name}`);
      }

      // Try to find an email if we have a website
      if (website) {
        console.log(`Scraping website for email: ${website}`);
        const newPage = await context.newPage();
        try {
          await newPage.goto(website, { timeout: 10000, waitUntil: 'domcontentloaded' });
          
          // Strategy 1: Check for mailto links
          const mailto = await newPage.$eval('a[href^="mailto:"]', el => el.href).catch(() => null);
          if (mailto) {
            email = mailto.replace('mailto:', '').split('?')[0].trim();
          } else {
            // Strategy 2: Regex on body text
            const bodyText = await newPage.locator('body').innerText({ timeout: 2000 }).catch(() => '');
            const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
            const matches = bodyText.match(emailRegex);
            if (matches && matches.length > 0) {
              email = matches[0].trim();
            }
          }
        } catch (e) {
          console.log(`Failed to scrape email from website for ${name}`);
        } finally {
          await newPage.close();
        }
      }

      leads.push({
        business_name: name,
        city: location,
        address: address || '',
        website_url: website || '',
        stage: 'new',
        source: 'google_maps',
        created_at: new Date().toISOString(),
        _phone: phone,
        _email: email
      });
    }

    if (leads.length > 0) {
      console.log(`Inserting ${leads.length} leads to Supabase...`);
      
      let insertedCount = 0;
      for (const lead of leads) {
        const phone = lead._phone;
        const email = lead._email;
        delete lead._phone; // Remove before inserting into b2b_accounts
        delete lead._email;

        const { data: account, error } = await supabase.from('b2b_accounts').insert(lead).select().single();
        if (error) {
          if (error.code === '23505') {
             console.log(`Skipping duplicate lead: ${lead.business_name}`);
          } else {
             console.error(`Error inserting ${lead.business_name}:`, error);
          }
        } else if (account) {
          // Insert contact with scraped phone number and email
          await supabase.from('b2b_contacts').insert({
            account_id: account.id,
            full_name: 'Manager',
            job_title: 'Manager',
            phone: phone || '',
            whatsapp_phone: phone || '',
            email: email || '',
            is_primary: true
          });
          insertedCount++;
        }
      }
      console.log(`Successfully inserted new leads: ${insertedCount}`);
    } else {
      console.log("No leads found.");
    }

  } catch (error) {
    console.error("Scraping error:", error);
  } finally {
    await browser.close();
  }
}

run();
