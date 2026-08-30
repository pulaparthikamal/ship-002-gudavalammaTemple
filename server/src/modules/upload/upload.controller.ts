import { Request, Response } from 'express';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { AppError } from '../../utils/error.util';
import { uploadService } from './upload.service';

export const uploadController = {
  // Single file upload
  async upload(req: Request, res: Response) {
    let incomingFile: any = (req as any).file;

    // Fallback to Base64 from body if no multipart file provided
    if (!incomingFile && req.body.contentBase64) {
      const { contentBase64, fileName, mimeType } = req.body;
      incomingFile = {
        originalname: fileName || 'upload',
        mimetype: mimeType || 'application/octet-stream',
        buffer: Buffer.from(contentBase64, 'base64'),
        size: Buffer.from(contentBase64, 'base64').length,
      };
    }

    if (!incomingFile) {
      throw new AppError('File or contentBase64 is required.', HTTP_STATUS.BAD_REQUEST);
    }

    const uploadedFile = await uploadService.uploadFile({
      file: incomingFile,
      moduleName: String(req.query.type || req.body.folder || 'general'),
    });

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      statusCode: HTTP_STATUS.CREATED,
      respMessage: 'File uploaded successfully',
      data: uploadedFile,
      meta: null,
      errors: null,
    });
  },

  // Multiple files upload (up to 10 images)
  async uploadMultiple(req: Request, res: Response) {
    const files = (req as any).files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      throw new AppError('At least one file is required.', HTTP_STATUS.BAD_REQUEST);
    }

    const uploadedFiles = await Promise.all(
      files.map((file) =>
        uploadService.uploadFile({
          file,
          moduleName: String(req.query.type || req.body.folder || 'general'),
        })
      )
    );

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      statusCode: HTTP_STATUS.CREATED,
      respMessage: `${uploadedFiles.length} file(s) uploaded successfully`,
      data: uploadedFiles,
      meta: { count: uploadedFiles.length },
      errors: null,
    });
  },
};
