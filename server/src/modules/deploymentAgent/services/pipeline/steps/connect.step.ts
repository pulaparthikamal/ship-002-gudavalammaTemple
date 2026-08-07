import { PipelineStep, PipelineContext } from '../pipeline.types';
import { sshUtil } from '../../../utils/ssh.util';

export const connectStep: PipelineStep = {
  name: 'connect',

  shouldRun(_ctx: PipelineContext): boolean {
    return true;
  },

  async run(ctx: PipelineContext): Promise<void> {
    ctx.logger.info(`Connecting to ${ctx.target.host}:${ctx.target.port} as ${ctx.target.username}…`);

    const result = await sshUtil.executeWithRetry(ctx.sshConfig, 'hostname && uptime', 20000, 3);

    if (result.code !== 0) {
      throw new Error(`SSH connection check failed: ${result.stderr}`);
    }

    ctx.logger.info(`Connected. Host: ${result.stdout.split('\n')[0].trim()}`);
  },
};
