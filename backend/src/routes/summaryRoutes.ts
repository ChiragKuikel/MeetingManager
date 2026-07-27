// src/routes/summaryRoutes.ts
import { Router } from 'express';
import summaryController from '../controllers/summaryController';
//import { authMiddleware, requireAuth } from '../middleware/authMiddleware';
import { validate, videoIdValidation } from '../middleware/validationMiddleware';

const router = Router();

// Apply auth middleware to all routes
//router.use(authMiddleware);
//router.use(requireAuth);

// Get summary for video
router.get(
    '/video/:videoId',
    validate(videoIdValidation),
    summaryController.getSummary
);

// Generate summary
router.post(
    '/video/:videoId/generate',
    validate(videoIdValidation),
    summaryController.generateSummary
);

// Update summary
router.put(
    '/video/:videoId',
    validate(videoIdValidation),
    summaryController.updateSummary
);

export default router;