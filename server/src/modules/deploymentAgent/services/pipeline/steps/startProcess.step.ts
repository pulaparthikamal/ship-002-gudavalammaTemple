import { PipelineStep, PipelineContext } from '../pipeline.types';
import { sshUtil } from '../../../utils/ssh.util';
import { deploymentPathUtil } from '../../../utils/path.util';

const NVM_LOAD = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"';

export const startProcessStep: PipelineStep = {
  name: 'start-process',

  shouldRun(ctx: PipelineContext): boolean {
    return ctx.component.type === 'node-api' && Boolean(ctx.component.startCommand);
  },

  async run(ctx: PipelineContext): Promise<void> {
    const { component, application, target, sshConfig } = ctx;
    const pm2Name = deploymentPathUtil.pm2AppName(application.name, component.key);
    const isSingle = application.layout === 'multi-repo' && application.components.length === 1;
    const currentDir = deploymentPathUtil.componentCurrentSymlink(target.baseWebRoot, application.name, component.key, isSingle);
    const nodeVersion = component.nodeVersion || 'lts/*';

    ctx.logger.info(`Starting process "${pm2Name}" via PM2…`);

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

    // Check if PM2 process already exists
    const checkCmd = target.nodeInstallStrategy === 'nvm'
      ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && ${pm2Exec} show "${pm2Name}"`
      : `${pm2Exec} show "${pm2Name}"`;
    const checkResult = await sshUtil.executeOnce(sshConfig, checkCmd, 20000);
    const exists = checkResult.code === 0 && checkResult.stdout.includes(pm2Name);

    let recreate = false;
    if (exists) {
      const match = checkResult.stdout.match(/node\.js version\s*│\s*v?([0-9.]+)/i) || checkResult.stdout.match(/node version\s*│\s*v?([0-9.]+)/i);
      if (match) {
        const runningNodeVer = match[1];
        const reqVerClean = nodeVersion.replace(/^v/, '');
        if (nodeVersion !== 'lts/*' && reqVerClean !== '*' && !runningNodeVer.startsWith(reqVerClean)) {
          ctx.logger.info(`Node.js version mismatch detected (running: v${runningNodeVer}, required: ${nodeVersion}). Recreating process…`);
          recreate = true;
        }
      }
    }

    const workDir = deploymentPathUtil.resolveWorkDir(currentDir, (application as any).applicationPath, component.sourcePath);

    if (exists && !recreate) {
      // Safe restart/reload
      const restartCmd = target.nodeInstallStrategy === 'nvm'
        ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && cd "${workDir}" && ${pm2Exec} restart "${pm2Name}" --update-env`
        : `cd "${workDir}" && ${pm2Exec} restart "${pm2Name}" --update-env`;
      const restartResult = await sshUtil.executeOnce(sshConfig, restartCmd, 60000);
      if (restartResult.code !== 0) throw new Error(`PM2 restart failed: ${restartResult.stderr}`);
    } else {
      if (recreate) {
        const deleteCmd = target.nodeInstallStrategy === 'nvm'
          ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && ${pm2Exec} delete "${pm2Name}"`
          : `${pm2Exec} delete "${pm2Name}"`;
        await sshUtil.executeOnce(sshConfig, deleteCmd, 20000);
      }

      const startCmd = target.nodeInstallStrategy === 'nvm'
        ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && cd "${workDir}" && ${pm2Exec} start ${component.startCommand} --name "${pm2Name}" --interpreter "${nodeInterpreter}" --update-env`
        : `cd "${workDir}" && ${pm2Exec} start ${component.startCommand} --name "${pm2Name}" --interpreter "${nodeInterpreter}" --update-env`;
      const startResult = await sshUtil.executeOnce(sshConfig, startCmd, 60000);
      if (startResult.code !== 0) throw new Error(`PM2 start failed: ${startResult.stderr}`);
    }

    // Save configuration
    const saveCmd = target.nodeInstallStrategy === 'nvm'
      ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && ${pm2Exec} save`
      : `${pm2Exec} save`;
    await sshUtil.executeOnce(sshConfig, saveCmd, 20000);

    // Startup config
    const startupCmd = target.nodeInstallStrategy === 'nvm'
      ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && ${pm2Exec} startup`
      : `${pm2Exec} startup`;
    await sshUtil.executeOnce(sshConfig, startupCmd, 20000);

    ctx.logger.info('PM2 Process Created');
    ctx.logger.info(`Application Name: ${pm2Name}`);
    ctx.logger.info('Status: Online');
  },
};
