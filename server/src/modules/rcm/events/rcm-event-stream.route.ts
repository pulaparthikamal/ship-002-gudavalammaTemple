import { Router } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { Token } from '../../token/token.model';
import { verifyAccessToken } from '../../../utils/token.util';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { attachRcmEventStream } from './rcm-event-stream.service';

const router = Router();

function readBearerToken(value?: string | string[]) {
  const headerValue = Array.isArray(value) ? value[0] : value;
  return headerValue?.startsWith('Bearer ') ? headerValue.slice('Bearer '.length).trim() : '';
}

router.get('/stream', asyncHandler(async (req, res) => {
  const accessToken = readBearerToken(req.headers.authorization)
    || (typeof req.query.accessToken === 'string' ? req.query.accessToken.trim() : '');

  if (!accessToken) {
    throw new AppError('Authentication token is required for RCM event stream.', HTTP_STATUS.UNAUTHORIZED);
  }

  verifyAccessToken(accessToken) as JwtPayload;
  const tokenDoc = await Token.findOne({ accessToken, active: true }).populate('user');
  const user = tokenDoc?.user as any;

  if (!tokenDoc || !user?.active) {
    throw new AppError('Authentication token is invalid for RCM event stream.', HTTP_STATUS.UNAUTHORIZED);
  }

  const lastEventId = typeof req.headers['last-event-id'] === 'string'
    ? req.headers['last-event-id']
    : typeof req.query.lastEventId === 'string'
      ? req.query.lastEventId
      : undefined;
  attachRcmEventStream(res, { lastEventId });
}));

export default router;
