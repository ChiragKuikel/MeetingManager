// components/SearchResults.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import { HiOutlineExclamationCircle, HiOutlineMagnifyingGlass } from 'react-icons/hi2';

interface SearchResult {
  sourceType: 'decision' | 'action_item' | 'open_question';
  text: string;
  videoId: number;
  videoTitle: string;
  score: number;
}

const TYPE_LABELS: Record<SearchResult['sourceType'], string> = {
  decision: 'Decision',
  action_item: 'Action Item',
  open_question: 'Open Question',
};

const SearchResults = () => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    try {
      setLoading(true);
      setError(null);
      setSearched(true);
      const response = await apiFetch(
        `http://localhost:3001/api/search?q=${encodeURIComponent(trimmed)}`
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || `Request failed (${response.status})`);
        return;
      }

      setResults(data.data);
    } catch (err) {
      console.error('Error searching:', err);
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const grouped = results.reduce<Record<number, { title: string; items: SearchResult[] }>>(
    (acc, result) => {
      if (!acc[result.videoId]) {
        acc[result.videoId] = { title: result.videoTitle, items: [] };
      }
      acc[result.videoId].items.push(result);
      return acc;
    },
    {}
  );

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6" style={{ color: '#35b3c9' }}>Search</h2>

      <form onSubmit={runSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search decisions, action items, open questions..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#35b3c9]"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-[#35b3c9] text-white flex items-center gap-2"
        >
          <HiOutlineMagnifyingGlass className="w-5 h-5" />
          Search
        </button>
      </form>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-[#35b3c9] border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <HiOutlineExclamationCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {!loading && !error && searched && Object.keys(grouped).length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No results found</p>
        </div>
      )}

      {!loading && !error && Object.keys(grouped).length > 0 && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([videoId, group]) => (
            <div key={videoId} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
              <h3
                className="font-semibold text-gray-800 mb-3 cursor-pointer hover:text-[#35b3c9]"
                onClick={() => router.push(`/summary/${videoId}`)}
              >
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.items.map((item, index) => (
                  <div key={index} className="flex items-start gap-3 text-sm">
                    <span className="shrink-0 text-xs px-2 py-1 rounded-full text-gray-600 bg-gray-100">
                      {TYPE_LABELS[item.sourceType]}
                    </span>
                    <span className="text-gray-700">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchResults;
