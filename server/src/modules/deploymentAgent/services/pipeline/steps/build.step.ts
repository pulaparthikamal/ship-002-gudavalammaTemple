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

export const buildStep: PipelineStep = {
  name: 'build',

  shouldRun(ctx: PipelineContext): boolean {
    return Boolean(ctx.component.buildCommand);
  },

  async run(ctx: PipelineContext): Promise<void> {
    const dir = workDir(ctx);
    const buildCmd = ctx.component.buildCommand!;
    const nodeVersion = ctx.component.nodeVersion || 'lts/*';

    ctx.logger.info(`Building component in ${dir} using: ${buildCmd}`);

    const command = ctx.target.nodeInstallStrategy === 'nvm'
      ? [
          NVM_LOAD,
          `nvm use ${nodeVersion} 2>/dev/null || true`,
          `cd "${dir}"`,
          buildCmd,
        ].join(' && ')
      : `cd "${dir}" && ${buildCmd}`;

    const result = await sshUtil.executeOnce(ctx.sshConfig, command, 300000);

    if (result.code !== 0) {
      throw new Error(`Build failed: ${result.stderr}`);
    }

    const buildOutputDir = ctx.component.buildOutputDir || (ctx.component.type === 'react-ui' ? 'dist' : '');
    if (buildOutputDir) {
      const checkOutput = await sshUtil.executeOnce(
        ctx.sshConfig,
        `test -d "${dir}/${buildOutputDir}" && echo ok || echo missing`,
        10000,
      );

      if (checkOutput.stdout.trim() !== 'ok') {
        throw new Error(`Build output directory "${buildOutputDir}" not found after build.`);
      }
      ctx.logger.info(`Build completed. Output: ${dir}/${buildOutputDir}`);
    } else {
      ctx.logger.info('Build completed successfully.');
    }
  },
};
