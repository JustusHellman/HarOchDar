
import { createClient } from '@supabase/supabase-js';

const defaultUrl = 'https://hdxpdmksegdmiwzxorbq.supabase.co';
const defaultAnonKey = 'sb_publishable_m6ZMa5Nuv_xti6VJ9fNphA_0OoAG_Qp';

const rawUrl = process.env.HERE_AND_THERE_SUPABASE_URL;
const rawKey = process.env.HERE_AND_THERE_SUPABASE_ANON_KEY;

const supabaseUrl = (rawUrl && rawUrl.trim() !== '' && !rawUrl.includes('placeholder-project')) 
  ? rawUrl 
  : defaultUrl;

const supabaseAnonKey = (rawKey && rawKey.trim() !== '' && !rawKey.includes('placeholder-anon-key')) 
  ? rawKey 
  : defaultAnonKey;

export const isSupabaseConfigured = !!(
  supabaseUrl && 
  !supabaseUrl.includes('placeholder-project') &&
  supabaseAnonKey &&
  !supabaseAnonKey.includes('placeholder-anon-key')
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Legacy helper maintained for compatibility with previous versions.
 */
export const updateSupabaseConfig = (url: string, key: string) => {
  console.warn("Supabase configuration is handled via Environment Variables (HERE_AND_THERE_SUPABASE_URL and HERE_AND_THERE_SUPABASE_ANON_KEY).");
};

