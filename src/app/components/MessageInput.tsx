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
    <div>
      {showFileUpload && (
        <FileUpload
          channelId={currentChannel.id}
          onUploadComplete={(fileData) => {
            onSendMessage(`[File: ${fileData.name}](${fileData.path})`);
            setShowFileUpload(false);
          }}
        />
      )}
      <div className="flex items-center">
        <button
          onClick={() => setShowFileUpload(!showFileUpload)}
          className="text-green-500 hover:text-green-400 px-2"
        >
          [📎]
        </button>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-full bg-black border border-green-800/50 p-2 text-gray-200"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}