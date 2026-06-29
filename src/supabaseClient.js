import { createClient } from '@supabase/supabase-js';

// TODO: Replace with your Supabase project URL and anon key.
// These should ideally be stored in .env files (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return (
    url && 
    url !== 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co' && 
    url.startsWith('http') &&
    key &&
    key !== 'YOUR_SUPABASE_ANON_KEY'
  );
};
