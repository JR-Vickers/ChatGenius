// Single, clean interface for messages
export interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  channel_id: string;
  parent_id: string | null;
  thread_id: string | null;
  profiles: {
    username: string;
  };
}