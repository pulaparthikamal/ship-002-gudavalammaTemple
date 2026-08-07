import { createHash } from 'crypto';
import { ClaimSubmission } from './claim-submission.model';
import { build837ProfessionalClaimPayload } from './claim-submission.edi';
import { validate837ProfessionalClaim } from './claim-submission.validation';
import { getPayerSpecific837PValidators } from './claim-submission.payer-validators';
import { mapAcknowledgementToRemediation } from './claim-submission.remediation';
import { getClaimSubmissionStatus, sendClaimSubmission } from './claim-submission.transport';
import {
  claimSubmissionIntegrationConfig,
  isClaimSubmissionIntegrationConfigured,
} from './claim-submission.integration.config';
import { Claim } from '../claim/claim.model';
import { Encounter } from '../encounter/encounter.model';
import { InsurancePolicy } from '../insurance-policy/insurance-policy.model';
import { Payer } from '../payer/payer.model';
import { Patient } from '../patient/patient.model';
import { Provider } from '../provider/provider.model';
import { Facility } from '../facility/facility.model';
import { PriorAuthorization } from '../prior-authorization/prior-authorization.model';
import { Referral } from '../referral/referral.model';
import { appendStatusHistory } from '../workflow/workflow-history';
import { claimRejectionService } from '../claim-rejection/claim-rejection.service';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { normalizeClaimLifecycleStatus } from '../shared/state-normalization';
import {
  buildSimulatedStatusRefresh,
  createClaimLifecycleEvent,
  createSimulatedTestLifecycle,
  isTestModeLifecycleSimulationEnabled,
} from './claim-submission-lifecycle.service';
import { denialWorkflowService } from '../denial/denial-workflow.service';
import { createRcmLogTimer, logRcmEvent } from '../../../utils/hipaa-logger.util';
import { envConfig } from '../../../config/env.config';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { claimClosureService } from '../claim/claim-closure.service';
import { registerRcmJobHandler } from '../background-job/rcm-queue.service';
import { auditLogService } from '../audit-log/audit-log.service';

type ClaimSubmissionContext = {
  claim: any;
  patient: any;
  insurancePolicy: any;
  payer: any;
  billingProvider: any;
  renderingProvider: any;
  facility: any;
};

async function getClaimAppointmentId(claim: any) {
  if (!claim?.encounterId) return undefined;
  const encounter = await Encounter.findOne({ _id: claim.encounterId, isDeleted: false }).select('appointmentId').lean();
  return encounter?.appointmentId;
}

type ClaimSubmissionAttemptResult = {
  claimSubmission: any;
  idempotent: boolean;
};

type AcknowledgementPayload = {
  submissionTraceId?: string;
  externalSubmissionId?: string;
  claimId?: string;
  batchId?: string;
  acknowledgementType?: string;
  acknowledgementStatus?: string;
  transmissionStatus?: string;
  claimControlNumber?: string;
  clearinghouseTraceNumber?: string;
  payerClaimNumber?: string;
  statusCode?: string;
  statusDescription?: string;
  receivedDate?: Date;
  rejectionLevel?: string;
  rejectionSource?: string;
  rejectionReasonCodes?: string[];
  stcCategoryCode?: string;
  stcStatusCode?: string;
  stcEntityCode?: string;
  affectedServiceLine?: string;
  remediationCode?: string;
  remediationFieldPath?: string;
  remediationSeverity?: 'BLOCKING' | 'WARNING';
  nextActionRequired?: string;
  rawPayload?: unknown;
};

const RETRYABLE_SUBMISSION_STATUSES = new Set(['Failed', 'Rejected', 'FAILED', 'REJECTED']);
const DUPLICATE_SAFE_SUBMISSION_STATUSES = new Set([
  'Queued',
  'Submitted',
  'Printed',
  'Transmitted',
  'Acknowledged',
  'PENDING',
  'SUBMITTED',
  'ACCEPTED',
  'PRINTED',
]);

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
  }

  return undefined;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const nextValues = value
    .map((item) => normalizeText(item))
    .filter((item): item is string => Boolean(item));

  return nextValues.length ? nextValues : [];
}

function buildValidationError(message: string) {
  return new AppError(message, HTTP_STATUS.BAD_REQUEST);
}

function build837ValidationError(findings: ReturnType<typeof validate837ProfessionalClaim>['findings']) {
  return new AppError(
    '837P companion-guide validation failed. Resolve blocking readiness defects before submission.',
    HTTP_STATUS.BAD_REQUEST,
    findings.map((finding) => ({
      field: finding.fieldPath,
      message: finding.message,
      code: finding.code,
      severity: finding.severity,
      loop: finding.loop,
      segment: finding.segment,
      remediation: finding.remediation,
    }))
  );
}

function buildSubmissionFailureError(
  message: string,
  statusCode: number = HTTP_STATUS.BAD_GATEWAY,
  details: Record<string, unknown> = {}
) {
  return new AppError(message, statusCode, [
    {
      field: 'claimSubmission',
      message,
      submissionStatus: 'FAILED',
      ...details,
    },
  ]);
}

function serializePayload(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      message: 'Unable to serialize payload',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

const REDACTED_VALUE = '[REDACTED]';

function redactX12Payload(payload: string) {
  const segmentTerminator = payload.includes('~') ? '~' : '\n';

  return payload
    .split(segmentTerminator)
    .map((segment) => {
      const trimmedSegment = segment.trim();

      if (!trimmedSegment) {
        return '';
      }

      const segmentId = trimmedSegment.split('*')[0];
      const entityCode = trimmedSegment.split('*')[1];

      if (segmentId === 'NM1' && ['IL', 'QC'].includes(entityCode)) {
        return `${segmentId}*${entityCode ?? ''}*${REDACTED_VALUE}`;
      }

      if (
        segmentId === 'N3'
        || segmentId === 'N4'
        || segmentId === 'DMG'
        || (segmentId === 'PER' && trimmedSegment.includes('*TE*'))
      ) {
        return `${segmentId}*${REDACTED_VALUE}`;
      }

      return trimmedSegment;
    })
    .filter(Boolean)
    .join(segmentTerminator) + (payload.endsWith(segmentTerminator) ? segmentTerminator : '');
}

export function redactClaimSubmissionPayload(value: unknown): string {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    if (trimmedValue.includes('ISA*') || trimmedValue.includes('NM1*IL') || trimmedValue.includes('~')) {
      return redactX12Payload(value);
    }

    try {
      return redactClaimSubmissionPayload(JSON.parse(trimmedValue));
    } catch (error) {
      return trimmedValue;
    }
  }

  const sensitiveKeys = new Set([
    'firstname',
    'lastname',
    'dateofbirth',
    'dob',
    'memberid',
    'subscriberid',
    'address',
    'addressline1',
    'addressline2',
    'city',
    'state',
    'zipcode',
    'phone',
    'ediPayload'.toLowerCase(),
    'x12payload',
    'x12',
  ]);

  const redactRecursive = (source: unknown): unknown => {
    if (Array.isArray(source)) {
      return source.map(redactRecursive);
    }

    if (typeof source !== 'object' || source === null) {
      return source;
    }

    return Object.entries(source as Record<string, unknown>).reduce<Record<string, unknown>>((nextValue, [key, item]) => {
      if (sensitiveKeys.has(key.toLowerCase())) {
        nextValue[key] = typeof item === 'string' && (key.toLowerCase() === 'edipayload' || key.toLowerCase() === 'x12payload' || key.toLowerCase() === 'x12')
          ? redactX12Payload(item)
          : REDACTED_VALUE;
        return nextValue;
      }

      nextValue[key] = redactRecursive(item);
      return nextValue;
    }, {});
  };

  return serializePayload(redactRecursive(value));
}

function storedPayloadSnapshot(rawPayload: unknown) {
  return claimSubmissionIntegrationConfig.storage.storeRawPayloads
    ? serializePayload(rawPayload)
    : redactClaimSubmissionPayload(rawPayload);
}

function normalizeTextLower(value: unknown) {
  return normalizeText(value)?.toLowerCase();
}

function normalizeLifecycleStatus(value: unknown): 'SUBMITTED' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'FAILED' {
  const normalizedStatus = normalizeClaimLifecycleStatus(value);

  if (normalizedStatus === 'DRAFT' || normalizedStatus === 'READY') {
    return 'PENDING';
  }

  return normalizedStatus;
}

function normalizeAcknowledgementStatus(value: unknown) {
  return normalizeLifecycleStatus(value);
}

const ACK_STATUS_PRECEDENCE: Record<string, number> = {
  SUBMITTED: 10,
  PENDING: 20,
  ACCEPTED: 30,
  REJECTED: 40,
  FAILED: 40,
};

function shouldIgnoreStaleAcknowledgement(submission: any, payload: AcknowledgementPayload) {
  const currentStatus = normalizeLifecycleStatus(submission.acknowledgementStatus ?? submission.transmissionStatus);
  const incomingStatus = normalizeLifecycleStatus(payload.acknowledgementStatus ?? payload.transmissionStatus);
  const currentReceivedAt = submission.acknowledgementDateTime ? new Date(submission.acknowledgementDateTime).getTime() : 0;
  const incomingReceivedAt = payload.receivedDate ? new Date(payload.receivedDate).getTime() : Date.now();
  const currentPrecedence = ACK_STATUS_PRECEDENCE[currentStatus] ?? 0;
  const incomingPrecedence = ACK_STATUS_PRECEDENCE[incomingStatus] ?? 0;

  const sameEvent = currentStatus === incomingStatus
    && payload.statusCode
    && submission.submissionErrorCode === payload.statusCode
    && incomingReceivedAt <= currentReceivedAt;
  if (sameEvent) {
    return true;
  }

  const staleEvent = currentReceivedAt > 0 && incomingReceivedAt < currentReceivedAt;
  return staleEvent && incomingPrecedence <= currentPrecedence;
}

function buildBatchId() {
  return `${claimSubmissionIntegrationConfig.request.batchPrefix}-${Date.now()}`;
}

function buildSubmissionTraceId(claimId: string, retrySequence: number) {
  const compactClaimId = claimId.replace(/[^a-zA-Z0-9]/g, '').slice(-10).toUpperCase();
  return `${claimSubmissionIntegrationConfig.request.controlPrefix}-${compactClaimId}-${retrySequence}-${Date.now()}`;
}

function buildControlNumber(seed: string, length = 9) {
  const digits = seed.replace(/\D+/g, '');
  return digits.slice(-length).padStart(length, '0');
}

function buildClaimControlNumber(claimId: string, retrySequence: number) {
  return `${claimSubmissionIntegrationConfig.request.controlPrefix}${claimId.replace(/[^a-zA-Z0-9]/g, '').slice(-12)}${retrySequence}`
    .slice(0, 20)
    .toUpperCase();
}

