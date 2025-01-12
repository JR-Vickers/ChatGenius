'use client';

import React, { useEffect, useState } from 'react';
import { Message } from '@/types/message';
import { createSupabaseClient } from '@/utils/supabase';

const supabase = createSupabaseClient();

interface MessageContextMenuProps {
  message: Message;
  position: { x: number; y: number };
  onClose: () => void;
  onReply: (message: Message) => void;
  onDelete?: (message: Message) => void;
}

export default function MessageContextMenu({ 
  message, 
  position, 
  onClose, 
  onReply,
  onDelete 
}: MessageContextMenuProps) {
  const [canDelete, setCanDelete] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCanDelete(!!onDelete && message.user_id === user?.id);
    };
    checkAuth();
  }, [message.user_id, onDelete]);

  useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div 
      className="fixed bg-gray-800 border border-green-800/50 p-2 rounded shadow-lg z-50"
      style={{ top: position.y, left: position.x }}
    >
      <button 
        className="block w-full text-left px-4 py-2 hover:bg-gray-700 text-green-500"
        onClick={() => {
          onReply(message);
          onClose();
        }}
      >
        Reply in Thread
      </button>
      {canDelete && (
        <button 
          className="block w-full text-left px-4 py-2 hover:bg-gray-700 text-red-500"
          onClick={() => {
            if (onDelete) {
              onDelete(message);
            }
            onClose();
          }}
        >
          Delete Message
        </button>
      )}
    </div>
  );
}

