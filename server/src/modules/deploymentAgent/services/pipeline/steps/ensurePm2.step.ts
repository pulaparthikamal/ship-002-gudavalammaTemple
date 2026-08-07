import { PipelineStep, PipelineContext } from '../pipeline.types';
import { sshUtil } from '../../../utils/ssh.util';

const NVM_LOAD = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"';

export const ensurePm2Step: PipelineStep = {
  name: 'ensure-pm2',

  shouldRun(ctx: PipelineContext): boolean {
    return ctx.component.type === 'node-api';
  },

  async run(ctx: PipelineContext): Promise<void> {
    ctx.logger.info('Checking PM2 availability...');

    // First check if PM2 is globally available or available via NVM
    const checkCmd = ctx.target.nodeInstallStrategy === 'nvm'
      ? `${NVM_LOAD} && (pm2 -v || command -v pm2)`
      : 'pm2 -v || command -v pm2';

    let check = await sshUtil.executeOnce(ctx.sshConfig, checkCmd, 15000);
    
    // Also check local PM2 path fallback just in case it was installed locally previously
    let localPath = false;
    if (check.code !== 0) {
      const localCheckCmd = ctx.target.nodeInstallStrategy === 'nvm'
        ? `${NVM_LOAD} && [ -f "$HOME/.local/share/pm2-local/node_modules/pm2/bin/pm2" ] && "$HOME/.local/share/pm2-local/node_modules/pm2/bin/pm2" -v`
        : '[ -f "$HOME/.local/share/pm2-local/node_modules/pm2/bin/pm2" ] && "$HOME/.local/share/pm2-local/node_modules/pm2/bin/pm2" -v';
      const localCheck = await sshUtil.executeOnce(ctx.sshConfig, localCheckCmd, 15000);
      if (localCheck.code === 0) {
        check = localCheck;
        localPath = true;
      }
    }

    if (check.code === 0) {
      const version = check.stdout.trim().split('\n').pop() || 'unknown';
      ctx.logger.info('PM2 detected successfully.');
      ctx.logger.info(`Version: ${version}`);
      ctx.pm2Path = localPath ? '"$HOME/.local/share/pm2-local/node_modules/pm2/bin/pm2"' : 'pm2';
      return;
    }

    ctx.logger.info('PM2 not found.');
    ctx.logger.info('Installing PM2...');

    // Try global installation
    const installCmd = ctx.target.nodeInstallStrategy === 'nvm'
      ? `${NVM_LOAD} && npm install -g pm2`
      : 'npm install -g pm2';

    const install = await sshUtil.executeOnce(ctx.sshConfig, installCmd, 120000);
    let localPm2 = false;

    if (install.code !== 0) {
      ctx.logger.warn('Global PM2 installation failed (permission issues). Falling back to user-space local PM2 installation...');
      const localInstallCmd = ctx.target.nodeInstallStrategy === 'nvm'
        ? `${NVM_LOAD} && mkdir -p "$HOME/.local/share/pm2-local" && cd "$HOME/.local/share/pm2-local" && npm install pm2`
        : 'mkdir -p "$HOME/.local/share/pm2-local" && cd "$HOME/.local/share/pm2-local" && npm install pm2';
      const localInstall = await sshUtil.executeOnce(ctx.sshConfig, localInstallCmd, 120000);
      if (localInstall.code !== 0) {
        throw new Error(`PM2 installation failed: ${localInstall.stderr}`);
      }
      localPm2 = true;
    }

    // Verify
    const verifyCmd = localPm2
      ? (ctx.target.nodeInstallStrategy === 'nvm'
          ? `${NVM_LOAD} && "$HOME/.local/share/pm2-local/node_modules/pm2/bin/pm2" -v`
          : '"$HOME/.local/share/pm2-local/node_modules/pm2/bin/pm2" -v')
      : (ctx.target.nodeInstallStrategy === 'nvm'
          ? `${NVM_LOAD} && pm2 -v`
          : 'pm2 -v');

    const verify = await sshUtil.executeOnce(ctx.sshConfig, verifyCmd, 15000);
    if (verify.code !== 0) {
      throw new Error(`PM2 verification failed: ${verify.stderr}`);
    }

    ctx.logger.info('PM2 installed successfully.');
    ctx.pm2Path = localPm2 ? '"$HOME/.local/share/pm2-local/node_modules/pm2/bin/pm2"' : 'pm2';
  },
};
