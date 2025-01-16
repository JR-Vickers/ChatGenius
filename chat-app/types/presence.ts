export interface Presence {
  id: string;
  user_id: string;
  status: string;
  last_seen: string;
  updated_at: string;
  profiles?: {
    username: string;
    profile_picture_url?: string;
  };
} 