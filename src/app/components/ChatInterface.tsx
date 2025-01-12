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
import UserSearchModal from './UserSearchModal';

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
    message: Message;
    position: { x: number; y: number };
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [activeThread, setActiveThread] = useState<Message | null>(null);
  const [showUserSearch, setShowUserSearch] = useState(false);

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
      const { data: existingDM, error: checkError } = await supabase
        .from('channels')
        .select(`
          *,
          channel_participants!inner (profile_id),
          profiles:channel_participants(
            profile_id,
            profiles (username)
          )
        `)
        .eq('type', 'dm')
        .eq('channel_participants.profile_id', user.id)
        .eq('channel_participants.profile_id', userId)
        .single();

      if (existingDM) {
        setCurrentChannel(existingDM);
        return;
      }

      // Create new DM channel
      const { data: newChannel, error: channelError } = await supabase
        .from('channels')
        .insert([{
          type: 'dm',
          created_by: user.id,
          name: `dm-${user.id}-${userId}` // Internal name
        }])
        .select()
        .single();

      if (channelError) throw channelError;

      // Add both users to channel_participants
      const { error: participantsError } = await supabase
        .from('channel_participants')
        .insert([
          { channel_id: newChannel.id, profile_id: user.id },
          { channel_id: newChannel.id, profile_id: userId }
        ]);

      if (participantsError) throw participantsError;

      // Fetch the complete DM with participants
      const { data: completeDM, error: fetchError } = await supabase
        .from('channels')
        .select(`
          *,
          profiles:channel_participants(
            profile_id,
            profiles (username)
          )
        `)
        .eq('id', newChannel.id)
        .single();

      if (fetchError) throw fetchError;
      
      setCurrentChannel(completeDM);
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
      .match({ id: message.id });

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
    <div className="flex h-screen bg-black text-white">
      <div className="w-64 border-r border-green-800/50">
        <ChannelList
          currentChannel={currentChannel}
          onSelectChannel={setCurrentChannel}
          onCreateChannel={() => setShowCreateChannel(true)}
          onCreateDM={() => setShowUserSearch(true)}
        />
      </div>

      <div className="flex-1 flex flex-col">
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
    </div>
  );
};

export default ChatInterface;