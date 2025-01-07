'use client';

import { useState, useEffect, useRef } from 'react';
import { signOut } from '@/utils/auth';
import { createSupabaseClient } from '@/utils/supabase';
import { User } from '@supabase/supabase-js';
import { Message } from '@/types/message';

const supabase = createSupabaseClient();

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
}

interface Profile {
  id: number;
  username: string;
  updated_at: string;
}

const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    // Get current user and their profile
    const initUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('Current user:', user);
    
        if (user) {
          setUser(user);
          
          // Add error handling to profile fetch
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('username, id')
            .eq('id', user.id)
            .maybeSingle();
    
          if (error) {
            console.error('Error fetching profile:', error);
            setProfile(null);
          } else {
            console.log('Successfully fetched profile:', profile);
            setProfile(profile);
          }
        }
      } catch (err) {
        console.error('Error in initUser:', err);
      }
    };

    // Set up real-time subscription
    channelRef.current = supabase
      .channel('public:messages')
      .on('postgres_changes', 
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('New message received:', payload);
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe(status => {
        console.log('Subscription status:', status);
      });

    // Initialize user and fetch messages
    initUser();
    fetchMessages();

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }
    
    if (data) {
      console.log('Fetched messages:', data);
      setMessages(data);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    try {
      // Fetch current profile if we don't have it
      if (!profile) {
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user?.id)
          .single();
        
        if (currentProfile) {
          setProfile(currentProfile);
        }
      }
  
      const messageData = {
        content: newMessage,
        user_id: profile?.username || 'anonymous'
      };
  
      console.log('Sending message:', messageData);
      
      const { error } = await supabase
        .from('messages')
        .insert([messageData]);
  
      if (error) {
        console.error('Error sending message:', error);
        return;
      }
  
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="flex flex-col h-screen bg-black font-mono text-gray-200">
      {/* Status bar */}
      <div className="bg-green-900/30 text-gray-200 px-2 py-0.5 flex justify-between items-center border-b border-green-800/50">
        <div>[ChatGenius]</div>
        <button
          onClick={handleLogout}
          className="bg-green-800/30 px-2 hover:bg-green-700/40 text-xs"
        >
          [X] Logout
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-1">
        {messages.map((message) => (
          <div key={message.id} className="leading-5">
            <span className="text-green-500">[</span>
            <span className="text-gray-400">{message.user_id || 'anonymous'}</span>
            <span className="text-green-500">]</span>
            <span className="text-gray-500"> {formatTimestamp(message.created_at)}</span>
            <span className="text-gray-200"> {message.content}</span>
          </div>
        ))}
      </div>

      {/* Input area */}
      <form onSubmit={sendMessage} className="border-t border-green-900/30">
        <div className="flex bg-black p-1">
          <span className="text-green-500 mr-2">[*]</span>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 bg-black text-gray-200 focus:outline-none placeholder:text-gray-600"
            placeholder="Type a message..."
          />
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;