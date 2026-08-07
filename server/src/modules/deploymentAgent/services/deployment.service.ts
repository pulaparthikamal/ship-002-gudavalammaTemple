import { Types } from 'mongoose';
import { Deployment, IDeployment, ICommitInfo, DeploymentTrigger } from '../models/deployment.model';
import { applicationService } from './application.service';
import { deploymentTargetService } from './deploymentTarget.service';
import { deploymentQueueService } from './deploymentQueue.service';
import { deploymentPredictionService } from './deploymentPrediction.service';
import { IChangedFile } from '../models/deploymentPrediction.model';
import { releaseService } from './release.service';
import { pipelineService } from './pipeline/pipeline.service';
import { deploymentLogService } from './log.service';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { sshUtil } from '../utils/ssh.util';
import { deploymentPathUtil } from '../utils/path.util';
import { envConfig } from '../../../config/env.config';
import { reportService } from './report.service';
import { deploymentNotificationService } from './deploymentNotification.service';
import { logger } from '../../../utils/logger.util';

export interface TriggerDeploymentPayload {
  applicationId: string;
  targetId: string;
  branch?: string;
  commitSha?: string;
  trigger?: DeploymentTrigger;
  commit?: ICommitInfo;
  deliveryId?: string;
  predictionId?: string;
  changedFiles?: IChangedFile[];
  triggeredBy?: Types.ObjectId;
}

