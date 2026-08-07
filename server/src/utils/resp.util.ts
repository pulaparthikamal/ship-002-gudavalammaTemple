import { Request } from 'express';
import { HTTP_STATUS } from '../constants/httpStatus.constants';
import { t } from '../i18n';
import jwt from 'jsonwebtoken';

/**
 * get error response
 * @param req
 * @returns {responseObj}
 */
const getErrorResponse = (req: Request) => {
  const message = req.errorMessage || t(req.i18nKey || 'common.error', {}, req.locale);
  const statusCode = req.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const errors = req.duplicates && req.duplicates.length > 0 ? req.duplicates : null;
  const firstError = Array.isArray(errors) && errors[0] && typeof errors[0] === 'object'
    ? errors[0] as Record<string, unknown>
    : null;
  const submissionStatus = firstError?.submissionStatus;

  const response: Record<string, unknown> = {
    success: false,
    statusCode,
    respMessage: message,
    data: null,
    meta: null,
    errors,
  };

  if (typeof submissionStatus === 'string') {
    response.submissionStatus = submissionStatus;
  }

  return response;
};

/**
 * create success response
 * @param req
 * @returns {responseObj}
 */
const createSuccessResponse = (req: Request) => {
  const entity = req.entityType;
  const data = entity ? (req as unknown as Record<string, unknown>)[entity] : null;

  const resp: Record<string, unknown> = {
    success: true,
    statusCode: HTTP_STATUS.CREATED, // 201
    respMessage: t(`${req.entityType}.create.success`, {}, req.locale),
    data: data ?? null,
    meta: null,
    errors: null,
  };

  if (entity && data) {
    const id = typeof data === 'object' && '_id' in data ? (data as { _id?: string })._id ?? '' : '';
    resp[`${entity}Id`] = id;
  }

  return resp;
}

const updateSuccessResponse = (req: Request) => {
  const entity = req.entityType;
  const data = entity ? (req as unknown as Record<string, unknown>)[entity] : null;

  const resp: Record<string, unknown> = {
    success: true,
    statusCode: HTTP_STATUS.OK, // 200
    respMessage: t(`${req.entityType}.update.success`, {}, req.locale),
    data: data ?? null,
    meta: null,
    errors: null,
  }

  if (entity && data) {
    const id = typeof data === 'object' && '_id' in data ? (data as { _id?: string })._id ?? '' : '';
    resp[`${entity}Id`] = id;
  }

  return resp;
}
/**
 * remove success response
 * @param req
 * @returns {responseObj}
 */
const removeSuccessResponse = (req: Request) => {
  const entity = req.entityType;
  const data = entity ? (req as unknown as Record<string, unknown>)[entity] : null;

  const resp: Record<string, unknown> = {
    success: true,
    statusCode: HTTP_STATUS.OK, // 200
    respMessage: t(`${req.entityType}.delete.success`, {}, req.locale),
    data: data ?? null,
    meta: null,
    errors: null,
  };

  if (entity && data) {
    const id = typeof data === 'object' && '_id' in data ? (data as { _id?: string })._id ?? '' : '';
    resp[`${entity}Id`] = id;
  }

  return resp;
};

/**
 * success response
 * @param req
 * @returns {responseObj}
 */
const successResponse = (req: Request) => {
  return {
    success: true,
    statusCode: HTTP_STATUS.OK,
    respMessage: t(req.i18nKey || 'common.success', {}, req.locale),
    data: null,
    meta: null,
    errors: null,
  };
}

const dataSuccessResponse = (req: Request, data: unknown, message?: string) => {
  return {
    success: true,
    statusCode: HTTP_STATUS.OK,
    respMessage: message ?? t(req.i18nKey || 'common.success', {}, req.locale),
    data: data ?? null,
    meta: null,
    errors: null,
  };
}
/**
 * success response when get details/get details by id
 * 
 * @returns {responseObj}
 */
/**
 * success response for lists
 * @param req 
 * @returns 
 */
const getListSuccessResponse = (req: Request) => {
  const entity = req.entityType;
  const data = entity ? (req as unknown as Record<string, unknown>)[entity] : [];
  const pagination = (req as any).pagination || {};

  return {
    success: true,
    statusCode: HTTP_STATUS.OK,
    respMessage: '',
    data: data,
    meta: {
      page: pagination.page || 1,
      pageSize: pagination.limit || 20,
      total: pagination.totalCount || (Array.isArray(data) ? data.length : 0),
    },
    errors: null,
  };
}

/**
 * success response when get details/get details by id
 * 
 * @returns {responseObj}
 */
const getDetailsSuccessResponse = (req: Request) => {
  const entity = req.entityType;
  const data = entity ? (req as unknown as Record<string, unknown>)[entity] : null;

  return {
    success: true,
    statusCode: HTTP_STATUS.OK,
    respMessage: '',
    data: data,
    meta: null,
    errors: null,
  };
}
/**
 * login success response
 * @param req
 * @returns {responseObj}
 */
const loginSuccessResponse = (req: Request) => {
  const nowSec = Math.floor(Date.now() / 1000);
  let expiresAt: number | null = null;
  let expiresIn: number | undefined = undefined;
  const tokenObj = typeof req.token === 'object' && req.token ? (req.token as { accessToken?: string; refreshToken?: string | null }) : undefined;
  const accessTokenForDecode = tokenObj?.accessToken ?? '';
  try {
    const decoded = jwt.decode(accessTokenForDecode) as { exp?: number } | string | null;
    if (decoded && typeof decoded !== 'string' && decoded.exp) {
      expiresAt = decoded.exp * 1000; // milliseconds
      expiresIn = decoded.exp - nowSec; // seconds
    }
  } catch (err) {
    // ignore decode errors
  }
  const data = req.entityType
    ? (req as unknown as Record<string, unknown>)[req.entityType]
    : (req.user ?? null);

  const accessToken = tokenObj?.accessToken;
  const refreshToken = tokenObj?.refreshToken ?? null;

  return {
    success: true,
    statusCode: HTTP_STATUS.OK,
    respMessage: t(req.i18nKey || 'auth.login.success', {}, req.locale),
    data: data ?? null,
    meta: null,
    errors: null,
    accessToken,
    refreshToken,
    expiresAt,
    expiresIn,
  };
};

/**
 * logout success response
 * @param req
 * @returns {responseObj}
 */
const logoutSuccessResponse = (req: Request) => {
  return {
    success: true,
    statusCode: HTTP_STATUS.OK,
    respMessage: t(req.i18nKey || 'auth.logout.success', {}, req.locale),
    data: null,
    meta: null,
    errors: null,
  };
}

/**
 * update logo response
 * @param req
 * @returns {responseObj}
 */
const uploadLogoSucessResponse = (req: Request) => {
  return {
    success: true,
    statusCode: HTTP_STATUS.NO_CONTENT,
    respMessage: '',
    data: { fileName: req.image },
    meta: null,
    errors: null,
  };
}

async function uploadCsvSucessResponse(req: Request) {
  return {
    success: true,
    statusCode: HTTP_STATUS.NO_CONTENT,
    respMessage: t(`${req.entityType}.upload.success`, {}, req.locale),
    data: { fileName: req.attachment },
    meta: null,
    errors: null,
  };
}

export default {
  getErrorResponse,
  createSuccessResponse,
  updateSuccessResponse,
  removeSuccessResponse,
  successResponse,
  dataSuccessResponse,
  loginSuccessResponse,
  logoutSuccessResponse,
  uploadLogoSucessResponse,
  getDetailsSuccessResponse,
  getListSuccessResponse,
  uploadCsvSucessResponse
};
