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
  
  const fetchChannels = async () => {
    const { data } = await supabase
      .from('channels')
      .select(`
        *,
        channel_members!inner (
          user_id,
          profiles!inner (
            id,
            username
          )
        )
      `)
      .order('created_at', { ascending: true });
    
    setChannels(data || []);
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
          <h2 className="text-green-400 font-semibold text-lg">Channels</h2>
          <button onClick={onCreateChannel} className="text-green-500 hover:text-green-400">+</button>
        </div>
        {channels.filter(c => c.type === 'channel').map(channel => (
          <button
            key={channel.id}
            onClick={() => onSelectChannel(channel)}
            className={`w-full text-left p-2 rounded font-medium text-lg ${
              currentChannel?.id === channel.id 
                ? 'bg-green-900/30 text-white' 
                : 'text-gray-100 hover:bg-gray-800 hover:text-white'
            }`}
          >
            #{channel.name}
          </button>
        ))}
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-green-400 font-semibold text-lg">Direct Messages</h2>
          <button onClick={() => setShowUserSelect(true)} className="text-green-500 hover:text-green-400">+</button>
        </div>
        {channels.filter(c => c.type === 'dm').map(channel => (
          <button
            key={channel.id}
            onClick={() => onSelectChannel(channel)}
            className={`w-full text-left p-2 rounded font-medium text-lg ${
              currentChannel?.id === channel.id 
                ? 'bg-green-900/30 text-white' 
                : 'text-gray-100 hover:bg-gray-800 hover:text-white'
            }`}
          >
            @{channel.name}
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