'use client';

import { Channel } from '@/types/channel';

interface ChannelListProps {
  channels: Channel[];
  selectedChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  onCreateChannel: () => void;
}

export default function ChannelList({ 
  channels, 
  selectedChannel, 
  onSelectChannel,
  onCreateChannel 
}: ChannelListProps) {
  const handleCreateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log('Create channel clicked');
    onCreateChannel();
  };

  return (
    <div className="p-2">
      <div className="flex justify-between items-center mb-2">
        <div className="text-green-500">[Channels]</div>
        <button 
          onClick={handleCreateClick}
          className="text-green-500 hover:text-green-400"
        >
          [+]
        </button>
      </div>
      <div className="space-y-1">
        {channels?.map((channel) => (
          <div
            key={channel.id}
            className={`cursor-pointer hover:text-green-400 ${
              selectedChannel?.id === channel.id ? 'text-green-500' : 'text-gray-400'
            }`}
            onClick={() => onSelectChannel(channel)}
          >
            #{channel.name}
          </div>
        ))}
      </div>
    </div>
  );
}