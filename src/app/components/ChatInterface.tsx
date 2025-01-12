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
  const [contextMenu, setContextMenu] = useState<{x: number; y: number; messageId: string} | null>(null);
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
        .select('*')
        .eq('channel_id', currentChannel.id)
        .is('thread_id', null)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }

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
        .select('*')
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

        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-2">
            {!currentChannel ? (
              <div className="text-gray-500 text-center mt-4">
                Please select a channel
              </div>
            ) : isLoading ? (
              <div>Loading messages...</div>
            ) : (
              messages.map((message) => (
                <div 
                  key={message.id} 
                  className="py-1 cursor-pointer"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    console.log('Right click detected!');
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      messageId: message.id
                    });
                  }}
                >
                  <span className="text-green-500">[</span>
                  <span className="text-gray-400">
                    {message.profiles?.username || 'anonymous'}
                  </span>
                  <span className="text-green-500">]</span>
                  <span className="text-green-500"> {formatTimestamp(message.created_at)}</span>
                  <span className="text-gray-300"> {message.content}</span>
                  {message.id === activeThread?.id && (
                    <span className="text-green-500 ml-2">[thread]</span>
                  )}
                </div>
              ))
            )}
          </div>
          
          {currentChannel && (
            <div className="p-2 border-t border-green-800/50">
              <MessageInput 
                onSendMessage={(content) => sendMessage(content, false)} 
                placeholder={`Message #${currentChannel.name}`}
              />
            </div>
          )}
        </div>

        {/* Thread panel */}
        {activeThread && (
          <div className="w-96 border-l border-green-800/50">
            <ThreadPanel
              parentMessage={activeThread}
              threadMessages={threadMessages}
              onSendReply={(content) => sendMessage(content, true)}
              onClose={() => setActiveThread(null)}
              placeholder="Reply..."
            />
          </div>
        )}
      </div>

      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onReplyInThread={() => {
            const message = messages.find(m => m.id === contextMenu.messageId);
            if (message) {
              setActiveThread(message);
              setContextMenu(null);
            }
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

export default ChatInterface;