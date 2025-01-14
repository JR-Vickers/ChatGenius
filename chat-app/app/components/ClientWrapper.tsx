'use client';

import dynamic from 'next/dynamic';

const AuthWrapper = dynamic(
  () => import('./AuthWrapper'),
  { ssr: false }
);

export default function ClientWrapper() {
  return <AuthWrapper />;
}