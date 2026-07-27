// src/models/summaryModel.ts
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/database';
import { Summary } from '../types';

interface SummaryRow extends Summary, RowDataPacket {}

export class SummaryModel {
    static async create(summaryData: Partial<Summary>): Promise<number> {
        const { video_id, summary_text, key_points, action_items, speakers, transcript } = summaryData;
        
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO summaries (video_id, summary_text, key_points, action_items, speakers, transcript) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [video_id, summary_text, key_points, action_items, speakers, transcript]
        );
        
        return result.insertId;
    }

    static async findByVideoId(videoId: number): Promise<Summary | null> {
        const [rows] = await pool.execute<SummaryRow[]>(
            'SELECT * FROM summaries WHERE video_id = ?',
            [videoId]
        );
        return rows[0] || null;
    }

    static async update(videoId: number, updateData: Partial<Summary>): Promise<boolean> {
        const allowedFields: (keyof Summary)[] = ['summary_text', 'key_points', 'action_items', 'speakers', 'transcript'];
        const updates: string[] = [];
        const values: any[] = [];

        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(updateData[field]);
            }
        }

        if (updates.length === 0) return false;

        values.push(videoId);
        const [result] = await pool.execute<ResultSetHeader>(
            `UPDATE summaries SET ${updates.join(', ')} WHERE video_id = ?`,
            values
        );
        
        return result.affectedRows > 0;
    }

    static async delete(videoId: number): Promise<boolean> {
        const [result] = await pool.execute<ResultSetHeader>(
            'DELETE FROM summaries WHERE video_id = ?',
            [videoId]
        );
        return result.affectedRows > 0;
    }
}