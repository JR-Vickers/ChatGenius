'use client';

import { useState, useRef } from 'react';
import axios from 'axios';

interface UploadResponse {
  document_ids: string[];
}

interface Document {
  content: string;
  score: number;
  filename?: string;
  chunk_index?: number;
}

interface Message {
  role: 'user' | 'assistant' | 'error';
  content: string;
  documents?: Document[];
}

interface QueryResponse {
  answer: string;
  documents: Document[];
}

const API_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL;

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('Uploading...');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post<UploadResponse>(`${API_URL}/index/file`, formData);
      setUploadStatus(`File uploaded successfully! Document ID: ${response.data.document_ids[0]}`);
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setUploadStatus('Error uploading file');
      console.error('Upload error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    const userQuery = query;
    setQuery(''); // Clear input immediately

    try {
      const response = await axios.post<QueryResponse>(`${API_URL}/query`, { query: userQuery });
      setMessages(prev => [
        ...prev, 
        { role: 'user', content: userQuery },
        { 
          role: 'assistant', 
          content: response.data.answer,
          documents: response.data.documents
        }
      ]);
    } catch (error) {
      console.error('Query error:', error);
      setMessages(prev => [
        ...prev,
        { role: 'user', content: userQuery },
        { 
          role: 'error', 
          content: 'Sorry, I encountered an error processing your request.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  function formatMessage(message: Message) {
    if (message.role === 'user') {
      return (
        <div className="message user-message">
          <div className="font-medium text-blue-700 mb-2">You asked:</div>
          <div className="text-blue-900">{message.content}</div>
        </div>
      );
    }

    if (message.role === 'assistant') {
      return (
        <div className="message ai-message">
          <div className="font-medium text-gray-700 mb-2">AI Assistant:</div>
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: message.content }} />
          {message.documents && message.documents.length > 0 && (
            <div className="metadata">
              <div className="font-medium text-gray-700 mb-2">Relevant Documents:</div>
              {message.documents.map((doc, i) => (
                <div key={i} className="mb-4 last:mb-0 bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-primary-600 font-medium">Score: {doc.score.toFixed(4)}</span>
                    {doc.filename && (
                      <span className="text-gray-600">
                        From: {doc.filename} {doc.chunk_index !== undefined && `(Part ${doc.chunk_index + 1})`}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-700 text-sm">{doc.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (message.role === 'error') {
      return (
        <div className="message error-message">
          <div className="font-medium text-red-700 mb-2">Error:</div>
          <div className="text-red-900">{message.content}</div>
        </div>
      );
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">ChatGenius AI</h1>
        
        {/* File Upload Section */}
        <div className="mb-8 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Documents</h2>
          <div className="flex items-center gap-4">
            <input
              type="file"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="flex-1 text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              accept=".pdf,.txt"
            />
            {uploadStatus && (
              <p className="text-sm text-gray-600">{uploadStatus}</p>
            )}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="mb-8 space-y-6">
          {messages.map((message, index) => (
            <div key={index}>
              {formatMessage(message)}
            </div>
          ))}
        </div>

        {/* Query Input */}
        <form onSubmit={handleSubmit} className="flex gap-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about your documents..."
            className="flex-1 p-3 rounded-lg border border-gray-200 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className={`px-6 py-3 rounded-lg font-medium text-white shadow-sm ${
              isLoading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {isLoading ? 'Thinking...' : 'Ask'}
          </button>
        </form>
      </div>
    </main>
  );
} 