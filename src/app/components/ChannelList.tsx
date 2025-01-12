'use client';

import { Channel } from '@/types/channel';
import { useQuery } from '@tanstack/react-query';
import { createSupabaseClient } from '@/utils/supabase';

const supabase = createSupabaseClient();

interface ChannelListProps {
  currentChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  onCreateChannel: () => void;
  onCreateDM: () => void;
}

export default function ChannelList({ 
  currentChannel, 
  onSelectChannel,
  onCreateChannel,
  onCreateDM
}: ChannelListProps) {
  // Separate queries for channels and DMs
  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('type', 'channel')
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });

  const { data: dms = [] } = useQuery<Channel[]>({
    queryKey: ['dms'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user);
      if (!user) return [];

      // First get all DM channels the user is part of
      const { data: userChannels, error: channelsError } = await supabase
        .from('channel_participants')
        .select('channel_id')
        .eq('profile_id', user.id);

      if (channelsError) throw channelsError;
      
      const channelIds = userChannels?.map(c => c.channel_id) || [];
      console.log('User channel IDs:', channelIds);

      // Then get full channel data with all participants
      const { data, error } = await supabase
        .from('channels')
        .select(`
          *,
          channel_participants!inner (
            profiles (
              id,
              username
            )
          )
        `)
        .eq('type', 'dm')
        .in('id', channelIds);

      console.log('Raw DM data:', JSON.stringify(data, null, 2));

      if (error) throw error;

      // Transform to get other participant
      const transformedData = data?.map(dm => {
        const otherParticipant = dm.channel_participants?.find(
          p => p.profiles.id !== user.id
        )?.profiles;
        
        console.log('Channel:', dm.id, 'Other participant:', otherParticipant);
        
        return {
          ...dm,
          profiles: otherParticipant ? [otherParticipant] : []
        };
      }) || [];

      return transformedData;
    },
  });

  return (
    <div className="p-2 space-y-4">
      {/* Channels Section */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <div className="text-green-500">[Channels]</div>
          <button 
            onClick={onCreateChannel}
            className="text-green-500 hover:text-green-400"
          >
            [+]
          </button>
        </div>
        <div className="space-y-1">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className={`cursor-pointer hover:text-green-400 ${
                currentChannel?.id === channel.id ? 'text-green-500' : 'text-gray-400'
              }`}
              onClick={() => onSelectChannel(channel)}
            >
              #{channel.name}
            </div>
          ))}
        </div>
      </div>

      {/* DMs Section */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <div className="text-green-500">[Direct Messages]</div>
          <button 
            onClick={onCreateDM}
            className="text-green-500 hover:text-green-400"
          >
            [+]
          </button>
        </div>
        <div className="space-y-1">
          {dms.map((dm) => (
            <div
              key={dm.id}
              className={`cursor-pointer hover:text-green-400 ${
                currentChannel?.id === dm.id ? 'text-green-500' : 'text-gray-400'
              }`}
              onClick={() => onSelectChannel(dm)}
            >
              {/* Show the other participant's name */}
              @{dm.profiles?.[0]?.username || 'unknown'}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}