import { Claim } from './claim.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import {
  CLAIM_COVERAGE_PRIORITY_OPTIONS,
  CLAIM_PAYMENT_STATUS_OPTIONS,
  CLAIM_SCRUB_STATUS_OPTIONS,
  CLAIM_STATUS_OPTIONS,
  CLAIM_SUBMISSION_STATUS_OPTIONS,
  CLAIM_TYPE_OPTIONS,
} from './claim.constants';
import { appendStatusHistory } from '../workflow/workflow-history';
import { Charge } from '../charge/charge.model';
import { CodingReview } from '../coding-review/coding-review.model';
import { ClaimSubmission } from '../claim-submission/claim-submission.model';
import { auditLogService } from '../audit-log/audit-log.service';
import { InsurancePolicy } from '../insurance-policy/insurance-policy.model';
import { Payer } from '../payer/payer.model';
import { Facility } from '../facility/facility.model';
import { claimSubmissionService } from '../claim-submission/claim-submission.service';
import { EligibilityVerification } from '../eligibility-verification/eligibility-verification.model';
import { PriorAuthorization } from '../prior-authorization/prior-authorization.model';
import { Encounter } from '../encounter/encounter.model';
import { Appointment } from '../appointment/appointment.model';
import { Referral } from '../referral/referral.model';
import { claimAiReviewService } from '../claim-ai-review/claim-ai-review.service';
import { Provider } from '../provider/provider.model';
import { ProcedureCode } from '../procedure-code/procedure-code.model';
import { Patient } from '../patient/patient.model';
import { claimPredictionService } from '../claim-prediction/claim-prediction.service';
import { feeScheduleService } from '../fee-schedule/fee-schedule.service';
import { coverageRuleService, CoverageRuleEvaluationResult } from '../coverage-rule/coverage-rule.service';
import { eligibilityVerificationService } from '../eligibility-verification/eligibility-verification.service';
import { envConfig } from '../../../config/env.config';
import {
  claimSubmissionIntegrationConfig,
  isClaimSubmissionIntegrationConfigured,
} from '../claim-submission/claim-submission.integration.config';
import type { ClientSession } from 'mongoose';
import { validate837ProfessionalClaim } from '../claim-submission/claim-submission.validation';
import { getPayerSpecific837PValidators } from '../claim-submission/claim-submission.payer-validators';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { claimRejectionService } from '../claim-rejection/claim-rejection.service';
import { claimClosureService } from './claim-closure.service';
import { CorrectedClaim } from '../corrected-claim/corrected-claim.model';
import { timelyFilingAlertService } from '../timely-filing-alert/timely-filing-alert.service';
import { documentationComplianceAlertService } from '../documentation-compliance-alert/documentation-compliance-alert.service';
import { syncEntityDocuments } from '../document/document-registry.service';

const APPROVED_AUTHORIZATION_STATUSES = new Set(['approved', 'authorized', 'certified']);
const INVALID_REFERRAL_STATUSES = new Set(['denied', 'cancelled', 'canceled', 'expired', 'closed']);
const ELIGIBILITY_REQUIRED_MESSAGE = 'Claim cannot be submitted until eligibility verification is completed for the active insurance policy and service line.';
const MISSING_CONTRACT_RATE_MESSAGE = 'Claim cannot be submitted because one or more service lines are missing payer contract rates.';
const ACTIVE_ELIGIBILITY_STATUS_VALUES = new Set(['active', 'eligible', 'covered', 'completed']);

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function normalizeDigits(value: unknown) {
  return normalizeText(value)?.replace(/\D+/g, '') ?? '';
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item))
    .filter((item): item is string => Boolean(item));
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

function normalizeStringArray(values: unknown) {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const nextValues = values
    .map((value) => normalizeText(value))
    .filter((value): value is string => Boolean(value));

  return nextValues.length ? nextValues : [];
}

function normalizeNumberArray(values: unknown) {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const nextValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return nextValues.length ? nextValues : [];
}

function buildValidationError(message: string) {
  return new AppError(message, HTTP_STATUS.BAD_REQUEST);
}

function getNestedValue(source: unknown, path: string) {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, source);
}

function getCoverageRuleBlockingErrors(line: any) {
  const coverageErrors = [
    ...normalizeStringList(getNestedValue(line.coverageRuleSnapshot, 'coverageRules.errors')),
    ...normalizeStringList(getNestedValue(line.coverageRuleSnapshot, 'errors')),
  ];
  const covered = getNestedValue(line.coverageRuleSnapshot, 'coverageRules.covered');

  if (covered === false && coverageErrors.length === 0) {
    coverageErrors.push('Coverage rules marked this service as not covered.');
  }

  return Array.from(new Set(coverageErrors));
}

function normalizeTextLower(value: unknown) {
  return normalizeText(value)?.toLowerCase();
}

function normalizeClaimLines(claimLines: unknown) {
  if (!Array.isArray(claimLines)) {
    return undefined;
  }

  return claimLines.map((line, index) => ({
    lineNumber: typeof line?.lineNumber === 'number' ? line.lineNumber : index + 1,
    chargeLineId: normalizeText(line?.chargeLineId),
    cptCode: normalizeText(line?.cptCode),
    modifiers: normalizeStringArray(line?.modifiers) ?? [],
    icdPointers: normalizeNumberArray(line?.icdPointers) ?? [],
    units: typeof line?.units === 'number' ? line.units : undefined,
    chargeAmount: typeof line?.chargeAmount === 'number' ? line.chargeAmount : undefined,
    renderingProviderId: normalizeText(line?.renderingProviderId),
    placeOfService: normalizeText(line?.placeOfService),
    serviceDateFrom: normalizeDate(line?.serviceDateFrom),
    serviceDateTo: normalizeDate(line?.serviceDateTo),
    priorAuthorizationId: normalizeText(line?.priorAuthorizationId),
    referralId: normalizeText(line?.referralId),
  }));
}

function hasAnyValue(value: Record<string, unknown>) {
  return Object.values(value).some((item) => item !== undefined && item !== '');
}

function normalizeAttachments(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((attachment): attachment is Record<string, unknown> => typeof attachment === 'object' && attachment !== null)
    .map((attachment) => ({
      documentType: normalizeText(attachment.documentType),
      title: normalizeText(attachment.title),
      fileUrl: normalizeText(attachment.fileUrl),
      description: normalizeText(attachment.description),
    }))
    .filter((attachment) => hasAnyValue(attachment));
}

function buildClaimDocumentAttachments(claim: any) {
  return (claim.attachments ?? []).map((attachment: any) => ({
    ...attachment,
    sourceTag: 'source:claim-attachments',
  }));
}

async function syncClaimDocuments(claim: any, userId?: string) {
  await syncEntityDocuments({
    entityType: 'claim',
    entityId: String(claim._id),
    patientId: claim.patientId ? String(claim.patientId) : undefined,
    attachments: buildClaimDocumentAttachments(claim),
    sourceTags: ['source:claim-attachments'],
    userId,
  });
}

function normalizeClaimData(data: any) {
  const normalizedData = { ...data };

  if (data.claimDate !== undefined) {
    normalizedData.claimDate = normalizeDate(data.claimDate);
  }

  if (data.coveragePriority !== undefined) {
    normalizedData.coveragePriority = normalizeText(data.coveragePriority);
  }

  if (data.frequencyCode !== undefined) {
    normalizedData.frequencyCode = normalizeText(data.frequencyCode);
  }

  if (data.claimType !== undefined) {
    normalizedData.claimType = normalizeText(data.claimType);
  }

  if (data.claimStatus !== undefined) {
    normalizedData.claimStatus = normalizeText(data.claimStatus);
  }

  if (data.scrubStatus !== undefined) {
    normalizedData.scrubStatus = normalizeText(data.scrubStatus);
  }

  if (data.submissionStatus !== undefined) {
    normalizedData.submissionStatus = normalizeText(data.submissionStatus);
  }

  if (data.paymentStatus !== undefined) {
    normalizedData.paymentStatus = normalizeText(data.paymentStatus);
  }

  if (data.closureStatus !== undefined) {
    normalizedData.closureStatus = normalizeText(data.closureStatus);
  }

  if (data.closeReason !== undefined) {
    normalizedData.closeReason = normalizeText(data.closeReason);
  }

  if (data.reopenReason !== undefined) {
    normalizedData.reopenReason = normalizeText(data.reopenReason);
  }

  if (data.expectedEraBy !== undefined) {
    normalizedData.expectedEraBy = normalizeDate(data.expectedEraBy);
  }

  if (data.lastPayerFollowUpAt !== undefined) {
    normalizedData.lastPayerFollowUpAt = normalizeDate(data.lastPayerFollowUpAt);
  }

  if (data.diagnosisCodes !== undefined) {
    normalizedData.diagnosisCodes = normalizeStringArray(data.diagnosisCodes) ?? [];
  }

  if (data.rejectionReason !== undefined) {
    normalizedData.rejectionReason = normalizeText(data.rejectionReason);
  }

  if (data.batchId !== undefined) {
    normalizedData.batchId = normalizeText(data.batchId);
  }

  if (data.clearingHouse !== undefined) {
    normalizedData.clearingHouse = normalizeText(data.clearingHouse);
  }

  if (data.ediStatus !== undefined) {
    normalizedData.ediStatus = normalizeText(data.ediStatus);
  }

  if (data.claimLines !== undefined) {
    normalizedData.claimLines = normalizeClaimLines(data.claimLines) ?? [];
  }

  if (data.attachments !== undefined) {
    normalizedData.attachments = normalizeAttachments(data.attachments) ?? [];
  }

  return normalizedData;
}

function validateClaimState(candidate: any) {
  if (!candidate.chargeId || !candidate.encounterId || !candidate.patientId) {
    throw buildValidationError('Charge, encounter, and patient are required for a claim.');
  }

  if (!(candidate.claimDate instanceof Date) || Number.isNaN(candidate.claimDate.getTime())) {
    throw buildValidationError('Claim date is required.');
  }

  if (!candidate.billingProviderId || !candidate.renderingProviderId || !candidate.facilityId) {
    throw buildValidationError('Billing provider, rendering provider, and facility are required for a claim.');
  }

  if (!candidate.diagnosisCodes?.length) {
    throw buildValidationError('At least one diagnosis code is required for a claim.');
  }

  if (candidate.coveragePriority && !CLAIM_COVERAGE_PRIORITY_OPTIONS.includes(candidate.coveragePriority)) {
    throw buildValidationError('Claim coverage priority is invalid.');
  }

  if (candidate.claimType && !CLAIM_TYPE_OPTIONS.includes(candidate.claimType)) {
    throw buildValidationError('Claim type is invalid.');
  }

  if (candidate.claimStatus && !CLAIM_STATUS_OPTIONS.includes(candidate.claimStatus)) {
    throw buildValidationError('Claim status is invalid.');
  }

  if (candidate.scrubStatus && !CLAIM_SCRUB_STATUS_OPTIONS.includes(candidate.scrubStatus)) {
    throw buildValidationError('Claim scrub status is invalid.');
  }

  if (
    candidate.submissionStatus
      && !CLAIM_SUBMISSION_STATUS_OPTIONS.includes(candidate.submissionStatus)
  ) {
    throw buildValidationError('Claim submission status is invalid.');
  }

  if (candidate.paymentStatus && !CLAIM_PAYMENT_STATUS_OPTIONS.includes(candidate.paymentStatus)) {
    throw buildValidationError('Claim payment status is invalid.');
  }
}

function buildSubmissionBatchId() {
  return `BATCH-${Date.now()}`;
}

function buildSubmissionTraceId(claimId: string) {
  return `SUB-${claimId.slice(-6).toUpperCase()}-${Date.now()}`;
}

function normalizeBusinessDate(value: unknown) {
  const dateValue = normalizeDate(value);

  if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
    return undefined;
  }

  return new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
}

function isDateOnOrAfter(left?: Date, right?: Date) {
  if (!(left instanceof Date) || Number.isNaN(left.getTime()) || !(right instanceof Date) || Number.isNaN(right.getTime())) {
    return true;
  }

  return left.getTime() >= right.getTime();
}

function isDateOnOrBefore(left?: Date, right?: Date) {
  if (!(left instanceof Date) || Number.isNaN(left.getTime()) || !(right instanceof Date) || Number.isNaN(right.getTime())) {
    return true;
  }

  return left.getTime() <= right.getTime();
}

function isDateWithinRange(target: Date, start?: Date, end?: Date) {
  return isDateOnOrAfter(target, start) && isDateOnOrBefore(target, end);
}

function getClaimServiceDate(claim: any) {
  const firstServiceDate = normalizeBusinessDate(claim.claimLines?.[0]?.serviceDateFrom);
  return firstServiceDate ?? normalizeBusinessDate(claim.claimDate) ?? normalizeBusinessDate(new Date()) ?? new Date();
}

function getClaimServiceDates(claim: any): Date[] {
  const serviceDates = (claim.claimLines ?? [])
    .map((line: any) => normalizeBusinessDate(line?.serviceDateFrom))
    .filter((date: Date | undefined): date is Date => Boolean(date));

  return serviceDates.length ? serviceDates : [getClaimServiceDate(claim)];
}

function getClaimProcedureCodes(claim: any): string[] {
  return (claim.claimLines ?? [])
    .map((line: any) => normalizeText(line?.cptCode))
    .filter((code: string | undefined): code is string => Boolean(code));
}

function getClaimProcedureCodeSet(claim: any) {
  return Array.from(new Set(getClaimProcedureCodes(claim).map((code: string) => code.toUpperCase())));
}

function getEligibilityFreshnessCutoff() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - envConfig.eligibilityValidDays);
  return cutoff;
}

function isSameBusinessDate(left?: Date, right?: Date) {
  if (!(left instanceof Date) || Number.isNaN(left.getTime()) || !(right instanceof Date) || Number.isNaN(right.getTime())) {
    return false;
  }

  return normalizeBusinessDate(left)?.getTime() === normalizeBusinessDate(right)?.getTime();
}

function isActiveEligibilityStatus(value: unknown) {
  const normalizedValue = normalizeText(value)?.toLowerCase();

  if (!normalizedValue) {
    return false;
  }

  return ACTIVE_ELIGIBILITY_STATUS_VALUES.has(normalizedValue)
    || normalizedValue.includes('active')
    || normalizedValue.includes('eligible')
    || normalizedValue.includes('covered');
}

function getEligibilityProcedureCodes(eligibility: any) {
  return (eligibility?.procedureCodes ?? [])
    .map((code: unknown) => normalizeText(code)?.toUpperCase())
    .filter((code: string | undefined): code is string => Boolean(code));
}

