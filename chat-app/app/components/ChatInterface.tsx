'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '../../utils/supabase';
import { Message, MessageReaction } from '../../types/message';
import CreateChannelModal from './CreateChannelModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Channel } from '../../types/channel';
import MessageContextMenu from './MessageContextMenu';
import ThreadPanel from './ThreadPanel';
import MessageInput from './MessageInput';
import UserList from './UserList';
import ChannelList from './ChannelList';
import MessageList from './MessageList';
import { sendBotMessage } from '@/utils/botClient';
import { config } from '@/utils/config';
import { useUser } from '@/hooks/useUser';

const supabase = createSupabaseClient();

// Add this temporarily to your ChatInterface.tsx, near the top:
console.log('Current Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

const ChatInterface = () => {
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const queryClient = useQueryClient();
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [isSubscriptionReady, setIsSubscriptionReady] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    message: Message;
    position: { x: number; y: number };
  } | null>(null);
  const [activeThread, setActiveThread] = useState<Message | null>(null);
  const [isMessageSubReady, setIsMessageSubReady] = useState(false);
  const [isChannelSubReady, setIsChannelSubReady] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    messages: boolean;
    channels: boolean;
    threads: boolean;
    reactions: boolean;
  }>({
    messages: false,
    channels: false,
    threads: false,
    reactions: false
  });
  const { user } = useUser();

  const { data: channels = [], refetch: refetchChannels } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select(`
          id,
          name,
          type,
          created_at,
          created_by,
          channel_members (
            user_id,
            profiles (
              id,
              username
            )
          )
        `)
        .order('created_at', { ascending: true })
        .returns<Channel[]>();
      
      if (error) throw error;
      return data || [];
    }
  });

  // Main channel messages - only show non-threaded messages
  const { data: messages = [] } = useQuery({
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
          profiles (
            username,
            profile_picture_url
          )
        `)
        .eq('channel_id', currentChannel.id)
        .is('thread_id', null)
        .order('created_at', { ascending: true })
        .returns<Message[]>();

      if (error) {
        console.error('Error fetching messages:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!currentChannel?.id
  });

  // SINGLE channel subscription
  useEffect(() => {
    console.log('🔄 Setting up channel subscription');
    
    const channel = supabase
      .channel('channel_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels'
        },
        async (payload) => {
          console.log('📨 Channel change:', {
            payload,
            type: 'channel_changes',
            timestamp: new Date().toISOString()
          });

          console.log('🔄 Starting query invalidation and refetch');
          try {
            await queryClient.invalidateQueries({ 
              queryKey: ['channels'],
              refetchType: 'active'
            });
            console.log('✅ Query invalidated');
            
            await refetchChannels();
            console.log('✅ Channels refetched');
          } catch (error) {
            console.error('❌ Error during invalidation/refetch:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 Channel subscription status: ${status}`);
        setSubscriptionStatus(prev => ({ ...prev, channels: status === 'SUBSCRIBED' }));
      });

    return () => {
      console.log('🔌 Cleaning up channel subscription');
      setSubscriptionStatus(prev => ({ ...prev, channels: false }));
      supabase.removeChannel(channel);
    };
  }, []); // Only on mount/unmount

  // SINGLE message subscription - only when we have a channel
  useEffect(() => {
    if (!currentChannel?.id) {
      console.log('🔄 Subscriptions skipped - no channel');
      return;
    }

    console.log(`🔄 Setting up subscriptions for channel: ${currentChannel.id}`);
    
    const channel = supabase
      .channel(`room:${currentChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${currentChannel.id}`
        },
        (payload) => {
          console.log('📨 Message change:', payload);
          queryClient.invalidateQueries({ queryKey: ['messages', currentChannel.id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions'
        },
        (payload) => {
          console.log('📨 Reaction change:', payload);
          queryClient.invalidateQueries({ queryKey: ['messages', currentChannel.id] });
        }
      )
      .subscribe((status) => {
        console.log(`📡 Subscription status: ${status}`);
        setSubscriptionStatus(prev => ({
          ...prev,
          messages: status === 'SUBSCRIBED',
          reactions: status === 'SUBSCRIBED'
        }));
      });

    return () => {
      console.log('🔌 Cleaning up subscriptions');
      setSubscriptionStatus(prev => ({
        ...prev,
        messages: false,
        reactions: false
      }));
      supabase.removeChannel(channel);
    };
  }, [currentChannel?.id]); // Only when channel changes

  // SINGLE thread subscription - only when we have an active thread
  useEffect(() => {
    if (!activeThread?.id) {
      console.log('🔄 Thread subscription skipped - no thread');
      return;
    }

    console.log(`🔄 Setting up thread subscription for: ${activeThread.id}`);
    
    const channel = supabase
      .channel(`thread:${activeThread.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${activeThread.id}`
        },
        (payload) => {
          console.log('📨 Thread message change:', payload);
          queryClient.invalidateQueries({ queryKey: ['thread', activeThread.id] });
        }
      )
      .subscribe((status) => {
        console.log(`📡 Thread subscription status: ${status}`);
        setSubscriptionStatus(prev => ({ ...prev, threads: status === 'SUBSCRIBED' }));
      });

    return () => {
      console.log('🔌 Cleaning up thread subscription');
      setSubscriptionStatus(prev => ({ ...prev, threads: false }));
      supabase.removeChannel(channel);
    };
  }, [activeThread?.id]); // Only when active thread changes

  // Optional: Add a subscription status indicator
  useEffect(() => {
    console.log('Subscription Status:', subscriptionStatus);
  }, [subscriptionStatus]);

  useEffect(() => {
    const handleFocus = () => {
      if (currentChannel?.id) {
        queryClient.invalidateQueries({ queryKey: ['messages', currentChannel.id] });
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [currentChannel?.id, queryClient]);

  const handleChannelCreated = (channel: Channel) => {
    console.log('Channel created:', channel);
    setShowCreateChannel(false);
    setCurrentChannel(channel);
    queryClient.invalidateQueries({ queryKey: ['channels'] });
  };

  const handleSendMessage = async (content: string, type: 'text' | 'rag_query' = 'text') => {
    console.log('handleSendMessage called with:', { content, type });
    if (!currentChannel || !user) {
      console.log('No channel or user:', { channel: !!currentChannel, user: !!user });
      return;
    }

    try {
      if (type === 'rag_query') {
        console.log('Processing RAG query in ChatInterface');
        // First send the user's query
        const { error: queryError } = await supabase
          .from('messages')
          .insert([{
            content,
            channel_id: currentChannel.id,
            user_id: user.id,
            type: 'rag_query'
          }]);

        if (queryError) {
          console.error('Error inserting query message:', queryError);
          throw queryError;
        }

        console.log('Sending thinking message');
        // Send "thinking" message from bot
        await sendBotMessage('Thinking...', currentChannel.id, 'text');

        console.log('Making RAG query to AI service');
        console.log('Request URL:', `${config.aiServiceUrl}/query`);
        console.log('Request body:', { query: content, k: 3 });
        // Make the actual RAG query
        const response = await fetch(`${config.aiServiceUrl}/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: content, k: 3 })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('RAG query failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          throw new Error('Query failed');
        }

        const result = await response.json();
        console.log('RAG query result:', result);

        // Send the main response only
        await sendBotMessage(result.answer, currentChannel.id, 'rag_response');

      } else {
        console.log('Sending regular message');
        // Regular message
        const { error } = await supabase
          .from('messages')
          .insert([{
            content,
            channel_id: currentChannel.id,
            user_id: user.id,
            type: 'text'
          }]);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      if (type === 'rag_query') {
        await sendBotMessage('❌ Failed to process query', currentChannel.id, 'text');
      }
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
      message,
      position: { x: e.pageX, y: e.pageY }
    });
  };

  const handleReply = (message: Message) => {
    setActiveThread(message);
  };

  const handleCreateDM = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if DM already exists using junction table
      const { data: existingDM } = await supabase
        .from('channels')
        .select(`
          *,
          channel_members!inner (
            user_id,
            profiles (
              id,
              username
            )
          )
        `)
        .eq('type', 'dm')
        .returns<Channel[]>();

      if (existingDM && existingDM.length > 0) {
        setCurrentChannel(existingDM[0]);
        return;
      }

      // Create new DM channel
      const { data: otherUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single();

      const { data: newChannel, error: channelError } = await supabase
        .from('channels')
        .insert([{
          type: 'dm',
          created_by: user.id,
          name: otherUser?.username || 'unknown' // Just use their username
        }])
        .select()
        .single();

      if (channelError) throw channelError;

      // Add both users to channel_members
      const { error: participantsError } = await supabase
        .from('channel_members')
        .insert([
          { 
            channel_id: newChannel.id, 
            user_id: user.id,     // Changed from profile_id
            joined_at: new Date().toISOString(),
            last_read_at: new Date().toISOString()
          },
          { 
            channel_id: newChannel.id, 
            user_id: userId,      // Changed from profile_id
            joined_at: new Date().toISOString(),
            last_read_at: new Date().toISOString()
          }
        ]);

      if (participantsError) throw participantsError;

      // Fetch the complete DM with participants
      const { data: completeDM, error: fetchError } = await supabase
        .from('channels')
        .select(`
          *,
          channel_members (
            user_id,
            profiles (
              id,
              username
            )
          )
        `)
        .eq('id', newChannel.id as string)
        .single();
      if (fetchError) throw fetchError;
      
      // Cast completeDM to Channel type since we know the shape matches
      const channelData = completeDM as unknown as Channel;
      setCurrentChannel(channelData);
      queryClient.invalidateQueries({ queryKey: ['dms'] });
    } catch (error) {
      console.error('Detailed error creating DM:', error);
      throw error;
    }
  };

  const handleDeleteMessage = async (message: Message) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || message.user_id !== user.id) return;

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', message.id)
      .returns<Message>();

    if (error) {
      console.error('Error deleting message:', error);
      return;
    }

    // If this was a thread parent, close the thread panel
    if (activeThread?.id === message.id) {
      setActiveThread(null);
    }

    // Refresh messages
    queryClient.invalidateQueries({ queryKey: ['messages', currentChannel?.id] });
  };

  const handleEditMessage = (message: Message) => {
    // Pass the message to MessageList's edit handler
    const messageList = document.querySelector('.message-list');
    if (messageList) {
      const event = new CustomEvent('startEdit', { detail: message });
      messageList.dispatchEvent(event);
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-64 bg-gray-800 flex flex-col h-screen overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold text-green-500">ChatGenius</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ChannelList 
            channels={channels} 
            currentChannel={currentChannel}
            setCurrentChannel={setCurrentChannel}
            setShowCreateChannel={setShowCreateChannel}
          />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-900 min-w-0">
        {currentChannel ? (
          <>
            <div className="p-4 border-b border-gray-700 bg-gray-900">
              <h2 className="text-lg font-semibold">#{currentChannel.name}</h2>
            </div>
            <div className="flex-1 flex min-h-0">
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 overflow-y-auto">
                  <MessageList 
                    messages={messages} 
                    setContextMenu={setContextMenu}
                    setActiveThread={setActiveThread}
                  />
                </div>
                <MessageInput 
                  onSendMessage={handleSendMessage} 
                  currentChannel={currentChannel}
                />
              </div>
              {activeThread && (
                <ThreadPanel 
                  thread={activeThread}
                  onClose={() => setActiveThread(null)}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a channel to start chatting
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      <div className="w-64 bg-gray-800 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <UserList />
        </div>
      </div>

      {/* Modals and Overlays */}
      {showCreateChannel && (
        <CreateChannelModal
          onClose={() => setShowCreateChannel(false)}
          onChannelCreated={handleChannelCreated}
        />
      )}

      {contextMenu && (
        <MessageContextMenu
          message={contextMenu.message}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onThreadClick={setActiveThread}
          onDelete={handleDeleteMessage}
          onEdit={handleEditMessage}
        />
      )}
    </div>
  );
};

export default ChatInterface;