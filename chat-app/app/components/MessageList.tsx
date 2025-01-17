'use client';

import { Message, MessageType } from '@/types/message';
import { formatTimestamp } from '@/utils/formatTime';
import FilePreview from './FilePreview';
import MessageReactions from './MessageReactions';
import { useUser } from '@/hooks/useUser';
import { Bot as BotIcon, Search as SearchIcon } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
  setContextMenu: (contextMenu: { message: Message; position: { x: number; y: number } } | null) => void;
  setActiveThread: (message: Message | null) => void;
}

export default function MessageList({ messages, setContextMenu, setActiveThread }: MessageListProps) {
  const { user } = useUser();

  const getMessageTypeIcon = (type?: MessageType) => {
    switch (type) {
      case 'rag_query':
        return <SearchIcon className="w-4 h-4 text-blue-500 mr-2" />;
      case 'rag_response':
        return <BotIcon className="w-4 h-4 text-green-500 mr-2" />;
      default:
        return null;
    }
  };

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
    return (
      <div className="flex items-start">
        {getMessageTypeIcon(message.type)}
        <span className={`text-[var(--text-primary)] flex-1 whitespace-pre-wrap ${message.type === 'rag_response' ? 'font-medium' : ''}`}>
          {message.content}
        </span>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-900">
      {messages?.map((message) => (
        <div 
          key={message.id} 
          className={`message-row group hover:bg-gray-950/50 hover:shadow-lg transition-all duration-150 px-4 py-1 ${
            message.profiles?.is_bot ? 'bg-gray-800/50' : ''
          }`}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({
              message,
              position: { x: e.clientX, y: e.clientY }
            });
          }}
        >
          <div className="flex items-start gap-x-3 py-0.5">
            <div 
              className="flex-shrink-0 w-9 h-9 rounded overflow-hidden"
              onClick={() => setActiveThread(message)}
            >
              {message.profiles?.is_bot ? (
                <div className="w-full h-full flex items-center justify-center bg-green-100 text-green-600">
                  <BotIcon className="w-5 h-5" />
                </div>
              ) : (
                message.profiles?.profile_picture_url ? (
                  <img
                    src={message.profiles.profile_picture_url}
                    alt={message.profiles.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-600">
                    {message.profiles?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                )
              )}
            </div>
            
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center gap-x-2">
                <span className="font-medium">
                  {message.profiles?.username || 'Unknown User'}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {formatTimestamp(message.created_at)}
                </span>
              </div>
              
              <div className="mt-0.5">
                {renderMessageContent(message)}
              </div>

              <MessageReactions message={message} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}