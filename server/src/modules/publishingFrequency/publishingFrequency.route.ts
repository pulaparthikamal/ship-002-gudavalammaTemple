import express from 'express';
import { publishingFrequencyController } from './publishingFrequency.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';

const router = express.Router();

router.get('/', publishingFrequencyController.getFrequencies);
router.post('/', authMiddleware, permissionGuard('settings', 'Update'), publishingFrequencyController.createFrequency);

export default router;
