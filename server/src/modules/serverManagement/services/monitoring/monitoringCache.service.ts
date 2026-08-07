import { IMetricsHistory } from '../../models/metricsHistory.model';

type LatestMetric = IMetricsHistory & { _id: unknown };

const latestMetricsByServer = new Map<string, LatestMetric>();

export const monitoringCacheService = {
  setLatestMetric(serverId: string, metric: LatestMetric) {
    latestMetricsByServer.set(serverId, metric);
  },

  getLatestMetric(serverId: string) {
    return latestMetricsByServer.get(serverId) || null;
  },

  getLastSampleAt(serverId?: string) {
    if (serverId) {
      return latestMetricsByServer.get(serverId)?.collectedAt ?? null;
    }

    return [...latestMetricsByServer.values()].reduce<Date | null>((latest, metric) => {
      if (!latest || metric.collectedAt > latest) {
        return metric.collectedAt;
      }

      return latest;
    }, null);
  },
};
