import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import {
  createDeploymentTargetSchema,
  updateDeploymentTargetSchema,
  deploymentTargetIdParamsSchema,
  testDeploymentTargetSchema,
} from '../deployment-agent.schema';
import { deploymentTargetController } from '../controllers/deploymentTarget.controller';

const router = Router();

router.use(authMiddleware);

router.post('/', validate(createDeploymentTargetSchema), asyncHandler(deploymentTargetController.create));
router.get('/', asyncHandler(deploymentTargetController.list));
router.get('/:id', validate(deploymentTargetIdParamsSchema), asyncHandler(deploymentTargetController.getById));
router.put('/:id', validate(updateDeploymentTargetSchema), asyncHandler(deploymentTargetController.update));
router.patch('/:id', validate(updateDeploymentTargetSchema), asyncHandler(deploymentTargetController.update));
router.delete('/:id', validate(deploymentTargetIdParamsSchema), asyncHandler(deploymentTargetController.remove));
router.post('/:id/test', validate(testDeploymentTargetSchema), asyncHandler(deploymentTargetController.testConnection));

export default router;
