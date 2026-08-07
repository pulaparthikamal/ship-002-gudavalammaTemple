import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import morgan from 'morgan';
import { logger } from '../utils/logger.util';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = randomUUID();
  req.headers['x-request-id'] = requestId;
  res.locals.requestId = requestId;
  next();
};

const stream = {
  write: (message: string) => logger.info(message.substring(0, message.lastIndexOf('\n'))),
};

export const morganMiddleware = morgan(
  ':method :url :status :res[content-length] - :response-time ms [ReqId: :req[x-request-id]]',
  { stream }
);
