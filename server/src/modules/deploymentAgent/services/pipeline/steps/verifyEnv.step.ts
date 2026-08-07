import { PipelineStep, PipelineContext } from '../pipeline.types';
import { applicationService } from '../../application.service';

export const verifyEnvStep: PipelineStep = {
  name: 'verify-env',

  shouldRun(ctx: PipelineContext): boolean {
    return ctx.component.envVars.length > 0;
  },

  async run(ctx: PipelineContext): Promise<void> {
    ctx.logger.info('Pre-verifying environment variables…');

    const envVars = applicationService.getDecryptedEnvVars(ctx.application, ctx.component.key);

    if (envVars.length === 0) {
      ctx.logger.info('No environment variables to verify.');
      return;
    }

    const keyRegex = /^[A-Za-z_][A-Za-z0-9_]*$/;
    const placeholderRegex = /^(?:<.*>|\[.*\]|__.*__|\{\{.*\}\}|TODO|CHANGEME|YOUR_.*)$/i;

    for (const { key, value } of envVars) {
      // 1. Check key structure
      if (!keyRegex.test(key)) {
        throw new Error(`Environment variable validation failed: Key "${key}" contains invalid characters. Keys must only contain alphanumeric characters and underscores, and start with a letter or underscore.`);
      }

      // 2. Check empty values
      if (!value || value.trim() === '') {
        throw new Error(`Environment variable validation failed: Key "${key}" has an empty value.`);
      }

      // 3. Check placeholder syntax
      const trimmedVal = value.trim();
      if (placeholderRegex.test(trimmedVal) || trimmedVal.toLowerCase().includes('change_me') || trimmedVal.toLowerCase().includes('placeholder')) {
        throw new Error(`Environment variable validation failed: Key "${key}" contains a placeholder value ("${value}").`);
      }
    }

    ctx.logger.info(`Validated ${envVars.length} environment variable(s) successfully.`);
  },
};
