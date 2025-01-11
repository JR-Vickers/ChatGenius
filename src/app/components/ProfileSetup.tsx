'use client';

import { useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase';
import { User } from '@supabase/supabase-js';

export default function ProfileSetup({ user }: { user: User }) {
  const supabase = createSupabaseClient();

  useEffect(() => {
    const createProfile = async () => {
      console.log('Attempting to create profile for:', user.id); // Debug log

      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (existingProfile) {
        console.log('Profile already exists:', existingProfile);
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .insert([{
          id: user.id,
          username: user.user_metadata.username,
          updated_at: new Date().toISOString(),
        }]);

      if (error) {
        console.error('Profile creation failed:', error);
      } else {
        console.log('Profile created successfully');
      }
    };

    createProfile();
  }, [user]);

  return null;
}