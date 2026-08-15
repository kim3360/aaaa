'use client';

import { useEffect } from 'react';
import { bootAnalytics } from '@/lib/db';

export default function AnalyticsBoot() {
  useEffect(() => {
    bootAnalytics();
  }, []);
  return null;
}
