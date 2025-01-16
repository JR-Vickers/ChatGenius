'use client';

import { useState, useRef, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useMessageReactions } from '@/hooks/useMessageReactions';
import { useQueryClient } from '@tanstack/react-query';
import { MessageReaction } from '@/types/message';

interface MessageReactionsProps {
  messageId: string;
  currentUserId: string;
}

export default function MessageReactions({ messageId, currentUserId }: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const pickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const supabase = createSupabaseClient();
  const reactions = useMessageReactions(messageId);
  const queryClient = useQueryClient();

  // Calculate picker position when showing
  const updatePickerPosition = () => {
    if (!buttonRef.current || !pickerRef.current) return;
    
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const pickerRect = pickerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Start with positioning above the button
    let top = buttonRect.top - pickerRect.height - 10;
    let left = buttonRect.left - (pickerRect.width / 2) + (buttonRect.width / 2);

    // If it would go off the top, position it below instead
    if (top < 0) {
      top = buttonRect.bottom + 10;
    }

    // If it would go off the bottom, adjust up
    if (top + pickerRect.height > viewportHeight) {
      top = viewportHeight - pickerRect.height - 10;
    }

    // Prevent horizontal overflow
    if (left < 10) {
      left = 10;
    } else if (left + pickerRect.width > viewportWidth) {
      left = viewportWidth - pickerRect.width - 10;
    }

    setPickerPosition({ top, left });
  };

  // Update position when picker is shown
  useEffect(() => {
    if (showPicker) {
      // Initial position
      updatePickerPosition();
      
      // Update on resize
      window.addEventListener('resize', updatePickerPosition);
      // Update on scroll
      window.addEventListener('scroll', updatePickerPosition);

      return () => {
        window.removeEventListener('resize', updatePickerPosition);
        window.removeEventListener('scroll', updatePickerPosition);
      };
    }
  }, [showPicker]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && 
          buttonRef.current && 
          !pickerRef.current.contains(event.target as Node) &&
          !buttonRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    // Handle escape key
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showPicker]);

  // Group reactions by emoji
  const groupedReactions = reactions?.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = {
        count: 0,
        users: [],
        hasReacted: false
      };
    }
    acc[reaction.emoji].count++;
    acc[reaction.emoji].users.push(reaction.profiles?.username || 'Unknown');
    if (reaction.user_id === currentUserId) {
      acc[reaction.emoji].hasReacted = true;
    }
    return acc;
  }, {} as Record<string, { count: number; users: string[]; hasReacted: boolean }>);

  const handleAddReaction = async (emoji: any) => {
    try {
      console.log('🎯 Attempting to add/toggle reaction:', {
        messageId,
        userId: currentUserId,
        emoji: emoji.native
      });

      // First check if the reaction already exists
      const { data: existingReaction } = await supabase
        .from('message_reactions')
        .select('id')
        .match({
          message_id: messageId,
          user_id: currentUserId,
          emoji: emoji.native
        })
        .single();

      console.log('🔍 Existing reaction check:', existingReaction);

      // If reaction exists, remove it
      if (existingReaction) {
        console.log('🔄 Reaction exists, removing it');
        return handleRemoveReaction(emoji.native);
      }

      // Otherwise, add new reaction
      console.log('➕ Adding new reaction');
      const { error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: currentUserId,
          emoji: emoji.native,
        });

      if (error) {
        console.error('❌ Error adding reaction:', error);
        throw error;
      }
      console.log('✅ Reaction added successfully');
      setShowPicker(false);
    } catch (error) {
      console.error('❌ Error in handleAddReaction:', error);
    }
  };

  const handleRemoveReaction = async (emoji: string) => {
    console.log('🗑️ Removing reaction:', { messageId, userId: currentUserId, emoji });
    
    // Get current cache
    const queryKey = ['reactions', messageId];
    const currentData = queryClient.getQueryData<MessageReaction[]>(queryKey) || [];
    
    // Optimistically remove from cache
    const newData = currentData.filter((reaction: MessageReaction) => 
      !(reaction.message_id === messageId && 
        reaction.user_id === currentUserId && 
        reaction.emoji === emoji)
    );
    
    console.log('💾 Optimistically updating cache:', {
      before: currentData.length,
      after: newData.length
    });
    
    // Update cache immediately
    queryClient.setQueryData(queryKey, newData);

    try {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', currentUserId)
        .eq('emoji', emoji);

      if (error) {
        // Rollback on error
        console.error('❌ Error removing reaction:', error);
        queryClient.setQueryData(queryKey, currentData);
        throw error;
      }
      
      console.log('✅ Reaction removed successfully');
    } catch (error) {
      // Rollback on error
      console.error('❌ Error removing reaction:', error);
      queryClient.setQueryData(queryKey, currentData);
      throw error;
    }
  };

  return (
    <div className="flex items-center gap-2 mt-1 relative">
      {Object.entries(groupedReactions || {}).map(([emoji, { count, users, hasReacted }]) => (
        <button
          key={emoji}
          onClick={() => hasReacted ? handleRemoveReaction(emoji) : handleAddReaction({ native: emoji })}
          className={`px-2 py-1 rounded hover:bg-[var(--hover)] transition-colors ${
            hasReacted ? 'bg-[var(--hover)]' : ''
          }`}
          title={`${users.join(', ')}`}
        >
          <span className="mr-1">{emoji}</span>
          <span className="text-xs text-[var(--text-secondary)]">{count}</span>
        </button>
      ))}
      <button
        ref={buttonRef}
        onClick={() => setShowPicker(!showPicker)}
        className="p-1 rounded hover:bg-[var(--hover)] opacity-100 transition-opacity"
      >
        <span className="text-[var(--text-secondary)]">+</span>
      </button>
      {showPicker && (
        <div 
          ref={pickerRef}
          className="fixed z-[9999]"
          style={{ 
            top: `${pickerPosition.top}px`,
            left: `${pickerPosition.left}px`,
          }}
        >
          <Picker
            data={data}
            onEmojiSelect={(emoji: { native: string }) => {
              handleAddReaction(emoji);
              setShowPicker(false);
            }}
            theme="dark"
          />
        </div>
      )}
    </div>
  );
} 