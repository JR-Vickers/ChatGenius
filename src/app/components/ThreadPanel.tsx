'use client';

import { Message } from '@/types/message';
import { formatTimestamp } from '../../utils/formatTime';
import MessageInput from './MessageInput';

interface ThreadPanelProps {
  parentMessage: Message;
  threadMessages: Message[];
  onSendReply: (content: string) => Promise<void>;
  onClose: () => void;
}

export default function ThreadPanel({ 
  parentMessage, 
  threadMessages, 
  onSendReply,
  onClose 
}: ThreadPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-green-800/50 flex justify-between items-center">
        <div className="text-green-500">Thread</div>
        <button onClick={onClose} className="text-green-500 hover:text-green-400">×</button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {/* Parent message */}
        <div className="pb-2 mb-2 border-b border-green-800/50">
          <div className="text-gray-200">{parentMessage.content}</div>
        </div>

        {/* Thread replies */}
        {threadMessages.map(message => (
          <div key={message.id} className="py-1 flex items-center">
            <span className="text-green-500">[</span>
            <span className="text-gray-400">anonymous</span>
            <span className="text-green-500">]</span>
            <span className="text-green-500 ml-2">{formatTimestamp(message.created_at)}</span>
            <span className="text-gray-300 ml-2">{message.content}</span>
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-green-800/50">
        <MessageInput 
          onSendMessage={onSendReply} 
          placeholder="Reply..."
        />
      </div>
    </div>
  );
}