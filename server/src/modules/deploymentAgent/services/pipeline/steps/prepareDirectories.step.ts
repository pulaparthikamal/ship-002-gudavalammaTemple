import { PipelineStep, PipelineContext } from '../pipeline.types';
import { sshUtil, buildSudo } from '../../../utils/ssh.util';
import { deploymentPathUtil } from '../../../utils/path.util';
import { Deployment } from '../../../models/deployment.model';

const sudo = (ctx: PipelineContext, cmd: string) =>
  buildSudo(ctx.target.privilegeEscalation, ctx.sshConfig.password, cmd);

export const prepareDirectoriesStep: PipelineStep = {
  name: 'prepare-directories',

  shouldRun(_ctx: PipelineContext): boolean {
    return true;
  },

  async run(ctx: PipelineContext): Promise<void> {
    const { target, application, component } = ctx;
    const isSingle = application.layout === 'multi-repo' && application.components.length === 1;

    const componentDeployPath = deploymentPathUtil.componentDeployPath(
      target.baseWebRoot,
      application.name,
      component.key,
      isSingle
    );

    ctx.logger.info(`Preparing directory for ${application.name}/${component.key} at ${componentDeployPath}…`);

    const commands = [
      sudo(ctx, `mkdir -p "${componentDeployPath}"`),
      sudo(ctx, `chown -R ${target.username}: "${target.baseWebRoot}/${application.name}"`),
    ].join(' && ');

    const result = await sshUtil.executeOnce(ctx.sshConfig, commands, 30000);

    if (result.code !== 0) {
      throw new Error(`Failed to prepare directory: ${result.stderr}`);
    }

    // Capture previous Git commit SHA for rollback reference
    const gitCheck = await sshUtil.executeOnce(
      ctx.sshConfig,
      `[ -d "${componentDeployPath}/.git" ] && cd "${componentDeployPath}" && git rev-parse HEAD || echo ""`,
      15000
    );
    const previousSha = gitCheck.stdout.trim();
    if (previousSha && previousSha.length >= 7) {
      ctx.previousReleaseDir = previousSha;
      ctx.logger.info(`Captured previous commit SHA for rollback reference: ${previousSha}`);
      await Deployment.updateOne(
        { _id: ctx.deployment._id },
        { previousReleaseDir: previousSha }
      );
    }

    ctx.logger.info('Directory prepared.');
  },
};
