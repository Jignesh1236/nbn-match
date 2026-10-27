import { createClient } from '@supabase/supabase-js';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : process.env;
const supabaseUrl = env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
