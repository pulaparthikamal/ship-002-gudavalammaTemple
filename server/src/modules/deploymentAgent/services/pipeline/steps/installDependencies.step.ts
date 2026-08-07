import { PipelineStep, PipelineContext } from '../pipeline.types';
import { sshUtil } from '../../../utils/ssh.util';
import { deploymentPathUtil } from '../../../utils/path.util';

const NVM_LOAD = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"';

const workDir = (ctx: PipelineContext): string =>
  deploymentPathUtil.resolveWorkDir(
    ctx.componentReleaseDir,
    (ctx.application as any).applicationPath,
    ctx.component.sourcePath,
  );

export const installDependenciesStep: PipelineStep = {
  name: 'install-dependencies',

  shouldRun(ctx: PipelineContext): boolean {
    return ctx.component.type !== 'static';
  },

  async run(ctx: PipelineContext): Promise<void> {
    const dir = workDir(ctx);
    const installCmd = ctx.component.installCommand || 'npm ci';
    const nodeVersion = ctx.component.nodeVersion || 'lts/*';

    ctx.logger.info(`Installing dependencies in ${dir} using: ${installCmd}`);

    const command = [
      NVM_LOAD,
      `nvm use ${nodeVersion} 2>/dev/null || true`,
      `cd "${dir}"`,
      // Fall back to npm install if no lockfile and command is npm ci
      `if [ "${installCmd}" = "npm ci" ] && [ ! -f package-lock.json ] && [ ! -f yarn.lock ]; then npm install; else ${installCmd}; fi`,
    ].join(' && ');

    const result = await sshUtil.executeOnce(ctx.sshConfig, command, 300000);

    if (result.code !== 0) {
      throw new Error(`Dependency installation failed: ${result.stderr}`);
    }

    ctx.logger.info('Dependencies installed successfully.');
  },
};
