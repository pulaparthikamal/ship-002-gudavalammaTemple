import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import {
  createCredentialSchema,
  updateCredentialSchema,
  credentialIdParamsSchema,
} from '../deployment-agent.schema';
import { credentialController } from '../controllers/credential.controller';

const router = Router();

router.use(authMiddleware);

router.post('/', validate(createCredentialSchema), asyncHandler(credentialController.create));
router.get('/', asyncHandler(credentialController.list));
router.put('/:id', validate(updateCredentialSchema), asyncHandler(credentialController.update));
router.patch('/:id', validate(updateCredentialSchema), asyncHandler(credentialController.update));
router.delete('/:id', validate(credentialIdParamsSchema), asyncHandler(credentialController.remove));

export default router;
