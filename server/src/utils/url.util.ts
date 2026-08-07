import { Request } from 'express';
import { envConfig } from '../config/env.config';

/**
 * Get the base URL of the current request (including protocol and host)
 */
export const getRequestBaseUrl = (req: Request): string => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}`;
};

/**
 * Get the frontend URL dynamically.
 * Priority: 
 * 1. Origin header (if it exists)
 * 2. Referer header (if it exists)
 * 3. envConfig.frontendUrl as fallback
 */
export const getFrontendUrl = (req: Request): string => {
  const origin = req.get('origin');
  if (origin) return origin;

  const referer = req.get('referer');
  if (referer) {
    try {
      const url = new URL(referer);
      // Ignore referers from OAuth providers to prevent redirecting to their 404 pages
      const ignoredDomains = ['accounts.google.com', 'facebook.com', 'linkedin.com', 'instagram.com'];
      if (!ignoredDomains.some(domain => url.hostname.includes(domain))) {
        return `${url.protocol}//${url.host}`;
      }
    } catch (e) {
      // invalid URL in referer, ignore
    }
  }

  return envConfig.frontendUrl || 'http://localhost:5173';
};
