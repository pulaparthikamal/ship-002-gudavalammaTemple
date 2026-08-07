import { Types } from 'mongoose';
import { logger } from '../../../utils/logger.util';
import { ServerConnection } from '../models/serverConnection.model';
import { RemediationJob, IRemediationJob } from '../models/remediationJob.model';
import { Alert } from '../models/alert.model';
import { alertService } from './alert.service';
import { incidentService } from './incident.service';
import { remediationToolsService } from './remediationTools.service';
import { socketService } from './socket.service';
import { diskCleanupAgentService } from './diskCleanup/diskCleanupAgent.service';
import { MetricsHistory } from '../models/metricsHistory.model';
import { ServerMaintenanceConfig, defaultMaintenanceConfig } from '../models/config.model';
import { CrashHistory } from '../models/crashHistory.model';
import { monitoringEventService } from './monitoring/monitoringEvent.service';

// Thread-safe dynamic in-memory restart tracker
// Key: `${serverId}:${serviceName_or_resourceKey}`
// Value: Array of timestamps of restart executions
const restartAttempts = new Map<string, number[]>();

// Cooldown tracker to prevent immediate double-remediation
// Key: `${serverId}:${serviceName_or_resourceKey}`
// Value: Unix timestamp when cooldown expires
const remediationCooldowns = new Map<string, number>();

// In-flight execution lock
const inFlightJobs = new Set<string>();

const RESTART_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_RESTARTS_IN_WINDOW = 3;
const COOLDOWN_MS = 60 * 1000; // 1 minute cooldown

type HealingRootCause =
  | 'service crashed'
  | 'user manually stopped the service'
  | 'storage full'
  | 'memory pressure'
  | 'CPU spike'
  | 'permission issue'
  | 'dependency failure'
  | 'unknown reason';

const restartLockKey = (serverId: string, target: string) => `${serverId}:restart_service:${target}`;

const getServiceIssue = (metric: any, service: string) =>
  (metric.serviceSummary?.serviceIssues || []).find((issue: any) => issue.service === service);

const inferRootCause = (metric: any, service?: string): HealingRootCause => {
  const issue = service ? getServiceIssue(metric, service) : undefined;
  const text = `${issue?.status || ''} ${issue?.reason || ''}`.toLowerCase();

  if (text.includes('manually stopped') || text.includes('inactive')) return 'user manually stopped the service';
  if (text.includes('permission') || text.includes('denied')) return 'permission issue';
  if (text.includes('dependency')) return 'dependency failure';
  if ((metric.diskUsagePercent ?? 0) > 95) return 'storage full';
  if ((metric.memoryUsagePercent ?? 0) > 95) return 'memory pressure';
  if ((metric.cpuUsagePercent ?? 0) > 98) return 'CPU spike';
  if (text.includes('crash') || text.includes('failed') || text.includes('errored') || text.includes('exited') || text.includes('stopped')) return 'service crashed';
  return 'unknown reason';
};

const parseServiceTarget = (target: string): { serviceType: 'systemd' | 'pm2' | 'docker'; realTarget: string } => {
  if (target.startsWith('docker:')) return { serviceType: 'docker', realTarget: target.replace('docker:', '') };
  if (target.startsWith('pm2:')) return { serviceType: 'pm2', realTarget: target.replace('pm2:', '') };
  return { serviceType: 'systemd', realTarget: target.replace(/^systemd:/, '') };
};

const buildServiceActiveCheckCommand = (target: string) => {
  const { serviceType, realTarget } = parseServiceTarget(target);
  if (serviceType === 'docker') return `sudo docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' ${realTarget}`;
  if (serviceType === 'pm2') return `pm2 show ${realTarget} | grep -E "status|online|stopped|errored"`;
  return `sudo systemctl is-active ${realTarget}`;
};

const isActiveCheckHealthy = (target: string, code: number | null, stdout: string) => {
  const { serviceType } = parseServiceTarget(target);
  const normalized = stdout.toLowerCase();
  if (serviceType === 'docker') return normalized.includes('running') && !normalized.includes('unhealthy');
  if (serviceType === 'pm2') return normalized.includes('online');
  return code === 0 && normalized.trim() === 'active';
};

