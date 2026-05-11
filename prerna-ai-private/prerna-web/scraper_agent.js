import { createClient } from '@insforge/sdk';

const client = createClient({
  baseUrl: 'https://c8kd4983.us-east.insforge.app',
  anonKey: 'ik_df331b0b56cf128dd6515e7c3b714b59'
});

async function scrapeScholarships() {
    console.log("🤖 Agent: Starting Autonomous Web Research for Scholarships...");
    
    // Simulate scraped data
    const simulated_data = [
        {
            name: "AICTE Pragati Scholarship for Girls",
            deadline: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
            eligibility: "Girls taking admission in AICTE approved Technical Institution for Degree/Diploma.",
            link: "https://scholarships.gov.in/",
            source: "AICTE"
        },
        {
            name: "Reliance Foundation Undergraduate Scholarship",
            deadline: new Date(Date.now() + 15*24*60*60*1000).toISOString().split('T')[0],
            eligibility: "First year undergraduate students with family income < 15 Lakhs.",
            link: "https://scholarships.reliancefoundation.org/",
            source: "Reliance Foundation"
        }
    ];
    
    console.log(`✅ Agent: Found ${simulated_data.length} scholarships. Inserting into InsForge Database...`);
    
    console.log("Client keys:", Object.keys(client));
    const { data, error } = await client.database.from('scholarships').insert(simulated_data).select();
    
    if (error) {
        console.error("❌ Error inserting data:", error);
    } else {
        console.log("🎉 Successfully inserted data into InsForge!");
        data.forEach(item => {
            console.log(` - ${item.name}`);
        });
    }
}

scrapeScholarships();
