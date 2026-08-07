import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload | unknown;
      locale?: string;
      entityType?: string;
      i18nKey?: string;
      errorMessage?: string;
      duplicates?: unknown[];
      token?: {
        accessToken?: string;
        refreshToken?: string | null;
      } | unknown;
      statusCode?: number;
      [key: string]: unknown;
    }
  }
}
