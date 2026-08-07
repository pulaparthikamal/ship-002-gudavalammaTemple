import serverManagementRoutes from '../../modules/serverManagement/routes/server.route';
import scanRoutes from '../../modules/serverManagement/routes/scan.route';
import serverConfigRoutes from '../../modules/serverManagement/routes/config.route';
import agentRoutes from '../../modules/serverManagement/routes/agent.route';
import logsRoutes from '../../modules/serverManagement/routes/logs.route';
import metricsRoutes from '../../modules/serverManagement/routes/metrics.route';
import manualRoutes from '../../modules/serverManagement/routes/manual.route';
import alertsRoutes from '../../modules/serverManagement/routes/alerts.route';
import reportsRoutes from '../../modules/serverManagement/routes/reports.route';
import remediationRoutes from '../../modules/serverManagement/routes/remediation.route';
import fileScannerRoutes from '../../modules/serverManagement/routes/fileScanner.route';
import cleanupRoutes from '../../modules/serverManagement/routes/cleanup.route';
import diskCleanupRoutes from '../../modules/serverManagement/routes/diskCleanup.route';
import { Router } from 'express';

const router = Router();

// Map backend modules to UI-friendly paths
router.use('/dashboard', metricsRoutes);       // For server stats/dashboard
router.use('/servers', serverManagementRoutes); // For connecting/listing servers
router.use('/configuration', serverConfigRoutes);
router.use('/logs', logsRoutes);
router.use('/reports', reportsRoutes);
router.use('/remediation', remediationRoutes);
router.use('/metrics', metricsRoutes);
router.use('/file-scanner', fileScannerRoutes);
router.use('/cleanup', cleanupRoutes);
router.use('/disk-cleanup', diskCleanupRoutes);
router.use('/:serverId/file-scanner', fileScannerRoutes);

// Keep existing routes for potential backward compatibility or internal use
router.use('/scan', scanRoutes);
router.use('/agent', agentRoutes);
router.use('/server-stats', metricsRoutes);
router.use('/manual', manualRoutes);
router.use('/alerts', alertsRoutes);
router.use('/serverReports', reportsRoutes);
router.use('/:serverId/metrics', metricsRoutes);

export default router;
