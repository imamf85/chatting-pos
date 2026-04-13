import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Demo mode jika tidak ada env variables
export const isDemoMode = !supabaseUrl || !supabaseAnonKey;

// Create a dummy client for demo mode or real client for production
export const supabase: SupabaseClient = isDemoMode
  ? createClient('https://demo.supabase.co', 'demo-key')
  : createClient(supabaseUrl, supabaseAnonKey);
