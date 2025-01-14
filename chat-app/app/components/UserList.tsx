'use client';

import { usePresence } from '@/hooks/usePresence';
import { Presence } from '@/types/presence';

export default function UserList() {
    const { onlineUsers } = usePresence();
    return (
      <div className="w-60 bg-[#19171D] border-l border-[#424244] p-4">
        <div className="mb-4">
          <h2 className="text-[#ABABAD] text-sm font-bold uppercase tracking-wide px-2">Online — {onlineUsers?.length || 0}</h2>
        </div>
        <div>
          {onlineUsers && onlineUsers.map((user: Presence) => (
            <div 
              key={user.id} 
              className="flex items-center px-2 py-1 rounded hover:bg-[#27242C] cursor-pointer"
            >
              <div className="w-8 h-8 rounded bg-[#1164A3] flex items-center justify-center text-white font-medium mr-3">
                {user.profiles?.username?.[0]?.toUpperCase()}
              </div>
              <span className="text-[#D1D2D3]">{user.profiles?.username || 'anonymous'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }