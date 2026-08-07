import mongoose from 'mongoose';
import { connectDB } from '../config/db.config';
import { logger } from '../utils/logger.util';
import { ClaimSubmission } from '../modules/rcm/claim-submission/claim-submission.model';
import { ClaimTracking } from '../modules/rcm/claim-tracking/claim-tracking.model';
import {
  ClaimTrackingEventType,
  normalizeClaimLifecycleStatus,
  normalizeClaimResponseType,
  normalizeClaimTrackingSource,
} from '../modules/rcm/shared/state-normalization';

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function eventTypeForTracking(item: any): ClaimTrackingEventType {
  const responseType = normalizeClaimResponseType(item.responseType ?? item.acknowledgementType);
  const normalizedStatus = normalizeClaimLifecycleStatus(
    item.normalizedStatus ?? item.rawStatusCode ?? item.statusCode ?? item.statusDescription
  );

  if (responseType === 'SUBMISSION') {
    return normalizedStatus === 'FAILED' ? 'SUBMISSION_FAILED' : 'SUBMISSION_SENT';
  }

  if (responseType === 'ACK_999') {
    return normalizedStatus === 'REJECTED' ? 'ACK_999_REJECTED' : 'ACK_999_ACCEPTED';
  }

  if (responseType === 'ACK_277CA') {
    return normalizedStatus === 'REJECTED' ? 'ACK_277CA_REJECTED' : 'ACK_277CA_ACCEPTED';
  }

  return normalizedStatus === 'PENDING' ? 'CLAIM_PENDING' : 'CLAIM_STATUS_UPDATED';
}

async function backfillClaimSubmissions() {
  let updatedCount = 0;
  const cursor = ClaimSubmission.find({ isDeleted: false }).cursor();

  for await (const submission of cursor) {
    const normalizedStatus = normalizeClaimLifecycleStatus(
      submission.normalizedStatus ??
      submission.acknowledgementStatus ??
      submission.transmissionStatus ??
      submission.status
    );
    const trackingSource = normalizeClaimTrackingSource(submission.trackingSource ?? 'REAL');
    const responseType = normalizeClaimResponseType(submission.responseType ?? submission.acknowledgementType);
    let changed = false;

    if (submission.normalizedStatus !== normalizedStatus) {
      submission.normalizedStatus = normalizedStatus;
      changed = true;
    }

    if (submission.trackingSource !== trackingSource) {
      submission.trackingSource = trackingSource;
      changed = true;
    }

    if (submission.responseType !== responseType) {
      submission.responseType = responseType;
      changed = true;
    }

    if (normalizeText(submission.status).toUpperCase() === 'UNKNOWN') {
      submission.status = normalizedStatus;
      changed = true;
    }

    if (normalizeText(submission.transmissionStatus).toUpperCase() === 'UNKNOWN') {
      submission.transmissionStatus = normalizedStatus;
      changed = true;
    }

    if (normalizeText(submission.acknowledgementStatus).toUpperCase() === 'UNKNOWN') {
      submission.acknowledgementStatus = normalizedStatus;
      changed = true;
    }

    if (changed) {
      submission.updated = new Date();
      await submission.save();
      updatedCount += 1;
    }
  }

  return updatedCount;
}

async function backfillClaimTrackings() {
  let updatedCount = 0;
  const cursor = ClaimTracking.find({ isDeleted: false }).cursor();

  for await (const tracking of cursor) {
    const submissionLinkConditions: Record<string, unknown>[] = [];
    if (tracking.externalSubmissionId) {
      submissionLinkConditions.push({ externalSubmissionId: tracking.externalSubmissionId });
    }
    if (tracking.claimControlNumber) {
      submissionLinkConditions.push({ claimControlNumber: tracking.claimControlNumber });
    }
    if (tracking.claimId) {
      submissionLinkConditions.push({ claimId: tracking.claimId });
    }
    const latestSubmission = tracking.claimId
      ? await ClaimSubmission.findOne({
          claimId: tracking.claimId,
          isDeleted: false,
          active: true,
          $or: submissionLinkConditions,
        }).sort({ submissionDateTime: -1, created: -1 })
      : null;
    const normalizedStatus = normalizeClaimLifecycleStatus(
      tracking.normalizedStatus ??
      tracking.rawStatusCode ??
      tracking.statusCode ??
      tracking.statusDescription
    );
    const responseType = normalizeClaimResponseType(tracking.responseType ?? tracking.acknowledgementType);
    const trackingSource = normalizeClaimTrackingSource(tracking.trackingSource ?? 'REAL');
    let changed = false;

    if (!tracking.claimSubmissionId && latestSubmission?._id) {
      tracking.claimSubmissionId = latestSubmission._id;
      changed = true;
    }

    if (!tracking.timestamp) {
      tracking.timestamp = tracking.receivedDate ?? tracking.created ?? new Date();
      changed = true;
    }

    if (!tracking.source) {
      tracking.source = trackingSource === 'SIMULATED' ? 'SIMULATED_TEST_RESPONSE' : 'REAL_STEDI_RESPONSE';
      changed = true;
    }

    if (tracking.trackingSource !== trackingSource) {
      tracking.trackingSource = trackingSource;
      changed = true;
    }

    if (tracking.responseType !== responseType) {
      tracking.responseType = responseType;
      changed = true;
    }

    if (tracking.normalizedStatus !== normalizedStatus) {
      tracking.normalizedStatus = normalizedStatus;
      changed = true;
    }

    if (!tracking.eventType) {
      tracking.eventType = eventTypeForTracking(tracking);
      changed = true;
    }

    if (!tracking.rawStatusCode) {
      tracking.rawStatusCode = tracking.statusCode ?? normalizedStatus;
      changed = true;
    }

    if (!tracking.summary) {
      tracking.summary = tracking.statusDescription ?? tracking.nextActionRequired ?? 'Backfilled claim tracking timeline event.';
      changed = true;
    }

    if (!tracking.controlNumber) {
      tracking.controlNumber = tracking.claimControlNumber ?? latestSubmission?.controlNumber ?? latestSubmission?.claimControlNumber;
      changed = true;
    }

    if (normalizeText(tracking.statusCode).toUpperCase() === 'UNKNOWN') {
      tracking.statusCode = normalizedStatus;
      changed = true;
    }

    if (changed) {
      tracking.updated = new Date();
      await tracking.save();
      updatedCount += 1;
    }
  }

  return updatedCount;
}

async function run() {
  try {
    await connectDB();
    const [submissionCount, trackingCount] = await Promise.all([
      backfillClaimSubmissions(),
      backfillClaimTrackings(),
    ]);

    logger.info(`Backfilled ${submissionCount} claim submissions and ${trackingCount} claim tracking timeline rows.`);
  } finally {
    await mongoose.connection.close();
  }
}

run().catch((error) => {
  logger.error('Claim submission lifecycle backfill failed:', error);
  process.exit(1);
});
