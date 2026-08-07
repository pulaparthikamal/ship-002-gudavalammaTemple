import { IApplication } from '../../models/application.model';
import { IDeploymentTarget } from '../../models/deploymentTarget.model';
import { Deployment, IDeployment, StepStatus } from '../../models/deployment.model';
import { deploymentPathUtil } from '../../utils/path.util';
import { deploymentLogService } from '../log.service';
import { lockService } from '../lock.service';
import { deploymentTargetService } from '../deploymentTarget.service';
import { PipelineContext, PipelineStep } from './pipeline.types';
import { sshUtil } from '../../utils/ssh.util';
import { releaseService } from '../release.service';
import { reportService } from '../report.service';
import { deploymentNotificationService } from '../deploymentNotification.service';

const NVM_LOAD = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"';

// Ordered pipeline step registry
import { acquireLockStep } from './steps/acquireLock.step';
import { connectStep } from './steps/connect.step';
import { detectEnvironmentStep } from './steps/detectEnvironment.step';
import { verifyEnvStep } from './steps/verifyEnv.step';
import { ensureGitStep } from './steps/ensureGit.step';
import { ensureNodeStep } from './steps/ensureNode.step';
import { ensurePm2Step } from './steps/ensurePm2.step';
import { prepareDirectoriesStep } from './steps/prepareDirectories.step';
import { fetchSourceStep } from './steps/fetchSource.step';
import { injectEnvStep } from './steps/injectEnv.step';
import { installDependenciesStep } from './steps/installDependencies.step';
import { buildStep } from './steps/build.step';
import { activateReleaseStep } from './steps/activateRelease.step';
import { startProcessStep } from './steps/startProcess.step';
import { configureProxyStep } from './steps/configureProxy.step';
import { persistPm2Step } from './steps/persistPm2.step';
import { healthCheckStep } from './steps/healthCheck.step';
import { finalizeStep } from './steps/finalize.step';

const ORDERED_STEPS: PipelineStep[] = [
  acquireLockStep,
  connectStep,
  detectEnvironmentStep,
  verifyEnvStep,
  ensureGitStep,
  ensureNodeStep,
  ensurePm2Step,
  prepareDirectoriesStep,
  fetchSourceStep,
  injectEnvStep,
  installDependenciesStep,
  buildStep,
  activateReleaseStep,
  startProcessStep,
  configureProxyStep,
  persistPm2Step,
  healthCheckStep,
  finalizeStep,
];

const updateStepStatus = async (
  deployment: IDeployment,
  stepName: string,
  status: StepStatus,
  error?: string,
  startedAt?: Date,
) => {
  const step = (deployment.steps as any[]).find((s: any) => s.stepName === stepName);
  if (step) {
    step.status = status;
    if (startedAt) step.startedAt = startedAt;
    if (status !== 'running') {
      step.completedAt = new Date();
      step.durationMs = step.startedAt ? Date.now() - step.startedAt.getTime() : undefined;
    }
    if (error) step.error = error;
  }
  deployment.updated = new Date();
  await Deployment.updateOne({ _id: deployment._id }, { steps: deployment.steps, updated: deployment.updated });
};

