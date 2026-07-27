// src/server.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import { testConnection } from './config/database';
import { env } from './config/environment';
import videoRoutes from './routes/videoRoutes';
import summaryRoutes from './routes/summaryRoutes';
import { errorMiddleware } from './middleware/errorMiddleware';
import videoProcessingService from './services/videoProcessingService';
import fileService from './services/fileService';

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static(path.join(process.cwd(), env.UPLOAD_DIR)));

// Routes
app.use('/api/videos', videoRoutes);
app.use('/api/summaries', summaryRoutes);


// Health check
app.get('/api/health', async (req, res) => {
    const dbConnected = await testConnection();
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
        database: dbConnected ? 'connected' : 'disconnected',
        uploadDir: fileService['uploadDir']
    });
});

// Error handling
app.use(errorMiddleware);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
const startServer = async () => {
    try {
        // Test database connection
        await testConnection();

        // Start queue worker
        videoProcessingService.startQueueWorker();

        // Clean old files periodically (every day)
        setInterval(async () => {
            const deleted = await fileService.cleanOldFiles(30);
            if (deleted > 0) {
                console.log(`🧹 Cleaned ${deleted} old files`);
            }
        }, 24 * 60 * 60 * 1000);

        app.listen(env.PORT, () => {
            console.log(`Server running on http://localhost:${env.PORT}`);
            console.log(`Upload directory: ${fileService['uploadDir']}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;