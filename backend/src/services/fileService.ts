// src/services/fileService.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { env } from '../config/environment';

const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);
const statAsync = promisify(fs.stat);
const readdirAsync = promisify(fs.readdir);

interface FileStats {
    exists: boolean;
    size?: number;
    created?: Date;
    modified?: Date;
    error?: string;
}

export class FileService {
    private uploadDir: string;

    constructor() {
        this.uploadDir = path.join(process.cwd(), env.UPLOAD_DIR);
        this.ensureUploadDir();
    }

    private async ensureUploadDir(): Promise<void> {
        try {
            if (!fs.existsSync(this.uploadDir)) {
                await mkdirAsync(this.uploadDir, { recursive: true });
                console.log(`📁 Upload directory created: ${this.uploadDir}`);
            }
        } catch (error) {
            console.error('Failed to create upload directory:', error);
        }
    }

    public getUploadDir(): string {
        return this.uploadDir;
    }

    public generateFilename(originalname: string): string {
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(originalname);
        return `${Date.now()}-${uniqueSuffix}${ext}`;
    }

    public getFilePath(filename: string): string {
        return path.join(this.uploadDir, filename);
    }

    public async deleteFile(filePath: string): Promise<boolean> {
        try {
            if (fs.existsSync(filePath)) {
                await unlinkAsync(filePath);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting file:', error);
            return false;
        }
    }

    public async getFileStats(filePath: string): Promise<FileStats> {
        try {
            if (fs.existsSync(filePath)) {
                const stats = await statAsync(filePath);
                return {
                    exists: true,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                };
            }
            return { exists: false };
        } catch (error) {
            console.error('Error getting file stats:', error);
            return { exists: false, error: (error as Error).message };
        }
    }

    public async cleanOldFiles(days: number = 30): Promise<number> {
        try {
            const files = await readdirAsync(this.uploadDir);
            const now = Date.now();
            let deletedCount = 0;

            for (const file of files) {
                const filePath = path.join(this.uploadDir, file);
                const stats = await statAsync(filePath);
                const daysOld = (now - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

                if (daysOld > days) {
                    await this.deleteFile(filePath);
                    deletedCount++;
                }
            }

            return deletedCount;
        } catch (error) {
            console.error('Error cleaning old files:', error);
            return 0;
        }
    }

    public validateFileSize(size: number): boolean {
        return size <= env.MAX_FILE_SIZE;
    }

    public validateMimeType(mimeType: string): boolean {
        return env.ALLOWED_MIME_TYPES.includes(mimeType);
    }
}

export default new FileService();