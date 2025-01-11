'use client';

import { useState } from 'react';
import { signIn, signUp } from '@/utils/auth';
import { AuthError } from '@supabase/supabase-js';

const AuthForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    console.log('Starting signup submission...');

    const { error, status, data } = await signUp(email, password, username);
    
    console.log('Signup response:', { error, status, data });
    
    if (error) {
      console.error('Signup error:', error);
      setError(error.message);
      return;
    }

    if (status === 'confirmation_sent') {
      console.log('Confirmation email sent');
      setConfirmationSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black font-mono">
      <div className="bg-black border border-green-800/50 p-8 w-96">
        <h2 className="text-green-500 text-lg mb-6">
          [{isLogin ? 'Login' : 'Sign Up'}]
        </h2>
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="mb-4">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full bg-black border border-green-800/50 p-2 text-gray-200"
                required={!isLogin}
              />
            </div>
          )}
          <div className="mb-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-black border border-green-800/50 p-2 text-gray-200"
              required
            />
          </div>
          <div className="mb-6">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-black border border-green-800/50 p-2 text-gray-200"
              required
            />
          </div>
          {error && (
            <div className="text-red-500 mb-4 text-sm">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-900/30 text-gray-200 p-2 hover:bg-green-800/40 disabled:opacity-50"
          >
            [{loading ? '...' : isLogin ? 'Login' : 'Sign Up'}]
          </button>
        </form>
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="w-full mt-4 text-green-500 hover:text-green-400"
        >
          [{isLogin ? 'Need an account? Sign up' : 'Have an account? Login'}]
        </button>
      </div>
    </div>
  );
};

export default AuthForm;