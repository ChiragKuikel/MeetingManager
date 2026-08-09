// components/VideoSummary.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  HiOutlineDocumentText, 
  HiOutlineUserGroup, 
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineCalendar,
  HiOutlineArrowLeft,
  HiOutlineBold,
  HiOutlineShare,
  HiOutlineUser,
  HiOutlineChatBubbleLeftRight,
  HiOutlineExclamationCircle
} from 'react-icons/hi2';

interface Speaker {
  name: string;
  speaking_time: string;
  word_count: number;
  role?: string;
}

interface ActionItem {
  id: number;
  task: string;
  assignee: string | null;
  dueDate: string | null;
  priority: string | null;
  status: 'open' | 'done';
}

interface Decision {
  id: number;
  description: string;
}

interface OpenQuestion {
  id: number;
  question: string;
}

interface SummaryData {
  videoId: number;
  summaryText: string | null;
  keyPoints: string[] | null;
  speakers: Speaker[] | null;
  transcript: string | null;
  decisions: Decision[];
  openQuestions: OpenQuestion[];
  actionItems: ActionItem[];
}

interface VideoData {
  id: number;
  title: string;
  filename: string;
  file_size: number;
  duration: number | null;
  status: string;
  created_at: string;
}

interface VideoSummaryProps {
  videoId: number;
}

const VideoSummary = ({ videoId }: VideoSummaryProps) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'actions'>('summary');

  useEffect(() => {
    fetchVideoData();
  }, [videoId]);

  const fetchVideoData = async () => {
    try {
      setLoading(true);
      setError(null);

      const videoRes = await fetch(`http://localhost:3001/api/videos/${videoId}`);
      const videoJson = await videoRes.json();
      if (!videoRes.ok || !videoJson.success || !videoJson.data) {
        setError(videoJson.error || `Request failed (${videoRes.status})`);
        return;
      }
      setVideo(videoJson.data);

      const summaryRes = await fetch(`http://localhost:3001/api/summaries/video/${videoId}`);
      const summaryJson = await summaryRes.json();
      if (!summaryRes.ok || !summaryJson.success || !summaryJson.data) {
        setError(summaryJson.error || `Request failed (${summaryRes.status})`);
        return;
      }
      setSummary(summaryJson.data);
    } catch (err) {
      console.error('Error fetching video:', err);
      setError('Failed to load video summary');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#35b3c9] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading summary...</p>
        </div>
      </div>
    );
  }

  if (error || !video || !summary) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <HiOutlineExclamationCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Summary</h3>
          <p className="text-red-600">{error || 'Video not found'}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-[#35b3c9] transition-colors"
        >
          <HiOutlineArrowLeft className="w-5 h-5" />
          <span>Back to Uploads</span>
        </button>
        
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <HiOutlineBold className="w-5 h-5" style={{ color: '#35b3c9' }} />
            <span>Export</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <HiOutlineShare className="w-5 h-5" style={{ color: '#b524c5' }} />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Video Info Card */}
      <div className="bg-gradient-to-r from-[#35b3c9] to-[#b524c5] rounded-xl p-6 text-white mb-8">
        <h1 className="text-2xl font-bold mb-2">{video.title}</h1>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1">
            <HiOutlineDocumentText className="w-4 h-4" />
            <span>{formatFileSize(video.file_size)}</span>
          </div>
          <div className="flex items-center gap-1">
            <HiOutlineClock className="w-4 h-4" />
            <span>{video.duration ? `${Math.floor(video.duration / 60)}:${video.duration % 60}` : 'Duration not available'}</span>
          </div>
          <div className="flex items-center gap-1">
            <HiOutlineCalendar className="w-4 h-4" />
            <span>{formatDate(video.created_at)}</span>
          </div>
          <div className="flex items-center gap-1">
            <HiOutlineCheckCircle className="w-4 h-4" />
            <span className="capitalize">{video.status}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'summary'
              ? 'text-[#35b3c9]'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Summary
          {activeTab === 'summary' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#35b3c9]"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('transcript')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'transcript'
              ? 'text-[#b524c5]'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Full Transcript
          {activeTab === 'transcript' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#b524c5]"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('actions')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'actions'
              ? 'text-[#fec650]'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Action Items
          {activeTab === 'actions' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#fec650]"></div>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <>
            {/* Main Summary */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold mb-4" style={{ color: '#35b3c9' }}>
                Meeting Summary
              </h2>
              <p className="text-gray-700 leading-relaxed">{summary.summaryText}</p>
            </div>

            {/* Key Points */}
            {summary.keyPoints && summary.keyPoints.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold mb-4" style={{ color: '#b524c5' }}>
                  Key Points
                </h2>
                <ul className="space-y-3">
                  {summary.keyPoints.map((point, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#35b3c9]/10 text-[#35b3c9] flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <span className="text-gray-700">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Speakers */}
            {summary.speakers && summary.speakers.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: '#fec650' }}>
                  <HiOutlineUserGroup className="w-5 h-5" />
                  Speakers
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {summary.speakers.map((speaker, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-[#35b3c9] flex items-center justify-center text-white font-medium">
                        {speaker.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{speaker.name}</p>
                        <p className="text-sm text-gray-500">{speaker.role || 'Participant'}</p>
                        <div className="flex gap-3 mt-1 text-xs text-gray-400">
                          <span>{speaker.speaking_time} speaking</span>
                          <span>{speaker.word_count} words</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Decisions */}
            {summary.decisions && summary.decisions.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold mb-4" style={{ color: '#35b3c9' }}>
                  Decisions
                </h2>
                <ul className="space-y-3">
                  {summary.decisions.map((decision) => (
                    <li key={decision.id} className="flex items-start gap-3">
                      <HiOutlineCheckCircle className="w-5 h-5 text-[#35b3c9] flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{decision.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Open Questions */}
            {summary.openQuestions && summary.openQuestions.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold mb-4" style={{ color: '#b524c5' }}>
                  Open Questions
                </h2>
                <ul className="space-y-3">
                  {summary.openQuestions.map((q) => (
                    <li key={q.id} className="flex items-start gap-3">
                      <HiOutlineExclamationCircle className="w-5 h-5 text-[#b524c5] flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{q.question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Transcript Tab */}
        {activeTab === 'transcript' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: '#b524c5' }}>
              <HiOutlineChatBubbleLeftRight className="w-5 h-5" />
              Full Transcript
            </h2>
            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-line">{summary.transcript}</p>
            </div>
          </div>
        )}

        {/* Action Items Tab */}
        {activeTab === 'actions' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: '#fec650' }}>
              <HiOutlineCheckCircle className="w-5 h-5" />
              Action Items
            </h2>
            
            {summary.actionItems && summary.actionItems.length > 0 ? (
              <div className="space-y-4">
                {summary.actionItems.map((item) => (
                  <div key={item.id} className="border border-gray-100 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-800">{item.task}</h3>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          item.status === 'done' ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50'
                        }`}
                      >
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      {item.assignee && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <HiOutlineUser className="w-4 h-4" />
                          <span>{item.assignee}</span>
                        </div>
                      )}
                      {item.dueDate && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <HiOutlineCalendar className="w-4 h-4" />
                          <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No action items found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoSummary;