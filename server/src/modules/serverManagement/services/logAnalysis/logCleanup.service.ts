import { Types } from 'mongoose';
import {
  ArchivedLog,
  LogCleanupHistory,
  LogProcessed,
  SupportedLogSource,
} from '../../models/logAnalysis.model';
import { configService } from '../config.service';
import { retentionPolicyService } from './retentionPolicy.service';

export interface CleanupRecommendation {
  source: SupportedLogSource;
  action: 'archive_recommended' | 'delete_recommended';
  target: string;
  reason: string;
  retentionDays: number;
  affectedCount: number;
  oldestTimestamp?: Date;
  archiveBeforeCleanup: true;
}

export const logCleanupService = {
  async recommend(serverId?: string): Promise<CleanupRecommendation[]> {
    const recommendations: CleanupRecommendation[] = [];
    const config = serverId ? await configService.get(serverId) : undefined;

    for (const policy of retentionPolicyService.listPolicies(config)) {
      const archiveAfterDays = policy.archiveAfterDays;
      const deleteAfterDays = policy.deleteAfterDays;
      const serverQuery = serverId ? { server: new Types.ObjectId(serverId) } : {};
      const archiveCutoff = retentionPolicyService.getCutoff(archiveAfterDays);
      const deleteCutoff = retentionPolicyService.getCutoff(deleteAfterDays);

      const [archiveCandidate, deleteCandidate] = await Promise.all([
        LogProcessed.aggregate([
          { $match: { ...serverQuery, source: policy.source, timestamp: { $lt: archiveCutoff } } },
          { $group: { _id: null, count: { $sum: 1 }, oldest: { $min: '$timestamp' } } },
        ]),
        LogProcessed.aggregate([
          { $match: { ...serverQuery, source: policy.source, timestamp: { $lt: deleteCutoff } } },
          { $group: { _id: null, count: { $sum: 1 }, oldest: { $min: '$timestamp' } } },
        ]),
      ]);

      if (archiveCandidate[0]?.count) {
        recommendations.push({
          source: policy.source,
          action: 'archive_recommended',
          target: `${policy.source} processed logs older than ${archiveAfterDays} days`,
          reason: `Retention policy recommends archive after ${archiveAfterDays} days. No log files are modified by this recommendation.`,
          retentionDays: archiveAfterDays,
          affectedCount: archiveCandidate[0].count,
          oldestTimestamp: archiveCandidate[0].oldest,
          archiveBeforeCleanup: true,
        });
      }

      if (deleteCandidate[0]?.count) {
        recommendations.push({
          source: policy.source,
          action: 'delete_recommended',
          target: `${policy.source} processed logs older than ${deleteAfterDays} days`,
          reason: `Retention policy allows deletion after ${deleteAfterDays} days only after archive has been confirmed.`,
          retentionDays: deleteAfterDays,
          affectedCount: deleteCandidate[0].count,
          oldestTimestamp: deleteCandidate[0].oldest,
          archiveBeforeCleanup: true,
        });
      }
    }

    return recommendations;
  },

  async auditRecommendations(serverId: string, recommendations: CleanupRecommendation[]) {
    if (!recommendations.length) {
      await LogCleanupHistory.create({
        server: new Types.ObjectId(serverId),
        action: 'policy_evaluated',
        status: 'skipped',
        reason: 'Retention policies evaluated; no archive/delete recommendations were needed.',
        retentionDays: 0,
        recommendedAt: new Date(),
        auditTrail: ['policy_evaluated', 'no_cleanup_executed'],
        metadata: { safety: 'recommendation_only' },
      });
      return [];
    }

    const entries = await LogCleanupHistory.insertMany(
      recommendations.map((recommendation) => ({
        server: new Types.ObjectId(serverId),
        action: recommendation.action,
        status: 'recommended',
        source: recommendation.source,
        target: recommendation.target,
        reason: recommendation.reason,
        retentionDays: recommendation.retentionDays,
        recommendedAt: new Date(),
        auditTrail: [
          'retention_policy_evaluated',
          'archive_before_cleanup_required',
          'no_delete_executed',
        ],
        metadata: {
          affectedCount: recommendation.affectedCount,
          oldestTimestamp: recommendation.oldestTimestamp,
          archiveBeforeCleanup: true,
          safety: 'recommendation_only',
        },
      })),
    );

    await ArchivedLog.insertMany(
      recommendations
        .filter((recommendation) => recommendation.action === 'archive_recommended')
        .map((recommendation) => ({
          server: new Types.ObjectId(serverId),
          source: recommendation.source,
          status: 'recommended',
          reason: recommendation.reason,
          retentionDays: recommendation.retentionDays,
          metadata: {
            target: recommendation.target,
            affectedCount: recommendation.affectedCount,
            safety: 'archive_not_executed',
          },
        })),
    );

    return entries;
  },
};
