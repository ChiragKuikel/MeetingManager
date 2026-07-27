// src/models/videoModel.ts
import { RowDataPacket,  ResultSetHeader } from 'mysql2';
import { pool } from '../config/database';
import { Video, VideoWithSummary } from '../types';

interface VideoRow extends Video, RowDataPacket {}
interface VideoWithSummaryRow extends VideoWithSummary, RowDataPacket {}

export class VideoModel {
    static async create(videoData: Partial<Video>): Promise<number> {
        const { user_id, title, filename, file_path, file_size, mime_type, status = 'uploading' } = videoData;
        
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO videos (user_id, title, filename, file_path, file_size, mime_type, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [user_id, title, filename, file_path, file_size, mime_type, status]
        )as [ResultSetHeader, any];
        
        return result.insertId;
    }

    static async findById(id: number): Promise<VideoWithSummary | null> {
        const [rows] = await pool.execute<VideoWithSummaryRow[]>(
            `SELECT v.*, s.summary_text, s.key_points, s.action_items, s.speakers, s.transcript 
             FROM videos v 
             LEFT JOIN summaries s ON v.id = s.video_id 
             WHERE v.id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    static async findByUserId(
        userId: number, 
        limit: number = 50, 
        offset: number = 0
    ): Promise<VideoWithSummary[]> {
        const [rows] = await pool.execute<VideoWithSummaryRow[]>(
            `SELECT v.*, s.summary_text, s.key_points, s.action_items 
             FROM videos v 
             LEFT JOIN summaries s ON v.id = s.video_id 
             WHERE v.user_id = ? 
             ORDER BY v.created_at DESC 
             LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );
        return rows;
    }

    static async updateStatus(id: number, status: Video['status']): Promise<boolean> {
        const [result] = await pool.execute<ResultSetHeader>(
            'UPDATE videos SET status = ? WHERE id = ?',
            [status, id]
        );
        return result.affectedRows > 0;
    }

    static async update(id: number, updateData: Partial<Video>): Promise<boolean> {
        const allowedFields: (keyof Video)[] = ['title', 'status', 'duration'];
        const updates: string[] = [];
        const values: any[] = [];

        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(updateData[field]);
            }
        }

        if (updates.length === 0) return false;

        values.push(id);
        const [result] = await pool.execute<ResultSetHeader>(
            `UPDATE videos SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        
        return result.affectedRows > 0;
    }

    static async delete(id: number): Promise<string | null> {
        const [rows] = await pool.execute<VideoRow[]>(
            'SELECT file_path FROM videos WHERE id = ?',
            [id]
        );
        
        if (rows.length === 0) return null;

        await pool.execute('DELETE FROM videos WHERE id = ?', [id]);
        
        return rows[0].file_path;
    }

    static async findByStatus(status: Video['status'], limit: number = 100): Promise<Video[]> {
        const [rows] = await pool.execute<VideoRow[]>(
            'SELECT * FROM videos WHERE status = ? ORDER BY created_at ASC LIMIT ?',
            [status, limit]
        );
        return rows;
    }

    static async countByUserId(userId: number): Promise<number> {
        const [rows] = await pool.execute<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM videos WHERE user_id = ?',
            [userId]
        );
        return rows[0].count;
    }
}