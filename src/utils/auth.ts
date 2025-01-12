import { User } from '@supabase/supabase-js';
import { Session } from '@supabase/supabase-js';
import { createSupabaseClient } from './supabase';

interface SignUpResponse {
  data: {
    user: User | null;
    session: Session | null;
  } | null;
  error: Error | null;
  status?: 'confirmation_sent';
}

export const signUp = async (email: string, password: string, username: string): Promise<SignUpResponse> => {
  const supabase = createSupabaseClient();
  
  try {
    // Create auth user first
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) throw signUpError;

    // Create profile immediately, using the user ID
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: data.user.id,
          username,
          updated_at: new Date().toISOString(),
        }]);

      if (profileError) {
        console.error('Profile creation failed:', profileError);
      }
    }

    return { 
      data, 
      error: null,
      status: 'confirmation_sent'
    };
  } catch (err) {
    console.error('Unexpected error during signup:', err);
    return { data: null, error: err as Error };
  }
};

interface SignInResponse {
  data: any;
  error: Error | null;
}

export const signIn = async (email: string, password: string): Promise<SignInResponse> => {
  const supabase = createSupabaseClient();
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    
    return { data, error: null };
  } catch (err) {
    console.error('Auth: Signin error:', err);
    return { data: null, error: err as Error };
  }
};

export const signOut = async () => {
  const supabase = createSupabaseClient();
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getSession = async () => {
  const supabase = createSupabaseClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
};