import { envConfig } from '../../../config/env.config';
import { ClientSession } from 'mongoose';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { createRcmLogTimer, logRcmEvent } from '../../../utils/hipaa-logger.util';
import { IRcmBackgroundJob, RcmBackgroundJob, RcmBackgroundJobType } from './background-job.model';
import { enqueueDistributedQueueMirror, getDistributedQueueAdapterStatus } from './rcm-distributed-queue.adapter';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { auditLogService } from '../audit-log/audit-log.service';

type RcmQueueJobHandler = (job: IRcmBackgroundJob) => Promise<void>;
type RcmQueueDriverName = 'mongo' | 'bullmq' | 'sqs' | 'memory';

type EnqueueRcmJobInput = {
  jobType: RcmBackgroundJobType;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
  createdBy?: string;
  session?: ClientSession;
};

const handlers = new Map<RcmBackgroundJobType, RcmQueueJobHandler>();
let workerTimer: NodeJS.Timeout | undefined;
let workerRunning = false;
let workerLastRunAt: Date | undefined;
let workerLastError: string | undefined;

function hourlyIdempotencyBucket(date = new Date()) {
  return date.toISOString().slice(0, 13);
}

function normalizeQueueDriver(value = envConfig.rcmQueueDriver): RcmQueueDriverName {
  const driver = value.trim().toLowerCase();
  if (driver === 'database') return 'mongo';
  if (driver === 'bullmq' || driver === 'sqs' || driver === 'memory') return driver;
  return 'mongo';
}

function hasOptionalPackage(packageName: string) {
  try {
    // Keep BullMQ/SQS optional so demo installs do not break until the driver is selected.
    const dynamicRequire = eval('require') as NodeRequire;
    dynamicRequire.resolve(packageName);
    return true;
  } catch {
    return false;
  }
}

function calculateNextRunAt(attempts: number) {
  const exponentialDelay = envConfig.rcmQueueRetryBaseMs * (2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + Math.min(envConfig.rcmQueueRetryMaxMs, exponentialDelay));
}

function isMemoryFallbackAllowed() {
  return envConfig.nodeEnv.trim().toLowerCase() !== 'production';
}

