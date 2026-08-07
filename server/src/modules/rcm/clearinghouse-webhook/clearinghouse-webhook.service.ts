import crypto from 'crypto';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { claimSubmissionIntegrationConfig } from '../claim-submission/claim-submission.integration.config';
import { claimSubmissionService } from '../claim-submission/claim-submission.service';
import { eraEobProcessingService } from '../era-eob-processing/era-eob-processing.service';
import { ClearinghouseEvent, ClearinghouseEventType, IClearinghouseEvent } from '../clearinghouse-event/clearinghouse-event.model';
import { RcmBackgroundJob } from '../background-job/background-job.model';
import { enqueueRcmJob, registerRcmJobHandler } from '../background-job/rcm-queue.service';
import { createRcmLogTimer, logRcmEvent, redactPhi } from '../../../utils/hipaa-logger.util';
import { withMongoTransaction } from '../../../utils/mongoose-transaction.util';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { decrypt, encrypt } from '../../../utils/security.util';
import { auditLogService } from '../audit-log/audit-log.service';

type WebhookHeaders = Record<string, string | string[] | undefined>;

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readHeader(headers: WebhookHeaders, name: string) {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmacSha256(value: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function serialize(value: unknown) {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return '[UNSERIALIZABLE_PAYLOAD]';
  }
}

function detectEventType(data: any, fallback?: ClearinghouseEventType): ClearinghouseEventType {
  if (fallback && fallback !== 'UNKNOWN') {
    return fallback;
  }

  const explicitType = normalizeText(data.eventType ?? data.responseType ?? data.acknowledgementType).toUpperCase();
  if (explicitType.includes('835') || explicitType.includes('ERA')) {
    return 'ERA_835';
  }
  if (explicitType.includes('999')) {
    return 'ACK_999';
  }
  if (explicitType.includes('277')) {
    return 'ACK_277CA';
  }
  if (explicitType.includes('STATUS')) {
    return 'CLAIM_STATUS';
  }

  const x12Payload = normalizeText(data.x12Payload ?? data.payload ?? data.raw835Text ?? data.x12);
  if (x12Payload.includes('ST*835')) {
    return 'ERA_835';
  }
  if (x12Payload.includes('ST*999')) {
    return 'ACK_999';
  }
  if (x12Payload.includes('ST*277')) {
    return 'ACK_277CA';
  }

  return 'UNKNOWN';
}

function buildIdempotencyKey(data: any, rawBody: string, eventType: ClearinghouseEventType) {
  return normalizeText(data.eventId)
    || normalizeText(data.idempotencyKey)
    || normalizeText(data.event?.id)
    || normalizeText(data.webhookEventId)
    || normalizeText(data.clearinghouseTraceNumber)
    || normalizeText(data.submissionTraceId)
    || normalizeText(data.externalSubmissionId)
    || `${eventType}:${sha256(rawBody || serialize(data))}`;
}

function resolveStoredPayload(event: IClearinghouseEvent) {
  if (event.rawPayload) {
    try {
      return JSON.parse(decrypt(event.rawPayload));
    } catch (error) {
      logRcmEvent({
        module: 'rcm.clearinghouseWebhook',
        eventType: 'PAYLOAD_DECRYPT',
        status: 'FAILED',
        correlationId: event.idempotencyKey,
        errorCode: 'CLEARINGHOUSE_PAYLOAD_DECRYPT_FAILED',
        message: 'Encrypted clearinghouse webhook payload could not be decrypted or parsed; falling back to stored redacted payload.',
      });
    }
  }

  return event.payload ?? {};
}

export function verifyClearinghouseWebhookSignature(headers: WebhookHeaders, rawBody: string) {
  const configuredSecret = claimSubmissionIntegrationConfig.webhook.secret;
  const nodeEnv = process.env.NODE_ENV;

  if (!configuredSecret) {
    if (nodeEnv === 'production') {
      throw new AppError('CLAIM_SUBMISSION_WEBHOOK_SECRET is required for production clearinghouse webhooks.', HTTP_STATUS.UNAUTHORIZED);
    }
    return false;
  }

  const plainSecret = normalizeText(readHeader(headers, 'x-clearinghouse-webhook-secret'));
  if (nodeEnv !== 'production' && plainSecret && safeEqual(plainSecret, configuredSecret)) {
    return true;
  }

  const configuredSignatureHeader = claimSubmissionIntegrationConfig.webhook.signatureHeader;
  const signature = normalizeText(
    readHeader(headers, configuredSignatureHeader)
    || readHeader(headers, 'x-clearinghouse-signature')
    || readHeader(headers, 'x-stedi-signature')
    || readHeader(headers, 'stedi-signature')
  ).replace(/^sha256=/i, '');

  if (signature) {
    const expectedSignature = hmacSha256(rawBody, configuredSecret);
    if (safeEqual(signature, expectedSignature)) {
      return true;
    }
  }

  logRcmEvent({
    module: 'rcm.clearinghouseWebhook',
    eventType: 'SIGNATURE_VERIFICATION',
    status: 'FAILED',
    errorCode: 'WEBHOOK_SIGNATURE_INVALID',
    message: 'Clearinghouse webhook signature or secret is invalid.',
    metadata: {
      configuredSignatureHeader,
      signaturePresent: Boolean(signature),
    },
  });
  throw new AppError('Clearinghouse webhook signature or secret is invalid.', HTTP_STATUS.UNAUTHORIZED);
}

export function enforceClearinghouseWebhookReplayWindow(headers: WebhookHeaders) {
  const configuredTimestampHeader = claimSubmissionIntegrationConfig.webhook.timestampHeader;
  const timestampHeader = normalizeText(
    readHeader(headers, configuredTimestampHeader)
    || readHeader(headers, 'x-clearinghouse-timestamp')
    || readHeader(headers, 'x-stedi-timestamp')
  );

  if (!timestampHeader) {
    if (claimSubmissionIntegrationConfig.webhook.secret) {
      throw new AppError('Clearinghouse webhook timestamp is required when webhook signing is configured.', HTTP_STATUS.UNAUTHORIZED);
    }
    return;
  }

  const timestamp = Number(timestampHeader);
  const eventTime = Number.isFinite(timestamp) ? timestamp : Date.parse(timestampHeader);
  if (!Number.isFinite(eventTime)) {
    throw new AppError('Clearinghouse webhook timestamp is invalid.', HTTP_STATUS.UNAUTHORIZED);
  }

  const ageMs = Math.abs(Date.now() - eventTime);
  if (ageMs > claimSubmissionIntegrationConfig.webhook.toleranceSeconds * 1000) {
    logRcmEvent({
      module: 'rcm.clearinghouseWebhook',
      eventType: 'REPLAY_WINDOW',
      status: 'FAILED',
      errorCode: 'WEBHOOK_TIMESTAMP_EXPIRED',
      message: 'Clearinghouse webhook timestamp is outside the replay window.',
      metadata: {
        configuredTimestampHeader,
        ageMs,
        toleranceSeconds: claimSubmissionIntegrationConfig.webhook.toleranceSeconds,
      },
    });
    throw new AppError('Clearinghouse webhook timestamp is outside the replay window.', HTTP_STATUS.UNAUTHORIZED);
  }
}

async function processEvent(event: IClearinghouseEvent, updatedBy: string) {
  const payload = resolveStoredPayload(event);

  if (event.eventType === 'ERA_835') {
    const result = await eraEobProcessingService.import835({
      raw835Text: normalizeText(payload?.raw835Text) || normalizeText(payload?.x12Payload) || normalizeText(payload?.payload),
      payerId: payload?.payerId,
      payerName: payload?.payerName,
      eraFileReference: event.idempotencyKey,
      fileMetadata: {
        source: 'clearinghouse-webhook',
        clearinghouseEventId: String(event._id),
      },
    }, 'en', updatedBy);
    publishRcmRealtimeEvent({
      eventType: 'ERA_RECEIVED',
      title: 'ERA received',
      message: `835 ERA processed with ${result.matchedClaims.length} matched claim(s).`,
      entityType: 'eraEobProcessing',
      entityId: String(result.eraEobProcessing._id),
      status: result.eraEobProcessing.reconciliationStatus,
    });
    return;
  }

  if (event.eventType === 'ACK_999' || event.eventType === 'ACK_277CA') {
    const x12Payload = normalizeText(payload.x12Payload) || normalizeText(payload.payload) || normalizeText(payload.x12);
    if (x12Payload) {
      const result = await claimSubmissionService.ingestX12Acknowledgement({
        ...payload,
        x12Payload,
      }, 'en', updatedBy);
      const normalizedStatus = result.claimSubmission?.normalizedStatus ?? result.claimSubmission?.acknowledgementStatus;
      publishRcmRealtimeEvent({
        eventType: normalizedStatus === 'REJECTED' ? 'REJECTION_REMEDIATION_CREATED' : 'ACKNOWLEDGEMENT_RECEIVED',
        title: normalizedStatus === 'REJECTED' ? 'Claim rejection received' : 'Claim acknowledgement received',
        message: result.claimSubmission?.submissionErrorMessage ?? result.claimSubmission?.acknowledgementStatus ?? 'Acknowledgement processed.',
        claimId: String(result.claimSubmission?.claimId ?? ''),
        entityType: 'claimTracking',
        entityId: String(result.claimSubmission?._id ?? ''),
        status: normalizedStatus,
      });
      return;
    }

    const result = await claimSubmissionService.ingestAcknowledgement(payload, 'en', updatedBy);
    const normalizedStatus = result.claimSubmission?.normalizedStatus ?? result.claimSubmission?.acknowledgementStatus;
    publishRcmRealtimeEvent({
      eventType: normalizedStatus === 'REJECTED' ? 'REJECTION_REMEDIATION_CREATED' : 'ACKNOWLEDGEMENT_RECEIVED',
      title: normalizedStatus === 'REJECTED' ? 'Claim rejection received' : 'Claim acknowledgement received',
      message: result.claimSubmission?.submissionErrorMessage ?? result.claimSubmission?.acknowledgementStatus ?? 'Acknowledgement processed.',
      claimId: String(result.claimSubmission?.claimId ?? ''),
      entityType: 'claimTracking',
      entityId: String(result.claimSubmission?._id ?? ''),
      status: normalizedStatus,
    });
    return;
  }

  if (event.eventType === 'CLAIM_STATUS') {
    const result = await claimSubmissionService.ingestAcknowledgement(payload ?? {}, 'en', updatedBy);
    publishRcmRealtimeEvent({
      eventType: 'CLAIM_TRACKING_UPDATED',
      title: 'Claim status updated',
      message: result.claimSubmission?.submissionErrorMessage ?? result.claimSubmission?.transmissionStatus ?? 'Claim status refreshed.',
      claimId: String(result.claimSubmission?.claimId ?? ''),
      entityType: 'claimTracking',
      entityId: String(result.claimSubmission?._id ?? ''),
      status: result.claimSubmission?.normalizedStatus,
    });
    return;
  }

  throw new AppError('Unsupported clearinghouse webhook event type.', HTTP_STATUS.BAD_REQUEST);
}

async function processClearinghouseEventJob(job: any) {
  const eventId = normalizeText(job.payload?.clearinghouseEventId);
  const event = eventId ? await ClearinghouseEvent.findById(eventId) : null;
  const updatedBy = normalizeText(job.updatedBy) || normalizeText(job.createdBy) || 'clearinghouse-webhook';

  if (!event) {
    throw new AppError('Clearinghouse event was not found for background job.', HTTP_STATUS.NOT_FOUND);
  }

  try {
    event.status = 'PROCESSING';
    event.updated = new Date();
    await event.save();

    await processEvent(event, updatedBy);

    event.status = 'PROCESSED';
    event.processedAt = new Date();
    event.updated = new Date();
    await event.save();
    await auditLogService.record({
      entityType: 'clearinghouseEvent',
      entityId: event._id,
      action: 'WEBHOOK_PROCESSED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'clearinghouseWebhook',
      correlationId: event.idempotencyKey,
      reason: `${event.eventType} processed.`,
      newState: { eventType: event.eventType, status: event.status, processedAt: event.processedAt },
    });
    publishRcmRealtimeEvent({
      eventType: 'WEBHOOK_PROCESSED',
      title: 'Webhook processed',
      entityType: 'clearinghouseEvent',
      entityId: String(event._id),
      status: event.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown clearinghouse event processing error.';
    event.status = job.attempts >= job.maxAttempts ? 'DEAD_LETTER' : 'FAILED';
    event.errorMessage = message;
    event.retryCount = job.attempts;
    event.lastRetryAt = new Date();
    event.updated = new Date();
    await event.save();
    await auditLogService.record({
      entityType: 'clearinghouseEvent',
      entityId: event._id,
      action: 'WEBHOOK_REJECTED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'clearinghouseWebhook',
      correlationId: event.idempotencyKey,
      reason: message,
      newState: { eventType: event.eventType, status: event.status, retryCount: event.retryCount },
    });
    publishRcmRealtimeEvent({
      eventType: 'WEBHOOK_REJECTED',
      title: 'Webhook rejected',
      entityType: 'clearinghouseEvent',
      entityId: String(event._id),
      status: event.status,
    });
    throw error;
  }
}

registerRcmJobHandler('PROCESS_CLEARINGHOUSE_EVENT', processClearinghouseEventJob);
registerRcmJobHandler('PROCESS_999_277CA', processClearinghouseEventJob);
registerRcmJobHandler('PROCESS_835_ERA', processClearinghouseEventJob);

export const clearinghouseWebhookService = {
  async receiveEvent(options: {
    body: any;
    headers: WebhookHeaders;
    rawBody?: string;
    fallbackEventType?: ClearinghouseEventType;
    source?: string;
  }) {
    const duration = createRcmLogTimer();
    const rawBody = options.rawBody || serialize(options.body);
    enforceClearinghouseWebhookReplayWindow(options.headers);
    const signatureVerified = verifyClearinghouseWebhookSignature(options.headers, rawBody);
    const eventType = detectEventType(options.body, options.fallbackEventType);
    const idempotencyKey = buildIdempotencyKey(options.body, rawBody, eventType);
    const existingEvent = await ClearinghouseEvent.findOne({ idempotencyKey, isDeleted: false });

    if (existingEvent) {
      await auditLogService.record({
        entityType: 'clearinghouseEvent',
        entityId: existingEvent._id,
        action: 'DUPLICATE_WEBHOOK_IGNORED',
        userId: 'clearinghouse-webhook',
        changedBy: 'clearinghouse-webhook',
        source: 'clearinghouseWebhook',
        correlationId: idempotencyKey,
        reason: 'Duplicate webhook idempotency key ignored.',
        newState: { eventType: existingEvent.eventType, status: existingEvent.status },
      });
      return {
        duplicate: true,
        clearinghouseEvent: existingEvent,
        job: await RcmBackgroundJob.findOne({ idempotencyKey: `clearinghouse-event:${idempotencyKey}` }),
      };
    }

    const { event, queuedJob } = await withMongoTransaction(async (session) => {
      const [createdEvent] = await ClearinghouseEvent.create([
        {
          eventType,
          status: 'RECEIVED',
          idempotencyKey,
          replayKey: sha256(`${idempotencyKey}:${rawBody}`),
          vendorName: claimSubmissionIntegrationConfig.vendorName,
          source: options.source ?? 'clearinghouse-webhook',
          signatureVerified,
          rawPayloadRedacted: serialize(redactPhi(options.body)),
          payload: redactPhi(options.body),
          rawPayload: encrypt(rawBody),
          rawPayloadStored: true,
          submissionTraceId: normalizeText(options.body.submissionTraceId),
          claimControlNumber: normalizeText(options.body.claimControlNumber),
          externalSubmissionId: normalizeText(options.body.externalSubmissionId),
          payerClaimNumber: normalizeText(options.body.payerClaimNumber),
          active: true,
          created: new Date(),
          updated: new Date(),
          createdBy: 'clearinghouse-webhook',
        },
      ], { session });

      const createdQueuedJob = await enqueueRcmJob({
        jobType: 'PROCESS_CLEARINGHOUSE_EVENT',
        idempotencyKey: `clearinghouse-event:${idempotencyKey}`,
        payload: {
          clearinghouseEventId: String(createdEvent._id),
        },
        createdBy: 'clearinghouse-webhook',
        session,
      });

      createdEvent.status = 'QUEUED';
      createdEvent.updated = new Date();
      await createdEvent.save({ session });
      await auditLogService.record({
        entityType: 'clearinghouseEvent',
        entityId: createdEvent._id,
        action: 'WEBHOOK_QUEUED',
        userId: 'clearinghouse-webhook',
        changedBy: 'clearinghouse-webhook',
        source: 'clearinghouseWebhook',
        correlationId: idempotencyKey,
        reason: `${eventType} webhook received, verified, and queued.`,
        newState: { eventType, status: createdEvent.status, signatureVerified },
        session,
      });

      return { event: createdEvent, queuedJob: createdQueuedJob };
    });

    logRcmEvent({
      module: 'rcm.clearinghouseWebhook',
      eventType: 'RECEIVE_EVENT',
      status: 'SUCCEEDED',
      correlationId: idempotencyKey,
      durationMs: duration(),
      metadata: {
        eventType,
        clearinghouseEventId: String(event._id),
        jobId: String(queuedJob.job._id),
        signatureVerified,
      },
    });

    publishRcmRealtimeEvent({
      eventType: eventType === 'ERA_835' ? 'ERA_RECEIVED' : 'ACKNOWLEDGEMENT_RECEIVED',
      title: 'Clearinghouse event queued',
      message: `${eventType} was received and queued for processing.`,
      entityType: 'clearinghouseEvent',
      entityId: String(event._id),
      status: event.status,
    });

    return {
      duplicate: false,
      clearinghouseEvent: event,
      job: queuedJob.job,
    };
  },
};
