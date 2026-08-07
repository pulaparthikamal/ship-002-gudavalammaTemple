import { Request, Response } from 'express';
import respUtil from '../utils/resp.util';
import { HTTP_STATUS } from '../constants/httpStatus.constants';
import { t } from '../i18n';

export const notFoundHandler = (req: Request, res: Response) => {
  req.errorMessage = t('common.route.notFound', {}, req.locale);
  return res.status(HTTP_STATUS.NOT_FOUND).json(respUtil.getErrorResponse(req));
};
