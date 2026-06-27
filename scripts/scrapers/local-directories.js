const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const keyword = process.env.KEYWORD || 'Spa';
const location = process.env.LOCATION || 'Bangalore';

async function run() {
  console.log(`Starting Local Directory scraper for: ${keyword} in ${location}`);
  
  try {
    // Note: We use a placeholder URL here. 
    // In production, this would be the actual directory URL structure.
    // Example: const url = `https://www.justdial.com/${location}/${keyword}`;
    // Because those sites have strict bot protection, this is a simplified structure
    // meant to be run in GitHub Actions where IP rotation is sometimes necessary.

    // Mocking the fetch for structural demonstration
    // const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 ...' } });
    // const html = await response.text();
    // const $ = cheerio.load(html);

    console.log("Fetching directory listings...");
    
    // MOCK DATA for demonstration purposes (replace with actual cheerio parsing)
    // Example parsing logic:
    // const leads = [];
    // $('.result-box').each((i, el) => {
    //   leads.push({
    //     business_name: $(el).find('.title').text().trim(),
    //     city: location,
    //     ...
    //   })
    // });
    
    const leads = [
      {
        business_name: `Directory Mock Spa 1 - ${location}`,
        city: location,
        stage: 'new',
        source: 'local_directory',
        created_at: new Date().toISOString()
      },
      {
        business_name: `Directory Mock Salon 2 - ${location}`,
        city: location,
        stage: 'new',
        source: 'local_directory',
        created_at: new Date().toISOString()
      }
    ];

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
  }
}

run();