export const selfHealingService = {
  /**
   * Main evaluation loop invoked after telemetry samples are stored
   */
  async evaluate(serverId: string, metric: any, healthScore: any) {
    if (!serverId) return;

    const server = await ServerConnection.findById(serverId);
    if (!server || !server.active || server.status === 'disabled') {
      return;
    }

    const failedServices: string[] = Array.from(
      new Set((metric.serviceSummary?.failedServices || []).map((service: unknown) => String(service))),
    );
    const cpuUsage = metric.cpuUsagePercent ?? 0;
    const memoryUsage = metric.memoryUsagePercent ?? 0;
    const diskUsage = metric.diskUsagePercent ?? 0;

    // 1. Process/Service Crashes
    for (const service of failedServices) {
      const lockKey = restartLockKey(serverId, service);
      if (this.isCooldownActive(lockKey) || inFlightJobs.has(lockKey)) {
        continue;
      }

      const reason = inferRootCause(metric, service);
      // logger.debug(`[SelfHealing] Detected ${reason}: service "${service}" is unhealthy on server ${server.name}`);
      void this.triggerHealing(
        serverId,
        'restart_service',
        service,
        `Automated restart of unhealthy service "${service}". Reason: ${reason}.`,
        reason,
      ).catch((err) => {
        logger.error(`[SelfHealing] Failed service healing execution:`, err);
      });
    }

    // 2. Memory Exhaustion (> 95%)
    if (memoryUsage > 95) {
      const lockKey = `${serverId}:resource:memory`;
      if (!this.isCooldownActive(lockKey) && !inFlightJobs.has(lockKey)) {
        logger.warn(`[SelfHealing] Memory critical exhaustion detected: ${memoryUsage}% on server ${server.name}`);
        void this.triggerHealing(
          serverId,
          'clear_cache',
          'memory',
          `System memory critical at ${memoryUsage}%. Executing page cache flush.`,
          'memory pressure',
        ).catch((err) => {
          logger.error(`[SelfHealing] Memory recovery execution failed:`, err);
        });
      }
    }

    // 3. Disk Space Critical (> 95%)
    if (diskUsage > 95) {
      const lockKey = `${serverId}:resource:disk`;
      if (!this.isCooldownActive(lockKey) && !inFlightJobs.has(lockKey)) {
        logger.warn(`[SelfHealing] Disk critical capacity exceeded: ${diskUsage}% on server ${server.name}`);
        void this.triggerDiskCleanup(serverId, diskUsage).catch((err) => {
          logger.error(`[SelfHealing] Disk recovery cleanup execution failed:`, err);
        });
      }
    }

    // 4. CPU Lockup / Freeze (CPU > 98%)
    if (cpuUsage > 98) {
      const lockKey = `${serverId}:resource:cpu`;
      if (!this.isCooldownActive(lockKey) && !inFlightJobs.has(lockKey)) {
        // Double check zombie or runaway processes
        const topProcs = metric.processSummary?.topCpu || [];
        const runaway = topProcs.find((p: any) => p.cpuPercent > 90);
        if (runaway && runaway.pid) {
          logger.warn(`[SelfHealing] CPU freeze lockup detected: ${cpuUsage}%. Runaway process PID ${runaway.pid} (${runaway.name}) using ${runaway.cpuPercent}% CPU.`);
          void this.triggerHealing(
            serverId,
            'kill_process',
            String(runaway.pid),
            `CPU freeze recovery: Terminating runaway process PID ${runaway.pid} (${runaway.name})`,
            'CPU spike',
          ).catch((err) => {
            logger.error(`[SelfHealing] CPU freeze kill execution failed:`, err);
          });
        }
      }
    }
  },

  /**
   * Handle server unreachable drop alerts
   */
  async handleUnreachable(serverId: string, errorMessage: string) {
    const server = await ServerConnection.findById(serverId);
    if (!server || !server.active || server.status === 'disabled') {
      return;
    }

    const lockKey = `${serverId}:connection:ssh`;
    if (this.isCooldownActive(lockKey)) {
      return;
    }

    this.setCooldown(lockKey, 5 * 60 * 1000); // 5 min connection warning cooldown
    const serverAfterStatus = await monitoringEventService.markServerUnreachable(serverId, errorMessage);
    const likelyShutdown = monitoringEventService.isLikelyShutdownError(errorMessage);

    // Raise critical Alert
    await alertService.create({
      serverId,
      type: likelyShutdown ? 'server_shutdown' : 'ssh_login_failure',
      severity: 'critical',
      title: likelyShutdown ? 'Server Shutdown Detected' : `Server Connection Offline`,
      message: likelyShutdown
        ? `Server ${server.name} (${server.host}:${server.port}) appears offline or shut down. Diagnostic detail: ${errorMessage}`
        : `Unable to establish SSH connectivity with server ${server.name} (${server.host}:${server.port}). Diagnostic detail: ${errorMessage}`,
      dedupeKey: likelyShutdown ? 'server:shutdown' : 'server:ssh_unreachable',
      metadata: {
        dedupeKey: likelyShutdown ? 'server:shutdown' : 'server:ssh_unreachable',
        serverStatus: serverAfterStatus?.status,
      },
      email: false,
    });

    // Compile incident
    void incidentService.analyze(serverId).catch((err) => {
      logger.error('[SelfHealing] Unreachable Incident analysis trigger failed:', err);
    });
  },

  /**
   * Enforces loop-prevention counters and handles actual SSH restarts or clear cache runs
   */
  async triggerHealing(
    serverId: string,
    type: 'restart_service' | 'kill_process' | 'clear_cache',
    target: string,
    description: string,
    rootCause: HealingRootCause = 'unknown reason',
  ) {
    const lockKey = `${serverId}:${type}:${target}`;
    inFlightJobs.add(lockKey);

    try {
      const server = await ServerConnection.findById(serverId);
      if (!server) return;

      // Load config dynamically
      const config = await ServerMaintenanceConfig.findOne({ server: server._id });
      const maxRestarts = config?.maxRestartAttempts ?? defaultMaintenanceConfig.maxRestartAttempts ?? 3;
      const cooldownMins = config?.restartCooldownMinutes ?? defaultMaintenanceConfig.restartCooldownMinutes ?? 5;
      const cooldownMs = cooldownMins * 60 * 1000;

      // 1. Loop Prevention Check
      const now = Date.now();
      const attempts = restartAttempts.get(lockKey) || [];
      const recentAttempts = attempts.filter((t) => now - t < RESTART_WINDOW_MS);

      if (recentAttempts.length >= maxRestarts) {
        logger.error(`[SelfHealing] Loop Prevention Triggered for ${lockKey}. Exceeded ${maxRestarts} restarts in 10 minutes.`);
        
        // Push warning alert
        await alertService.create({
          serverId,
          type: 'remediation_failed',
          severity: 'critical',
          title: `Healing Loop Suspended`,
          message: `Self-healing halted for target "${target}". Process exceeded restart loop threshold (${maxRestarts} failures in 10 minutes). Escalated for manual intervention.`,
        });

        // Trigger full Incident Correlation & Root Cause Analysis
        void incidentService.analyze(serverId).catch((err) => {
          logger.error('[SelfHealing] Loop incident analysis failed:', err);
        });

        this.emitStatusUpdate(serverId);
        return;
      }

      const initialAttemptNumber = recentAttempts.length + 1;

      logger.info(`[SelfHealing] Running healing cycle for ${lockKey}. Attempt ${recentAttempts.length} of ${maxRestarts}.`);

      // 2. Create Mongoose Remediation Job
      const job = await RemediationJob.create({
        server: server._id,
        type,
        target,
        description,
        status: 'running',
        planningMode: 'static',
        plannedBy: 'system_self_healing',
        requiresApproval: false,
        priority: 'critical',
        retryCount: initialAttemptNumber - 1,
        maxRetries: maxRestarts,
        decisionTrace: [
          `Dynamic crash-detection loop intercepted event.`,
          `Checked loop-prevention thresholds: starting attempt ${initialAttemptNumber}/${maxRestarts}.`,
          `Root cause classification: ${rootCause}.`,
          `Initializing automated self-healing remediation.`,
        ],
        steps: [
          {
            name: `Execute ${type} for ${target} (attempt ${initialAttemptNumber})`,
            status: 'running',
            startedAt: new Date(),
          },
        ],
        created: new Date(),
        updated: new Date(),
        startedAt: new Date(),
      });

      this.emitStatusUpdate(serverId);

      // 3. Pre-Flight Check with active health check verification
      let isActuallyFailed = true;
      let checkResults = 'Pre-check completed successfully.';
      
      if (type === 'restart_service') {
        const { serviceType, realTarget } = parseServiceTarget(target);
        const checkCommand = buildServiceActiveCheckCommand(target);

        try {
          const preCheck = await remediationToolsService.executeToolCall(server, {
            toolName: 'custom_command',
            args: { command: checkCommand }
          });
          
          const stdout = (preCheck.stdout || '').toLowerCase();
          checkResults = `Service Active Check: ${stdout || 'No output.'}`;
          isActuallyFailed = !isActiveCheckHealthy(target, preCheck.code, stdout);

          // If failed, log crash to database
          if (isActuallyFailed) {
            await CrashHistory.create({
              server: server._id,
              serviceType,
              serviceName: realTarget,
              reason: rootCause,
              timestamp: new Date(),
            });
            // logger.debug(`[SelfHealing] Detection confirmed service=${target} reason="${rootCause}" check="${checkCommand}" output="${stdout}"`);
          }
        } catch (err) {
          logger.warn(`[SelfHealing] Pre-flight active verification command execution failed: ${err}`);
          checkResults = `Verification execution failed: ${err}`;
        }
      } else {
        // Run standard health check for non-service operations
        try {
          const preCheck = await remediationToolsService.executeToolCall(server, { toolName: 'run_health_check', args: {} });
          checkResults = preCheck.stdout || preCheck.stderr || 'Pre-check completed.';
        } catch (err) {
          checkResults = String(err);
        }
      }

      job.preFlightCheck = {
        status: isActuallyFailed ? 'passed' : 'failed',
        results: checkResults,
        timestamp: new Date(),
      };
      await job.save();

      // If pre-flight active check found that the service is actually healthy, skip remediation to avoid false restarts
      if (!isActuallyFailed) {
        job.status = 'skipped' as any;
        job.completedAt = new Date();
        job.decisionTrace.push(`Service active check determined the service is already healthy. Skipping automated recovery execution.`);
        const step = job.steps[0];
        step.status = 'skipped';
        step.completedAt = new Date();
        step.output = 'Skipped because service has self-healed or is already active.';
        await job.save();

        await alertService.create({
          serverId,
          type: 'remediation_completed',
          severity: 'info',
          title: `Healing Execution Skipped`,
          message: `Self-healing for target "${target}" skipped: process active validation passed. System self-corrected.`,
        });

        this.emitStatusUpdate(serverId);
        return;
      }

      // 4. Run Healing Tool with configured retries in this recovery job
      let executionError = '';
      let postPassed = false;
      let attemptNumber = initialAttemptNumber;
      while (attemptNumber <= maxRestarts && !postPassed) {
        recentAttempts.push(Date.now());
        restartAttempts.set(lockKey, recentAttempts);
        job.retryCount = attemptNumber - 1;

        const step = job.steps[job.steps.length - 1];
        if (step.status !== 'running') {
          step.status = 'running';
          step.startedAt = new Date();
        }

        try {
          const toolResult = await remediationToolsService.executeToolCall(server, {
            toolName: type as any,
            args: type === 'restart_service' ? { serviceName: target } : type === 'kill_process' ? { pid: target } : {},
          });
          logger.info(`[SelfHealing] Remediation command completed type=${type} target=${target} attempt=${attemptNumber}/${maxRestarts} code=${toolResult.code}`);

          if (toolResult.code === 0) {
            step.status = 'completed';
            step.output = toolResult.stdout;
            step.completedAt = new Date();
            executionError = '';
          } else {
            step.status = 'failed';
            step.error = toolResult.stderr || 'Command returned non-zero code.';
            step.completedAt = new Date();
            executionError = step.error;
          }
        } catch (err) {
          step.status = 'failed';
          step.error = String(err);
          step.completedAt = new Date();
          executionError = step.error;
        }

        try {
          const postCheck = await remediationToolsService.executeToolCall(server, { toolName: 'run_health_check', args: {} });
          let serviceStillFailed = false;
          let serviceCheckOutput = '';
          if (type === 'restart_service') {
            const activeCheck = await remediationToolsService.executeToolCall(server, {
              toolName: 'custom_command',
              args: { command: buildServiceActiveCheckCommand(target) },
            });
            serviceCheckOutput = activeCheck.stdout || activeCheck.stderr || '';
            if (!isActiveCheckHealthy(target, activeCheck.code, activeCheck.stdout || '')) {
              serviceStillFailed = true;
            }
          }

          postPassed = !executionError && postCheck.code === 0 && !serviceStillFailed;
          job.postFlightCheck = {
            status: postPassed ? 'passed' : 'failed',
            results: [
              `Attempt ${attemptNumber}/${maxRestarts}`,
              postCheck.stdout || postCheck.stderr || 'Post-check completed.',
              serviceCheckOutput ? `Service active check: ${serviceCheckOutput}` : '',
            ].filter(Boolean).join('\n'),
            timestamp: new Date(),
          };
        } catch (err) {
          logger.error(`[SelfHealing] Post-flight validation failed for target=${target}:`, err);
          job.postFlightCheck = {
            status: 'failed',
            results: `Attempt ${attemptNumber}/${maxRestarts}: ${String(err)}`,
            timestamp: new Date(),
          };
        }

        if (!postPassed && attemptNumber < maxRestarts) {
          job.decisionTrace.push(`Attempt ${attemptNumber}/${maxRestarts} failed; scheduling retry ${attemptNumber + 1}/${maxRestarts}.`);
          job.steps.push({
            name: `Execute ${type} for ${target} (attempt ${attemptNumber + 1})`,
            status: 'running',
            startedAt: new Date(),
          });
          await job.save();
          attemptNumber += 1;
          await new Promise((resolve) => setTimeout(resolve, Math.min(3000, Math.max(500, cooldownMs / 20))));
        } else {
          break;
        }
      }

      this.setCooldown(lockKey, cooldownMs);
      job.status = postPassed && !executionError ? 'completed' : 'failed';
      job.completedAt = new Date();
      if (executionError || !postPassed) {
        job.lastError = executionError || `All ${maxRestarts} recovery attempts failed post-flight health validation.`;
      }
      job.decisionTrace.push(
        job.status === 'completed'
          ? `Final recovery status: recovered after ${job.retryCount + 1} attempt(s).`
          : `Final recovery status: failed after ${maxRestarts} configured attempt(s).`,
      );
      await job.save();

      // 6. Raise Alerts / Sync Incident lifecycle
      if (job.status === 'completed') {
        logger.info(`[SelfHealing] Recovery succeeded target=${target} reason="${rootCause}" attempts=${job.retryCount + 1}`);
        await alertService.create({
          serverId,
          type: 'remediation_completed',
          severity: 'success',
          title: `Self-Healing Restoration Successful`,
          message: `Self-healing successfully resolved process anomaly after ${job.retryCount + 1} attempt(s): "${description}". Verification check passed.`,
        });
      } else {
        logger.error(`[SelfHealing] Recovery failed target=${target} reason="${rootCause}" attempts=${maxRestarts} error=${job.lastError || 'post-flight failed'}`);
        await alertService.create({
          serverId,
          type: 'remediation_failed',
          severity: 'warning',
          title: `Self-Healing Recovery Attempt Failed`,
          message: `Self-healing recovery failed after all ${maxRestarts} configured attempt(s): "${description}". Details: ${job.lastError || 'Post-flight check failed.'}`,
        });

        // Trigger incident compile
        void incidentService.analyze(serverId).catch((err) => {
          logger.error('[SelfHealing] Post-failure incident compile failed:', err);
        });
      }

      this.emitStatusUpdate(serverId);
    } finally {
      inFlightJobs.delete(lockKey);
    }
  },

  /**
   * Disk critical healing execution wrapper
   */
  async triggerDiskCleanup(serverId: string, currentUsage: number) {
    const lockKey = `${serverId}:resource:disk`;
    inFlightJobs.add(lockKey);

    try {
      const server = await ServerConnection.findById(serverId);
      if (!server) return;

      this.setCooldown(lockKey, 5 * 60 * 1000); // 5 min disk cleanup cooldown

      const job = await RemediationJob.create({
        server: server._id,
        type: 'archive_file',
        target: 'disk_space',
        description: `Disk critical capacity at ${currentUsage}%. Initializing automatic storage reclamation scan.`,
        status: 'running',
        planningMode: 'agent',
        plannedBy: 'system_self_healing',
        requiresApproval: false,
        priority: 'high',
        decisionTrace: [
          `Disk threshold > 95% storage capacity breached.`,
          `Launching automatic disk directory cleanup analysis.`,
        ],
        steps: [
          {
            name: `Run policy cleanup scan`,
            status: 'running',
            startedAt: new Date(),
          },
          {
            name: `Apply safe disk cleanup`,
            status: 'pending',
          },
        ],
        created: new Date(),
        updated: new Date(),
        startedAt: new Date(),
      });

      this.emitStatusUpdate(serverId);

      // Pre-flight health
      job.preFlightCheck = {
        status: 'passed',
        results: `Disk used: ${currentUsage}%`,
        timestamp: new Date(),
      };
      await job.save();

      // Step 1: Policy scan
      let scanResult;
      try {
        scanResult = await diskCleanupAgentService.scan(serverId, { dryRun: true, triggerType: 'STORAGE_SPIKE' });
        job.steps[0].status = 'completed';
        job.steps[0].output = JSON.stringify({
          filesScanned: scanResult.filesScanned,
          reclaimableStorageBytes: scanResult.reclaimableStorageBytes,
          diskUsagePercent: scanResult.currentDiskUsage.usagePercent,
        });
        job.steps[0].completedAt = new Date();
      } catch (err) {
        job.steps[0].status = 'failed';
        job.steps[0].error = String(err);
        job.steps[0].completedAt = new Date();
      }
      await job.save();

      // Step 2: Apply safe cleanups
      let cleanupSummary;
      if (job.steps[0].status === 'completed' && scanResult) {
        job.steps[1].status = 'running';
        job.steps[1].startedAt = new Date();
        await job.save();

        try {
          const cleanResult = await diskCleanupAgentService.execute(serverId, 'STORAGE_SPIKE');

          job.steps[1].status = 'completed';
          job.steps[1].output = JSON.stringify(cleanResult);
          job.steps[1].completedAt = new Date();
          cleanupSummary = {
            scannedFiles: cleanResult.filesScanned,
            filesDeleted: cleanResult.filesDeleted,
            filesArchived: cleanResult.archivedFiles,
            failedActions: cleanResult.failedFiles,
            skippedActions: cleanResult.filesSkipped,
            spaceReclaimedMb: cleanResult.storageReducedMB,
            verification: {
              diskUsageDeltaPercent: cleanResult.diskUsagePercentReduced,
              issueStillPresent: cleanResult.diskUsagePercentAfter >= 85,
            },
            details: [{ diskCleanupJobId: cleanResult.jobId, triggerType: cleanResult.triggerType }],
          };
        } catch (err) {
          job.steps[1].status = 'failed';
          job.steps[1].error = String(err);
          job.steps[1].completedAt = new Date();
        }
      } else {
        job.steps[1].status = 'skipped';
      }

      // Check results
      const spaceReclaimed = cleanupSummary?.spaceReclaimedMb ?? 0;
      job.status = job.steps[1].status === 'completed' ? 'completed' : 'failed';
      job.completedAt = new Date();
      if (cleanupSummary) {
        job.executionSummary = cleanupSummary;
      }
      await job.save();

      // Alert
      if (job.status === 'completed') {
        await alertService.create({
          serverId,
          type: 'remediation_completed',
          severity: 'success',
          title: `Disk Space Cleaned Successfully`,
          message: `Storage capacity resolved. Reclaimed ${spaceReclaimed.toFixed(2)} MB of temporary and log files.`,
        });
      } else {
        await alertService.create({
          serverId,
          type: 'remediation_failed',
          severity: 'warning',
          title: `Disk Storage Reclamation Failed`,
          message: `Automatic disk space cleanup halted. Manual investigation required.`,
        });
      }

      this.emitStatusUpdate(serverId);
    } finally {
      inFlightJobs.delete(lockKey);
    }
  },

  /**
   * Status updates emitted dynamically over Server details WS channel
   */
  emitStatusUpdate(serverId: string) {
    void this.getStatus(serverId).then((status) => {
      socketService.emitToServer(serverId, 'SELF_HEALING_UPDATE', status);
    }).catch((err) => {
      logger.error('[SelfHealing] WebSocket emit failed:', err);
    });
  },

  /**
   * Helper connection check loops
   */
  isCooldownActive(key: string): boolean {
    const expire = remediationCooldowns.get(key) || 0;
    return Date.now() < expire;
  },

  setCooldown(key: string, durationMs: number) {
    remediationCooldowns.set(key, Date.now() + durationMs);
  },

  /**
   * Computes dynamic self-healing status matrices for backend APIs and WebSockets
   */
  async getStatus(serverId: string) {
    if (!Types.ObjectId.isValid(serverId)) {
      return null;
    }

    const [recentJobs, openIncidents, latestMetric, server] = await Promise.all([
      RemediationJob.find({ server: new Types.ObjectId(serverId) })
        .sort({ created: -1 })
        .limit(10)
        .lean<IRemediationJob[]>(),
      Alert.countDocuments({
        server: new Types.ObjectId(serverId),
        type: { $in: ['ssh_login_failure', 'remediation_failed'] },
        read: false,
      }),
      MetricsHistory.findOne({ server: new Types.ObjectId(serverId) })
        .sort({ collectedAt: -1 })
        .lean(),
      ServerConnection.findById(serverId),
    ]);

    // Uptime calculation from metrics history or standard SSH outputs
    const uptimeStr = latestMetric?.sshSessionActivity?.loggedInUsers != null
      ? 'Online'
      : 'Offline';

    const restartCount = recentJobs.filter((job) => job.type === 'restart_service' && job.status === 'completed').length;
    
    // Last crash timestamp (timestamp of last failed job or warning Alert)
    const lastFailedJob = recentJobs.find((job) => job.status === 'failed');
    const lastCrashTimestamp = lastFailedJob?.created || null;

    // Active status
    const activeJob = recentJobs.find((job) => job.status === 'running');
    const recoveryStatus = activeJob
      ? 'running'
      : recentJobs[0]?.status === 'completed'
      ? 'completed'
      : recentJobs[0]?.status === 'failed'
      ? 'failed'
      : 'idle';

    // Stability calculation: if we have more than 2 failed recovery jobs or a loop-prevented block recently, mark unstable
    const failedJobsCount = recentJobs.filter((job) => job.status === 'failed').length;
    const stabilityIndicator = failedJobsCount >= 2
      ? 'unstable'
      : failedJobsCount === 1
      ? 'warning'
      : 'stable';

    const lastJob = recentJobs[0];
    const healthCheckResults = lastJob?.postFlightCheck
      ? {
          status: lastJob.postFlightCheck.status,
          timestamp: lastJob.postFlightCheck.timestamp,
        }
      : undefined;

    return {
      uptime: uptimeStr,
      restartCount,
      lastCrashTimestamp,
      recoveryStatus,
      activeIncidents: openIncidents,
      healthCheckResults,
      stabilityIndicator,
      serverName: server?.name,
      serverHost: server?.host,
      recentRecoveryActions: recentJobs,
    };
  },

  resetRuntimeStateForTests() {
    restartAttempts.clear();
    remediationCooldowns.clear();
    inFlightJobs.clear();
  },
};
