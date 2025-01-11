'use client';

import { useState, useEffect } from 'react';
import { signOut } from '@/utils/auth';
import { createSupabaseClient } from '@/utils/supabase';
import { Message, MessageWithProfile } from '@/types/message';
import CreateChannelModal from './CreateChannelModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Channel } from '../../types/channel';

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

// Add this type if you don't have it
interface MessageInputProps {
  onSendMessage: (content: string) => Promise<void>;
}

// Create a separate MessageInput component
const MessageInput = ({ onSendMessage }: MessageInputProps) => {
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent form submission refresh
    if (!message.trim()) return;
    
    try {
      await onSendMessage(message);
      setMessage(''); // Clear input on success
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        className="w-full bg-black border border-green-800/50 p-2 text-gray-200"
      />
    </form>
  );
};

const ChatInterface = () => {
  const [newMessage, setNewMessage] = useState('');
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
  });

  // Fetch messages for current channel
  const { data: messages = [], isLoading } = useQuery<MessageWithProfile[]>({
    queryKey: ['messages', currentChannel?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select(`*`)
        .eq('channel_id', currentChannel?.id)
        .order('created_at', { ascending: true });
      console.log('Messages with profiles:', data); // Debug log
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

  useEffect(() => {
    if (!currentChannel) return;

    // Subscribe to messages for current channel
    const channel = supabase
      .channel(`messages:${currentChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${currentChannel.id}`
        },
        (payload) => {
          console.log('Real-time update:', payload);
          // Refresh messages
          queryClient.invalidateQueries({ 
            queryKey: ['messages', currentChannel.id] 
          });
        }
      )
      .subscribe();

    // Cleanup subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentChannel?.id, queryClient]);

  const sendMessage = async (content: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Not authenticated');
      if (!currentChannel) throw new Error('No channel selected');

      const { error } = await supabase
        .from('messages')
        .insert([{
          content,
          channel_id: currentChannel.id,
          user_id: user.id
        }]);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to send message:', err);
      throw err;
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const handleCreateChannel = async (channelName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('channels')
        .insert([{ 
          name: channelName,
          created_by: user.id,
          type: 'public'  // Explicitly set type
        }])
        .select()
        .single();

      if (error) {
        console.error('Channel creation error:', error);
        throw new Error(error.message);
      }

      // Refresh the channels list
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      return data;
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
                <div key={message.id} className="py-1">
                  <span className="text-green-500">[</span>
                  <span className="text-gray-400">
                    {message.profiles?.username || 'anonymous'}
                  </span>
                  <span className="text-green-500">]</span>
                  <span className="text-green-500"> {formatTimestamp(message.created_at)}</span>
                  <span className="text-gray-300"> {message.content}</span>
                </div>
              ))
            )}
          </div>

          <MessageInput onSendMessage={sendMessage} />
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;