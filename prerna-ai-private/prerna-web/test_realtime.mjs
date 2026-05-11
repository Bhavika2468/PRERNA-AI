import { createClient } from '@insforge/sdk';

const client = createClient({
  baseUrl: 'https://c8kd4983.us-east.insforge.app',
  anonKey: 'ik_df331b0b56cf128dd6515e7c3b714b59'
});

try {
    client.realtime.on('postgres_changes', (payload) => {
        console.log("Payload:", payload);
    });
    client.realtime.subscribe('scholarships');
    console.log("Subscribed successfully");
    setTimeout(() => process.exit(0), 1000);
} catch(err) {
    console.error("Error:", err);
}