function eligibilityCoversProcedure(eligibility: any, cptCode?: string) {
  const normalizedCptCode = normalizeText(cptCode)?.toUpperCase();

  if (!normalizedCptCode) {
    return true;
  }

  const procedureCodes = getEligibilityProcedureCodes(eligibility);
  return !procedureCodes.length || procedureCodes.includes(normalizedCptCode);
}

async function hasConfiguredProcedureAuthorizationRequirement(claim: any) {
  const procedureCodes = Array.from(new Set(getClaimProcedureCodes(claim).map((code: string) => code.toUpperCase())));

  if (!procedureCodes.length) {
    return false;
  }

  const authRequiredProcedure = await ProcedureCode.findOne({
    code: { $in: procedureCodes },
    requiresAuth: true,
    active: true,
    isDeleted: false,
  }).select('_id code');

  return Boolean(authRequiredProcedure);
}

async function syncAppointmentCompletedForCharge(chargeId: unknown, updatedBy: string) {
  if (!chargeId) {
    return;
  }

  const charge = await Charge.findOne({ _id: chargeId, isDeleted: false });

  if (!charge?.encounterId) {
    return;
  }

  const encounter = await Encounter.findOne({ _id: charge.encounterId, isDeleted: false });

  if (!encounter?.appointmentId || encounter.visitStatus !== 'Completed') {
    return;
  }

  const appointment = await Appointment.findOne({
    _id: encounter.appointmentId,
    isDeleted: false,
    active: true,
  });

  if (!appointment || appointment.appointmentStatus === 'Completed') {
    return;
  }

  appointment.appointmentStatus = 'Completed';
  appointment.checkInStatus = 'Checked Out';
  appointment.checkOutTime = appointment.checkOutTime ?? normalizeDate(encounter.endTime) ?? new Date();
  appointment.checkInTime = appointment.checkInTime ?? normalizeDate(encounter.startTime);
  appointment.statusHistory = appendStatusHistory(
    appointment.statusHistory,
    'Completed',
    updatedBy,
    'Claim creation confirmed encounter completion'
  );
  appointment.updatedBy = updatedBy as any;
  appointment.updated = new Date();
  await appointment.save();
}

async function resolveClaimAuthorizationRequired(claim: any, latestEligibility?: any) {
  if (latestEligibility?.authorizationRequired) {
    return true;
  }

  return hasConfiguredProcedureAuthorizationRequirement(claim);
}

function validateClaimLinesReady(claim: any) {
  if (!claim.claimLines?.length) {
    throw buildValidationError('Claim must contain at least one service line before submission.');
  }

  claim.claimLines.forEach((line: any, index: number) => {
    const lineNumber = line.lineNumber ?? index + 1;
    const diagnosisCodeCount = claim.diagnosisCodes?.length ?? 0;

    if (!normalizeText(line.cptCode)) {
      throw buildValidationError(`Claim line ${lineNumber} is missing CPT code.`);
    }

    if (typeof line.units !== 'number' || line.units <= 0) {
      throw buildValidationError(`Claim line ${lineNumber} must include valid units.`);
    }

    if (typeof line.chargeAmount !== 'number' || line.chargeAmount <= 0) {
      throw buildValidationError(`Claim line ${lineNumber} must include a valid charge amount.`);
    }

    if (!line.icdPointers?.length) {
      throw buildValidationError(`Claim line ${lineNumber} must include at least one diagnosis pointer.`);
    }

    if (
      !line.icdPointers.every(
        (pointer: unknown) =>
          typeof pointer === 'number'
          && Number.isInteger(pointer)
          && pointer >= 1
          && pointer <= diagnosisCodeCount
      )
    ) {
      throw buildValidationError(
        `Claim line ${lineNumber} includes diagnosis pointers outside the claim diagnosis list.`
      );
    }

    if (!normalizeText(line.placeOfService)) {
      throw buildValidationError(`Claim line ${lineNumber} is missing place of service.`);
    }

    if (!normalizeDate(line.serviceDateFrom)) {
      throw buildValidationError(`Claim line ${lineNumber} is missing service date.`);
    }
  });
}

function isTestModeSubmissionLifecycle() {
  return claimSubmissionIntegrationConfig.request.usageIndicator === 'T';
}

function getTestModeAcknowledgementCandidates(errors: string[]) {
  return errors.filter((error) => {
    const normalizedError = error.toLowerCase();
    return normalizedError.includes('edi payer id')
      || normalizedError.includes('claim submission integration is not configured')
      || normalizedError.includes('authorization')
      || normalizedError.includes('referral');
  });
}

function hasHardReadinessBlockers(errors: string[]) {
  const acknowledgementCandidates = new Set(getTestModeAcknowledgementCandidates(errors));
  return errors.some((error) => !acknowledgementCandidates.has(error));
}

function toPlainObject(value: any) {
  return value && typeof value.toObject === 'function' ? value.toObject() : value;
}

function stripSystemFields(value: any) {
  const clone = { ...toPlainObject(value) };
  delete clone._id;
  delete clone.id;
  delete clone.__v;
  delete clone.claimId;
  delete clone.created;
  delete clone.updated;
  delete clone.createdBy;
  delete clone.updatedBy;
  delete clone.deletedAt;
  return clone;
}

function stableJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function getCorrectedFields(previous: any, next: any) {
  const fields = [
    'chargeId',
    'encounterId',
    'patientId',
    'payerId',
    'billingProviderId',
    'renderingProviderId',
    'facilityId',
    'claimDate',
    'totalChargeAmount',
    'coveragePriority',
    'frequencyCode',
    'claimType',
    'diagnosisCodes',
    'originalClaimId',
    'correctedClaimIndicator',
    'claimLines',
  ];

  return fields.filter((field) => stableJson(previous?.[field]) !== stableJson(next?.[field]));
}

async function createAuditLog(data: any, updatedBy: string) {
  await auditLogService.record({
    entityType: data.entityType ?? 'claim',
    entityId: data.entityId,
    action: data.action,
    userId: updatedBy,
    changedBy: updatedBy,
    source: 'claim',
    claimId: data.claimId ?? data.entityId,
    appointmentId: data.appointmentId,
    previousState: data.oldValue,
    newState: data.newValue,
    reason: data.reason,
  });
}

async function buildClaimReadinessResult(claim: any) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const requiredActions: string[] = [];
  const requireText = (value: unknown, message: string) => {
    if (!normalizeText(value)) {
      errors.push(message);
    }
  };
  const requireDate = (value: unknown, message: string) => {
    if (!normalizeDate(value)) {
      errors.push(message);
    }
  };
  const requireZip = (value: unknown, message: string) => {
    if (!normalizeDigits(value)) {
      errors.push(message);
    }
  };

  if (claim.claimType === 'Institutional') {
    errors.push('837I institutional claim submission is not implemented.');
    requiredActions.push('Route this claim to a paper workflow or implement 837I before electronic submission.');
  }

  if (!claim.patientId) errors.push('Patient is required.');
  if (!claim.payerId) errors.push('Payer is required.');
  if (!claim.billingProviderId) errors.push('Billing provider is required.');
  if (!claim.renderingProviderId) errors.push('Rendering provider is required.');
  if (!claim.facilityId) errors.push('Facility is required.');
  if (!claim.diagnosisCodes?.length) errors.push('At least one diagnosis code is required.');

  const snapshotIssues = await getClaimSnapshotIssues(claim);
  if (snapshotIssues.length) {
    errors.push(...snapshotIssues);
    requiredActions.push('Regenerate or correct the claim from the current approved coding review before submission.');
  }

  const serviceDate = getClaimServiceDate(claim);
  const insurancePolicy = await resolveActiveInsurancePolicy(claim.patientId, {
    payerId: claim.payerId,
    coveragePriority: claim.coveragePriority,
    serviceDate,
  });

  if (!insurancePolicy) {
    errors.push('No active insurance policy exists for the claim date of service.');
    requiredActions.push('Verify patient coverage for the date of service.');
  }

  const payer = await resolvePayerByReference(claim.payerId ?? insurancePolicy?.payerId);
  if (!payer) {
    errors.push('Payer is not configured or inactive.');
    requiredActions.push('Configure the payer before submission.');
  }
  const isPaperPayer = payer?.claimsSubmissionMethod === 'Paper';

  if (!isPaperPayer && !isClaimSubmissionIntegrationConfigured()) {
    errors.push('Claim submission integration is not configured.');
    requiredActions.push('Configure CLAIM_SUBMISSION_ENABLED, STEDI_API_KEY, and STEDI_SUBMIT_ENDPOINT before electronic submission.');
  }

  const [patient, facility, billingProvider, renderingProvider] = await Promise.all([
    claim.patientId ? Patient.findOne({ _id: claim.patientId, active: true, isDeleted: false }) : null,
    claim.facilityId ? Facility.findOne({ _id: claim.facilityId, active: true, isDeleted: false }) : null,
    claim.billingProviderId ? Provider.findOne({ _id: claim.billingProviderId, active: true, isDeleted: false }) : null,
    claim.renderingProviderId ? Provider.findOne({ _id: claim.renderingProviderId, active: true, isDeleted: false }) : null,
  ]);

  requireText(patient?.firstName, 'Patient first name is required for electronic claim submission.');
  requireText(patient?.lastName, 'Patient last name is required for electronic claim submission.');
  requireDate(patient?.dateOfBirth, 'Patient date of birth is required for electronic claim submission.');
  requireText(patient?.sex || patient?.gender, 'Patient gender/sex is required for electronic claim submission.');
  requireText(patient?.address?.addressLine1, 'Patient address is required for electronic claim submission.');
  requireText(patient?.address?.city, 'Patient city is required for electronic claim submission.');
  requireText(patient?.address?.state, 'Patient state is required for electronic claim submission.');
  requireZip(patient?.address?.zipCode, 'Patient ZIP code is required for electronic claim submission.');

  if (!insurancePolicy?.memberId) errors.push('Subscriber/member ID is required.');
  if (!payer?.payerName) errors.push('Payer name is required for electronic claim submission.');
  if (!insurancePolicy?.ediPayerId && !payer?.ediPayerId && payer?.claimsSubmissionMethod !== 'Paper') {
    errors.push('Electronic claim submission requires an EDI payer ID.');
  }
  if (!billingProvider?.npi) errors.push('Billing provider NPI is required for electronic claim submission.');
  if (!billingProvider?.taxonomyCode && !renderingProvider?.taxonomyCode) {
    errors.push('Billing or rendering provider taxonomy code is required for electronic claim submission.');
  }
  if (!renderingProvider?.npi) errors.push('Rendering provider NPI is required.');
  if (!renderingProvider?.lastName) errors.push('Rendering provider last name is required for electronic claim submission.');
  if (
    !isPaperPayer
    && !normalizeDigits(claimSubmissionIntegrationConfig.request.contactPhone)
  ) {
    const message = 'Submitter contact phone is required for electronic 837P submission.';
    errors.push(message);
    requiredActions.push('Configure CLAIM_SUBMISSION_CONTACT_PHONE before electronic submission.');
  }
  if (!facility?.facilityName) errors.push('Facility name is required for electronic claim submission.');
  if (!facility?.npi) errors.push('Facility NPI is required.');
  if (!normalizeDigits((billingProvider as any)?.taxId) && !normalizeDigits(facility?.taxId)) {
    errors.push('Billing provider Tax ID is required for electronic claim submission.');
  }
  if (!facility?.placeOfServiceCode) errors.push('Facility place of service is required for electronic claim submission.');
  requireText(facility?.addressLine1, 'Facility address is required for electronic claim submission.');
  requireText(facility?.city, 'Facility city is required for electronic claim submission.');
  requireText(facility?.state, 'Facility state is required for electronic claim submission.');
  requireZip(facility?.zipCode, 'Facility ZIP code is required for electronic claim submission.');
  requireText(claim.frequencyCode, 'Claim frequency code is required for electronic claim submission.');

  if (!claim.claimLines?.length) {
    errors.push('At least one claim line is required for electronic claim submission.');
  }

  for (const [index, line] of (claim.claimLines ?? []).entries()) {
    const lineNumber = line.lineNumber ?? index + 1;
    const validPointers = (line.icdPointers ?? []).filter(
      (pointer: unknown) => typeof pointer === 'number' && Number.isFinite(pointer)
    );

    if (!normalizeText(line.cptCode)) errors.push(`Claim line ${lineNumber} is missing CPT code.`);
    if (!line.icdPointers?.length) errors.push(`Claim line ${lineNumber} is missing CPT/ICD linkage.`);
    if (validPointers.some((pointer: number) => pointer < 1 || pointer > (claim.diagnosisCodes ?? []).length)) {
      errors.push(`Claim line ${lineNumber} includes diagnosis pointers outside the claim diagnosis list.`);
    }
    if (typeof line.units !== 'number' || line.units <= 0) {
      errors.push(`Claim line ${lineNumber} must include valid units.`);
    }
    if (typeof line.chargeAmount !== 'number' || line.chargeAmount <= 0) {
      errors.push(`Claim line ${lineNumber} must include a valid charge amount.`);
    }
    if (!normalizeText(line.placeOfService)) {
      errors.push(`Claim line ${lineNumber} is missing place of service.`);
    }
    if (!normalizeDate(line.serviceDateFrom)) {
      errors.push(`Claim line ${lineNumber} is missing service date.`);
    }
    if (!line.feeScheduleId || typeof line.expectedAllowedAmount !== 'number') {
      errors.push(`Claim line ${lineNumber} is missing a configured payer contract rate.`);
      requiredActions.push(`Load fee schedule for CPT ${line.cptCode ?? lineNumber}, payer, provider/facility, state, and POS.`);
    }

    const coverageRuleErrors = getCoverageRuleBlockingErrors(line);
    if (coverageRuleErrors.length) {
      errors.push(...coverageRuleErrors.map((error) => `Claim line ${lineNumber}: ${error}`));
      requiredActions.push(`Resolve coverage rule failures for CPT ${line.cptCode ?? lineNumber}.`);
    }

    if (insurancePolicy) {
      const eligibilityValidation = await resolveAndValidateLineEligibility({
        claim,
        line,
        lineNumber,
        insurancePolicy,
      });

      errors.push(...eligibilityValidation.errors);
      requiredActions.push(...eligibilityValidation.requiredActions);
    } else if (!line.eligibilityVerificationId) {
      errors.push(`Claim line ${lineNumber}: Eligibility verification is missing.`);
      requiredActions.push('Run real-time eligibility for the active policy and service date.');
    }
  }

  const authorizationStatus = await evaluateAuthorizationReadiness(claim, insurancePolicy);
  const referralStatus = await evaluateReferralReadiness(claim, insurancePolicy);

  if (authorizationStatus.authorizationRequired && !authorizationStatus.authorizationValid) {
    errors.push(...authorizationStatus.authorizationErrors);
    requiredActions.push('Create or link an approved prior authorization before submission.');
  }

  if (referralStatus.referralRequired && !referralStatus.referralValid) {
    errors.push(...referralStatus.referralErrors);
    requiredActions.push('Create or link a valid referral before submission.');
  }

  const documentationCompliance = await documentationComplianceAlertService.evaluateClaim(claim, {
    triggerZapier: true,
  });

  if (documentationCompliance?.status === 'FAIL') {
    errors.push(`Claim is missing required supporting documentation: ${documentationCompliance.missingDocuments.join(', ')}.`);
    requiredActions.push('Upload or link the missing supporting documentation before submission.');
  }

  if (!isPaperPayer && patient && insurancePolicy && payer && facility && billingProvider && renderingProvider) {
    const ediContext = {
      claim,
      patient,
      insurancePolicy,
      payer,
      billingProvider,
      renderingProvider,
      facility,
    };
    const companionGuideResult = validate837ProfessionalClaim(
      ediContext as any,
      {
        senderId: claimSubmissionIntegrationConfig.request.senderId,
        receiverId: claimSubmissionIntegrationConfig.request.receiverId,
        submitterId: claimSubmissionIntegrationConfig.request.submitterId,
        submitterName: claimSubmissionIntegrationConfig.request.submitterName,
        receiverName: claimSubmissionIntegrationConfig.request.receiverName,
        contactName: claimSubmissionIntegrationConfig.request.contactName,
        contactPhone: claimSubmissionIntegrationConfig.request.contactPhone,
        usageIndicator: claimSubmissionIntegrationConfig.request.usageIndicator,
        interchangeControlNumber: 'READINESS',
        groupControlNumber: 'READINESS',
        transactionSetControlNumber: '0001',
        claimControlNumber: `CLM${String(claim._id).slice(-17)}`,
      },
      getPayerSpecific837PValidators(ediContext as any),
    );

    companionGuideResult.findings.forEach((finding) => {
      const message = `${finding.code}: ${finding.message}`;
      if (finding.severity === 'BLOCKING') {
        errors.push(message);
        requiredActions.push(finding.remediation ?? message);
      } else {
        warnings.push(message);
      }
    });
  }

  if (!errors.length && warnings.length === 0) {
    warnings.push('Deterministic readiness checks passed. AI review may still flag denial risk.');
  }

  return {
    canSubmit: errors.length === 0,
    errors,
    warnings,
    requiredActions: Array.from(new Set(requiredActions)),
    ...authorizationStatus,
    ...referralStatus,
    documentationCompliance,
  };
}

