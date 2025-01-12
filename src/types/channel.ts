export interface Channel {
  id: string;
  name: string;
  type: 'channel' | 'dm';
  created_at: string;
  created_by: string;
  channel_members?: {
    user_id: string;
    profiles: {
      id: string;
      username: string;
    };
  }[];
} 