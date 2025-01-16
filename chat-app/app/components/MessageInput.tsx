'use client';

import { useState, KeyboardEvent, useRef } from 'react';
import type { Channel } from '@/types/channel';
import { config } from '@/utils/config';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import styles from './MessageInput.module.css';

interface MessageInputProps {
  onSendMessage: (message: string, sender?: string) => Promise<void>;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const handleKeyPress = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && message.trim()) {
      e.preventDefault();
      try {
        const trimmedMessage = message.trim();
        setMessage('');
        
        // Check for RAG query command
        if (trimmedMessage.startsWith('/rag ')) {
          const query = trimmedMessage.slice(5);
          await handleRagQuery(query);
        } else {
          await onSendMessage(trimmedMessage);
        }
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  };

  const handleRagQuery = async (query: string) => {
    setQuerying(true);
    try {
      // First send the query message
      await onSendMessage(`🔍 *RAG Query:* ${query}`, 'ChatGenius 🤖');
      await onSendMessage(`_Thinking..._`, 'ChatGenius 🤖');

      const response = await fetch('http://localhost:8000/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          k: 3
        }),
      });

      if (!response.ok) throw new Error('Query failed');

      const result = await response.json();
      
      // Format the response in a more readable way
      const formattedResponse = [
        '🤖 *AI Response:*',
        result.answer,
        '',
        '📚 *Sources:*'
      ];

      // Add each source as a separate message for better readability
      await onSendMessage(formattedResponse.join('\n'), 'ChatGenius 🤖');
      
      // Send sources as separate messages
      for (const [i, r] of result.results.entries()) {
        await onSendMessage(`>*Source ${i + 1}:*\n>${r.content.split('\n').join('\n>')}`, 'ChatGenius 🤖');
      }

    } catch (error) {
      console.error('Query error:', error);
      await onSendMessage('❌ Failed to query documents', 'ChatGenius 🤖');
    } finally {
      setQuerying(false);
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
        `📄 *Document Uploaded Successfully*\n` +
        `\`${file.name}\` (ID: \`${result.document_ids[0]}\`)\n\n` +
        `Try asking questions about it using \`/rag your question\``
      );
    } catch (error) {
      console.error('Upload error:', error);
      await onSendMessage(`❌ Failed to upload \`${file.name}\``);
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
      <div className="flex items-center relative">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
          accept=".pdf,.txt"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || querying}
          className="px-3 py-2 text-[#ABABAD] hover:text-white disabled:opacity-50"
        >
          {uploading ? '⏳' : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          )}
        </button>
        <button
          ref={emojiButtonRef}
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className={`px-3 py-2 text-[#ABABAD] hover:text-white ${styles.emojiButton}`}
        >
          😊
        </button>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          className="message-input flex-1 py-2 px-3 text-[#D1D2D3]"
          placeholder={
            uploading ? 'Uploading...' : 
            querying ? 'Thinking...' :
            (placeholder + ' (Use /rag to query documents)')
          }
          disabled={uploading || querying}
        />
        {showEmojiPicker && (
          <div className={`absolute bottom-full left-0 mb-2 ${styles.emojiPickerWrapper}`}>
            <Picker
              data={data}
              onEmojiSelect={handleEmojiSelect}
              theme="dark"
            />
          </div>
        )}
      </div>
    </div>
  );
}