'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase';
import { Message } from '@/types/message';
import CreateChannelModal from './CreateChannelModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Channel } from '../../types/channel';
import MessageContextMenu from './MessageContextMenu';
import ThreadPanel from './ThreadPanel';
import MessageInput from './MessageInput';
import UserList from './UserList';
import ChannelList from './ChannelList';
import MessageList from './MessageList';

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

  const { data: channels = [], refetch: refetchChannels } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('created_at', { ascending: true });
      
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
          profiles (username)
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

  // Message subscription
  useEffect(() => {
    if (!currentChannel?.id) return;
    
    console.log('🔌 Setting up message subscription for channel:', currentChannel.id);
    setIsMessageSubReady(false);
    
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
          console.log('📨 Message change:', payload);
          queryClient.invalidateQueries({ queryKey: ['messages', currentChannel.id] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Message sub status:', status);
        setIsMessageSubReady(status === 'SUBSCRIBED');
      });

    return () => {
      console.log('🔌 Cleaning up message subscription');
      setIsMessageSubReady(false);
      supabase.removeChannel(channel);
    };
  }, [currentChannel?.id, queryClient]);

  // Channel subscription
  useEffect(() => {
    console.log('🔌 Setting up channel subscription');
    setIsChannelSubReady(false);

    const channel = supabase
      .channel('channel_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels'
        },
        (payload) => {
          console.log('📨 Channel change:', payload);
          refetchChannels();
        }
      )
      .subscribe((status) => {
        console.log('📡 Channel sub status:', status);
        setIsChannelSubReady(status === 'SUBSCRIBED');
      });

    return () => {
      console.log('🔌 Cleaning up channel subscription');
      setIsChannelSubReady(false);
      supabase.removeChannel(channel);
    };
  }, [refetchChannels]);

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

  useEffect(() => {
    const channel = supabase
      .channel('channel_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels'
        },
        () => {
          refetchChannels();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchChannels]);

  const handleChannelCreated = (channel: Channel) => {
    console.log('Channel created:', channel);
    setShowCreateChannel(false);
    setCurrentChannel(channel);
    queryClient.invalidateQueries({ queryKey: ['channels'] });
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

  return (
    <div className="flex h-screen">
      <ChannelList
        currentChannel={currentChannel}
        onSelectChannel={setCurrentChannel}
        onCreateChannel={() => setShowCreateChannel(true)}
        onCreateDM={handleCreateDM}
      />
      
      {currentChannel ? (
        <div className="flex-1 flex flex-col">
          {!isSubscriptionReady}
          <MessageList
            messages={messages || []}
            onContextMenu={handleContextMenu}
            channelType={currentChannel?.type}
          />
          <MessageInput
            onSendMessage={handleSendMessage}
            placeholder={`Message ${currentChannel?.name || ''}`}
            currentChannel={currentChannel}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <h2 className="text-xl mb-2">Welcome to ChatGenius</h2>
            <p>Select a channel or start a conversation to begin chatting</p>
          </div>
        </div>
      )}

      {activeThread && (
        <div className="w-96 border-l border-green-800/50">
          <ThreadPanel
            parentMessage={activeThread}
            onSendReply={handleSendReply}
            onClose={() => setActiveThread(null)}
          />
        </div>
      )}

      <UserList />

      {contextMenu && (
        <MessageContextMenu
          message={contextMenu.message}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onReply={handleReply}
          onDelete={handleDeleteMessage}
        />
      )}

      {showCreateChannel && (
        <CreateChannelModal
          onClose={() => setShowCreateChannel(false)}
          onChannelCreated={handleChannelCreated}
        />
      )}
    </div>
  );
};

export default ChatInterface;