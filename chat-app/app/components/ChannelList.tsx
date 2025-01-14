'use client';

import { useState } from 'react';
import { createSupabaseClient } from '../../utils/supabase';
import { Channel } from '../../types/channel';
import UserSelectionModal from './UserSelectionModal';
import { useQuery } from '@tanstack/react-query';

const supabase = createSupabaseClient();

interface ChannelListProps {
  channels: Channel[];
  currentChannel: Channel | null;
  setCurrentChannel: (channel: Channel) => void;
  setShowCreateChannel: (show: boolean) => void;
}

export default function ChannelList({ 
  channels, 
  currentChannel, 
  setCurrentChannel, 
  setShowCreateChannel 
}: ChannelListProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between px-3 py-2">
          <h2 className="text-[var(--text-secondary)] text-sm font-bold uppercase tracking-wide">Channels</h2>
          <button 
            onClick={() => setShowCreateChannel(true)} 
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-lg"
          >
            +
          </button>
        </div>
        {channels.filter(c => c.type === 'channel').map(channel => (
          <button
            key={channel.id}
            onClick={() => setCurrentChannel(channel)}
            className={`channel-item flex items-center ${
              currentChannel?.id === channel.id ? 'active' : ''
            }`}
          >
            <span className="mr-2 text-[var(--text-secondary)]">#</span>
            <span>{channel.name}</span>
          </button>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between px-3 py-2">
          <h2 className="text-[var(--text-secondary)] text-sm font-bold uppercase tracking-wide">Direct Messages</h2>
        </div>
        {channels.filter(c => c.type === 'dm').map(channel => (
          <button
            key={channel.id}
            onClick={() => setCurrentChannel(channel)}
            className={`channel-item flex items-center ${
              currentChannel?.id === channel.id ? 'active' : ''
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
            <span>{channel.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}