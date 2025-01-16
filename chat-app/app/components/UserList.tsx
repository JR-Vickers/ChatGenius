'use client';

import { useState } from 'react';
import { usePresence } from '@/hooks/usePresence';
import { Presence } from '@/types/presence';
import { createSupabaseClient } from '@/utils/supabase';
import ProfilePictureUpload from './ProfilePictureUpload';

export default function UserList() {
  const { onlineUsers } = usePresence();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const supabase = createSupabaseClient();
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // Get current user's profile
  const currentUserProfile = onlineUsers?.find(user => user.user_id === currentUser);

  const handleAvatarClick = async (userId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id === userId) {
      setCurrentUser(userId);
      setShowUploadModal(true);
    }
  };

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
            onClick={() => handleAvatarClick(user.user_id)}
          >
            {user.profiles?.profile_picture_url ? (
              <img 
                src={user.profiles.profile_picture_url} 
                alt={user.profiles.username || 'User'} 
                className="w-8 h-8 rounded-full object-cover mr-3"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#1164A3] flex items-center justify-center text-white font-medium mr-3">
                {user.profiles?.username?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="text-[#D1D2D3]">{user.profiles?.username || 'anonymous'}</span>
          </div>
        ))}
      </div>

      {showUploadModal && currentUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#19171D] p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Update Profile Picture</h3>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="text-[#ABABAD] hover:text-white"
              >
                ✕
              </button>
            </div>
            <ProfilePictureUpload 
              userId={currentUser}
              existingUrl={currentUserProfile?.profiles?.profile_picture_url}
              onUploadComplete={() => setShowUploadModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}