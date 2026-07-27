// components/VideosList.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  HiOutlineDocumentText, 
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineEye,
  HiOutlineTrash
} from 'react-icons/hi2';

interface VideoItem {
  id: number;
  title: string;
  filename: string;
  file_size: number;
  status: string;
  created_at: string;
  summary_text?: string;
}

const VideosList = () => {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/videos');
      const data = await response.json();
      if (data.success) {
        setVideos(data.data.videos);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this video?')) return;
    
    try {
      const response = await fetch(`http://localhost:3001/api/videos/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setVideos(videos.filter(v => v.id !== id));
      }
    } catch (error) {
      console.error('Error deleting video:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-4 border-[#35b3c9] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6" style={{ color: '#35b3c9' }}>Your Videos</h2>
      
      {videos.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No videos uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {videos.map((video) => (
            <div
              key={video.id}
              className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <HiOutlineDocumentText className="w-8 h-8" style={{ color: '#35b3c9' }} />
                  <div>
                    <h3 className="font-medium text-gray-800">{video.title}</h3>
                    <div className="flex gap-3 text-sm text-gray-500">
                      <span>{formatFileSize(video.file_size)}</span>
                      <span>{formatDate(video.created_at)}</span>
                      {video.status === 'completed' && (
                        <span className="flex items-center gap-1 text-green-600">
                          <HiOutlineCheckCircle className="w-4 h-4" />
                          Processed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {video.status === 'completed' && (
                    <button
                      onClick={() => router.push(`/summary/${video.id}`)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="View Summary"
                    >
                      <HiOutlineEye className="w-5 h-5" style={{ color: '#35b3c9' }} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(video.id)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <HiOutlineTrash className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideosList;