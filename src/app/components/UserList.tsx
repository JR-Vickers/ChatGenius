'use client';

import { usePresence } from '@/hooks/usePresence';
import { Presence } from '@/types/presence';

export default function UserList() {
    const { onlineUsers } = usePresence();
    return (
      <div className="w-48 border-l border-green-800/50 p-2">
        <div className="text-green-500 mb-2">[Users]</div>
        <div className="space-y-1">
          {onlineUsers && onlineUsers.map((user: Presence) => (
            <div key={user.id} className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
              <span className="text-gray-300">{user.profiles?.username || 'anonymous'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }