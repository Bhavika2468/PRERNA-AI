import { createClient } from '@insforge/sdk';

const client = createClient({
  baseUrl: 'https://c8kd4983.us-east.insforge.app',
  anonKey: 'ik_df331b0b56cf128dd6515e7c3b714b59'
});

async function run() {
    console.log("Fetching scholarships...");
    const { data, error } = await client.database.from('scholarships').select();
    if (error) console.error("Error:", error);
    else console.log("Data:", JSON.stringify(data, null, 2));
}

run();
