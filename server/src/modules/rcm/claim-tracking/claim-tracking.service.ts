import { ClaimTracking } from './claim-tracking.model';
import { Claim } from '../claim/claim.model';
import { ClaimSubmission } from '../claim-submission/claim-submission.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { envConfig } from '../../../config/env.config';
import { appendStatusHistory } from '../workflow/workflow-history';
import { claimClosureService } from '../claim/claim-closure.service';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import {
  normalizeClaimLifecycleStatus,
  normalizeClaimResponseType,
  normalizeClaimTrackingSource,
} from '../shared/state-normalization';
import { rcmAiService } from '../workflow/rcm-ai.service';
import { auditLogService } from '../audit-log/audit-log.service';

function toPlainObject(value: any) {
  return value && typeof value.toObject === 'function' ? value.toObject() : value;
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue || undefined;
}

function normalizeStringArray(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeText(value))
    .filter((value): value is string => Boolean(value));
}

function buildRejectionReason(item: any) {
  const reasonCodes = normalizeStringArray(item.rejectionReasonCodes);

  if (reasonCodes.length) {
    return `Rejection reason codes: ${reasonCodes.join(', ')}`;
  }

  return normalizeText(item.nextActionRequired)
    ?? normalizeText(item.statusDescription)
    ?? normalizeText(item.rejectionSource)
    ?? 'Manual claim tracking indicates payer or clearinghouse rejection.';
}

function normalizeTrackingData(data: any) {
  const normalizedStatus = normalizeClaimLifecycleStatus(
    data.normalizedStatus ?? data.rawStatusCode ?? data.statusCode ?? data.statusDescription
  );
  const responseType = normalizeClaimResponseType(data.responseType ?? data.acknowledgementType);

  return {
    ...data,
    timestamp: data.timestamp ? new Date(data.timestamp) : data.receivedDate ? new Date(data.receivedDate) : undefined,
    trackingSource:
      data.trackingSource === undefined ? undefined : normalizeClaimTrackingSource(data.trackingSource),
    responseType: data.responseType === undefined && !data.acknowledgementType ? undefined : responseType,
    eventType: data.eventType,
    normalizedStatus,
    rawStatusCode: normalizeText(data.rawStatusCode) ?? normalizeText(data.statusCode) ?? normalizedStatus,
    summary:
      normalizeText(data.summary)
      ?? normalizeText(data.statusDescription)
      ?? normalizeText(data.nextActionRequired)
      ?? 'Claim tracking status updated.',
    controlNumber: normalizeText(data.controlNumber) ?? normalizeText(data.claimControlNumber),
  };
}

function isRejectedTracking(item: any) {
  const values = [
    item.acknowledgementType,
    item.statusCode,
    item.statusDescription,
    item.rejectionLevel,
    item.rejectionSource,
    item.nextActionRequired,
    ...normalizeStringArray(item.rejectionReasonCodes),
  ]
    .map((value) => normalizeText(value)?.toLowerCase())
    .filter((value): value is string => Boolean(value));

  return Boolean(item.rejectionLevel)
    || normalizeStringArray(item.rejectionReasonCodes).length > 0
    || normalizeClaimLifecycleStatus(item.normalizedStatus ?? item.statusCode ?? item.statusDescription) === 'REJECTED'
    || values.some((value) => /\breject|denied|not accepted|invalid|failed\b/i.test(value));
}

function isAcknowledgedTracking(item: any) {
  const values = [
    item.acknowledgementType,
    item.statusCode,
    item.statusDescription,
  ]
    .map((value) => normalizeText(value)?.toLowerCase())
    .filter((value): value is string => Boolean(value));

  return normalizeClaimLifecycleStatus(item.normalizedStatus ?? item.statusCode ?? item.statusDescription) === 'ACCEPTED'
    || values.some((value) => /\backnowledged|accepted|received|277ca|999\b/i.test(value));
}

