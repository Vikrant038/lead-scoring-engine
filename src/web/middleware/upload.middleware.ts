/**
 * Multer 2.x upload handling (SEC-04): in-memory storage, 5 MB limit, JSON-only filter.
 * Contents are validated with Zod in the upload service before being persisted.
 */
import multer from 'multer';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const isJson =
      file.mimetype === 'application/json' || file.originalname.toLowerCase().endsWith('.json');
    if (isJson) {
      cb(null, true);
    } else {
      cb(new Error('UNSUPPORTED_MEDIA_TYPE'));
    }
  },
}).single('file');
