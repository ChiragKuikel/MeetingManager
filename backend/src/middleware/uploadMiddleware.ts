// src/middleware/uploadMiddleware.ts
import multer from 'multer';
import { Request, Response, NextFunction} from 'express';
import fileService from '../services/fileService';
import { env } from '../config/environment';

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, fileService['uploadDir']);
    },
    filename: (req, file, cb) => {
        const filename = fileService.generateFilename(file.originalname);
        cb(null, filename);
    }
});

// File filter
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (env.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type. Allowed types: ${env.ALLOWED_MIME_TYPES.join(', ')}`));
    }
};

// Create multer upload instance
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: env.MAX_FILE_SIZE,
        files: 5
    }
});

// Middleware for single file upload
export const uploadSingle = (fieldName: string = 'video') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const uploadMiddleware = upload.single(fieldName);
        
        uploadMiddleware(req, res, (err: any) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ 
                        error: `File too large. Maximum size is ${env.MAX_FILE_SIZE / (1024 * 1024)}MB` 
                    });
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({ error: 'Too many files' });
                }
                return res.status(400).json({ error: err.message });
            } else if (err) {
                return res.status(400).json({ error: err.message });
            }
            return next();
        });
    };
};

// Middleware for multiple file upload
export const uploadMultiple = (fieldName: string = 'videos', maxCount: number = 5) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const uploadMiddleware = upload.array(fieldName, maxCount);
        
        uploadMiddleware(req, res, (err: any) => {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            return next();
        });
    };
};