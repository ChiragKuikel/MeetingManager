// src/middleware/errorMiddleware.ts
import { Request, Response, NextFunction } from 'express';

interface ErrorWithStatus extends Error {
    status?: number;
    code?: string;
}

export const errorMiddleware = (
    err: ErrorWithStatus,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    console.error('Error:', err);

    // Default error
    let errorResponse = {
        success: false,
        error: err.message || 'Internal server error',
        status: err.status || 500
    };

    // MySQL errors
    if (err.code === 'ER_DUP_ENTRY') {
        errorResponse = {
            success: false,
            error: 'Duplicate entry found',
            status: 409
        };
    }

    if (err.code === 'ER_NO_REFERENCED_ROW') {
        errorResponse = {
            success: false,
            error: 'Referenced record not found',
            status: 404
        };
    }

    if (err.code === 'ER_BAD_NULL_ERROR') {
        errorResponse = {
            success: false,
            error: 'Required field missing',
            status: 400
        };
    }

    // File system errors
    if (err.code === 'ENOENT') {
        errorResponse = {
            success: false,
            error: 'File not found',
            status: 404
        };
    }

    // Send response
    res.status(errorResponse.status).json({
        success: false,
        error: errorResponse.error,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};