import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createSupabaseClient } from '@/utils/supabase';
import { Presence } from '@/types/presence';

const supabase = createSupabaseClient();

export function usePresence() {
  const queryClient = useQueryClient();

  // Get all online users
  const { data: onlineUsers } = useQuery<Presence[]>({
    queryKey: ['presence'],
    queryFn: async () => {
      // First, let's log the query we're about to make
      console.log('Querying presence...');

      const { data, error } = await supabase
        .from('presence')
        .select(`
          id,
          user_id,
          status,
          last_seen,
          profiles (username)
        `)
        .gt('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString());
      
      if (error) {
        console.error('Presence query error:', error);
        return [];
      }
      
      console.log('Presence query result:', data);
      const typedData = (data || []) as unknown as Presence[];
      return typedData;
    },
    // Refresh every 30 seconds
    refetchInterval: 30000
  });

  // Update user's own presence
  useEffect(() => {
    const updatePresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('Updating presence...', user.id);

      const { data, error } = await supabase
        .from('presence')
        .upsert({
          user_id: user.id,
          status: 'online',
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select();

      if (error) {
        console.error('Presence update error:', error);
      } else {
        console.log('Presence updated:', data);
      }
    };

    // Update presence immediately and every 30 seconds
    updatePresence();
    const interval = setInterval(updatePresence, 30000);

    // Subscribe to presence changes
    const channel = supabase
      .channel('presence_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'presence' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['presence'] });
        }
      )
      .subscribe();

    // Set offline status when component unmounts
    const handleUnload = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      await supabase
        .from('presence')
        .upsert({
          user_id: user.id,
          status: 'offline',
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [queryClient]);

  const setCustomStatus = async (status: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('presence')
      .upsert({
        user_id: user.id,
        custom_status: status,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
  };

  const setTypingStatus = async (isTyping: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('presence')
      .upsert({
        user_id: user.id,
        status: isTyping ? 'typing' : 'online',
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
  };

  return { onlineUsers };
}