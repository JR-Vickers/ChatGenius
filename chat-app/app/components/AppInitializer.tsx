'use client';

import { useEffect } from 'react';
import { initializeApp } from '@/utils/initApp';

export default function AppInitializer() {
  useEffect(() => {
    initializeApp().catch(console.error);
  }, []);

  return null;
} 