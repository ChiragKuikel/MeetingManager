// app/summary/[id]/page.tsx
'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import VideoSummary from '@/components/VideoSummary';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function SummaryPage() {
  useRequireAuth();
  const params = useParams();
  const videoId = parseInt(params.id as string);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <VideoSummary videoId={videoId} />
    </div>
  );
}