export const pipelineService = {
  async run(
    deployment: IDeployment,
    application: IApplication,
    target: IDeploymentTarget,
  ): Promise<void> {
    const releaseTimestamp = Date.now();
    const releaseDir = deploymentPathUtil.releaseDir(target.baseWebRoot, application.name, releaseTimestamp);

    // Initialise step records on the deployment document
    const stepRecords = ORDERED_STEPS.map((s) => ({
      stepName: s.name,
      status: 'pending' as StepStatus,
    }));
    deployment.steps = stepRecords as any;
    deployment.startedAt = new Date();
    deployment.status = 'running';
    await Deployment.updateOne(
      { _id: deployment._id },
      { steps: deployment.steps, startedAt: deployment.startedAt, status: 'running', updated: new Date() },
    );

    const sshConfig = await deploymentTargetService.getSshConfig(target);

    // Run once per component (pipeline is per-component)
    for (const component of application.components) {
      const isSingle = application.layout === 'multi-repo' && application.components.length === 1;
      const componentReleaseDir = deploymentPathUtil.componentReleasePath(releaseDir, component.key, isSingle);
      const logger = deploymentLogService.createLogger(String(deployment._id), undefined);

      const ctx: PipelineContext = {
        deployment,
        application,
        target,
        component,
        sshConfig,
        releaseTimestamp,
        releaseDir,
        componentReleaseDir,
        previousReleaseDir: undefined,
        logger: {
          info: (msg) => { logger.info(`[${component.key}] ${msg}`); },
          warn: (msg) => { logger.warn(`[${component.key}] ${msg}`); },
          error: (msg) => { logger.error(`[${component.key}] ${msg}`); },
          debug: (msg) => { logger.debug(`[${component.key}] ${msg}`); },
        },
        aborted: false,
      };

      for (const step of ORDERED_STEPS) {
        if (!step.shouldRun(ctx)) {
          await updateStepStatus(deployment, step.name, 'skipped');
          ctx.logger.debug(`Step "${step.name}" skipped.`);
          continue;
        }

        const stepStarted = new Date();
        await updateStepStatus(deployment, step.name, 'running', undefined, stepStarted);
        ctx.logger.info(`▶ Step: ${step.name}`);

        try {
          await step.run(ctx);
          await updateStepStatus(deployment, step.name, 'success');
          ctx.logger.info(`✓ Step "${step.name}" completed.`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await updateStepStatus(deployment, step.name, 'failed', message);
          ctx.logger.error(`✗ Step "${step.name}" failed: ${message}`);

          // Release lock on failure
          lockService.release(String(application._id), String(deployment._id));

          // Revert the deploy directory to the previous git commit and restart PM2 so the
          // target server returns to the last stable state after a pipeline failure.
          if (ctx.previousReleaseDir) {
            ctx.logger.info(`[Auto-Rollback] Pipeline failed at step "${step.name}". Initiating automatic rollback to commit: ${ctx.previousReleaseDir}`);
            try {
              const isSingle = ctx.application.layout === 'multi-repo' && ctx.application.components.length === 1;

              // 1. Git reset to previous commit SHA
              ctx.logger.info(`[Auto-Rollback] Reverting source code via git reset --hard ${ctx.previousReleaseDir}…`);
              await releaseService.rollbackRelease(
                ctx.sshConfig,
                ctx.target.baseWebRoot,
                ctx.application.name,
                ctx.component.key,
                ctx.previousReleaseDir,
                isSingle,
              );
              ctx.logger.info('[Auto-Rollback] Source code reverted successfully.');

              // 2. Restart the PM2 process so it picks up the reverted code
              if (ctx.component.type === 'node-api' && ctx.component.startCommand) {
                const pm2Name = deploymentPathUtil.pm2AppName(ctx.application.name, ctx.component.key);
                const nodeVersion = ctx.component.nodeVersion || 'lts/*';
                const resolveNodeCmd = ctx.target.nodeInstallStrategy === 'nvm'
                  ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && which node`
                  : 'which node';
                const nodeResult = await sshUtil.executeOnce(ctx.sshConfig, resolveNodeCmd, 15000);
                const nodeInterpreter = nodeResult.code === 0 ? nodeResult.stdout.trim() : 'node';
                const pm2Exec = ctx.pm2Path && ctx.pm2Path.includes('/')
                  ? `"${nodeInterpreter}" "${ctx.pm2Path.replace(/"/g, '')}"`
                  : 'pm2';

                // Use the stable deploy path (not componentReleaseDir which may be mid-write)
                const deployPath = deploymentPathUtil.componentDeployPath(
                  ctx.target.baseWebRoot,
                  ctx.application.name,
                  ctx.component.key,
                  isSingle,
                );
                const workDir = deploymentPathUtil.resolveWorkDir(deployPath, (ctx.application as any).applicationPath, ctx.component.sourcePath);

                ctx.logger.info(`[Auto-Rollback] Restarting PM2 process "${pm2Name}" in "${workDir}"…`);

                const pm2RestartCmd = ctx.target.nodeInstallStrategy === 'nvm'
                  ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && cd "${workDir}" && ${pm2Exec} restart "${pm2Name}" --update-env`
                  : `cd "${workDir}" && ${pm2Exec} restart "${pm2Name}" --update-env`;

                const pm2RestartResult = await sshUtil.executeOnce(ctx.sshConfig, pm2RestartCmd, 60000);
                if (pm2RestartResult.code !== 0) {
                  ctx.logger.error(`[Auto-Rollback] PM2 restart failed: ${pm2RestartResult.stderr || pm2RestartResult.stdout}`);
                } else {
                  ctx.logger.info('[Auto-Rollback] PM2 process restarted successfully.');
                }
              }

              ctx.logger.info('[Auto-Rollback] Automatic rollback completed. Server restored to previous stable state.');
              await Deployment.updateOne(
                { _id: deployment._id },
                { status: 'rolled_back', error: message, completedAt: new Date(), updated: new Date() }
              );
              void reportService.logAudit({
                action: 'deployment_failed_rolled_back',
                result: 'failed',
                userId: deployment.triggeredBy,
                applicationId: application._id,
                appName: application.name,
                targetId: target._id,
                targetName: target.name,
                environment: deployment.branch || 'production',
                details: `Deployment failed. Automatically rolled back to previous stable release. Error: ${message}`
              });
              void deploymentNotificationService.sendNotification('deployment_rollback', deployment._id, {
                rollbackReason: `Automatic rollback due to step "${step.name}" failure: ${message}`,
                previousReleaseDir: ctx.previousReleaseDir,
              });
            } catch (rollbackErr) {
              const rollbackMsg = rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
              ctx.logger.error(`[Auto-Rollback] Automatic rollback FAILED: ${rollbackMsg}`);
              await Deployment.updateOne(
                { _id: deployment._id },
                { status: 'failed', error: message, completedAt: new Date(), updated: new Date() },
              );
              void reportService.logAudit({
                action: 'deployment_failed',
                result: 'failed',
                userId: deployment.triggeredBy,
                applicationId: application._id,
                appName: application.name,
                targetId: target._id,
                targetName: target.name,
                environment: deployment.branch || 'production',
                details: `Deployment failed. Automatic rollback also failed. Error: ${message}`
              });
              void deploymentNotificationService.sendNotification('deployment_failed', deployment._id, {
                failedStep: step.name,
                errorMessage: `${message} (Auto-rollback also failed: ${rollbackMsg})`,
              });
            }
          } else {
            ctx.logger.warn(`[Pipeline] Step "${step.name}" failed and no previous release SHA is available — cannot auto-rollback.`);
            await Deployment.updateOne(
              { _id: deployment._id },
              { status: 'failed', error: message, completedAt: new Date(), updated: new Date() },
            );
            void reportService.logAudit({
              action: 'deployment_failed',
              result: 'failed',
              userId: deployment.triggeredBy,
              applicationId: application._id,
              appName: application.name,
              targetId: target._id,
              targetName: target.name,
              environment: deployment.branch || 'production',
              details: `Deployment failed. Error: ${message}`
            });
            void deploymentNotificationService.sendNotification('deployment_failed', deployment._id, {
              failedStep: step.name,
              errorMessage: message,
            });
          }

          throw err;
        }
      }
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - (deployment.startedAt?.getTime() || completedAt.getTime());
    await Deployment.updateOne(
      { _id: deployment._id },
      {
        status: 'success',
        completedAt,
        durationMs,
        releaseDir,
        updated: new Date(),
      },
    );
    console.log(`[Pipeline] Deployment ${deployment._id} succeeded in ${(durationMs / 1000).toFixed(1)}s — app: ${application.name}`);
    void reportService.logAudit({
      action: 'deployment_completed',
      result: 'success',
      userId: deployment.triggeredBy,
      applicationId: application._id,
      appName: application.name,
      targetId: target._id,
      targetName: target.name,
      environment: deployment.branch || 'production',
      details: `Deployment completed successfully in ${completedAt.getTime() - (deployment.startedAt?.getTime() || completedAt.getTime())}ms.`
    });
    void deploymentNotificationService.sendNotification('deployment_success', deployment._id);
  },
};
