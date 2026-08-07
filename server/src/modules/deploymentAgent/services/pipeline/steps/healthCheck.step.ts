import { PipelineStep, PipelineContext } from '../pipeline.types';
import { sshUtil } from '../../../utils/ssh.util';
import { deploymentPathUtil } from '../../../utils/path.util';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 10000;
const NVM_LOAD = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const healthCheckStep: PipelineStep = {
  name: 'health-check',

  shouldRun(ctx: PipelineContext): boolean {
    return ctx.component.type === 'node-api';
  },

  async run(ctx: PipelineContext): Promise<void> {
    const { component, sshConfig, target } = ctx;
    const port = component.port || 3000;
    let url = component.healthCheckUrl || component.healthCheckPath || '/health';
    if (url.startsWith('/')) {
      url = `http://127.0.0.1:${port}${url}`;
    }
    const nodeVersion = component.nodeVersion || 'lts/*';
    const pm2Name = deploymentPathUtil.pm2AppName(ctx.application.name, component.key);

    // Resolve target Node interpreter binary path
    const resolveNodeCmd = target.nodeInstallStrategy === 'nvm'
      ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && which node`
      : 'which node';
    const nodeResult = await sshUtil.executeOnce(sshConfig, resolveNodeCmd, 15000);
    const nodeInterpreter = nodeResult.code === 0 ? nodeResult.stdout.trim() : 'node';

    // Build correct pm2 execution command prefix
    const pm2Exec = ctx.pm2Path && ctx.pm2Path.includes('/')
      ? `"${nodeInterpreter}" "${ctx.pm2Path.replace(/"/g, '')}"`
      : 'pm2';

    ctx.logger.info('Running Health Check...');

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // 1. Get PM2 Status
      const pm2StatusCmd = target.nodeInstallStrategy === 'nvm'
        ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && ${pm2Exec} show "${pm2Name}"`
        : `${pm2Exec} show "${pm2Name}"`;
      const pm2ShowResult = await sshUtil.executeOnce(sshConfig, pm2StatusCmd, 15000);
      const statusMatch = pm2ShowResult.stdout.match(/status\s*│\s*([a-z]+)/i);
      const pm2Status = statusMatch ? statusMatch[1].trim() : 'unknown';

      // 2. HTTP response and response time
      const curlCmd = `curl -s -o /dev/null -w "%{http_code} %{time_total}" "${url}"`;
      const curlResult = await sshUtil.executeOnce(sshConfig, curlCmd, 15000);
      const [httpCode, rawTimeTotal] = curlResult.stdout.trim().split(' ');

      const timeMs = Math.round(parseFloat(rawTimeTotal || '0') * 1000);
      const responseTimeLabel = `${timeMs}ms`;
      const urlResponseLabel = httpCode === '200' ? '200 OK' : `${httpCode}`;

      const pm2StatusTitle = pm2Status.replace(/\b\w/g, (c) => c.toUpperCase());

      if (pm2Status === 'online' && httpCode === '200') {
        ctx.logger.info(`PM2 Status: ${pm2StatusTitle}`);
        ctx.logger.info(`URL Response: ${urlResponseLabel}`);
        ctx.logger.info(`Response Time: ${responseTimeLabel}`);
        ctx.logger.info('Health Check: PASSED');
        return;
      }

      ctx.logger.warn(`Health check attempt ${attempt}/${MAX_RETRIES}: PM2 Status: ${pm2StatusTitle}, HTTP: ${httpCode}`);

      if (attempt === MAX_RETRIES) {
        ctx.logger.info(`PM2 Status: ${pm2StatusTitle}`);
        ctx.logger.info(`URL Response: ${urlResponseLabel}`);
        ctx.logger.info(`Response Time: ${responseTimeLabel}`);
        ctx.logger.error('Health Check: FAILED');

        // Capture PM2 logs on failure
        const pm2LogsCmd = target.nodeInstallStrategy === 'nvm'
          ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && ${pm2Exec} logs "${pm2Name}" --lines 50 --raw --no-daemon || true`
          : `${pm2Exec} logs "${pm2Name}" --lines 50 --raw --no-daemon || true`;
        const pm2Logs = await sshUtil.executeOnce(sshConfig, pm2LogsCmd, 20000);
        ctx.logger.error(`PM2 Logs for ${pm2Name}:\n${pm2Logs.stdout}`);

        throw new Error(`Health check failed after ${MAX_RETRIES} attempts. PM2 Status: ${pm2StatusTitle}, URL Response: ${urlResponseLabel}`);
      }

      await wait(RETRY_DELAY_MS);
    }
  },
};
