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
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    extraHTTPHeaders: {
      'accept-language': 'en-US,en;q=0.9',
    }
  });
  
  const page = await context.newPage();

  try {
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });
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
      
      // Explicitly wait for the side panel header (which contains the business name as an h1)
      try {
        await page.waitForSelector('h1', { timeout: 10000 });
      } catch (e) {
        console.log(`Sidebar did not load within 10s for ${name}`);
      }

      await page.waitForTimeout(2000); // give it a little more time to render buttons

      let phone = '';
      let address = '';
      let website = '';
      let email = '';

      try {
        // Extract using aria-labels which is much more robust against DOM structure changes
        const buttons = await page.$$('button');
        for (const btn of buttons) {
            const aria = await btn.getAttribute('aria-label') || '';
            if (aria.includes('Phone:')) phone = aria.replace('Phone:', '').trim();
            if (aria.includes('Address:')) address = aria.replace('Address:', '').trim();
        }
        const links = await page.$$('a');
        for (const link of links) {
            const aria = await link.getAttribute('aria-label') || '';
            if (aria.includes('Website:')) {
               const url = await link.getAttribute('href');
               if (url) website = url;
            }
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
