'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createSupabaseClient } from '@/utils/supabase';
import { MessageReaction } from '@/types/message';
import { useEffect } from 'react';

const supabase = createSupabaseClient();

export function useMessageReactions(messageId: string) {
  console.log('🎯 useMessageReactions called with messageId:', messageId);
  const queryClient = useQueryClient();
  const queryKey = ['reactions', messageId];
  console.log('🔑 Query key created:', queryKey);

  // Query for reactions
  const { data: reactions = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      console.log(`🔍 Fetching reactions for message: ${messageId}`);
      const { data, error } = await supabase
        .from('message_reactions')
        .select(`
          id,
          emoji,
          user_id,
          message_id,
          created_at,
          profiles (
            username
          )
        `)
        .eq('message_id', messageId)
        .returns<MessageReaction[]>();

      if (error) {
        console.error('❌ Error fetching reactions:', error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} reactions:`, {
        data,
        messageId,
        timestamp: new Date().toISOString()
      });
      return data || [];
    }
  });

  // Set up real-time subscription
  useEffect(() => {
    console.log(`🔄 Setting up reaction subscription for message:`, {
      messageId,
      timestamp: new Date().toISOString(),
      currentReactions: reactions
    });
    
    const channel = supabase
      .channel(`message-reactions:${messageId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
          filter: `message_id=eq.${messageId}`
        },
        (payload) => {
          console.log('📨 Reaction change detected:', {
            eventType: payload.eventType,
            messageId,
            payload,
            timestamp: new Date().toISOString()
          });

          const currentData = queryClient.getQueryData<MessageReaction[]>(queryKey) || [];
          console.log('💾 Current cached reactions:', {
            currentData,
            length: currentData.length,
            messageId,
            timestamp: new Date().toISOString()
          });
          
          if (payload.eventType === 'INSERT') {
            console.log('➕ Adding new reaction:', {
              new: payload.new,
              currentDataLength: currentData.length,
              timestamp: new Date().toISOString()
            });
            queryClient.setQueryData(queryKey, [...currentData, payload.new as MessageReaction]);
          } else if (payload.eventType === 'DELETE') {
            console.log('➖ DELETE event received:', {
              payload,
              old: payload.old,
              new: payload.new,
              currentData,
              messageId,
              timestamp: new Date().toISOString()
            });

            // Force refetch on DELETE
            console.log('🔄 Forcing refetch for messageId:', messageId);
            queryClient.invalidateQueries({
              queryKey,
              exact: true,
              refetchType: 'active'
            });

            // Still try to update cache immediately
            if (currentData.length > 0) {
              console.log('📝 Attempting cache update with current data:', {
                currentDataLength: currentData.length,
                messageId
              });

              // Debug what we're trying to match against
              console.log('🔍 Current reactions before filtering:', currentData);
              
              const newData = currentData.filter(reaction => {
                // Check if this is the reaction we want to remove
                const isTarget = reaction.message_id === messageId && 
                               reaction.user_id === payload.old?.user_id;
                
                console.log('🎯 Checking reaction:', {
                  reaction,
                  isTarget,
                  messageId,
                  reactionUserId: reaction.user_id,
                  payloadUserId: payload.old?.user_id
                });
                
                return !isTarget;
              });

              console.log('💾 Cache update attempt:', {
                before: currentData.length,
                after: newData.length,
                diff: currentData.length - newData.length,
                messageId
              });

              queryClient.setQueryData(queryKey, newData);
            } else {
              console.log('⚠️ No data in cache to update for DELETE');
            }
          }

          // Log the final state after update
          const updatedData = queryClient.getQueryData<MessageReaction[]>(queryKey);
          console.log('✅ Final cache state:', {
            data: updatedData,
            length: updatedData?.length || 0,
            messageId,
            timestamp: new Date().toISOString(),
            ids: updatedData?.map(r => r.id)
          });
        }
      )
      .subscribe((status) => {
        console.log(`📡 Reaction subscription status:`, {
          messageId,
          status,
          timestamp: new Date().toISOString()
        });
      });

    return () => {
      console.log(`🔌 Cleaning up reaction subscription:`, {
        messageId,
        timestamp: new Date().toISOString()
      });
      supabase.removeChannel(channel);
    };
  }, [messageId, queryClient, reactions]);

  // Log whenever reactions change
  useEffect(() => {
    console.log(`🔄 Reactions updated:`, {
      messageId,
      reactions,
      length: reactions.length,
      ids: reactions.map(r => r.id),
      timestamp: new Date().toISOString()
    });
  }, [reactions, messageId]);

  return reactions;
} 