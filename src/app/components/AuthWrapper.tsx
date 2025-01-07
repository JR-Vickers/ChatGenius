'use client';

import { useEffect, useState } from 'react';
import ChatInterface from './ChatInterface';
import AuthForm from './AuthForm';
import { getSession } from '@/utils/auth';
import { createSupabaseClient } from '@/utils/supabase';

const supabase = createSupabaseClient();

export default function AuthWrapper() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
        data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
    });

    return () => {
        subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return session ? <ChatInterface /> : <AuthForm />;
}