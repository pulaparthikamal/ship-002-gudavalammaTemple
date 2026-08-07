import { PipelineStep, PipelineContext } from '../pipeline.types';
import { sshUtil, buildSudo } from '../../../utils/ssh.util';

const sudo = (ctx: PipelineContext, cmd: string) =>
  buildSudo(ctx.target.privilegeEscalation, ctx.sshConfig.password, cmd);

export const ensureGitStep: PipelineStep = {
  name: 'ensure-git',

  shouldRun(_ctx: PipelineContext): boolean {
    return true;
  },

  async run(ctx: PipelineContext): Promise<void> {
    ctx.logger.info('Checking git installation…');

    const check = await sshUtil.executeOnce(ctx.sshConfig, 'git --version 2>/dev/null', 10000);

    if (check.code === 0 && check.stdout.includes('git version')) {
      ctx.logger.info(`Git already installed: ${check.stdout.trim()}`);
      return;
    }

    ctx.logger.info('Git not found — installing via apt…');
    const install = await sshUtil.executeOnce(
      ctx.sshConfig,
      `${sudo(ctx, 'apt-get update -qq')} && ${sudo(ctx, 'apt-get install -y git')}`,
      120000,
    );

    if (install.code !== 0) {
      throw new Error(`Failed to install git: ${install.stderr}`);
    }

    ctx.logger.info('Git installed successfully.');
  },
};
