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
  console.log('Starting signup process for:', email, username);

  try {
    // Check username availability first
    console.log('Checking username availability...');
    const { data: existingUser, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Username check failed:', checkError);
      return { data: null, error: new Error('Failed to verify username availability') };
    }

    if (existingUser) {
      console.log('Username already taken:', username);
      return { data: null, error: new Error('Username already taken') };
    }

    // Create auth user
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username
        },
      },
    });

    if (signUpError) throw signUpError;

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