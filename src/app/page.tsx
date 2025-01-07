import ChatInterface from './components/ChatInterface';
import ClientWrapper from './components/ClientWrapper';
import dynamic from 'next/dynamic';

export default function Home() {
  return <ClientWrapper />;
}

interface Message {
  id: number
  content: string
  created_at: string
  user_id: string
}