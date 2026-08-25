// app/search/page.tsx
'use client';

import React from 'react';
import SearchResults from '@/components/SearchResults';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function SearchPage() {
  useRequireAuth();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <SearchResults />
    </div>
  );
}
