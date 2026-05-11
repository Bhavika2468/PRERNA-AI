import { createClient } from '@insforge/sdk';

const client = createClient({
  baseUrl: 'https://c8kd4983.us-east.insforge.app',
  anonKey: 'ik_df331b0b56cf128dd6515e7c3b714b59'
});

const models = [
    'openai/gpt-4o-mini',
    'gpt-4o-mini',
    'GPT-4o-Mini',
    'gpt4o-mini',
    'gpt-4-mini'
];

async function testModels() {
    for (const model of models) {
        try {
            console.log(`Trying ${model}...`);
            const res = await client.ai.chat.completions.create({
                model: model,
                messages: [{ role: 'user', content: 'Say hi' }]
            });
            console.log(`✅ Success with ${model}`);
            return;
        } catch(err) {
            console.log(`❌ Failed with ${model}: ${err.message}`);
        }
    }
}

testModels();
