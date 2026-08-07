import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { uploadController } from './upload.controller';
import { uploadMiddleware } from './upload.upload-middleware';
import { envConfig } from '../../config/env.config';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

// Separate multer instance for multi-file (gives access to .array())
const multiUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: envConfig.uploadMaxFileSizeMb * 1024 * 1024 },
});

const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
    return next();
  }

  return authMiddleware(req, res, next);
};

// Single file upload (supports both multipart/form-data and JSON/Base64)
router.post(
  '/',
  (req, _res, next) => {
    if (req.is('multipart/form-data')) {
      return uploadMiddleware.single('file')(req, _res, next);
    }
    next();
  },
  optionalAuthMiddleware,
  asyncHandler(uploadController.upload)
);

// Multiple files upload (max 10 images for LinkedIn carousel, etc.)
router.post(
  '/multiple',
  (multiUploadMiddleware as any).array('files', 10),
  asyncHandler(uploadController.uploadMultiple)
);

export default router;
