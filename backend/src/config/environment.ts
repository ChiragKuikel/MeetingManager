// src/config/environment.ts
import dotenv from 'dotenv';

dotenv.config();

interface Environment {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: number;
    DB_HOST: string;
    DB_USER: string;
    DB_PASSWORD: string;
    DB_NAME: string;
    DB_PORT: number;
    UPLOAD_DIR: string;
    MAX_FILE_SIZE: number;
    ALLOWED_MIME_TYPES: string[];
    JWT_SECRET: string;
    API_KEY: string;
    GROQ_API_KEY: string;
    GROQ_TRANSCRIBE_MODEL: string;
    GROQ_CHAT_MODEL: string;
}

export const env: Environment = {
    NODE_ENV: (process.env.NODE_ENV as Environment['NODE_ENV']) || 'development',
    PORT: parseInt(process.env.PORT || '3001', 10),
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_USER: process.env.DB_USER || 'root',
    DB_PASSWORD: process.env.DB_PASSWORD || '',
    DB_NAME: process.env.DB_NAME || 'meeting_summarizer',
    DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
    UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '524288000', 10), // 500MB
    ALLOWED_MIME_TYPES: (process.env.ALLOWED_MIME_TYPES || 'video/mp4,video/quicktime,video/x-msvideo,video/webm').split(','),
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
    API_KEY: process.env.API_KEY || 'demo-key',
    GROQ_API_KEY: process.env.GROQ_API_KEY || '',
    GROQ_TRANSCRIBE_MODEL: process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3-turbo',
    GROQ_CHAT_MODEL: process.env.GROQ_CHAT_MODEL || 'llama-3.1-8b-instant'
};