import { PipelineStep, PipelineContext } from '../pipeline.types';
import { sshUtil } from '../../../utils/ssh.util';

export const detectEnvironmentStep: PipelineStep = {
  name: 'detect-environment',

  shouldRun(_ctx: PipelineContext): boolean {
    return true;
  },

  async run(ctx: PipelineContext): Promise<void> {
    ctx.logger.info('Detecting server environment…');

    const commands = [
      'uname -s',
      'lsb_release -rs 2>/dev/null || cat /etc/os-release | grep VERSION_ID | cut -d= -f2 | tr -d \'"\'',
      'git --version 2>/dev/null || echo "git not installed"',
      'node --version 2>/dev/null || echo "node not installed"',
      'which pm2 2>/dev/null && pm2 --version 2>/dev/null || echo "pm2 not installed"',
      'which nvm 2>/dev/null || [ -f ~/.nvm/nvm.sh ] && echo "nvm available" || echo "nvm not installed"',
    ];

    const result = await sshUtil.executeOnce(
      ctx.sshConfig,
      commands.join('\n'),
      20000,
    );

    const lines = result.stdout.split('\n').map((l) => l.trim());
    ctx.logger.info(`OS: ${lines[0] || 'unknown'} ${lines[1] || ''}`);
    ctx.logger.info(`Git: ${lines[2] || 'not detected'}`);
    ctx.logger.info(`Node: ${lines[3] || 'not detected'}`);
    ctx.logger.info(`PM2: ${lines[4] || 'not detected'}`);
    ctx.logger.info(`NVM: ${lines[5] || 'not detected'}`);
  },
};