function buildPaperPayloadSnapshot(context: ClaimSubmissionContext, claimControlNumber: string) {
  return serializePayload({
    claimId: String(context.claim._id),
    claimControlNumber,
    fileType: context.claim.claimType === 'Institutional' ? 'CMS-1450' : 'CMS-1500',
    patient: {
      firstName: context.patient.firstName,
      lastName: context.patient.lastName,
      dateOfBirth: context.patient.dateOfBirth,
    },
    payer: {
      payerId: context.payer.payerId,
      payerName: context.payer.payerName,
    },
    facility: {
      facilityName: context.facility.facilityName,
      npi: context.facility.npi,
      taxId: context.facility.taxId,
    },
    chargeAmount: context.claim.totalChargeAmount,
    diagnosisCodes: context.claim.diagnosisCodes ?? [],
    claimLines: context.claim.claimLines ?? [],
  });
}

function hasSimulatedAcknowledgementDefect(context: ClaimSubmissionContext) {
  const missingPayerEdiId =
    !normalizeText(context.insurancePolicy.ediPayerId) && !normalizeText(context.payer.ediPayerId);
  const missingAuthorizationOrReferral = (context.claim.claimLines ?? []).some(
    (line: any) =>
      (line.authorizationRequired && !normalizeText(line.priorAuthorizationNumber)) ||
      (line.referralRequired && !normalizeText(line.referralNumber))
  );

  return missingPayerEdiId || missingAuthorizationOrReferral;
}

function buildSimulatedInvalid837Snapshot(context: ClaimSubmissionContext, claimControlNumber: string) {
  return serializePayload({
    fileType: '837P',
    claimId: String(context.claim._id),
    claimControlNumber,
    trackingSource: 'SIMULATED',
    message: '837P validation defects preserved for deterministic test-mode acknowledgement simulation.',
    defects: {
      missingPayerEdiId:
        !normalizeText(context.insurancePolicy.ediPayerId) && !normalizeText(context.payer.ediPayerId),
      missingAuthorizationLines: (context.claim.claimLines ?? [])
        .filter((line: any) => line.authorizationRequired && !normalizeText(line.priorAuthorizationNumber))
        .map((line: any, index: number) => line.lineNumber ?? index + 1),
      missingReferralLines: (context.claim.claimLines ?? [])
        .filter((line: any) => line.referralRequired && !normalizeText(line.referralNumber))
        .map((line: any, index: number) => line.lineNumber ?? index + 1),
    },
  });
}