function buildClaimDiagnosisCodes(charge: any, encounter: any) {
  const diagnosisCodes = new Set<string>();

  (encounter?.diagnosisCodes ?? []).forEach((code: string) => {
    const normalizedCode = normalizeText(code);
    if (normalizedCode) {
      diagnosisCodes.add(normalizedCode);
    }
  });

  (charge.approvedCodingLines ?? charge.chargeLines ?? []).forEach((line: any) => {
    (line.icdCodes ?? []).forEach((code: string) => {
      const normalizedCode = normalizeText(code);
      if (normalizedCode) {
        diagnosisCodes.add(normalizedCode);
      }
    });
  });

  return Array.from(diagnosisCodes);
}

function buildCodingSnapshotHash(lines: any[] = []) {
  const payload = lines.map((line) => ({
    lineNumber: line.lineNumber,
    chargeLineId: line.chargeLineId?.toString?.() ?? line.chargeLineId,
    cptCode: normalizeText(line.cptCode)?.toUpperCase(),
    modifiers: (line.modifiers ?? []).map((modifier: unknown) => normalizeText(modifier)?.toUpperCase()).filter(Boolean),
    icdCodes: (line.icdCodes ?? []).map((code: unknown) => normalizeText(code)?.toUpperCase()).filter(Boolean),
    icdPointers: (line.icdPointers ?? []).filter((pointer: unknown) => typeof pointer === 'number' && Number.isFinite(pointer)),
    units: line.units,
    chargeAmount: line.chargeAmount,
    placeOfService: normalizeText(line.placeOfService),
    renderingProviderId: line.renderingProviderId?.toString?.() ?? line.renderingProviderId,
    serviceDateFrom: normalizeDate(line.serviceDateFrom)?.toISOString?.(),
  }));

  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

async function getApprovedCodingReviewForCharge(chargeId: unknown) {
  if (!chargeId) {
    return null;
  }

  return CodingReview.findOne({
    chargeId,
    scrubStatus: 'Approved',
    isDeleted: false,
  }).sort({ updated: -1 });
}

function getApprovedCodingLines(codingReview: any) {
  return (codingReview?.approvedCodingSnapshot?.lines ?? [])
    .filter((line: any) => normalizeText(line?.cptCode));
}

async function resolveClaimInsurancePolicy(charge: any, encounter: any) {
  const frozenPolicyId = encounter?.insurancePolicySnapshot?.insurancePolicyId;

  if (frozenPolicyId) {
    const frozenPolicy = await InsurancePolicy.findOne({
      _id: frozenPolicyId,
      isDeleted: false,
    });

    if (frozenPolicy) {
      return frozenPolicy;
    }
  }

  return resolveActiveInsurancePolicy(charge.patientId, {
    serviceDate: charge.serviceDate,
  });
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
  const serviceDate = normalizeBusinessDate(options.serviceDate);
  const policyIsValidForServiceDate = (policy: any) => (
    !serviceDate
    || (
      isDateOnOrAfter(serviceDate, normalizeBusinessDate(policy.effectiveDate))
      && isDateOnOrBefore(serviceDate, normalizeBusinessDate(policy.terminationDate))
    )
  );
  const findValidPolicy = (policies: any[]) => {
    if (serviceDate) {
      return policies.find(policyIsValidForServiceDate) ?? null;
    }

    return policies[0] ?? null;
  };

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

async function getClaimSnapshotIssues(claim: any) {
  const issues: string[] = [];

  if (!claim?.chargeId) {
    return issues;
  }

  const [charge, approvedCodingReview] = await Promise.all([
    Charge.findOne({ _id: claim.chargeId, isDeleted: false }).select('_id updated').lean(),
    getApprovedCodingReviewForCharge(claim.chargeId),
  ]);

  const claimSourceChargeUpdatedAt = normalizeDate(claim.sourceChargeUpdatedAt) ?? normalizeDate(claim.created);
  const claimSourceCodingReviewUpdatedAt = normalizeDate(claim.sourceCodingReviewUpdatedAt) ?? normalizeDate(claim.created);

  if (!approvedCodingReview) {
    issues.push('Claim is not backed by an approved coding review.');
    return issues;
  }

  if (
    charge?.updated
    && claimSourceChargeUpdatedAt
    && normalizeDate(charge.updated)!.getTime() > claimSourceChargeUpdatedAt.getTime()
  ) {
    issues.push('Claim snapshot is outdated due to upstream coding/charge changes.');
  }

  if (
    approvedCodingReview?.updated
    && claimSourceCodingReviewUpdatedAt
    && normalizeDate(approvedCodingReview.updated)!.getTime() > claimSourceCodingReviewUpdatedAt.getTime()
  ) {
    issues.push('Claim snapshot is outdated because the approved coding review changed after claim creation.');
  }

  const approvedLines = getApprovedCodingLines(approvedCodingReview);
  const currentSnapshotHash =
    approvedCodingReview?.approvedCodingSnapshot?.snapshotHash
    ?? buildCodingSnapshotHash(approvedLines);

  if (
    approvedLines.length
    && claim.sourceCodingSnapshotHash
    && currentSnapshotHash
    && claim.sourceCodingSnapshotHash !== currentSnapshotHash
  ) {
    issues.push('Claim service lines do not match the current approved coding snapshot.');
  }

  return Array.from(new Set(issues));
}

async function resolveLatestEligibilityVerification(patientId: any, insuranceId?: any) {
  if (!patientId) {
    return null;
  }

  const filter: Record<string, unknown> = {
    patientId,
    isDeleted: false,
    active: true,
  };

  if (insuranceId) {
    filter.insuranceId = insuranceId;
  }

  return EligibilityVerification.findOne(filter).sort({ checkedAt: -1, updated: -1 });
}

async function resolveLatestLineEligibilityVerification(options: {
  patientId: any;
  insuranceId?: any;
  payerId?: string;
  cptCode?: string;
  serviceDate?: unknown;
}) {
  const patientId = options.patientId;

  if (!patientId) {
    return null;
  }

  const cptCode = normalizeText(options.cptCode)?.toUpperCase();
  const filter: Record<string, unknown> = {
    patientId,
    isDeleted: false,
    active: true,
    ...(options.insuranceId ? { insuranceId: options.insuranceId } : {}),
    ...(options.payerId ? { payerId: options.payerId } : {}),
  };

  if (cptCode) {
    filter.$or = [
      { procedureCodes: cptCode },
      { procedureCodes: { $size: 0 } },
      { procedureCodes: { $exists: false } },
    ];
  }

  return EligibilityVerification.findOne(filter).sort({ checkedAt: -1, updated: -1 });
}

async function lookupLatestEligibilityVerification(options: {
  patientId: any;
  insurancePolicy?: any;
  payerId?: string;
  cptCode?: string;
  serviceDate?: unknown;
  coveragePriority?: string;
}) {
  if (!options.patientId) {
    return null;
  }

  const payerId = normalizeText(options.payerId ?? options.insurancePolicy?.payerId);
  const cptCode = normalizeText(options.cptCode)?.toUpperCase();
  const serviceDate = normalizeBusinessDate(options.serviceDate);
  const coveragePriority = normalizeText(options.coveragePriority ?? options.insurancePolicy?.coveragePriority);
  const filter: Record<string, unknown> = {
    patientId: options.patientId,
    isDeleted: false,
    active: true,
    ...(options.insurancePolicy?._id ? { insuranceId: options.insurancePolicy._id } : {}),
    ...(payerId ? { payerId } : {}),
  };

  const candidates = await EligibilityVerification.find(filter).sort({ checkedAt: -1, updated: -1 });
  const matchedCandidates = candidates.filter((eligibility: any) => {
    if (coveragePriority && normalizeText(eligibility.coveragePriority) && normalizeText(eligibility.coveragePriority) !== coveragePriority) {
      return false;
    }

    if (serviceDate && normalizeBusinessDate(eligibility.serviceDate) && !isSameBusinessDate(normalizeBusinessDate(eligibility.serviceDate), serviceDate)) {
      return false;
    }

    return eligibilityCoversProcedure(eligibility, cptCode);
  });

  return matchedCandidates[0] ?? null;
}

function validateEligibilityVerificationForLine(options: {
  eligibility: any;
  insurancePolicy?: any;
  claimPayerId?: string;
  lineNumber: number;
  cptCode?: string;
  serviceDate?: unknown;
  coveragePriority?: string;
}) {
  const errors: string[] = [];
  const requiredActions: string[] = [];
  const { eligibility, insurancePolicy, lineNumber } = options;
  const serviceDate = normalizeBusinessDate(options.serviceDate);
  const eligibilityCheckedAt = normalizeDate(eligibility?.checkedAt);
  const freshnessCutoff = getEligibilityFreshnessCutoff();
  const claimPayerId = normalizeText(options.claimPayerId ?? insurancePolicy?.payerId);
  const eligibilityPayerId = normalizeText(eligibility?.payerId);

  if (!eligibility) {
    errors.push(`Claim line ${lineNumber}: Eligibility verification is missing.`);
    requiredActions.push('Run real-time eligibility for the active policy and service date.');
    return { errors, requiredActions };
  }

  if (eligibilityCheckedAt && eligibilityCheckedAt < freshnessCutoff) {
    errors.push(`Claim line ${lineNumber}: Eligibility verification is older than ${envConfig.eligibilityValidDays} days.`);
    requiredActions.push('Re-run eligibility before claim submission.');
  }

  if (!eligibilityCheckedAt) {
    errors.push(`Claim line ${lineNumber}: Eligibility verification is missing a verification timestamp.`);
    requiredActions.push('Re-run eligibility before claim submission.');
  }

  if (eligibility.planActive !== true || !isActiveEligibilityStatus(eligibility.coverageStatus ?? eligibility.eligibilityStatus)) {
    errors.push(`Claim line ${lineNumber}: Patient coverage is inactive for date of service.`);
    requiredActions.push('Resolve inactive coverage or select the correct active insurance policy.');
  }

  if (claimPayerId && eligibilityPayerId && claimPayerId !== eligibilityPayerId) {
    errors.push(`Claim line ${lineNumber}: Eligibility payer does not match claim payer.`);
    requiredActions.push('Run eligibility for the claim payer.');
  }

  if (insurancePolicy?._id && eligibility.insuranceId && String(eligibility.insuranceId) !== String(insurancePolicy._id)) {
    errors.push(`Claim line ${lineNumber}: Eligibility policy does not match active insurance policy.`);
    requiredActions.push('Run eligibility for the active insurance policy.');
  }

  if (serviceDate && normalizeBusinessDate(eligibility.serviceDate) && !isSameBusinessDate(normalizeBusinessDate(eligibility.serviceDate), serviceDate)) {
    errors.push(`Claim line ${lineNumber}: Eligibility service date does not match the claim date of service.`);
    requiredActions.push('Run eligibility for the claim service date.');
  }

  if (!eligibilityCoversProcedure(eligibility, options.cptCode)) {
    errors.push(`Claim line ${lineNumber}: Eligibility verification does not include CPT ${options.cptCode}.`);
    requiredActions.push('Run CPT-specific eligibility for this service line.');
  }

  return { errors, requiredActions };
}

function readNestedBoolean(source: unknown, path: string) {
  const value = path.split('.').reduce<unknown>((current, segment) => {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, source);

  return typeof value === 'boolean' ? value : false;
}

function normalizeCodeList(values: unknown) {
  return Array.isArray(values)
    ? values
        .map((value) => normalizeText(value)?.toUpperCase())
        .filter((value): value is string => Boolean(value))
    : [];
}

function recordMatchesReference(recordValue: unknown, claimValue: unknown) {
  if (!recordValue) {
    return true;
  }

  if (!claimValue) {
    return false;
  }

  return String(recordValue) === String(claimValue);
}

function recordCodesCover(recordCodes: unknown, claimCode?: string) {
  const normalizedClaimCode = normalizeText(claimCode)?.toUpperCase();
  const normalizedRecordCodes = normalizeCodeList(recordCodes);

  return normalizedClaimCode ? normalizedRecordCodes.includes(normalizedClaimCode) : false;
}

async function isProcedureAuthorizationRequired(cptCode?: string) {
  const normalizedCptCode = normalizeText(cptCode)?.toUpperCase();

  if (!normalizedCptCode) {
    return false;
  }

  return Boolean(
    await ProcedureCode.exists({
      code: normalizedCptCode,
      requiresAuth: true,
      active: true,
      isDeleted: false,
    })
  );
}

function isLineAuthorizationRequired(line: any) {
  return Boolean(
    line.authorizationRequired ||
    readNestedBoolean(line.coverageRuleSnapshot, 'eligibility.authorizationRequired') ||
    readNestedBoolean(line.coverageRuleSnapshot, 'coverageRules.authorizationRequired')
  );
}

function isLineReferralRequired(line: any) {
  return Boolean(
    line.referralRequired ||
    readNestedBoolean(line.coverageRuleSnapshot, 'eligibility.referralRequired') ||
    readNestedBoolean(line.coverageRuleSnapshot, 'coverageRules.referralRequired')
  );
}

function validateAuthorizationCandidate(authorization: any, options: {
  claim: any;
  line: any;
  insurancePolicy?: any;
}) {
  const errors: string[] = [];
  const serviceDate = normalizeBusinessDate(options.line.serviceDateFrom ?? getClaimServiceDate(options.claim));
  const status = normalizeTextLower(authorization?.authorizationStatus);
  const authNumber = normalizeText(authorization?.authNumber);

  if (!authorization) {
    return ['Authorization is required but no matching authorization exists.'];
  }

  if (!authNumber) {
    errors.push('Authorization is missing an authorization number.');
  }

  if (!status || !APPROVED_AUTHORIZATION_STATUSES.has(status)) {
    errors.push(`Authorization status is not approved (${authorization.authorizationStatus ?? 'unknown'}).`);
  }

  if (['denied', 'cancelled', 'canceled', 'expired', 'closed'].includes(status ?? '')) {
    errors.push(`Authorization status is invalid for submission (${authorization.authorizationStatus}).`);
  }

  if (!recordMatchesReference(authorization.patientId, options.claim.patientId)) {
    errors.push('Authorization patient does not match claim patient.');
  }

  if (!recordMatchesReference(authorization.payerId, options.claim.payerId ?? options.insurancePolicy?.payerId)) {
    errors.push('Authorization payer does not match claim payer.');
  }

  if (!recordMatchesReference(authorization.insuranceId, options.insurancePolicy?._id)) {
    errors.push('Authorization policy does not match active insurance policy.');
  }

  if (!recordMatchesReference(authorization.providerId, options.line.renderingProviderId ?? options.claim.renderingProviderId ?? options.claim.billingProviderId)) {
    errors.push('Authorization provider does not match claim rendering provider.');
  }

  if (!recordMatchesReference(authorization.facilityId, options.claim.facilityId)) {
    errors.push('Authorization facility does not match claim facility.');
  }

  if (!recordCodesCover(authorization.procedureCodes, options.line.cptCode)) {
    errors.push(`Authorization does not include CPT ${options.line.cptCode ?? '-'}.`);
  }

  if (serviceDate && normalizeBusinessDate(authorization.serviceDate) && !isDateOnOrBefore(normalizeBusinessDate(authorization.serviceDate), serviceDate)) {
    errors.push('Authorization service date is after the claim date of service.');
  }

  if (serviceDate && !isDateOnOrAfter(normalizeBusinessDate(authorization.expirationDate), serviceDate)) {
    errors.push('Authorization is expired for the claim date of service.');
  }

  return errors;
}

function validateReferralCandidate(referral: any, options: {
  claim: any;
  line: any;
  insurancePolicy?: any;
}) {
  const errors: string[] = [];
  const serviceDate = normalizeBusinessDate(options.line.serviceDateFrom ?? getClaimServiceDate(options.claim));
  const status = normalizeTextLower(referral?.referralStatus);

  if (!referral) {
    return ['Referral is required but no matching referral exists.'];
  }

  if (!normalizeText(referral.referralNumber)) {
    errors.push('Referral is missing a referral number.');
  }

  if (status && INVALID_REFERRAL_STATUSES.has(status)) {
    errors.push(`Referral status is invalid for submission (${referral.referralStatus}).`);
  }

  if (!recordMatchesReference(referral.patientId, options.claim.patientId)) {
    errors.push('Referral patient does not match claim patient.');
  }

  if (!recordMatchesReference(referral.payerId, options.claim.payerId)) {
    errors.push('Referral payer does not match claim payer.');
  }

  if (!recordMatchesReference(referral.insuranceId, options.insurancePolicy?._id)) {
    errors.push('Referral policy does not match active insurance policy.');
  }

  if (!recordMatchesReference(referral.facilityId, options.claim.facilityId)) {
    errors.push('Referral facility does not match claim facility.');
  }

  if (!recordMatchesReference(referral.referredToProviderId, options.line.renderingProviderId ?? options.claim.renderingProviderId ?? options.claim.billingProviderId)) {
    errors.push('Referral provider does not match claim rendering provider.');
  }

  if (!recordCodesCover(referral.procedureCodes, options.line.cptCode)) {
    errors.push(`Referral does not include CPT ${options.line.cptCode ?? '-'}.`);
  }

  if (serviceDate && !isDateWithinRange(serviceDate, normalizeBusinessDate(referral.startDate), normalizeBusinessDate(referral.endDate))) {
    errors.push('Referral is not valid for the claim date of service.');
  }

  if (typeof referral.remainingVisits === 'number' && referral.remainingVisits <= 0) {
    errors.push('Referral has no remaining visits.');
  }

  return errors;
}

async function findMatchingAuthorization(claim: any, line: any, insurancePolicy?: any, authorizationId?: unknown) {
  const baseFilter: Record<string, unknown> = {
    patientId: claim.patientId,
    isDeleted: false,
    active: true,
  };

  if (authorizationId) {
    baseFilter._id = authorizationId;
  }

  const candidates = await PriorAuthorization.find(baseFilter).sort({ updated: -1, requestDate: -1 });

  return candidates.find((authorization: any) =>
    validateAuthorizationCandidate(authorization, { claim, line, insurancePolicy }).length === 0
  ) ?? null;
}

async function findMatchingReferral(claim: any, line: any, insurancePolicy?: any, referralId?: unknown) {
  const baseFilter: Record<string, unknown> = {
    patientId: claim.patientId,
    isDeleted: false,
    active: true,
  };

  if (referralId) {
    baseFilter._id = referralId;
  }

  const candidates = await Referral.find(baseFilter).sort({ updated: -1, startDate: -1 });

  return candidates.find((referral: any) =>
    validateReferralCandidate(referral, { claim, line, insurancePolicy }).length === 0
  ) ?? null;
}

async function evaluateAuthorizationReadiness(claim: any, insurancePolicy?: any) {
  const errors: string[] = [];
  let required = false;
  let linkedAuthorizationId: string | undefined;

  for (const [index, line] of (claim.claimLines ?? []).entries()) {
    const lineNumber = line.lineNumber ?? index + 1;
    const lineRequiresAuthorization =
      isLineAuthorizationRequired(line) ||
      await isProcedureAuthorizationRequired(line.cptCode);

    if (!lineRequiresAuthorization) {
      continue;
    }

    required = true;
    const linkedAuthorization = line.priorAuthorizationId
      ? await PriorAuthorization.findOne({ _id: line.priorAuthorizationId, isDeleted: false, active: true })
      : null;
    const linkedErrors = linkedAuthorization
      ? validateAuthorizationCandidate(linkedAuthorization, { claim, line, insurancePolicy })
      : ['Authorization is required but no authorization is linked to the claim line.'];
    const matchingAuthorization = linkedErrors.length
      ? await findMatchingAuthorization(claim, line, insurancePolicy)
      : linkedAuthorization;

    if (!matchingAuthorization) {
      errors.push(...linkedErrors.map((error) => `Claim line ${lineNumber}: ${error}`));
      continue;
    }

    linkedAuthorizationId = String(matchingAuthorization._id);
  }

  return {
    authorizationRequired: required,
    authorizationValid: !required || errors.length === 0,
    authorizationId: linkedAuthorizationId,
    authorizationErrors: Array.from(new Set(errors)),
  };
}

async function evaluateReferralReadiness(claim: any, insurancePolicy?: any) {
  const errors: string[] = [];
  let required = false;
  let linkedReferralId: string | undefined;

  for (const [index, line] of (claim.claimLines ?? []).entries()) {
    const lineNumber = line.lineNumber ?? index + 1;
    const lineRequiresReferral = isLineReferralRequired(line);

    if (!lineRequiresReferral) {
      continue;
    }

    required = true;
    const linkedReferral = line.referralId
      ? await Referral.findOne({ _id: line.referralId, isDeleted: false, active: true })
      : null;
    const linkedErrors = linkedReferral
      ? validateReferralCandidate(linkedReferral, { claim, line, insurancePolicy })
      : ['Referral is required but no referral is linked to the claim line.'];
    const matchingReferral = linkedErrors.length
      ? await findMatchingReferral(claim, line, insurancePolicy)
      : linkedReferral;

    if (!matchingReferral) {
      errors.push(...linkedErrors.map((error) => `Claim line ${lineNumber}: ${error}`));
      continue;
    }

    linkedReferralId = String(matchingReferral._id);
  }

  return {
    referralRequired: required,
    referralValid: !required || errors.length === 0,
    referralId: linkedReferralId,
    referralErrors: Array.from(new Set(errors)),
  };
}

async function resolveAndValidateLineEligibility(options: {
  claim: any;
  line: any;
  lineNumber: number;
  insurancePolicy?: any;
}) {
  const eligibility =
    (options.line.eligibilityVerificationId
      ? await EligibilityVerification.findOne({
          _id: options.line.eligibilityVerificationId,
          isDeleted: false,
          active: true,
        })
      : null)
    ?? await lookupLatestEligibilityVerification({
      patientId: options.claim.patientId,
      insurancePolicy: options.insurancePolicy,
      payerId: options.claim.payerId,
      cptCode: options.line.cptCode,
      serviceDate: options.line.serviceDateFrom ?? getClaimServiceDate(options.claim),
      coveragePriority: options.claim.coveragePriority,
    });

  const validation = validateEligibilityVerificationForLine({
    eligibility,
    insurancePolicy: options.insurancePolicy,
    claimPayerId: options.claim.payerId,
    lineNumber: options.lineNumber,
    cptCode: options.line.cptCode,
    serviceDate: options.line.serviceDateFrom ?? getClaimServiceDate(options.claim),
    coveragePriority: options.claim.coveragePriority,
  });

  return {
    eligibility,
    ...validation,
  };
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

type ExpectedResponsibilityAccumulator = {
  remainingDeductibleByKey: Map<string, number>;
  remainingOutOfPocketByKey: Map<string, number>;
};

type ExpectedResponsibilityResult = {
  patientCopayAmount?: number;
  deductibleAppliedAmount?: number;
  patientCoinsuranceAmount?: number;
  expectedPatientResponsibility?: number;
  expectedInsurancePayment?: number;
};

function createExpectedResponsibilityAccumulator(): ExpectedResponsibilityAccumulator {
  return {
    remainingDeductibleByKey: new Map<string, number>(),
    remainingOutOfPocketByKey: new Map<string, number>(),
  };
}

function eligibilityAccumulatorKey(eligibility: any) {
  return String(
    eligibility?._id
    ?? [
      eligibility?.patientId,
      eligibility?.insuranceId,
      eligibility?.payerId,
      eligibility?.coveragePriority,
      eligibility?.checkedAt,
    ].filter(Boolean).join(':')
    ?? 'default'
  );
}

function getAccumulatorValue(
  map: Map<string, number>,
  key: string,
  initialValue: unknown,
) {
  if (!map.has(key)) {
    map.set(key, Math.max(Number(initialValue ?? 0), 0));
  }
  return Number(map.get(key) ?? 0);
}

function calculateExpectedResponsibility(
  allowedAmount: number | undefined,
  eligibility: any,
  accumulator?: ExpectedResponsibilityAccumulator,
): ExpectedResponsibilityResult {
  if (typeof allowedAmount !== 'number' || !Number.isFinite(allowedAmount) || !eligibility) {
    return {};
  }

  const accumulatorKey = accumulator ? eligibilityAccumulatorKey(eligibility) : undefined;
  const copay = typeof eligibility.copayAmount === 'number'
    ? Math.min(Math.max(eligibility.copayAmount, 0), allowedAmount)
    : 0;
  const remainingAfterCopay = Math.max(0, allowedAmount - copay);
  const availableDeductible = typeof eligibility.deductibleRemaining === 'number'
    ? accumulator && accumulatorKey
      ? getAccumulatorValue(accumulator.remainingDeductibleByKey, accumulatorKey, eligibility.deductibleRemaining)
      : Math.max(eligibility.deductibleRemaining, 0)
    : 0;
  let deductible = typeof eligibility.deductibleRemaining === 'number'
    ? Math.min(availableDeductible, remainingAfterCopay)
    : 0;
  const remainingAfterDeductible = Math.max(0, remainingAfterCopay - deductible);
  const coinsuranceRate = typeof eligibility.coinsurancePercent === 'number'
    ? Math.max(0, Math.min(100, eligibility.coinsurancePercent)) / 100
    : 0;
  let coinsurance = remainingAfterDeductible * coinsuranceRate;
  const uncappedPatientResponsibility = roundCurrency(copay + deductible + coinsurance);
  const availableOutOfPocket = typeof eligibility.outOfPocketRemaining === 'number'
    ? accumulator && accumulatorKey
      ? getAccumulatorValue(accumulator.remainingOutOfPocketByKey, accumulatorKey, eligibility.outOfPocketRemaining)
      : Math.max(eligibility.outOfPocketRemaining, 0)
    : undefined;
  const patientResponsibility = typeof availableOutOfPocket === 'number'
    ? Math.min(uncappedPatientResponsibility, availableOutOfPocket)
    : uncappedPatientResponsibility;
  const cappedReduction = roundCurrency(Math.max(0, uncappedPatientResponsibility - patientResponsibility));

  if (cappedReduction > 0) {
    const coinsuranceReduction = Math.min(coinsurance, cappedReduction);
    coinsurance = roundCurrency(coinsurance - coinsuranceReduction);
    const deductibleReduction = Math.min(deductible, roundCurrency(cappedReduction - coinsuranceReduction));
    deductible = roundCurrency(deductible - deductibleReduction);
  }

  if (accumulator && accumulatorKey) {
    if (typeof eligibility.deductibleRemaining === 'number') {
      accumulator.remainingDeductibleByKey.set(
        accumulatorKey,
        roundCurrency(Math.max(0, availableDeductible - deductible))
      );
    }
    if (typeof availableOutOfPocket === 'number') {
      accumulator.remainingOutOfPocketByKey.set(
        accumulatorKey,
        roundCurrency(Math.max(0, availableOutOfPocket - patientResponsibility))
      );
    }
  }

  const insurancePayment = Math.max(0, allowedAmount - patientResponsibility);

  return {
    patientCopayAmount: roundCurrency(copay),
    deductibleAppliedAmount: roundCurrency(deductible),
    patientCoinsuranceAmount: roundCurrency(coinsurance),
    expectedPatientResponsibility: roundCurrency(patientResponsibility),
    expectedInsurancePayment: roundCurrency(insurancePayment),
  };
}

function buildCoverageSnapshot(eligibility: any, coverageRules: CoverageRuleEvaluationResult) {
  return {
    eligibility: eligibility
      ? {
          eligibilityVerificationId: String(eligibility._id),
          eligibilityStatus: eligibility.eligibilityStatus,
          coverageStatus: eligibility.coverageStatus,
          planActive: eligibility.planActive,
          copayAmount: eligibility.copayAmount,
          coinsurancePercent: eligibility.coinsurancePercent,
          deductibleRemaining: eligibility.deductibleRemaining,
          outOfPocketRemaining: eligibility.outOfPocketRemaining,
          networkStatus: eligibility.networkStatus,
          referralRequired: eligibility.referralRequired,
          authorizationRequired: eligibility.authorizationRequired,
          checkedAt: eligibility.checkedAt,
          vendorName: eligibility.vendorName,
        }
      : null,
    coverageRules,
  };
}

async function refreshClaimPricingSnapshots(claim: any) {
  const serviceDate = getClaimServiceDate(claim);
  const insurancePolicy = await resolveActiveInsurancePolicy(claim.patientId, {
    payerId: claim.payerId,
    coveragePriority: claim.coveragePriority,
    serviceDate,
  });
  const facility = claim.facilityId
    ? await Facility.findOne({ _id: claim.facilityId, isDeleted: false, active: true })
    : null;
  const payerLookupIds = Array.from(new Set([
    claim.payerId,
    insurancePolicy?.payerId,
    insurancePolicy?.ediPayerId,
  ].map(normalizeText).filter((value): value is string => Boolean(value))));
  const pricingResults: Array<{
    lineNumber: number;
    cptCode?: string;
    matched: boolean;
    feeScheduleId?: string;
    allowedAmount?: number;
    message: string;
  }> = [];
  const responsibilityAccumulator = createExpectedResponsibilityAccumulator();

  for (const [index, line] of (claim.claimLines ?? []).entries()) {
    const lineNumber = line.lineNumber ?? index + 1;
    const cptCode = normalizeText(line.cptCode)?.toUpperCase();
    const lineServiceDate = normalizeDate(line.serviceDateFrom) ?? serviceDate;
    const units = typeof line.units === 'number' && line.units > 0 ? line.units : 1;
    const lineRenderingProviderId = line.renderingProviderId ?? claim.renderingProviderId ?? claim.billingProviderId;
    const placeOfService = normalizeText(line.placeOfService) ?? normalizeText(facility?.placeOfServiceCode);
    const eligibility = await lookupLatestEligibilityVerification({
      patientId: claim.patientId,
      insurancePolicy,
      payerId: claim.payerId ?? insurancePolicy?.payerId,
      cptCode,
      serviceDate: lineServiceDate,
      coveragePriority: claim.coveragePriority ?? insurancePolicy?.coveragePriority,
    });
    const feeScheduleMatch = cptCode
      ? await feeScheduleService.findBestMatchDetailed({
          payerIds: payerLookupIds,
          cptCode,
          modifiers: line.modifiers ?? [],
          providerId: normalizeText(lineRenderingProviderId?.toString?.()),
          facilityId: normalizeText(claim.facilityId?.toString?.()),
          state: facility?.state,
          placeOfServiceCode: placeOfService,
          planName: insurancePolicy?.planName,
          groupNumber: insurancePolicy?.groupNumber,
          network: insurancePolicy?.network,
          coverageType: insurancePolicy?.coverageType,
          serviceDate: lineServiceDate,
        })
      : null;

    if (!feeScheduleMatch) {
      line.expectedAllowedAmount = undefined;
      line.expectedInsurancePayment = undefined;
      line.expectedPatientResponsibility = undefined;
      line.patientCopayAmount = undefined;
      line.patientCoinsuranceAmount = undefined;
      line.deductibleAppliedAmount = undefined;
      line.feeScheduleId = undefined;
      line.pricingMatchedBy = undefined;
      line.pricingSource = undefined;
      line.pricingSnapshotDate = new Date();
      pricingResults.push({
        lineNumber,
        cptCode,
        matched: false,
        message: `No configured payer contract rate matched CPT ${cptCode ?? lineNumber}.`,
      });
      continue;
    }

    const expectedAllowedAmount = roundCurrency(feeScheduleMatch.allowedAmount * units);
    const responsibility = calculateExpectedResponsibility(expectedAllowedAmount, eligibility, responsibilityAccumulator);
    const coverageRuleEvaluation = await coverageRuleService.evaluateCoverageRules({
      payerId: claim.payerId ?? insurancePolicy?.payerId,
      patientId: normalizeText(claim.patientId?.toString?.()),
      insurancePolicyId: normalizeText(insurancePolicy?._id?.toString?.()),
      providerId: normalizeText(lineRenderingProviderId?.toString?.()),
      facilityId: normalizeText(claim.facilityId?.toString?.()),
      state: facility?.state,
      cptCode,
      diagnosisCodes: claim.diagnosisCodes ?? [],
      modifiers: line.modifiers ?? [],
      posCode: placeOfService,
      serviceDate: lineServiceDate,
      planName: insurancePolicy?.planName,
      groupNumber: insurancePolicy?.groupNumber,
      network: insurancePolicy?.network,
      coverageType: insurancePolicy?.coverageType,
      eligibilityVerificationId: eligibility?._id ? String(eligibility._id) : undefined,
    });

    line.expectedAllowedAmount = expectedAllowedAmount;
    line.expectedInsurancePayment = responsibility.expectedInsurancePayment;
    line.expectedPatientResponsibility = responsibility.expectedPatientResponsibility;
    line.patientCopayAmount = responsibility.patientCopayAmount;
    line.patientCoinsuranceAmount = responsibility.patientCoinsuranceAmount;
    line.deductibleAppliedAmount = responsibility.deductibleAppliedAmount;
    line.feeScheduleId = feeScheduleMatch.feeSchedule._id;
    line.pricingMatchedBy = feeScheduleMatch.matchedBy;
    line.pricingSource = feeScheduleMatch.source;
    line.pricingSnapshotDate = new Date();
    line.coverageRuleSnapshot = buildCoverageSnapshot(eligibility, coverageRuleEvaluation);
    line.payerRuleSnapshot = {
      coverageRuleIds: coverageRuleEvaluation.matchedRules.map((rule) => rule._id),
    };
    line.eligibilityVerificationId = eligibility?._id ?? line.eligibilityVerificationId;
    line.authorizationRequired = Boolean(eligibility?.authorizationRequired || coverageRuleEvaluation.authorizationRequired);
    line.referralRequired = Boolean(eligibility?.referralRequired || coverageRuleEvaluation.referralRequired);
    line.networkStatus = insurancePolicy?.network;

    pricingResults.push({
      lineNumber,
      cptCode,
      matched: true,
      feeScheduleId: String(feeScheduleMatch.feeSchedule._id),
      allowedAmount: expectedAllowedAmount,
      message: `Matched ${feeScheduleMatch.matchedBy}.`,
    });
  }

  claim.markModified?.('claimLines');
  return pricingResults;
}

async function refreshClaimPricingSnapshotsIfClaimLinesChanged(claim: any, claimLinesChanged: boolean) {
  if (!claimLinesChanged) {
    return;
  }

  await refreshClaimPricingSnapshots(claim);
}

function claimHasMissingPricingSnapshots(claim: any) {
  return (claim.claimLines ?? []).some((line: any) =>
    normalizeText(line.cptCode) && (!line.feeScheduleId || typeof line.expectedAllowedAmount !== 'number')
  );
}

async function refreshMissingClaimPricingSnapshots(claim: any, updatedBy?: string) {
  if (!claimHasMissingPricingSnapshots(claim)) {
    return false;
  }

  await refreshClaimPricingSnapshots(claim);
  claim.updatedBy = updatedBy as any;
  claim.updated = new Date();
  await claim.save();
  return true;
}

async function ensureEligibilityReady(claim: any, insurancePolicy: any) {
  let latestEligibility: any = null;
  const errors: string[] = [];

  for (const [index, line] of (claim.claimLines ?? []).entries()) {
    const lineNumber = line.lineNumber ?? index + 1;
    const result = await resolveAndValidateLineEligibility({
      claim,
      line,
      lineNumber,
      insurancePolicy,
    });

    if (!latestEligibility && result.eligibility) {
      latestEligibility = result.eligibility;
    }

    errors.push(...result.errors);
  }

  if (errors.length) {
    throw buildValidationError(`Claim eligibility is not ready: ${Array.from(new Set(errors)).join('; ')}`);
  }

  const lastVerifiedAt = normalizeDate(latestEligibility?.checkedAt);

  if (!lastVerifiedAt) {
    throw buildValidationError(
      'Claim cannot be submitted until eligibility verification is completed for the active insurance policy.'
    );
  }

  return latestEligibility;
}

async function ensurePriorAuthorizationReady(
  claim: any,
  insurancePolicy: any,
  latestEligibility?: any,
  authorizationRequiredOverride?: boolean
) {
  const eligibility =
    latestEligibility ?? await resolveLatestEligibilityVerification(claim.patientId, insurancePolicy?._id);
  const authorizationRequired =
    typeof authorizationRequiredOverride === 'boolean'
      ? authorizationRequiredOverride
      : await resolveClaimAuthorizationRequired(claim, eligibility);

  if (!authorizationRequired) {
    return null;
  }

  const claimServiceDates = getClaimServiceDates(claim);
  const claimProcedureCodes = getClaimProcedureCodes(claim);

  const priorAuthorizations = await PriorAuthorization.find({
    patientId: claim.patientId,
    insuranceId: insurancePolicy?._id,
    isDeleted: false,
    active: true,
  }).sort({ updated: -1, requestDate: -1 });

  const matchingAuthorization = priorAuthorizations.find((authorization) => {
    const status = normalizeTextLower(authorization.authorizationStatus);
    const hasApprovedStatus = status ? APPROVED_AUTHORIZATION_STATUSES.has(status) : false;
    const hasAuthorizationNumber = Boolean(normalizeText(authorization.authNumber));
    const expirationDate = normalizeBusinessDate(authorization.expirationDate);
    const isNotExpired = claimServiceDates.every((serviceDate) => isDateOnOrAfter(expirationDate, serviceDate));
    const authorizedProcedureCodes = (authorization.procedureCodes ?? [])
      .map((code: string) => normalizeText(code))
      .filter((code: string | undefined): code is string => Boolean(code));
    const proceduresCovered =
      !claimProcedureCodes.length
      || !authorizedProcedureCodes.length
      || claimProcedureCodes.every((code: string) => authorizedProcedureCodes.includes(code));

    return hasApprovedStatus && hasAuthorizationNumber && isNotExpired && proceduresCovered;
  });

  if (!matchingAuthorization) {
    throw buildValidationError(
      'Claim requires an approved prior authorization with a valid authorization number before submission.'
    );
  }

  return matchingAuthorization;
}

async function ensureReferralReady(
  claim: any,
  insurancePolicy: any,
  latestEligibility?: any
) {
  const eligibility =
    latestEligibility ?? await resolveLatestEligibilityVerification(claim.patientId, insurancePolicy?._id);

  if (!eligibility?.referralRequired) {
    return null;
  }

  const claimServiceDates = getClaimServiceDates(claim);
  const claimProcedureCodes = getClaimProcedureCodes(claim);
  const encounter = claim.encounterId
    ? await Encounter.findOne({ _id: claim.encounterId, isDeleted: false })
    : null;
  const appointment = encounter?.appointmentId
    ? await Appointment.findOne({ _id: encounter.appointmentId, isDeleted: false, active: true })
    : null;
  const appointmentReferralNumber = normalizeText(appointment?.referral?.referralNumber);

  if (
    appointment?.referral?.required
    && appointmentReferralNumber
    && claimServiceDates.every((serviceDate) =>
      isDateWithinRange(
        serviceDate,
        normalizeBusinessDate(appointment.referral?.validFrom),
        normalizeBusinessDate(appointment.referral?.validTo)
      )
    )
  ) {
    return {
      source: 'appointment',
      referralNumber: appointmentReferralNumber,
    };
  }

  const payerReference = normalizeText(claim.payerId ?? insurancePolicy?.payerId);
  const referrals = await Referral.find({
    patientId: claim.patientId,
    isDeleted: false,
    active: true,
    ...(payerReference ? { payerId: payerReference } : {}),
  }).sort({ updated: -1, startDate: -1 });

  const matchingReferral = referrals.find((referral) => {
    const referralNumber = normalizeText(referral.referralNumber);
    const referralStatus = normalizeTextLower(referral.referralStatus);
    const appointmentMatches =
      !appointment?._id
      || !referral.appointmentId
      || String(referral.appointmentId) === String(appointment._id);
    const referralProcedureCodes = (referral.procedureCodes ?? [])
      .map((code: string) => normalizeText(code))
      .filter((code: string | undefined): code is string => Boolean(code));
    const proceduresCovered =
      !claimProcedureCodes.length
      || !referralProcedureCodes.length
      || claimProcedureCodes.every((code: string) => referralProcedureCodes.includes(code));
    const visitsAvailable =
      typeof referral.remainingVisits !== 'number' || referral.remainingVisits > 0;

    return (
      Boolean(referralNumber)
      && appointmentMatches
      && proceduresCovered
      && visitsAvailable
      && (!referralStatus || !INVALID_REFERRAL_STATUSES.has(referralStatus))
      && claimServiceDates.every((serviceDate) =>
        isDateWithinRange(
          serviceDate,
          normalizeBusinessDate(referral.startDate),
          normalizeBusinessDate(referral.endDate)
        )
      )
    );
  });

  if (!matchingReferral) {
    throw buildValidationError(
      'Claim requires a valid referral with an active referral number before submission.'
    );
  }

  return matchingReferral;
}

export const claimServiceTestUtils = {
  calculateExpectedResponsibility,
  createExpectedResponsibilityAccumulator,
};

export const claimService = {
  async create(data: any, locale: string, createdBy: string) {
    const normalizedData = normalizeClaimData(data);
    const candidate = {
      ...normalizedData,
      claimDate: normalizedData.claimDate ?? new Date(),
      coveragePriority: normalizedData.coveragePriority ?? 'Primary',
      frequencyCode: normalizedData.frequencyCode ?? '1',
      claimType: normalizedData.claimType ?? 'Professional',
      claimStatus: 'Draft',
      scrubStatus: 'Failed',
      submissionStatus: 'Not Submitted',
      rejectionReason:
        normalizedData.rejectionReason
        ?? 'Manual claim draft requires coding review before submission.',
      batchId: undefined,
      clearingHouse: undefined,
      ediStatus: undefined,
      diagnosisCodes: normalizedData.diagnosisCodes ?? [],
      claimLines: normalizedData.claimLines ?? [],
      attachments: normalizedData.attachments ?? [],
    };

    validateClaimState(candidate);

    const item = await Claim.create({
      ...candidate,
      statusHistory: appendStatusHistory(undefined, candidate.claimStatus, createdBy, 'Claim created'),
      active: normalizedData.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    });

    await refreshClaimPricingSnapshotsIfClaimLinesChanged(item, Boolean(normalizedData.claimLines?.length));
    await item.save();

    await auditLogService.record({
      entityType: 'claim',
      entityId: item._id,
      action: 'CLAIM_CREATED',
      userId: createdBy,
      changedBy: createdBy,
      source: 'claim',
      claimId: item._id,
      appointmentId: normalizedData.appointmentId,
      patientId: item.patientId,
      payerId: item.payerId,
      reason: 'Claim draft created',
      newState: item.toObject(),
    });

    await timelyFilingAlertService.evaluateClaim(item, {
      triggerZapier: true,
      updatedBy: createdBy,
    });
    await syncClaimDocuments(item, createdBy);
    await documentationComplianceAlertService.evaluateClaim(item, {
      triggerZapier: true,
      updatedBy: createdBy,
    });

    return item;
  },

  async createFromCharge(chargeId: string, locale: string, createdBy: string, options: { session?: ClientSession; skipSideEffects?: boolean } = {}) {
    const session = options.session;
    const existingClaim = await Claim.findOne({ chargeId, isDeleted: false }).session(session ?? null);

    if (existingClaim) {
      const snapshotIssues = await getClaimSnapshotIssues(existingClaim);
      if (snapshotIssues.length) {
        existingClaim.snapshotStatus = 'STALE';
        existingClaim.snapshotIssues = snapshotIssues;
        existingClaim.updatedBy = createdBy as any;
        existingClaim.updated = new Date();
        await existingClaim.save({ session });
      }

      if (!options.skipSideEffects) {
        await claimPredictionService.predictForClaim(String(existingClaim._id), createdBy);
        await syncAppointmentCompletedForCharge(chargeId, createdBy);
      }
      return existingClaim;
    }

    const charge = await Charge.findOne({ _id: chargeId, isDeleted: false }).session(session ?? null);

    if (!charge) {
      throw new AppError(t('charge.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const codingReview = await CodingReview.findOne({
      chargeId: charge._id,
      scrubStatus: 'Approved',
      isDeleted: false,
    }).sort({ updated: -1 }).session(session ?? null);

    if (!codingReview) {
      throw buildValidationError('Claim cannot be created unless coding review is approved.');
    }

    const approvedCodingLines = getApprovedCodingLines(codingReview);

    if (!approvedCodingLines.length) {
      throw buildValidationError('Claim cannot be created because the approved coding review is missing final coding lines.');
    }

    const encounter = charge.encounterId
      ? await Encounter.findOne({ _id: charge.encounterId, isDeleted: false }).session(session ?? null)
      : null;
    const facility = charge.facilityId
      ? await Facility.findOne({ _id: charge.facilityId, isDeleted: false }).session(session ?? null)
      : null;
    const insurancePolicy = await resolveClaimInsurancePolicy(charge, encounter);

    if (!insurancePolicy) {
      throw buildValidationError('Claim cannot be created without an active insurance policy.');
    }

    const diagnosisCodes = buildClaimDiagnosisCodes({ ...charge.toObject(), approvedCodingLines }, encounter);

    const renderingProviderId = approvedCodingLines.find((line: any) => line.renderingProviderId)?.renderingProviderId
      ?? charge.providerId;

    const chargeLineById = new Map(
      (charge.chargeLines ?? []).map((line: any) => [String(line._id), line])
    );

    const claimLines: any[] = [];
    const responsibilityAccumulator = createExpectedResponsibilityAccumulator();

    for (const [index, line] of approvedCodingLines.entries()) {
      const lineNumber = line.lineNumber ?? index + 1;
      const cptCode = normalizeText(line.cptCode)?.toUpperCase();
      const placeOfService = normalizeText(line.placeOfService) ?? normalizeText(charge.placeOfService) ?? normalizeText(facility?.placeOfServiceCode);
      const lineRenderingProviderId = line.renderingProviderId ?? renderingProviderId;
      const serviceDate = normalizeDate(line.serviceDateFrom) ?? normalizeDate(charge.serviceDate);
      const chargeLineId = line.chargeLineId ?? line._id;
      const eligibility = await lookupLatestEligibilityVerification({
        patientId: charge.patientId,
        insurancePolicy,
        payerId: insurancePolicy?.payerId,
        cptCode,
        serviceDate,
        coveragePriority: insurancePolicy?.coveragePriority,
      });
      const payerLookupIds = [insurancePolicy?.payerId, insurancePolicy?.ediPayerId]
        .map(normalizeText)
        .filter((value): value is string => Boolean(value));
      const feeScheduleMatch = cptCode
        ? await feeScheduleService.findBestMatchDetailed({
            payerIds: payerLookupIds,
            cptCode,
            modifiers: line.modifiers ?? [],
            providerId: normalizeText(lineRenderingProviderId?.toString?.()),
            facilityId: normalizeText(charge.facilityId?.toString?.()),
            state: facility?.state,
            placeOfServiceCode: placeOfService,
            planName: insurancePolicy?.planName,
            groupNumber: insurancePolicy?.groupNumber,
            network: insurancePolicy?.network,
            coverageType: insurancePolicy?.coverageType,
            serviceDate,
          })
        : null;
      const coverageRuleEvaluation = await coverageRuleService.evaluateCoverageRules({
        payerId: insurancePolicy?.payerId,
        patientId: normalizeText(charge.patientId?.toString?.()),
        insurancePolicyId: normalizeText(insurancePolicy?._id?.toString?.()),
        providerId: normalizeText(lineRenderingProviderId?.toString?.()),
        facilityId: normalizeText(charge.facilityId?.toString?.()),
        state: facility?.state,
        cptCode,
        diagnosisCodes: line.icdCodes ?? diagnosisCodes,
        modifiers: line.modifiers ?? [],
        posCode: placeOfService,
        serviceDate,
        planName: insurancePolicy?.planName,
        groupNumber: insurancePolicy?.groupNumber,
        network: insurancePolicy?.network,
        coverageType: insurancePolicy?.coverageType,
        eligibilityVerificationId: eligibility?._id ? String(eligibility._id) : undefined,
      });
      const units = typeof line.units === 'number' && line.units > 0 ? line.units : 1;
      const expectedAllowedAmount = feeScheduleMatch
        ? roundCurrency(feeScheduleMatch.allowedAmount * units)
        : undefined;
      const responsibility = calculateExpectedResponsibility(expectedAllowedAmount, eligibility, responsibilityAccumulator);
      const sourceChargeLine = chargeLineId ? chargeLineById.get(String(chargeLineId)) : null;

      if (sourceChargeLine) {
        sourceChargeLine.expectedAllowedAmount = expectedAllowedAmount;
        sourceChargeLine.feeScheduleId = feeScheduleMatch?.feeSchedule._id;
        sourceChargeLine.pricingStatus = feeScheduleMatch ? 'CONTRACT_RATE_FOUND' : 'MISSING_CONTRACT_RATE';
        sourceChargeLine.pricingMessage = feeScheduleMatch
          ? `Matched ${feeScheduleMatch.matchedBy}.`
          : 'No configured payer contract rate matched this charge line.';
      }

      claimLines.push({
        lineNumber,
        chargeLineId,
        cptCode,
        modifiers: line.modifiers ?? [],
        icdPointers:
          (line.icdPointers ?? [])
            .filter((pointer: unknown): pointer is number => (
              typeof pointer === 'number'
              && Number.isInteger(pointer)
              && pointer >= 1
              && pointer <= diagnosisCodes.length
            )),
        units: line.units,
        chargeAmount: line.chargeAmount,
        renderingProviderId: lineRenderingProviderId,
        placeOfService,
        serviceDateFrom: serviceDate,
        serviceDateTo: normalizeDate(line.serviceDateTo) ?? serviceDate,
        expectedAllowedAmount,
        expectedInsurancePayment: responsibility.expectedInsurancePayment,
        expectedPatientResponsibility: responsibility.expectedPatientResponsibility,
        patientCopayAmount: responsibility.patientCopayAmount,
        patientCoinsuranceAmount: responsibility.patientCoinsuranceAmount,
        deductibleAppliedAmount: responsibility.deductibleAppliedAmount,
        feeScheduleId: feeScheduleMatch?.feeSchedule._id,
        pricingMatchedBy: feeScheduleMatch?.matchedBy,
        pricingSource: feeScheduleMatch?.source,
        pricingSnapshotDate: new Date(),
        coverageRuleSnapshot: buildCoverageSnapshot(eligibility, coverageRuleEvaluation),
        payerRuleSnapshot: {
          coverageRuleIds: coverageRuleEvaluation.matchedRules.map((rule) => rule._id),
        },
        eligibilityVerificationId: eligibility?._id,
        authorizationRequired: Boolean(eligibility?.authorizationRequired || coverageRuleEvaluation.authorizationRequired),
        referralRequired: Boolean(eligibility?.referralRequired || coverageRuleEvaluation.referralRequired),
        networkStatus: insurancePolicy?.network,
      });
    }

    if (charge.isModified()) {
      charge.updated = new Date();
      await charge.save({ session });
    }

    const claimData = {
      chargeId: charge._id,
      encounterId: charge.encounterId,
      patientId: charge.patientId,
      payerId: insurancePolicy?.payerId,
      billingProviderId: charge.providerId,
      renderingProviderId,
      facilityId: charge.facilityId,
      claimDate: new Date(),
      totalChargeAmount: charge.totalChargeAmount ?? charge.chargeLines.reduce((sum, line) => sum + (line.chargeAmount ?? 0), 0),
      coveragePriority: insurancePolicy?.coveragePriority ?? 'Primary',
      frequencyCode: '1',
      claimType: 'Professional',
      claimStatus: 'Ready for Submission',
      scrubStatus: 'Passed',
      submissionStatus: 'Not Submitted',
      diagnosisCodes,
      claimLines,
      snapshotStatus: 'CURRENT',
      snapshotIssues: [],
      sourceChargeUpdatedAt: charge.updated,
      sourceCodingReviewUpdatedAt: codingReview.updated,
      sourceCodingSnapshotHash:
        codingReview.approvedCodingSnapshot?.snapshotHash
        ?? buildCodingSnapshotHash(approvedCodingLines),
    };

    validateClaimState({
      ...claimData,
      claimDate: new Date(),
      coveragePriority: insurancePolicy?.coveragePriority ?? 'Primary',
      claimType: 'Professional',
      claimStatus: 'Ready for Submission',
      scrubStatus: 'Passed',
      submissionStatus: 'Not Submitted',
    });
    validateClaimLinesReady({
      ...claimData,
      diagnosisCodes,
      claimLines,
    });

    const [item] = await Claim.create([{
      ...claimData,
      statusHistory: appendStatusHistory(
        undefined,
        'Ready for Submission',
        createdBy,
        'Claim assembled from approved coding review'
      ),
      active: true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    }], { session });

    await auditLogService.record({
      entityType: 'claim',
      entityId: item._id,
      action: 'CLAIM_CREATED',
      userId: createdBy,
      changedBy: createdBy,
      source: 'claim',
      claimId: item._id,
      appointmentId: encounter?.appointmentId,
      patientId: item.patientId,
      payerId: item.payerId,
      reason: 'Claim assembled from approved coding review',
      newState: item.toObject(),
      session,
    });

    await timelyFilingAlertService.evaluateClaim(item, {
      session,
      triggerZapier: !session,
      updatedBy: createdBy,
    });
    await syncClaimDocuments(item, createdBy);
    await documentationComplianceAlertService.evaluateClaim(item, {
      session,
      triggerZapier: !session,
      updatedBy: createdBy,
    });

    if (!options.skipSideEffects) {
      await claimPredictionService.predictForClaim(String(item._id), createdBy);
      await syncAppointmentCompletedForCharge(chargeId, createdBy);
    }
    return item;
  },

  async getById(id: string, locale: string) {
    const item = await Claim.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('claim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    const item = await Claim.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('claim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const previousStatus = item.claimStatus;
    const normalizedData = normalizeClaimData(data);
    const lockedSubmissionStatuses = new Set(['Queued', 'Submitted', 'Printed', 'Transmitted', 'Acknowledged']);
    const isRejectedForCorrection = item.submissionStatus === 'Rejected' || item.claimStatus === 'Rejected';
    const canResetForCorrection = item.submissionStatus
      && ['Failed', 'Rejected'].includes(item.submissionStatus);

    if (item.submissionStatus && lockedSubmissionStatuses.has(item.submissionStatus)) {
      throw buildValidationError('Submitted claims cannot be edited directly. Create a corrected claim instead.');
    }

    if (isRejectedForCorrection) {
      const previousClaim = toPlainObject(item);
      const parentClaimId = item.parentClaimId ?? item._id;
      const latestVersionClaim = await Claim.findOne({
        $or: [
          { _id: parentClaimId },
          { parentClaimId },
        ],
        isDeleted: false,
      }).sort({ version: -1, created: -1 });
      const nextVersion = Math.max(item.version ?? 1, latestVersionClaim?.version ?? 1) + 1;
      const correctedCandidate = {
        ...stripSystemFields(item),
        ...normalizedData,
        parentClaimId,
        originalClaimId: item.originalClaimId ?? parentClaimId,
        version: nextVersion,
        resubmissionCount: item.resubmissionCount ?? 0,
        correctedClaimIndicator: true,
        claimStatus: 'Ready for Submission',
        submissionStatus: 'Not Submitted',
        rejectionReason: undefined,
        batchId: undefined,
        clearingHouse: undefined,
        ediStatus: undefined,
        statusHistory: appendStatusHistory(
          item.statusHistory,
          'Ready for Submission',
          updatedBy,
          `Correction version ${nextVersion} created from rejected claim`
        ),
        diagnosisCodes: normalizedData.diagnosisCodes ?? item.diagnosisCodes ?? [],
        claimLines: normalizedData.claimLines ?? item.claimLines ?? [],
        active: normalizedData.active ?? item.active ?? true,
        isDeleted: false,
        created: new Date(),
        updated: new Date(),
        createdBy: updatedBy,
        updatedBy,
      };

      validateClaimState(correctedCandidate);

      const correctedClaim = await Claim.create(correctedCandidate);
      await refreshClaimPricingSnapshotsIfClaimLinesChanged(correctedClaim, Boolean(normalizedData.claimLines?.length));
      await correctedClaim.save();
      const correctedFields = getCorrectedFields(previousClaim, correctedClaim.toObject());

      item.claimStatus = 'UnderCorrection';
      item.statusHistory = appendStatusHistory(
        item.statusHistory,
        'UnderCorrection',
        updatedBy,
        `Correction version ${nextVersion} created`
      );
      item.updatedBy = updatedBy as any;
      item.updated = new Date();
      await item.save();

      await createAuditLog(
        {
          entityType: 'Claim',
          entityId: correctedClaim._id,
          action: 'CorrectionCreated',
          fieldName: 'correctedFields',
          oldValue: {
            claimId: String(item._id),
            snapshot: previousClaim,
          },
          newValue: {
            claimId: String(correctedClaim._id),
            parentClaimId: String(parentClaimId),
            version: nextVersion,
            correctedFields,
          },
        },
        updatedBy
      );

      await timelyFilingAlertService.evaluateClaim(correctedClaim, {
        triggerZapier: true,
        updatedBy,
      });
      await syncClaimDocuments(correctedClaim, updatedBy);
      await documentationComplianceAlertService.evaluateClaim(correctedClaim, {
        triggerZapier: true,
        updatedBy,
      });

      return correctedClaim;
    }

    if (normalizedData.claimStatus !== undefined && normalizedData.claimStatus !== item.claimStatus) {
      throw buildValidationError('Claim status is system-managed and cannot be edited manually.');
    }

    if (normalizedData.scrubStatus !== undefined && normalizedData.scrubStatus !== item.scrubStatus) {
      throw buildValidationError('Claim scrub status is system-managed and cannot be edited manually.');
    }

    if (normalizedData.submissionStatus !== undefined && normalizedData.submissionStatus !== item.submissionStatus) {
      throw buildValidationError('Claim submission status is system-managed and cannot be edited manually.');
    }

    if (normalizedData.batchId !== undefined && normalizedData.batchId !== item.batchId) {
      throw buildValidationError('Claim batch ID is system-managed and cannot be edited manually.');
    }

    if (normalizedData.clearingHouse !== undefined && normalizedData.clearingHouse !== item.clearingHouse) {
      throw buildValidationError('Claim clearinghouse routing is system-managed and cannot be edited manually.');
    }

    if (normalizedData.ediStatus !== undefined && normalizedData.ediStatus !== item.ediStatus) {
      throw buildValidationError('Claim EDI status is system-managed and cannot be edited manually.');
    }

    if (normalizedData.rejectionReason !== undefined && normalizedData.rejectionReason !== item.rejectionReason) {
      throw buildValidationError('Claim rejection reason is system-managed and cannot be edited manually.');
    }

    if (
      normalizedData.closureStatus !== undefined
      || normalizedData.closeReason !== undefined
      || normalizedData.reopenReason !== undefined
      || normalizedData.expectedEraBy !== undefined
      || normalizedData.lastPayerFollowUpAt !== undefined
      || normalizedData.followUpCount !== undefined
    ) {
      throw buildValidationError('Claim closure and ERA follow-up fields are system-managed. Use close, reopen, or follow-up workflows.');
    }

    if (
      normalizedData.snapshotStatus !== undefined
      || normalizedData.snapshotIssues !== undefined
      || normalizedData.sourceChargeUpdatedAt !== undefined
      || normalizedData.sourceCodingReviewUpdatedAt !== undefined
      || normalizedData.sourceCodingSnapshotHash !== undefined
    ) {
      throw buildValidationError('Claim source snapshot metadata is system-managed and cannot be edited manually.');
    }

    const correctionReset = canResetForCorrection
      ? {
          claimStatus: 'Ready for Submission',
          submissionStatus: 'Not Submitted',
          rejectionReason: undefined,
          batchId: undefined,
          clearingHouse: undefined,
          ediStatus: undefined,
        }
      : {};

    const candidate = {
      ...item.toObject(),
      ...correctionReset,
      ...normalizedData,
      diagnosisCodes: normalizedData.diagnosisCodes ?? item.diagnosisCodes ?? [],
      claimLines: normalizedData.claimLines ?? item.claimLines ?? [],
    };

    validateClaimState(candidate);

    Object.assign(item, {
      ...correctionReset,
      ...normalizedData,
      statusHistory:
        canResetForCorrection
          ? appendStatusHistory(item.statusHistory, 'Ready for Submission', updatedBy, 'Claim corrected for resubmission')
          : normalizedData.claimStatus && normalizedData.claimStatus !== previousStatus
            ? appendStatusHistory(item.statusHistory, normalizedData.claimStatus, updatedBy, 'Claim updated')
          : item.statusHistory,
      updatedBy,
      updated: new Date(),
    });

    await refreshClaimPricingSnapshotsIfClaimLinesChanged(item, normalizedData.claimLines !== undefined);
    await item.save();
    await timelyFilingAlertService.evaluateClaim(item, {
      triggerZapier: true,
      updatedBy,
    });
    await syncClaimDocuments(item, updatedBy);
    await documentationComplianceAlertService.evaluateClaim(item, {
      triggerZapier: true,
      updatedBy,
    });
    return item;
  },

  async getReadiness(id: string, locale: string) {
    const item = await this.getById(id, locale);
    await refreshMissingClaimPricingSnapshots(item);
    const readiness = await buildClaimReadinessResult(item);
    const timelyFiling = await timelyFilingAlertService.evaluateClaim(item, {
      triggerZapier: true,
    });

    return {
      ...readiness,
      timelyFiling,
    };
  },

  async getAiReadinessReview(id: string, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    await refreshMissingClaimPricingSnapshots(item, updatedBy);
    const readiness = await buildClaimReadinessResult(item);
    await auditLogService.record({
      entityType: 'claim',
      entityId: item._id,
      action: 'CLAIM_READINESS_RUN',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'claimReadiness',
      claimId: item._id,
      patientId: item.patientId,
      payerId: item.payerId,
      newState: readiness,
    });
    const blockingIssues = readiness.errors;
    const missingData = readiness.requiredActions;
    const recommendedFixes = [...readiness.requiredActions];
    const denialRisks: string[] = [];
    let aiReview: any = null;

    if (readiness.canSubmit) {
      const insurancePolicy = await resolveActiveInsurancePolicy(item.patientId, {
        payerId: item.payerId,
        coveragePriority: item.coveragePriority,
        serviceDate: getClaimServiceDate(item),
      });
      const [payer, facility, billingProvider, renderingProvider, eligibility] = await Promise.all([
        resolvePayerByReference(item.payerId ?? insurancePolicy?.payerId),
        item.facilityId ? Facility.findOne({ _id: item.facilityId, isDeleted: false, active: true }) : null,
        item.billingProviderId ? Provider.findOne({ _id: item.billingProviderId, isDeleted: false, active: true }) : null,
        item.renderingProviderId ? Provider.findOne({ _id: item.renderingProviderId, isDeleted: false, active: true }) : null,
        resolveLatestEligibilityVerification(item.patientId, insurancePolicy?._id),
      ]);

      if (insurancePolicy && payer && facility) {
        aiReview = await claimAiReviewService.runPreSubmissionReview(item, updatedBy, {
          insurancePolicy,
          payer,
          facility,
          billingProvider,
          renderingProvider: renderingProvider ?? billingProvider,
          eligibility,
        });
        const prediction = aiReview.denialPrediction ?? {};
        denialRisks.push(...(prediction.predictedReasons ?? []));
        recommendedFixes.push(...(prediction.recommendedFixes ?? []));
      }
    }

    const riskPenalty = aiReview?.denialPrediction?.riskScore
      ? Math.round(Number(aiReview.denialPrediction.riskScore) * 30)
      : 0;
    const readinessScore = readiness.canSubmit
      ? Math.max(0, 100 - riskPenalty)
      : Math.max(0, 100 - (blockingIssues.length * 15));

    return {
      readinessScore,
      summary: readiness.canSubmit
        ? 'Claim passed deterministic readiness checks for 837P submission.'
        : 'Claim has deterministic blocking issues and cannot be submitted.',
      blockingIssues,
      recommendedFixes: Array.from(new Set(recommendedFixes)),
      denialRisks: Array.from(new Set(denialRisks)),
      missingData: Array.from(new Set(missingData)),
      deterministicValidation: readiness,
      aiReview,
    };
  },

  async runEligibility(id: string, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    const serviceDate = getClaimServiceDate(item);
    const insurancePolicy = await resolveActiveInsurancePolicy(item.patientId, {
      payerId: item.payerId,
      coveragePriority: item.coveragePriority,
      serviceDate,
    });

    if (!insurancePolicy) {
      throw buildValidationError('No active insurance policy exists for the claim date of service.');
    }

    const procedureCodes = getClaimProcedureCodeSet(item);
    const eligibility = await eligibilityVerificationService.runRealtimeVerification(
      {
        insuranceId: String(insurancePolicy._id),
        providerId: normalizeText((item.renderingProviderId ?? item.billingProviderId)?.toString?.()),
        facilityId: normalizeText(item.facilityId?.toString?.()),
        serviceDate,
        coveragePriority: normalizeText(item.coveragePriority ?? insurancePolicy.coveragePriority),
        procedureCodes,
      },
      locale,
      { _id: updatedBy }
    );

    const eligibilityProcedureCodes = getEligibilityProcedureCodes(eligibility);
    let claimUpdated = false;
    const responsibilityAccumulator = createExpectedResponsibilityAccumulator();

    for (const line of item.claimLines ?? []) {
      const cptCode = normalizeText(line.cptCode)?.toUpperCase();
      const appliesToLine = !eligibilityProcedureCodes.length || (cptCode ? eligibilityProcedureCodes.includes(cptCode) : false);

      if (!appliesToLine) {
        continue;
      }

      const responsibility = calculateExpectedResponsibility(line.expectedAllowedAmount, eligibility, responsibilityAccumulator);
      line.eligibilityVerificationId = eligibility._id;
      line.patientCopayAmount = responsibility.patientCopayAmount;
      line.patientCoinsuranceAmount = responsibility.patientCoinsuranceAmount;
      line.deductibleAppliedAmount = responsibility.deductibleAppliedAmount;
      line.expectedPatientResponsibility = responsibility.expectedPatientResponsibility;
      line.expectedInsurancePayment = responsibility.expectedInsurancePayment;
      line.authorizationRequired = Boolean(eligibility.authorizationRequired || line.authorizationRequired);
      line.referralRequired = Boolean(eligibility.referralRequired || line.referralRequired);
      line.networkStatus = eligibility.networkStatus ?? line.networkStatus;
      line.coverageRuleSnapshot = {
        ...(line.coverageRuleSnapshot ?? {}),
        eligibility: {
          eligibilityVerificationId: String(eligibility._id),
          eligibilityStatus: eligibility.eligibilityStatus,
          coverageStatus: eligibility.coverageStatus,
          planActive: eligibility.planActive,
          copayAmount: eligibility.copayAmount,
          coinsurancePercent: eligibility.coinsurancePercent,
          deductibleRemaining: eligibility.deductibleRemaining,
          outOfPocketRemaining: eligibility.outOfPocketRemaining,
          networkStatus: eligibility.networkStatus,
          referralRequired: eligibility.referralRequired,
          authorizationRequired: eligibility.authorizationRequired,
          checkedAt: eligibility.checkedAt,
          vendorName: eligibility.vendorName,
        },
      };
      claimUpdated = true;
    }

    if (claimUpdated) {
      item.updatedBy = updatedBy as any;
      item.updated = new Date();
      await item.save();
    }

    const refreshedClaim = await this.getById(id, locale);
    const readiness = await buildClaimReadinessResult(refreshedClaim);

    return {
      claim: refreshedClaim,
      eligibilityVerification: eligibility,
      readiness,
    };
  },

  async refreshPricing(id: string, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    const pricingResults = await refreshClaimPricingSnapshots(item);

    item.updatedBy = updatedBy as any;
    item.updated = new Date();
    await item.save();

    const refreshedClaim = await this.getById(id, locale);
    const readiness = await buildClaimReadinessResult(refreshedClaim);

    return {
      claim: refreshedClaim,
      readiness,
      pricingResults,
    };
  },

  async getStatus(id: string, locale: string, updatedBy: string) {
    return claimSubmissionService.getStatusForClaim(id, locale, updatedBy);
  },

  async evaluateClosure(id: string, locale: string) {
    await this.getById(id, locale);
    return claimClosureService.evaluate(id);
  },

  async listClosureSnapshots(id: string, locale: string) {
    await this.getById(id, locale);
    return claimClosureService.listSnapshots(id);
  },

  async syncClosureStatus(id: string, locale: string, updatedBy: string) {
    await this.getById(id, locale);
    return claimClosureService.syncClaimClosureStatus(id, updatedBy);
  },

  async linkAuthorization(id: string, authorizationId: string | undefined, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    const insurancePolicy = await resolveActiveInsurancePolicy(item.patientId, {
      payerId: item.payerId,
      coveragePriority: item.coveragePriority,
      serviceDate: getClaimServiceDate(item),
    });
    let linkedAuthorizationId: string | undefined;

    for (const line of item.claimLines ?? []) {
      const lineRequiresAuthorization =
        isLineAuthorizationRequired(line) ||
        await isProcedureAuthorizationRequired(line.cptCode);

      if (!lineRequiresAuthorization && !authorizationId) {
        continue;
      }

      const authorization = await findMatchingAuthorization(item, line, insurancePolicy, authorizationId);

      if (!authorization) {
        continue;
      }

      line.priorAuthorizationId = authorization._id;
      linkedAuthorizationId = String(authorization._id);
    }

    if (!linkedAuthorizationId) {
      throw buildValidationError('No valid authorization matched the claim payer, policy, CPT, provider, facility, and date of service.');
    }

    item.updatedBy = updatedBy as any;
    item.updated = new Date();
    await item.save();

    const refreshedClaim = await this.getById(id, locale);
    const readiness = await buildClaimReadinessResult(refreshedClaim);

    return {
      claim: refreshedClaim,
      readiness,
      authorizationId: linkedAuthorizationId,
    };
  },

  async linkReferral(id: string, referralId: string | undefined, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    const insurancePolicy = await resolveActiveInsurancePolicy(item.patientId, {
      payerId: item.payerId,
      coveragePriority: item.coveragePriority,
      serviceDate: getClaimServiceDate(item),
    });
    let linkedReferralId: string | undefined;

    for (const line of item.claimLines ?? []) {
      const lineRequiresReferral = isLineReferralRequired(line);

      if (!lineRequiresReferral && !referralId) {
        continue;
      }

      const referral = await findMatchingReferral(item, line, insurancePolicy, referralId);

      if (!referral) {
        continue;
      }

      line.referralId = referral._id;
      linkedReferralId = String(referral._id);
    }

    if (!linkedReferralId) {
      throw buildValidationError('No valid referral matched the claim payer, CPT, provider, and date of service.');
    }

    item.updatedBy = updatedBy as any;
    item.updated = new Date();
    await item.save();

    const refreshedClaim = await this.getById(id, locale);
    const readiness = await buildClaimReadinessResult(refreshedClaim);

    return {
      claim: refreshedClaim,
      readiness,
      referralId: linkedReferralId,
    };
  },

  async submit(id: string, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    const latestSubmission = await claimSubmissionService.getLatestForClaim(String(item._id));
    const isResubmission = item.claimStatus === 'Rejected' || item.submissionStatus === 'Rejected';
    const latestSubmissionStatus = normalizeText(
      latestSubmission?.transmissionStatus ?? latestSubmission?.acknowledgementStatus
    )?.toUpperCase();
    const duplicateSafeStatuses = ['QUEUED', 'SUBMITTED', 'PRINTED', 'TRANSMITTED', 'ACKNOWLEDGED', 'ACCEPTED'];

    if (
      item.claimStatus === 'Submitted'
      && latestSubmission
      && duplicateSafeStatuses.includes(latestSubmissionStatus ?? '')
    ) {
      return {
        claim: item,
        claimSubmission: latestSubmission,
      };
    }

    if (!['Draft', 'Ready for Submission', 'Rejected', 'UnderCorrection', 'On Hold'].includes(item.claimStatus ?? '')) {
      throw buildValidationError('Claim must be in Draft, Ready for Submission, Rejected, Under Correction, or On Hold state to be submitted.');
    }

    if (item.scrubStatus !== 'Passed') {
      throw buildValidationError('Claim must pass scrub review before submission.');
    }

    validateClaimState(item);
    validateClaimLinesReady(item);

    await refreshMissingClaimPricingSnapshots(item, updatedBy);
    const readiness = await buildClaimReadinessResult(item);
    const allowTestModeAcknowledgementSimulation =
      isTestModeSubmissionLifecycle()
      && !readiness.canSubmit
      && getTestModeAcknowledgementCandidates(readiness.errors).length > 0
      && !hasHardReadinessBlockers(readiness.errors);

    if (!readiness.canSubmit && !allowTestModeAcknowledgementSimulation) {
      throw buildValidationError(`Claim is not ready for submission: ${readiness.errors.join('; ')}`);
    }

    const timelyFiling = await timelyFilingAlertService.evaluateClaim(item, {
      triggerZapier: true,
      updatedBy,
    });

    if (timelyFiling?.status === 'EXPIRED') {
      throw buildValidationError(
        `Claim timely filing deadline expired on ${timelyFiling.filingDeadline.toISOString().slice(0, 10)}.`
      );
    }

    const insurancePolicy = await resolveActiveInsurancePolicy(item.patientId, {
      payerId: item.payerId,
      coveragePriority: item.coveragePriority,
      serviceDate: getClaimServiceDate(item),
    });

    if (!insurancePolicy) {
      throw buildValidationError('Claim cannot be submitted without an active insurance policy.');
    }

    const latestEligibility = await ensureEligibilityReady(item, insurancePolicy);

    const referral = allowTestModeAcknowledgementSimulation
      ? null
      : await ensureReferralReady(item, insurancePolicy, latestEligibility);
    const authorizationRequired = await resolveClaimAuthorizationRequired(item, latestEligibility);
    const authorization = allowTestModeAcknowledgementSimulation
      ? null
      : await ensurePriorAuthorizationReady(
        item,
        insurancePolicy,
        latestEligibility,
        authorizationRequired
      );

    const payer = await resolvePayerByReference(item.payerId ?? insurancePolicy.payerId);

    if (!payer) {
      throw buildValidationError('Claim cannot be submitted until the payer is configured.');
    }

    const [facility, billingProvider, renderingProvider] = await Promise.all([
      item.facilityId
        ? Facility.findOne({ _id: item.facilityId, isDeleted: false, active: true })
        : null,
      item.billingProviderId
        ? Provider.findOne({ _id: item.billingProviderId, isDeleted: false, active: true })
        : null,
      item.renderingProviderId
        ? Provider.findOne({ _id: item.renderingProviderId, isDeleted: false, active: true })
        : null,
    ]);

    if (!facility) {
      throw buildValidationError('Claim cannot be submitted until the billing facility is active.');
    }

    if (!normalizeText(facility.npi) || !normalizeText(facility.taxId)) {
      throw buildValidationError('Billing facility NPI and Tax ID are required before claim submission.');
    }

    // Expert Routing: Check Payer Submission Method
    const isPaperPayer = payer?.claimsSubmissionMethod === 'Paper';
    const electronicPayerId =
      normalizeText(insurancePolicy.ediPayerId)
      ?? normalizeText(payer.ediPayerId);

    if (!isPaperPayer && !electronicPayerId && !allowTestModeAcknowledgementSimulation) {
      throw buildValidationError(
        'Electronic claim submission requires an EDI payer ID on the payer or active insurance policy.'
      );
    }

    try {
      await claimAiReviewService.runPreSubmissionReview(item, updatedBy, {
        insurancePolicy,
        payer,
        facility,
        billingProvider,
        renderingProvider: renderingProvider ?? billingProvider,
        eligibility: {
          ...(typeof latestEligibility.toObject === 'function' ? latestEligibility.toObject() : latestEligibility),
          authorizationRequired,
        },
        authorization,
        referral,
      });
    } catch (error) {
      // AI review is advisory only; deterministic readiness and EDI validation remain authoritative.
    }
    await auditLogService.record({
      entityType: 'claim',
      entityId: item._id,
      action: 'CLAIM_AI_REVIEW_RUN',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'claimAiReview',
      claimId: item._id,
      patientId: item.patientId,
      payerId: item.payerId,
      reason: 'Pre-submission AI review completed or safely bypassed',
    });
    publishRcmRealtimeEvent({
      eventType: 'AI_REVIEW_COMPLETED',
      title: 'AI review completed',
      claimId: String(item._id),
      entityType: 'claim',
      entityId: String(item._id),
      status: item.claimStatus,
    });

    if (isResubmission) {
      item.resubmissionCount = (item.resubmissionCount ?? 0) + 1;
      item.updatedBy = updatedBy as any;
      item.updated = new Date();
      await item.save();
    }

    const submissionResult = await claimSubmissionService.submitClaim(String(item._id), locale, updatedBy);
    const refreshedClaim = await this.getById(id, locale);
    await timelyFilingAlertService.resolveClaim(String(refreshedClaim._id), updatedBy);
    await documentationComplianceAlertService.resolveClaim(String(refreshedClaim._id), updatedBy);
    publishRcmRealtimeEvent({
      eventType: 'CLAIM_SUBMISSION_STATUS_CHANGED',
      title: 'Claim submitted',
      message: `Claim ${refreshedClaim.claimId ?? refreshedClaim._id} moved to ${refreshedClaim.submissionStatus ?? 'submitted'}.`,
      claimId: String(refreshedClaim._id),
      entityType: 'claimSubmission',
      entityId: String(submissionResult.claimSubmission._id),
      status: refreshedClaim.submissionStatus,
    });

    await auditLogService.record({
      entityType: 'claimSubmission',
      entityId: submissionResult.claimSubmission._id,
      action: isResubmission ? 'CLAIM_SUBMISSION_RETRIED' : 'CLAIM_SUBMITTED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'claimSubmission',
      claimId: refreshedClaim._id,
      patientId: refreshedClaim.patientId,
      payerId: refreshedClaim.payerId,
      submissionId: submissionResult.claimSubmission._id,
      previousState: { claimStatus: item.claimStatus, submissionStatus: item.submissionStatus },
      newState: {
        claimStatus: refreshedClaim.claimStatus,
        submissionStatus: refreshedClaim.submissionStatus,
        acknowledgementStatus: submissionResult.claimSubmission.acknowledgementStatus,
      },
    });

    // Reflect in corrected claims screen
    try {
      const shouldReflectAsCorrected = isResubmission || item.correctedClaimIndicator || item.parentClaimId;
      if (shouldReflectAsCorrected) {
        // Find or create CorrectedClaim
        let correctedClaim = await CorrectedClaim.findOne({
          isDeleted: false,
          $or: [
            { clonedClaimId: item._id },
            { correctedFromClaimId: item.parentClaimId ?? item._id },
          ],
        });

        const correctionReason = item.rejectionReason ?? 'Resubmitted from claim rejection screen';
        const correctionType = item.correctionType ?? 'REPLACEMENT';
        const frequencyCode = item.frequencyCode ?? '7';

        if (!correctedClaim) {
          const newCorrectedClaim = await CorrectedClaim.create({
            originalClaimId: item.originalClaimId ?? item.parentClaimId ?? item._id,
            correctedFromClaimId: item.parentClaimId ?? item._id,
            clonedClaimId: item._id,
            correctionReason,
            correctionType,
            frequencyCode,
            resubmissionReason: correctionReason,
            correctedFrequencyCode: frequencyCode,
            correctedClaimStatus: 'SUBMITTED',
            submittedDate: new Date(),
            agingDueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            correctedFieldsChanged: [],
            correctedFields: [],
            lineageChain: item.lineageChain ?? [item._id],
            correctionAudit: [
              {
                action: 'CORRECTED_CLAIM_RESUBMITTED_FROM_REJECTION',
                correctedBy: updatedBy,
                correctedAt: new Date(),
                claimId: item._id,
                claimSubmissionId: submissionResult?.claimSubmission?._id,
              },
            ],
            active: true,
            created: new Date(),
            updated: new Date(),
            createdBy: updatedBy as any,
            updatedBy: updatedBy as any,
          });

          publishRcmRealtimeEvent({
            eventType: 'CORRECTED_CLAIM_SUBMITTED',
            title: 'Corrected claim submitted',
            claimId: String(item._id),
            entityType: 'correctedClaim',
            entityId: String(newCorrectedClaim._id),
            status: 'SUBMITTED',
          });
        } else {
          correctedClaim.clonedClaimId = item._id;
          correctedClaim.correctedClaimStatus = 'SUBMITTED';
          correctedClaim.submittedDate = new Date();
          correctedClaim.correctionAudit = [
            ...(correctedClaim.correctionAudit ?? []),
            {
              action: 'CORRECTED_CLAIM_RESUBMITTED_FROM_REJECTION',
              correctedBy: updatedBy,
              correctedAt: new Date(),
              claimId: item._id,
              claimSubmissionId: submissionResult?.claimSubmission?._id,
            },
          ];
          correctedClaim.updated = new Date();
          correctedClaim.updatedBy = updatedBy as any;
          await correctedClaim.save();

          publishRcmRealtimeEvent({
            eventType: 'CORRECTED_CLAIM_SUBMITTED',
            title: 'Corrected claim submitted',
            claimId: String(item._id),
            entityType: 'correctedClaim',
            entityId: String(correctedClaim._id),
            status: 'SUBMITTED',
          });
        }
      }
    } catch (err) {
      // Log error but do not disrupt existing claim submission workflow
      console.error('Failed to create/update CorrectedClaim during resubmission:', err);
    }

    return {
      claim: refreshedClaim,
      claimSubmission: submissionResult.claimSubmission,
      claimId: String(refreshedClaim._id),
      claimSubmissionId: String(submissionResult.claimSubmission._id),
      submissionStatus: refreshedClaim.submissionStatus,
      externalSubmissionId: submissionResult.claimSubmission.externalSubmissionId,
      controlNumber:
        submissionResult.claimSubmission.controlNumber
        ?? submissionResult.claimSubmission.claimControlNumber,
      trackingStatus:
        submissionResult.claimSubmission.acknowledgementStatus
        ?? submissionResult.claimSubmission.transmissionStatus,
      warnings: submissionResult.idempotent
        ? ['Duplicate submission prevented by idempotency key; returning existing submission.']
        : [],
    };
  },

  async close(id: string, reason: string, locale: string, updatedBy: string) {
    await this.getById(id, locale);
    return claimClosureService.close(id, reason, updatedBy);
  },

  async reopen(id: string, reason: string, locale: string, updatedBy: string) {
    await this.getById(id, locale);
    return claimClosureService.reopen(id, reason, updatedBy);
  },

  async resubmit(id: string, data: any, locale: string, updatedBy: string) {
    if (data && Object.keys(data).length) {
      await this.update(id, data, locale, updatedBy);
    }

    const result = await this.submit(id, locale, updatedBy);

    if (result.claim.submissionStatus !== 'Rejected') {
      await claimRejectionService.markResolvedForClaim(
        String(result.claim.parentClaimId ?? result.claim._id),
        String(result.claim._id),
        updatedBy
      );
    }

    return {
      ...result,
      sourceClaimId: id,
      resubmittedClaimId: String(result.claim._id),
      resubmissionCount: result.claim.resubmissionCount,
    };
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    const claim = await Claim.findOne({ _id: id, isDeleted: false });

    if (!claim) {
      throw new AppError(t('claim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const isRejectedClaim = claim.claimStatus === 'Rejected' || claim.submissionStatus === 'Rejected';
    const linkedClaimSubmission = await ClaimSubmission.exists({ claimId: id, isDeleted: false });

    if (linkedClaimSubmission && !isRejectedClaim) {
      throw buildValidationError(
        'Submitted claims cannot be deleted. Use corrected-claim or claim-correction workflow instead.'
      );
    }

    await Claim.findOneAndUpdate(
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

    return true;
  },
};
