'use client';

import { useState } from 'react';
import { createSupabaseClient } from '@/utils/supabase';
import { useQuery } from '@tanstack/react-query';

const supabase = createSupabaseClient();

interface Props {
  onClose: () => void;
  onSelectUser: (userId: string) => Promise<void>;
}

export default function UserSearchModal({ onClose, onSelectUser }: Props) {
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: async () => {
      if (!search.trim()) return [];

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .neq('id', currentUser.id)
        .ilike('username', `%${search}%`)
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: search.length > 0
  });

  const handleSelectUser = async (userId: string) => {
    setIsSubmitting(true);
    try {
      await onSelectUser(userId);
      onClose();
    } catch (error) {
      console.error('Error creating DM:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-black border border-green-800/50 p-4 w-96">
        <h2 className="text-green-500 mb-4">[New Message]</h2>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-black border border-green-800/50 p-2 text-gray-200 mb-4"
          placeholder="Search users..."
          disabled={isSubmitting}
        />
        
        <div className="max-h-64 overflow-y-auto mb-4">
          {isLoading ? (
            <div className="text-gray-400">Searching...</div>
          ) : users.length > 0 ? (
            users.map((user) => (
              <div
                key={user.id}
                onClick={() => handleSelectUser(user.id)}
                className="cursor-pointer p-2 hover:bg-green-900/20 text-gray-300 hover:text-gray-200"
              >
                @{user.username}
              </div>
            ))
          ) : search ? (
            <div className="text-gray-400">No users found</div>
          ) : null}
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="text-green-500 hover:text-green-400"
            disabled={isSubmitting}
          >
            [Cancel]
          </button>
        </div>
      </div>
    </div>
  );
}