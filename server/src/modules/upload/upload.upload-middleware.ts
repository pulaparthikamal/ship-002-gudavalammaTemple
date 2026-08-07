import multer from 'multer';
import { envConfig } from '../../config/env.config';

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: envConfig.uploadMaxFileSizeMb * 1024 * 1024,
  },
});
