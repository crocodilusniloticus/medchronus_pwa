// js/supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// REPLACE THESE WITH YOUR ACTUAL SUPABASE KEYS
const SUPABASE_URL = 'https://mvioxpxejmybftajmllm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zF9qnDh8Q-A2xBrLzjcRSA_ZNMXBbJm';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false // Electron handles this differently
    }
});