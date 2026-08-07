import { Response } from 'express';
import mongoose from 'mongoose';
import { envConfig } from '../../../config/env.config';
import { logRcmEvent } from '../../../utils/hipaa-logger.util';
import { RcmEventLog } from './rcm-event-log.model';
import { ReportSnapshot } from '../report/report-snapshot.model';

export type RcmRealtimeEventType =
  | 'CLAIM_SUBMISSION_STATUS_CHANGED'
  | 'CLAIM_TRACKING_UPDATED'
  | 'ACKNOWLEDGEMENT_RECEIVED'
  | 'REJECTION_REMEDIATION_CREATED'
  | 'ERA_RECEIVED'
  | 'PAYMENT_POSTED'
  | 'DENIAL_CREATED'
  | 'DENIAL_STATUS_CHANGED'
  | 'DENIAL_TRANSITION_RECORDED'
  | 'DENIAL_SLA_BREACHED'
  | 'APPEAL_CREATED'
  | 'APPEAL_PACKET_GENERATED'
  | 'APPEAL_FINAL_PACKET_GENERATED'
  | 'APPEAL_READINESS_REVIEWED'
  | 'APPEAL_DOCUMENT_UPDATED'
  | 'APPEAL_CORRESPONDENCE_RECORDED'
  | 'APPEAL_SUBMISSION_PROOF_RECORDED'
  | 'APPEAL_RECOVERY_ACCOUNTING_UPDATED'
  | 'APPEAL_SUBMITTED'
  | 'APPEAL_OUTCOME_RECORDED'
  | 'APPEAL_OVERTURNED'
  | 'APPEAL_PARTIALLY_OVERTURNED'
  | 'APPEAL_UPHELD'
  | 'APPEAL_SLA_BREACHED'
  | 'PAYMENT_RESOLVED_DENIAL'
  | 'AR_CLOSED_FROM_PAYMENT'
  | 'AR_STATUS_CHANGED'
  | 'CORRECTED_CLAIM_SUBMITTED'
  | 'CORRECTED_CLAIM_CLOSED'
  | 'CORRECTED_CLAIM_AGING_ESCALATED'
  | 'CLAIM_READY_TO_CLOSE'
  | 'CLAIM_CLOSED'
  | 'CLAIM_REOPENED'
  | 'CLAIM_ERA_DELAYED'
  | 'AR_WORK_ITEM_CREATED'
  | 'ERA_EXCEPTION_CREATED'
  | 'ERA_EXCEPTION_UPDATED'
  | 'ERA_EXCEPTION_STATUS_CHANGED'
  | 'ERA_EXCEPTION_REPROCESSED'
  | 'ERA_REPLAY_STARTED'
  | 'ERA_REPLAY_COMPLETED'
  | 'PAYMENT_REVERSED'
  | 'FINANCIAL_IMBALANCE_DETECTED'
  | 'FINANCIAL_BALANCE_CHANGED'
  | 'PATIENT_BILLING_STATUS_CHANGED'
  | 'PATIENT_PAYMENT_POSTED'
  | 'REFUND_STATUS_CHANGED'
  | 'COLLECTION_STATUS_CHANGED'
  | 'COLLECTION_ESCALATED'
  | 'QUEUE_JOB_STATUS_CHANGED'
  | 'QUEUE_WORKER_STATUS_CHANGED'
  | 'QUEUE_STALE_JOBS_RECOVERED'
  | 'WEBHOOK_PROCESSED'
  | 'WEBHOOK_REJECTED'
  | 'AI_REVIEW_COMPLETED'
  | 'PATIENT_BILLING_CREATED'
  | 'COLLECTION_REFERRED'
  | 'FINANCIAL_RISK_CREATED'
  | 'UNSUPPORTED_ADJUSTMENT_DETECTED'
  | 'EVENT_STREAM_DISCONNECTED'
  | 'EVENT_STREAM_RECONNECTED'
  | 'AUDIT_LOG_RECORDED'
  | 'AI_RECOMMENDATION_RECORDED'
  | 'DOCUMENT_REPOSITORY_UPDATED'
  | 'TIMELY_FILING_RISK'
  | 'DOCUMENTATION_GAP'

export type RcmRealtimeEvent = {
  eventType: RcmRealtimeEventType;
  title: string;
  message?: string;
  claimId?: string;
  entityId?: string;
  entityType?: string;
  status?: string;
  createdAt?: string;
  sequence?: number;
};

const clients = new Set<Response>();
let heartbeat: NodeJS.Timeout | undefined;
let localSequence = 0;

