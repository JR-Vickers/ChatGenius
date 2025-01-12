export interface Channel {
  id: string;
  name: string;
  type: 'channel' | 'dm';
  created_at: string;
  created_by: string;
  participants?: string[];
  profiles?: {
    username: string;
    id: string;
  }[];
} 