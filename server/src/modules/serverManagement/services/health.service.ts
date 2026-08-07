import { Types } from 'mongoose';
import { Metric } from '../models/metric.model';
import { Prediction } from '../models/prediction.model';


const average = (arr: number[]) => {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export const healthService = {
  async calculateScore(serverId: string): Promise<number> {
    const metrics = await Metric.find({
      server: new Types.ObjectId(serverId),
    })
      .sort({ collectedAt: -1 })
      .limit(30)
      .lean();

    if (!metrics.length) return 100;

    const cpuAvg = average(metrics.map((m) => m.cpuUsagePercent || 0));
    const memoryAvg = average(metrics.map((m) => m.memoryUsagePercent || 0));
    const diskAvg = average(metrics.map((m) => m.diskUsagePercent || 0));
    const swapAvg = average(metrics.map((m) => m.swapUsagePercent || 0));
    const loadAvg = average(metrics.map((m) => m.loadAverage || 0));

    const latestMetric = metrics[0];

    let score = 100;

    // -----------------------------
    // CPU deductions
    // -----------------------------
    if (cpuAvg > 90) {
      score -= 30;
    } else if (cpuAvg > 80) {
      score -= 20;
    } else if (cpuAvg > 70) {
      score -= 10;
    }

    // -----------------------------
    // Memory deductions
    // -----------------------------
    if (memoryAvg > 95) {
      score -= 25;
    } else if (memoryAvg > 85) {
      score -= 15;
    } else if (memoryAvg > 75) {
      score -= 8;
    }

    // -----------------------------
    // Disk deductions
    // -----------------------------
    if (diskAvg > 95) {
      score -= 30;
    } else if (diskAvg > 85) {
      score -= 20;
    } else if (diskAvg > 75) {
      score -= 10;
    }

    // -----------------------------
    // Swap deductions
    // -----------------------------
    if (swapAvg > 50) {
      score -= 15;
    } else if (swapAvg > 20) {
      score -= 8;
    }

    // -----------------------------
    // Load Average deductions
    // -----------------------------
    if (
      latestMetric.cpuCores &&
      loadAvg > latestMetric.cpuCores * 1.5
    ) {
      score -= 15;
    }

    // -----------------------------
    // Prediction deductions
    // Only deduct if prediction confidence >= 0.7
    // -----------------------------
    const recentPredictions = await Prediction.find({
      server: new Types.ObjectId(serverId),
      created: {
        $gt: new Date(Date.now() - 6 * 60 * 60 * 1000), // last 6 hrs
      },
    }).lean();

    recentPredictions.forEach((prediction) => {
      prediction.predictions.forEach((sub: any) => {
        if (sub.confidence < 0.7) return;

        if (sub.severity === 'critical') {
          score -= 15;
        } else if (sub.severity === 'high') {
          score -= 10;
        } else if (sub.severity === 'medium') {
          score -= 5;
        }
      });
    });

    return Math.max(0, Math.min(100, Math.round(score)));
  },
};
