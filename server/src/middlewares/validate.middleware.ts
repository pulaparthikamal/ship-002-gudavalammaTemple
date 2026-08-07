import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import respUtil from '../utils/resp.util';
import { HTTP_STATUS } from '../constants/httpStatus.constants';
import { t } from '../i18n';

export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      req.body = parsed.body;
      req.query = parsed.query;
      req.params = parsed.params;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        req.duplicates = errors;
        req.errorMessage = t('common.validation.failed', {}, req.locale);
        req.statusCode = HTTP_STATUS.BAD_REQUEST;
        return res.status(HTTP_STATUS.BAD_REQUEST).json(respUtil.getErrorResponse(req));
      }
      next(error);
    }
  };
};
