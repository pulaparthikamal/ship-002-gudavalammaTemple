import { Router } from 'express';
import * as socialAccountController from './socialAccount.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';

const router = Router();

router.use(authMiddleware);

router.post('/connect/:platform', asyncHandler(socialAccountController.connectAccount));
router.get('/', asyncHandler(socialAccountController.getAccounts));
router.put('/:id', asyncHandler(socialAccountController.updateAccount));
router.delete('/:id', asyncHandler(socialAccountController.disconnectAccount));

export default router;

