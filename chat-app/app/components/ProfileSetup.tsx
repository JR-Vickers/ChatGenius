'use client';

import { useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase';
import { User } from '@supabase/supabase-js';

export default function ProfileSetup({ user }: { user: User }) {
  const supabase = createSupabaseClient();
  console.log('ProfileSetup: Component mounted for user:', user.id);

  useEffect(() => {
    const createProfile = async () => {
      console.log('ProfileSetup: Starting profile creation for:', user.id);

      try {
        // First check if profile exists
        const { data: existingProfile, error: checkError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        console.log('ProfileSetup: Check result:', { existingProfile, checkError });

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('ProfileSetup: Error checking profile:', checkError);
          return;
        }

        if (existingProfile) {
          console.log('ProfileSetup: Profile already exists:', existingProfile);
          return;
        }

        console.log('ProfileSetup: Creating new profile...');
        // Create new profile
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{
            id: user.id,
            username: user.email?.split('@')[0] || 'anonymous',
            updated_at: new Date().toISOString(),
          }]);

        if (insertError) {
          console.error('ProfileSetup: Profile creation failed:', insertError);
        } else {
          console.log('ProfileSetup: Profile created successfully');
        }
      } catch (error) {
        console.error('ProfileSetup: Unexpected error:', error);
      }
    };

    createProfile();
  }, [user]);

  return null;
}