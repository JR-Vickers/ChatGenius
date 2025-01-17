'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createSupabaseClient } from '@/utils/supabase';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useMessageReactions } from '@/hooks/useMessageReactions';
import { useQueryClient } from '@tanstack/react-query';
import { Message, MessageReaction } from '@/types/message';
import { useUser } from '@/hooks/useUser';

interface MessageReactionsProps {
  message: Message;
}

export default function MessageReactions({ message }: MessageReactionsProps) {
  const { user } = useUser();
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const pickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const supabase = createSupabaseClient();
  const reactions = useMessageReactions(message.id);
  const queryClient = useQueryClient();

  // Calculate picker position when showing
  const updatePickerPosition = useCallback(() => {
    if (!buttonRef.current || !pickerRef.current) return;
    
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const pickerRect = pickerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let top = buttonRect.top - pickerRect.height - 10;
    let left = buttonRect.left - (pickerRect.width / 2) + (buttonRect.width / 2);

    if (top < 0) {
      top = buttonRect.bottom + 10;
    }

    if (top + pickerRect.height > viewportHeight) {
      top = viewportHeight - pickerRect.height - 10;
    }

    if (left < 10) {
      left = 10;
    }

    if (left + pickerRect.width > viewportWidth) {
      left = viewportWidth - pickerRect.width - 10;
    }

    setPickerPosition({ top, left });
  }, []);

  useEffect(() => {
    if (showPicker) {
      updatePickerPosition();
      
      // Add window resize listener
      window.addEventListener('resize', updatePickerPosition);
      
      // Cleanup
      return () => {
        window.removeEventListener('resize', updatePickerPosition);
      };
    }
  }, [showPicker, updatePickerPosition]);

  // Early return if no user
  if (!user) {
    return null;
  }

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc: Record<string, { count: number; users: string[]; hasReacted: boolean }>, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = { count: 0, users: [], hasReacted: false };
    }
    acc[reaction.emoji].count++;
    acc[reaction.emoji].users.push(reaction.profiles?.username || 'Unknown');
    if (reaction.user_id === user.id) {
      acc[reaction.emoji].hasReacted = true;
    }
    return acc;
  }, {});

  const handleAddReaction = async (emoji: any) => {
    setShowPicker(false);

    try {
      // Check if reaction already exists
      const { data: existingReaction } = await supabase
        .from('message_reactions')
        .select('id')
        .match({
          message_id: message.id,
          user_id: user.id,
          emoji: emoji.native
        })
        .single();

      if (existingReaction) {
        // Remove reaction if it exists
        await handleRemoveReaction(emoji.native);
      } else {
        // Add new reaction
        const { error } = await supabase
          .from('message_reactions')
          .insert({
            message_id: message.id,
            user_id: user.id,
            emoji: emoji.native,
          });

        if (error) throw error;
      }

      // Invalidate reactions query
      queryClient.invalidateQueries({
        queryKey: ['reactions', message.id]
      });
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  const handleRemoveReaction = async (emoji: string) => {
    try {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', message.id)
        .eq('user_id', user.id)
        .eq('emoji', emoji);

      if (error) throw error;

      // Invalidate reactions query
      queryClient.invalidateQueries({
        queryKey: ['reactions', message.id]
      });
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  };

  return (
    <div className="mt-1 flex items-center gap-2">
      {Object.entries(groupedReactions).map(([emoji, data]) => (
        <button
          key={emoji}
          onClick={() => handleRemoveReaction(emoji)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm ${
            data.hasReacted ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
          } hover:bg-gray-200 transition-colors`}
          title={data.users.join(', ')}
        >
          <span>{emoji}</span>
          <span>{data.count}</span>
        </button>
      ))}
      
      <button
        ref={buttonRef}
        onClick={() => setShowPicker(!showPicker)}
        className="text-gray-500 hover:text-gray-700"
      >
        +
      </button>

      {showPicker && (
        <div
          ref={pickerRef}
          style={{
            position: 'fixed',
            top: pickerPosition.top,
            left: pickerPosition.left,
            zIndex: 1000
          }}
        >
          <Picker
            data={data}
            onEmojiSelect={handleAddReaction}
            theme="light"
            previewPosition="none"
            skinTonePosition="none"
          />
        </div>
      )}
    </div>
  );
} 