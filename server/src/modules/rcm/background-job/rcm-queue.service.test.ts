import { envConfig } from '../../../config/env.config';
import { RcmBackgroundJob } from './background-job.model';
import {
  enqueueRcmJob,
  getMongoRcmQueueWorkerState,
  processDueRcmJobs,
  recoverStaleRunningRcmJobs,
  registerRcmJobHandler,
  startMongoRcmQueueWorker,
  stopMongoRcmQueueWorker,
  validateRcmQueueStartupConfig,
} from './rcm-queue.service';
import { auditLogService } from '../audit-log/audit-log.service';

describe('validateRcmQueueStartupConfig', () => {
  const originalNodeEnv = envConfig.nodeEnv;
  const originalDriver = envConfig.rcmQueueDriver;
  const originalRedisUrl = envConfig.redisUrl;
  const originalRcmRedisUrl = envConfig.rcmRedisUrl;
  const originalWorkerEnabled = envConfig.rcmQueueWorkerEnabled;
  const originalConcurrency = envConfig.rcmQueueConcurrency;

  afterEach(() => {
    (envConfig as any).nodeEnv = originalNodeEnv;
    (envConfig as any).rcmQueueDriver = originalDriver;
    (envConfig as any).redisUrl = originalRedisUrl;
    (envConfig as any).rcmRedisUrl = originalRcmRedisUrl;
    (envConfig as any).rcmQueueWorkerEnabled = originalWorkerEnabled;
    (envConfig as any).rcmQueueConcurrency = originalConcurrency;
    stopMongoRcmQueueWorker();
    jest.restoreAllMocks();
  });

  it('blocks memory queue in production', () => {
    (envConfig as any).nodeEnv = 'production';
    (envConfig as any).rcmQueueDriver = 'memory';

    expect(validateRcmQueueStartupConfig().errors).toEqual(
      expect.arrayContaining(['RCM_QUEUE_DRIVER=memory is not allowed in production.']),
    );
  });

  it('requires Redis URL for BullMQ driver', () => {
    (envConfig as any).nodeEnv = 'production';
    (envConfig as any).rcmQueueDriver = 'bullmq';
    (envConfig as any).redisUrl = '';
    (envConfig as any).rcmRedisUrl = '';

    expect(validateRcmQueueStartupConfig().errors).toEqual(
      expect.arrayContaining(['REDIS_URL or RCM_REDIS_URL is required when RCM_QUEUE_DRIVER=bullmq.']),
    );
  });

  it('warns when production uses Mongo queue driver', () => {
    (envConfig as any).nodeEnv = 'production';
    (envConfig as any).rcmQueueDriver = 'mongo';

    expect(validateRcmQueueStartupConfig().warnings).toEqual(
      expect.arrayContaining(['RCM_QUEUE_DRIVER=mongo is durable but not a true distributed queue; use bullmq or sqs for multi-instance production.']),
    );
  });
});

