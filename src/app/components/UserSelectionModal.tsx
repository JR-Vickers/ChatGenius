'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase';

const supabase = createSupabaseClient();

interface Props {
  onClose: () => void;
  onUserSelected: (userId: string) => void;
}

export default function UserSelectionModal({ onClose, onUserSelected }: Props) {
  const [users, setUsers] = useState<Array<{ id: string; username: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Load users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .neq('id', user?.id);
      
      setUsers(data || []);
      setLoading(false);
    };
    
    fetchUsers();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-4 rounded-lg w-96">
        <h2 className="text-green-500 text-lg mb-4">Select User</h2>
        {loading ? (
          <div>Loading users...</div>
        ) : (
          <div className="space-y-2">
            {users.map(user => (
              <button
                key={user.id}
                className="w-full text-left p-2 hover:bg-gray-800 rounded"
                onClick={() => onUserSelected(user.id)}
              >
                @{user.username}
              </button>
            ))}
          </div>
        )}
        <button 
          className="mt-4 text-gray-400 hover:text-gray-300"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
} 