'use client';

import { useState, KeyboardEvent } from 'react';
import FileUpload from './FileUpload';

interface MessageInputProps {
  onSendMessage: (content: string) => Promise<void>;
  placeholder?: string;
  currentChannel?: { id: string };
}

export default function MessageInput({ 
  onSendMessage, 
  placeholder = "Type a message...",
  currentChannel
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showFileUpload, setShowFileUpload] = useState(false);

  const handleKeyPress = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && message.trim()) {
      e.preventDefault();
      try {
        await onSendMessage(message.trim());
        setMessage('');
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  };

  if (!currentChannel) return null;

  return (
    <div className="px-4 pb-4">
      <div className="flex items-center">
        <button
          onClick={() => setShowFileUpload(!showFileUpload)}
          className="px-3 py-2 text-[#ABABAD] hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          className="message-input flex-1 py-2 px-3 text-[#D1D2D3]"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}