'use client';

import { useState } from 'react';
import { createSupabaseClient } from '@/utils/supabase';
import { Channel } from '@/types/channel';
import UserSelectionModal from './UserSelectionModal';
import { useQuery } from '@tanstack/react-query';

const supabase = createSupabaseClient();

interface ChannelListProps {
  currentChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  onCreateChannel: () => void;
  onCreateDM: (userId: string) => void;
}

export default function ChannelList({ currentChannel, onSelectChannel, onCreateChannel, onCreateDM }: ChannelListProps) {
  const [showUserSelect, setShowUserSelect] = useState(false);
  
  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select(`
          *,
          channel_members:channel_members!channel_id (
            user_id,
            profiles:profiles!user_id (
              id,
              username
            )
          )
        `)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return (data as unknown as Channel[]) || [];
    }
  });

  const handleUserSelected = async (userId: string) => {
    setShowUserSelect(false);
    await onCreateDM(userId);
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
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            @{channel.name}
          </button>
        ))}
      </div>

      {showUserSelect && (
        <UserSelectionModal
          onClose={() => setShowUserSelect(false)}
          onUserSelected={handleUserSelected}
        />
      )}
    </div>
  );
}