describe('Mongo RCM queue worker', () => {
  const originalDriver = envConfig.rcmQueueDriver;
  const originalWorkerEnabled = envConfig.rcmQueueWorkerEnabled;
  const originalConcurrency = envConfig.rcmQueueConcurrency;

  function createMockJob(overrides: Record<string, unknown> = {}) {
    return {
      _id: 'job-1',
      jobType: 'CLAIM_STATUS_POLL',
      idempotencyKey: 'claim-status:1',
      status: 'RUNNING',
      attempts: 1,
      maxAttempts: 3,
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    } as any;
  }

  afterEach(() => {
    (envConfig as any).rcmQueueDriver = originalDriver;
    (envConfig as any).rcmQueueWorkerEnabled = originalWorkerEnabled;
    (envConfig as any).rcmQueueConcurrency = originalConcurrency;
    stopMongoRcmQueueWorker();
    jest.restoreAllMocks();
  });

  it('processes a queued Mongo job and marks it succeeded', async () => {
    (envConfig as any).rcmQueueDriver = 'mongo';
    const job = createMockJob();
    const handler = jest.fn().mockResolvedValue(undefined);
    registerRcmJobHandler('CLAIM_STATUS_POLL', handler);
    jest.spyOn(RcmBackgroundJob, 'findOneAndUpdate')
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce(null);

    const count = await processDueRcmJobs(2);

    expect(count).toBe(1);
    expect(handler).toHaveBeenCalledWith(job);
    expect(job.status).toBe('SUCCEEDED');
    expect(job.save).toHaveBeenCalled();
  });

  it('schedules retry for failed jobs before max attempts', async () => {
    (envConfig as any).rcmQueueDriver = 'mongo';
    const job = createMockJob({ attempts: 1, maxAttempts: 2 });
    registerRcmJobHandler('CLAIM_STATUS_POLL', jest.fn().mockRejectedValue(new Error('temporary failure')));
    jest.spyOn(RcmBackgroundJob, 'findOneAndUpdate')
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce(null);

    const count = await processDueRcmJobs(2);

    expect(count).toBe(1);
    expect(job.status).toBe('FAILED');
    expect(job.lastError).toBe('temporary failure');
    expect(job.nextRunAt).toBeInstanceOf(Date);
  });

  it('does not claim dead-letter jobs', async () => {
    (envConfig as any).rcmQueueDriver = 'mongo';
    const findSpy = jest.spyOn(RcmBackgroundJob, 'findOneAndUpdate').mockResolvedValueOnce(null);

    const count = await processDueRcmJobs(1);

    expect(count).toBe(0);
    expect(findSpy.mock.calls[0][0]).toMatchObject({
      status: { $in: ['QUEUED', 'FAILED'] },
    });
  });

  it('does not write duplicate ignored queue jobs into user-facing audit logs', async () => {
    (envConfig as any).rcmQueueDriver = 'mongo';
    const existingJob = createMockJob({ _id: 'job-existing', status: 'QUEUED' });
    jest.spyOn(RcmBackgroundJob, 'findOne').mockReturnValue({
      session: jest.fn().mockResolvedValue(existingJob),
    } as any);
    const recordSpy = jest.spyOn(auditLogService, 'record');

    const result = await enqueueRcmJob({
      jobType: 'CLAIM_STATUS_POLL',
      idempotencyKey: 'claim-status:duplicate',
      createdBy: 'user-1',
    });

    expect(result.duplicate).toBe(true);
    expect(recordSpy).not.toHaveBeenCalledWith(expect.objectContaining({
      action: 'QUEUE_JOB_DUPLICATE_IGNORED',
    }));
  });

  it('starts and stops the Mongo queue worker when enabled', async () => {
    (envConfig as any).rcmQueueDriver = 'mongo';
    (envConfig as any).rcmQueueWorkerEnabled = true;
    (envConfig as any).rcmQueueConcurrency = 1;
    jest.spyOn(RcmBackgroundJob, 'findOneAndUpdate').mockResolvedValue(null);
    jest.spyOn(RcmBackgroundJob, 'find').mockReturnValue({
      limit: jest.fn().mockResolvedValue([]),
    } as any);
    jest.spyOn(RcmBackgroundJob, 'findOne').mockReturnValue({
      session: jest.fn().mockResolvedValue(null),
    } as any);
    jest.spyOn(RcmBackgroundJob, 'create').mockResolvedValue([createMockJob({
      _id: 'aging-job-1',
      jobType: 'CHECK_AWAITING_ERA_AGING',
      idempotencyKey: 'awaiting-era-aging:test',
    })] as any);

    expect(startMongoRcmQueueWorker()).toBe(true);
    expect(getMongoRcmQueueWorkerState().running).toBe(true);
    await new Promise((resolve) => setImmediate(resolve));
    expect(stopMongoRcmQueueWorker()).toBe(true);
    expect(getMongoRcmQueueWorkerState().running).toBe(false);
  });

  it('does not start the Mongo worker when disabled', () => {
    (envConfig as any).rcmQueueDriver = 'mongo';
    (envConfig as any).rcmQueueWorkerEnabled = false;

    expect(startMongoRcmQueueWorker()).toBe(false);
    expect(getMongoRcmQueueWorkerState().running).toBe(false);
  });

  it('recovers stale RUNNING jobs for retry', async () => {
    const job = createMockJob({
      _id: 'stale-job-1',
      jobType: 'CLAIM_STATUS_POLL',
      status: 'RUNNING',
      attempts: 1,
      maxAttempts: 3,
      startedAt: new Date(Date.now() - 60_000),
    });
    jest.spyOn(RcmBackgroundJob, 'find').mockReturnValue({
      limit: jest.fn().mockResolvedValue([job]),
    } as any);

    const result = await recoverStaleRunningRcmJobs('queue-recovery');

    expect(result.recovered).toBe(1);
    expect(job.status).toBe('FAILED');
    expect(job.recoveryAttemptCount).toBe(1);
    expect(job.recoveredAt).toBeInstanceOf(Date);
    expect(job.save).toHaveBeenCalled();
  });
});
