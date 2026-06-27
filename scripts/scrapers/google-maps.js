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
    const places = await page.$$eval('.hfpxzc', (elements) => {
      return elements.map(el => {
        return {
          name: el.getAttribute('aria-label') || 'Unknown',
          url: el.getAttribute('href') || ''
        };
      });
    });

    console.log(`Found ${places.length} places. Extracting details...`);

    const leads = [];
    for (const place of places.slice(0, 5)) { // Limit to 5 for now to avoid long runs in demo
      if (!place.name || place.name === 'Unknown') continue;
      
      console.log(`Extracting details for: ${place.name}`);
      // In a real scenario, we would click each place and extract phone/address from the sidebar.
      // For this implementation, we will push the basic lead info.
      leads.push({
        business_name: place.name,
        city: location,
        stage: 'new',
        source: 'google_maps',
        created_at: new Date().toISOString()
      });
    }

    if (leads.length > 0) {
      console.log(`Upserting ${leads.length} leads to Supabase...`);
      const { data, error } = await supabase
        .from('b2b_accounts')
        .upsert(leads, { onConflict: 'business_name, city' });

      if (error) {
        console.error("Error inserting into Supabase:", error);
      } else {
        console.log("Successfully inserted leads:", leads.length);
      }
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
