'use client';

import { useState } from 'react';
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
  const supabase = createSupabaseClient();
  const reactions = useMessageReactions(messageId);
  const queryClient = useQueryClient();

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
        onClick={() => setShowPicker(!showPicker)}
        className="p-1 rounded hover:bg-[var(--hover)] opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <span className="text-[var(--text-secondary)]">+</span>
      </button>
      {showPicker && (
        <div className="absolute bottom-full left-0 mb-2 z-50">
          <Picker
            data={data}
            onEmojiSelect={handleAddReaction}
            theme="dark"
          />
        </div>
      )}
    </div>
  );
} 