function buildClaimFingerprint(context: ClaimSubmissionContext) {
  const payload = {
    claimId: String(context.claim._id),
    payerId: normalizeText(context.claim.payerId),
    claimType: normalizeText(context.claim.claimType),
    frequencyCode: normalizeText(context.claim.frequencyCode),
    totalChargeAmount: context.claim.totalChargeAmount,
    diagnosisCodes: (context.claim.diagnosisCodes ?? []).map((code: unknown) => normalizeText(code)).filter(Boolean),
    claimLines: (context.claim.claimLines ?? []).map((line: any) => ({
      lineNumber: line.lineNumber,
      cptCode: normalizeText(line.cptCode),
      modifiers: (line.modifiers ?? []).map((value: unknown) => normalizeText(value)).filter(Boolean),
      icdPointers: (line.icdPointers ?? []).filter((value: unknown) => typeof value === 'number'),
      units: line.units,
      chargeAmount: line.chargeAmount,
      renderingProviderId: normalizeText(line.renderingProviderId),
      placeOfService: normalizeText(line.placeOfService),
      serviceDateFrom: normalizeDate(line.serviceDateFrom)?.toISOString(),
      serviceDateTo: normalizeDate(line.serviceDateTo)?.toISOString(),
    })),
    memberId: normalizeText(context.insurancePolicy.memberId),
    ediPayerId: normalizeText(context.insurancePolicy.ediPayerId) ?? normalizeText(context.payer.ediPayerId),
    billingProviderNpi: normalizeText(context.facility.npi),
    renderingProviderNpi: normalizeText(context.renderingProvider.npi),
    facilityTaxId: normalizeText(context.facility.taxId),
  };

  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

function objectById(items: any[]) {
  return items.reduce<Map<string, any>>((map, item) => {
    if (item?._id) {
      map.set(String(item._id), item);
    }

    return map;
  }, new Map<string, any>());
}

async function resolvePayerByReference(payerReference?: string) {
  if (!payerReference) {
    return null;
  }

  const payerConditions: Array<Record<string, unknown>> = [{ payerId: payerReference }];

  if (payerReference.match(/^[0-9a-fA-F]{24}$/)) {
    payerConditions.push({ _id: payerReference });
  }

  return Payer.findOne({
    active: true,
    isDeleted: false,
    $or: payerConditions,
  });
}

async function resolveActiveInsurancePolicy(
  patientId: any,
  options: {
    payerId?: unknown;
    coveragePriority?: unknown;
    serviceDate?: unknown;
  } = {}
) {
  if (!patientId) {
    return null;
  }

  const baseFilter = {
    patientId,
    coverageType: { $not: /^self pay$/i },
    active: true,
    isDeleted: false,
  };
  const payerReference = normalizeText(options.payerId);
  const coveragePriority = normalizeText(options.coveragePriority);
  const serviceDate = normalizeDate(options.serviceDate);
  const validForServiceDate = (policy: any) => (
    !serviceDate
    || (
      (!normalizeDate(policy.effectiveDate) || normalizeDate(policy.effectiveDate)! <= serviceDate)
      && (!normalizeDate(policy.terminationDate) || normalizeDate(policy.terminationDate)! >= serviceDate)
    )
  );
  const findValidPolicy = (policies: any[]) => serviceDate
    ? policies.find(validForServiceDate) ?? null
    : policies[0] ?? null;

  if (payerReference) {
    const payerMatchedPolicies = await InsurancePolicy.find({
      ...baseFilter,
      $or: [{ payerId: payerReference }, { ediPayerId: payerReference }],
    }).sort({ coordinationOfBenefitsOrder: 1, updated: -1 });
    const payerMatchedPolicy = findValidPolicy(payerMatchedPolicies);

    if (payerMatchedPolicy) {
      return payerMatchedPolicy;
    }
  }

  if (coveragePriority) {
    const prioritizedPolicies = await InsurancePolicy.find({
      ...baseFilter,
      coveragePriority,
    }).sort({ coordinationOfBenefitsOrder: 1, updated: -1 });
    const prioritizedPolicy = findValidPolicy(prioritizedPolicies);

    if (prioritizedPolicy) {
      return prioritizedPolicy;
    }
  }

  const policies = await InsurancePolicy.find(baseFilter).sort({ coordinationOfBenefitsOrder: 1, updated: -1 });
  return findValidPolicy(policies);
}

async function resolveSubmissionContext(claim: any, locale: string): Promise<ClaimSubmissionContext> {
  const [patient, billingProvider, renderingProvider, facility] = await Promise.all([
    Patient.findOne({ _id: claim.patientId, isDeleted: false, active: true }),
    claim.billingProviderId
      ? Provider.findOne({ _id: claim.billingProviderId, isDeleted: false, active: true })
      : null,
    claim.renderingProviderId
      ? Provider.findOne({ _id: claim.renderingProviderId, isDeleted: false, active: true })
      : null,
    claim.facilityId
      ? Facility.findOne({ _id: claim.facilityId, isDeleted: false, active: true })
      : null,
  ]);

  if (!patient) {
    throw new AppError(t('patient.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
  }

  if (!facility) {
    throw buildValidationError('Claim cannot be submitted until the billing facility is active.');
  }

  const insurancePolicy = await resolveActiveInsurancePolicy(claim.patientId, {
    payerId: claim.payerId,
    coveragePriority: claim.coveragePriority,
    serviceDate: claim.claimLines?.[0]?.serviceDateFrom ?? claim.claimDate,
  });

  if (!insurancePolicy) {
    throw buildValidationError('Claim cannot be submitted without an active insurance policy.');
  }

  const payer = await resolvePayerByReference(normalizeText(claim.payerId) ?? insurancePolicy.payerId);

  if (!payer) {
    throw buildValidationError('Claim cannot be submitted until the payer is configured.');
  }

  const resolvedRenderingProvider = renderingProvider ?? billingProvider;

  if (!resolvedRenderingProvider) {
    throw buildValidationError('Claim cannot be submitted until the rendering provider is active.');
  }

  const authorizationIds = (claim.claimLines ?? [])
    .map((line: any) => normalizeText(line.priorAuthorizationId?.toString?.() ?? line.priorAuthorizationId))
    .filter((value: string | undefined): value is string => Boolean(value));
  const referralIds = (claim.claimLines ?? [])
    .map((line: any) => normalizeText(line.referralId?.toString?.() ?? line.referralId))
    .filter((value: string | undefined): value is string => Boolean(value));
  const [authorizations, referrals] = await Promise.all([
    authorizationIds.length
      ? PriorAuthorization.find({ _id: { $in: authorizationIds }, isDeleted: false, active: true })
      : [],
    referralIds.length
      ? Referral.find({ _id: { $in: referralIds }, isDeleted: false, active: true })
      : [],
  ]);
  const authorizationsById = objectById(authorizations);
  const referralsById = objectById(referrals);
  const claimObject = typeof claim.toObject === 'function' ? claim.toObject() : claim;
  const enrichedClaim = {
    ...claimObject,
    claimLines: (claimObject.claimLines ?? []).map((line: any) => {
      const authorization = line.priorAuthorizationId
        ? authorizationsById.get(String(line.priorAuthorizationId))
        : null;
      const referral = line.referralId
        ? referralsById.get(String(line.referralId))
        : null;

      return {
        ...line,
        priorAuthorizationNumber: authorization?.authNumber,
        referralNumber: referral?.referralNumber,
      };
    }),
  };
  const billingProviderObject = typeof billingProvider?.toObject === 'function'
    ? billingProvider.toObject()
    : billingProvider;
  const billingProviderRecord = billingProviderObject as any;

  return {
    claim: enrichedClaim,
    patient,
    insurancePolicy,
    payer,
    billingProvider: {
      ...(billingProviderRecord ?? {}),
      taxId: billingProviderRecord?.taxId ?? facility.taxId,
    },
    renderingProvider: resolvedRenderingProvider,
    facility,
  };
}

function normalizeClaimSubmissionData(data: any) {
  const normalizedData = { ...data };

  if (data.claimId !== undefined) {
    normalizedData.claimId = normalizeText(data.claimId);
  }

  if (data.previousSubmissionId !== undefined) {
    normalizedData.previousSubmissionId = normalizeText(data.previousSubmissionId);
  }

  if (data.submissionType !== undefined) {
    normalizedData.submissionType = normalizeText(data.submissionType);
  }

  if (data.submissionMethod !== undefined) {
    normalizedData.submissionMethod = normalizeText(data.submissionMethod);
  }

  if (data.submissionFileType !== undefined) {
    normalizedData.submissionFileType = normalizeText(data.submissionFileType);
  }

  if (data.payloadFormat !== undefined) {
    normalizedData.payloadFormat = normalizeText(data.payloadFormat);
  }

  if (data.submissionDateTime !== undefined) {
    normalizedData.submissionDateTime = normalizeDate(data.submissionDateTime);
  }

  if (data.clearinghouseName !== undefined) {
    normalizedData.clearinghouseName = normalizeText(data.clearinghouseName);
  }

  if (data.clearinghouseEndpoint !== undefined) {
    normalizedData.clearinghouseEndpoint = normalizeText(data.clearinghouseEndpoint);
  }

  if (data.batchId !== undefined) {
    normalizedData.batchId = normalizeText(data.batchId);
  }

  if (data.submissionTraceId !== undefined) {
    normalizedData.submissionTraceId = normalizeText(data.submissionTraceId);
  }

  if (data.externalSubmissionId !== undefined) {
    normalizedData.externalSubmissionId = normalizeText(data.externalSubmissionId);
  }

  if (data.externalBatchId !== undefined) {
    normalizedData.externalBatchId = normalizeText(data.externalBatchId);
  }

  if (data.controlNumber !== undefined) {
    normalizedData.controlNumber = normalizeText(data.controlNumber);
  }

  if (data.claimControlNumber !== undefined) {
    normalizedData.claimControlNumber = normalizeText(data.claimControlNumber);
  }

  if (data.clearinghouseTraceNumber !== undefined) {
    normalizedData.clearinghouseTraceNumber = normalizeText(data.clearinghouseTraceNumber);
  }

  if (data.payerClaimNumber !== undefined) {
    normalizedData.payerClaimNumber = normalizeText(data.payerClaimNumber);
  }

  if (data.idempotencyKey !== undefined) {
    normalizedData.idempotencyKey = normalizeText(data.idempotencyKey);
  }

  if (data.retrySequence !== undefined) {
    normalizedData.retrySequence =
      typeof data.retrySequence === 'number' && Number.isFinite(data.retrySequence)
        ? data.retrySequence
        : undefined;
  }

  if (data.retryCount !== undefined) {
    normalizedData.retryCount =
      typeof data.retryCount === 'number' && Number.isFinite(data.retryCount)
        ? data.retryCount
        : undefined;
  }

  if (data.retryable !== undefined) {
    normalizedData.retryable = Boolean(data.retryable);
  }

  if (data.lastRetryAt !== undefined) {
    normalizedData.lastRetryAt = normalizeDate(data.lastRetryAt);
  }

  if (data.payloadSnapshot !== undefined) {
    normalizedData.payloadSnapshot =
      typeof data.payloadSnapshot === 'string' ? data.payloadSnapshot : serializePayload(data.payloadSnapshot);
  }

  if (data.requestPayloadRedacted !== undefined) {
    normalizedData.requestPayloadRedacted =
      typeof data.requestPayloadRedacted === 'string' ? data.requestPayloadRedacted : redactClaimSubmissionPayload(data.requestPayloadRedacted);
  }

  if (data.responsePayloadRedacted !== undefined) {
    normalizedData.responsePayloadRedacted =
      typeof data.responsePayloadRedacted === 'string' ? data.responsePayloadRedacted : redactClaimSubmissionPayload(data.responsePayloadRedacted);
  }

  if (data.status !== undefined) {
    normalizedData.status = normalizeText(data.status);
    normalizedData.normalizedStatus = normalizeLifecycleStatus(data.status);
  }

  if (data.trackingSource !== undefined) {
    normalizedData.trackingSource = normalizeText(data.trackingSource)?.toUpperCase() === 'SIMULATED'
      ? 'SIMULATED'
      : 'REAL';
  }

  if (data.responseType !== undefined) {
    normalizedData.responseType = normalizeText(data.responseType)?.toUpperCase();
  }

  if (data.normalizedStatus !== undefined) {
    normalizedData.normalizedStatus = normalizeClaimLifecycleStatus(data.normalizedStatus);
  }

  if (data.transmissionStatus !== undefined) {
    normalizedData.transmissionStatus = normalizeText(data.transmissionStatus);
  }

  if (data.acknowledgementStatus !== undefined) {
    normalizedData.acknowledgementStatus = normalizeText(data.acknowledgementStatus);
  }

  if (data.acknowledgementType !== undefined) {
    normalizedData.acknowledgementType = normalizeText(data.acknowledgementType);
  }

  if (data.acknowledgementDateTime !== undefined) {
    normalizedData.acknowledgementDateTime = normalizeDate(data.acknowledgementDateTime);
  }

  if (data.responseStatusCode !== undefined) {
    normalizedData.responseStatusCode =
      typeof data.responseStatusCode === 'number' && Number.isFinite(data.responseStatusCode)
        ? data.responseStatusCode
        : undefined;
  }

  if (data.rawResponsePayload !== undefined) {
    normalizedData.rawResponsePayload =
      typeof data.rawResponsePayload === 'string' ? data.rawResponsePayload : serializePayload(data.rawResponsePayload);
  }

  if (data.rawAcknowledgementPayload !== undefined) {
    normalizedData.rawAcknowledgementPayload =
      typeof data.rawAcknowledgementPayload === 'string'
        ? data.rawAcknowledgementPayload
        : serializePayload(data.rawAcknowledgementPayload);
  }

  if (data.submissionErrorCode !== undefined) {
    normalizedData.submissionErrorCode = normalizeText(data.submissionErrorCode);
  }

  if (data.submissionErrorMessage !== undefined) {
    normalizedData.submissionErrorMessage = normalizeText(data.submissionErrorMessage);
  }

  if (data.lastError !== undefined) {
    normalizedData.lastError = normalizeText(data.lastError);
  }

  if (data.submittedAt !== undefined) {
    normalizedData.submittedAt = normalizeDate(data.submittedAt);
  }

  if (data.submittedBy !== undefined) {
    normalizedData.submittedBy = normalizeText(data.submittedBy);
  }

  return normalizedData;
}

async function createTrackingEvent(
  claimId: string,
  payload: {
    claimSubmissionId?: string;
    trackingSource?: 'REAL' | 'SIMULATED';
    responseType?: 'SUBMISSION' | 'ACK_999' | 'ACK_277CA' | 'STATUS_UPDATE';
    eventType?: any;
    normalizedStatus?: any;
    source?: string;
    rawStatusCode?: string;
    summary?: string;
    controlNumber?: string;
    externalSubmissionId?: string;
    claimControlNumber?: string;
    clearinghouseTraceNumber?: string;
    payerClaimNumber?: string;
    acknowledgementType?: string;
    statusCode?: string;
    statusDescription?: string;
    receivedDate?: Date;
    rejectionLevel?: string;
    rejectionSource?: string;
    rejectionReasonCodes?: string[];
    stcCategoryCode?: string;
    stcStatusCode?: string;
    stcEntityCode?: string;
    affectedServiceLine?: string;
    remediationCode?: string;
    remediationFieldPath?: string;
    remediationSeverity?: 'BLOCKING' | 'WARNING';
    nextActionRequired?: string;
    responseStatusCode?: number;
    responsePayloadRedacted?: string;
  },
  createdBy?: string
) {
  await createClaimLifecycleEvent({
    claimId,
    claimSubmissionId: payload.claimSubmissionId,
    trackingSource: payload.trackingSource ?? 'REAL',
    source: payload.source,
    responseType: payload.responseType ?? 'STATUS_UPDATE',
    eventType: payload.eventType ?? 'CLAIM_STATUS_UPDATED',
    normalizedStatus: payload.normalizedStatus,
    timestamp: payload.receivedDate ?? new Date(),
    rawStatusCode: payload.rawStatusCode ?? payload.statusCode,
    summary: payload.summary ?? payload.statusDescription ?? payload.statusCode ?? 'Claim tracking status updated.',
    controlNumber: payload.controlNumber ?? payload.claimControlNumber,
    externalSubmissionId: payload.externalSubmissionId,
    claimControlNumber: payload.claimControlNumber,
    clearinghouseTraceNumber: payload.clearinghouseTraceNumber,
    payerClaimNumber: payload.payerClaimNumber,
    acknowledgementType: payload.acknowledgementType,
    statusDescription: payload.statusDescription,
    rejectionLevel: payload.rejectionLevel,
    rejectionSource: payload.rejectionSource,
    rejectionReasonCodes: payload.rejectionReasonCodes ?? [],
    stcCategoryCode: payload.stcCategoryCode,
    stcStatusCode: payload.stcStatusCode,
    stcEntityCode: payload.stcEntityCode,
    affectedServiceLine: payload.affectedServiceLine,
    remediationCode: payload.remediationCode,
    remediationFieldPath: payload.remediationFieldPath,
    remediationSeverity: payload.remediationSeverity,
    nextActionRequired: payload.nextActionRequired,
    responseStatusCode: payload.responseStatusCode,
    responsePayloadRedacted: payload.responsePayloadRedacted,
    createdBy,
  });

  if (normalizeClaimLifecycleStatus(payload.normalizedStatus ?? payload.statusCode ?? payload.statusDescription) === 'REJECTED') {
    await denialWorkflowService.ensureArWorkItemForRejectedClaim({
      claimId,
      reason: payload.summary ?? payload.statusDescription ?? payload.statusCode,
      sourceId: payload.claimSubmissionId,
      createdBy,
    });
  }
}

async function syncClaimSubmissionState(claim: any, submission: any, updatedBy: string) {
  const transmissionStatus = normalizeText(submission.transmissionStatus) ?? 'Submitted';
  const acknowledgementStatus = normalizeText(submission.acknowledgementStatus);
  const isRejected =
    normalizeLifecycleStatus(acknowledgementStatus ?? transmissionStatus) === 'REJECTED';
  const isFailed = normalizeLifecycleStatus(transmissionStatus) === 'FAILED';

  if (isFailed) {
    claim.claimStatus = 'Ready for Submission';
    claim.submissionStatus = 'Failed';
    claim.ediStatus = submission.submissionErrorMessage ?? transmissionStatus;
  } else if (isRejected) {
    claim.claimStatus = 'Rejected';
    claim.submissionStatus = 'Rejected';
    claim.ediStatus = acknowledgementStatus ?? transmissionStatus;
    claim.rejectionReason =
      submission.submissionErrorMessage
      ?? acknowledgementStatus
      ?? transmissionStatus;
    await claimRejectionService.createFromSubmission(
      claim,
      submission,
      {
        rejectionCode: submission.submissionErrorCode,
        rejectionReason: claim.rejectionReason,
        payerResponse: {
          acknowledgementStatus,
          transmissionStatus,
          responseStatusCode: submission.responseStatusCode,
          responsePayloadRedacted: submission.responsePayloadRedacted,
        },
      },
      updatedBy
    );
  } else if (normalizeText(submission.submissionMethod) === 'Paper') {
    claim.claimStatus = 'Submitted';
    claim.submissionStatus = 'Printed';
    claim.ediStatus = acknowledgementStatus ?? transmissionStatus;
    claim.rejectionReason = undefined;
  } else if (normalizeLifecycleStatus(acknowledgementStatus) === 'ACCEPTED') {
    claim.claimStatus = 'Submitted';
    claim.submissionStatus = 'Acknowledged';
    claim.closureStatus = 'AWAITING_ERA';
    claim.expectedEraBy = claim.expectedEraBy ?? new Date(Date.now() + envConfig.rcmAwaitingEraThresholdDays * 24 * 60 * 60 * 1000);
    claim.ediStatus = acknowledgementStatus;
    claim.rejectionReason = undefined;
  } else {
    claim.claimStatus = 'Submitted';
    claim.submissionStatus = 'Transmitted';
    claim.ediStatus = acknowledgementStatus ?? transmissionStatus;
    claim.rejectionReason = undefined;
  }

  claim.batchId = submission.batchId;
  claim.clearingHouse = submission.clearinghouseName;
  claim.statusHistory = appendStatusHistory(
    claim.statusHistory,
    claim.claimStatus,
    updatedBy,
    submission.submissionErrorMessage
      ?? submission.acknowledgementStatus
      ?? submission.transmissionStatus
      ?? 'Claim submission state updated'
  );
  claim.updatedBy = updatedBy;
  claim.updated = new Date();
  await claim.save();

  if (claim.submissionStatus === 'Acknowledged') {
    await claimClosureService.syncClaimClosureStatus(String(claim._id), updatedBy);
  }

  publishRcmRealtimeEvent({
    eventType: claim.submissionStatus === 'Acknowledged' ? 'ACKNOWLEDGEMENT_RECEIVED' : 'CLAIM_SUBMISSION_STATUS_CHANGED',
    title: claim.submissionStatus === 'Acknowledged' ? 'Claim acknowledged' : 'Claim submission state changed',
    message: `Claim ${claim.claimId ?? claim._id} submission status is ${claim.submissionStatus}.`,
    entityType: 'claim',
    entityId: String(claim._id),
    claimId: String(claim._id),
    status: claim.submissionStatus,
  });
}

function normalizeAcknowledgementData(data: any): AcknowledgementPayload {
  const acknowledgementStatus = normalizeText(data.acknowledgementStatus ?? data.status ?? data.acknowledgement?.status);
  const transmissionStatus = normalizeText(data.transmissionStatus ?? data.transactionStatus ?? data.transmission?.status);
  const normalizedPayload: AcknowledgementPayload = {
    submissionTraceId: normalizeText(data.submissionTraceId),
    externalSubmissionId: normalizeText(data.externalSubmissionId),
    claimId: normalizeText(data.claimId),
    batchId: normalizeText(data.batchId),
    acknowledgementType: normalizeText(data.acknowledgementType),
    acknowledgementStatus: acknowledgementStatus ? normalizeAcknowledgementStatus(acknowledgementStatus) : undefined,
    transmissionStatus: transmissionStatus ? normalizeLifecycleStatus(transmissionStatus) : undefined,
    claimControlNumber: normalizeText(data.claimControlNumber),
    clearinghouseTraceNumber: normalizeText(data.clearinghouseTraceNumber),
    payerClaimNumber: normalizeText(data.payerClaimNumber),
    statusCode: normalizeText(data.statusCode),
    statusDescription: normalizeText(data.statusDescription),
    receivedDate: normalizeDate(data.receivedDate),
    rejectionLevel: normalizeText(data.rejectionLevel),
    rejectionSource: normalizeText(data.rejectionSource),
    rejectionReasonCodes: normalizeStringArray(data.rejectionReasonCodes) ?? [],
    stcCategoryCode: normalizeText(data.stcCategoryCode),
    stcStatusCode: normalizeText(data.stcStatusCode),
    stcEntityCode: normalizeText(data.stcEntityCode),
    affectedServiceLine: normalizeText(data.affectedServiceLine),
    remediationCode: normalizeText(data.remediationCode),
    remediationFieldPath: normalizeText(data.remediationFieldPath),
    remediationSeverity: data.remediationSeverity === 'WARNING' ? 'WARNING' : data.remediationSeverity === 'BLOCKING' ? 'BLOCKING' : undefined,
    nextActionRequired: normalizeText(data.nextActionRequired),
    rawPayload: data.rawPayload ?? data,
  };
  const remediation = mapAcknowledgementToRemediation(normalizedPayload);

  return {
    ...normalizedPayload,
    remediationCode: normalizedPayload.remediationCode ?? remediation?.readinessCode,
    remediationFieldPath: normalizedPayload.remediationFieldPath ?? remediation?.fieldPath,
    remediationSeverity: normalizedPayload.remediationSeverity ?? remediation?.severity,
    nextActionRequired: normalizedPayload.nextActionRequired ?? remediation?.nextActionRequired,
    rejectionReasonCodes: remediation?.readinessCode
      ? Array.from(new Set([...(normalizedPayload.rejectionReasonCodes ?? []), remediation.readinessCode]))
      : normalizedPayload.rejectionReasonCodes,
  };
}

function getAcknowledgementResponseType(value: unknown): 'ACK_999' | 'ACK_277CA' | 'STATUS_UPDATE' {
  const normalizedValue = normalizeText(value)?.toUpperCase() ?? '';

  if (normalizedValue.includes('999')) {
    return 'ACK_999';
  }

  if (normalizedValue.includes('277')) {
    return 'ACK_277CA';
  }

  return 'STATUS_UPDATE';
}

function getAcknowledgementEventType(responseType: 'ACK_999' | 'ACK_277CA' | 'STATUS_UPDATE', status: string) {
  const normalizedStatus = normalizeLifecycleStatus(status);

  if (responseType === 'ACK_999') {
    return normalizedStatus === 'REJECTED' ? 'ACK_999_REJECTED' : 'ACK_999_ACCEPTED';
  }

  if (responseType === 'ACK_277CA') {
    if (normalizedStatus === 'REJECTED') {
      return 'ACK_277CA_REJECTED';
    }

    return normalizedStatus === 'PENDING' ? 'CLAIM_PENDING' : 'ACK_277CA_ACCEPTED';
  }

  return normalizedStatus === 'PENDING' ? 'CLAIM_PENDING' : 'CLAIM_STATUS_UPDATED';
}

function getRetryableFlag(retrySequence: number, transmissionStatus?: string, acknowledgementStatus?: string) {
  if (retrySequence >= claimSubmissionIntegrationConfig.request.maxRetries) {
    return false;
  }

  const status =
    normalizeText(acknowledgementStatus)
    ?? normalizeText(transmissionStatus);

  return status ? RETRYABLE_SUBMISSION_STATUSES.has(status) : false;
}

function buildAcknowledgementStatusDescription(payload: AcknowledgementPayload) {
  if (payload.statusDescription) {
    return payload.statusDescription;
  }

  if (payload.rejectionReasonCodes?.length) {
    return `Rejection reason codes: ${payload.rejectionReasonCodes.join(', ')}`;
  }

  return payload.acknowledgementStatus ?? payload.transmissionStatus;
}

async function applySimulatedLifecycleOutcome(options: {
  claim: any;
  submission: any;
  context: ClaimSubmissionContext;
  updatedBy: string;
  reason?: string;
}) {
  const outcome = await createSimulatedTestLifecycle({
    claimId: String(options.claim._id),
    submission: options.submission,
    context: options.context,
    createdBy: options.updatedBy,
    reason: options.reason,
  });

  options.submission.externalSubmissionId =
    options.submission.externalSubmissionId ?? `SIM-${String(options.submission._id).slice(-10).toUpperCase()}`;
  options.submission.trackingSource = 'SIMULATED';
  options.submission.responseType =
    outcome.acknowledgementType === '999'
      ? 'ACK_999'
      : outcome.finalStatus === 'PENDING'
        ? 'STATUS_UPDATE'
        : 'ACK_277CA';
  options.submission.normalizedStatus = outcome.finalStatus;
  options.submission.transmissionStatus = outcome.finalStatus;
  options.submission.status = outcome.finalStatus;
  options.submission.acknowledgementType =
    outcome.acknowledgementType === '999'
      ? '999 Functional Acknowledgement'
      : '277CA Claim Acknowledgement';
  options.submission.acknowledgementStatus = outcome.acknowledgementStatus;
  options.submission.acknowledgementDateTime = new Date();
  options.submission.submissionErrorCode = outcome.submissionErrorCode;
  options.submission.submissionErrorMessage = outcome.submissionErrorMessage ?? outcome.statusDescription;
  options.submission.responseStatusCode = 200;
  options.submission.responsePayloadRedacted = redactClaimSubmissionPayload({
    trackingSource: 'SIMULATED',
    responseType: options.submission.responseType,
    statusCode: outcome.statusCode,
    statusDescription: outcome.statusDescription,
    reason: options.reason,
  });
  options.submission.retryable = outcome.retryable;
  options.submission.updatedBy = options.updatedBy;
  options.submission.updated = new Date();
  await options.submission.save();

  await syncClaimSubmissionState(options.claim, options.submission, options.updatedBy);

  return {
    outcome,
    claimSubmission: options.submission,
  };
}

function splitX12Segments(payload: string) {
  const segmentTerminator = payload.includes('~') ? '~' : '\n';
  return payload
    .split(segmentTerminator)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function readSegmentValue(segments: string[], segmentId: string, position: number) {
  const segment = segments.find((item) => item.startsWith(`${segmentId}*`));
  return segment?.split('*')[position];
}

function splitStcComposite(value?: string) {
  const [categoryCode, statusCode, entityCode] = normalizeText(value)
    ?.split(/[:>]/)
    .map((item) => item.trim())
    ?? [];

  return {
    categoryCode: normalizeText(categoryCode),
    statusCode: normalizeText(statusCode),
    entityCode: normalizeText(entityCode),
  };
}

function parseX12AcknowledgementPayload(data: any): AcknowledgementPayload {
  const x12Payload = typeof data.x12Payload === 'string'
    ? data.x12Payload
    : typeof data.payload === 'string'
      ? data.payload
      : '';

  if (!x12Payload.trim()) {
    throw buildValidationError('X12 acknowledgement payload is required.');
  }

  const segments = splitX12Segments(x12Payload);
  const transactionSet = readSegmentValue(segments, 'ST', 1);
  const ak9 = segments.find((segment) => segment.startsWith('AK9*'))?.split('*');
  const ik5 = segments.find((segment) => segment.startsWith('IK5*'))?.split('*');
  const stc = segments.find((segment) => segment.startsWith('STC*'))?.split('*');
  const clp = segments.find((segment) => segment.startsWith('CLP*'))?.split('*');
  const trn = segments.find((segment) => segment.startsWith('TRN*'))?.split('*');
  const ref6r = segments.find((segment) => segment.startsWith('REF*6R*'))?.split('*');
  const stcComposite = splitStcComposite(stc?.[1]);
  const claimControlNumber =
    normalizeText(data.claimControlNumber)
    ?? normalizeText(readSegmentValue(segments, 'BHT', 3))
    ?? normalizeText(clp?.[1]);
  const acknowledgementCode = normalizeText(ak9?.[1] ?? ik5?.[1] ?? stc?.[1]);
  const functionalAcknowledgementCode = normalizeText(ak9?.[1] ?? ik5?.[1]);
  const stcCategoryCode = stcComposite.categoryCode;
  const rejected277Categories = new Set(['A3', 'A6', 'A7', 'A8']);
  const accepted277Categories = new Set(['A1', 'A2']);
  const rejectedFunctionalCodes = new Set(['R', 'M', 'X']);
  const acceptedFunctionalCodes = new Set(['A', 'E']);
  const rejected = Boolean(
    functionalAcknowledgementCode
      ? Array.from(rejectedFunctionalCodes).some((code) => functionalAcknowledgementCode.startsWith(code))
      : stcCategoryCode && (rejected277Categories.has(stcCategoryCode) || stcCategoryCode.startsWith('R'))
  );
  const accepted = Boolean(
    functionalAcknowledgementCode
      ? Array.from(acceptedFunctionalCodes).some((code) => functionalAcknowledgementCode.startsWith(code))
      : stcCategoryCode && accepted277Categories.has(stcCategoryCode)
  );
  const pending = acknowledgementCode && acknowledgementCode.startsWith('P');

  if (!transactionSet || !acknowledgementCode || (!accepted && !rejected && !pending)) {
    throw buildValidationError('Unsupported acknowledgement format. Provide a 999 or 277CA payload with AK9, IK5, or STC status code.');
  }

  const acknowledgementType =
    transactionSet === '999'
      ? '999 Functional Acknowledgement'
      : transactionSet === '277'
        ? '277CA Claim Acknowledgement'
        : transactionSet === '835'
          ? '835 ERA'
          : 'X12 Acknowledgement';

  return {
    submissionTraceId: normalizeText(data.submissionTraceId) ?? normalizeText(trn?.[2]),
    externalSubmissionId: normalizeText(data.externalSubmissionId),
    claimId: normalizeText(data.claimId),
    batchId: normalizeText(data.batchId),
    acknowledgementType,
    acknowledgementStatus: rejected ? 'REJECTED' : accepted ? 'ACCEPTED' : 'PENDING',
    transmissionStatus: rejected ? 'REJECTED' : accepted ? 'ACCEPTED' : 'PENDING',
    claimControlNumber,
    clearinghouseTraceNumber: normalizeText(data.clearinghouseTraceNumber) ?? normalizeText(trn?.[2]),
    payerClaimNumber: normalizeText(data.payerClaimNumber) ?? normalizeText(clp?.[7]),
    statusCode: acknowledgementCode,
    statusDescription:
      normalizeText(data.statusDescription)
      ?? (transactionSet === '835'
        ? 'ERA received for submitted claim.'
        : rejected
          ? `Native X12 acknowledgement indicates rejection${stcComposite.categoryCode ? ` (${stcComposite.categoryCode}${stcComposite.statusCode ? `/${stcComposite.statusCode}` : ''}${stcComposite.entityCode ? `/${stcComposite.entityCode}` : ''})` : ''}.`
          : accepted
            ? 'Native X12 acknowledgement accepted.'
            : 'Native X12 acknowledgement is pending.'),
    receivedDate: normalizeDate(data.receivedDate) ?? new Date(),
    rejectionLevel: rejected ? acknowledgementType : undefined,
    rejectionSource: rejected ? 'Clearinghouse/Payer X12' : undefined,
    rejectionReasonCodes: rejected && acknowledgementCode
      ? [
        acknowledgementCode,
        stcComposite.categoryCode,
        stcComposite.statusCode,
        stcComposite.entityCode,
      ].filter((value): value is string => Boolean(value))
      : [],
    stcCategoryCode: stcComposite.categoryCode,
    stcStatusCode: stcComposite.statusCode,
    stcEntityCode: stcComposite.entityCode,
    affectedServiceLine: normalizeText(data.affectedServiceLine) ?? normalizeText(ref6r?.[2]),
    nextActionRequired: rejected ? 'Correct X12 acknowledgement errors and resubmit.' : 'Continue claim status tracking.',
    rawPayload: {
      x12Payload,
      parsedTransactionSet: transactionSet,
      source: 'native-x12-parser',
    },
  };
}

export const claimSubmissionService = {
  async create(data: any, locale: string, createdBy: string) {
    const normalizedData = normalizeClaimSubmissionData(data);

    if (normalizedData.claimId) {
      const relatedClaim = await Claim.findOne({
        _id: normalizedData.claimId,
        isDeleted: false,
      });

      if (!relatedClaim) {
        throw new AppError(t('claim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
      }
    }

    const item = await ClaimSubmission.create({
      ...normalizedData,
      active: normalizedData.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    });

    return item;
  },

  async getById(id: string, locale: string) {
    const item = await ClaimSubmission.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('claimSubmission.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async getLatestForClaim(claimId: string) {
    return ClaimSubmission.findOne({
      claimId,
      isDeleted: false,
      active: true,
    }).sort({ submissionDateTime: -1, created: -1 });
  },

  async submitClaim(claimId: string, locale: string, updatedBy: string, options?: { previousSubmissionId?: string | null }): Promise<ClaimSubmissionAttemptResult> {
    const duration = createRcmLogTimer();
    const claim = await Claim.findOne({ _id: claimId, isDeleted: false });

    if (!claim) {
      throw new AppError(t('claim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    if (claim.claimType === 'Institutional') {
      throw buildValidationError('837I institutional claim submission is not implemented.');
    }

    const context = await resolveSubmissionContext(claim, locale);
    const submissionMethod =
      context.payer?.claimsSubmissionMethod === 'Paper' ? 'Paper' : 'Electronic';
    const idempotencyKey = buildClaimFingerprint(context);

    const latestMatchingSubmission = await ClaimSubmission.findOne({
      claimId: claim._id,
      idempotencyKey,
      isDeleted: false,
      active: true,
    }).sort({ retrySequence: -1, created: -1 });

    if (
      latestMatchingSubmission
      && !options?.previousSubmissionId
      && DUPLICATE_SAFE_SUBMISSION_STATUSES.has(normalizeText(latestMatchingSubmission.transmissionStatus) ?? '')
    ) {
      return {
        claimSubmission: latestMatchingSubmission,
        idempotent: true,
      };
    }

    const previousSubmissionId = options?.previousSubmissionId ?? latestMatchingSubmission?._id ?? null;
    const retrySequence = previousSubmissionId
      ? (latestMatchingSubmission?.retrySequence ?? 1) + 1
      : 1;
    const batchId = buildBatchId();
    const submissionTraceId = buildSubmissionTraceId(String(claim._id), retrySequence);
    const claimControlNumber = buildClaimControlNumber(String(claim._id), retrySequence);
    const interchangeControlNumber = buildControlNumber(`${Date.now()}${retrySequence}`);
    const groupControlNumber = buildControlNumber(`${Date.now()}${retrySequence + 1}`);
    const transactionSetControlNumber = buildControlNumber(`${Date.now()}${retrySequence + 2}`, 4);

    let rawPayloadSnapshot = '';
    let submissionFileType = claim.claimType === 'Institutional' ? '837I' : '837P';
    let payloadFormat = submissionFileType;

    if (submissionMethod === 'Electronic') {
      if (isTestModeLifecycleSimulationEnabled() && hasSimulatedAcknowledgementDefect(context)) {
        rawPayloadSnapshot = buildSimulatedInvalid837Snapshot(context, claimControlNumber);
      } else {
        const ediOptions = {
          senderId: claimSubmissionIntegrationConfig.request.senderId,
          receiverId: claimSubmissionIntegrationConfig.request.receiverId,
          submitterId: claimSubmissionIntegrationConfig.request.submitterId,
          submitterName: claimSubmissionIntegrationConfig.request.submitterName,
          receiverName: claimSubmissionIntegrationConfig.request.receiverName,
          contactName: claimSubmissionIntegrationConfig.request.contactName,
          contactPhone: claimSubmissionIntegrationConfig.request.contactPhone,
          usageIndicator: claimSubmissionIntegrationConfig.request.usageIndicator,
          interchangeControlNumber,
          groupControlNumber,
          transactionSetControlNumber,
          claimControlNumber,
        };

        const validationResult = validate837ProfessionalClaim(
          context,
          ediOptions,
          getPayerSpecific837PValidators(context),
        );
        if (!validationResult.valid) {
          logRcmEvent({
            module: 'rcm.claimSubmission',
            eventType: '837P_VALIDATION',
            status: 'FAILED',
            correlationId: claimControlNumber,
            userId: updatedBy,
            durationMs: duration(),
            errorCode: '837P_VALIDATION_BLOCKED',
            metadata: {
              claimId,
              findings: validationResult.findings,
            },
          });
          throw build837ValidationError(validationResult.findings);
        }

        const ediPayload = build837ProfessionalClaimPayload(context, ediOptions);

        rawPayloadSnapshot = ediPayload.payload;
        submissionFileType = ediPayload.fileType;
        payloadFormat = ediPayload.fileType;
      }
    } else {
      submissionFileType = claim.claimType === 'Institutional' ? 'CMS-1450' : 'CMS-1500';
      payloadFormat = submissionFileType;
      rawPayloadSnapshot = buildPaperPayloadSnapshot(context, claimControlNumber);
    }

    const submissionRecord = await ClaimSubmission.create({
      claimId: claim._id,
      previousSubmissionId,
      submissionType: submissionFileType,
      submissionMethod,
      submissionFileType,
      payloadFormat,
      submissionDateTime: new Date(),
      submittedAt: new Date(),
      submittedBy: updatedBy,
      clearinghouseName:
        submissionMethod === 'Electronic'
          ? claimSubmissionIntegrationConfig.vendorName
          : 'Paper',
      clearinghouseEndpoint:
        submissionMethod === 'Electronic'
          ? claimSubmissionIntegrationConfig.request.submitUrl
          : undefined,
      batchId,
      submissionTraceId,
      controlNumber: claimControlNumber,
      claimControlNumber,
      idempotencyKey,
      retrySequence,
      retryCount: Math.max(0, retrySequence - 1),
      payloadSnapshot: storedPayloadSnapshot(rawPayloadSnapshot),
      requestPayloadRedacted: redactClaimSubmissionPayload(rawPayloadSnapshot),
      trackingSource: 'REAL',
      responseType: 'SUBMISSION',
      normalizedStatus: submissionMethod === 'Electronic' ? 'PENDING' : 'SUBMITTED',
      status: submissionMethod === 'Electronic' ? 'PENDING' : 'PRINTED',
      transmissionStatus: submissionMethod === 'Electronic' ? 'PENDING' : 'PRINTED',
      acknowledgementStatus:
        submissionMethod === 'Electronic' ? 'Pending Acknowledgement' : 'Pending Mailing',
      retryable: false,
      active: true,
      created: new Date(),
      updated: new Date(),
      createdBy: updatedBy,
      updatedBy,
    });

    await createTrackingEvent(
      String(claim._id),
      {
        claimSubmissionId: String(submissionRecord._id),
        trackingSource: 'REAL',
        responseType: 'SUBMISSION',
        eventType: 'SUBMISSION_CREATED',
        normalizedStatus: submissionMethod === 'Electronic' ? 'PENDING' : 'SUBMITTED',
        claimControlNumber,
        clearinghouseTraceNumber: submissionTraceId,
        statusCode: submissionMethod === 'Electronic' ? 'PENDING' : 'PRINTED',
        statusDescription:
          submissionMethod === 'Electronic'
            ? '837P payload generated and submission attempt created.'
            : 'Paper claim generated and queued for manual mailing.',
        acknowledgementType: 'Submission',
        responsePayloadRedacted: submissionRecord.requestPayloadRedacted,
        nextActionRequired:
          submissionMethod === 'Electronic'
            ? 'Send claim to clearinghouse transport.'
            : 'Mail the paper claim and track manually.',
      },
      updatedBy
    );

    if (submissionMethod === 'Paper') {
      submissionRecord.retryable = false;
      submissionRecord.responseStatusCode = 200;
      const paperResponsePayload = {
        message: 'Paper claim generated for manual mailing.',
      };
      submissionRecord.rawResponsePayload = claimSubmissionIntegrationConfig.storage.storeRawPayloads
        ? serializePayload(paperResponsePayload)
        : undefined;
      submissionRecord.responsePayloadRedacted = redactClaimSubmissionPayload(paperResponsePayload);
      submissionRecord.status = 'Printed';
      submissionRecord.normalizedStatus = 'SUBMITTED';
      await submissionRecord.save();

      await createTrackingEvent(
        String(claim._id),
        {
          claimSubmissionId: String(submissionRecord._id),
          responseType: 'SUBMISSION',
          eventType: 'SUBMISSION_SENT',
          normalizedStatus: 'SUBMITTED',
          claimControlNumber,
          statusCode: 'PRINTED',
          statusDescription: 'Paper claim generated for manual mailing.',
          acknowledgementType: 'Paper',
        },
        updatedBy
      );

      await syncClaimSubmissionState(claim, submissionRecord, updatedBy);

      return {
        claimSubmission: submissionRecord,
        idempotent: false,
      };
    }

    if (isTestModeLifecycleSimulationEnabled() && hasSimulatedAcknowledgementDefect(context)) {
      submissionRecord.trackingSource = 'SIMULATED';
      submissionRecord.externalSubmissionId = `SIM-${String(submissionRecord._id).slice(-10).toUpperCase()}`;
      submissionRecord.clearinghouseTraceNumber = submissionTraceId;
      submissionRecord.transmissionStatus = 'SUBMITTED';
      submissionRecord.status = 'SUBMITTED';
      submissionRecord.normalizedStatus = 'SUBMITTED';
      submissionRecord.acknowledgementStatus = 'Pending simulated acknowledgement';
      await submissionRecord.save();

      await createTrackingEvent(
        String(claim._id),
        {
          claimSubmissionId: String(submissionRecord._id),
          trackingSource: 'SIMULATED',
          source: 'SIMULATED_TEST_RESPONSE',
          responseType: 'SUBMISSION',
          eventType: 'SUBMISSION_SENT',
          normalizedStatus: 'SUBMITTED',
          externalSubmissionId: submissionRecord.externalSubmissionId,
          claimControlNumber: submissionRecord.claimControlNumber,
          clearinghouseTraceNumber: submissionTraceId,
          statusCode: 'SUBMITTED',
          statusDescription: 'Test-mode submission attempt routed to deterministic lifecycle simulator.',
          acknowledgementType: 'Submission',
          responsePayloadRedacted: submissionRecord.requestPayloadRedacted,
          nextActionRequired: 'Review simulated 999/277CA acknowledgement outcome.',
        },
        updatedBy
      );

      await syncClaimSubmissionState(claim, submissionRecord, updatedBy);
      const simulatedResult = await applySimulatedLifecycleOutcome({
        claim,
        submission: submissionRecord,
        context,
        updatedBy,
        reason: '837P acknowledgement defects were detected before real clearinghouse transport.',
      });

      return {
        claimSubmission: simulatedResult.claimSubmission,
        idempotent: false,
      };
    }

    if (!isClaimSubmissionIntegrationConfigured()) {
      if (isTestModeLifecycleSimulationEnabled()) {
        submissionRecord.trackingSource = 'SIMULATED';
        submissionRecord.externalSubmissionId = `SIM-${String(submissionRecord._id).slice(-10).toUpperCase()}`;
        submissionRecord.clearinghouseTraceNumber = submissionTraceId;
        submissionRecord.transmissionStatus = 'SUBMITTED';
        submissionRecord.status = 'SUBMITTED';
        submissionRecord.normalizedStatus = 'SUBMITTED';
        submissionRecord.acknowledgementStatus = 'Pending simulated acknowledgement';
        submissionRecord.responseStatusCode = 200;
        submissionRecord.responsePayloadRedacted = redactClaimSubmissionPayload({
          trackingSource: 'SIMULATED',
          reason: 'Claim submission integration is unavailable in test mode.',
        });
        await submissionRecord.save();

        await createTrackingEvent(
          String(claim._id),
          {
            claimSubmissionId: String(submissionRecord._id),
            trackingSource: 'SIMULATED',
            source: 'SIMULATED_TEST_RESPONSE',
            responseType: 'SUBMISSION',
            eventType: 'SUBMISSION_SENT',
            normalizedStatus: 'SUBMITTED',
            externalSubmissionId: submissionRecord.externalSubmissionId,
            claimControlNumber: submissionRecord.claimControlNumber,
            clearinghouseTraceNumber: submissionTraceId,
            statusCode: 'SUBMITTED',
            statusDescription: 'Test-mode submission transport unavailable; deterministic lifecycle simulator used.',
            acknowledgementType: 'Submission',
            responsePayloadRedacted: submissionRecord.responsePayloadRedacted,
            nextActionRequired: 'Review simulated 999/277CA acknowledgement outcome.',
          },
          updatedBy
        );

        await syncClaimSubmissionState(claim, submissionRecord, updatedBy);
        const simulatedResult = await applySimulatedLifecycleOutcome({
          claim,
          submission: submissionRecord,
          context,
          updatedBy,
          reason: 'Real clearinghouse transport is unavailable in test mode.',
        });

        return {
          claimSubmission: simulatedResult.claimSubmission,
          idempotent: false,
        };
      }

      submissionRecord.transmissionStatus = 'FAILED';
      submissionRecord.status = 'FAILED';
      submissionRecord.normalizedStatus = 'FAILED';
      submissionRecord.acknowledgementStatus = 'Not Configured';
      submissionRecord.submissionErrorMessage =
        'Claim submission integration is not configured. Update the claim submission environment variables.';
      submissionRecord.lastError = submissionRecord.submissionErrorMessage;
      submissionRecord.retryable = getRetryableFlag(retrySequence, submissionRecord.transmissionStatus, submissionRecord.acknowledgementStatus);
      await submissionRecord.save();
      await syncClaimSubmissionState(claim, submissionRecord, updatedBy);

      await createTrackingEvent(
        String(claim._id),
        {
          claimSubmissionId: String(submissionRecord._id),
          responseType: 'SUBMISSION',
          eventType: 'SUBMISSION_FAILED',
          normalizedStatus: 'FAILED',
          claimControlNumber,
          clearinghouseTraceNumber: submissionTraceId,
          statusCode: 'FAILED',
          statusDescription: submissionRecord.submissionErrorMessage,
          acknowledgementType: 'Submission',
          nextActionRequired: 'Configure clearinghouse integration and retry.',
        },
        updatedBy
      );

      throw buildSubmissionFailureError(
        submissionRecord.submissionErrorMessage,
        HTTP_STATUS.BAD_GATEWAY,
        {
          claimSubmissionId: String(submissionRecord._id),
          transmissionStatus: submissionRecord.transmissionStatus,
          acknowledgementStatus: submissionRecord.acknowledgementStatus,
        }
      );
    }

    try {
      const transportResult = await sendClaimSubmission({
        claimId: String(claim._id),
        batchId,
        submissionTraceId,
        idempotencyKey,
        fileType: submissionFileType,
        payload: rawPayloadSnapshot,
        metadata: {
          claimControlNumber,
          payerId: context.payer.payerId,
          ediPayerId: context.insurancePolicy.ediPayerId ?? context.payer.ediPayerId,
          totalChargeAmount: claim.totalChargeAmount,
          patientMedicalRecordNumber: context.patient.medicalRecordNumber,
        },
      });

      submissionRecord.externalSubmissionId = transportResult.externalSubmissionId;
      submissionRecord.externalBatchId = transportResult.externalBatchId;
      submissionRecord.claimControlNumber =
        transportResult.claimControlNumber ?? submissionRecord.claimControlNumber;
      submissionRecord.controlNumber = submissionRecord.claimControlNumber;
      submissionRecord.clearinghouseTraceNumber =
        transportResult.clearinghouseTraceNumber ?? submissionTraceId;
      submissionRecord.payerClaimNumber = transportResult.payerClaimNumber;
      submissionRecord.transmissionStatus = normalizeLifecycleStatus(transportResult.transmissionStatus);
      submissionRecord.status = submissionRecord.transmissionStatus;
      submissionRecord.acknowledgementStatus = normalizeAcknowledgementStatus(transportResult.acknowledgementStatus);
      submissionRecord.responseStatusCode = transportResult.responseStatusCode;
      submissionRecord.trackingSource = 'REAL';
      submissionRecord.responseType = 'SUBMISSION';
      submissionRecord.normalizedStatus = normalizeLifecycleStatus(transportResult.transmissionStatus);
      submissionRecord.rawResponsePayload = claimSubmissionIntegrationConfig.storage.storeRawPayloads
        ? transportResult.responsePayload
        : undefined;
      submissionRecord.requestPayloadRedacted = redactClaimSubmissionPayload(transportResult.requestPayload);
      submissionRecord.responsePayloadRedacted = redactClaimSubmissionPayload(transportResult.responsePayload);
      submissionRecord.retryable = getRetryableFlag(
        retrySequence,
        submissionRecord.transmissionStatus,
        submissionRecord.acknowledgementStatus
      );
      submissionRecord.updatedBy = updatedBy;
      submissionRecord.updated = new Date();
      await submissionRecord.save();

      await createTrackingEvent(
        String(claim._id),
        {
          claimSubmissionId: String(submissionRecord._id),
          trackingSource: 'REAL',
          responseType: 'SUBMISSION',
          eventType: 'SUBMISSION_SENT',
          normalizedStatus: normalizeLifecycleStatus(submissionRecord.transmissionStatus),
          externalSubmissionId: submissionRecord.externalSubmissionId,
          claimControlNumber: submissionRecord.claimControlNumber,
          clearinghouseTraceNumber: submissionRecord.clearinghouseTraceNumber ?? submissionTraceId,
          statusCode: submissionRecord.transmissionStatus ?? 'SUBMITTED',
          statusDescription: submissionRecord.acknowledgementStatus ?? submissionRecord.transmissionStatus ?? 'Claim submitted to clearinghouse.',
          acknowledgementType: 'Submission',
          responseStatusCode: submissionRecord.responseStatusCode,
          responsePayloadRedacted: submissionRecord.responsePayloadRedacted,
          nextActionRequired: 'Await clearinghouse acknowledgement.',
        },
        updatedBy
      );

      await syncClaimSubmissionState(claim, submissionRecord, updatedBy);

      if (
        isTestModeLifecycleSimulationEnabled()
        && !['ACCEPTED', 'REJECTED', 'FAILED'].includes(normalizeLifecycleStatus(submissionRecord.acknowledgementStatus))
      ) {
        const simulatedResult = await applySimulatedLifecycleOutcome({
          claim,
          submission: submissionRecord,
          context,
          updatedBy,
          reason: 'Real clearinghouse acknowledgement is unavailable or pending in test mode.',
        });

        return {
          claimSubmission: simulatedResult.claimSubmission,
          idempotent: false,
        };
      }

      return {
        claimSubmission: submissionRecord,
        idempotent: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Claim submission transport failed.';
      const transportErrorDetails = error instanceof AppError && Array.isArray(error.errors)
        ? error.errors[0]
        : undefined;
      const transportResponsePayload =
        transportErrorDetails && typeof transportErrorDetails === 'object' && 'responsePayload' in transportErrorDetails
          ? (transportErrorDetails as Record<string, unknown>).responsePayload
          : undefined;
      const transportRequestPayload =
        transportErrorDetails && typeof transportErrorDetails === 'object' && 'requestPayload' in transportErrorDetails
          ? (transportErrorDetails as Record<string, unknown>).requestPayload
          : undefined;

      submissionRecord.transmissionStatus = 'FAILED';
      submissionRecord.status = 'FAILED';
      submissionRecord.normalizedStatus = 'FAILED';
      submissionRecord.acknowledgementStatus = 'FAILED';
      submissionRecord.submissionErrorMessage = errorMessage;
      submissionRecord.lastError = errorMessage;
      submissionRecord.responseStatusCode =
        error instanceof AppError ? error.statusCode : HTTP_STATUS.BAD_GATEWAY;
      const errorPayload = {
        error: errorMessage,
        clearinghouseResponse: transportResponsePayload,
      };
      submissionRecord.rawResponsePayload = claimSubmissionIntegrationConfig.storage.storeRawPayloads
        ? serializePayload(errorPayload)
        : undefined;
      if (transportRequestPayload) {
        submissionRecord.requestPayloadRedacted = redactClaimSubmissionPayload(transportRequestPayload);
      }
      submissionRecord.responsePayloadRedacted = redactClaimSubmissionPayload(errorPayload);
      submissionRecord.retryable = getRetryableFlag(
        retrySequence,
        submissionRecord.transmissionStatus,
        submissionRecord.acknowledgementStatus
      );
      submissionRecord.updatedBy = updatedBy;
      submissionRecord.updated = new Date();
      await submissionRecord.save();

      await createTrackingEvent(
        String(claim._id),
        {
          claimSubmissionId: String(submissionRecord._id),
          trackingSource: isTestModeLifecycleSimulationEnabled() ? 'SIMULATED' : 'REAL',
          source: isTestModeLifecycleSimulationEnabled() ? 'SIMULATED_TEST_RESPONSE' : 'REAL_STEDI_RESPONSE',
          responseType: 'SUBMISSION',
          eventType: 'SUBMISSION_FAILED',
          normalizedStatus: 'FAILED',
          claimControlNumber: submissionRecord.claimControlNumber,
          clearinghouseTraceNumber: submissionTraceId,
          statusCode: 'FAILED',
          statusDescription: errorMessage,
          acknowledgementType: 'Submission',
          rejectionSource: 'Clearinghouse Transport',
          responseStatusCode: submissionRecord.responseStatusCode,
          responsePayloadRedacted: submissionRecord.responsePayloadRedacted,
          nextActionRequired: 'Review submission error and retry once corrected.',
        },
        updatedBy
      );

      await syncClaimSubmissionState(claim, submissionRecord, updatedBy);

      if (isTestModeLifecycleSimulationEnabled()) {
        const simulatedResult = await applySimulatedLifecycleOutcome({
          claim,
          submission: submissionRecord,
          context,
          updatedBy,
          reason: `Real clearinghouse transport failed in test mode: ${errorMessage}`,
        });

        return {
          claimSubmission: simulatedResult.claimSubmission,
          idempotent: false,
        };
      }

      throw buildSubmissionFailureError(
        `Claim submission failed: ${errorMessage}`,
        submissionRecord.responseStatusCode ?? HTTP_STATUS.BAD_GATEWAY,
        {
          claimSubmissionId: String(submissionRecord._id),
          transmissionStatus: submissionRecord.transmissionStatus,
          acknowledgementStatus: submissionRecord.acknowledgementStatus,
          responseStatusCode: submissionRecord.responseStatusCode,
        }
      );
    }
  },

  async getStatusForClaim(claimId: string, locale: string, updatedBy: string) {
    const claim = await Claim.findOne({ _id: claimId, isDeleted: false });

    if (!claim) {
      throw new AppError(t('claim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const submission = await ClaimSubmission.findOne({
      claimId: claim._id,
      isDeleted: false,
      active: true,
    }).sort({ submissionDateTime: -1, created: -1 });

    if (!submission) {
      throw buildValidationError('Claim status tracking requires a submitted claim.');
    }

    if (
      isTestModeLifecycleSimulationEnabled()
      && (
        submission.trackingSource === 'SIMULATED'
        || String(submission.externalSubmissionId).startsWith('SIM-')
        || !submission.externalSubmissionId
      )
    ) {
      const statusResult = buildSimulatedStatusRefresh(submission);
      submission.transmissionStatus = statusResult.trackingStatus;
      submission.status = statusResult.trackingStatus;
      submission.normalizedStatus = statusResult.trackingStatus;
      submission.acknowledgementStatus = statusResult.acknowledgementStatus;
      submission.responseType = 'STATUS_UPDATE';
      submission.trackingSource = 'SIMULATED';
      submission.responsePayloadRedacted = statusResult.responsePayloadRedacted;
      submission.responseStatusCode = 200;
      submission.updatedBy = updatedBy;
      submission.updated = new Date();
      await submission.save();

      await createTrackingEvent(
        String(claim._id),
        {
          claimSubmissionId: String(submission._id),
          trackingSource: 'SIMULATED',
          source: 'SIMULATED_TEST_RESPONSE',
          responseType: 'STATUS_UPDATE',
          eventType: 'CLAIM_STATUS_UPDATED',
          normalizedStatus: statusResult.trackingStatus,
          claimControlNumber: submission.claimControlNumber,
          externalSubmissionId: submission.externalSubmissionId,
          clearinghouseTraceNumber: submission.clearinghouseTraceNumber,
          payerClaimNumber: submission.payerClaimNumber,
          acknowledgementType: '276 Claim Status Inquiry / 277 Claim Status Response',
          rawStatusCode: statusResult.rawStatusCode,
          statusDescription: statusResult.summary,
          receivedDate: new Date(),
          responseStatusCode: 200,
          responsePayloadRedacted: statusResult.responsePayloadRedacted,
          nextActionRequired: 'Continue claim status tracking.',
        },
        updatedBy
      );

      await syncClaimSubmissionState(claim, submission, updatedBy);

      return {
        claim,
        claimSubmission: submission,
        trackingStatus: statusResult.trackingStatus,
        externalSubmissionId: submission.externalSubmissionId,
        controlNumber: submission.controlNumber ?? submission.claimControlNumber,
      };
    }

    if (!submission.externalSubmissionId) {
      throw buildValidationError('Claim status tracking requires an external submission ID or test-mode simulation.');
    }

    const statusResult = await getClaimSubmissionStatus({
      externalSubmissionId: submission.externalSubmissionId,
      idempotencyKey: submission.idempotencyKey,
    });
    const redactedResponsePayload = redactClaimSubmissionPayload(statusResult.responsePayload);
    const normalizedStatus = statusResult.transmissionStatus;

    submission.transmissionStatus = normalizedStatus;
    submission.status = normalizedStatus;
    submission.normalizedStatus = normalizedStatus;
    submission.trackingSource = 'REAL';
    submission.responseType = 'STATUS_UPDATE';
    submission.acknowledgementStatus = statusResult.acknowledgementStatus ?? normalizedStatus;
    submission.claimControlNumber = statusResult.claimControlNumber ?? submission.claimControlNumber;
    submission.controlNumber = submission.claimControlNumber;
    submission.clearinghouseTraceNumber =
      statusResult.clearinghouseTraceNumber ?? submission.clearinghouseTraceNumber;
    submission.payerClaimNumber = statusResult.payerClaimNumber ?? submission.payerClaimNumber;
    submission.responseStatusCode = statusResult.responseStatusCode;
    submission.responsePayloadRedacted = redactedResponsePayload;
    submission.rawResponsePayload = claimSubmissionIntegrationConfig.storage.storeRawPayloads
      ? statusResult.responsePayload
      : undefined;
    submission.retryable = getRetryableFlag(
      submission.retrySequence ?? 1,
      submission.transmissionStatus,
      submission.acknowledgementStatus
    );
    submission.updatedBy = updatedBy;
    submission.updated = new Date();
    await submission.save();

    await createTrackingEvent(
      String(claim._id),
      {
        claimSubmissionId: String(submission._id),
        trackingSource: 'REAL',
        responseType: 'STATUS_UPDATE',
        eventType: 'CLAIM_STATUS_UPDATED',
        normalizedStatus,
        claimControlNumber: submission.claimControlNumber,
        externalSubmissionId: submission.externalSubmissionId,
        clearinghouseTraceNumber: submission.clearinghouseTraceNumber,
        payerClaimNumber: submission.payerClaimNumber,
        acknowledgementType: '276 Claim Status Inquiry / 277 Claim Status Response',
        statusCode: normalizedStatus,
        statusDescription: `Real claim status response received: ${submission.acknowledgementStatus ?? normalizedStatus}.`,
        receivedDate: new Date(),
        responseStatusCode: statusResult.responseStatusCode,
        responsePayloadRedacted: redactedResponsePayload,
        nextActionRequired:
          normalizedStatus === 'REJECTED'
            ? 'Review clearinghouse rejection and correct the claim.'
            : 'Continue claim status tracking.',
      },
      updatedBy
    );

    await syncClaimSubmissionState(claim, submission, updatedBy);

    return {
      claim,
      claimSubmission: submission,
      trackingStatus: normalizedStatus,
      externalSubmissionId: submission.externalSubmissionId,
      controlNumber: submission.controlNumber ?? submission.claimControlNumber,
    };
  },

  async retry(id: string, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);

    if (!item.claimId) {
      throw buildValidationError('Claim submission retry requires a linked claim.');
    }

    const status =
      normalizeText(item.acknowledgementStatus)
      ?? normalizeText(item.transmissionStatus);

    if (!status || !RETRYABLE_SUBMISSION_STATUSES.has(status)) {
      throw buildValidationError('Only failed or rejected submissions can be retried.');
    }

    const result = await this.submitClaim(String(item.claimId), locale, updatedBy, {
      previousSubmissionId: String(item._id),
    });
    const retryClaim = await Claim.findOne({ _id: item.claimId, isDeleted: false });
    const appointmentId = await getClaimAppointmentId(retryClaim);
    await auditLogService.record({
      entityType: 'claimSubmission',
      entityId: result.claimSubmission._id,
      action: 'CLAIM_SUBMISSION_RETRIED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'claimSubmission',
      claimId: item.claimId,
      appointmentId,
      submissionId: result.claimSubmission._id,
      reason: 'Retry from failed or rejected submission',
      previousState: { submissionId: item._id, status },
      newState: { submissionId: result.claimSubmission._id, status: result.claimSubmission.transmissionStatus },
    });
    return result;
  },

  async ingestAcknowledgement(data: any, locale: string, updatedBy: string) {
    const payload = normalizeAcknowledgementData(data);

    const filter: Record<string, unknown> = {
      isDeleted: false,
      active: true,
    };

    if (payload.submissionTraceId) {
      filter.submissionTraceId = payload.submissionTraceId;
    } else if (payload.externalSubmissionId) {
      filter.externalSubmissionId = payload.externalSubmissionId;
    } else if (payload.claimControlNumber) {
      filter.claimControlNumber = payload.claimControlNumber;
    } else if (payload.claimId && payload.batchId) {
      filter.claimId = payload.claimId;
      filter.batchId = payload.batchId;
    } else {
      throw buildValidationError(
        'Acknowledgement payload must include submissionTraceId, externalSubmissionId, or claimId with batchId.'
      );
    }

    const submission = await ClaimSubmission.findOne(filter).sort({ retrySequence: -1, created: -1 });

    if (!submission) {
      throw new AppError(t('claimSubmission.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const claim = submission.claimId
      ? await Claim.findOne({ _id: submission.claimId, isDeleted: false })
      : null;

    if (!claim) {
      throw new AppError(t('claim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    const appointmentId = await getClaimAppointmentId(claim);

    if (shouldIgnoreStaleAcknowledgement(submission, payload)) {
      return {
        claim,
        claimSubmission: submission,
        ignored: true,
        reason: 'STALE_OR_DUPLICATE_ACKNOWLEDGEMENT',
      };
    }

    submission.acknowledgementType = payload.acknowledgementType ?? submission.acknowledgementType;
    submission.acknowledgementStatus =
      payload.acknowledgementStatus
      ?? submission.acknowledgementStatus
      ?? 'PENDING';
    submission.transmissionStatus =
      payload.transmissionStatus
      ?? normalizeLifecycleStatus(submission.acknowledgementStatus);
    submission.normalizedStatus = normalizeLifecycleStatus(submission.transmissionStatus);
    submission.trackingSource = (payload.rawPayload as any)?.trackingSource === 'SIMULATED' ? 'SIMULATED' : 'REAL';
    submission.responseType = getAcknowledgementResponseType(submission.acknowledgementType);
    submission.acknowledgementDateTime = payload.receivedDate ?? new Date();
    submission.claimControlNumber = payload.claimControlNumber ?? submission.claimControlNumber;
    submission.controlNumber = submission.claimControlNumber;
    submission.clearinghouseTraceNumber =
      payload.clearinghouseTraceNumber ?? submission.clearinghouseTraceNumber;
    submission.payerClaimNumber = payload.payerClaimNumber ?? submission.payerClaimNumber;
    submission.rawAcknowledgementPayload = claimSubmissionIntegrationConfig.storage.storeRawPayloads
      ? serializePayload(payload.rawPayload)
      : undefined;
    submission.responsePayloadRedacted = redactClaimSubmissionPayload(payload.rawPayload);
    submission.status = submission.transmissionStatus;
    submission.submissionErrorCode = payload.statusCode ?? submission.submissionErrorCode;
    submission.submissionErrorMessage =
      buildAcknowledgementStatusDescription(payload) ?? submission.submissionErrorMessage;
    submission.retryable = getRetryableFlag(
      submission.retrySequence ?? 1,
      submission.transmissionStatus,
      submission.acknowledgementStatus
    );
    submission.updatedBy = updatedBy;
    submission.updated = new Date();
    await submission.save();

    await syncClaimSubmissionState(claim, submission, updatedBy);

    await createTrackingEvent(
      String(claim._id),
      {
        claimSubmissionId: String(submission._id),
        trackingSource: submission.trackingSource as any,
        source: submission.trackingSource === 'SIMULATED' ? 'SIMULATED_TEST_RESPONSE' : 'REAL_STEDI_RESPONSE',
        responseType: submission.responseType as any,
        eventType: getAcknowledgementEventType(submission.responseType as any, submission.acknowledgementStatus),
        normalizedStatus: normalizeLifecycleStatus(submission.acknowledgementStatus),
        claimControlNumber: submission.claimControlNumber,
        clearinghouseTraceNumber: submission.clearinghouseTraceNumber,
        payerClaimNumber: submission.payerClaimNumber,
        acknowledgementType: submission.acknowledgementType,
        statusCode: payload.statusCode ?? normalizeLifecycleStatus(submission.acknowledgementStatus),
        statusDescription: submission.submissionErrorMessage,
        receivedDate: submission.acknowledgementDateTime ?? new Date(),
        rejectionLevel: payload.rejectionLevel,
        rejectionSource: payload.rejectionSource,
        rejectionReasonCodes: payload.rejectionReasonCodes ?? [],
        stcCategoryCode: payload.stcCategoryCode,
        stcStatusCode: payload.stcStatusCode,
        stcEntityCode: payload.stcEntityCode,
        affectedServiceLine: payload.affectedServiceLine,
        remediationCode: payload.remediationCode,
        remediationFieldPath: payload.remediationFieldPath,
        remediationSeverity: payload.remediationSeverity,
        nextActionRequired:
          payload.nextActionRequired
          ?? (normalizeLifecycleStatus(submission.acknowledgementStatus) === 'REJECTED'
            ? 'Correct the claim and resubmit.'
            : 'Continue claim status tracking.'),
        responsePayloadRedacted: redactClaimSubmissionPayload(payload.rawPayload),
      },
      updatedBy
    );

    await auditLogService.record({
      entityType: 'claimSubmission',
      entityId: submission._id,
      action: normalizeLifecycleStatus(submission.acknowledgementStatus) === 'REJECTED'
        ? 'ACK_REJECTED'
        : normalizeLifecycleStatus(submission.acknowledgementStatus) === 'ACCEPTED'
          ? 'ACK_ACCEPTED'
          : 'ACK_RECEIVED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'claimSubmission',
      claimId: claim._id,
      appointmentId,
      patientId: claim.patientId,
      payerId: claim.payerId,
      submissionId: submission._id,
      reason: submission.submissionErrorMessage,
      newState: {
        acknowledgementType: submission.acknowledgementType,
        acknowledgementStatus: submission.acknowledgementStatus,
        transmissionStatus: submission.transmissionStatus,
        responseType: submission.responseType,
      },
    });

    return {
      claim,
      claimSubmission: submission,
    };
  },

  async ingestX12Acknowledgement(data: any, locale: string, updatedBy: string) {
    return this.ingestAcknowledgement(parseX12AcknowledgementPayload(data), locale, updatedBy);
  },

  verifyWebhookSecret(secret?: string) {
    const configuredSecret = claimSubmissionIntegrationConfig.webhook.secret;

    if (!configuredSecret) {
      return process.env.NODE_ENV !== 'production';
    }

    return secret === configuredSecret;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    const item = await ClaimSubmission.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('claimSubmission.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const normalizedData = normalizeClaimSubmissionData(data);

    Object.assign(item, {
      ...normalizedData,
      updatedBy,
      updated: new Date(),
    });

    await item.save();
    return item;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    const item = await ClaimSubmission.findOneAndUpdate(
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
      throw new AppError(t('claimSubmission.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },
};

registerRcmJobHandler('CLAIM_STATUS_POLL', async (job) => {
  const claimId = normalizeText(job.payload?.claimId ?? job.payload?.claim);
  if (!claimId) {
    throw new AppError('CLAIM_STATUS_POLL requires payload.claimId.', HTTP_STATUS.BAD_REQUEST);
  }

  await claimSubmissionService.getStatusForClaim(
    claimId,
    'en',
    normalizeText(job.updatedBy ?? job.createdBy) || 'rcm-queue-worker',
  );
});

registerRcmJobHandler('CLAIM_SUBMISSION_RETRY', async (job) => {
  const claimSubmissionId = normalizeText(
    job.payload?.claimSubmissionId
    ?? job.payload?.submissionId
    ?? job.payload?.id,
  );
  if (!claimSubmissionId) {
    throw new AppError('CLAIM_SUBMISSION_RETRY requires payload.claimSubmissionId.', HTTP_STATUS.BAD_REQUEST);
  }

  await claimSubmissionService.retry(
    claimSubmissionId,
    'en',
    normalizeText(job.updatedBy ?? job.createdBy) || 'rcm-queue-worker',
  );
});
