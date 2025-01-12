'use client';

import { useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase';
import { User } from '@supabase/supabase-js';

export default function ProfileSetup({ user }: { user: User }) {
  const supabase = createSupabaseClient();

  useEffect(() => {
    const createProfile = async () => {
      console.log('Attempting to create profile for:', user.id); // Debug log

      // First check if profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (checkError) {
        console.error('Error checking profile:', checkError);
      }

      if (existingProfile) {
        console.log('Profile already exists:', existingProfile);
        return;
      }

      // Create new profile
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([{
          id: user.id,
          username: user.email?.split('@')[0] || 'anonymous',
          updated_at: new Date().toISOString(),
        }]);

      if (insertError) {
        console.error('Profile creation failed:', insertError);
      } else {
        console.log('Profile created successfully');
      }
    };

    createProfile();
  }, [user]);

  return null;
}