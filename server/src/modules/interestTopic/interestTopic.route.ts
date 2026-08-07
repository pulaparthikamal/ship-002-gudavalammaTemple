import express from 'express';
import { interestTopicController } from './interestTopic.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';

const router = express.Router();

// Publicly available for the topic form
router.get('/', interestTopicController.getInterestTopics);

// Admin can create - using manageSettings or similar permission
router.post('/', authMiddleware, permissionGuard('settings', 'Update'), interestTopicController.createInterestTopic);

export default router;
