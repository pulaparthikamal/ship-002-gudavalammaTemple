import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/error.util';
import respUtil from '../utils/resp.util';
import { HTTP_STATUS } from '../constants/httpStatus.constants';
import { logger } from '../utils/logger.util';
import { t } from '../i18n';

function normalizeDuplicateField(field: string | undefined) {
  switch (field) {
    case 'mrn':
    case 'MRN':
    case 'medicalRecordNo':
    case 'medical_record_number':
      return 'medicalRecordNumber';
    default:
      return field || 'field';
  }
}

function buildDuplicateFieldMessage(field: string) {
  if (field === 'medicalRecordNumber') {
    return 'Medical record number already exists';
  }

  return `${field} already exists`;
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message = t('common.server.internalError', {}, req.locale);

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    req.duplicates = err.errors as unknown[]; // Map errors to duplicates for getErrorResponse
  } else if ((err as any).code === 11000) {
    statusCode = HTTP_STATUS.CONFLICT;
    message = t('common.error.duplicate', {}, req.locale);
    const field = normalizeDuplicateField(Object.keys((err as any).keyValue || {})[0]);
    req.duplicates = [{ field, message: buildDuplicateFieldMessage(field) }];
  } else {
    logger.error(`[UNHANDLED ERROR] ${err.name}: ${err.message}`, { stack: err.stack });
  }

  req.errorMessage = message;
  req.statusCode = statusCode;
  return res.status(statusCode).json(respUtil.getErrorResponse(req));
};
