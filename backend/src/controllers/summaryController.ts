// src/controllers/summaryController.ts
import { Request, Response, NextFunction } from 'express';
import { SummaryModel } from '../models/summaryModel';
import { VideoModel } from '../models/videoModel';
import { ApiResponse, Summary } from '../types';
import { AuthRequest } from '../middleware/authMiddleware';

export class SummaryController {
    // Get summary for a video
    public getSummary = async (
        req: AuthRequest,
        res: Response<ApiResponse<Summary>>,
        next: NextFunction
    ): Promise<void> => {
        try {
            const videoId = parseInt(req.params.videoId);

            // Check if video exists and user owns it
            const video = await VideoModel.findById(videoId);
            if (!video) {
                res.status(404).json({ success: false, error: 'Video not found' });
                return;
            }

            if (video.user_id !== req.userId) {
                res.status(403).json({ success: false, error: 'Access denied' });
                return;
            }

            const summary = await SummaryModel.findByVideoId(videoId);

            if (!summary) {
                res.status(404).json({ success: false, error: 'Summary not found' });
                return;
            }

            res.json({
                success: true,
                data: summary
            });

        } catch (error) {
            next(error);
        }
    };

    // Generate summary (trigger processing)
    public generateSummary = async (
        req: AuthRequest,
        res: Response<ApiResponse>,
        next: NextFunction
    ): Promise<void> => {
        try {
            const videoId = parseInt(req.params.videoId);

            // Check if video exists and user owns it
            const video = await VideoModel.findById(videoId);
            if (!video) {
                res.status(404).json({ success: false, error: 'Video not found' });
                return;
            }

            if (video.user_id !== req.userId) {
                res.status(403).json({ success: false, error: 'Access denied' });
                return;
            }

            // Check if summary already exists
            const existingSummary = await SummaryModel.findByVideoId(videoId);
            if (existingSummary) {
                res.status(400).json({ success: false, error: 'Summary already exists' });
                return;
            }

            // Trigger processing (in real app, this would add to queue)
            // For now, return success message
            res.json({
                success: true,
                message: 'Summary generation started'
            });

        } catch (error) {
            next(error);
        }
    };

    // Update summary (admin only maybe)
    public updateSummary = async (
        req: AuthRequest,
        res: Response<ApiResponse>,
        next: NextFunction
    ): Promise<void> => {
        try {
            const videoId = parseInt(req.params.videoId);
            const { summary_text, key_points, action_items } = req.body;

            // Check if video exists and user owns it
            const video = await VideoModel.findById(videoId);
            if (!video) {
                res.status(404).json({ success: false, error: 'Video not found' });
                return;
            }

            if (video.user_id !== req.userId) {
                res.status(403).json({ success: false, error: 'Access denied' });
                return;
            }

            const updated = await SummaryModel.update(videoId, {
                summary_text,
                key_points: key_points ? JSON.stringify(key_points) : undefined,
                action_items: action_items ? JSON.stringify(action_items) : undefined
            });

            if (!updated) {
                res.status(404).json({ success: false, error: 'Summary not found' });
                return;
            }

            res.json({
                success: true,
                message: 'Summary updated successfully'
            });

        } catch (error) {
            next(error);
        }
    };
}

export default new SummaryController();