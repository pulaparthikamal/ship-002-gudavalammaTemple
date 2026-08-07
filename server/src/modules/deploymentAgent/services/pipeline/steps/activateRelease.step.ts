import { PipelineStep, PipelineContext } from '../pipeline.types';

export const activateReleaseStep: PipelineStep = {
  name: 'activate-release',

  shouldRun(_ctx: PipelineContext): boolean {
    return true;
  },

  async run(ctx: PipelineContext): Promise<void> {
    ctx.logger.info('Symlinks and active releases skipped as per simplified folder structure.');
  },
};
