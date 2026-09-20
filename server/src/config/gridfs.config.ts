import mongoose from 'mongoose';

/**
 * Uploaded files (temple logo, deity photo, banners, etc.) live in MongoDB
 * Atlas via GridFS instead of the local filesystem — Render's free-tier disk
 * is ephemeral and wipes local files on every restart/redeploy, which used
 * to make uploads vanish while the database still pointed at them.
 *
 * Lazily constructed because it needs `mongoose.connection.db`, which only
 * exists once connectDB() has resolved (before server.ts starts listening).
 */
type UploadsBucket = InstanceType<typeof mongoose.mongo.GridFSBucket>;

let bucket: UploadsBucket | undefined;

export function getUploadsBucket(): UploadsBucket {
  if (!bucket) {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Cannot access the uploads store before MongoDB has connected.');
    }
    bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'uploads' });
  }
  return bucket;
}
