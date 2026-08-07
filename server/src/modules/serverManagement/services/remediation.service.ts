import { Types } from 'mongoose';
import {
  RemediationJob,
  IRemediationJob,
  RemediationType,
  IRemediationStep,
} from '../models/remediationJob.model';
import { ServerConnection } from '../models/serverConnection.model';
import { sshService } from './ssh.service';
import { shellQuote } from '../utils/shell.util';
import { socketService } from './socket.service';
import { alertService } from './alert.service';
import { remediationPlannerService } from './remediationPlanner.service';
import { remediationToolsService } from './remediationTools.service';
import { monitoringService } from './monitoring.service';
import { agentService } from './agent.service';
import { Prediction } from '../models/prediction.model';
import { scanService } from './scan.service';

const sanitizeStepOutput = (value: string) =>
  value.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\uFFFD]/g, '');

const truncateStepOutput = (value: string, limit = 1024 * 1024) =>
  sanitizeStepOutput(value).substring(0, limit);

const truncateListStepOutput = (value?: string, limit = 8000) => {
  if (!value) {
    return value;
  }

  const sanitized = sanitizeStepOutput(value);
  if (sanitized.length <= limit) {
    return sanitized;
  }

  return `${sanitized.substring(0, limit)}\n...[truncated ${sanitized.length - limit} chars]`;
};

const compactRemediationJobForList = (job: any) => ({
  ...job,
  steps: (job.steps || []).map((step: any) => ({
    ...step,
    output: truncateListStepOutput(step.output),
    error: truncateListStepOutput(step.error),
  })),
  rollbackSteps: (job.rollbackSteps || []).map((step: any) => ({
    ...step,
    output: truncateListStepOutput(step.output),
    error: truncateListStepOutput(step.error),
  })),
});

