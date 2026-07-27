// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/environment';

export interface AuthRequest extends Request {
    userId?: number;
    apiKey?: string;
}

export const authMiddleware = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // For demo purposes, we'll set a default user ID
        // In production, this would verify JWT token from Authorization header
        
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            // Verify JWT token here
            // const decoded = jwt.verify(token, env.JWT_SECRET);
            // req.userId = decoded.userId;
        }

        // Check for API key
        const apiKey = req.headers['x-api-key'] as string;
        if (apiKey && apiKey === env.API_KEY) {
            req.apiKey = apiKey;
        }

        // For demo, always set a default user
        req.userId = 1;

        next();
    } catch (error) {
        res.status(401).json({ error: 'Authentication failed' });
    }
};

export const requireAuth = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    if (!req.userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    next();
};