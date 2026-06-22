import { createClient } from '@supabase/supabase-js';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// Automatically sanitize the URL if it contains the rest/v1 suffix
if (supabaseUrl) {
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');
}

export const isSupabaseConfigured = !!(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  !import.meta.env.VITE_SUPABASE_URL.includes('placeholder-project')
);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase environment variables are missing or placeholders! Authentication will run in mock/fallback mode.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

