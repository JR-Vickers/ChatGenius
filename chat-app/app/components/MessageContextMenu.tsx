'use client';

import React, { useEffect, useState } from 'react';
import { Message } from '@/types/message';
import { createSupabaseClient } from '@/utils/supabase';

const supabase = createSupabaseClient();

interface MessageContextMenuProps {
  message: Message;
  position: { x: number; y: number };
  onClose: () => void;
  onThreadClick: (message: Message) => void;
  onDelete?: (message: Message) => void;
  onEdit?: (message: Message) => void;
}

export default function MessageContextMenu({ 
  message, 
  position, 
  onClose, 
  onThreadClick,
  onDelete,
  onEdit 
}: MessageContextMenuProps) {
  const [canModify, setCanModify] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCanModify(message.user_id === user?.id);
    };
    checkAuth();
  }, [message.user_id]);

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
          onThreadClick(message);
          onClose();
        }}
      >
        Reply in Thread
      </button>
      {canModify && (
        <>
          <button 
            className="block w-full text-left px-4 py-2 hover:bg-gray-700 text-blue-500"
            onClick={() => {
              if (onEdit) {
                onEdit(message);
              }
              onClose();
            }}
          >
            Edit Message
          </button>
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
        </>
      )}
    </div>
  );
}

