import { Router, Request, Response } from 'express';
import { getUploadsBucket } from '../../config/gridfs.config';

const router = Router();

// Serves files previously written by upload.service.ts's GridFS upload —
// replaces express.static now that uploads no longer live on local disk.
router.get(/^\/(.+)$/, async (req: Request, res: Response) => {
  const filename = req.params[0];

  try {
    const bucket = getUploadsBucket();
    const [file] = await bucket.find({ filename }).limit(1).toArray();

    if (!file) {
      res.status(404).end();
      return;
    }

    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    bucket
      .openDownloadStreamByName(filename)
      .on('error', () => res.status(404).end())
      .pipe(res);
  } catch {
    res.status(404).end();
  }
});

export default router;