export const deploymentService = {
  async trigger(payload: TriggerDeploymentPayload) {
    const [application, target] = await Promise.all([
      applicationService.getById(payload.applicationId),
      deploymentTargetService.getById(payload.targetId),
    ]);

    // Predict-Then-Deploy: a prediction is generated before the deployment runs.
    // Manual deploys pass a predictionId from the UI; auto-deploys (webhook) have
    // none, so we generate one here.
    //
    // Resilience for auto-deploys: a prediction failure — most commonly the LLM
    // prediction service being unavailable — must NOT block the deployment. We never
    // fabricate heuristic scores (predictions are LLM-only by policy); instead we
    // record an honest "prediction unavailable" entry carrying the failure reason and
    // let the deployment proceed, so Prediction History still gets a traceable record.
    let predictionId = payload.predictionId;
    if (!predictionId) {
      try {
        const prediction = await deploymentPredictionService.predict({
          applicationId: payload.applicationId,
          targetId: payload.targetId,
          branch: payload.branch,
          commit: payload.commit,
          commitSha: payload.commitSha,
          changedFiles: payload.changedFiles,
          triggeredBy: payload.triggeredBy,
        });
        predictionId = String(prediction._id);
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'AI deployment prediction could not be generated.';
        logger.warn(`[Deployment] Prediction unavailable for auto-deploy of application ${payload.applicationId}; proceeding without an AI risk assessment. Reason: ${reason}`);
        try {
          const unavailable = await deploymentPredictionService.recordUnavailable({
            applicationId: payload.applicationId,
            targetId: payload.targetId,
            branch: payload.branch || application.repository.branch || 'main',
            commit: payload.commit,
            commitSha: payload.commitSha,
            triggeredBy: payload.triggeredBy,
            reason,
          });
          predictionId = String(unavailable._id);
        } catch (recordErr) {
          // Even failing to persist the placeholder must not block the deploy.
          logger.error(`[Deployment] Failed to persist prediction-unavailable record for application ${payload.applicationId}: ${recordErr instanceof Error ? recordErr.message : String(recordErr)}`);
        }
      }
    }

    const deployment = await Deployment.create({
      applicationId: new Types.ObjectId(payload.applicationId),
      targetId: new Types.ObjectId(payload.targetId),
      status: 'pending',
      steps: [],
      branch: payload.branch || application.repository.branch || 'main',
      commitSha: payload.commitSha || payload.commit?.sha,
      trigger: payload.trigger || 'manual',
      commit: payload.commit,
      deliveryId: payload.deliveryId,
      triggeredBy: payload.triggeredBy,
      active: true,
      created: new Date(),
      updated: new Date(),
    });

    const deploymentId = String(deployment._id);

    // Map the pre-deployment prediction to this deployment (predict-then-deploy).
    if (predictionId) {
      void deploymentPredictionService
        .linkToDeployment(predictionId, deployment._id as Types.ObjectId)
        .catch(() => undefined);
    }

    void deploymentNotificationService.sendNotification('deployment_started', deploymentId);

    void reportService.logAudit({
      action: 'deployment_started',
      result: 'success',
      userId: payload.triggeredBy,
      applicationId: application._id,
      appName: application.name,
      targetId: target._id,
      targetName: target.name,
      environment: payload.branch || 'production',
      details: `Manual trigger initiated for branch ${payload.branch || 'production'}. Commit: ${payload.commit?.message || 'None'}`
    });

    await deploymentQueueService.schedule(
      String(application._id),
      deploymentId,
      application,
      target,
      () => pipelineService.run(deployment, application, target),
    );

    return deployment;
  },

  async list(query: {
    applicationId?: string;
    targetId?: string;
    status?: string;
    page?: string;
    limit?: string;
  }) {
    const filter: Record<string, unknown> = { active: true };
    if (query.applicationId) filter.applicationId = new Types.ObjectId(query.applicationId);
    if (query.targetId) filter.targetId = new Types.ObjectId(query.targetId);
    if (query.status) filter.status = query.status;

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Deployment.find(filter)
        .sort({ created: -1 })
        .skip(skip)
        .limit(limit)
        .populate('applicationId', 'name displayName')
        .populate('targetId', 'name host'),
      Deployment.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  },

  async getById(id: string) {
    const deployment = await Deployment.findOne({ _id: id, active: true })
      .populate('applicationId', 'name displayName')
      .populate('targetId', 'name host');
    if (!deployment) {
      throw new AppError('Deployment not found.', HTTP_STATUS.NOT_FOUND);
    }
    return deployment;
  },

  async cancel(id: string) {
    const deployment = await Deployment.findOne({ _id: id, active: true });
    if (!deployment) {
      throw new AppError('Deployment not found.', HTTP_STATUS.NOT_FOUND);
    }
    if (!['pending', 'running'].includes(deployment.status)) {
      throw new AppError(`Cannot cancel a deployment in "${deployment.status}" state.`, HTTP_STATUS.BAD_REQUEST);
    }

    await Deployment.updateOne(
      { _id: id },
      { status: 'cancelled', completedAt: new Date(), updated: new Date() },
    );

    void reportService.logAudit({
      action: 'deployment_cancelled',
      result: 'info',
      applicationId: deployment.applicationId,
      targetId: deployment.targetId,
      environment: deployment.branch || 'production',
      details: 'Deployment was cancelled by user.'
    });

    return id;
  },

  async rollback(id: string, reason?: string, opts?: { targetVersion?: string; confidenceScore?: number; riskLevel?: string; triggeredBy?: Types.ObjectId }) {
    const deployment = await this.getById(id) as IDeployment;
    if (deployment.status !== 'success') {
      throw new AppError('Only successful deployments can be rolled back.', HTTP_STATUS.BAD_REQUEST);
    }
    if (!deployment.previousReleaseDir) {
      throw new AppError('No previous release available to roll back to. The deployment has no recorded previous commit SHA.', HTTP_STATUS.BAD_REQUEST);
    }

    const rollbackStartedAt = new Date();
    const previousSha = deployment.previousReleaseDir;

    await Deployment.updateOne(
      { _id: id },
      { status: 'rolling_back', rollbackReason: reason, startedAt: rollbackStartedAt, updated: new Date() },
    );
    await deploymentLogService.write(id, `[Rollback] Starting rollback to previous commit: ${previousSha}`, 'info');
    if (reason) {
      await deploymentLogService.write(id, `[Rollback] Reason: ${reason}`, 'info');
    }
    if (opts?.riskLevel) {
      await deploymentLogService.write(id, `[Rollback] Risk level: ${opts.riskLevel}${opts.confidenceScore !== undefined ? `, confidence: ${opts.confidenceScore}%` : ''}`, 'info');
    }

    const application = await applicationService.getById(String((deployment as any).applicationId?._id || deployment.applicationId));
    const target = await deploymentTargetService.getById(String((deployment as any).targetId?._id || deployment.targetId));
    const sshConfig = await deploymentTargetService.getSshConfig(target);

    const healthResults: string[] = [];

    try {
      const NVM_LOAD = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"';

      const checkLocalPm2Cmd = '[ -f "$HOME/.local/share/pm2-local/node_modules/pm2/bin/pm2" ] && echo local || echo global';
      const localCheck = await sshUtil.executeOnce(sshConfig, checkLocalPm2Cmd, 15000);
      const isLocal = localCheck.stdout.trim() === 'local';

      const isSingle = application.layout === 'multi-repo' && application.components.length === 1;

      for (const component of application.components) {
        await deploymentLogService.write(id, `[Rollback] Processing component "${component.key}"…`, 'info');

        // Hoist working paths — shared across install, build, verify, and PM2
        const nodeVersion = component.nodeVersion || 'lts/*';
        const currentDir = deploymentPathUtil.componentCurrentSymlink(target.baseWebRoot, application.name, component.key, isSingle);
        const workDir = deploymentPathUtil.resolveWorkDir(currentDir, (application as any).applicationPath, component.sourcePath);

        // Step 1: Git reset — reverts tracked source to previousSha; dist/ is gitignored so it stays at new build
        await deploymentLogService.write(id, `[Rollback] Reverting source code to commit ${previousSha} via git reset…`, 'info');
        await releaseService.rollbackRelease(
          sshConfig,
          target.baseWebRoot,
          application.name,
          component.key,
          previousSha,
          isSingle,
        );
        await deploymentLogService.write(id, `[Rollback] Source code reverted to commit ${previousSha}.`, 'info');

        // Step 2: Re-install dependencies so node_modules matches the reverted package.json
        if (component.type !== 'static') {
          await deploymentLogService.write(id, `[Rollback] Re-installing dependencies for reverted version…`, 'info');
          const installCmd = component.installCommand || 'npm ci';
          const installScript = target.nodeInstallStrategy === 'nvm'
            ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && cd "${workDir}" && if [ "${installCmd}" = "npm ci" ] && [ ! -f package-lock.json ] && [ ! -f yarn.lock ]; then npm install; else ${installCmd}; fi`
            : `cd "${workDir}" && if [ "${installCmd}" = "npm ci" ] && [ ! -f package-lock.json ] && [ ! -f yarn.lock ]; then npm install; else ${installCmd}; fi`;
          const installResult = await sshUtil.executeOnce(sshConfig, installScript, 300000);
          if (installResult.code !== 0) {
            throw new Error(`Dependency installation failed during rollback: ${installResult.stderr || installResult.stdout}`);
          }
          await deploymentLogService.write(id, `[Rollback] Dependencies re-installed successfully.`, 'info');
        }

        // Step 3: Rebuild dist/ from reverted source so PM2 runs the correct version
        if (component.buildCommand) {
          await deploymentLogService.write(id, `[Rollback] Rebuilding reverted version: ${component.buildCommand}…`, 'info');
          const buildScript = target.nodeInstallStrategy === 'nvm'
            ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && cd "${workDir}" && ${component.buildCommand}`
            : `cd "${workDir}" && ${component.buildCommand}`;
          const buildResult = await sshUtil.executeOnce(sshConfig, buildScript, 300000);
          if (buildResult.code !== 0) {
            throw new Error(`Build failed during rollback: ${buildResult.stderr || buildResult.stdout}`);
          }
          await deploymentLogService.write(id, `[Rollback] Rebuild completed.`, 'info');
        }

        // Step 4: Verify the deployed commit matches the rollback target
        const verifyResult = await sshUtil.executeOnce(sshConfig, `cd "${currentDir}" && git rev-parse HEAD 2>/dev/null || echo ""`, 15000);
        const deployedSha = verifyResult.stdout.trim();
        if (deployedSha) {
          const shaMatches = deployedSha === previousSha
            || deployedSha.startsWith(previousSha.substring(0, 8))
            || previousSha.startsWith(deployedSha.substring(0, 8));
          if (shaMatches) {
            await deploymentLogService.write(id, `[Rollback] Version verified: deployed commit ${deployedSha.substring(0, 8)} matches rollback target.`, 'info');
            healthResults.push(`${component.key}: version verified`);
          } else {
            await deploymentLogService.write(id, `[Rollback] WARNING: deployed SHA ${deployedSha.substring(0, 8)} does not match rollback target ${previousSha.substring(0, 8)} — rollback may not have applied correctly.`, 'warn');
          }
        }

        // Step 5: Restart PM2 if this is a node-api component
        if (component.type === 'node-api' && component.startCommand) {
          const pm2Name = deploymentPathUtil.pm2AppName(application.name, component.key);

          const resolveNodeCmd = target.nodeInstallStrategy === 'nvm'
            ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && which node`
            : 'which node';
          const nodeResult = await sshUtil.executeOnce(sshConfig, resolveNodeCmd, 15000);
          const nodeInterpreter = nodeResult.code === 0 ? nodeResult.stdout.trim() : 'node';

          const pm2BinPath = isLocal ? '$HOME/.local/share/pm2-local/node_modules/pm2/bin/pm2' : 'pm2';
          const pm2Exec = isLocal ? `"${nodeInterpreter}" "${pm2BinPath}"` : 'pm2';

          await deploymentLogService.write(id, `[Rollback] Restarting PM2 process "${pm2Name}" in "${workDir}"…`, 'info');

          const pm2RestartCmd = target.nodeInstallStrategy === 'nvm'
            ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && cd "${workDir}" && ${pm2Exec} restart "${pm2Name}" --update-env`
            : `cd "${workDir}" && ${pm2Exec} restart "${pm2Name}" --update-env`;

          const pm2RestartResult = await sshUtil.executeOnce(sshConfig, pm2RestartCmd, 60000);
          if (pm2RestartResult.code !== 0) {
            throw new Error(`PM2 restart failed for "${pm2Name}": ${pm2RestartResult.stderr || pm2RestartResult.stdout}`);
          }
          await deploymentLogService.write(id, `[Rollback] PM2 process "${pm2Name}" restarted successfully.`, 'info');

          // Post-rollback health validation
          await deploymentLogService.write(id, `[Health Check] Waiting for "${pm2Name}" to stabilize…`, 'info');
          await new Promise<void>((resolve) => setTimeout(resolve, 5000));

          const pm2StatusCmd = target.nodeInstallStrategy === 'nvm'
            ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && ${pm2Exec} show "${pm2Name}"`
            : `${pm2Exec} show "${pm2Name}"`;
          const pm2ShowResult = await sshUtil.executeOnce(sshConfig, pm2StatusCmd, 15000);
          const pm2StatusMatch = pm2ShowResult.stdout.match(/status\s*│\s*([a-z]+)/i);
          const pm2Status = pm2StatusMatch ? pm2StatusMatch[1].trim() : 'unknown';

          if (pm2Status === 'online') {
            await deploymentLogService.write(id, `[Health Check] PM2 Status: Online — process is running.`, 'info');
            healthResults.push(`${component.key}: PM2 online`);
          } else {
            await deploymentLogService.write(id, `[Health Check] PM2 Status: ${pm2Status} — process may not be healthy.`, 'warn');
            healthResults.push(`${component.key}: PM2 ${pm2Status}`);
          }

          const port = component.port || 3000;
          let healthUrl = component.healthCheckUrl;
          if (!healthUrl && component.healthCheckPath) {
            const hPath = component.healthCheckPath.startsWith('/') ? component.healthCheckPath : `/${component.healthCheckPath}`;
            healthUrl = `http://127.0.0.1:${port}${hPath}`;
          }
          if (healthUrl) {
            await deploymentLogService.write(id, `[Health Check] HTTP check: ${healthUrl}`, 'info');
            const curlResult = await sshUtil.executeOnce(sshConfig, `curl -s -o /dev/null -w "%{http_code}" "${healthUrl}"`, 15000);
            const httpCode = curlResult.stdout.trim();
            if (httpCode === '200') {
              await deploymentLogService.write(id, `[Health Check] HTTP: ${httpCode} OK — application is responding.`, 'info');
              healthResults.push(`HTTP ${httpCode}`);
            } else {
              await deploymentLogService.write(id, `[Health Check] HTTP: ${httpCode} — application may not be responding correctly.`, 'warn');
              healthResults.push(`HTTP ${httpCode}`);
            }
          }
        }

        await deploymentLogService.write(id, `[Rollback] Component "${component.key}" rolled back successfully.`, 'info');
      }

      await deploymentLogService.write(id, `[Rollback] All components reverted. Rollback complete.`, 'info');

      const completedAt = new Date();
      const healthSummary = healthResults.length > 0 ? ` | Health: ${healthResults.join(', ')}` : '';
      const rollbackRecord = {
        sourceVersion: deployment.commitSha || deployment.releaseDir,
        targetVersion: opts?.targetVersion || previousSha,
        rollbackReason: reason,
        confidenceScore: opts?.confidenceScore,
        riskLevel: opts?.riskLevel,
        status: 'success' as const,
        triggeredBy: opts?.triggeredBy,
        startedAt: rollbackStartedAt,
        completedAt,
        recoveryResult: `Rolled back to commit ${previousSha} successfully.${healthSummary}`,
      };

      await Deployment.updateOne(
        { _id: id },
        {
          status: 'rolled_back',
          rolledBack: true,
          completedAt,
          durationMs: completedAt.getTime() - rollbackStartedAt.getTime(),
          updated: new Date(),
          $push: { rollbackHistory: rollbackRecord },
        },
      );

      void reportService.logAudit({
        action: 'rollback_success',
        result: 'success',
        userId: opts?.triggeredBy,
        applicationId: deployment.applicationId,
        targetId: deployment.targetId,
        environment: deployment.branch || 'production',
        details: `Manual rollback completed successfully. Reason: ${reason || 'None'}`
      });

      void deploymentNotificationService.sendNotification('deployment_rollback', id, {
        rollbackReason: reason || 'Manual rollback completed.',
        previousReleaseDir: previousSha,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await deploymentLogService.write(id, `[Rollback] FAILED: ${message}`, 'error');

      const rollbackRecord = {
        sourceVersion: deployment.commitSha || deployment.releaseDir,
        targetVersion: opts?.targetVersion || previousSha,
        rollbackReason: reason,
        confidenceScore: opts?.confidenceScore,
        riskLevel: opts?.riskLevel,
        status: 'failed' as const,
        triggeredBy: opts?.triggeredBy,
        startedAt: rollbackStartedAt,
        completedAt: new Date(),
        recoveryResult: `Rollback failed: ${message}`,
      };

      await Deployment.updateOne(
        { _id: id },
        {
          status: 'failed',
          error: `Rollback failed: ${message}`,
          updated: new Date(),
          $push: { rollbackHistory: rollbackRecord },
        },
      );

      void reportService.logAudit({
        action: 'rollback_failed',
        result: 'failed',
        userId: opts?.triggeredBy,
        applicationId: deployment.applicationId,
        targetId: deployment.targetId,
        environment: deployment.branch || 'production',
        details: `Manual rollback failed. Error: ${message}`
      });

      void deploymentNotificationService.sendNotification('deployment_failed', id, {
        failedStep: 'Manual Rollback',
        errorMessage: `Rollback failed: ${message}`,
      });
      throw err;
    }

    return deployment;
  },

  async getVersionHistory(id: string) {
    const deployment = await this.getById(id);
    const appId = typeof (deployment as any).applicationId === 'object'
      ? (deployment as any).applicationId._id
      : (deployment as any).applicationId;

    const deployments = await Deployment.find({ applicationId: appId, active: true })
      .sort({ created: -1 })
      .limit(20)
      .lean();

    return deployments.map((d) => ({
      version: d.commitSha || String(d._id).slice(-8),
      buildNumber: String(d._id).slice(-6),
      commitHash: d.commitSha || d.commit?.sha,
      environment: (d as any).branch || 'production',
      deploymentDate: d.startedAt || d.created,
      status: d.status,
      releaseDir: d.releaseDir,
      deploymentId: d._id,
      trigger: d.trigger,
    }));
  },

  async getRollbackHistory(id: string) {
    const deployment = await Deployment.findOne({ _id: id, active: true }).lean();
    if (!deployment) {
      throw new AppError('Deployment not found.', HTTP_STATUS.NOT_FOUND);
    }
    return (deployment as any).rollbackHistory || [];
  },

  async analyzeRollback(id: string, targetVersion?: string) {
    const deployment = await this.getById(id) as IDeployment;

    const payload = {
      deployment: {
        id: String(deployment._id),
        status: deployment.status,
        commitSha: deployment.commitSha,
        branch: deployment.branch,
        releaseDir: deployment.releaseDir,
        previousReleaseDir: deployment.previousReleaseDir,
        error: deployment.error,
        steps: deployment.steps?.map((s) => ({ name: s.stepName, status: s.status, error: s.error })),
      },
      previousRelease: {
        path: deployment.previousReleaseDir || targetVersion || 'unknown',
        targetVersion,
      },
      failureContext: {
        failedStep: deployment.steps?.find((s) => s.status === 'failed')?.stepName,
        errorMessage: deployment.error,
        rolledBack: deployment.rolledBack,
      },
    };

    try {
      const res = await fetch(`${envConfig.crewaiApiUrl}/deployment/analyze-rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        const json = await res.json() as any;
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch {
      // Fall through to deterministic fallback
    }

    // Deterministic fallback when AI is unavailable
    const hasPrevious = Boolean(deployment.previousReleaseDir);
    const failedStep = deployment.steps?.find((s) => s.status === 'failed')?.stepName;
    const isLateFailure = ['health-check', 'start-process', 'configure-proxy'].includes(failedStep || '');

    return {
      confidenceScore: hasPrevious ? (isLateFailure ? 88 : 72) : 40,
      riskLevel: hasPrevious ? (isLateFailure ? 'low' : 'medium') : 'high',
      recommendation: hasPrevious ? 'Rollback Recommended' : 'No previous release available',
      estimatedRecoveryTime: '2-5 minutes',
      failureAnalysis: {
        rootCause: failedStep ? `Failure detected at step: ${failedStep}` : 'Unknown failure point',
        impactAssessment: isLateFailure ? 'Application may be partially deployed or unhealthy.' : 'Build or configuration failure — previous release unaffected.',
        recoveryRecommendation: hasPrevious ? 'Roll back to the previous stable release.' : 'Re-deploy with fixes applied.',
      },
    };
  },

  async getRollbackStats() {
    const [totalRollbacks, rolledBackDeployments] = await Promise.all([
      Deployment.aggregate([
        { $match: { active: true } },
        { $project: { rollbackCount: { $size: { $ifNull: ['$rollbackHistory', []] } } } },
        { $group: { _id: null, total: { $sum: '$rollbackCount' } } },
      ]),
      Deployment.find({ active: true, status: { $in: ['rolled_back', 'rolling_back'] } }).lean(),
    ]);

    const total = totalRollbacks[0]?.total || 0;
    const successful = rolledBackDeployments.filter((d) => d.status === 'rolled_back').length;
    const failed = rolledBackDeployments.filter((d) => d.status === 'failed' && d.rolledBack).length;

    const allRollbackRecords = await Deployment.aggregate([
      { $match: { active: true, 'rollbackHistory.0': { $exists: true } } },
      { $unwind: '$rollbackHistory' },
      {
        $group: {
          _id: null,
          successCount: { $sum: { $cond: [{ $eq: ['$rollbackHistory.status', 'success'] }, 1, 0] } },
          failCount: { $sum: { $cond: [{ $eq: ['$rollbackHistory.status', 'failed'] }, 1, 0] } },
        },
      },
    ]);

    const successCount = allRollbackRecords[0]?.successCount || 0;
    const failCount = allRollbackRecords[0]?.failCount || 0;
    const grandTotal = successCount + failCount;

    return {
      total: grandTotal,
      successful: successCount,
      failed: failCount,
      successRate: grandTotal > 0 ? Math.round((successCount / grandTotal) * 100) : 0,
      avgRecoveryTimeMs: null,
    };
  },

  async getLogs(deploymentId: string, options: {
    stepName?: string;
    level?: 'info' | 'warn' | 'error' | 'debug';
    since?: string;
    limit?: string;
  } = {}) {
    return deploymentLogService.getLogs(deploymentId, {
      stepName: options.stepName,
      level: options.level,
      since: options.since ? new Date(options.since) : undefined,
      limit: options.limit ? parseInt(options.limit, 10) : undefined,
    });
  },

  async getApplicationVersionHistory(appId: string) {
    const deployments = await Deployment.find({
      applicationId: new Types.ObjectId(appId),
      active: true,
    })
      .sort({ created: -1 })
      .limit(50)
      .lean();

    return deployments.map((d) => ({
      deploymentId: String(d._id),
      version: d.commitSha || String(d._id).slice(-8),
      buildNumber: String(d._id).slice(-6),
      commitHash: d.commitSha || d.commit?.sha,
      environment: d.branch || 'production',
      deploymentDate: d.startedAt || d.created,
      status: d.status,
      trigger: d.trigger,
    }));
  },

  async rollbackToVersion(
    targetDeploymentId: string,
    reason?: string,
    opts?: { confidenceScore?: number; riskLevel?: string; triggeredBy?: Types.ObjectId },
  ) {
    // Load the version we want to roll back TO
    const targetDeployment = await Deployment.findOne({ _id: targetDeploymentId, active: true }).lean();
    if (!targetDeployment) {
      throw new AppError('Target deployment version not found.', HTTP_STATUS.NOT_FOUND);
    }
    if (targetDeployment.status !== 'success') {
      throw new AppError('Can only roll back to a successful deployment version.', HTTP_STATUS.BAD_REQUEST);
    }
    const targetSha = targetDeployment.commitSha || targetDeployment.commit?.sha;
    if (!targetSha) {
      throw new AppError('Target deployment has no recorded commit SHA to roll back to.', HTTP_STATUS.BAD_REQUEST);
    }

    const appId = String(targetDeployment.applicationId);
    const deploymentTargetId = String(targetDeployment.targetId);

    // Determine what is currently deployed (source version for audit trail)
    const currentDeployment = await Deployment.findOne({
      applicationId: targetDeployment.applicationId,
      targetId: targetDeployment.targetId,
      status: { $in: ['success', 'rolled_back'] },
      active: true,
    }).sort({ created: -1 }).lean();
    const sourceVersion = currentDeployment?.commitSha || currentDeployment?.commit?.sha;

    const [application, target] = await Promise.all([
      applicationService.getById(appId),
      deploymentTargetService.getById(deploymentTargetId),
    ]);

    // Create a NEW deployment record for this rollback operation
    const rollbackDeployment = await Deployment.create({
      applicationId: targetDeployment.applicationId,
      targetId: targetDeployment.targetId,
      status: 'rolling_back',
      steps: [],
      branch: targetDeployment.branch,
      commitSha: targetSha,
      trigger: 'rollback',
      rollbackReason: reason,
      triggeredBy: opts?.triggeredBy,
      active: true,
      created: new Date(),
      updated: new Date(),
    });

    const newId = String(rollbackDeployment._id);
    const startedAt = new Date();

    await Deployment.updateOne({ _id: newId }, { startedAt });
    await deploymentLogService.write(newId, `[Rollback] Starting rollback to commit ${targetSha} (from version ${targetDeploymentId}).`, 'info');
    if (reason) {
      await deploymentLogService.write(newId, `[Rollback] Reason: ${reason}`, 'info');
    }

    const sshConfig = await deploymentTargetService.getSshConfig(target);

    const healthResults: string[] = [];

    try {
      const NVM_LOAD = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"';
      const localCheck = await sshUtil.executeOnce(
        sshConfig,
        '[ -f "$HOME/.local/share/pm2-local/node_modules/pm2/bin/pm2" ] && echo local || echo global',
        15000,
      );
      const isLocal = localCheck.stdout.trim() === 'local';
      const isSingle = application.layout === 'multi-repo' && application.components.length === 1;

      for (const component of application.components) {
        await deploymentLogService.write(newId, `[Rollback] Processing component "${component.key}"…`, 'info');

        // Hoist working paths — shared across install, build, verify, and PM2
        const nodeVersion = component.nodeVersion || 'lts/*';
        const currentDir = deploymentPathUtil.componentCurrentSymlink(target.baseWebRoot, application.name, component.key, isSingle);
        const workDir = deploymentPathUtil.resolveWorkDir(currentDir, (application as any).applicationPath, component.sourcePath);

        // Step 1: Git reset — reverts tracked source to targetSha; dist/ is gitignored so it stays at current build
        await releaseService.rollbackRelease(
          sshConfig,
          target.baseWebRoot,
          application.name,
          component.key,
          targetSha,
          isSingle,
        );
        await deploymentLogService.write(newId, `[Rollback] Source code reverted to commit ${targetSha}.`, 'info');

        // Step 2: Re-install dependencies so node_modules matches the reverted package.json
        if (component.type !== 'static') {
          await deploymentLogService.write(newId, `[Rollback] Re-installing dependencies for reverted version…`, 'info');
          const installCmd = component.installCommand || 'npm ci';
          const installScript = target.nodeInstallStrategy === 'nvm'
            ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && cd "${workDir}" && if [ "${installCmd}" = "npm ci" ] && [ ! -f package-lock.json ] && [ ! -f yarn.lock ]; then npm install; else ${installCmd}; fi`
            : `cd "${workDir}" && if [ "${installCmd}" = "npm ci" ] && [ ! -f package-lock.json ] && [ ! -f yarn.lock ]; then npm install; else ${installCmd}; fi`;
          const installResult = await sshUtil.executeOnce(sshConfig, installScript, 300000);
          if (installResult.code !== 0) {
            throw new Error(`Dependency installation failed during rollback: ${installResult.stderr || installResult.stdout}`);
          }
          await deploymentLogService.write(newId, `[Rollback] Dependencies re-installed successfully.`, 'info');
        }

        // Step 3: Rebuild dist/ from reverted source so PM2 runs the correct version
        if (component.buildCommand) {
          await deploymentLogService.write(newId, `[Rollback] Rebuilding reverted version: ${component.buildCommand}…`, 'info');
          const buildScript = target.nodeInstallStrategy === 'nvm'
            ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && cd "${workDir}" && ${component.buildCommand}`
            : `cd "${workDir}" && ${component.buildCommand}`;
          const buildResult = await sshUtil.executeOnce(sshConfig, buildScript, 300000);
          if (buildResult.code !== 0) {
            throw new Error(`Build failed during rollback: ${buildResult.stderr || buildResult.stdout}`);
          }
          await deploymentLogService.write(newId, `[Rollback] Rebuild completed.`, 'info');
        }

        // Step 4: Verify the deployed commit matches the rollback target
        const verifyResult = await sshUtil.executeOnce(sshConfig, `cd "${currentDir}" && git rev-parse HEAD 2>/dev/null || echo ""`, 15000);
        const deployedSha = verifyResult.stdout.trim();
        if (deployedSha) {
          const shaMatches = deployedSha === targetSha
            || deployedSha.startsWith(targetSha.substring(0, 8))
            || targetSha.startsWith(deployedSha.substring(0, 8));
          if (shaMatches) {
            await deploymentLogService.write(newId, `[Rollback] Version verified: deployed commit ${deployedSha.substring(0, 8)} matches rollback target.`, 'info');
            healthResults.push(`${component.key}: version verified`);
          } else {
            await deploymentLogService.write(newId, `[Rollback] WARNING: deployed SHA ${deployedSha.substring(0, 8)} does not match rollback target ${targetSha.substring(0, 8)} — rollback may not have applied correctly.`, 'warn');
          }
        }

        // Step 5: Restart PM2 if this is a node-api component
        if (component.type === 'node-api' && component.startCommand) {
          const pm2Name = deploymentPathUtil.pm2AppName(application.name, component.key);

          const resolveNodeCmd = target.nodeInstallStrategy === 'nvm'
            ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && which node`
            : 'which node';
          const nodeResult = await sshUtil.executeOnce(sshConfig, resolveNodeCmd, 15000);
          const nodeInterpreter = nodeResult.code === 0 ? nodeResult.stdout.trim() : 'node';

          const pm2BinPath = isLocal ? '$HOME/.local/share/pm2-local/node_modules/pm2/bin/pm2' : 'pm2';
          const pm2Exec = isLocal ? `"${nodeInterpreter}" "${pm2BinPath}"` : 'pm2';

          await deploymentLogService.write(newId, `[Rollback] Restarting PM2 process "${pm2Name}" in "${workDir}"…`, 'info');

          const pm2RestartCmd = target.nodeInstallStrategy === 'nvm'
            ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && cd "${workDir}" && ${pm2Exec} restart "${pm2Name}" --update-env`
            : `cd "${workDir}" && ${pm2Exec} restart "${pm2Name}" --update-env`;

          const pm2Result = await sshUtil.executeOnce(sshConfig, pm2RestartCmd, 60000);
          if (pm2Result.code !== 0) {
            throw new Error(`PM2 restart failed for "${pm2Name}": ${pm2Result.stderr || pm2Result.stdout}`);
          }
          await deploymentLogService.write(newId, `[Rollback] PM2 process "${pm2Name}" restarted successfully.`, 'info');

          // Post-rollback health validation
          await deploymentLogService.write(newId, `[Health Check] Waiting for "${pm2Name}" to stabilize…`, 'info');
          await new Promise<void>((resolve) => setTimeout(resolve, 5000));

          const pm2StatusCmd = target.nodeInstallStrategy === 'nvm'
            ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && ${pm2Exec} show "${pm2Name}"`
            : `${pm2Exec} show "${pm2Name}"`;
          const pm2ShowResult = await sshUtil.executeOnce(sshConfig, pm2StatusCmd, 15000);
          const pm2StatusMatch = pm2ShowResult.stdout.match(/status\s*│\s*([a-z]+)/i);
          const pm2Status = pm2StatusMatch ? pm2StatusMatch[1].trim() : 'unknown';

          if (pm2Status === 'online') {
            await deploymentLogService.write(newId, `[Health Check] PM2 Status: Online — process is running.`, 'info');
            healthResults.push(`${component.key}: PM2 online`);
          } else {
            await deploymentLogService.write(newId, `[Health Check] PM2 Status: ${pm2Status} — process may not be healthy.`, 'warn');
            healthResults.push(`${component.key}: PM2 ${pm2Status}`);
          }

          const port = component.port || 3000;
          let healthUrl = component.healthCheckUrl;
          if (!healthUrl && component.healthCheckPath) {
            const hPath = component.healthCheckPath.startsWith('/') ? component.healthCheckPath : `/${component.healthCheckPath}`;
            healthUrl = `http://127.0.0.1:${port}${hPath}`;
          }
          if (healthUrl) {
            await deploymentLogService.write(newId, `[Health Check] HTTP check: ${healthUrl}`, 'info');
            const curlResult = await sshUtil.executeOnce(sshConfig, `curl -s -o /dev/null -w "%{http_code}" "${healthUrl}"`, 15000);
            const httpCode = curlResult.stdout.trim();
            if (httpCode === '200') {
              await deploymentLogService.write(newId, `[Health Check] HTTP: ${httpCode} OK — application is responding.`, 'info');
              healthResults.push(`HTTP ${httpCode}`);
            } else {
              await deploymentLogService.write(newId, `[Health Check] HTTP: ${httpCode} — application may not be responding correctly.`, 'warn');
              healthResults.push(`HTTP ${httpCode}`);
            }
          }
        }

        await deploymentLogService.write(newId, `[Rollback] Component "${component.key}" rolled back successfully.`, 'info');
      }

      await deploymentLogService.write(newId, '[Rollback] All components reverted. Rollback complete.', 'info');

      const completedAt = new Date();
      const healthSummary = healthResults.length > 0 ? ` | Health: ${healthResults.join(', ')}` : '';
      await Deployment.updateOne(
        { _id: newId },
        {
          status: 'rolled_back',
          rolledBack: true,
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          updated: new Date(),
          $push: {
            rollbackHistory: {
              sourceVersion,
              targetVersion: targetSha,
              rollbackReason: reason,
              confidenceScore: opts?.confidenceScore,
              riskLevel: opts?.riskLevel,
              status: 'success' as const,
              triggeredBy: opts?.triggeredBy,
              startedAt,
              completedAt,
              recoveryResult: `Rolled back to commit ${targetSha} successfully.${healthSummary}`,
            },
          },
        },
      );

      void reportService.logAudit({
        action: 'rollback_success',
        result: 'success',
        userId: opts?.triggeredBy,
        applicationId: targetDeployment.applicationId as Types.ObjectId,
        targetId: targetDeployment.targetId as Types.ObjectId,
        environment: targetDeployment.branch || 'production',
        details: `Version rollback to commit ${targetSha} succeeded. Reason: ${reason || 'None'}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await deploymentLogService.write(newId, `[Rollback] FAILED: ${message}`, 'error');

      await Deployment.updateOne(
        { _id: newId },
        {
          status: 'failed',
          error: `Rollback failed: ${message}`,
          completedAt: new Date(),
          updated: new Date(),
          $push: {
            rollbackHistory: {
              sourceVersion,
              targetVersion: targetSha,
              rollbackReason: reason,
              status: 'failed' as const,
              triggeredBy: opts?.triggeredBy,
              startedAt,
              completedAt: new Date(),
              recoveryResult: `Rollback failed: ${message}`,
            },
          },
        },
      );

      void reportService.logAudit({
        action: 'rollback_failed',
        result: 'failed',
        userId: opts?.triggeredBy,
        applicationId: targetDeployment.applicationId as Types.ObjectId,
        targetId: targetDeployment.targetId as Types.ObjectId,
        environment: targetDeployment.branch || 'production',
        details: `Version rollback to commit ${targetSha} failed. Error: ${message}`,
      });

      throw err;
    }

    return rollbackDeployment;
  },

  // Mark any deployment stuck in 'running' as failed (called at server boot)
  async reconcileStuckDeployments() {
    const result = await Deployment.updateMany(
      { status: 'running', active: true },
      {
        status: 'failed',
        error: 'Platform restarted while deployment was running.',
        completedAt: new Date(),
        updated: new Date(),
      },
    );
    if (result.modifiedCount > 0) {
      console.log(`[DeploymentService] Marked ${result.modifiedCount} stuck deployment(s) as failed.`);
    }
  },
};
