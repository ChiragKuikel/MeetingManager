import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import fileService from '../services/fileService';
import { env } from '../config/environment';

/**
 * Multer options for the video upload endpoint. Ported from the old Express
 * `uploadMiddleware`: same disk storage, generated filename, mime whitelist,
 * and size/count limits. Used by Nest's FileInterceptor.
 */
export const videoMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, fileService.getUploadDir()),
    filename: (_req, file, cb) => cb(null, fileService.generateFilename(file.originalname)),
  }),
  fileFilter: (_req, file, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (env.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          `Invalid file type. Allowed types: ${env.ALLOWED_MIME_TYPES.join(', ')}`,
        ),
        false,
      );
    }
  },
  limits: {
    fileSize: env.MAX_FILE_SIZE,
    files: 5,
  },
};
