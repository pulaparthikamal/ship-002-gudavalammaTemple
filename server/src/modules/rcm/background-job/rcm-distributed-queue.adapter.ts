import { envConfig } from '../../../config/env.config';
import { IRcmBackgroundJob } from './background-job.model';

function dynamicRequire(packageName: string): any {
  const requireFn = eval('require') as NodeRequire;
  return requireFn(packageName);
}

function optionalRequire(packageName: string): any | undefined {
  try {
    return dynamicRequire(packageName);
  } catch {
    return undefined;
  }
}

function redisConnectionOptions() {
  const redisUrl = envConfig.redisUrl.trim() || envConfig.rcmRedisUrl.trim();
  const parsed = new URL(redisUrl);

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname ? Number(parsed.pathname.replace('/', '') || '0') : 0,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}

let bullMqQueue: any | undefined;

function getBullMqQueue() {
  if (bullMqQueue) return bullMqQueue;

  const bullmq = optionalRequire('bullmq');
  if (!bullmq?.Queue) {
    throw new Error('BullMQ package is not installed. Install bullmq before using RCM_QUEUE_DRIVER=bullmq.');
  }

  bullMqQueue = new bullmq.Queue('rcm-jobs', {
    connection: redisConnectionOptions(),
    defaultJobOptions: {
      attempts: envConfig.rcmQueueMaxAttempts,
      backoff: {
        type: 'exponential',
        delay: envConfig.rcmQueueRetryBaseMs,
      },
      removeOnComplete: 1000,
      removeOnFail: false,
    },
  });

  return bullMqQueue;
}

export async function enqueueDistributedQueueMirror(job: IRcmBackgroundJob) {
  const driver = envConfig.rcmQueueDriver.trim().toLowerCase();

  if (driver === 'bullmq') {
    const queue = getBullMqQueue();
    await queue.add(
      job.jobType,
      {
        mongoJobId: String(job._id),
        idempotencyKey: job.idempotencyKey,
      },
      {
        jobId: job.idempotencyKey,
        attempts: job.maxAttempts,
        backoff: {
          type: 'exponential',
          delay: envConfig.rcmQueueRetryBaseMs,
        },
      },
    );
  }
}

export function getDistributedQueueAdapterStatus() {
  const driver = envConfig.rcmQueueDriver.trim().toLowerCase();
  return {
    driver,
    bullmqInstalled: Boolean(optionalRequire('bullmq')),
    sqsInstalled: Boolean(optionalRequire('@aws-sdk/client-sqs')),
    redisConfigured: Boolean(envConfig.redisUrl.trim() || envConfig.rcmRedisUrl.trim()),
  };
}
