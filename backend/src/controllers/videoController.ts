// src/controllers/videoController.ts
import { Request, Response, NextFunction } from 'express';
import { VideoModel } from '../models/videoModel';
import { QueueModel } from '../models/queueModel';
import fileService from '../services/fileService';
import { ApiResponse, VideoWithSummary } from '../types';
import { AuthRequest } from '../middleware/authMiddleware';

/** When auth middleware is disabled, uploads still use user 1 — keep the same default for reads. */
function resolveViewerId(req: AuthRequest): number {
    return req.userId ?? 1;
}

export class VideoController {
    // Upload video
    public uploadVideo = async (
        req: AuthRequest,
        res: Response<ApiResponse<{ id: number; filename: string; status: string }>>,
        next: NextFunction
    ): Promise<void> => {
        try {
            if (!req.file) {
                res.status(400).json({ success: false, error: 'No video file uploaded' });
                return;
            }

            const userId = resolveViewerId(req);
            const { title } = req.body;

            // Create video record in database
            const videoId = await VideoModel.create({
                user_id: userId,
                title: title || req.file.originalname.replace(/\.[^/.]+$/, ''),
                filename: req.file.filename,
                file_path: req.file.path,
                file_size: req.file.size,
                mime_type: req.file.mimetype,
                status: 'processing'
            });

            // Add to processing queue
            await QueueModel.add(videoId);

            res.status(201).json({
                success: true,
                data: {
                    id: videoId,
                    filename: req.file.filename,
                    status: 'processing'
                }
            });

        } catch (error) {
            next(error);
        }
    };

    // Get video status
    public getVideoStatus = async (
        req: Request,
        res: Response<ApiResponse<{ status: string }>>,
        next: NextFunction
    ): Promise<void> => {
        try {
            const videoId = parseInt(req.params.id);
            const video = await VideoModel.findById(videoId);

            if (!video) {
                res.status(404).json({ success: false, error: 'Video not found' });
                return;
            }

            res.json({
                success: true,
                data: { status: video.status }
            });

        } catch (error) {
            next(error);
        }
    };

    // Get all videos for user
    public getUserVideos = async (
        req: AuthRequest,
        res: Response<ApiResponse<{ videos: VideoWithSummary[]; total: number, page: number; limit: number; totalPages: number }>>,
        next: NextFunction
    ): Promise<void> => {
        try {
            const userId = resolveViewerId(req);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const offset = (page - 1) * limit;

            const videos = await VideoModel.findByUserId(userId, limit, offset);
            const total = await VideoModel.countByUserId(userId);

            res.json({
                success: true,
                data: {
                    videos,
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            next(error);
        }
    };

    // Get single video
    public getVideo = async (
        req: AuthRequest,
        res: Response<ApiResponse<VideoWithSummary>>,
        next: NextFunction
    ): Promise<void> => {
        try {
            const videoId = parseInt(req.params.id);
            const video = await VideoModel.findById(videoId);

            if (!video) {
                res.status(404).json({ success: false, error: 'Video not found' });
                return;
            }

            if (video.user_id !== resolveViewerId(req)) {
                res.status(403).json({ success: false, error: 'Access denied' });
                return;
            }

            res.json({
                success: true,
                data: video
            });

        } catch (error) {
            next(error);
        }
    };

    // Delete video
    public deleteVideo = async (
        req: AuthRequest,
        res: Response<ApiResponse>,
        next: NextFunction
    ): Promise<void> => {
        try {
            const videoId = parseInt(req.params.id);
            const video = await VideoModel.findById(videoId);

            if (!video) {
                res.status(404).json({ success: false, error: 'Video not found' });
                return;
            }

            if (video.user_id !== resolveViewerId(req)) {
                res.status(403).json({ success: false, error: 'Access denied' });
                return;
            }

            // Delete file from filesystem
            if (video.file_path) {
                await fileService.deleteFile(video.file_path);
            }

            // Delete from database
            await VideoModel.delete(videoId);

            res.json({
                success: true,
                message: 'Video deleted successfully'
            });

        } catch (error) {
            next(error);
        }
    };

    // Update video metadata
    public updateVideo = async (
        req: AuthRequest,
        res: Response<ApiResponse>,
        next: NextFunction
    ): Promise<void> => {
        try {
            const videoId = parseInt(req.params.id);
            const { title } = req.body;

            const video = await VideoModel.findById(videoId);

            if (!video) {
                res.status(404).json({ success: false, error: 'Video not found' });
                return;
            }

            if (video.user_id !== resolveViewerId(req)) {
                res.status(403).json({ success: false, error: 'Access denied' });
                return;
            }

            await VideoModel.update(videoId, { title });

            res.json({
                success: true,
                message: 'Video updated successfully'
            });

        } catch (error) {
            next(error);
        }
    };
}

export default new VideoController();