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

export type MessageType = 'text' | 'file' | 'rag_query' | 'rag_response';

export interface Message {
  id: string;
  content: string;
  created_at: string;
  channel_id: string;
  user_id: string;
  thread_id?: string;
  type?: MessageType;
  profiles?: {
    username: string;
    profile_picture_url?: string;
    is_bot?: boolean;
  };
  reactions?: MessageReaction[];
  message_reactions?: MessageReaction[]; // For Supabase response
}