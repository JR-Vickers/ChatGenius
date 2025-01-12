'use client';

import { Message } from '@/types/message';
import { formatTimestamp } from '@/utils/formatTime';

interface MessageListProps {
  messages: Message[];
  onContextMenu: (e: React.MouseEvent, message: Message) => void;
}

export default function MessageList({ messages, onContextMenu }: MessageListProps) {
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
            <span className="text-gray-400">{message.profiles?.username || 'anonymous'}</span>
            <span className="text-green-500">{formatTimestamp(message.created_at)}</span>
            <span className="text-gray-300">{message.content}</span>
          </div>
        </div>
      ))}
    </div>
  );
}