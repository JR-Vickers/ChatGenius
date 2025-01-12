'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase';
import { Channel } from '@/types/channel';
import UserSelectionModal from './UserSelectionModal';

const supabase = createSupabaseClient();

interface ChannelListProps {
  currentChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  onCreateChannel: () => void;
  onCreateDM: (userId: string) => void;
}

export default function ChannelList({ currentChannel, onSelectChannel, onCreateChannel, onCreateDM }: ChannelListProps) {
  const [showUserSelect, setShowUserSelect] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  
  const fetchChannels = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUser(user.id);

    const { data } = await supabase
      .from('channels')
      .select(`
        *,
        channel_members (
          user_id,
          profiles (
            id,
            username
          )
        )
      `)
      .order('created_at', { ascending: true });
    
    setChannels(data || []);
  };

  // Helper to get other user's name in DM
  const getDMName = (channel: Channel) => {
    if (!channel.channel_members || !currentUser) return channel.name;
    
    const otherMember = channel.channel_members.find(
      member => member.user_id !== currentUser
    );
    
    return otherMember?.profiles?.username || channel.name;
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleUserSelected = async (userId: string) => {
    setShowUserSelect(false);
    await onCreateDM(userId);
    fetchChannels(); // Refresh channels after DM creation
  };

  return (
    <div className="w-60 bg-gray-900 p-4">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-green-500">Channels</h2>
          <button onClick={onCreateChannel} className="text-green-500 hover:text-green-400">+</button>
        </div>
        {channels.filter(c => c.type === 'channel').map(channel => (
          <button
            key={channel.id}
            onClick={() => onSelectChannel(channel)}
            className={`w-full text-left p-2 rounded font-medium text-base ${
              currentChannel?.id === channel.id 
                ? 'bg-green-900/30 text-green-400' 
                : 'text-gray-300 hover:bg-gray-800 hover:text-green-400'
            }`}
          >
            #{channel.name}
          </button>
        ))}
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-green-500">Direct Messages</h2>
          <button onClick={() => setShowUserSelect(true)} className="text-green-500 hover:text-green-400">+</button>
        </div>
        {channels.filter(c => c.type === 'dm').map(channel => (
          <button
            key={channel.id}
            onClick={() => onSelectChannel(channel)}
            className={`w-full text-left p-2 rounded font-medium text-base ${
              currentChannel?.id === channel.id 
                ? 'bg-green-900/30 text-green-400' 
                : 'text-gray-300 hover:bg-gray-800 hover:text-green-400'
            }`}
          >
            @{getDMName(channel)}
          </button>
        ))}
      </div>

      {showUserSelect && (
        <UserSelectionModal
          onClose={() => setShowUserSelect(false)}
          onUserSelected={(userId) => {
            handleUserSelected(userId);
          }}
        />
      )}
    </div>
  );
}