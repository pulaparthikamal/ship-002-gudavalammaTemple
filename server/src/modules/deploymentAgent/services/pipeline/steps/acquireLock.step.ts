import { PipelineStep, PipelineContext } from '../pipeline.types';
import { lockService } from '../../lock.service';
import { AppError } from '../../../../../utils/error.util';
import { HTTP_STATUS } from '../../../../../constants/httpStatus.constants';

export const acquireLockStep: PipelineStep = {
  name: 'acquire-lock',

  shouldRun(_ctx: PipelineContext): boolean {
    return true;
  },

  async run(ctx: PipelineContext): Promise<void> {
    const appId = String(ctx.application._id);
    const deployId = String(ctx.deployment._id);

    const acquired = lockService.acquire(appId, deployId);
    if (!acquired) {
      const current = lockService.currentDeployment(appId);
      throw new AppError(
        `Application "${ctx.application.name}" is already being deployed (deployment: ${current}). Please wait for it to finish.`,
        HTTP_STATUS.CONFLICT,
      );
    }

    ctx.logger.info(`Deployment lock acquired for application "${ctx.application.name}".`);
  },
};
