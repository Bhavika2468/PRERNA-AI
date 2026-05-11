import { createClient } from '@insforge/sdk';

console.log("🤖 Local Discovery Agent Started!");
console.log("I will search for new scholarships and update your database.");

// Initialize DB Client using the standard client setup
const insforgeClient = createClient({
  baseUrl: 'https://c8kd4983.us-east.insforge.app',
  anonKey: 'ik_df331b0b56cf128dd6515e7c3b714b59'
});

async function runDiscovery() {
    console.log(`\n[${new Date().toLocaleTimeString()}] Running discovery simulation...`);
    
    // Simulate finding new scholarships
    const mockDiscoveredScholarships = [
        {
            name: "TATA CSR Tech Grant (Simulated)",
            deadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
            eligibility: "Targeted at rural girls entering technical programs. Resume and interview required.",
            link: "https://www.tata.com/csr/education",
            source: "Tata Foundation"
        },
        {
            name: "Digital India Last-Mile Fund",
            deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
            eligibility: "Open to 12th standard students for digital education. Written test required.",
            link: "https://digitalindia.gov.in",
            source: "Government of India"
        }
    ];

    try {
        console.log("Inserting discovered scholarships into database...");
        
        // Batch Insert into Database
        const { data, error } = await insforgeClient
            .database.from('scholarships')
            .insert(mockDiscoveredScholarships)
            .select();

        if (error) throw error;
        
        console.log(`✅ Success! Inserted ${data.length} new scholarships.`);
        console.log("Check your browser - the Scholarships page should update instantly without refreshing!");
        
    } catch (err) {
        console.error("❌ Discovery Failed:", err.message || err);
    }
}

// Run immediately once
runDiscovery();

// Then run every 60 minutes
// 60 minutes * 60 seconds * 1000 milliseconds
const ONE_HOUR = 60 * 60 * 1000;
setInterval(runDiscovery, ONE_HOUR);

console.log("Listening in background... (Press Ctrl+C to stop)");