const REPORT_INVALIDATING_EVENTS = new Set<RcmRealtimeEventType>([
  'PAYMENT_POSTED',
  'PAYMENT_REVERSED',
  'PATIENT_PAYMENT_POSTED',
  'REFUND_STATUS_CHANGED',
  'DENIAL_CREATED',
  'DENIAL_STATUS_CHANGED',
  'APPEAL_OUTCOME_RECORDED',
  'APPEAL_OVERTURNED',
  'APPEAL_PARTIALLY_OVERTURNED',
  'APPEAL_UPHELD',
  'ERA_RECEIVED',
  'ERA_REPLAY_STARTED',
  'ERA_REPLAY_COMPLETED',
  'CLAIM_TRACKING_UPDATED',
  'PAYMENT_RESOLVED_DENIAL',
  'AR_CLOSED_FROM_PAYMENT',
  'AR_STATUS_CHANGED',
  'PATIENT_BILLING_CREATED',
  'COLLECTION_STATUS_CHANGED',
  'COLLECTION_REFERRED',
  'CLAIM_CLOSED',
  'CLAIM_REOPENED',
  'QUEUE_JOB_STATUS_CHANGED',
  'QUEUE_STALE_JOBS_RECOVERED',
  'WEBHOOK_PROCESSED',
  'WEBHOOK_REJECTED',
  'AUDIT_LOG_RECORDED',
  'AI_RECOMMENDATION_RECORDED',
  'APPEAL_PACKET_GENERATED',
  'APPEAL_FINAL_PACKET_GENERATED',
  'APPEAL_READINESS_REVIEWED',
  'APPEAL_DOCUMENT_UPDATED',
  'APPEAL_CORRESPONDENCE_RECORDED',
  'APPEAL_SUBMISSION_PROOF_RECORDED',
  'APPEAL_RECOVERY_ACCOUNTING_UPDATED',
  'AI_REVIEW_COMPLETED',
  'FINANCIAL_RISK_CREATED',
  'UNSUPPORTED_ADJUSTMENT_DETECTED',
  'TIMELY_FILING_RISK',
  'DOCUMENTATION_GAP',
]);

export function isReportInvalidatingEvent(eventType: RcmRealtimeEventType) {
  return REPORT_INVALIDATING_EVENTS.has(eventType);
}

function writeEvent(response: Response, event: string, data: unknown, id?: number) {
  if (id) {
    response.write(`id: ${id}\n`);
  }
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

function ensureHeartbeat() {
  if (heartbeat || !clients.size) {
    return;
  }

  heartbeat = setInterval(() => {
    for (const client of clients) {
      writeEvent(client, 'heartbeat', { at: new Date().toISOString() });
    }
  }, 25000);
}

function stopHeartbeatIfIdle() {
  if (clients.size || !heartbeat) {
    return;
  }

  clearInterval(heartbeat);
  heartbeat = undefined;
}

async function replayEvents(response: Response, lastEventId?: string) {
  const sequence = Number(lastEventId);
  if (!Number.isFinite(sequence) || sequence < 0) return;

  const events = await RcmEventLog.find({ isDeleted: false, sequence: { $gt: sequence } })
    .sort({ sequence: 1 })
    .limit(100)
    .lean();

  for (const event of events) {
    writeEvent(response, 'rcm-event', event.payload, event.sequence);
  }
}

export function attachRcmEventStream(response: Response, options: { lastEventId?: string } = {}) {
  if (!envConfig.rcmRealtimeEnabled || envConfig.rcmRealtimeMode.trim().toLowerCase() !== 'sse') {
    response.status(204).end();
    return;
  }

  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.flushHeaders?.();

  clients.add(response);
  const connectedPayload = {
    eventType: 'CLAIM_TRACKING_UPDATED',
    title: 'RCM realtime connected',
    message: 'Claim lifecycle updates will refresh automatically.',
    createdAt: new Date().toISOString(),
    sequence: localSequence,
  };
  writeEvent(response, 'rcm-event', connectedPayload, localSequence || undefined);
  replayEvents(response, options.lastEventId).catch((error) => {
    logRcmEvent({
      module: 'rcm.realtime',
      eventType: 'EVENT_REPLAY',
      status: 'FAILED',
      errorCode: 'RCM_EVENT_REPLAY_FAILED',
      message: error instanceof Error ? error.message : 'RCM event replay failed.',
    });
  });
  ensureHeartbeat();

  response.on('close', () => {
    clients.delete(response);
    stopHeartbeatIfIdle();
  });
}

export function publishRcmRealtimeEvent(event: RcmRealtimeEvent) {
  if (!envConfig.rcmRealtimeEnabled) {
    return;
  }

  const payload = {
    ...event,
    sequence: event.sequence ?? ++localSequence,
    createdAt: event.createdAt ?? new Date().toISOString(),
  };

  if (mongoose.connection.readyState === 1) {
    if (isReportInvalidatingEvent(payload.eventType)) {
      ReportSnapshot.updateMany(
        { isDeleted: false, refreshStatus: 'FRESH' },
        {
          refreshStatus: 'STALE',
          refreshError: `Invalidated by ${payload.eventType}`,
          updated: new Date(),
        }
      ).catch((error) => {
        logRcmEvent({
          module: 'rcm.reporting',
          eventType: payload.eventType,
          status: 'FAILED',
          errorCode: 'REPORT_SNAPSHOT_INVALIDATION_FAILED',
          message: error instanceof Error ? error.message : 'Unable to invalidate report snapshots.',
          correlationId: payload.claimId ?? payload.entityId,
        });
      });
    }

    RcmEventLog.create({
      sequence: payload.sequence,
      eventType: payload.eventType,
      payload,
      claimId: payload.claimId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      active: true,
      created: new Date(payload.createdAt),
      updated: new Date(),
      isDeleted: false,
    }).catch((error) => {
      logRcmEvent({
        module: 'rcm.realtime',
        eventType: payload.eventType,
        status: 'FAILED',
        errorCode: 'RCM_EVENT_LOG_WRITE_FAILED',
        message: error instanceof Error ? error.message : 'Unable to persist RCM event log entry.',
        correlationId: payload.claimId ?? payload.entityId,
      });
    });
  }

  for (const client of clients) {
    writeEvent(client, 'rcm-event', payload, payload.sequence);
  }

  logRcmEvent({
    module: 'rcm.realtime',
    eventType: event.eventType,
    status: 'SUCCEEDED',
    correlationId: event.claimId ?? event.entityId,
    metadata: {
      entityType: event.entityType,
      entityId: event.entityId,
      status: event.status,
      connectedClients: clients.size,
    },
  });
}
