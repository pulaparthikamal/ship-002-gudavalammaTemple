// The backend mounts routes under /api/v1. Falling back to /api causes
// deployed builds without VITE_API_BASE_URL to hit non-existent routes.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
export const API_TIMEOUT_MS = 600_000 // 10 minutes
export const RCM_REALTIME_ENABLED = (import.meta.env.VITE_RCM_REALTIME_ENABLED ?? 'true') === 'true'
export const RCM_REALTIME_MODE = import.meta.env.VITE_RCM_REALTIME_MODE ?? 'sse'
export const RCM_REALTIME_POLLING_INTERVAL_MS = parseIntervalMs(
  import.meta.env.VITE_RCM_REALTIME_POLL_INTERVAL_MS ?? import.meta.env.VITE_RCM_REALTIME_POLLING_INTERVAL_MS,
  30_000,
)

// Derive Auth Base URL (strip /api/v1 from the end)
export const AUTH_BASE_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '')

function getApiBaseUrl(baseStr: string = API_BASE_URL) {
  if (/^https?:\/\//i.test(baseStr)) {
    return baseStr
  }

  if (typeof window !== 'undefined') {
    return new URL(baseStr, window.location.origin).toString()
  }

  return baseStr
}

function parseIntervalMs(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const LONG_RUNNING_API_TIMEOUT_MS = parseIntervalMs(
  import.meta.env.VITE_LONG_RUNNING_API_TIMEOUT_MS,
  10 * 60 * 1000,
)
export const SERVER_DASHBOARD_POLLING_INTERVAL_MS = parseIntervalMs(
  import.meta.env.VITE_SERVER_DASHBOARD_POLLING_INTERVAL_MS,
  10 * 60 * 1000,
)
export const SERVER_DASHBOARD_CPU_TREND_POLLING_INTERVAL_MS = parseIntervalMs(
  import.meta.env.VITE_SERVER_DASHBOARD_CPU_TREND_POLLING_INTERVAL_MS,
  1000,
)
export const SERVER_DASHBOARD_SOCKET_REFRESH_INTERVAL_MS = parseIntervalMs(
  import.meta.env.VITE_SERVER_DASHBOARD_SOCKET_REFRESH_INTERVAL_MS,
  2000,
)


export function resolveApiAssetUrl(filePath?: string) {
  let normalizedPath = filePath?.trim()

  if (!normalizedPath) {
    return ''
  }

  // Intercept and rewrite generated media URLs to the node-served static route.
  if (normalizedPath.includes('/media/social_media_posts/') || normalizedPath.startsWith('media/social_media_posts/')) {
    const fileName = normalizedPath.split(/\/?media\/social_media_posts\//).pop();
    if (fileName) {
      normalizedPath = `social_media_posts/${fileName}`;
    }
  }

  if (/^(data:|blob:)/i.test(normalizedPath)) {
    return normalizedPath
  }

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath
  }

  // If the path already starts with 'api/' or '/api/', resolve it against the domain root
  // to avoid duplicated prefixes like /api/v1/api/v1/
  // Similarly, resolve generated assets (like social_media_posts) directly against AUTH_BASE_URL since they live outside /api/v1
  const isApiPath = normalizedPath.startsWith('api/') || normalizedPath.startsWith('/api/')
  const isSocialPath = normalizedPath.startsWith('social_media_posts/') || normalizedPath.startsWith('/social_media_posts/')
  const base = (isApiPath || isSocialPath) ? AUTH_BASE_URL : API_BASE_URL

  const baseUrl = getApiBaseUrl(base)

  try {
    const apiUrl = new URL(baseUrl)
    const apiPrefix = apiUrl.pathname.replace(/\/+$/, '')
    const apiOrigin = apiUrl.origin
    const pathWithoutLeadingSlash = normalizedPath.replace(/^\/+/, '')

    if (normalizedPath.startsWith(`${apiPrefix}/`)) {
      return `${apiOrigin}${normalizedPath}`
    }

    if (pathWithoutLeadingSlash.startsWith(`${apiPrefix.replace(/^\/+/, '')}/`)) {
      return `${apiOrigin}/${pathWithoutLeadingSlash}`
    }

    if (normalizedPath.startsWith('/uploads/')) {
      return `${apiOrigin}${apiPrefix}${normalizedPath}`
    }

    if (pathWithoutLeadingSlash.startsWith('uploads/')) {
      return `${apiOrigin}${apiPrefix}/${pathWithoutLeadingSlash}`
    }

    // Ensure the filePath is treated as a relative path to the base
    return new URL(pathWithoutLeadingSlash, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString()
  } catch {
    return normalizedPath
  }
}
