import { PipelineStep, PipelineContext } from '../pipeline.types';
import { releaseService } from '../../release.service';
import { lockService } from '../../lock.service';
import { Deployment } from '../../../models/deployment.model';

export const finalizeStep: PipelineStep = {
  name: 'finalize',

  shouldRun(_ctx: PipelineContext): boolean {
    return true;
  },

  async run(ctx: PipelineContext): Promise<void> {
    const { application, target, sshConfig } = ctx;

    const keepCount = application.releasesKept || 3;
    ctx.logger.info(`Pruning old releases (keeping last ${keepCount})…`);

    try {
      await releaseService.pruneOldReleases(sshConfig, target.baseWebRoot, application.name, keepCount);
      ctx.logger.info('Old releases pruned.');
    } catch (err) {
      ctx.logger.warn(`Release pruning warning: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Record version snapshot for rollback history tracking
    try {
      const versionEntry = {
        version: ctx.deployment.commitSha || String(ctx.deployment._id).slice(-8),
        buildNumber: String(ctx.deployment._id).slice(-6),
        commitHash: ctx.deployment.commitSha || ctx.deployment.commit?.sha,
        environment: ctx.deployment.branch || 'production',
        deploymentDate: new Date(),
        status: 'success',
        releaseDir: ctx.componentReleaseDir,
      };
      await Deployment.updateOne(
        { _id: ctx.deployment._id },
        { $push: { versionHistory: versionEntry } },
      );
    } catch {
      // Non-critical — do not fail the deployment
    }

    lockService.release(String(application._id), String(ctx.deployment._id));
    ctx.logger.info('Deployment lock released.');
    ctx.logger.info('Deployment finalized successfully.');
  },
};
