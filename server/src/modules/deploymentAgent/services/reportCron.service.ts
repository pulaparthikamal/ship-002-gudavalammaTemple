import cron from 'node-cron';
import { logger } from '../../../utils/logger.util';
import { Application } from '../models/application.model';
import { DeploymentTarget } from '../models/deploymentTarget.model';
import { DeploymentHealthCheckLog } from '../models/deploymentHealthCheckLog.model';
import { deploymentTargetService } from './deploymentTarget.service';
import { sshUtil } from '../utils/ssh.util';

let task: ReturnType<typeof cron.schedule> | null = null;
let inFlight = false;

export const reportCronService = {
  start() {
    if (task) {
      return;
    }
    // Schedule check every 5 minutes
    task = cron.schedule(process.env.HEALTH_CHECK_CRON_EXPRESSION || '*/5 * * * *', () => {
      void this.runHealthChecks();
    });
    logger.info('[ReportCron] Application component health checks scheduled.');

    // Run first check asynchronously after a small delay
    setTimeout(() => {
      void this.runHealthChecks();
    }, 10000);
  },

  stop() {
    task?.stop();
    task = null;
  },

  async runHealthChecks() {
    if (inFlight) {
      return;
    }
    inFlight = true;
    try {
      const apps = await Application.find({ isDeleted: false }).lean();

      for (const app of apps) {
        const targetId = app.autoDeploy?.targetId;
        if (!targetId) {
          continue;
        }

        const target = await DeploymentTarget.findById(targetId);
        if (!target || !target.active || target.status !== 'connected') {
          continue;
        }

        let sshConfig;
        try {
          sshConfig = await deploymentTargetService.getSshConfig(target);
        } catch (sshErr: any) {
          logger.warn(`[ReportCron] Failed to fetch SSH config for target server: ${target.name}. Error: ${sshErr.message}`);
          continue;
        }

        const components = app.components || [];
        for (const comp of components) {
          const isNode = comp.type === 'node-api';
          const hasCheck = comp.healthCheckUrl || comp.healthCheckPath;

          if (!isNode && !hasCheck) {
            continue;
          }

          const port = comp.port || 3000;
          let checkUrl = comp.healthCheckUrl || comp.healthCheckPath || '/health';
          if (checkUrl.startsWith('/')) {
            checkUrl = `http://127.0.0.1:${port}${checkUrl}`;
          }

          const startTime = Date.now();
          try {
            const curlCmd = `curl -s -o /dev/null -w "%{http_code} %{time_total}" "${checkUrl}"`;
            const curlResult = await sshUtil.executeOnce(sshConfig, curlCmd, 12000);

            const elapsed = Date.now() - startTime;
            const output = curlResult.stdout.trim();
            const parts = output.split(' ');
            const httpCodeStr = parts[0];
            const timeTotalStr = parts[1];

            const httpCode = httpCodeStr ? parseInt(httpCodeStr, 10) : 0;
            const responseTimeMs = timeTotalStr ? Math.round(parseFloat(timeTotalStr) * 1000) : elapsed;
            const isSuccess = httpCode === 200;

            await DeploymentHealthCheckLog.create({
              applicationId: app._id,
              componentKey: comp.key,
              targetId: target._id,
              url: checkUrl,
              status: isSuccess ? 'success' : 'failed',
              httpCode: httpCode || undefined,
              responseTimeMs: responseTimeMs || elapsed,
              error: isSuccess ? undefined : `HTTP code ${httpCodeStr || 'empty'}`,
              timestamp: new Date(),
            });
          } catch (err: any) {
            const elapsed = Date.now() - startTime;
            await DeploymentHealthCheckLog.create({
              applicationId: app._id,
              componentKey: comp.key,
              targetId: target._id,
              url: checkUrl,
              status: 'failed',
              responseTimeMs: elapsed,
              error: err.message || 'SSH connection command execution timeout',
              timestamp: new Date(),
            });
          }
        }
      }
    } catch (error: any) {
      logger.error(`[ReportCron] Failed to run health check cron iteration: ${error.message}`);
    } finally {
      inFlight = false;
    }
  },
};
