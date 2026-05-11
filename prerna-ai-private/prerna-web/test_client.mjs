import { createClient } from '@insforge/sdk';

const client = createClient({
  baseUrl: 'https://c8kd4983.us-east.insforge.app',
  anonKey: 'ik_df331b0b56cf128dd6515e7c3b714b59'
});

const proto = Object.getPrototypeOf(client.realtime);
console.log("Realtime prototype:", Object.getOwnPropertyNames(proto));
if (client.realtime.channel) console.log("Has channel");
if (client.realtime.subscribe) console.log("Has subscribe");
if (client.channel) console.log("Client has channel");
