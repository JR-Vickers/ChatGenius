'use client';

import { useState } from 'react';
import { createSupabaseClient } from '@/utils/supabase';

const supabase = createSupabaseClient();

interface UsernameSetupProps {
  user: any;
  onComplete: () => void;
}

const UsernameSetup = ({ user, onComplete }: UsernameSetupProps) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!username.trim()) {
        setError('Username cannot be empty');
        setLoading(false);
        return;
      }

    // Insert the profile
    const { error: insertError } = await supabase
      .from('profiles')
      .insert(({
        id: user.id,
        username: username.trim(),
        updated_at: new Date().toISOString(),
      }))
      .select()
      .single();

    if (insertError) {
      console.error('Error saving username:', insertError);
      setError(insertError.message);
      setLoading(false);
      return;
    }

    onComplete();
  } catch (err) {
    console.error('Unexpected error:', err);
    setError('An unexpected error occurred');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-black border border-green-800/50 p-4 max-w-md w-full font-mono">
        <h2 className="text-green-500 text-lg mb-4">[Set Username]</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-black border border-green-800/50 p-2 text-gray-200 mb-4"
            placeholder="Enter username..."
          />
          {error && <div className="text-red-500 mb-4">{error}</div>}
          <button
            type="submit"
            className="bg-green-900/30 text-gray-200 px-4 py-2 hover:bg-green-800/40"
          >
            [Save]
          </button>
        </form>
      </div>
    </div>
  );
};

export default UsernameSetup;