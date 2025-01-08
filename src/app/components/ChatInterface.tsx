'use client';

import { useState, useRef, useEffect } from 'react';
import { signOut } from '@/utils/auth';
import { createSupabaseClient } from '@/utils/supabase';
import { User, RealtimeChannel } from '@supabase/supabase-js';
import { Message } from '@/types/message';
import CreateChannelModal from './CreateChannelModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Channel } from '../../types/channel';
import type { UseQueryOptions } from '@tanstack/react-query';

const supabase = createSupabaseClient();

// Add this temporarily to your ChatInterface.tsx, near the top:
console.log('Current Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

const formatTimestamp = (timestamp: string | null) => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (e) {
    console.error('Error formatting timestamp:', e);
    return 'Invalid Date';
  }
};

interface Profile {
  id: number;
  username: string;
  updated_at: string;
}

// Add message type
interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  channel_id: string;
}

const ChatInterface = () => {
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const queryClient = useQueryClient();
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [isSubscriptionReady, setIsSubscriptionReady] = useState(false);

  // Fetch channels
  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    },
    onSuccess(data) {
      if (!currentChannel && data.length > 0) {
        const general = data.find(c => c.name === 'general') || data[0];
        setCurrentChannel(general);
      }
    }
  });

  // Fetch messages for current channel
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', currentChannel?.id],
    queryFn: async () => {
      console.log('🔍 Fetching messages for channel:', currentChannel?.id);
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', currentChannel?.id)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!currentChannel?.id
  });

  // Realtime subscription
  useEffect(() => {
    if (!currentChannel?.id) return;
    
    console.log('🔌 Setting up subscription for channel:', currentChannel.id);
    setIsSubscriptionReady(false);
    
    const channel = supabase
      .channel(`messages:${currentChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${currentChannel.id}`
        },
        (payload) => {
          console.log('📨 Received realtime message:', payload);
          // Immediately fetch the latest messages instead of trying to handle the payload
          queryClient.invalidateQueries({ queryKey: ['messages', currentChannel.id] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setIsSubscriptionReady(true);
        }
      });

    return () => {
      setIsSubscriptionReady(false);
      supabase.removeChannel(channel);
    };
  }, [currentChannel?.id, queryClient]);

  useEffect(() => {
    const handleFocus = () => {
      if (currentChannel?.id) {
        queryClient.invalidateQueries({ queryKey: ['messages', currentChannel.id] });
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [currentChannel?.id, queryClient]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentChannel || !isSubscriptionReady) return;

    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      content: newMessage,
      channel_id: currentChannel.id,
      created_at: new Date().toISOString(),
      user_id: 'anonymous'
    };

    // Add optimistic update
    queryClient.setQueryData(['messages', currentChannel.id], 
      (old: Message[] = []) => [...old, optimisticMessage]
    );

    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          content: newMessage,
          channel_id: currentChannel.id,
          user_id: 'anonymous'
        }]);

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic update on error
      queryClient.setQueryData(['messages', currentChannel.id], 
        (old: Message[] = []) => old.filter(msg => msg.id !== optimisticMessage.id)
      );
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const handleCreateChannel = async (channelName: string) => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .insert([{ name: channelName }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Channel name already exists');
        }
        throw error;
      }

      // Invalidate channels query to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      setCurrentChannel(data);
    } catch (err) {
      console.error('Failed to create channel:', err);
      throw err;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black font-mono text-gray-200">
      <div className="bg-green-900/30 text-gray-200 px-2 py-0.5 flex justify-between items-center border-b border-green-800/50">
        <div>[ChatGenius]</div>
        <button onClick={handleLogout} className="text-green-500 hover:text-green-400">
          [X] Logout
        </button>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Channel sidebar */}
        <div className="w-48 bg-black border-r border-green-800/50 p-2">
          <div className="flex justify-between items-center mb-2">
            <div className="text-green-500">[Channels]</div>
            <button
              onClick={() => setShowCreateChannel(true)}
              className="text-green-500 hover:text-green-400"
            >
              [+]
            </button>
          </div>
          {channels.map(channel => (
            <div
              key={channel.id}
              onClick={() => setCurrentChannel(channel)}
              className={`cursor-pointer px-2 py-1 ${
                currentChannel?.id === channel.id ? 'bg-green-900/30' : ''
              }`}
            >
              #{channel.name}
            </div>
          ))}
          
          {/* Add modal */}
          {showCreateChannel && (
            <CreateChannelModal
              onClose={() => setShowCreateChannel(false)}
              onSubmit={handleCreateChannel}
            />
          )}
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            {!isSubscriptionReady && (
              <div className="text-yellow-500 mb-2">
                [Connecting to channel...]
              </div>
            )}
            {isLoading ? (
              <div>Loading messages...</div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="leading-5">
                  <span className="text-green-500">[</span>
                  <span className="text-gray-400">anonymous</span>
                  <span className="text-green-500">]</span>
                  {' '}
                  <span className="text-gray-500">{formatTimestamp(message.created_at)}</span>
                  {' '}
                  <span className="text-gray-200">{message.content}</span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={sendMessage} className="p-4 border-t border-green-800/50">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="w-full bg-black border border-green-800/50 p-2 text-gray-200"
              placeholder="Type a message..."
            />
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;