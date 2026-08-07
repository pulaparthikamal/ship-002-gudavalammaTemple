import { Router } from 'express';
import * as automationController from './automation.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';

const router = Router();

router.use(authMiddleware);

router.post('/', asyncHandler(automationController.createAutomation));
router.get('/', asyncHandler(automationController.getAutomations));
router.put('/:id', asyncHandler(automationController.updateAutomation));
router.put('/:id/toggle-pause', asyncHandler(automationController.togglePause));
router.delete('/:id', asyncHandler(automationController.deleteAutomation));

export default router;