async function validateLinkedClaim(claimId: unknown, locale: string) {
  const normalizedClaimId = normalizeText(String(claimId ?? ''));

  if (!normalizedClaimId) {
    throw new AppError('Claim is required for claim tracking.', HTTP_STATUS.BAD_REQUEST);
  }

  const claim = await Claim.findOne({ _id: normalizedClaimId, isDeleted: false });

  if (!claim) {
    throw new AppError(t('claim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
  }

  return claim;
}

async function syncClaimFromTracking(item: any, locale: string, updatedBy: string) {
  const claim = await validateLinkedClaim(item.claimId, locale);
  const previousStatus = claim.claimStatus;

  if (isRejectedTracking(item)) {
    claim.claimStatus = 'Rejected';
    claim.submissionStatus = 'Rejected';
    claim.rejectionReason = buildRejectionReason(item);
  } else if (isAcknowledgedTracking(item)) {
    claim.claimStatus = 'Submitted';
    claim.submissionStatus = 'Acknowledged';
    claim.closureStatus = 'AWAITING_ERA';
    claim.expectedEraBy = claim.expectedEraBy ?? new Date(Date.now() + envConfig.rcmAwaitingEraThresholdDays * 24 * 60 * 60 * 1000);
    claim.rejectionReason = undefined;
  } else {
    return claim;
  }

  claim.statusHistory = appendStatusHistory(
    claim.statusHistory,
    claim.claimStatus,
    updatedBy,
    `Claim tracking updated from ${normalizeText(item.acknowledgementType) ?? 'manual tracking'}`
  );
  claim.updatedBy = updatedBy as any;
  claim.updated = new Date();

  if (claim.claimStatus !== previousStatus || claim.isModified()) {
    await claim.save();
  }

  if (isAcknowledgedTracking(item)) {
    await claimClosureService.syncClaimClosureStatus(String(claim._id), updatedBy);
    publishRcmRealtimeEvent({
      eventType: 'ACKNOWLEDGEMENT_RECEIVED',
      title: 'Claim acknowledgement received',
      claimId: String(claim._id),
      entityType: 'claimTracking',
      entityId: String(item._id),
      status: 'ACCEPTED',
    });
  }

  return claim;
}

export const claimTrackingService = {
  async create(data: any, locale: string, createdBy: string) {
    const claim = await validateLinkedClaim(data.claimId, locale);
    const normalizedData = normalizeTrackingData(data);

    const item = await ClaimTracking.create({
      ...normalizedData,
      trackingSource: normalizedData.trackingSource ?? 'REAL',
      responseType: normalizedData.responseType ?? 'STATUS_UPDATE',
      eventType: normalizedData.eventType ?? 'CLAIM_STATUS_UPDATED',
      timestamp: normalizedData.timestamp ?? new Date(),
      active: normalizedData.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    });

    await syncClaimFromTracking(item, locale, createdBy);
    const normalizedStatus = normalizeClaimLifecycleStatus(item.normalizedStatus ?? item.statusCode ?? item.statusDescription);
    await auditLogService.record({
      entityType: 'claimTracking',
      entityId: item._id,
      action: normalizedStatus === 'REJECTED'
        ? 'CLAIM_TRACKING_REJECTED'
        : normalizedStatus === 'ACCEPTED'
          ? 'CLAIM_TRACKING_ACCEPTED'
          : 'CLAIM_TRACKING_EVENT_CREATED',
      userId: createdBy,
      changedBy: createdBy,
      source: 'claimTracking',
      claimId: item.claimId,
      patientId: claim.patientId,
      payerId: claim.payerId,
      submissionId: item.claimSubmissionId,
      reason: item.summary ?? item.statusDescription,
      newState: {
        eventType: item.eventType,
        normalizedStatus: item.normalizedStatus,
        responseType: item.responseType,
        trackingSource: item.trackingSource,
      },
    });

    return item;
  },

  async getById(id: string, locale: string) {
    const item = await ClaimTracking.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('claimTracking.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async analyzeRejection(id: string, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    if (!isRejectedTracking(item)) {
      throw new AppError('AI rejection analysis is only available for rejected or failed claim tracking events.', HTTP_STATUS.BAD_REQUEST);
    }
    const [claim, claimSubmission] = await Promise.all([
      item.claimId ? Claim.findOne({ _id: item.claimId, isDeleted: false }) : Promise.resolve(null),
      item.claimSubmissionId ? ClaimSubmission.findOne({ _id: item.claimSubmissionId, isDeleted: false }) : Promise.resolve(null),
    ]);
    const analysis = await rcmAiService.analyzeAckRejection({
      claimTracking: toPlainObject(item),
      claim: toPlainObject(claim) ?? {},
      claimSubmission: toPlainObject(claimSubmission) ?? {},
    });
    item.aiRejectionAnalysis = analysis as unknown as Record<string, unknown>;
    item.aiRecommendationHistory = [
      ...(item.aiRecommendationHistory ?? []),
      {
        type: 'ACK_REJECTION_ANALYSIS',
        generatedAt: new Date(),
        generatedBy: updatedBy,
        ...analysis,
      },
    ];
    item.updatedBy = updatedBy as any;
    item.updated = new Date();
    await item.save();
    await auditLogService.record({
      entityType: 'claimTracking',
      entityId: item._id,
      action: 'AI_RECOMMENDATION_GENERATED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'claimTrackingAi',
      claimId: item.claimId,
      submissionId: item.claimSubmissionId,
      reason: 'AI rejection analysis completed.',
      newState: {
        status: 'COMPLETED',
        recommendation: (analysis as any).recommendedAction ?? (analysis as any).recommendation,
        confidence: (analysis as any).confidence ?? (analysis as any).confidenceScore,
      },
    });
    publishRcmRealtimeEvent({
      eventType: 'AI_RECOMMENDATION_RECORDED',
      title: 'AI rejection analysis completed',
      claimId: item.claimId ? String(item.claimId) : undefined,
      entityType: 'claimTracking',
      entityId: String(item._id),
      status: item.normalizedStatus,
    });
    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    const item = await ClaimTracking.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('claimTracking.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    await validateLinkedClaim(data.claimId ?? item.claimId, locale);
    const normalizedData = normalizeTrackingData(data);

    Object.assign(item, {
      ...normalizedData,
      updatedBy,
      updated: new Date(),
    });

    await item.save();
    await syncClaimFromTracking(item, locale, updatedBy);
    await auditLogService.record({
      entityType: 'claimTracking',
      entityId: item._id,
      action: 'CLAIM_TRACKING_STATUS_CHANGED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'claimTracking',
      claimId: item.claimId,
      submissionId: item.claimSubmissionId,
      reason: item.summary ?? item.statusDescription,
      newState: {
        eventType: item.eventType,
        normalizedStatus: item.normalizedStatus,
        responseType: item.responseType,
      },
    });
    return item;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    const item = await ClaimTracking.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        active: false,
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy,
        updated: new Date(),
      },
      { new: true }
    );

    if (!item) {
      throw new AppError(t('claimTracking.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },
};
