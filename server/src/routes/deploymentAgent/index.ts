import { Router } from 'express';
import credentialRoutes from '../../modules/deploymentAgent/routes/credential.route';
import deploymentTargetRoutes from '../../modules/deploymentAgent/routes/deploymentTarget.route';
import applicationRoutes from '../../modules/deploymentAgent/routes/application.route';
import deploymentRoutes from '../../modules/deploymentAgent/routes/deployment.route';
import webhookRoutes from '../../modules/deploymentAgent/routes/webhook.route';
import { deploymentService } from '../../modules/deploymentAgent/services/deployment.service';

const router = Router();

// Reconcile any deployments left running from a previous server process
deploymentService.reconcileStuckDeployments().catch((err) =>
  console.error('[Boot] Failed to reconcile stuck deployments:', err?.message),
);

router.use('/credentials', credentialRoutes);
router.use('/targets', deploymentTargetRoutes);
router.use('/applications', applicationRoutes);
router.use('/deployments', deploymentRoutes);
router.use('/webhooks', webhookRoutes);

export default router;
