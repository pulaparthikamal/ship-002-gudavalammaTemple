import { PipelineStep, PipelineContext } from '../pipeline.types';
import { sshUtil, buildSudo } from '../../../utils/ssh.util';

const NVM_LOAD = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"';
const NVM_INSTALL_URL = 'https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh';

const sudo = (ctx: PipelineContext, cmd: string) =>
  buildSudo(ctx.target.privilegeEscalation, ctx.sshConfig.password, cmd);

export const ensureNodeStep: PipelineStep = {
  name: 'ensure-node',

  shouldRun(ctx: PipelineContext): boolean {
    return ctx.component.type !== 'static';
  },

  async run(ctx: PipelineContext): Promise<void> {
    const version = ctx.component.nodeVersion || 'lts/*';
    const strategy = ctx.target.nodeInstallStrategy;

    ctx.logger.info(`Ensuring Node.js ${version} via strategy: ${strategy}…`);

    if (strategy === 'preinstalled') {
      const check = await sshUtil.executeOnce(ctx.sshConfig, 'node --version', 10000);
      if (check.code !== 0) {
        ctx.logger.info(`Required Node Version: ${version.startsWith('v') ? version : 'v' + version}`);
        ctx.logger.info(`Server Node Version: none`);
        ctx.logger.error('Node Version Validation: FAILED');
        throw new Error('Node.js is not installed and strategy is "preinstalled".');
      }
    } else if (strategy === 'apt') {
      const check = await sshUtil.executeOnce(ctx.sshConfig, 'node --version 2>/dev/null', 10000);
      if (check.code !== 0) {
        ctx.logger.info('Installing Node.js via apt (NodeSource)…');
        const majorVersion = version.match(/^(?:v)?(\d+)/)?.[1] || '20';
        const install = await sshUtil.executeOnce(
          ctx.sshConfig,
          `curl -fsSL https://deb.nodesource.com/setup_${majorVersion}.x -o /tmp/nodesource_setup.sh && ${sudo(ctx, 'bash /tmp/nodesource_setup.sh')} && rm -f /tmp/nodesource_setup.sh && ${sudo(ctx, 'apt-get install -y nodejs')}`,
          180000,
        );
        if (install.code !== 0) throw new Error(`Node.js apt install failed: ${install.stderr}`);
        ctx.logger.info('Node.js installed via apt.');
      }
    } else {
      // nvm strategy (default)
      const nvmCheck = await sshUtil.executeOnce(
        ctx.sshConfig,
        `${NVM_LOAD} && nvm --version 2>/dev/null || echo "no-nvm"`,
        10000,
      );

      if (nvmCheck.stdout.includes('no-nvm')) {
        ctx.logger.info('NVM not found — installing…');
        const nvmInstall = await sshUtil.executeOnce(
          ctx.sshConfig,
          `curl -o- ${NVM_INSTALL_URL} | bash`,
          120000,
        );
        if (nvmInstall.code !== 0) throw new Error(`NVM install failed: ${nvmInstall.stderr}`);
        ctx.logger.info('NVM installed.');
      }

      ctx.logger.info(`Installing/selecting Node.js ${version} via NVM…`);
      const nodeInstall = await sshUtil.executeOnce(
        ctx.sshConfig,
        `${NVM_LOAD} && nvm install ${version} && nvm use ${version} && nvm alias default ${version}`,
        180000,
      );

      if (nodeInstall.code !== 0) {
        throw new Error(`Node.js NVM install failed: ${nodeInstall.stderr}`);
      }
      ctx.logger.info(`Node.js ${version} ready via NVM.`);
    }

    // Common Validation & Logging Block
    const checkVerCmd = strategy === 'nvm'
      ? `${NVM_LOAD} && nvm use ${version} >/dev/null 2>&1 && node -v`
      : 'node -v';
    const checkVerResult = await sshUtil.executeOnce(ctx.sshConfig, checkVerCmd, 15000);
    const serverNodeVersion = checkVerResult.code === 0 ? checkVerResult.stdout.trim() : 'none';

    const reqLabel = version.startsWith('v') ? version : `v${version}`;
    ctx.logger.info(`Required Node Version: ${reqLabel}`);
    ctx.logger.info(`Server Node Version: ${serverNodeVersion}`);

    const cleanRequired = version.replace(/^v/, '');
    const cleanServer = serverNodeVersion.replace(/^v/, '');

    let passed = false;
    if (version === 'lts/*' || cleanRequired === '*' || cleanServer.startsWith(cleanRequired)) {
      passed = true;
    } else {
      passed = cleanServer === cleanRequired;
    }

    if (passed) {
      ctx.logger.info('Node Version Validation: PASSED');
    } else {
      ctx.logger.error('Node Version Validation: FAILED');
      throw new Error(`Required Node version ${version} is unavailable on the server (detected: ${serverNodeVersion}).`);
    }
  },
};
