import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import {
  createApplicationSchema,
  updateApplicationSchema,
  applicationIdParamsSchema,
  listApplicationsQuerySchema,
  updateAutoDeploySchema,
} from '../deployment-agent.schema';
import { applicationController } from '../controllers/application.controller';

const router = Router();

router.use(authMiddleware);

router.post('/', validate(createApplicationSchema), asyncHandler(applicationController.create));
router.get('/', validate(listApplicationsQuerySchema), asyncHandler(applicationController.list));
router.get('/:id', validate(applicationIdParamsSchema), asyncHandler(applicationController.getById));
router.put('/:id', validate(updateApplicationSchema), asyncHandler(applicationController.update));
router.patch('/:id', validate(updateApplicationSchema), asyncHandler(applicationController.update));
router.delete('/:id', validate(applicationIdParamsSchema), asyncHandler(applicationController.remove));

// Webhook management
router.post('/:id/webhook/rotate-secret', validate(applicationIdParamsSchema), asyncHandler(applicationController.rotateWebhookSecret));
router.patch('/:id/auto-deploy', validate(updateAutoDeploySchema), asyncHandler(applicationController.updateAutoDeploy));

export default router;
