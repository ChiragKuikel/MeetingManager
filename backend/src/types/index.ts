// src/types/index.ts
export interface User {
    id: number;
    email: string;
    name: string;
    password_hash: string;
    created_at: Date;
    updated_at: Date;
}

export interface Video {
    id: number;
    user_id: number;
    title: string;
    filename: string;
    file_path: string;
    file_size: number;
    duration: number | null;
    mime_type: string;
    status: 'uploading' | 'processing' | 'completed' | 'failed';
    created_at: Date;
    updated_at: Date;
}

export interface VideoWithSummary extends Video {
    summary_text?: string;
    key_points?: string;
    action_items?: string;
    speakers?: string;
    transcript?: string;
    page?: number;
}

export interface Summary {
    id: number;
    video_id: number;
    summary_text: string;
    key_points: string;
    action_items: string;
    speakers: string;
    transcript: string;
    created_at: Date;
    updated_at: Date;
}

export interface ProcessingQueue {
    id: number;
    video_id: number;
    priority: number;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    attempts: number;
    error_message: string | null;
    started_at: Date | null;
    completed_at: Date | null;
    created_at: Date;
}

export interface ActivityLog {
    id: number;
    user_id: number;
    action: string;
    details: string;
    ip_address: string;
    created_at: Date;
}

// Request/Response Types
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface UploadVideoRequest {
    title?: string;
    description?: string;
}

export interface VideoStatusResponse {
    id: number;
    status: Video['status'];
    progress?: number;
}

// Action Item Type
export interface ActionItem {
    task: string;
    assignee: string;
    due: string;
    priority: 'high' | 'medium' | 'low';
}

// Speaker Type
export interface Speaker {
    name: string;
    speaking_time: string;
    word_count: number;
    role?: string;
}

// Pagination
export interface PaginationParams {
    page: number;
    limit: number;
    offset: number;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}