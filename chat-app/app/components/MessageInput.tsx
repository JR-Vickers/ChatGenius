'use client';

import { useState, KeyboardEvent, useRef } from 'react';
import type { Channel } from '@/types/channel';
import { config } from '@/utils/config';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import styles from './MessageInput.module.css';
import { Search as SearchIcon } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (message: string, type?: 'text' | 'rag_query') => Promise<void>;
  placeholder?: string;
  currentChannel: Channel;
}

export default function MessageInput({ 
  onSendMessage, 
  placeholder = "Type a message...",
  currentChannel
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [isRagMode, setIsRagMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const handleKeyPress = async (e: KeyboardEvent<HTMLInputElement>) => {
    // Toggle RAG mode with Ctrl+/
    if (e.ctrlKey && e.key === '/') {
      e.preventDefault();
      setIsRagMode(!isRagMode);
      console.log('RAG mode toggled:', !isRagMode);
      return;
    }

    // Handle message send
    if (e.key === 'Enter' && message.trim()) {
      e.preventDefault();
      try {
        const trimmedMessage = message.trim();
        console.log('Sending message:', { trimmedMessage, isRagMode });
        setMessage('');
        
        // If in RAG mode or using /rag command, treat as RAG query
        if (isRagMode || trimmedMessage.startsWith('/rag ')) {
          const query = trimmedMessage.startsWith('/rag ') ? trimmedMessage.slice(5) : trimmedMessage;
          console.log('Processing RAG query:', query);
          await handleRagQuery(query);
        } else {
          console.log('Sending regular message');
          await onSendMessage(trimmedMessage, 'text');
        }
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  };

  const handleRagQuery = async (query: string) => {
    console.log('handleRagQuery called with:', query);
    setQuerying(true);
    try {
      console.log('Sending RAG query to parent');
      await onSendMessage(query, 'rag_query');
    } catch (error) {
      console.error('Failed to process RAG query:', error);
    } finally {
      setQuerying(false);
      setIsRagMode(false);
    }
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${config.aiServiceUrl}/index/file`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) throw new Error('Failed to upload file');
    return response.json();
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadFile(file);
      await onSendMessage(
        `📄 Document Uploaded: ${file.name}\n` +
        `Press Ctrl+/ to ask questions about this document`
      );
    } catch (error) {
      console.error('Upload error:', error);
      await onSendMessage(`❌ Upload failed: ${file.name}`);
    } finally {
      setUploading(false);
    }
  };

  const handleEmojiSelect = (emoji: any) => {
    setMessage(prev => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  if (!currentChannel) return null;

  return (
    <div className="px-4 pb-4">
      <div className={`flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--input-background)] p-2 ${
        isRagMode ? 'ring-2 ring-blue-500' : ''
      }`}>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 hover:bg-[var(--hover)] rounded"
          disabled={uploading || querying}
        >
          <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>

        <div className="relative flex-1">
          {isRagMode && (
            <div className="absolute left-2 top-1/2 -translate-y-1/2">
              <SearchIcon className="w-4 h-4 text-blue-500" />
            </div>
          )}
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={isRagMode ? "Ask a question about your documents... (Enter to send)" : placeholder}
            className={`w-full bg-transparent outline-none placeholder-[var(--text-secondary)] ${
              isRagMode ? 'pl-8' : ''
            }`}
            disabled={uploading || querying}
          />
        </div>

        <button
          ref={emojiButtonRef}
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-2 hover:bg-[var(--hover)] rounded"
          disabled={uploading || querying}
        >
          😊
        </button>

        {showEmojiPicker && (
          <div className="absolute bottom-full right-0 mb-2">
            <Picker 
              data={data} 
              onEmojiSelect={handleEmojiSelect}
              theme="dark"
            />
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFileUpload(file);
            }
          }}
        />
      </div>

      <div className="mt-1 text-xs text-[var(--text-secondary)]">
        {isRagMode ? (
          <span>RAG Mode: Ask questions about your documents (Ctrl+/ to toggle)</span>
        ) : (
          <span>Press Ctrl+/ to toggle RAG mode</span>
        )}
      </div>
    </div>
  );
}