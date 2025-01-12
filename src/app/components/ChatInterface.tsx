'use client';

import { useState, useEffect } from 'react';
import { signOut } from '@/utils/auth';
import { createSupabaseClient } from '@/utils/supabase';
import { Message } from '@/types/message';
import CreateChannelModal from './CreateChannelModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Channel } from '../../types/channel';
import MessageContextMenu from './MessageContextMenu';
import ThreadPanel from './ThreadPanel';
import MessageInput from './MessageInput';
import { usePresence } from '@/hooks/usePresence';
import UserList from './UserList';
import ChannelList from './ChannelList';
import MessageList from './MessageList';

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

const ChatInterface = () => {
  const [newMessage, setNewMessage] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const queryClient = useQueryClient();
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [isSubscriptionReady, setIsSubscriptionReady] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    message: Message;
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [activeThread, setActiveThread] = useState<Message | null>(null);

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

  // Main channel messages - only show non-threaded messages
  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ['messages', currentChannel?.id],
    queryFn: async () => {
      console.log('Fetching messages for channel:', currentChannel?.id);
      
      if (!currentChannel?.id) return [];
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          channel_id,
          user_id,
          thread_id,
          profiles (username)
        `)
        .eq('channel_id', currentChannel.id)
        .is('thread_id', null)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return [];
      }

      return data;
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
          console.log('📨 Received message:', payload);
          // Refresh main messages
          queryClient.invalidateQueries({ queryKey: ['messages', currentChannel.id] });
          
          // If this is a thread message, also refresh thread messages
          if (payload.new.thread_id) {
            queryClient.invalidateQueries({ queryKey: ['thread', payload.new.thread_id] });
          }
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

  const sendMessage = async (content: string, isThreadReply = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Not authenticated');
      if (!currentChannel) throw new Error('No channel selected');

      const messageData = {
        content,
        channel_id: currentChannel.id,
        user_id: user.id,
        // Only set thread_id if it's explicitly a thread reply
        thread_id: isThreadReply ? activeThread?.id : null,
        parent_id: null
      };

      console.log('Sending message:', messageData);

      const { error } = await supabase
        .from('messages')
        .insert([messageData]);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to send message:', err);
      throw err;
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const handleCreateChannel = async () => {
    console.log('Opening create channel modal');
    setShowCreateChannel(true);
  };

  // Thread messages query
  const { data: threadMessages = [], isLoading: isThreadLoading } = useQuery<Message[]>({
    queryKey: ['thread', activeThread?.id],
    queryFn: async () => {
      console.log('Fetching thread messages for:', activeThread?.id);
      
      if (!activeThread?.id) {
        console.log('No active thread');
        return [];
      }
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          channel_id,
          user_id,
          thread_id,
          profiles (username)
        `)
        .eq('thread_id', activeThread.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching thread messages:', error);
        throw error;
      }

      console.log('Thread messages fetched:', data);
      return data || [];
    },
    enabled: !!activeThread?.id
  });

  const handleReplyInThread = (message: Message) => {
    setActiveThread(message);
    setContextMenu(null);
  };

  useEffect(() => {
    if (!activeThread?.id) return;
    
    console.log('🔌 Setting up thread subscription for:', activeThread.id);
    
    const channel = supabase
      .channel(`thread-${activeThread.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${activeThread.id}`
        },
        (payload) => {
          console.log('Thread message change:', payload);
          queryClient.invalidateQueries({ queryKey: ['thread', activeThread.id] });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up thread subscription');
      channel.unsubscribe();
    };
  }, [activeThread?.id, queryClient]);

  const handleSendMessage = async (content: string) => {
    if (!currentChannel?.id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('messages')
      .insert([{
        content,
        channel_id: currentChannel.id,
        user_id: user.id,
        created_at: new Date().toISOString()
      }]);

    if (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleSendReply = async (content: string) => {
    if (!currentChannel?.id || !activeThread?.id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('messages')
      .insert([{
        content,
        channel_id: currentChannel.id,
        user_id: user.id,
        thread_id: activeThread.id,
        created_at: new Date().toISOString()
      }]);

    if (error) {
      console.error('Error sending reply:', error);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      message,
    });
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
        {/* Left: Channels */}
        <div className="w-48 border-r border-green-800/50">
          <ChannelList 
            channels={channels} 
            selectedChannel={currentChannel}
            onSelectChannel={setCurrentChannel}
            onCreateChannel={handleCreateChannel}
          />
        </div>

        {/* Middle: Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <MessageList 
            messages={messages} 
            onContextMenu={handleContextMenu}
          />
          <MessageInput onSendMessage={handleSendMessage} />
        </div>

        {/* Right Side: Thread Panel */}
        {activeThread && (
          <div className="w-96 border-l border-green-800/50">
            <ThreadPanel
              parentMessage={activeThread}
              onSendReply={handleSendReply}
              onClose={() => setActiveThread(null)}
            />
          </div>
        )}

        {/* Far Right: Users List */}
        <UserList />
      </div>

      {/* Add the context menu */}
      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onReplyInThread={() => handleReplyInThread(contextMenu.message)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {showCreateChannel && (
        <CreateChannelModal
          onClose={() => {
            console.log('Closing modal');
            setShowCreateChannel(false);
          }}
          onSubmit={async (name) => {
            console.log('Creating channel:', name);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) {
                console.error('No user found');
                return;
              }

              const { data: channel, error } = await supabase
                .from('channels')
                .insert([{
                  name: name,
                  created_by: user.id,
                  created_at: new Date().toISOString()
                }])
                .select()
                .single();

              if (error) {
                console.error('Channel creation error:', error);
                throw error;
              }

              console.log('Channel created:', channel);
              setShowCreateChannel(false);
              queryClient.invalidateQueries({ queryKey: ['channels'] });
              
              if (channel) {
                setCurrentChannel(channel);
              }
            } catch (error) {
              console.error('Error in channel creation:', error);
              throw error;
            }
          }}
        />
      )}
    </div>
  );
};

export default ChatInterface;