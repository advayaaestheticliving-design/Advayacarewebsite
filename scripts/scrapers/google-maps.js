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
      try {
        const phoneEl = await page.$('button[data-item-id^="phone:"]');
        if (phoneEl) {
           const phoneText = await phoneEl.getAttribute('aria-label');
           if (phoneText) {
             phone = phoneText.replace(/Phone:?/i, '').trim();
           }
        }
      } catch (e) {
        console.log(`Could not extract phone for ${name}`);
      }

      leads.push({
        business_name: name,
        city: location,
        stage: 'new',
        source: 'google_maps',
        created_at: new Date().toISOString(),
        _phone: phone
      });
    }

    if (leads.length > 0) {
      console.log(`Inserting ${leads.length} leads to Supabase...`);
      
      let insertedCount = 0;
      for (const lead of leads) {
        const phone = lead._phone;
        delete lead._phone; // Remove before inserting into b2b_accounts

        const { data: account, error } = await supabase.from('b2b_accounts').insert(lead).select().single();
        if (error) {
          if (error.code === '23505') {
             console.log(`Skipping duplicate lead: ${lead.business_name}`);
          } else {
             console.error(`Error inserting ${lead.business_name}:`, error);
          }
        } else if (account) {
          // Insert contact with scraped phone number
          await supabase.from('b2b_contacts').insert({
            account_id: account.id,
            full_name: 'Manager',
            job_title: 'Manager',
            phone: phone || '',
            whatsapp_phone: phone || '',
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
