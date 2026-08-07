import { Request, Response } from 'express';
import path from 'path';
import { getRequestUserId } from '../utils/user.util';
import { serverConnectionService } from '../services/serverConnection.service';
import { withDashboardEndpointLog } from '../utils/dashboardEndpointLog.util';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

const MAX_PEM_BYTES = 64 * 1024;
const PEM_FILE_NAME_PATTERN = /\.(pem|key|rsa)$/i;

const readPemUpload = (req: Request) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    return undefined;
  }

  const originalName = path.basename(file.originalname || '');
  if (!PEM_FILE_NAME_PATTERN.test(originalName)) {
    throw new AppError('Only .pem, .key, or .rsa private-key files are supported.', HTTP_STATUS.BAD_REQUEST);
  }

  if (file.size > MAX_PEM_BYTES) {
    throw new AppError('Private-key file is too large. Maximum allowed size is 64 KB.', HTTP_STATUS.BAD_REQUEST);
  }

  const privateKey = file.buffer.toString('utf8').trim();
  if (!privateKey.includes('-----BEGIN') || !privateKey.includes('PRIVATE KEY-----')) {
    throw new AppError('Uploaded file does not look like a PEM private key.', HTTP_STATUS.BAD_REQUEST);
  }

  return {
    privateKey,
    pemFileName: originalName,
  };
};

const multipartPayload = (req: Request) => ({
  ...req.body,
  ...(readPemUpload(req) || {}),
  port: req.body.port !== undefined ? Number(req.body.port) : undefined,
  verifyConnection:
    req.body.verifyConnection === 'true' ? true : req.body.verifyConnection === 'false' ? false : req.body.verifyConnection,
  scanDirectories:
    typeof req.body.scanDirectories === 'string'
      ? req.body.scanDirectories.split(',').map((item: string) => item.trim()).filter(Boolean)
      : req.body.scanDirectories,
});

export const serverManagementController = {
  async connect(req: Request, res: Response) {
    const server = await serverConnectionService.connect(req.body as any, getRequestUserId(req));
    return res.status(201).json({
      success: true,
      data: server,
      message: 'Server connection saved.',
    });
  },

  async connectWithPem(req: Request, res: Response) {
    const server = await serverConnectionService.connect(multipartPayload(req) as any, getRequestUserId(req));
    return res.status(201).json({
      success: true,
      data: server,
      message: 'Server connection saved.',
    });
  },

  async list(req: Request, res: Response) {
    const servers = await withDashboardEndpointLog(
      'servers/list',
      'mongo',
      () => serverConnectionService.list(getRequestUserId(req)),
    );
    return res.json({
      success: true,
      data: servers,
    });
  },

  async update(req: Request, res: Response) {
    const server = await serverConnectionService.update(req.params.id, req.body as any);
    return res.json({
      success: true,
      data: server,
      message: 'Server updated.',
    });
  },

  async updateWithPem(req: Request, res: Response) {
    const server = await serverConnectionService.update(req.params.id, multipartPayload(req) as any);
    return res.json({
      success: true,
      data: server,
      message: 'Server updated.',
    });
  },

  async remove(req: Request, res: Response) {
    await serverConnectionService.remove(req.params.id);
    return res.json({
      success: true,
      data: null,
      message: 'Server deleted.',
    });
  },

  async bulkRemove(req: Request, res: Response) {
    const { selectedIds } = req.body as { selectedIds: string[] };
    await serverConnectionService.bulkRemove(selectedIds);
    return res.json({
      success: true,
      data: { selectedIds },
      message: 'Servers deleted.',
    });
  },
};
