'use client';

import { useState } from 'react';
import { createSupabaseClient } from '@/utils/supabase';
import { Channel } from '@/types/channel';

const supabase = createSupabaseClient();

interface Props {
  onClose: () => void;
  onChannelCreated: (channel: Channel) => void;
}

export default function CreateChannelModal({ onClose, onChannelCreated }: Props) {
  const [channelName, setChannelName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Creating channel:', channelName);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user found');
        return;
      }

      // Create the channel
      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .insert([
          { 
            name: channelName,
            created_by: user.id,
            type: 'channel'
          }
        ])
        .select()
        .single();

      console.log('Channel creation result:', { channel, channelError });

      if (channelError) {
        setError(channelError.message);
        return;
      }

      // Add creator as a member
      const { error: memberError } = await supabase
        .from('channel_members')
        .insert([
          {
            channel_id: channel.id,
            user_id: user.id,
            joined_at: new Date().toISOString(),
            last_read_at: new Date().toISOString()
          }
        ]);

      console.log('Member addition result:', { memberError });

      if (memberError) {
        setError(memberError.message);
        return;
      }

      onChannelCreated(channel);
      onClose();
    } catch (err) {
      console.error('Channel creation failed:', err);
      setError('Failed to create channel');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-gray-900 p-4 rounded-lg w-96">
        <h2 className="text-xl text-green-500 mb-4">Create Channel</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            placeholder="Channel name"
            className="w-full bg-black border border-green-800/50 p-2 mb-4 text-gray-200"
          />
          {error && <p className="text-red-500 mb-4">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-800/30 text-green-500 hover:bg-green-800/50"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 