'use client';

import { useState, useRef, useEffect } from 'react';
import { Message, MessageType } from '@/types/message';
import { formatTimestamp } from '@/utils/formatTime';
import FilePreview from './FilePreview';
import MessageReactions from './MessageReactions';
import { useUser } from '@/hooks/useUser';
import { Bot as BotIcon, Search as SearchIcon } from 'lucide-react';
import { createSupabaseClient } from '@/utils/supabase';
import { useQueryClient } from '@tanstack/react-query';

const supabase = createSupabaseClient();

interface MessageListProps {
  messages: Message[];
  setContextMenu: (contextMenu: { message: Message; position: { x: number; y: number } } | null) => void;
  setActiveThread: (message: Message | null) => void;
}

export default function MessageList({ messages, setContextMenu, setActiveThread }: MessageListProps) {
  const { user } = useUser();
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState('');
  const queryClient = useQueryClient();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = listRef.current;
    if (!element) return;

    const handleStartEditEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Message>;
      setEditingMessage(customEvent.detail);
      setEditContent(customEvent.detail.content);
    };

    element.addEventListener('startEdit', handleStartEditEvent);
    return () => {
      element.removeEventListener('startEdit', handleStartEditEvent);
    };
  }, []);

  const handleSaveEdit = async () => {
    if (!editingMessage) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ content: editContent })
        .eq('id', editingMessage.id);

      if (error) throw error;

      // Refresh messages
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      setEditingMessage(null);
      setEditContent('');
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditContent('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

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
    if (editingMessage?.id === message.id) {
      return (
        <div className="flex flex-col gap-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyPress}
            className="w-full bg-gray-800 text-gray-100 p-2 rounded border border-gray-700 focus:border-green-500 focus:ring-1 focus:ring-green-500"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2 text-sm">
            <button
              onClick={handleSaveEdit}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded"
            >
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded"
            >
              Cancel
            </button>
            <span className="text-gray-400 ml-2">Press Enter to save, Esc to cancel</span>
          </div>
        </div>
      );
    }

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
    <div 
      ref={listRef}
      className="flex-1 overflow-y-auto bg-gray-900 message-list"
    >
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