function assertQueueDriverAllowed() {
  const driver = normalizeQueueDriver();
  if (driver === 'memory' && !isMemoryFallbackAllowed()) {
    throw new AppError('RCM_QUEUE_DRIVER=memory is not allowed in production.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
  if (driver === 'bullmq' && (!envConfig.redisUrl.trim() && !envConfig.rcmRedisUrl.trim())) {
    throw new AppError('REDIS_URL or RCM_REDIS_URL is required when RCM_QUEUE_DRIVER=bullmq.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

async function markDeadLetter(job: IRcmBackgroundJob, message: string) {
  job.status = 'DEAD_LETTER';
  job.lastError = message;
  job.completedAt = new Date();
  job.updated = new Date();
  await job.save();
}

function publishQueueJobStatus(job: IRcmBackgroundJob, title: string, message?: string) {
  publishRcmRealtimeEvent({
    eventType: 'QUEUE_JOB_STATUS_CHANGED',
    title,
    message,
    entityType: 'rcmBackgroundJob',
    entityId: String(job._id),
    status: job.status,
  });
}

export function registerRcmJobHandler(jobType: RcmBackgroundJobType, handler: RcmQueueJobHandler) {
  handlers.set(jobType, handler);
}

export async function enqueueRcmJob(input: EnqueueRcmJobInput) {
  assertQueueDriverAllowed();

  const existingJob = await RcmBackgroundJob.findOne({
    idempotencyKey: input.idempotencyKey,
    isDeleted: false,
  }).session(input.session ?? null);

  if (existingJob) {
    // logger.debug(`[RCM Queue] Duplicate job ignored idempotencyKey=${input.idempotencyKey} jobType=${input.jobType}`);
    return { job: existingJob, duplicate: true };
  }

  const [job] = await RcmBackgroundJob.create([
    {
      jobType: input.jobType,
      status: 'QUEUED',
      idempotencyKey: input.idempotencyKey,
      payload: input.payload,
      maxAttempts: input.maxAttempts ?? envConfig.rcmQueueMaxAttempts,
      nextRunAt: new Date(),
      active: true,
      created: new Date(),
      updated: new Date(),
      createdBy: input.createdBy,
    },
  ], { session: input.session });

  await auditLogService.record({
    entityType: 'system',
    entityId: job._id,
    action: 'QUEUE_JOB_CREATED',
    userId: input.createdBy,
    changedBy: input.createdBy,
    source: 'rcmQueue',
    correlationId: input.idempotencyKey,
    reason: `${input.jobType} queued.`,
    newState: { jobType: job.jobType, status: job.status, maxAttempts: job.maxAttempts },
    session: input.session,
  });

  const driver = normalizeQueueDriver();
  if (driver === 'bullmq' || driver === 'sqs') {
    await enqueueDistributedQueueMirror(job);
    logRcmEvent({
      module: 'rcm.queue',
      eventType: 'ENQUEUE_EXTERNAL_DRIVER_MIRROR',
      status: 'SUCCEEDED',
      correlationId: input.idempotencyKey,
      metadata: {
        driver,
        jobId: String(job._id),
        queueMirror: 'mongo',
      },
    });
  }

  if (envConfig.rcmQueueWorkerEnabled && driver === 'memory') {
    setImmediate(() => {
      void processRcmJob(String(job._id), input.createdBy ?? 'rcm-memory-queue');
    });
  }

  return { job, duplicate: false };
}

export async function processRcmJob(jobId: string, updatedBy = 'rcm-queue-worker') {
  assertQueueDriverAllowed();

  const job = await RcmBackgroundJob.findOneAndUpdate({
    _id: jobId,
    isDeleted: false,
    status: { $in: ['QUEUED', 'FAILED'] },
  }, {
    $set: {
      status: 'RUNNING',
      startedAt: new Date(),
      updated: new Date(),
      updatedBy,
    },
    $inc: { attempts: 1 },
  }, { new: true });

  if (!job) {
    return null;
  }

  const handler = handlers.get(job.jobType);
  if (!handler) {
    await markDeadLetter(job, `No RCM queue handler registered for ${job.jobType}.`);
    return job;
  }

  const duration = createRcmLogTimer();

  logRcmEvent({
    module: 'rcm.queue',
    eventType: job.jobType,
    status: 'STARTED',
    correlationId: job.idempotencyKey,
    metadata: {
      jobId: String(job._id),
      attempts: job.attempts,
    },
  });
  publishQueueJobStatus(job, 'RCM queue job started', `${job.jobType} started.`);

  try {
    await handler(job);
    job.status = 'SUCCEEDED';
    job.completedAt = new Date();
    job.lastError = undefined;
    job.updated = new Date();
    job.updatedBy = updatedBy;
    await job.save();
    publishQueueJobStatus(job, 'RCM queue job completed', `${job.jobType} completed.`);

    logRcmEvent({
      module: 'rcm.queue',
      eventType: job.jobType,
      status: 'SUCCEEDED',
      correlationId: job.idempotencyKey,
      durationMs: duration(),
      metadata: { jobId: String(job._id) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown RCM queue job error.';
    const exhausted = job.attempts >= job.maxAttempts;
    job.status = exhausted ? 'DEAD_LETTER' : 'FAILED';
    job.lastError = message;
    job.nextRunAt = exhausted ? undefined : calculateNextRunAt(job.attempts);
    job.completedAt = exhausted ? new Date() : undefined;
    job.updated = new Date();
    job.updatedBy = updatedBy;
    await job.save();
    publishQueueJobStatus(
      job,
      exhausted ? 'RCM queue job dead-lettered' : 'RCM queue job failed',
      message,
    );

    logRcmEvent({
      module: 'rcm.queue',
      eventType: job.jobType,
      status: 'FAILED',
      correlationId: job.idempotencyKey,
      durationMs: duration(),
      errorCode: exhausted ? 'RCM_QUEUE_DEAD_LETTER' : 'RCM_QUEUE_RETRY_SCHEDULED',
      message,
      metadata: {
        jobId: String(job._id),
        attempts: job.attempts,
        nextRunAt: job.nextRunAt,
      },
    });
  }

  return job;
}

async function claimNextDueRcmJob(updatedBy = 'rcm-queue-worker') {
  const now = new Date();
  return RcmBackgroundJob.findOneAndUpdate(
    {
      isDeleted: false,
      active: true,
      status: { $in: ['QUEUED', 'FAILED'] },
      nextRunAt: { $lte: now },
    },
    {
      $set: {
        status: 'RUNNING',
        startedAt: now,
        updated: now,
        updatedBy,
      },
      $inc: { attempts: 1 },
    },
    {
      new: true,
      sort: { nextRunAt: 1, created: 1 },
    },
  );
}

async function runClaimedRcmJob(job: IRcmBackgroundJob, updatedBy = 'rcm-queue-worker') {
  const handler = handlers.get(job.jobType);
  if (!handler) {
    await markDeadLetter(job, `No RCM queue handler registered for ${job.jobType}.`);
    publishQueueJobStatus(job, 'RCM queue job dead-lettered', `No handler registered for ${job.jobType}.`);
    await auditLogService.record({
      entityType: 'system',
      entityId: job._id,
      action: 'QUEUE_JOB_DEAD_LETTERED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'rcmQueue',
      correlationId: job.idempotencyKey,
      reason: `No RCM queue handler registered for ${job.jobType}.`,
      newState: { jobType: job.jobType, status: job.status },
    });
    return job;
  }

  const duration = createRcmLogTimer();
  logRcmEvent({
    module: 'rcm.queue',
    eventType: job.jobType,
    status: 'STARTED',
    correlationId: job.idempotencyKey,
    metadata: {
      jobId: String(job._id),
      attempts: job.attempts,
    },
  });
  publishQueueJobStatus(job, 'RCM queue job started', `${job.jobType} started.`);
  await auditLogService.record({
    entityType: 'system',
    entityId: job._id,
    action: 'QUEUE_JOB_STARTED',
    userId: updatedBy,
    changedBy: updatedBy,
    source: 'rcmQueue',
    correlationId: job.idempotencyKey,
    newState: { jobType: job.jobType, status: job.status, attempts: job.attempts },
  });

  try {
    await handler(job);
    job.status = 'SUCCEEDED';
    job.completedAt = new Date();
    job.lastError = undefined;
    job.updated = new Date();
    job.updatedBy = updatedBy;
    await job.save();
    publishQueueJobStatus(job, 'RCM queue job completed', `${job.jobType} completed.`);
    await auditLogService.record({
      entityType: 'system',
      entityId: job._id,
      action: 'QUEUE_JOB_COMPLETED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'rcmQueue',
      correlationId: job.idempotencyKey,
      newState: { jobType: job.jobType, status: job.status, attempts: job.attempts },
    });
    logRcmEvent({
      module: 'rcm.queue',
      eventType: job.jobType,
      status: 'SUCCEEDED',
      correlationId: job.idempotencyKey,
      durationMs: duration(),
      metadata: { jobId: String(job._id) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown RCM queue job error.';
    const exhausted = job.attempts >= job.maxAttempts;
    job.status = exhausted ? 'DEAD_LETTER' : 'FAILED';
    job.lastError = message;
    job.nextRunAt = exhausted ? undefined : calculateNextRunAt(job.attempts);
    job.completedAt = exhausted ? new Date() : undefined;
    job.updated = new Date();
    job.updatedBy = updatedBy;
    await job.save();
    publishQueueJobStatus(job, exhausted ? 'RCM queue job dead-lettered' : 'RCM queue job failed', message);
    await auditLogService.record({
      entityType: 'system',
      entityId: job._id,
      action: exhausted ? 'QUEUE_JOB_DEAD_LETTERED' : 'QUEUE_JOB_RETRIED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'rcmQueue',
      correlationId: job.idempotencyKey,
      reason: message,
      newState: { jobType: job.jobType, status: job.status, attempts: job.attempts, nextRunAt: job.nextRunAt },
    });
    logRcmEvent({
      module: 'rcm.queue',
      eventType: job.jobType,
      status: 'FAILED',
      correlationId: job.idempotencyKey,
      durationMs: duration(),
      errorCode: exhausted ? 'RCM_QUEUE_DEAD_LETTER' : 'RCM_QUEUE_RETRY_SCHEDULED',
      message,
      metadata: {
        jobId: String(job._id),
        attempts: job.attempts,
        nextRunAt: job.nextRunAt,
      },
    });
  }

  return job;
}

export async function retryRcmJob(jobId: string, updatedBy = 'rcm-queue-worker') {
  const job = await RcmBackgroundJob.findOne({ _id: jobId, isDeleted: false });
  if (!job) return null;
  if (job.status === 'SUCCEEDED') return job;
  job.status = 'QUEUED';
  job.lastError = undefined;
  job.nextRunAt = new Date();
  job.completedAt = undefined;
  job.updated = new Date();
  job.updatedBy = updatedBy;
  await job.save();
  return job;
}

export async function markRcmJobComplete(jobId: string, updatedBy = 'rcm-queue-worker') {
  return RcmBackgroundJob.findOneAndUpdate(
    { _id: jobId, isDeleted: false },
    {
      status: 'SUCCEEDED',
      completedAt: new Date(),
      updated: new Date(),
      updatedBy,
    },
    { new: true }
  );
}

export async function markRcmJobFailed(jobId: string, message: string, updatedBy = 'rcm-queue-worker') {
  const job = await RcmBackgroundJob.findOne({ _id: jobId, isDeleted: false });
  if (!job) return null;
  job.status = job.attempts >= job.maxAttempts ? 'DEAD_LETTER' : 'FAILED';
  job.lastError = message;
  job.nextRunAt = job.status === 'FAILED' ? calculateNextRunAt(job.attempts) : undefined;
  job.completedAt = job.status === 'DEAD_LETTER' ? new Date() : undefined;
  job.updated = new Date();
  job.updatedBy = updatedBy;
  await job.save();
  return job;
}

export async function moveRcmJobToDeadLetter(jobId: string, message: string, updatedBy = 'rcm-queue-worker') {
  const job = await RcmBackgroundJob.findOne({ _id: jobId, isDeleted: false });
  if (!job) return null;
  job.status = 'DEAD_LETTER';
  job.lastError = message;
  job.completedAt = new Date();
  job.updated = new Date();
  job.updatedBy = updatedBy;
  await job.save();
  return job;
}

export async function replayRcmJob(jobId: string, updatedBy = 'rcm-queue-worker') {
  const job = await retryRcmJob(jobId, updatedBy);
  if (!job) return null;
  return processRcmJob(String(job._id), updatedBy);
}

export async function processDueRcmJobs(limit = 10, updatedBy = 'rcm-queue-worker') {
  assertQueueDriverAllowed();

  let processedCount = 0;

  for (let index = 0; index < limit; index += 1) {
    const job = await claimNextDueRcmJob(updatedBy);
    if (!job) {
      break;
    }
    await runClaimedRcmJob(job, updatedBy);
    processedCount += 1;
  }

  return processedCount;
}

async function runWorkerTick() {
  if (workerRunning) {
    return;
  }

  workerRunning = true;
  workerLastRunAt = new Date();

  try {
    await recoverStaleRunningRcmJobs('rcm-mongo-queue-worker');
    await enqueueRcmJob({
      jobType: 'CHECK_AWAITING_ERA_AGING',
      idempotencyKey: `awaiting-era-aging:${hourlyIdempotencyBucket()}`,
      payload: { scheduledAt: new Date().toISOString() },
      maxAttempts: 1,
      createdBy: 'rcm-mongo-queue-worker',
    });
    await enqueueRcmJob({
      jobType: 'CHECK_DENIAL_SLA_AGING',
      idempotencyKey: `denial-sla-aging:${hourlyIdempotencyBucket()}`,
      payload: { scheduledAt: new Date().toISOString() },
      maxAttempts: 1,
      createdBy: 'rcm-mongo-queue-worker',
    });
    await enqueueRcmJob({
      jobType: 'CHECK_APPEAL_SLA_AGING',
      idempotencyKey: `appeal-sla-aging:${hourlyIdempotencyBucket()}`,
      payload: { scheduledAt: new Date().toISOString() },
      maxAttempts: 1,
      createdBy: 'rcm-mongo-queue-worker',
    });
    await enqueueRcmJob({
      jobType: 'CHECK_CORRECTED_CLAIM_AGING',
      idempotencyKey: `corrected-claim-aging:${hourlyIdempotencyBucket()}`,
      payload: { scheduledAt: new Date().toISOString() },
      maxAttempts: 1,
      createdBy: 'rcm-mongo-queue-worker',
    });
    await processDueRcmJobs(envConfig.rcmQueueConcurrency, 'rcm-mongo-queue-worker');
    workerLastError = undefined;
  } catch (error) {
    workerLastError = error instanceof Error ? error.message : 'Unknown RCM queue worker error.';
    logRcmEvent({
      module: 'rcm.queueWorker',
      eventType: 'MONGO_QUEUE_WORKER_TICK',
      status: 'FAILED',
      errorCode: 'RCM_QUEUE_WORKER_FAILED',
      message: workerLastError,
    });
  } finally {
    workerRunning = false;
  }
}

export function startMongoRcmQueueWorker() {
  const driver = normalizeQueueDriver();
  if (!envConfig.rcmQueueWorkerEnabled || driver !== 'mongo') {
    return false;
  }

  if (workerTimer) {
    return true;
  }

  workerTimer = setInterval(() => {
    void runWorkerTick();
  }, envConfig.rcmQueueWorkerIntervalMs);
  workerTimer.unref?.();
  void runWorkerTick();

  publishRcmRealtimeEvent({
    eventType: 'QUEUE_WORKER_STATUS_CHANGED',
    title: 'RCM Mongo queue worker started',
    entityType: 'rcmQueueWorker',
    status: 'RUNNING',
  });

  return true;
}

export function stopMongoRcmQueueWorker() {
  if (!workerTimer) {
    return false;
  }

  clearInterval(workerTimer);
  workerTimer = undefined;
  publishRcmRealtimeEvent({
    eventType: 'QUEUE_WORKER_STATUS_CHANGED',
    title: 'RCM Mongo queue worker stopped',
    entityType: 'rcmQueueWorker',
    status: 'STOPPED',
  });
  return true;
}

export function getMongoRcmQueueWorkerState() {
  return {
    running: Boolean(workerTimer),
    processing: workerRunning,
    lastRunAt: workerLastRunAt,
    lastError: workerLastError,
    intervalMs: envConfig.rcmQueueWorkerIntervalMs,
  };
}

export function validateRcmQueueStartupConfig() {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeEnv = envConfig.nodeEnv.trim().toLowerCase();
  const driver = normalizeQueueDriver();

  if (!['mongo', 'bullmq', 'sqs', 'memory'].includes(driver)) {
    errors.push('RCM_QUEUE_DRIVER must be mongo, bullmq, sqs, or memory.');
  }

  if (nodeEnv === 'production' && driver === 'memory') {
    errors.push('RCM_QUEUE_DRIVER=memory is not allowed in production.');
  }

  if (nodeEnv === 'production' && driver === 'mongo') {
    warnings.push('RCM_QUEUE_DRIVER=mongo is durable but not a true distributed queue; use bullmq or sqs for multi-instance production.');
  }

  if (driver === 'bullmq') {
    const redisUrl = envConfig.redisUrl.trim() || envConfig.rcmRedisUrl.trim();
    if (!redisUrl) {
      errors.push('REDIS_URL or RCM_REDIS_URL is required when RCM_QUEUE_DRIVER=bullmq.');
    }
    if (!hasOptionalPackage('bullmq')) {
      warnings.push('RCM_QUEUE_DRIVER=bullmq selected, but bullmq is not installed in this package. Install bullmq and ioredis before enabling this driver.');
    }
  }

  if (driver === 'sqs' && !hasOptionalPackage('@aws-sdk/client-sqs')) {
    warnings.push('RCM_QUEUE_DRIVER=sqs selected, but @aws-sdk/client-sqs is not installed in this package.');
  }

  if (driver === 'memory') {
    warnings.push('RCM queue is using the in-memory worker fallback. Use database/BullMQ-style durable processing outside demo mode.');
  }

  return { errors, warnings };
}

export async function getRcmQueueHealth() {
  const driver = normalizeQueueDriver();
  const [queued, failed, deadLetter, running, stale, recovered] = await Promise.all([
    RcmBackgroundJob.countDocuments({ isDeleted: false, status: 'QUEUED' }),
    RcmBackgroundJob.countDocuments({ isDeleted: false, status: 'FAILED' }),
    RcmBackgroundJob.countDocuments({ isDeleted: false, status: 'DEAD_LETTER' }),
    RcmBackgroundJob.countDocuments({ isDeleted: false, status: 'RUNNING' }),
    RcmBackgroundJob.countDocuments({ isDeleted: false, status: 'STALE' }),
    RcmBackgroundJob.countDocuments({ isDeleted: false, recoveredAt: { $exists: true } }),
  ]);

  return {
    workerEnabled: envConfig.rcmQueueWorkerEnabled,
    concurrency: envConfig.rcmQueueConcurrency,
    worker: getMongoRcmQueueWorkerState(),
    queued,
    failed,
    deadLetter,
    running,
    stale,
    recovered,
    ...getDistributedQueueAdapterStatus(),
  };
}

export async function recoverStaleRunningRcmJobs(updatedBy = 'rcm-queue-worker') {
  const staleCutoff = new Date(Date.now() - envConfig.rcmQueueStaleRunningThresholdMs);
  const staleJobs = await RcmBackgroundJob.find({
    isDeleted: false,
    active: true,
    status: 'RUNNING',
    startedAt: { $lte: staleCutoff },
  }).limit(envConfig.rcmQueueConcurrency);
  let recoveredCount = 0;
  let deadLetterCount = 0;

  for (const job of staleJobs) {
    job.staleAt = new Date();
    job.recoveryAttemptCount = (job.recoveryAttemptCount ?? 0) + 1;
    job.lastError = `RUNNING job exceeded stale threshold of ${envConfig.rcmQueueStaleRunningThresholdMs}ms.`;

    if (job.attempts >= job.maxAttempts) {
      job.status = 'DEAD_LETTER';
      job.completedAt = new Date();
      deadLetterCount += 1;
    } else {
      job.status = 'FAILED';
      job.nextRunAt = new Date();
      job.recoveredAt = new Date();
      recoveredCount += 1;
    }

    job.updated = new Date();
    job.updatedBy = updatedBy;
    await job.save();
    publishQueueJobStatus(
      job,
      job.status === 'DEAD_LETTER' ? 'Stale RCM job dead-lettered' : 'Stale RCM job recovered',
      job.lastError,
    );
    await auditLogService.record({
      entityType: 'system',
      entityId: job._id,
      action: job.status === 'DEAD_LETTER' ? 'QUEUE_JOB_DEAD_LETTERED' : 'QUEUE_STALE_JOB_RECOVERED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'rcmQueue',
      correlationId: job.idempotencyKey,
      reason: job.lastError,
      newState: { jobType: job.jobType, status: job.status, attempts: job.attempts },
    });
  }

  if (staleJobs.length) {
    publishRcmRealtimeEvent({
      eventType: 'QUEUE_STALE_JOBS_RECOVERED',
      title: 'Stale RCM queue jobs recovered',
      message: `${recoveredCount} recovered, ${deadLetterCount} dead-lettered.`,
      entityType: 'rcmQueueWorker',
      status: recoveredCount > 0 ? 'RECOVERED' : 'DEAD_LETTER',
    });
  }

  return { scanned: staleJobs.length, recovered: recoveredCount, deadLetter: deadLetterCount };
}
