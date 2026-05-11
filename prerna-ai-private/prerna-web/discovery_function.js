import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@insforge/sdk@latest'

// This is an InsForge Serverless Function designed to be triggered
// by a cron job (e.g. every 1 hour) to run the Discovery Loop.

serve(async (req) => {
    try {
        console.log("Starting 1-Hour Scholarship Discovery Loop...");
        
        // 1. Initialize DB Client (using Service Role Key to bypass RLS)
        const insforgeClient = createClient(
            Deno.env.get('SUPABASE_URL') || Deno.env.get('INSFORGE_URL'),
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('INSFORGE_SERVICE_ROLE_KEY')
        );

        // 2. Simulate Claw Code Query Engine (web_search)
        // Since we can't run native Rust (web_search.rs) inside a standard V8 isolate easily,
        // we simulate the search payload here. In production, this could make an HTTP call
        // to your rust-based API scraper.
        console.log("Calling web_search simulation...");
        
        const mockDiscoveredScholarships = [
            {
                name: "TATA CSR Tech Grant (Simulated)",
                deadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(), // 12 days
                eligibility: "Targeted at rural girls entering technical programs. Resume and interview required.",
                link: "https://www.tata.com/csr/education",
                source: "Tata Foundation"
            },
            {
                name: "Digital India Last-Mile Fund",
                deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day
                eligibility: "Open to 12th standard students for digital education. Written test required.",
                link: "https://digitalindia.gov.in",
                source: "Government of India"
            }
        ];

        // 3. Batch Insert into Database
        // This will automatically trigger Realtime events on the frontend!
        const { data, error } = await insforgeClient
            .from('scholarships')
            .insert(mockDiscoveredScholarships)
            .select();

        if (error) throw error;

        return new Response(
            JSON.stringify({ 
                success: true, 
                message: `Discovered and inserted ${data.length} new scholarships. Realtime UI updated!`,
                data 
            }),
            { headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error("Discovery Loop Failed:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
});
