// src/models/queueModel.ts
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/database';
import { ProcessingQueue } from '../types';

interface QueueRow extends ProcessingQueue, RowDataPacket {}

export class QueueModel {
    static async add(videoId: number, priority: number = 0): Promise<number> {
        const [result] = await pool.execute<ResultSetHeader>(
            `INSERT INTO processing_queue (video_id, priority, status) 
             VALUES (?, ?, 'queued')`,
            [videoId, priority]
        );
        return result.insertId;
    }

    static async getNextPending(): Promise<QueueRow | null> {
        const [rows] = await pool.execute<QueueRow[]>(
            `SELECT * FROM processing_queue 
             WHERE status = 'queued' 
             ORDER BY priority DESC, created_at ASC 
             LIMIT 1`
        );
        return rows[0] || null;
    }

    static async updateStatus(
        videoId: number, 
        status: ProcessingQueue['status'], 
        errorMessage: string | null = null
    ): Promise<boolean> {
        let query = 'UPDATE processing_queue SET status = ?';
        const values: any[] = [status];

        if (status === 'processing') {
            query += ', started_at = NOW()';
        } else if (status === 'completed') {
            query += ', completed_at = NOW()';
        } else if (status === 'failed' && errorMessage) {
            query += ', error_message = ?';
            values.push(errorMessage);
        }

        query += ' WHERE video_id = ?';
        values.push(videoId);

        const [result] = await pool.execute<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    static async incrementAttempt(videoId: number): Promise<boolean> {
        const [result] = await pool.execute<ResultSetHeader>(
            'UPDATE processing_queue SET attempts = attempts + 1 WHERE video_id = ?',
            [videoId]
        );
        return result.affectedRows > 0;
    }

    static async getStatus(videoId: number): Promise<QueueRow | null> {
        const [rows] = await pool.execute<QueueRow[]>(
            'SELECT * FROM processing_queue WHERE video_id = ?',
            [videoId]
        );
        return rows[0] || null;
    }

    static async cleanOldEntries(days: number = 7): Promise<number> {
        const [result] = await pool.execute<ResultSetHeader>(
            'DELETE FROM processing_queue WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
            [days]
        );
        return result.affectedRows;
    }
}