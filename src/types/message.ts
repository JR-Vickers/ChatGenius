// Single, clean interface for messages
export interface Message {
  id: string;
  content: string;
  created_at: string;
  channel_id: string;
  user_id: string;
  parent_id: string | null;
  profiles: {
    username: string;
  };
}