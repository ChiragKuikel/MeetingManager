// components/VideoUpload.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { apiFetch, getToken } from '@/lib/auth';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import {
  HiOutlineCloudArrowUp, 
  HiOutlineXMark, 
  HiOutlineDocument, 
  HiOutlineCheckCircle, 
  HiOutlineExclamationCircle,
  HiOutlineEye
} from 'react-icons/hi2';

interface UploadResponse {
  success: boolean;
  data?: {
    id: number;
    filename: string;
    title: string;
    file_path: string;
    status: string;
  };
  error?: string;
}

interface StatusResponse {
  success: boolean;
  data: {
    status: string;
  };
}

const VideoUpload = () => {
  useRequireAuth();
  const router = useRouter();
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [uploads, setUploads] = useState<Array<{ 
    file: File; 
    status: 'uploading' | 'processing' | 'completed' | 'failed'; 
    id?: number;
    completedAt?: Date;
  }>>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    
    // Filter for video files
    const videoFiles = acceptedFiles.filter(file => 
      file.type.startsWith('video/')
    );

    if (videoFiles.length === 0) {
      setError('Please upload valid video files');
      return;
    }

    // Add files to uploads list
    const newUploads = videoFiles.map(file => ({
      file,
      status: 'uploading' as const
    }));
    
    setUploads(prev => [...prev, ...newUploads]);

    // Upload each file
    for (const file of videoFiles) {
      await uploadFile(file);
    }
  }, []);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', file.name.replace(/\.[^/.]+$/, '')); // Remove extension

    try {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: progress
          }));
        }
      });

      // Create promise to handle upload
      const uploadPromise = new Promise<UploadResponse>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error('Invalid response from server'));
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error occurred'));
      });

      xhr.open('POST', 'http://localhost:3001/api/videos/upload');
      const token = getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);

      const response = await uploadPromise;

      if (response.success && response.data) {
        // Update upload status
        setUploads(prev => 
          prev.map(u => 
            u.file.name === file.name 
              ? { ...u, status: 'processing', id: response.data!.id }
              : u
          )
        );

        // Start polling for processing status
        pollProcessingStatus(response.data.id, file.name);
      } else {
        throw new Error(response.error || 'Upload failed');
      }

    } catch (error) {
      console.error('Upload error:', error);
      setUploads(prev => 
        prev.map(u => 
          u.file.name === file.name 
            ? { ...u, status: 'failed' }
            : u
        )
      );
      setError(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const pollProcessingStatus = async (videoId: number, fileName: string) => {
    const checkStatus = async () => {
      try {
        const response = await apiFetch(`http://localhost:3001/api/videos/${videoId}/status`);
        const data: StatusResponse = await response.json();

        if (data.data.status === 'completed') {
          setUploads(prev => 
            prev.map(u => 
              u.id === videoId 
                ? { ...u, status: 'completed', completedAt: new Date() }
                : u
            )
          );
          return true; // Stop polling
        } else if (data.data.status === 'failed') {
          setUploads(prev => 
            prev.map(u => 
              u.id === videoId 
                ? { ...u, status: 'failed' }
                : u
            )
          );
          return true; // Stop polling
        }
        return false; // Continue polling
      } catch (error) {
        console.error('Status check failed:', error);
        return false;
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(async () => {
      const shouldStop = await checkStatus();
      if (shouldStop) {
        clearInterval(interval);
      }
    }, 2000);

    // Clear interval after 5 minutes (timeout)
    setTimeout(() => clearInterval(interval), 300000);
  };

  const handleViewSummary = (videoId: number) => {
    router.push(`/summary/${videoId}`);
  };

  const removeUpload = (fileName: string) => {
    setUploads(prev => prev.filter(u => u.file.name !== fileName));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileName];
      return newProgress;
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.webm', '.mkv']
    },
    maxSize: 500 * 1024 * 1024, // 500MB
    multiple: true
  });

  return (
    <div className="w-full max-w-3xl mx-auto p-6">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
          isDragActive 
            ? 'border-[#35b3c9] bg-[#35b3c9]/5' 
            : 'border-gray-300 hover:border-[#b524c5] hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <HiOutlineCloudArrowUp
          className="w-16 h-16 mx-auto mb-4" 
          style={{ color: isDragActive ? '#35b3c9' : '#b524c5' }}
        />
        <p className="text-lg mb-2 text-gray-700">
          {isDragActive ? 'Drop your videos here' : 'Drag & drop your videos here'}
        </p>
        <p className="text-sm text-gray-500">
          or click to browse (MP4, MOV, AVI, WebM - up to 500MB)
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <HiOutlineExclamationCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Upload List */}
      {uploads.length > 0 && (
        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Uploads</h3>
          {uploads.map((upload, index) => (
            <div
              key={index}
              className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 flex-1">
                  <HiOutlineDocument 
                    className="w-6 h-6" 
                    style={{ color: upload.status === 'failed' ? '#ef4444' : '#35b3c9' }}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{upload.file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(upload.file.size / (1024 * 1024)).toFixed(2)} MB
                      {upload.completedAt && ` • Processed ${upload.completedAt.toLocaleTimeString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Status Indicator */}
                  {upload.status === 'uploading' && (
                    <span className="text-sm" style={{ color: '#35b3c9' }}>
                      {uploadProgress[upload.file.name] || 0}%
                    </span>
                  )}
                  {upload.status === 'processing' && (
                    <span className="text-sm flex items-center gap-1" style={{ color: '#b524c5' }}>
                      <span className="w-4 h-4 border-2 border-[#b524c5] border-t-transparent rounded-full animate-spin"></span>
                      Processing...
                    </span>
                  )}
                  {upload.status === 'completed' && (
                    <>
                      <HiOutlineCheckCircle className="w-5 h-5 text-green-500" />
                      <button
                        onClick={() => handleViewSummary(upload.id!)}
                        className="flex items-center gap-1 px-3 py-1 bg-[#35b3c9] text-white rounded-lg text-sm hover:bg-[#2c95a8] transition-colors"
                      >
                        <HiOutlineEye className="w-4 h-4" />
                        View Summary
                      </button>
                    </>
                  )}
                  {upload.status === 'failed' && (
                    <span className="text-sm text-red-500">Failed</span>
                  )}
                  
                  {/* Remove button - only show for non-processing and non-completed */}
                  {upload.status !== 'processing' && upload.status !== 'completed' && (
                    <button
                      onClick={() => removeUpload(upload.file.name)}
                      className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <HiOutlineXMark className="w-5 h-5 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {upload.status === 'uploading' && (
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{ 
                      width: `${uploadProgress[upload.file.name] || 0}%`,
                      backgroundColor: '#35b3c9'
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoUpload;