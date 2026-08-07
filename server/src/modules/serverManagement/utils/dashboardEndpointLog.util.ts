import { logger } from '../../../utils/logger.util';

type DashboardEndpointSource = 'mongo' | 'cache' | 'mongo/cache' | 'ssh';

export const logDashboardEndpoint = (
  endpoint: string,
  source: DashboardEndpointSource,
  durationMs: number,
  detail = '',
) => {
  logger.info(
    `[ServerDashboard] endpoint=${endpoint} source=${source} durationMs=${durationMs} ssh=${source === 'ssh'} shell=${source === 'ssh'} impact=${source === 'ssh' ? 'high' : 'low'}${detail ? ` ${detail}` : ''}`,
  );
};

export const withDashboardEndpointLog = async <T>(
  endpoint: string,
  source: DashboardEndpointSource,
  fn: () => Promise<T>,
  detail = '',
) => {
  const startedAt = Date.now();
  try {
    return await fn();
  } finally {
    logDashboardEndpoint(endpoint, source, Date.now() - startedAt, detail);
  }
};
