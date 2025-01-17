import { createClient } from '@supabase/supabase-js'

// Bot user configuration
export const BOT_CONFIG = {
  id: '00000000-0000-0000-0000-000000000000',  // Fixed UUID for the bot
  username: 'AI Assistant',
  avatar_url: '/bot-avatar.png',
  is_bot: true
} as const;

let adminClientInstance: ReturnType<typeof createClient> | null = null;

export const createAdminClient = () => {
  if (adminClientInstance) return adminClientInstance;
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  adminClientInstance = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  
  return adminClientInstance;
};

// Initialize the bot user in the database
export const initializeBotUser = async () => {
  const adminClient = createAdminClient();
  
  // Check if bot user already exists
  const { data: existingBot } = await adminClient
    .from('profiles')
    .select()
    .eq('id', BOT_CONFIG.id)
    .single();

  if (existingBot) {
    console.log('Bot user already exists');
    return;
  }

  // Create bot user profile
  const { error } = await adminClient
    .from('profiles')
    .insert([{
      id: BOT_CONFIG.id,
      username: BOT_CONFIG.username,
      profile_picture_url: BOT_CONFIG.avatar_url,
      is_bot: true,
      updated_at: new Date().toISOString()
    }]);

  if (error) {
    console.error('Failed to create bot user:', error);
    throw error;
  }
};

// Helper to send messages as the bot
export const sendBotMessage = async (content: string, channelId: string, type: 'text' | 'rag_response' = 'text') => {
  const adminClient = createAdminClient();
  
  const { error } = await adminClient
    .from('messages')
    .insert([{
      user_id: BOT_CONFIG.id,
      content,
      channel_id: channelId,
      type
    }]);

  if (error) {
    console.error('Failed to send bot message:', error);
    throw error;
  }
}; 