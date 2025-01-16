// Single, clean interface for messages
export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  profiles?: {
    username: string;
  };
}

export interface Message {
  id: string;
  content: string;
  created_at: string;
  channel_id: string;
  user_id: string;
  thread_id?: string | null;
  profiles?: {
    username: string;
    profile_picture_url?: string;
  };
  reactions?: MessageReaction[];
  message_reactions?: MessageReaction[]; // For Supabase response
}