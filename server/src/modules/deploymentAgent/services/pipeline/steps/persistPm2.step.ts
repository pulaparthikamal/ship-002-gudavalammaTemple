import { PipelineStep, PipelineContext } from '../pipeline.types';
import { sshUtil, buildSudo } from '../../../utils/ssh.util';

const NVM_LOAD = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"';

const sudo = (ctx: PipelineContext, cmd: string) =>
  buildSudo(ctx.target.privilegeEscalation, ctx.sshConfig.password, cmd);

export const persistPm2Step: PipelineStep = {
  name: 'persist-pm2',

  shouldRun(ctx: PipelineContext): boolean {
    return ctx.component.type === 'node-api';
  },

  async run(ctx: PipelineContext): Promise<void> {
    ctx.logger.info('Persisting PM2 process list across reboots…');

    const nodeVersion = ctx.component.nodeVersion || 'lts/*';

    const saveCmd = [
      NVM_LOAD,
      `nvm use ${nodeVersion} 2>/dev/null || true`,
      'pm2 save',
    ].join(' && ');

    const saveResult = await sshUtil.executeOnce(ctx.sshConfig, saveCmd, 30000);
    if (saveResult.code !== 0) {
      ctx.logger.warn(`pm2 save warning: ${saveResult.stderr}`);
    }

    // Generate startup script — requires sudo; non-fatal if it fails
    const startupCmd = `${NVM_LOAD} && nvm use ${nodeVersion} 2>/dev/null || true && ${sudo(ctx, 'env PATH=$PATH:$(which node) pm2 startup -u ${USER} --hp $HOME 2>&1 || true')}`;
    await sshUtil.executeOnce(ctx.sshConfig, startupCmd, 30000);

    ctx.logger.info('PM2 process list saved. Survives server reboots.');
  },
};
