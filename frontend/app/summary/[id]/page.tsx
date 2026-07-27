// app/summary/[id]/page.tsx
'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import VideoSummary from '@/components/VideoSummary';

export default function SummaryPage() {
  const params = useParams();
  const videoId = parseInt(params.id as string);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <VideoSummary videoId={videoId} />
    </div>
  );
}