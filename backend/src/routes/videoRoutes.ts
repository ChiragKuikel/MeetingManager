// src/routes/videoRoutes.ts
import { Router } from 'express';
import videoController from '../controllers/videoController';
//import { authMiddleware, requireAuth } from '../middleware/authMiddleware';
import { uploadSingle } from '../middleware/uploadMiddleware';
import { validate, videoIdValidation, paginationValidation, videoUploadValidation } from '../middleware/validationMiddleware';

const router = Router();

// Apply auth middleware to all routes
//router.use(authMiddleware);
//router.use(requireAuth);

// Upload video
router.post(
    '/upload',
    uploadSingle('video'),
    validate(videoUploadValidation),
    videoController.uploadVideo
);

// Get user videos
router.get(
    '/',
    validate(paginationValidation),
    videoController.getUserVideos
);

// Get video status
router.get(
    '/:id/status',
    validate(videoIdValidation),
    videoController.getVideoStatus
);

// Get single video
router.get(
    '/:id',
    validate(videoIdValidation),
    videoController.getVideo
);

// Update video
router.put(
    '/:id',
    validate(videoIdValidation),
    videoController.updateVideo
);

// Delete video
router.delete(
    '/:id',
    validate(videoIdValidation),
    videoController.deleteVideo
);

export default router;