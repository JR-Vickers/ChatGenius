'use client';

import { Message } from '../../types/message';
import { formatTimestamp } from '../../utils/formatTime';
import MessageInput from './MessageInput';
import { useQuery } from '@tanstack/react-query';
import { createSupabaseClient } from '../../utils/supabase';
// import FilePreview from './FilePreview';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const supabase = createSupabaseClient();

interface ThreadPanelProps {
  thread: Message;
  onClose: () => void;
}

export default function ThreadPanel({ thread, onClose }: ThreadPanelProps) {
  const { data: threadMessages } = useQuery({
    queryKey: ['messages', thread.id, 'replies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          channel_id,
          thread_id,
          user_id,
          profiles (
            username
          )
        `)
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: true })
        .returns<Message[]>();

      if (error) throw error;
      return data || [];
    },
    refetchOnWindowFocus: false,
    refetchInterval: 1000,
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`thread-${thread.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `thread_id=eq.${thread.id}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['messages', thread.id, 'replies'] });
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [thread.id, queryClient]);

  const handleSendReply = async (content: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user found');
        return;
      }

      const { error } = await supabase.from('messages').insert([{
        content,
        channel_id: thread.channel_id,
        user_id: user.id,
        thread_id: thread.id,
        created_at: new Date().toISOString()
      }]);

      if (error) {
        console.error('Error sending reply:', error);
        throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['messages', thread.id, 'replies'] });
    } catch (error) {
      console.error('Failed to send reply:', error);
      throw error;
    }
  };

  return (
    <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-100">Thread</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
            {thread.profiles?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-100">{thread.profiles?.username}</span>
              <span className="text-xs text-gray-400">{formatTimestamp(thread.created_at)}</span>
            </div>
            <div className="text-gray-300 mt-1">{thread.content}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {threadMessages?.map((message) => (
          <div key={message.id} className="px-4 py-3 hover:bg-gray-700/50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                {message.profiles?.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-100">{message.profiles?.username}</span>
                  <span className="text-xs text-gray-400">{formatTimestamp(message.created_at)}</span>
                </div>
                <div className="text-gray-300 mt-1">{message.content}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-700">
        <MessageInput 
          onSendMessage={handleSendReply}
          placeholder="Reply to thread..."
          currentChannel={{ 
            id: thread.channel_id,
            name: '',
            type: 'channel',
            created_at: '',
            created_by: ''
          }}
        />
      </div>
    </div>
  );
}