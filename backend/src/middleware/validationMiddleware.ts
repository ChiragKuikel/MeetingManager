// src/middleware/validationMiddleware.ts
import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const validate = (validations: any[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.type === 'field' ? err.path : 'unknown',
                message: err.msg
            }))
        });
    };
};

// Video upload validation
export const videoUploadValidation = [
    body('title')
        .optional()
        .isString().withMessage('Title must be a string')
        .isLength({ max: 255 }).withMessage('Title too long')
        .trim()
        .escape(),
    
    body('description')
        .optional()
        .isString().withMessage('Description must be a string')
        .trim()
        .escape()
];

// Video ID validation
export const videoIdValidation = [
    param('id')
        .isInt({ min: 1 }).withMessage('Invalid video ID')
        .toInt()
];

// Pagination validation
export const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer')
        .toInt()
        .default(1),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
        .toInt()
        .default(20)
];

// Status validation
export const statusValidation = [
    param('status')
        .isIn(['uploading', 'processing', 'completed', 'failed'])
        .withMessage('Invalid status')
];