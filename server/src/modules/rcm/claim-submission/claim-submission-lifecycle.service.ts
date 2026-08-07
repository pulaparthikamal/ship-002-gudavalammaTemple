import { ClaimTracking } from '../claim-tracking/claim-tracking.model';
import {
  ClaimLifecycleStatus,
  ClaimResponseType,
  ClaimTrackingEventType,
  ClaimTrackingSource,
  normalizeClaimLifecycleStatus,
} from '../shared/state-normalization';
import { claimSubmissionIntegrationConfig } from './claim-submission.integration.config';

export type ClaimLifecycleEventInput = {
  claimId: string;
  claimSubmissionId?: string;
  timestamp?: Date;
  source?: string;
  trackingSource: ClaimTrackingSource;
  responseType: ClaimResponseType;
  eventType: ClaimTrackingEventType;
  normalizedStatus?: ClaimLifecycleStatus;
  rawStatusCode?: string;
  summary: string;
  responsePayloadRedacted?: string;
  controlNumber?: string;
  externalSubmissionId?: string;
  claimControlNumber?: string;
  clearinghouseTraceNumber?: string;
  payerClaimNumber?: string;
  acknowledgementType?: string;
  statusDescription?: string;
  responseStatusCode?: number;
  rejectionLevel?: string;
  rejectionSource?: string;
  rejectionReasonCodes?: string[];
  stcCategoryCode?: string;
  stcStatusCode?: string;
  stcEntityCode?: string;
  affectedServiceLine?: string;
  remediationCode?: string;
  remediationFieldPath?: string;
  remediationSeverity?: string;
  nextActionRequired?: string;
  createdBy?: string;
};

export type SimulatedLifecycleOutcome = {
  finalStatus: ClaimLifecycleStatus;
  acknowledgementType: '999' | '277CA';
  acknowledgementStatus: ClaimLifecycleStatus;
  statusCode: string;
  statusDescription: string;
  submissionErrorCode?: string;
  submissionErrorMessage?: string;
  retryable: boolean;
};

export type SimulatedStatusRefresh = {
  trackingStatus: 'SUBMITTED' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'FAILED';
  acknowledgementStatus: string;
  rawStatusCode: string;
  summary: string;
  responsePayloadRedacted: string;
};

