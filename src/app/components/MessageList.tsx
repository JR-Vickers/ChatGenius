'use client';

import { Message } from '@/types/message';
import { formatTimestamp } from '@/utils/formatTime';
import FilePreview from './FilePreview';

interface MessageListProps {
  messages: Message[];
  onContextMenu: (e: React.MouseEvent, message: Message) => void;
  channelType?: 'channel' | 'dm';
}

export default function MessageList({ messages, onContextMenu, channelType = 'channel' }: MessageListProps) {
  const renderMessageContent = (message: Message) => {
    // Check for file message format: [File: filename](filepath)
    const fileMatch = message.content.match(/\[File: (.*?)\]\((.*?)\)/);
    if (fileMatch) {
      const [_, fileName, filePath] = fileMatch;
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
    return <span className="text-gray-300 flex-1">{message.content}</span>;
  };

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {messages?.map((message) => (
        <div 
          key={message.id} 
          className="group"
          onContextMenu={(e) => {
            e.preventDefault();
            onContextMenu(e, message);
          }}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-gray-400">
              {channelType === 'dm' ? '@' : ''}{message.profiles?.username || 'anonymous'}
            </span>
            <span className="text-green-500">{formatTimestamp(message.created_at)}</span>
            {renderMessageContent(message)}
          </div>
        </div>
      ))}
    </div>
  );
}