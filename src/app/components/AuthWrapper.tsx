'use client';

import { useEffect, useState } from 'react';
import ChatInterface from './ChatInterface';
import AuthForm from './AuthForm';
import { createSupabaseClient } from '@/utils/supabase';
import { Session } from '@supabase/supabase-js';
import ProfileSetup from './ProfileSetup';

const supabase = createSupabaseClient();

export default function AuthWrapper() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthWrapper: Initializing...');
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('AuthWrapper: Got session:', session?.user?.id);
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('AuthWrapper: Auth state changed:', _event, session?.user?.id);
      setSession(session);
    });

    return () => {
      console.log('AuthWrapper: Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return session ? (
    <>
      <ProfileSetup user={session.user} />
      <ChatInterface />
    </>
  ) : (
    <AuthForm />
  );
}