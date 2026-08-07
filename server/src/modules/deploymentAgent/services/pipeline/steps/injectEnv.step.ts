import { PipelineStep, PipelineContext } from '../pipeline.types';
import { sshUtil } from '../../../utils/ssh.util';
import { applicationService } from '../../application.service';

export const injectEnvStep: PipelineStep = {
  name: 'inject-env',

  shouldRun(ctx: PipelineContext): boolean {
    return ctx.component.envVars.length > 0;
  },

  async run(ctx: PipelineContext): Promise<void> {
    ctx.logger.info('Injecting environment variables…');

    const envVars = applicationService.getDecryptedEnvVars(ctx.application, ctx.component.key);

    if (envVars.length === 0) {
      ctx.logger.info('No environment variables configured — skipping.');
      return;
    }

    const envContent = envVars.map(({ key, value }) => `${key}=${value}`).join('\n');
    const envFilePath = `${ctx.componentReleaseDir}/.env`;

    await sshUtil.writeFile(ctx.sshConfig, envFilePath, envContent, 15000);

    ctx.logger.info(`Injected ${envVars.length} environment variable(s) into ${envFilePath}.`);
  },
};
