'use client';

import { Message } from '../../types/message';
import { formatTimestamp } from '../../utils/formatTime';
import FilePreview from './FilePreview';
import MessageReactions from './MessageReactions';
import { useUser } from '@/hooks/useUser';

interface MessageListProps {
  messages: Message[];
  setContextMenu: (contextMenu: { message: Message; position: { x: number; y: number } } | null) => void;
  setActiveThread: (message: Message | null) => void;
}

export default function MessageList({ messages, setContextMenu, setActiveThread }: MessageListProps) {
  const { user } = useUser();

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
            size: 0 // We'll need to store this in the message or fetch it
          }}
        />
      );
    }
    
    // Regular text message
    return <span className="text-[var(--text-primary)] flex-1">{message.content}</span>;
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {messages?.map((message) => (
        <div 
          key={message.id} 
          className="message-row group hover:bg-[var(--hover-light)] px-4 py-1"
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({
              message,
              position: { x: e.clientX, y: e.clientY }
            });
          }}
          onClick={() => {
            if (message.thread_id) {
              setActiveThread(message);
            }
          }}
        >
          <div className="flex items-start gap-2">
            {message.profiles?.profile_picture_url ? (
              <img 
                src={message.profiles.profile_picture_url} 
                alt={message.profiles.username || 'User'} 
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[var(--active)] flex items-center justify-center text-white font-medium">
                {message.profiles?.username?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[var(--text-primary)]">{message.profiles?.username}</span>
                <span className="text-xs text-[var(--text-secondary)]">{formatTimestamp(message.created_at)}</span>
              </div>
              <div className="text-[var(--text-primary)]">{renderMessageContent(message)}</div>
              <MessageReactions
                messageId={message.id}
                currentUserId={user?.id || ''}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}