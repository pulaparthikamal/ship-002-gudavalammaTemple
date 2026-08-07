import { IMetric } from '../models/metric.model';

export interface ITrendResult {
  metric: string;
  current: number;
  average: number;
  slope: number;
  delta: number;
  anomalyScore: number;
}

export const computeTrends = (metrics: IMetric[]): Record<string, ITrendResult> => {
  if (metrics.length < 2) return {};

  const keys: Array<keyof IMetric> = [
    'cpuUsagePercent',
    'memoryUsagePercent',
    'diskUsagePercent',
    'swapUsagePercent',
    'loadAverage',
    'networkDownloadSpeed',
    'networkUploadSpeed',
    'diskReadIo',
    'diskWriteIo',
  ];

  const results: Record<string, ITrendResult> = {};

  keys.forEach((key) => {
    const values = metrics.map((m) => m[key] as number).reverse(); // oldest to newest
    const current = values[values.length - 1];
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const delta = current - values[0];
    
    // Simple slope: (y2 - y1) / (x2 - x1) -> here we use index as x
    const slope = (current - values[0]) / (values.length - 1 || 1);

    // Anomaly score: distance from average in standard deviations
    const squareDiffs = values.map((v) => Math.pow(v - average, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    const stdDev = Math.sqrt(avgSquareDiff);
    const anomalyScore = stdDev === 0 ? 0 : Math.abs(current - average) / stdDev;

    results[key] = {
      metric: key,
      current,
      average,
      slope,
      delta,
      anomalyScore,
    };
  });

  return results;
};