type SimulationContext = {
  claim: any;
  insurancePolicy?: any;
  payer?: any;
};

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function serializePayload(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      message: 'Unable to serialize lifecycle payload',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function hasMissingPayerEdiId(context: SimulationContext) {
  return !normalizeText(context.insurancePolicy?.ediPayerId) && !normalizeText(context.payer?.ediPayerId);
}

function getMissingAuthorizationLines(context: SimulationContext) {
  return (context.claim?.claimLines ?? [])
    .filter((line: any) => line?.authorizationRequired && !normalizeText(line?.priorAuthorizationNumber))
    .map((line: any, index: number) => line?.lineNumber ?? index + 1);
}

function getMissingReferralLines(context: SimulationContext) {
  return (context.claim?.claimLines ?? [])
    .filter((line: any) => line?.referralRequired && !normalizeText(line?.referralNumber))
    .map((line: any, index: number) => line?.lineNumber ?? index + 1);
}

function buildSimulatedPayload(event: ClaimLifecycleEventInput) {
  return serializePayload({
    source: event.source,
    trackingSource: event.trackingSource,
    responseType: event.responseType,
    eventType: event.eventType,
    normalizedStatus: event.normalizedStatus,
    rawStatusCode: event.rawStatusCode,
    summary: event.summary,
    controlNumber: event.controlNumber,
    externalSubmissionId: event.externalSubmissionId,
    claimSubmissionId: event.claimSubmissionId,
  });
}

export function isTestModeLifecycleSimulationEnabled() {
  return claimSubmissionIntegrationConfig.request.usageIndicator === 'T';
}

export async function createClaimLifecycleEvent(input: ClaimLifecycleEventInput) {
  const timestamp = input.timestamp ?? new Date();
  const normalizedStatus =
    input.normalizedStatus ?? normalizeClaimLifecycleStatus(input.rawStatusCode ?? input.statusDescription);
  const responsePayloadRedacted = input.responsePayloadRedacted ?? (
    input.trackingSource === 'SIMULATED' ? buildSimulatedPayload({ ...input, normalizedStatus }) : undefined
  );
  const controlNumber = input.controlNumber ?? input.claimControlNumber;

  return ClaimTracking.create({
    claimId: input.claimId,
    claimSubmissionId: input.claimSubmissionId,
    timestamp,
    source: input.source ?? (input.trackingSource === 'SIMULATED' ? 'SIMULATED_TEST_RESPONSE' : 'REAL_STEDI_RESPONSE'),
    trackingSource: input.trackingSource,
    responseType: input.responseType,
    eventType: input.eventType,
    normalizedStatus,
    rawStatusCode: input.rawStatusCode,
    summary: input.summary,
    responsePayloadRedacted,
    controlNumber,
    externalSubmissionId: input.externalSubmissionId,
    claimControlNumber: input.claimControlNumber ?? controlNumber,
    clearinghouseTraceNumber: input.clearinghouseTraceNumber,
    payerClaimNumber: input.payerClaimNumber,
    acknowledgementType: input.acknowledgementType,
    statusCode: input.rawStatusCode ?? normalizedStatus,
    statusDescription: input.statusDescription ?? input.summary,
    receivedDate: timestamp,
    rejectionLevel: input.rejectionLevel,
    rejectionSource: input.rejectionSource,
    rejectionReasonCodes: input.rejectionReasonCodes ?? [],
    stcCategoryCode: input.stcCategoryCode,
    stcStatusCode: input.stcStatusCode,
    stcEntityCode: input.stcEntityCode,
    affectedServiceLine: input.affectedServiceLine,
    remediationCode: input.remediationCode,
    remediationFieldPath: input.remediationFieldPath,
    remediationSeverity: input.remediationSeverity,
    nextActionRequired: input.nextActionRequired,
    responseStatusCode: input.responseStatusCode,
    active: true,
    created: timestamp,
    updated: timestamp,
    createdBy: input.createdBy,
    updatedBy: input.createdBy,
  });
}

export async function createSimulatedTestLifecycle(options: {
  claimId: string;
  submission: any;
  context: SimulationContext;
  createdBy?: string;
  reason?: string;
}): Promise<SimulatedLifecycleOutcome> {
  const { claimId, submission, context, createdBy } = options;
  const claimSubmissionId = String(submission._id);
  const controlNumber = normalizeText(submission.controlNumber) || normalizeText(submission.claimControlNumber);
  const externalSubmissionId =
    normalizeText(submission.externalSubmissionId) ||
    `SIM-${claimSubmissionId.slice(-10).toUpperCase()}`;
  const baseEvent = {
    claimId,
    claimSubmissionId,
    trackingSource: 'SIMULATED' as ClaimTrackingSource,
    source: 'SIMULATED_TEST_RESPONSE',
    controlNumber,
    claimControlNumber: controlNumber,
    externalSubmissionId,
    clearinghouseTraceNumber: normalizeText(submission.clearinghouseTraceNumber) || normalizeText(submission.submissionTraceId),
    createdBy,
  };

  if (hasMissingPayerEdiId(context)) {
    await createClaimLifecycleEvent({
      ...baseEvent,
      responseType: 'ACK_999',
      eventType: 'ACK_999_REJECTED',
      normalizedStatus: 'REJECTED',
      rawStatusCode: 'R',
      acknowledgementType: '999 Functional Acknowledgement',
      summary: 'Simulated 999 rejected the claim because payer EDI routing is missing.',
      rejectionLevel: 'Clearinghouse',
      rejectionSource: 'X12 999',
      rejectionReasonCodes: ['MISSING_PAYER_EDI_ID'],
      nextActionRequired: 'Add payer EDI ID to the payer or active insurance policy and resubmit.',
    });

    return {
      finalStatus: 'REJECTED',
      acknowledgementType: '999',
      acknowledgementStatus: 'REJECTED',
      statusCode: 'R',
      statusDescription: 'Simulated 999 rejected the claim because payer EDI routing is missing.',
      submissionErrorCode: 'MISSING_PAYER_EDI_ID',
      submissionErrorMessage: 'Payer EDI ID is required before clearinghouse acceptance.',
      retryable: true,
    };
  }

  await createClaimLifecycleEvent({
    ...baseEvent,
    responseType: 'ACK_999',
    eventType: 'ACK_999_ACCEPTED',
    normalizedStatus: 'ACCEPTED',
    rawStatusCode: 'A',
    acknowledgementType: '999 Functional Acknowledgement',
    summary: 'Simulated 999 accepted the 837P syntax and interchange envelope.',
    nextActionRequired: 'Continue to 277CA claim acknowledgement.',
  });

  const missingAuthorizationLines = getMissingAuthorizationLines(context);
  const missingReferralLines = getMissingReferralLines(context);

  if (missingAuthorizationLines.length || missingReferralLines.length) {
    const reasonParts = [
      missingAuthorizationLines.length ? `missing authorization on line(s) ${missingAuthorizationLines.join(', ')}` : '',
      missingReferralLines.length ? `missing referral on line(s) ${missingReferralLines.join(', ')}` : '',
    ].filter(Boolean);
    const summary = `Simulated 277CA rejected the claim for ${reasonParts.join(' and ')}.`;

    await createClaimLifecycleEvent({
      ...baseEvent,
      responseType: 'ACK_277CA',
      eventType: 'ACK_277CA_REJECTED',
      normalizedStatus: 'REJECTED',
      rawStatusCode: 'A3:21',
      acknowledgementType: '277CA Claim Acknowledgement',
      summary,
      rejectionLevel: 'Claim',
      rejectionSource: 'X12 277CA',
      rejectionReasonCodes: [
        ...(missingAuthorizationLines.length ? ['MISSING_AUTHORIZATION'] : []),
        ...(missingReferralLines.length ? ['MISSING_REFERRAL'] : []),
      ],
      nextActionRequired: 'Link a valid authorization/referral and resubmit the claim.',
    });

    return {
      finalStatus: 'REJECTED',
      acknowledgementType: '277CA',
      acknowledgementStatus: 'REJECTED',
      statusCode: 'A3:21',
      statusDescription: summary,
      submissionErrorCode: missingAuthorizationLines.length ? 'MISSING_AUTHORIZATION' : 'MISSING_REFERRAL',
      submissionErrorMessage: summary,
      retryable: true,
    };
  }

  await createClaimLifecycleEvent({
    ...baseEvent,
    responseType: 'ACK_277CA',
    eventType: 'ACK_277CA_ACCEPTED',
    normalizedStatus: 'ACCEPTED',
    rawStatusCode: 'A1:19',
    acknowledgementType: '277CA Claim Acknowledgement',
    summary: 'Simulated 277CA accepted the claim for payer adjudication intake.',
    nextActionRequired: 'Monitor payer status. No payment or ERA has been simulated.',
  });

  await createClaimLifecycleEvent({
    ...baseEvent,
    responseType: 'STATUS_UPDATE',
    eventType: 'CLAIM_PENDING',
    normalizedStatus: 'PENDING',
    rawStatusCode: 'PENDING',
    acknowledgementType: 'Claim Status',
    summary: 'Claim is pending payer adjudication. No paid status is generated in Phase 2.',
    nextActionRequired: 'Continue claim status tracking.',
  });

  return {
    finalStatus: 'PENDING',
    acknowledgementType: '277CA',
    acknowledgementStatus: 'PENDING',
    statusCode: 'PENDING',
    statusDescription: 'Claim is pending payer adjudication. No paid status is generated in Phase 2.',
    retryable: false,
  };
}

export function buildSimulatedStatusRefresh(submission: any): SimulatedStatusRefresh {
  const currentStatus = normalizeClaimLifecycleStatus(
    submission.normalizedStatus ?? submission.status ?? submission.acknowledgementStatus ?? submission.transmissionStatus
  );
  const trackingStatus =
    currentStatus === 'REJECTED' || currentStatus === 'FAILED' || currentStatus === 'ACCEPTED' || currentStatus === 'SUBMITTED'
      ? currentStatus
      : 'PENDING';
  const summary =
    trackingStatus === 'REJECTED'
      ? 'Simulated 277 claim status response confirms the claim requires follow-up. No payment status is generated.'
      : trackingStatus === 'FAILED'
        ? 'Simulated 277 claim status response confirms status refresh failed before payer adjudication.'
        : 'Simulated 277 claim status response shows the claim is pending payer adjudication. No payment status is generated.';

  return {
    trackingStatus,
    acknowledgementStatus: trackingStatus,
    rawStatusCode: trackingStatus === 'REJECTED' ? 'A3:21' : trackingStatus === 'FAILED' ? 'FAILED' : 'PENDING',
    summary,
    responsePayloadRedacted: serializePayload({
      trackingSource: 'SIMULATED',
      responseType: 'STATUS_UPDATE',
      transaction: '276_INQUIRY_277_RESPONSE',
      externalSubmissionId: submission.externalSubmissionId,
      controlNumber: submission.controlNumber ?? submission.claimControlNumber,
      status: trackingStatus,
      summary,
    }),
  };
}
