'use client';

import { Message } from '@/types/message';
import { formatTimestamp } from '@/utils/formatTime';
import MessageInput from './MessageInput';
import { useQuery } from '@tanstack/react-query';
import { createSupabaseClient } from '@/utils/supabase';
import FilePreview from './FilePreview';

const supabase = createSupabaseClient();

interface ThreadPanelProps {
  parentMessage: Message;
  onSendReply: (content: string) => Promise<void>;
  onClose: () => void;
  placeholder?: string;
}

export default function ThreadPanel({ 
  parentMessage, 
  onSendReply,
  onClose,
  placeholder 
}: ThreadPanelProps) {
  const { data: threadMessages = [] } = useQuery<Message[]>({
    queryKey: ['thread', parentMessage?.id],
    queryFn: async () => {
      if (!parentMessage?.id) return [];

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
        .eq('thread_id', parentMessage.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching thread messages:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!parentMessage?.id
  });

  const renderMessageContent = (message: Message) => {
    // Check for file message format: [File: filename](filepath)
    const fileMatch = message.content.match(/\[File: (.*?)\]\((.*?)\)/);
    if (fileMatch) {
      const [fileName, filePath] = fileMatch;
      return (
        <FilePreview
          file={{
            name: fileName,
            path: filePath,
            type: fileName.split('.').pop()?.toLowerCase() || '',
            size: 0
          }}
        />
      );
    }
    
    // Regular text message
    return <span className="text-gray-300">{message.content}</span>;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-green-800/50">
        <div className="flex justify-between items-center">
          <span className="text-green-500">Thread</span>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-400">×</button>
        </div>
        <div className="mt-2">
          <span className="text-gray-400">{parentMessage.profiles?.username || 'anonymous'}</span>
          <span className="text-gray-300"> {parentMessage.content}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {threadMessages?.map((message) => (
          <div key={message.id} className="py-1">
            <div className="flex items-baseline gap-2">
              <span className="text-gray-400">{message.profiles?.username || 'anonymous'}</span>
              <span className="text-green-500">{formatTimestamp(message.created_at)}</span>
              {renderMessageContent(message)}
            </div>
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-green-800/50">
        <MessageInput 
          onSendMessage={onSendReply}
          placeholder={placeholder || "Reply to thread..."}
          currentChannel={{ id: parentMessage.channel_id }}
        />
      </div>
    </div>
  );
}