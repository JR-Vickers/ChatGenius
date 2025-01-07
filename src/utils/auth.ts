import { createSupabaseClient } from './supabase';

export const signUp = async (email: string, password: string, username: string) => {
  const supabase = createSupabaseClient();

  try {
    const { data: existingUser, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Username check failed:', checkError);
      return { error: new Error('Failed to verify username availability') };
    }

    if (existingUser) {
      return { error: new Error('Username already taken') };
    }

  // Create auth user
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username // Store username in auth metadata
        },
      },
    });

    if (signUpError) {
      console.error('Signup failed:', signUpError);
      return { error: signUpError };
    }

    if (!data.user) {
      return { error: new Error('No user data returned') };
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{
        id: data.user.id,
        username,
        updated_at: new Date().toISOString(),
      }]);

    if (profileError) {
      console.error('Profile creation failed:', profileError);
      return { error: profileError };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Unexpected error during signup:', err);
    return { error: new Error('Failed to complete signup') };
  }
};

export const signIn = async (email: string, password: string) => {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
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