const parseJsonOutput = (value?: string) => {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const getCleanupSuccessCount = (summary: any) =>
  Number(summary?.filesDeleted || 0) +
  Number(summary?.filesArchived || 0) +
  Number(summary?.filesIgnored || 0);

const scanWorkflowTools = new Set(['start_scan', 'analyze_scan_results', 'apply_scan_cleanup']);

const toExecutionSummary = (cleanupSummary: any) => ({
  scannedFiles: cleanupSummary.scannedFiles,
  candidatesFound: cleanupSummary.candidatesFound,
  filesDeleted: cleanupSummary.filesDeleted,
  filesArchived: cleanupSummary.filesArchived,
  filesIgnored: cleanupSummary.filesIgnored,
  failedActions: cleanupSummary.failedActions,
  skippedActions: cleanupSummary.skippedActions,
  spaceReclaimedMb: cleanupSummary.spaceReclaimedMb,
  optimizationActions: cleanupSummary.optimizationActions,
  optimizationRecoveredMb: cleanupSummary.optimizationRecoveredMb,
  noSafeFixApplied: cleanupSummary.noSafeFixApplied,
  noSafeFixReason: cleanupSummary.noSafeFixReason,
  beforeMetrics: cleanupSummary.beforeMetrics,
  afterMetrics: cleanupSummary.afterMetrics,
  beforePrediction: cleanupSummary.beforePrediction,
  afterPrediction: cleanupSummary.afterPrediction,
  verification: cleanupSummary.verification,
  remainingIssues: cleanupSummary.remainingIssues,
  scanId: cleanupSummary.scanId,
  details: cleanupSummary.details,
  errors: cleanupSummary.errors,
});

const metricSnapshot = (metric: any) => ({
  collectedAt: metric?.collectedAt,
  cpuUsagePercent: metric?.cpuUsagePercent,
  memoryUsagePercent: metric?.memoryUsagePercent,
  diskUsagePercent: metric?.diskUsagePercent,
  swapUsagePercent: metric?.swapUsagePercent,
  loadAverage: metric?.loadAverage,
});

const predictionSnapshot = (prediction: any) => {
  const issues = Array.isArray(prediction?.predictions) ? prediction.predictions : [];
  return {
    id: prediction?._id,
    created: prediction?.created,
    issueCount: issues.length,
    highestConfidence: issues.reduce(
      (max: number, issue: any) => Math.max(max, Number(issue.confidence || 0)),
      0,
    ),
    highCount: issues.filter((issue: any) => issue.severity === 'high').length,
    criticalCount: issues.filter((issue: any) => issue.severity === 'critical').length,
    issues: issues.slice(0, 5).map((issue: any) => ({
      issue: issue.issue,
      predictedFailure: issue.predictedFailure,
      severity: issue.severity,
      confidence: issue.confidence,
    })),
  };
};

const verificationSummary = (beforeMetrics: any, afterMetrics: any, beforePrediction: any, afterPrediction: any) => {
  const beforeDisk = Number(beforeMetrics?.diskUsagePercent ?? 0);
  const afterDisk = Number(afterMetrics?.diskUsagePercent ?? 0);
  const beforeConfidence = Number(beforePrediction?.highestConfidence ?? 0);
  const afterConfidence = Number(afterPrediction?.highestConfidence ?? 0);

  return {
    verifiedAt: new Date(),
    diskUsageDeltaPercent: Number((afterDisk - beforeDisk).toFixed(2)),
    predictionConfidenceDelta: Number((afterConfidence - beforeConfidence).toFixed(2)),
    improved:
      (beforeDisk > 0 && afterDisk < beforeDisk) ||
      (beforeConfidence > 0 && afterConfidence < beforeConfidence),
    issueStillPresent: Boolean(
      afterPrediction &&
      (Number(afterPrediction.highestConfidence || 0) >= 0.7 ||
        Number(afterPrediction.highCount || 0) > 0 ||
        Number(afterPrediction.criticalCount || 0) > 0),
    ),
  };
};

const mergeCleanupSummaries = (base: any, next: any) => {
  if (!base) return next;
  if (!next) return base;

  return {
    ...base,
    filesDeleted: Number(base.filesDeleted || 0) + Number(next.filesDeleted || 0),
    filesArchived: Number(base.filesArchived || 0) + Number(next.filesArchived || 0),
    filesIgnored: Number(base.filesIgnored || 0) + Number(next.filesIgnored || 0),
    failedActions: Number(base.failedActions || 0) + Number(next.failedActions || 0),
    skippedActions: Number(base.skippedActions || 0) + Number(next.skippedActions || 0),
    spaceReclaimedMb: Number(base.spaceReclaimedMb || 0) + Number(next.spaceReclaimedMb || 0),
    optimizationActions:
      Number(base.optimizationActions || 0) + Number(next.optimizationActions || 0),
    optimizationRecoveredMb:
      Number(base.optimizationRecoveredMb || 0) + Number(next.optimizationRecoveredMb || 0),
    noSafeFixApplied: Boolean(next.noSafeFixApplied && !Number(base.spaceReclaimedMb || 0)),
    noSafeFixReason: next.noSafeFixReason || base.noSafeFixReason,
    beforeMetrics: base.beforeMetrics || next.beforeMetrics,
    afterMetrics: next.afterMetrics || base.afterMetrics,
    beforePrediction: base.beforePrediction || next.beforePrediction,
    afterPrediction: next.afterPrediction || base.afterPrediction,
    verification: next.verification || base.verification,
    details: [...(base.details || []), ...(next.details || [])].slice(0, 500),
    errors: [...(base.errors || []), ...(next.errors || [])].slice(0, 200),
  };
};

export const remediationService = {
  async prepareJobExecution(jobId: string, approvedBy?: string) {
    const job = await RemediationJob.findById(jobId);
    if (!job) throw new Error('Remediation job not found');

    if (job.status !== 'planned' && job.status !== 'pending_approval' && job.status !== 'queued') {
      throw new Error(`Cannot execute job in status: ${job.status}`);
    }

    const server = await ServerConnection.findById(job.server);
    if (!server) throw new Error('Server not found');

    job.status = 'running';
    job.approvedBy = approvedBy;
    job.approvedAt = new Date();
    job.startedAt = new Date();
    job.progressPercent = 0;
    job.currentStep = 'Analyzing remediation context';
    job.lastProgressAt = new Date();
    await job.save();

    this.emitStatusUpdate(job);

    return { job, server };
  },

  async runPreparedJob(job: IRemediationJob, server: any): Promise<IRemediationJob> {
    const runtimeContext: Record<string, unknown> = {};
    let activeStepIndex = 0;
    let activeStepName = '';
    const totalSteps = Math.max(job.steps.length, 1);

    const updateProgress = async (
      percent: number,
      currentStep: string,
      executionSummary?: any,
      emit = true,
    ) => {
      job.progressPercent = Math.max(0, Math.min(Math.round(percent), 100));
      job.currentStep = currentStep;
      job.lastProgressAt = new Date();
      if (executionSummary) {
        job.executionSummary = toExecutionSummary(executionSummary);
      }
      await job.save();
      if (emit) {
        this.emitStatusUpdate(job);
      }
    };

    runtimeContext.onProgress = async (progress: any) => {
      const batchRatio = progress.totalActions > 0
        ? progress.processedActions / progress.totalActions
        : progress.phase === 'finished' ? 1 : 0.25;
      const percent = ((activeStepIndex + batchRatio) / totalSteps) * 100;
      const actionCount = progress.totalActions
        ? ` (${progress.processedActions}/${progress.totalActions} actions)`
        : '';
      await updateProgress(
        Math.min(percent, 99),
        `${activeStepName || 'Running remediation'}${actionCount}`,
        progress.summary,
      );
    };

    try {
      const latestPrediction = await Prediction.findOne({ server: job.server }).sort({ created: -1 }).lean();
      runtimeContext.beforePrediction = predictionSnapshot(latestPrediction);

      // 1. Pre-flight health check
      await updateProgress(2, 'Analyzing current server state', undefined, false);
      job.preFlightCheck = await this.performHealthCheck(server);
      await job.save();

      // 2. Execute steps
      let hasSuccess = false;
      let hasFailure = false;
      let fatalStepFailure = false;
      let cleanupSummary: any;

      for (const [stepIndex, step] of job.steps.entries()) {
        activeStepIndex = stepIndex;
        activeStepName = step.name;
        step.status = 'running';
        step.startedAt = new Date();
        job.currentStep =
          step.toolName === 'apply_scan_cleanup' || step.toolName === 'safe_system_optimization'
            ? `Executing: ${step.name}`
            : step.toolName === 'start_scan' || step.toolName === 'analyze_scan_results'
              ? `Analyzing: ${step.name}`
              : step.name;
        job.progressPercent = Math.max(
          job.progressPercent || 0,
          Math.round((stepIndex / totalSteps) * 100),
        );
        job.lastProgressAt = new Date();
        await job.save();
        this.emitStatusUpdate(job);

        if (step.command || step.toolName) {
          try {
            const result = await remediationToolsService.executeStep(server, step, runtimeContext);

            step.output = result.stdout ? truncateStepOutput(result.stdout) : '';
            step.error = result.stderr ? truncateStepOutput(result.stderr) : '';
            step.status = result.code === 0 ? 'completed' : 'failed';

            if (step.toolName === 'apply_scan_cleanup' || step.toolName === 'safe_system_optimization') {
              const parsedSummary = parseJsonOutput(result.stdout);
              if (parsedSummary) {
                cleanupSummary =
                  step.toolName === 'safe_system_optimization'
                    ? mergeCleanupSummaries(cleanupSummary, parsedSummary)
                    : parsedSummary;
                job.executionSummary = toExecutionSummary(cleanupSummary);

                const cleanupSuccessCount = getCleanupSuccessCount(cleanupSummary);
                const optimizationCount = Number(cleanupSummary.optimizationActions || 0);
                if (cleanupSummary.executableCount === 0 && optimizationCount === 0) {
                  step.status = 'completed';
                  step.error = '';
                } else if (cleanupSummary.executableCount === 0) {
                  step.status = 'completed';
                  step.error = '';
                } else if (cleanupSummary.failedActions > 0 && cleanupSuccessCount > 0) {
                  step.status = 'failed';
                  step.error = `${cleanupSummary.failedActions} cleanup actions failed after ${cleanupSuccessCount} successful actions.`;
                }
              }
            }
          } catch (err: any) {
            step.error = err.message;
            step.status = 'failed';
          }
        } else {
          step.status = 'completed';
        }

        if (step.status === 'completed') hasSuccess = true;
        if (step.status === 'failed') hasFailure = true;

        if (
          step.status === 'failed' &&
          (step.toolName === 'start_scan' || step.toolName === 'analyze_scan_results')
        ) {
          fatalStepFailure = true;
          for (const remainingStep of job.steps.slice(stepIndex + 1)) {
            if (remainingStep.toolName && scanWorkflowTools.has(remainingStep.toolName)) {
              remainingStep.status = 'skipped';
              remainingStep.error = `Skipped because ${step.toolName} failed.`;
              remainingStep.completedAt = new Date();
            }
          }
        }

        step.completedAt = new Date();
        job.progressPercent = Math.max(
          job.progressPercent || 0,
          Math.round(((stepIndex + 1) / totalSteps) * 100),
        );
        job.currentStep = step.status === 'completed'
          ? `Completed: ${step.name}`
          : `Failed: ${step.name}`;
        job.lastProgressAt = new Date();
        await job.save();

        this.emitStatusUpdate(job);

        if (fatalStepFailure) {
          break;
        }
      }

      // 3. Post-flight verification
      job.currentStep = 'Verifying remediation outcome';
      job.lastProgressAt = new Date();
      await job.save();
      job.postFlightCheck = await this.performHealthCheck(server);

      let afterMetrics;
      let afterPrediction;
      try {
        const metric = await monitoringService.collectMetrics(String(server._id), 'manual');
        const plainMetric = metric && typeof (metric as any).toObject === 'function'
          ? (metric as any).toObject()
          : metric;
        afterMetrics = metricSnapshot(plainMetric);
      } catch {
        afterMetrics = cleanupSummary?.afterMetrics;
      }

      try {
        const prediction = await agentService.predictMaintenance(String(server._id));
        afterPrediction = predictionSnapshot(prediction);
      } catch {
        afterPrediction = cleanupSummary?.afterPrediction;
      }

      if (cleanupSummary) {
        let verificationScan;
        try {
          verificationScan = await scanService.startScan(String(server._id), undefined, 'manual', {
            includeFullServer: false,
          });
        } catch (error) {
          cleanupSummary.errors = [
            ...(cleanupSummary.errors || []),
            {
              action: 'verification_scan',
              status: 'failed',
              reason:
                error instanceof Error
                  ? error.message
                  : 'Post-remediation verification scan failed.',
            },
          ];
        }
        cleanupSummary.beforePrediction = cleanupSummary.beforePrediction || runtimeContext.beforePrediction;
        cleanupSummary.afterMetrics = afterMetrics || cleanupSummary.afterMetrics;
        cleanupSummary.afterPrediction = afterPrediction || cleanupSummary.afterPrediction;
        cleanupSummary.verification = verificationSummary(
          cleanupSummary.beforeMetrics,
          cleanupSummary.afterMetrics,
          cleanupSummary.beforePrediction,
          cleanupSummary.afterPrediction,
        );
        cleanupSummary.verification.verificationScan = verificationScan
          ? {
              scanId: verificationScan.scanId,
              fileCount: verificationScan.fileCount,
              reviewRequired: verificationScan.reviewRequired,
            }
          : undefined;
        try {
          const finalPrediction = await agentService.predictMaintenance(String(server._id));
          cleanupSummary.afterPrediction = predictionSnapshot(finalPrediction);
          cleanupSummary.verification = verificationSummary(
            cleanupSummary.beforeMetrics,
            cleanupSummary.afterMetrics,
            cleanupSummary.beforePrediction,
            cleanupSummary.afterPrediction,
          );
          cleanupSummary.verification.verificationScan = verificationScan
            ? {
                scanId: verificationScan.scanId,
                fileCount: verificationScan.fileCount,
                reviewRequired: verificationScan.reviewRequired,
              }
            : undefined;
        } catch {
          // Earlier prediction errors are already recorded in the cleanup summary.
        }
        job.executionSummary = toExecutionSummary(cleanupSummary);
      }

      if (cleanupSummary) {
        const cleanupSuccessCount = getCleanupSuccessCount(cleanupSummary);
        const optimizationCount = Number(cleanupSummary.optimizationActions || 0);
        if (cleanupSuccessCount > 0 && cleanupSummary.failedActions > 0) {
          job.status = 'partially_completed';
        } else if (cleanupSuccessCount > 0 || optimizationCount > 0 || cleanupSummary.noSafeFixApplied) {
          job.status = 'completed';
        } else {
          job.status = 'failed';
          job.lastError =
            cleanupSummary.executableCount === 0
              ? 'No safe cleanup candidates were executable for this remediation.'
              : 'Cleanup execution did not complete any server-side action.';
        }
      } else if (fatalStepFailure) {
        job.status = 'failed';
      } else if (hasFailure && hasSuccess) {
        job.status = 'partially_completed';
      } else if (hasFailure) {
        job.status = 'failed';
      } else {
        job.status = 'completed';
      }
      
      job.progressPercent = 100;
      job.currentStep = cleanupSummary?.noSafeFixApplied
        ? `Remediation completed: no safe fix applied`
        : `Remediation ${job.status.replace('_', ' ')}`;
      job.lastProgressAt = new Date();
      job.completedAt = new Date();
      await job.save();

      await alertService.create({
        serverId: String(server._id),
        type: job.status === 'completed' ? 'remediation_completed' : 'remediation_failed',
        severity: job.status === 'completed' ? 'success' : job.status === 'partially_completed' ? 'warning' : 'critical',
        title: `Automated remediation ${job.status.replace('_', ' ')}`,
        message: job.executionSummary
          ? `${job.type} on ${job.target} finished with ${job.executionSummary.filesDeleted || 0} deleted, ${job.executionSummary.filesArchived || 0} archived, and ${job.executionSummary.spaceReclaimedMb || 0} MB reclaimed.`
          : `${job.type} on ${job.target} finished with status: ${job.status.replace('_', ' ')}.`,
        metadata: { jobId: job._id, executionSummary: job.executionSummary },
        email: job.status === 'failed',
      });
    } catch (error: any) {
      job.status = 'failed';
      job.lastError = error.message;
      job.currentStep = 'Remediation failed';
      job.lastProgressAt = new Date();
      job.completedAt = new Date();
      await job.save();

      await alertService.create({
        serverId: String(server._id),
        type: 'remediation_failed',
        severity: 'critical',
        title: 'Automated remediation failed',
        message: `Error during ${job.type}: ${error.message}`,
        metadata: { jobId: job._id },
        email: true,
      });
    }

    this.emitStatusUpdate(job);
    return job;
  },

  async planRemediation(params: {
    serverId: string;
    type: RemediationType;
    target: string;
    description: string;
    incidentId?: string;
    predictionId?: string;
    plannedBy?: string;
  }): Promise<IRemediationJob> {
    const steps: IRemediationStep[] = [];
    const rollbackSteps: IRemediationStep[] = [];

    switch (params.type) {
      case 'restart_service':
        steps.push({
          name: `Restart service ${params.target}`,
          command: `sudo systemctl restart ${shellQuote(params.target)}`,
          status: 'pending',
        });
        rollbackSteps.push({
          name: `Restore service ${params.target} (best effort)`,
          command: `sudo systemctl restart ${shellQuote(params.target)}`,
          status: 'pending',
        });
        break;

      case 'kill_process':
        steps.push({
          name: `Kill process PID ${params.target}`,
          command: `kill -9 ${shellQuote(params.target)}`,
          status: 'pending',
        });
        // Rollback for kill process is hard, maybe restart the service it belongs to?
        // For now, we leave rollbackSteps empty or add a placeholder.
        break;

      case 'clear_cache':
        steps.push({
          name: 'Clear system memory cache',
          command: 'sync; echo 3 | sudo tee /proc/sys/vm/drop_caches',
          status: 'pending',
        });
        break;

      case 'delete_file':
        steps.push({
          name: `Delete file ${params.target}`,
          command: `rm -f -- ${shellQuote(params.target)}`,
          status: 'pending',
        });
        // Could implement a "trash" mechanism for rollback, but for now simple delete.
        break;

      case 'archive_file':
        steps.push(
          await remediationToolsService.compileStep(
            {
              toolName: 'archive_file',
              args: { path: params.target },
              reasoning: `Archive file ${params.target}`,
            },
            params.serverId,
            `Archive file ${params.target}`,
          ),
        );
        break;

      case 'custom_command':
        steps.push({
          name: 'Execute custom command',
          command: params.target, // Be careful here, expect target to be the command string
          status: 'pending',
        });
        break;
    }

    const job = await RemediationJob.create({
      server: new Types.ObjectId(params.serverId),
      type: params.type,
      target: params.target,
      description: params.description,
      status: 'planned',
      planningMode: 'static',
      planner: 'legacy_static_planner',
      decisionTrace: ['Legacy remediation planner selected a static command path.'],
      riskLevel: params.type === 'kill_process' || params.type === 'custom_command' ? 'high' : 'medium',
      requiresApproval: params.type !== 'clear_cache',
      incident: params.incidentId ? new Types.ObjectId(params.incidentId) : undefined,
      prediction: params.predictionId ? new Types.ObjectId(params.predictionId) : undefined,
      steps,
      rollbackSteps,
      plannedBy: params.plannedBy || 'system',
      created: new Date(),
    });

    return job;
  },

  async planRemediationFromIntent(params: {
    serverId: string;
    intent: string;
    description?: string;
    context?: Record<string, unknown>;
    incidentId?: string;
    predictionId?: string;
    plannedBy?: string;
    approvalMode?: 'manual' | 'auto';
  }): Promise<IRemediationJob> {
    const plan = await remediationPlannerService.buildPlan({
      serverId: params.serverId,
      intent: params.intent,
      context: params.context,
      incidentId: params.incidentId,
      predictionId: params.predictionId,
      plannedBy: params.plannedBy,
      approvalMode: params.approvalMode,
    });

    const steps = await Promise.all(
      plan.steps.map((step) =>
        remediationToolsService.compileStep(step, params.serverId, step.reasoning),
      ),
    );
    const rollbackSteps = await Promise.all(
      plan.rollbackSteps.map((step) =>
        remediationToolsService.compileStep(step, params.serverId, step.reasoning),
      ),
    );

    const job = await RemediationJob.create({
      server: new Types.ObjectId(params.serverId),
      type: 'agent_plan',
      target: plan.target,
      description: params.description || plan.description,
      status: plan.requiresApproval ? 'pending_approval' : 'planned',
      planningMode: 'agent',
      planner: plan.planner,
      intent: params.intent,
      planningContext: plan.contextSnapshot,
      reasoningSummary: plan.summary,
      decisionTrace: plan.decisionTrace,
      riskLevel: plan.riskLevel,
      requiresApproval: plan.requiresApproval,
      incident: params.incidentId ? new Types.ObjectId(params.incidentId) : undefined,
      prediction: params.predictionId ? new Types.ObjectId(params.predictionId) : undefined,
      steps,
      rollbackSteps,
      plannedBy: params.plannedBy || 'system',
      created: new Date(),
    });

    return job;
  },

  async executeJob(jobId: string, approvedBy?: string): Promise<IRemediationJob> {
    const { job, server } = await this.prepareJobExecution(jobId, approvedBy);
    return this.runPreparedJob(job, server);
  },

  async startJobExecution(jobId: string, approvedBy?: string): Promise<IRemediationJob> {
    const job = await RemediationJob.findById(jobId);
    if (!job) throw new Error('Remediation job not found');

    if (job.status !== 'planned' && job.status !== 'pending_approval') {
      throw new Error(`Cannot execute job in status: ${job.status}`);
    }

    job.status = 'queued';
    job.approvedBy = approvedBy;
    job.approvedAt = new Date();
    job.progressPercent = 0;
    job.currentStep = 'Queued for remediation analysis';
    job.lastProgressAt = new Date();
    await job.save();
    this.emitStatusUpdate(job);

    setImmediate(() => {
      void (async () => {
        const prepared = await this.prepareJobExecution(jobId, approvedBy);
        await this.runPreparedJob(prepared.job, prepared.server);
      })().catch(async (error: any) => {
        const failedJob = await RemediationJob.findById(jobId);
        if (!failedJob) return;
        failedJob.status = 'failed';
        failedJob.lastError = error?.message || 'Remediation execution failed unexpectedly.';
        failedJob.currentStep = 'Remediation failed';
        failedJob.completedAt = new Date();
        await failedJob.save();
        this.emitStatusUpdate(failedJob);
      });
    });

    return job;
  },

  async rollbackJob(jobId: string, user: string): Promise<IRemediationJob> {
    const job = await RemediationJob.findById(jobId);
    if (!job) throw new Error('Job not found');

    if (job.status !== 'completed' && job.status !== 'failed') {
      throw new Error(`Cannot rollback job in status: ${job.status}`);
    }

    const server = await ServerConnection.findById(job.server);
    if (!server) throw new Error('Server not found');

    job.status = 'running';
    await job.save();

    try {
      const runtimeContext: Record<string, unknown> = {};

      for (const step of job.rollbackSteps) {
        step.status = 'running';
        step.startedAt = new Date();
        await job.save();

        if (step.command || step.toolName) {
          const result = await remediationToolsService.executeStep(server, step, runtimeContext);
          step.output = result.stdout;
          step.error = result.stderr;
          step.status = result.code === 0 ? 'completed' : 'failed';
        } else {
          step.status = 'completed';
        }

        step.completedAt = new Date();
        await job.save();
      }

      job.status = 'rolled_back';
      await job.save();

    } catch (error: any) {
      job.status = 'failed';
      job.lastError = `Rollback failed: ${error.message}`;
      await job.save();
    }

    this.emitStatusUpdate(job);
    return job;
  },

  async listJobs(serverId?: string, limit = 50): Promise<any[]> {
    const query = serverId ? { server: new Types.ObjectId(serverId) } : {};
    const jobs = await RemediationJob.find(query).sort({ created: -1 }).limit(limit).lean();
    return jobs.map(compactRemediationJobForList);
  },

  async cancelJob(jobId: string): Promise<IRemediationJob> {
    const job = await RemediationJob.findById(jobId);
    if (!job) throw new Error('Job not found');
    if (job.status !== 'planned' && job.status !== 'pending_approval' && job.status !== 'queued') {
      throw new Error(`Cannot cancel job in status: ${job.status}`);
    }
    job.status = 'cancelled';
    await job.save();
    this.emitStatusUpdate(job);
    return job;
  },

  async performHealthCheck(server: any): Promise<{ status: 'passed' | 'failed'; results: any; timestamp: Date }> {
    try {
      const result = await sshService.execute(server, 'uptime && free -m && df -h /');
      return {
        status: result.code === 0 ? 'passed' : 'failed',
        results: {
          uptime: result.stdout.split('\n')[0],
          raw: result.stdout,
        },
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        status: 'failed',
        results: { error: err.message },
        timestamp: new Date(),
      };
    }
  },

  emitStatusUpdate(job: IRemediationJob) {
    socketService.emitToServer(String(job.server), 'remediation:status', {
      jobId: job._id,
      status: job.status,
      type: job.type,
      target: job.target,
      progressPercent: job.progressPercent,
      currentStep: job.currentStep,
      executionSummary: job.executionSummary,
      updated: job.updated,
    });
  }
};
