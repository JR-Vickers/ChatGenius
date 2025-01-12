import { createClient } from '@supabase/supabase-js'

let supabaseInstance: any = null;

export const createSupabaseClient = () => {
  if (supabaseInstance) return supabaseInstance;
  
  supabaseInstance = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  return supabaseInstance;
};