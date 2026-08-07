import { InsurancePolicy } from '../insurance-policy/insurance-policy.model';
import { PriorAuthorization } from '../prior-authorization/prior-authorization.model';
import { Charge } from '../charge/charge.model';
import { Claim } from '../claim/claim.model';
import { ClaimSubmission } from '../claim-submission/claim-submission.model';
import { ClaimTracking } from '../claim-tracking/claim-tracking.model';
import { EraEobProcessing } from '../era-eob-processing/era-eob-processing.model';
import { CoverageRule } from '../coverage-rule/coverage-rule.model';
import { Denial } from '../denial/denial.model';
import { EligibilityVerification } from '../eligibility-verification/eligibility-verification.model';
import { FeeSchedule } from '../fee-schedule/fee-schedule.model';
import { Facility } from '../facility/facility.model';
import { Appeal } from '../appeal/appeal.model';
import { ArWorkItem } from '../ar-work-item/ar-work-item.model';
import { PatientBilling } from '../patient-billing/patient-billing.model';
import { Collection } from '../collection/collection.model';
import { Patient } from '../patient/patient.model';
import { PaymentPosting } from '../payment-posting/payment-posting.model';
import { CorrectedClaim } from '../corrected-claim/corrected-claim.model';
import { Refund } from '../refund/refund.model';
import { envConfig } from '../../../config/env.config';
import { normalizeClaimLifecycleStatus } from '../shared/state-normalization';

type QueuePriority = 'critical' | 'high' | 'medium' | 'low';
type MetricTone = 'critical' | 'warning' | 'neutral' | 'positive';
type InsightSeverity = 'critical' | 'warning' | 'info';
type WorkflowStageKey =
  | 'patientAccess'
  | 'authorization'
  | 'coding'
  | 'claims'
  | 'claimSubmission'
  | 'claimTracking'
  | 'denials'
  | 'ar'
  | 'patientBalance';

interface CommandCenterMetric {
  key: string;
  label: string;
  value: number;
  format: 'count' | 'currency';
  tone: MetricTone;
  helperText: string;
  route?: string;
}

interface CommandCenterQueueItem {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  subtitle?: string;
  status: string;
  priority: QueuePriority;
  summary: string;
  nextBestAction: string;
  aiBriefing?: string;
  route: string;
  dueAt?: string;
  badges: string[];
  details?: any;
}

interface CommandCenterStage {
  key: WorkflowStageKey;
  label: string;
  description: string;
  count: number;
  criticalCount: number;
  route: string;
  items: CommandCenterQueueItem[];
}

interface CommandCenterInsight {
  id: string;
  title: string;
  summary: string;
  severity: InsightSeverity;
  route: string;
  actionLabel: string;
}

interface ClaimReadinessRow {
  claimId: string;
  displayClaimId: string;
  patient: string;
  payerId?: string;
  facility?: string;
  state?: string;
  claimStatus: string;
  submissionStatus: string;
  lifecycleStatus: 'SUBMITTED' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'FAILED';
  status: string;
  canSubmit: boolean;
  blockingReasons: string[];
  blockerTypes: string[];
  route: string;
  totalBilledAmount: number;
  totalExpectedAllowedAmount: number;
  claimAgeDays: number;
}

interface RecentClaimActivity {
  id: string;
  claimId: string;
  displayClaimId: string;
  claimNumber: string;
  payer?: string;
  status: 'DRAFT' | 'READY' | 'SUBMITTED' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'FAILED';
  eventType: string;
  source: 'REAL' | 'SIMULATED';
  summary: string;
  occurredAt: string;
  route: string;
}

interface UnifiedWorkQueueItem {
  type: string;
  owner?: string;
  priority: QueuePriority;
  dueDate?: string;
  aging?: string;
  amountAtRisk?: number;
  nextAction: string;
  route: string;
  sourceStage: WorkflowStageKey;
  entityId: string;
  title: string;
  status: string;
  details?: any;
}

export interface RcmCommandCenterSnapshot {
  generatedAt: string;
  refreshIntervalSeconds: number;
  metrics: CommandCenterMetric[];
  workflowStages: CommandCenterStage[];
  unifiedWorkQueue: UnifiedWorkQueueItem[];
  aiInsights: CommandCenterInsight[];
  claimReadiness: ClaimReadinessRow[];
  recentClaimActivity: RecentClaimActivity[];
}

const ACTIVE_RECORD_FILTER = {
  active: true,
  isDeleted: false,
};

const REALTIME_REFRESH_INTERVAL_SECONDS = 15;
const RECHECK_WINDOW_HOURS = 72;

const INSURANCE_ATTENTION_STATUSES = ['inactive', 'terminated', 'cancelled', 'hold', 'error'];
const AUTH_PENDING_STATUSES = ['pending', 'requested', 'submitted', 'in review', 'denied', 'escalated'];
const CODING_REVIEW_STATUSES = ['pending', 'needs review', 'rejected', 'returned'];
const CHARGE_OPEN_STATUSES = ['open', 'captured', 'queued'];
const CLAIM_SCRUB_FAILURE_STATUSES = ['failed', 'blocked', 'needs review', 'error', 'rejected'];
const CLAIM_READY_STATUSES = ['passed', 'approved', 'clean', 'ready', 'submitted'];
const CLAIM_CORRECTION_STATUSES = ['draft', 'correction', 'rejected', 'queued'];
const SUBMISSION_FAILURE_STATUSES = [
  'failed',
  'rejected',
  'error',
  'needs correction',
  'not submitted',
  'transport failed',
];
const APPEAL_OPEN_STATUSES = ['open', 'draft', 'pending', 'submitted', 'in review', 'escalated'];
const AR_OPEN_STATUSES = ['open', 'pending', 'assigned', 'reopened'];
const AR_HIGH_PRIORITIES = ['high', 'critical'];
const PATIENT_BILLING_OPEN_STATUSES = ['pending', 'overdue', 'sent', 'past due', 'payment plan'];
const COLLECTION_OPEN_STATUSES = ['open', 'active', 'assigned', 'in progress', 'pending'];
const ACTIVE_ELIGIBILITY_STATUS_PATTERNS = ['active', 'eligible', 'covered', 'completed'];

function createRegexPatterns(values: string[]) {
  return values.map((value) => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
}

function createStatusRegexPatterns(values: string[]) {
  return values.map((value) => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[_\s-]+/g, '[_\\s-]+')}$`, 'i'));
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeStatusToken(value: unknown) {
  return String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function normalizeDashboardLifecycleStatus(value: unknown): ClaimReadinessRow['lifecycleStatus'] {
  const status = normalizeClaimLifecycleStatus(value);
  return status === 'DRAFT' || status === 'READY' ? 'PENDING' : status;
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== '';
}

function getTrackingLifecycleStatus(tracking: Record<string, any>) {
  return normalizeClaimLifecycleStatus(
    tracking.normalizedStatus ??
    tracking.rawStatusCode ??
    tracking.statusCode ??
    tracking.statusDescription,
  );
}

function isRejectedTrackingEvent(tracking: Record<string, any>) {
  const statusDescription = String(tracking.statusDescription ?? '');
  const eventType = normalizeStatusToken(tracking.eventType);
  const rawStatusCode = normalizeStatusToken(tracking.rawStatusCode);
  const statusCode = normalizeStatusToken(tracking.statusCode);

  return getTrackingLifecycleStatus(tracking) === 'REJECTED' ||
    ['A3', 'A6', 'A7', 'A8', 'REJECTED'].includes(rawStatusCode) ||
    ['A3', 'A6', 'A7', 'A8', 'REJECTED'].includes(statusCode) ||
    /reject|denied|invalid|not accepted/i.test(statusDescription) ||
    ['ACK_999_REJECTED', 'ACK_277CA_REJECTED'].includes(eventType) ||
    hasValue(tracking.rejectionLevel) ||
    hasValue(tracking.rejectionSource) ||
    (Array.isArray(tracking.rejectionReasonCodes) && tracking.rejectionReasonCodes.length > 0);
}

function isFollowUpTrackingEvent(tracking: Record<string, any>) {
  return isRejectedTrackingEvent(tracking) ||
    getTrackingLifecycleStatus(tracking) === 'FAILED' ||
    hasValue(tracking.nextActionRequired);
}

function toIsoDate(value: unknown) {
  if (!value) {
    return undefined;
  }

  const dateValue = value instanceof Date ? value : new Date(String(value));

  return Number.isNaN(dateValue.getTime()) ? undefined : dateValue.toISOString();
}

function shortId(value: unknown) {
  const id = String(value ?? '').trim();

  if (!id) {
    return 'Unknown';
  }

  return id.slice(-6).toUpperCase();
}

function appendDashboardRouteParams(
  route: string,
  params: Record<string, string | undefined>,
) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const serializedParams = searchParams.toString();
  return serializedParams ? `${route}?${serializedParams}` : route;
}

const DASHBOARD_RETURN_PARAMS = {
  returnTo: '/rcm/dashboard',
  returnLabel: 'Back to Dashboard',
};

function buildDashboardQueueRoute(route: string, dashboardQueue: string) {
  return appendDashboardRouteParams(route, {
    dashboardQueue,
    ...DASHBOARD_RETURN_PARAMS,
  });
}

function buildDashboardItemRoute(
  route: string,
  dashboardQueue: string,
  entityId: unknown,
  extraParams: Record<string, string | undefined> = {},
) {
  return appendDashboardRouteParams(route, {
    dashboardQueue,
    dashboardEntityId: String(entityId ?? ''),
    ...DASHBOARD_RETURN_PARAMS,
    ...extraParams,
  });
}

function getPriorityWeight(priority: QueuePriority) {
  switch (priority) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'medium':
      return 2;
    default:
      return 3;
  }
}

function sortQueueItems(items: CommandCenterQueueItem[]) {
  return [...items].sort((firstItem, secondItem) => {
    const priorityDifference =
      getPriorityWeight(firstItem.priority) - getPriorityWeight(secondItem.priority);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const firstDueDate = firstItem.dueAt ? new Date(firstItem.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const secondDueDate = secondItem.dueAt
      ? new Date(secondItem.dueAt).getTime()
      : Number.MAX_SAFE_INTEGER;

    if (firstDueDate !== secondDueDate) {
      return firstDueDate - secondDueDate;
    }

    return firstItem.title.localeCompare(secondItem.title);
  });
}

function buildTone(value: number, warningThreshold = 1, criticalThreshold = 3): MetricTone {
  if (value >= criticalThreshold) {
    return 'critical';
  }

  if (value >= warningThreshold) {
    return 'warning';
  }

  return 'positive';
}

function buildPositiveTone(value: number): MetricTone {
  return value > 0 ? 'positive' : 'neutral';
}

function isActiveEligibilityStatus(value: unknown) {
  const normalizedValue = normalizeText(value);

  return ACTIVE_ELIGIBILITY_STATUS_PATTERNS.some((pattern) => normalizedValue.includes(pattern));
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
}

function readNestedValue(source: unknown, path: string) {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, source);
}

function getCoverageRuleBlockingErrors(line: Record<string, any>) {
  const errors = [
    ...normalizeStringArray(readNestedValue(line.coverageRuleSnapshot, 'coverageRules.errors')),
    ...normalizeStringArray(readNestedValue(line.coverageRuleSnapshot, 'errors')),
  ];
  const covered = readNestedValue(line.coverageRuleSnapshot, 'coverageRules.covered');

  if (covered === false && !errors.length) {
    errors.push('Service is not covered by matched coverage rule.');
  }

  return errors;
}

function isLineAuthorizationRequired(line: Record<string, any>) {
  return Boolean(
    line.authorizationRequired ||
    readNestedValue(line.coverageRuleSnapshot, 'eligibility.authorizationRequired') === true ||
    readNestedValue(line.coverageRuleSnapshot, 'coverageRules.authorizationRequired') === true
  );
}

function isLineReferralRequired(line: Record<string, any>) {
  return Boolean(
    line.referralRequired ||
    readNestedValue(line.coverageRuleSnapshot, 'eligibility.referralRequired') === true ||
    readNestedValue(line.coverageRuleSnapshot, 'coverageRules.referralRequired') === true
  );
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function buildMetricRoute(route: string, dashboardQueue: string) {
  return buildDashboardQueueRoute(route, dashboardQueue);
}

function buildPatientMap(patients: Array<Record<string, unknown>>) {
  return new Map(
    patients.map((patient) => [
      String(patient._id),
      {
        fullName: [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() || `Patient ${shortId(patient._id)}`,
        medicalRecordNumber:
          typeof patient.medicalRecordNumber === 'string' ? patient.medicalRecordNumber : undefined,
      },
    ]),
  );
}

function getPatientLabel(
  patientMap: Map<string, { fullName: string; medicalRecordNumber?: string }>,
  patientId: unknown,
) {
  const patient = patientMap.get(String(patientId ?? ''));

  if (!patient) {
    return `Patient ${shortId(patientId)}`;
  }

  if (!patient.medicalRecordNumber) {
    return patient.fullName;
  }

  return `${patient.fullName} (${patient.medicalRecordNumber})`;
}

function createStage(
  key: WorkflowStageKey,
  label: string,
  description: string,
  route: string,
  count: number,
  items: CommandCenterQueueItem[],
): CommandCenterStage {
  return {
    key,
    label,
    description,
    route,
    count,
    criticalCount: items.filter((item) => item.priority === 'critical').length,
    items: sortQueueItems(items),
  };
}

export const commandCenterService = {
  async getSnapshot(): Promise<RcmCommandCenterSnapshot> {
    const now = new Date();
    const staleVerificationCutoff = new Date(
      now.getTime() - RECHECK_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const followUpCutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const patientAccessFilter = {
      ...ACTIVE_RECORD_FILTER,
      $or: [
        { 'verification.nextVerificationDueDate': { $lte: now } },
        { 'verification.lastVerifiedDateTime': { $lt: staleVerificationCutoff } },
        { terminationDate: { $lte: now } },
        { policyStatus: { $in: createRegexPatterns(INSURANCE_ATTENTION_STATUSES) } },
      ],
    };

    const authorizationFilter = {
      ...ACTIVE_RECORD_FILTER,
      $or: [
        { authorizationRequired: true, authNumber: { $in: [null, ''] } },
        { authorizationStatus: { $in: createRegexPatterns(AUTH_PENDING_STATUSES) } },
        { denialReason: { $exists: true, $ne: '' } },
        { expirationDate: { $lte: now } },
      ],
    };

    const codingFilter = {
      ...ACTIVE_RECORD_FILTER,
      $or: [
        { documentationComplete: false },
        { 'validationErrors.0': { $exists: true } },
        { codingReviewStatus: { $in: createRegexPatterns(CODING_REVIEW_STATUSES) } },
        { chargeStatus: { $in: createRegexPatterns(CHARGE_OPEN_STATUSES) } },
      ],
    };

    const claimFilter = {
      ...ACTIVE_RECORD_FILTER,
      $or: [
        { scrubStatus: { $in: createRegexPatterns(CLAIM_SCRUB_FAILURE_STATUSES) } },
        { claimStatus: { $in: createRegexPatterns(CLAIM_CORRECTION_STATUSES) } },
        { submissionStatus: { $in: createRegexPatterns(SUBMISSION_FAILURE_STATUSES) } },
        { rejectionReason: { $exists: true, $ne: '' } },
        {
          scrubStatus: {
            $exists: true,
            $nin: createRegexPatterns(CLAIM_READY_STATUSES),
          },
        },
      ],
    };

    const claimSubmissionFilter = {
      ...ACTIVE_RECORD_FILTER,
      $or: [
        { transmissionStatus: { $in: createRegexPatterns(SUBMISSION_FAILURE_STATUSES) } },
        { acknowledgementStatus: { $in: createRegexPatterns(SUBMISSION_FAILURE_STATUSES) } },
        { submissionErrorCode: { $exists: true, $ne: '' } },
        { submissionErrorMessage: { $exists: true, $ne: '' } },
      ],
    };

    const claimTrackingFilter = {
      ...ACTIVE_RECORD_FILTER,
      $or: [
        { normalizedStatus: { $in: createStatusRegexPatterns(['REJECTED', 'FAILED']) } },
        { rawStatusCode: { $in: createStatusRegexPatterns(['REJECTED', 'FAILED', 'A3', 'A6', 'A7', 'A8']) } },
        { statusCode: { $in: createStatusRegexPatterns(['REJECTED', 'FAILED', 'A3', 'A6', 'A7', 'A8']) } },
        { eventType: { $in: createStatusRegexPatterns(['ACK_999_REJECTED', 'ACK_277CA_REJECTED']) } },
        { rejectionLevel: { $exists: true, $ne: '' } },
        { rejectionSource: { $exists: true, $ne: '' } },
        { statusDescription: { $regex: 'reject|denied|invalid|not accepted', $options: 'i' } },
        { 'rejectionReasonCodes.0': { $exists: true } },
        { nextActionRequired: { $exists: true, $ne: '' } },
      ],
    };

    const denialFilter = {
      ...ACTIVE_RECORD_FILTER,
      denialStatus: { $nin: createStatusRegexPatterns(['RESOLVED', 'WRITTEN_OFF']) },
    };

    const appealFilter = {
      ...ACTIVE_RECORD_FILTER,
      $or: [
        { appealStatus: { $in: createRegexPatterns(APPEAL_OPEN_STATUSES) } },
        { outcome: { $in: [null, ''] } },
      ],
    };

    const arFilter = {
      ...ACTIVE_RECORD_FILTER,
      $or: [
        { nextFollowUpDate: { $lte: followUpCutoff } },
        { escalationFlag: true },
        { status: { $in: createRegexPatterns(AR_OPEN_STATUSES) } },
        { priority: { $in: createRegexPatterns(AR_HIGH_PRIORITIES) } },
      ],
    };

    const patientBillingFilter = {
      ...ACTIVE_RECORD_FILTER,
      $or: [
        { amountDue: { $gt: 0 } },
        { currentBalance: { $gt: 0 } },
        { collectionsFlag: true },
        { statementStatus: { $in: createRegexPatterns(PATIENT_BILLING_OPEN_STATUSES) } },
        { status: { $in: createRegexPatterns(PATIENT_BILLING_OPEN_STATUSES.concat(['READY_TO_SEND', 'SENT', 'OVERDUE'])) } },
      ],
    };

    const collectionFilter = {
      ...ACTIVE_RECORD_FILTER,
      $or: [
        { collectionStatus: { $in: createRegexPatterns(COLLECTION_OPEN_STATUSES) } },
        { closeDate: { $exists: false } },
      ],
    };

    const [
      activeClaimDocs,
      activeSubmissionDocs,
      activeTrackingDocs,
      activeCorrectedClaimDocs,
      activeAppealDocs,
      activeDenialDocs,
      eligibilityDocs,
      activeFeeScheduleDocs,
      activeCoverageRuleCount,
      patientAccessCount,
      authorizationCount,
      codingCount,
      claimCount,
      claimSubmissionCount,
      claimTrackingCount,
      denialCount,
      appealCount,
      arCount,
      patientBillingCount,
      collectionCount,
      patientAccessDocs,
      authorizationDocs,
      codingDocs,
      claimDocs,
      claimSubmissionDocs,
      claimTrackingDocs,
      denialDocs,
      appealDocs,
      arDocs,
      patientBillingDocs,
      collectionDocs,
    ] = await Promise.all([
      Claim.find(ACTIVE_RECORD_FILTER)
        .select(
          '_id claimId patientId payerId facilityId claimDate created claimStatus scrubStatus submissionStatus paymentStatus rejectionReason totalChargeAmount diagnosisCodes frequencyCode claimLines',
        )
        .sort({ updated: -1 })
        .lean(),
      ClaimSubmission.find(ACTIVE_RECORD_FILTER)
        .select(
          '_id claimId submissionDateTime transmissionStatus acknowledgementStatus status normalizedStatus trackingSource responseType responseStatusCode externalSubmissionId controlNumber claimControlNumber submissionErrorCode submissionErrorMessage',
        )
        .sort({ submissionDateTime: -1, updated: -1 })
        .lean(),
      ClaimTracking.find(ACTIVE_RECORD_FILTER)
        .select(
          '_id claimId claimSubmissionId timestamp trackingSource source responseType eventType normalizedStatus rawStatusCode summary controlNumber externalSubmissionId claimControlNumber statusCode statusDescription responseStatusCode receivedDate rejectionLevel rejectionSource rejectionReasonCodes nextActionRequired',
        )
        .sort({ receivedDate: -1, updated: -1 })
        .lean(),
      CorrectedClaim.find(ACTIVE_RECORD_FILTER)
        .select('_id originalClaimId clonedClaimId sourceDenialId correctedClaimStatus submittedDate correctionType correctedFrequencyCode created updated')
        .sort({ updated: -1 })
        .lean(),
      Appeal.find(ACTIVE_RECORD_FILTER)
        .select('_id denialId claimId appealStatus appealCategory outcome submissionDate outcomeDate dueDate appealDeadline')
        .sort({ updated: -1 })
        .lean(),
      Denial.find(ACTIVE_RECORD_FILTER)
        .select('_id denialStatus preventableFlag')
        .sort({ updated: -1 })
        .lean(),
      EligibilityVerification.find(ACTIVE_RECORD_FILTER)
        .select(
          '_id patientId insuranceId payerId serviceDate procedureCodes eligibilityStatus coverageStatus planActive checkedAt',
        )
        .sort({ checkedAt: -1, updated: -1 })
        .lean(),
      FeeSchedule.find(ACTIVE_RECORD_FILTER).select('_id cptCode payerId allowedAmount active').lean(),
      CoverageRule.countDocuments(ACTIVE_RECORD_FILTER),
      InsurancePolicy.countDocuments(patientAccessFilter),
      PriorAuthorization.countDocuments(authorizationFilter),
      Charge.countDocuments(codingFilter),
      Claim.countDocuments(claimFilter),
      ClaimSubmission.countDocuments(claimSubmissionFilter),
      ClaimTracking.countDocuments(claimTrackingFilter),
      Denial.countDocuments(denialFilter),
      Appeal.countDocuments(appealFilter),
      ArWorkItem.countDocuments(arFilter),
      PatientBilling.countDocuments(patientBillingFilter),
      Collection.countDocuments(collectionFilter),
      InsurancePolicy.find(patientAccessFilter)
        .select(
          '_id patientId planName memberId payerId insuranceVerifiedFlag policyStatus terminationDate verification',
        )
        .sort({ updated: -1 })
        .lean(),
      PriorAuthorization.find(authorizationFilter)
        .select(
          '_id patientId insuranceId authorizationRequired authNumber authorizationStatus requestDate expirationDate denialReason authorizationType',
        )
        .sort({ updated: -1 })
        .lean(),
      Charge.find(codingFilter)
        .select(
          '_id patientId serviceDate chargeStatus codingReviewStatus documentationComplete validationErrors totalChargeAmount',
        )
        .sort({ updated: -1 })
        .lean(),
      Claim.find(claimFilter)
        .select(
          '_id patientId claimDate claimStatus scrubStatus submissionStatus rejectionReason totalChargeAmount',
        )
        .sort({ updated: -1 })
        .lean(),
      ClaimSubmission.find(claimSubmissionFilter)
        .select(
          '_id claimId submissionDateTime transmissionStatus acknowledgementStatus normalizedStatus trackingSource responseType submissionErrorCode submissionErrorMessage',
        )
        .sort({ updated: -1 })
        .lean(),
      ClaimTracking.find(claimTrackingFilter)
        .select(
          '_id claimId timestamp trackingSource source responseType eventType normalizedStatus rawStatusCode summary controlNumber externalSubmissionId statusCode statusDescription receivedDate rejectionLevel rejectionSource rejectionReasonCodes nextActionRequired',
        )
        .sort({ updated: -1 })
        .lean(),
      Denial.find(denialFilter)
        .select(
          '_id patientId claimId payerId denialCode denialReason denialCategory denialAmount preventableFlag rootCause denialStatus denialDate owner priority recommendedAction correctedClaimId arWorkItemId',
        )
        .sort({ updated: -1 })
        .lean(),
      Appeal.find(appealFilter)
        .select(
          '_id claimId payerId denialCode appealLevel appealReason appealStatus appealDeadline submissionDate outcome',
        )
        .sort({ updated: -1 })
        .lean(),
      ArWorkItem.find(arFilter)
        .select(
          '_id patientId claimId payerId category balanceAmount expectedAmount paidAmount varianceAmount agingBucket denialCode denialCategory priority status owner reason nextAction rootCauseAnalysis suggestedFix followUpDate nextFollowUpDate dueDate appealRequired correctedClaimRequired escalationFlag',
        )
        .sort({ updated: -1 })
        .lean(),
      PatientBilling.find(patientBillingFilter)
        .select(
          '_id patientId claimId paymentPostingId statementNumber statementDate patientBalance amountDue originalBalance currentBalance insurancePaid adjustments patientPayments dueDate lastStatementSent collectionsFlag paymentPlanId statementStatus status agingBucket',
        )
        .sort({ updated: -1 })
        .lean(),
      Collection.find(collectionFilter)
        .select(
          '_id patientId patientBillingId claimId originalBalance currentBalance daysPastDue collectionStage status owner lastContactDate nextContactDate contactAttempts resolution writeOffAmount settlementAmount balanceAmount agencyName referredDate collectionStatus recoveredAmount closeDate',
        )
        .sort({ updated: -1 })
        .lean(),
    ]);

    const patientIds = new Set<string>();

    const collectPatientId = (patientId?: unknown) => {
      if (patientId) {
        patientIds.add(String(patientId));
      }
    };

    patientAccessDocs.forEach((item) => collectPatientId(item.patientId));
    authorizationDocs.forEach((item) => collectPatientId(item.patientId));
    codingDocs.forEach((item) => collectPatientId(item.patientId));
    claimDocs.forEach((item) => collectPatientId(item.patientId));
    activeClaimDocs.forEach((item) => collectPatientId(item.patientId));
    denialDocs.forEach((item) => collectPatientId(item.patientId));
    arDocs.forEach((item) => collectPatientId(item.patientId));
    patientBillingDocs.forEach((item) => collectPatientId(item.patientId));
    collectionDocs.forEach((item) => collectPatientId(item.patientId));

    const patients = patientIds.size
      ? await Patient.find({ _id: { $in: Array.from(patientIds) } })
          .select('_id firstName lastName medicalRecordNumber')
          .lean()
      : [];
    const facilityIds = Array.from(
      new Set(
        activeClaimDocs
          .map((claim) => String(claim.facilityId ?? ''))
          .filter(Boolean),
      ),
    );
    const facilities = facilityIds.length
      ? await Facility.find({ _id: { $in: facilityIds } })
          .select('_id facilityName facilityCode state')
          .lean()
      : [];

    const patientMap = buildPatientMap(patients as Array<Record<string, unknown>>);
    const [activeEraDocs, activePaymentPostingDocs, activeRefundDocs] = await Promise.all([
      EraEobProcessing.find(ACTIVE_RECORD_FILTER)
        .select('_id importStatus matchedClaims unmatchedClaims totalPaymentAmount totalAmount paymentTraceNumber receivedDate')
        .sort({ receivedDate: -1, updated: -1 })
        .lean(),
      PaymentPosting.find(ACTIVE_RECORD_FILTER)
        .select('_id claimId postingStatus postedAmount receivedAmount paymentLines paymentDate')
        .sort({ paymentDate: -1, updated: -1 })
        .lean(),
      Refund.find(ACTIVE_RECORD_FILTER)
        .select('_id patientId patientBillingId patientPaymentId refundAmount refundStatus requestedDate')
        .sort({ requestedDate: -1, updated: -1 })
        .lean(),
    ]);
    const facilityMap = new Map(
      facilities.map((facility) => [
        String(facility._id),
        {
          label:
            [facility.facilityName, facility.facilityCode ? `(${facility.facilityCode})` : undefined]
              .filter(Boolean)
              .join(' ') || `Facility ${shortId(facility._id)}`,
          state: typeof facility.state === 'string' ? facility.state : undefined,
        },
      ]),
    );
    const eligibilityById = new Map(eligibilityDocs.map((item) => [String(item._id), item]));
    const activeFeeScheduleIds = new Set(activeFeeScheduleDocs.map((item) => String(item._id)));
    const eligibilityFreshnessCutoff = new Date(
      now.getTime() - envConfig.eligibilityValidDays * 24 * 60 * 60 * 1000,
    );
    const latestSubmissionByClaimId = new Map<string, any>();

    activeSubmissionDocs.forEach((submission) => {
      const claimId = String(submission.claimId ?? '');
      if (claimId && !latestSubmissionByClaimId.has(claimId)) {
        latestSubmissionByClaimId.set(claimId, submission);
      }
    });

    const latestTrackingByClaimId = new Map<string, any>();
    activeTrackingDocs.forEach((tracking) => {
      const claimId = String(tracking.claimId ?? '');
      if (claimId && !latestTrackingByClaimId.has(claimId)) {
        latestTrackingByClaimId.set(claimId, tracking);
      }
    });
    const activeClaimById = new Map(activeClaimDocs.map((claim) => [String(claim._id), claim]));

    const missingContractRateClaimIds = new Set<string>();
    const eligibilityFailureClaimIds = new Set<string>();
    const coverageRuleFailureClaimIds = new Set<string>();
    const authorizationMissingClaimIds = new Set<string>();
    const referralMissingClaimIds = new Set<string>();
    let totalBilledAmount = 0;
    let totalExpectedAllowedAmount = 0;
    let totalExpectedInsurancePayment = 0;
    let totalExpectedPatientResponsibility = 0;

    const claimReadinessRows = activeClaimDocs.map((claim) => {
      const claimRecordId = String(claim._id);
      const blockingReasons = new Set<string>();
      const blockerTypes = new Set<string>();
      let claimBilledAmount = 0;
      let claimExpectedAllowedAmount = 0;

      if (!hasValue(claim.frequencyCode)) {
        blockingReasons.add('Missing claim frequency code');
        blockerTypes.add('claimData');
      }

      if (!Array.isArray(claim.diagnosisCodes) || !claim.diagnosisCodes.length) {
        blockingReasons.add('Missing diagnosis codes');
        blockerTypes.add('claimData');
      }

      (claim.claimLines ?? []).forEach((line: Record<string, any>, index: number) => {
        const lineNumber = line.lineNumber ?? index + 1;
        const lineLabel = `Line ${lineNumber}${line.cptCode ? ` ${line.cptCode}` : ''}`;
        const lineBilledAmount = getNumber(line.chargeAmount);

        totalBilledAmount += lineBilledAmount;
        totalExpectedAllowedAmount += getNumber(line.expectedAllowedAmount);
        totalExpectedInsurancePayment += getNumber(line.expectedInsurancePayment);
        totalExpectedPatientResponsibility += getNumber(line.expectedPatientResponsibility);
        claimBilledAmount += lineBilledAmount;
        claimExpectedAllowedAmount += getNumber(line.expectedAllowedAmount);

        if (!line.feeScheduleId || typeof line.expectedAllowedAmount !== 'number' || !activeFeeScheduleIds.has(String(line.feeScheduleId))) {
          missingContractRateClaimIds.add(claimRecordId);
          blockingReasons.add(`${lineLabel}: missing contract rate`);
          blockerTypes.add('missingFeeSchedule');
        }

        const eligibilityId = String(line.eligibilityVerificationId ?? '');
        const eligibility = eligibilityId ? eligibilityById.get(eligibilityId) : null;
        const eligibilityCheckedAt = eligibility?.checkedAt instanceof Date
          ? eligibility.checkedAt
          : eligibility?.checkedAt ? new Date(String(eligibility.checkedAt)) : null;

        if (!eligibilityId || !eligibility) {
          eligibilityFailureClaimIds.add(claimRecordId);
          blockingReasons.add(`${lineLabel}: missing eligibility`);
          blockerTypes.add('eligibility');
        } else if (
          eligibility.planActive !== true ||
          !isActiveEligibilityStatus(eligibility.coverageStatus ?? eligibility.eligibilityStatus) ||
          !eligibilityCheckedAt ||
          eligibilityCheckedAt < eligibilityFreshnessCutoff
        ) {
          eligibilityFailureClaimIds.add(claimRecordId);
          blockingReasons.add(`${lineLabel}: eligibility inactive, expired, or unclear`);
          blockerTypes.add('eligibility');
        }

        const coverageErrors = getCoverageRuleBlockingErrors(line);
        if (coverageErrors.length) {
          coverageRuleFailureClaimIds.add(claimRecordId);
          blockingReasons.add(`${lineLabel}: coverage rule failure`);
          blockerTypes.add('coverageRule');
        }

        if (isLineAuthorizationRequired(line) && !line.priorAuthorizationId) {
          authorizationMissingClaimIds.add(claimRecordId);
          blockingReasons.add(`${lineLabel}: authorization required`);
          blockerTypes.add('authorizationReferral');
        }

        if (isLineReferralRequired(line) && !line.referralId) {
          referralMissingClaimIds.add(claimRecordId);
          blockingReasons.add(`${lineLabel}: referral required`);
          blockerTypes.add('authorizationReferral');
        }
      });

      const latestSubmission = latestSubmissionByClaimId.get(String(claim._id));
      const latestTracking = latestTrackingByClaimId.get(String(claim._id));
      const lifecycleStatus = normalizeDashboardLifecycleStatus(
        latestTracking?.normalizedStatus ??
        latestTracking?.rawStatusCode ??
        latestTracking?.statusCode ??
        latestTracking?.statusDescription ??
        latestSubmission?.normalizedStatus ??
        latestSubmission?.acknowledgementStatus ??
        latestSubmission?.transmissionStatus ??
        claim.submissionStatus,
      );
      const normalizedSubmissionStatus = normalizeText(claim.submissionStatus);
      const hasSubmissionActivity = Boolean(latestSubmission);
      const notSubmitted =
        !hasSubmissionActivity &&
        (!normalizedSubmissionStatus || normalizedSubmissionStatus.includes('not submitted'));

      if (!notSubmitted) {
        blockingReasons.add(`Claim is already in ${lifecycleStatus.toLowerCase()} submission workflow`);
        blockerTypes.add(
          ['REJECTED', 'FAILED'].includes(lifecycleStatus) ? 'rejectedFailed' : 'submitted',
        );
      }

      const canSubmit = blockingReasons.size === 0 && notSubmitted;
      const facility = facilityMap.get(String(claim.facilityId ?? ''));
      const claimDate = claim.claimDate instanceof Date
        ? claim.claimDate
        : claim.claimDate ? new Date(String(claim.claimDate)) : claim.created instanceof Date
          ? claim.created
          : claim.created ? new Date(String(claim.created)) : null;
      const claimAgeDays = claimDate && !Number.isNaN(claimDate.getTime())
        ? Math.max(0, Math.floor((now.getTime() - claimDate.getTime()) / (24 * 60 * 60 * 1000)))
        : 0;

      return {
        claimId: String(claim._id),
        displayClaimId: String(claim.claimId ?? shortId(claim._id)),
        patient: getPatientLabel(patientMap, claim.patientId),
        payerId: typeof claim.payerId === 'string' ? claim.payerId : undefined,
        facility: facility?.label,
        state: facility?.state,
        claimStatus: String(claim.claimStatus ?? 'Unknown'),
        submissionStatus: String(claim.submissionStatus ?? 'Unknown'),
        lifecycleStatus,
        status: [claim.claimStatus, claim.submissionStatus, lifecycleStatus].filter(Boolean).join(' / '),
        canSubmit,
        blockingReasons: Array.from(blockingReasons),
        blockerTypes: Array.from(blockerTypes),
        route: buildDashboardItemRoute(
          `/rcm/claims/${String(claim._id)}/readiness`,
          'claims',
          claim._id,
        ),
        totalBilledAmount: claimBilledAmount || getNumber(claim.totalChargeAmount),
        totalExpectedAllowedAmount: claimExpectedAllowedAmount,
        claimAgeDays,
      } satisfies ClaimReadinessRow;
    });

    const readyClaimCount = claimReadinessRows.filter((item) => item.canSubmit).length;
    const blockedClaimCount = claimReadinessRows.filter((item) => !item.canSubmit).length;
    const submissionStatusCounts = {
      SUBMITTED: 0,
      PENDING: 0,
      ACCEPTED: 0,
      REJECTED: 0,
      FAILED: 0,
    };
    claimReadinessRows.forEach((item) => {
      const isInSubmissionWorkflow =
        item.blockerTypes.includes('submitted') ||
        item.blockerTypes.includes('rejectedFailed');

      if (isInSubmissionWorkflow) {
        submissionStatusCounts[item.lifecycleStatus] += 1;
      }
    });
    const recentClaimActivity = activeTrackingDocs
      .map<RecentClaimActivity | null>((tracking) => {
        const claimId = String(tracking.claimId ?? '');
        const claim = activeClaimById.get(claimId);
        if (!claimId || !claim) {
          return null;
        }

        const occurredAt =
          toIsoDate(tracking.timestamp)
          ?? toIsoDate(tracking.receivedDate)
          ?? toIsoDate((tracking as any).updated);
        if (!occurredAt) {
          return null;
        }

        const status = getTrackingLifecycleStatus(tracking);

        return {
          id: String(tracking._id),
          claimId,
          displayClaimId: String(claim.claimId ?? shortId(claim._id)),
          claimNumber: String(claim.claimId ?? shortId(claim._id)),
          ...(typeof claim.payerId === 'string' ? { payer: claim.payerId } : {}),
          status,
          eventType: String(tracking.eventType ?? 'CLAIM_STATUS_UPDATED'),
          source: tracking.trackingSource === 'SIMULATED' ? 'SIMULATED' : 'REAL',
          summary: String(tracking.summary ?? tracking.statusDescription ?? 'Claim tracking status updated.'),
          occurredAt,
          route: buildDashboardItemRoute(
            '/rcm/claim-trackings',
            'claim-tracking',
            tracking._id,
            { claimId },
          ),
        } satisfies RecentClaimActivity;
      })
      .filter((item): item is RecentClaimActivity => item !== null)
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
      .slice(0, 10);
    const rejectedTrackingEventCount = activeTrackingDocs.filter(isRejectedTrackingEvent).length;
    const trackingFollowUpEventCount = activeTrackingDocs.filter(isFollowUpTrackingEvent).length;
    const missingContractRateCount = missingContractRateClaimIds.size;
    const eligibilityFailureCount = eligibilityFailureClaimIds.size;
    const coverageRuleFailureCount = coverageRuleFailureClaimIds.size;
    const authorizationMissingCount = authorizationMissingClaimIds.size;
    const referralMissingCount = referralMissingClaimIds.size;
    const eraReceivedCount = activeEraDocs.length;
    const postedPaymentDocs = activePaymentPostingDocs.filter((payment) =>
      ['POSTED', 'PARTIAL'].includes(normalizeStatusToken(payment.postingStatus)),
    );
    const paymentsPostedCount = postedPaymentDocs.length;
    const unmatchedEraCount = activeEraDocs.filter((era) =>
      ['UNMATCHED', 'PARTIALLY_MATCHED'].includes(normalizeStatusToken(era.importStatus)) ||
      (Array.isArray(era.unmatchedClaims) && era.unmatchedClaims.length > 0),
    ).length;
    const totalPaidAmount = postedPaymentDocs.reduce(
      (total, payment) => total + getNumber(payment.postedAmount ?? payment.receivedAmount),
      0,
    );
    const totalAdjustmentAmount = activePaymentPostingDocs.reduce((total, payment) => {
      const lineAdjustments = Array.isArray(payment.paymentLines)
        ? payment.paymentLines.reduce(
            (lineTotal: number, line: Record<string, unknown>) => lineTotal + getNumber(line.adjustmentAmount),
            0,
          )
        : 0;
      return total + lineAdjustments;
    }, 0);
    const underpaidClaimCount = activeClaimDocs.filter((claim) => normalizeStatusToken(claim.paymentStatus) === 'UNDERPAID').length;
    const openArDocs = arDocs.filter((item) => !['RESOLVED', 'CLOSED'].includes(normalizeStatusToken(item.status)));
    const arTotalBalance = openArDocs.reduce((total, item) => total + getNumber(item.balanceAmount), 0);
    const underpaymentAmount = openArDocs
      .filter((item) => normalizeStatusToken(item.category) === 'UNDERPAYMENT')
      .reduce((total, item) => total + getNumber(item.varianceAmount ?? item.balanceAmount), 0);
    const arAgingBuckets = openArDocs.reduce<Record<string, number>>((counts, item) => {
      const bucket = String(item.agingBucket ?? '0-30') || '0-30';
      counts[bucket] = (counts[bucket] ?? 0) + 1;
      return counts;
    }, {});
    const openPatientBillingDocs = patientBillingDocs.filter((billing) =>
      getNumber(billing.currentBalance ?? billing.amountDue ?? billing.patientBalance) > 0 &&
      !['PAID', 'VOID'].includes(normalizeStatusToken(billing.status)) &&
      !['PAID', 'VOID'].includes(normalizeStatusToken(billing.statementStatus)),
    );
    const patientBalanceTotal = openPatientBillingDocs.reduce(
      (total, billing) => total + getNumber(billing.currentBalance ?? billing.amountDue ?? billing.patientBalance),
      0,
    );
    const patientStatementsReadyCount = patientBillingDocs.filter((billing) =>
      ['READY_TO_SEND', 'DRAFT'].includes(normalizeStatusToken(billing.status)) ||
      ['READY_TO_SEND', 'DRAFT'].includes(normalizeStatusToken(billing.statementStatus)),
    ).length;
    const overduePatientBalanceCount = openPatientBillingDocs.filter((billing) =>
      ['OVERDUE', 'PAST_DUE'].includes(normalizeStatusToken(billing.status)) ||
      ['OVERDUE', 'PAST_DUE'].includes(normalizeStatusToken(billing.statementStatus)) ||
      (billing.dueDate instanceof Date && billing.dueDate <= now),
    ).length;
    const refundPendingReviewCount = activeRefundDocs.filter((refund) =>
      normalizeStatusToken(refund.refundStatus) === 'PENDING_REVIEW',
    ).length;
    const activeCollectionDocs = collectionDocs.filter((collection) =>
      !['CLOSED', 'SETTLED', 'WRITTEN_OFF'].includes(normalizeStatusToken(collection.status)) &&
      !['CLOSED', 'SETTLED', 'WRITTEN_OFF'].includes(normalizeStatusToken(collection.collectionStatus)),
    );
    const collectionsRecoveredAmount = collectionDocs.reduce((total, collection) =>
      total + getNumber(collection.recoveredAmount ?? collection.settlementAmount), 0);
    const collectionWriteOffAmount = collectionDocs.reduce((total, collection) =>
      total + getNumber(collection.writeOffAmount), 0);
    const openDenialDocs = denialDocs.filter((denial) => !['RESOLVED', 'WRITTEN_OFF'].includes(normalizeStatusToken(denial.denialStatus)));
    const openDenialAmount = openDenialDocs.reduce((total, denial) => total + getNumber(denial.denialAmount), 0);
    const preventableDenialCount = openDenialDocs.filter((denial) => denial.preventableFlag === true).length;
    const correctedClaimReadyCount = openDenialDocs.filter((denial) => normalizeStatusToken(denial.denialStatus) === 'CORRECTED_CLAIM_READY').length;
    const appealReadyCount = openDenialDocs.filter((denial) => normalizeStatusToken(denial.denialStatus) === 'APPEAL_READY').length;
    const denialCategoryCounts = openDenialDocs.reduce<Record<string, number>>((counts, denial) => {
      const category = String(denial.denialCategory ?? 'OTHER').toUpperCase() || 'OTHER';
      counts[category] = (counts[category] ?? 0) + 1;
      return counts;
    }, {});
    const denialAgingBuckets = openDenialDocs.reduce<Record<string, number>>((counts, denial) => {
      const denialDate = denial.denialDate instanceof Date ? denial.denialDate : denial.denialDate ? new Date(String(denial.denialDate)) : now;
      const ageDays = Math.max(0, Math.floor((now.getTime() - denialDate.getTime()) / (24 * 60 * 60 * 1000)));
      const bucket = ageDays <= 30 ? '0-30' : ageDays <= 60 ? '31-60' : ageDays <= 90 ? '61-90' : '90+';
      counts[bucket] = (counts[bucket] ?? 0) + 1;
      return counts;
    }, {});
    const correctedClaimsPendingCount = activeCorrectedClaimDocs.filter((item) =>
      !['SUBMITTED', 'CLOSED'].includes(normalizeStatusToken(item.correctedClaimStatus)),
    ).length;
    const correctedClaimsSubmittedCount = activeCorrectedClaimDocs.filter((item) =>
      normalizeStatusToken(item.correctedClaimStatus) === 'SUBMITTED' || Boolean(item.submittedDate),
    ).length;
    const appealsPendingCount = activeAppealDocs.filter((item) =>
      ['OPEN', 'DRAFT', 'READY', 'PENDING', 'SUBMITTED', 'IN_REVIEW', 'ESCALATED'].includes(normalizeStatusToken(item.appealStatus)),
    ).length;
    const appealsOverturnedCount = activeAppealDocs.filter((item) =>
      normalizeStatusToken(item.appealStatus) === 'OVERTURNED' ||
      normalizeStatusToken(item.outcome) === 'OVERTURNED',
    ).length;
    const appealsUpheldCount = activeAppealDocs.filter((item) =>
      normalizeStatusToken(item.appealStatus) === 'UPHELD' ||
      normalizeStatusToken(item.outcome) === 'UPHELD',
    ).length;
    const totalDenialDocs = activeDenialDocs.length;
    const recoveredDenialCount = activeDenialDocs.filter((denial) =>
      normalizeStatusToken(denial.denialStatus) === 'RESOLVED',
    ).length + appealsOverturnedCount + correctedClaimsSubmittedCount;
    const denialRecoveryRate = totalDenialDocs > 0
      ? Math.round((recoveredDenialCount / totalDenialDocs) * 100)
      : 0;
    const preventableDenialTotal = activeDenialDocs.filter((denial) => denial.preventableFlag === true).length;
    const preventableDenialRecovered = activeDenialDocs.filter((denial) =>
      denial.preventableFlag === true && normalizeStatusToken(denial.denialStatus) === 'RESOLVED',
    ).length;
    const preventableDenialRecoveryRate = preventableDenialTotal > 0
      ? Math.round((preventableDenialRecovered / preventableDenialTotal) * 100)
      : 0;
    const reopenedClaimsCount = activeCorrectedClaimDocs.filter((item) => Boolean(item.clonedClaimId)).length;
    const prioritizedClaimReadinessRows = claimReadinessRows
      .sort((left, right) => Number(left.canSubmit) - Number(right.canSubmit));

    const patientAccessItems = patientAccessDocs.map((policy) => {
      const nextVerificationDueDate = policy.verification?.nextVerificationDueDate;
      const lastVerifiedDateTime = policy.verification?.lastVerifiedDateTime;
      const missingRouting = !hasValue(policy.payerId) || !hasValue(policy.memberId);
      const inactiveCoverage =
        INSURANCE_ATTENTION_STATUSES.includes(normalizeText(policy.policyStatus)) ||
        (policy.terminationDate instanceof Date && policy.terminationDate <= now);
      const recheckDue =
        (nextVerificationDueDate instanceof Date && nextVerificationDueDate <= now) ||
        (lastVerifiedDateTime instanceof Date && lastVerifiedDateTime < staleVerificationCutoff);

      const priority: QueuePriority = missingRouting || inactiveCoverage ? 'critical' : recheckDue ? 'high' : 'medium';
      const status = missingRouting
        ? 'Routing incomplete'
        : inactiveCoverage
          ? 'Coverage inactive'
          : recheckDue
            ? 'Eligibility recheck due'
            : 'Policy review needed';

      const summary = missingRouting
        ? 'Payer routing or member identifiers are incomplete for real-time eligibility.'
        : inactiveCoverage
          ? 'Coverage is marked inactive or terminated and will block downstream workflow.'
          : 'Eligibility is stale or pending and should be refreshed before the encounter.';

      return {
        id: `patient-access-${String(policy._id)}`,
        entityType: 'insurance-policy',
        entityId: String(policy._id),
        title: getPatientLabel(patientMap, policy.patientId),
        subtitle: [policy.planName, policy.memberId].filter(Boolean).join(' • ') || `Policy ${shortId(policy._id)}`,
        status,
        priority,
        summary,
        nextBestAction: missingRouting
          ? 'Complete payer routing and member data before running Stedi eligibility.'
          : inactiveCoverage
            ? 'Correct insurance details and rerun eligibility before scheduling or check-in.'
            : 'Run a fresh eligibility check and push the result into patient access workflow.',
        aiBriefing: recheckDue
          ? 'The next best move is a real-time coverage refresh before the next scheduled service.'
          : 'This policy should be reviewed before it flows into authorization or claims.',
        route: buildDashboardItemRoute('/rcm/insurance-policies', 'patient-access', policy._id),
        dueAt: toIsoDate(nextVerificationDueDate ?? policy.terminationDate),
        badges: [policy.planName, policy.memberId, policy.payerId].filter(
          (value): value is string => typeof value === 'string' && Boolean(value.trim()),
        ),
      } satisfies CommandCenterQueueItem;
    });

    const authorizationItems = authorizationDocs.map((authorization) => {
      const expired =
        authorization.expirationDate instanceof Date && authorization.expirationDate <= now;
      const denied = hasValue(authorization.denialReason);
      const missingAuthNumber = authorization.authorizationRequired && !hasValue(authorization.authNumber);

      const priority: QueuePriority = expired || denied ? 'critical' : missingAuthNumber ? 'high' : 'medium';
      const status = expired
        ? 'Authorization expired'
        : denied
          ? 'Authorization denied'
          : authorization.authorizationStatus || 'Authorization pending';

      return {
        id: `authorization-${String(authorization._id)}`,
        entityType: 'prior-authorization',
        entityId: String(authorization._id),
        title: getPatientLabel(patientMap, authorization.patientId),
        subtitle:
          [authorization.authorizationType, authorization.authNumber]
            .filter(Boolean)
            .join(' • ') || `Authorization ${shortId(authorization._id)}`,
        status,
        priority,
        summary: denied
          ? `Authorization denial reason: ${authorization.denialReason}.`
          : expired
            ? 'Existing authorization is expired and must be refreshed before care delivery.'
            : 'Authorization is still pending and will block claim readiness.',
        nextBestAction: denied
          ? 'Route to authorization management for correction or payer follow-up.'
          : missingAuthNumber
            ? 'Work the payer and secure the auth number before the encounter.'
            : 'Monitor authorization status and escalate if the service date is approaching.',
        aiBriefing: expired
          ? 'This account is at risk of downstream denial if services continue without a fresh authorization.'
          : 'The fastest path is to close the auth gap before the patient reaches charge capture.',
        route: buildDashboardItemRoute('/rcm/prior-authorizations', 'authorization', authorization._id),
        dueAt: toIsoDate(authorization.expirationDate ?? authorization.requestDate),
        badges: [authorization.authorizationType, authorization.authorizationStatus].filter(
          (value): value is string => typeof value === 'string' && Boolean(value.trim()),
        ),
      } satisfies CommandCenterQueueItem;
    });

    const codingItems = codingDocs.map((charge) => {
      const validationErrors = Array.isArray(charge.validationErrors)
        ? charge.validationErrors.filter((item): item is string => typeof item === 'string')
        : [];
      const missingDocumentation = charge.documentationComplete === false;
      const hasValidationErrors = validationErrors.length > 0;
      const priority: QueuePriority =
        missingDocumentation || hasValidationErrors ? 'critical' : 'high';
      const status = missingDocumentation
        ? 'Missing documentation'
        : hasValidationErrors
          ? 'Charge validation failed'
          : charge.codingReviewStatus || charge.chargeStatus || 'Coding review pending';

      return {
        id: `coding-${String(charge._id)}`,
        entityType: 'charge',
        entityId: String(charge._id),
        title: getPatientLabel(patientMap, charge.patientId),
        subtitle: charge.totalChargeAmount
          ? `Charge ${shortId(charge._id)} • ${charge.totalChargeAmount}`
          : `Charge ${shortId(charge._id)}`,
        status,
        priority,
        summary: missingDocumentation
          ? 'The charge is waiting on supporting documentation before coding can be finalized.'
          : hasValidationErrors
            ? `${validationErrors.length} validation issue${validationErrors.length === 1 ? '' : 's'} are blocking release to claims.`
            : 'This charge is still moving through coding review.',
        nextBestAction: missingDocumentation
          ? 'Collect the missing documentation and return the charge to coding review.'
          : hasValidationErrors
            ? 'Resolve the validation errors and rerun the coding review workflow.'
            : 'Route to coder approval and release the clean charge set to claim creation.',
        aiBriefing: validationErrors[0]
          ? `The leading blocker is: ${validationErrors[0]}.`
          : 'This item should be reviewed before it reaches claim creation.',
        route: buildDashboardItemRoute('/rcm/charges', 'coding', charge._id),
        dueAt: toIsoDate(charge.serviceDate),
        badges: [charge.chargeStatus, charge.codingReviewStatus].filter(
          (value): value is string => typeof value === 'string' && Boolean(value.trim()),
        ),
      } satisfies CommandCenterQueueItem;
    });

    const claimItems = [
      ...claimDocs.map((claim) => {
        const scrubFailed = CLAIM_SCRUB_FAILURE_STATUSES.includes(normalizeText(claim.scrubStatus));
        const rejected = hasValue(claim.rejectionReason);
        const priority: QueuePriority = scrubFailed || rejected ? 'critical' : 'high';

        return {
          id: `claim-${String(claim._id)}`,
          entityType: 'claim',
          entityId: String(claim._id),
          title: getPatientLabel(patientMap, claim.patientId),
          subtitle: `Claim ${shortId(claim._id)}`,
          status:
            claim.scrubStatus || claim.claimStatus || claim.submissionStatus || 'Claim attention needed',
          priority,
          summary: rejected
            ? `Claim rejection reason: ${claim.rejectionReason}.`
            : scrubFailed
              ? 'Claim scrub did not pass and the claim needs correction before submission.'
              : 'Claim is still in a non-ready state and needs workflow progression.',
          nextBestAction: scrubFailed
            ? 'Send to claim correction queue, fix scrub errors, and rerun validation.'
            : rejected
              ? 'Correct the claim and resubmit or open denial workflow based on payer feedback.'
              : 'Complete claim readiness and release it to claim submission.',
          aiBriefing: scrubFailed
            ? 'The highest leverage action is fixing scrub blockers before transmission.'
            : 'This claim is lagging behind the target workflow path.',
          route: buildDashboardItemRoute('/rcm/claims', 'claims', claim._id),
          dueAt: toIsoDate(claim.claimDate),
          badges: [claim.claimStatus, claim.scrubStatus, claim.submissionStatus].filter(
            (value): value is string => typeof value === 'string' && Boolean(value.trim()),
          ),
        } satisfies CommandCenterQueueItem;
      }),
    ];

    const claimSubmissionItems = claimSubmissionDocs.map((submission) => {
      const transmissionFailure = SUBMISSION_FAILURE_STATUSES.includes(
        normalizeText(submission.transmissionStatus),
      );
      const acknowledgementFailure = SUBMISSION_FAILURE_STATUSES.includes(
        normalizeText(submission.acknowledgementStatus),
      );
      const priority: QueuePriority =
        transmissionFailure || acknowledgementFailure || hasValue(submission.submissionErrorCode)
          ? 'critical'
          : 'high';

      return {
        id: `claim-submission-${String(submission._id)}`,
        entityType: 'claim-submission',
        entityId: String(submission._id),
        title: `Submission ${shortId(submission._id)}`,
        subtitle: `Claim ${shortId(submission.claimId)}`,
        status:
          submission.acknowledgementStatus ||
          submission.transmissionStatus ||
          'Submission exception',
        priority,
        summary:
          submission.submissionErrorMessage ||
          'The clearinghouse submission did not advance cleanly through acknowledgement.',
        nextBestAction: hasValue(submission.submissionErrorCode)
          ? 'Rebuild the transmission payload and resubmit after correction.'
          : 'Track acknowledgement response and route failures to correction workflow.',
        aiBriefing: hasValue(submission.submissionErrorCode)
          ? `Submission error code ${submission.submissionErrorCode} should be resolved before retry.`
          : 'This submission should be watched closely for downstream rejection.',
        route: buildDashboardItemRoute(
          '/rcm/claim-submissions',
          'claim-submission',
          submission._id,
          { claimId: String(submission.claimId ?? '') },
        ),
        dueAt: toIsoDate(submission.submissionDateTime),
        badges: [submission.transmissionStatus, submission.acknowledgementStatus].filter(
          (value): value is string => typeof value === 'string' && Boolean(value.trim()),
        ),
      } satisfies CommandCenterQueueItem;
    });

    const claimTrackingItems = claimTrackingDocs.map((tracking) => {
      const rejected = isRejectedTrackingEvent(tracking);

      return {
        id: `claim-tracking-${String(tracking._id)}`,
        entityType: 'claim-tracking',
        entityId: String(tracking._id),
        title: `Tracking ${shortId(tracking._id)}`,
        subtitle: `Claim ${shortId(tracking.claimId)}`,
        status: tracking.statusDescription || tracking.statusCode || 'Tracking follow-up',
        priority: rejected ? 'critical' : 'high',
        summary: tracking.nextActionRequired
          ? `Next action required: ${tracking.nextActionRequired}.`
          : rejected
            ? 'The claim has rejection indicators that need follow-up.'
            : 'Claim tracking shows a workflow stop that needs review.',
        nextBestAction: rejected
          ? 'Correct or resubmit based on rejection detail, then continue tracking.'
          : 'Follow the payer next action and monitor adjudication movement.',
        aiBriefing:
          Array.isArray(tracking.rejectionReasonCodes) && tracking.rejectionReasonCodes.length
            ? `Rejection codes: ${tracking.rejectionReasonCodes.join(', ')}.`
            : 'This tracking item should stay in the live submission queue.',
        route: buildDashboardItemRoute(
          '/rcm/claim-trackings',
          'claim-tracking',
          tracking._id,
          { claimId: String(tracking.claimId ?? '') },
        ),
        dueAt: toIsoDate(tracking.receivedDate),
        badges: [tracking.statusCode, tracking.rejectionLevel, tracking.rejectionSource].filter(
          (value): value is string => typeof value === 'string' && Boolean(value.trim()),
        ),
      } satisfies CommandCenterQueueItem;
    });

    const denialItems = [
      ...denialDocs.map((denial) => {
        const preventable = denial.preventableFlag === true;

        return {
          id: `denial-${String(denial._id)}`,
          entityType: 'denial',
          entityId: String(denial._id),
          title: getPatientLabel(patientMap, denial.patientId),
          subtitle:
            [denial.denialCode, denial.denialCategory].filter(Boolean).join(' • ') ||
            `Denial ${shortId(denial._id)}`,
          status: denial.denialStatus || 'Open denial',
          priority: preventable ? 'critical' : 'high',
          summary:
            denial.denialReason ||
            denial.rootCause ||
            'The payer has denied the claim and it needs corrective action.',
          nextBestAction: denial.rootCause
            ? 'Correct the root cause and decide whether to resubmit or appeal.'
            : 'Review the denial and route it into denial management with a payer action plan.',
          aiBriefing: preventable
            ? 'This denial appears preventable and should feed future claim scrub rules.'
            : 'Use this denial to drive the next best payer follow-up or appeal decision.',
          route: buildDashboardItemRoute('/rcm/denials', 'denials', denial._id),
          dueAt: toIsoDate(denial.denialDate),
          badges: [denial.denialStatus, denial.denialCategory].filter(
            (value): value is string => typeof value === 'string' && Boolean(value.trim()),
          ),
        } satisfies CommandCenterQueueItem;
      }),
      ...appealDocs.map((appeal) => {
        const nearingDeadline =
          appeal.appealDeadline instanceof Date &&
          appeal.appealDeadline.getTime() - now.getTime() <= 48 * 60 * 60 * 1000;
        const unresolvedOutcome = !hasValue(appeal.outcome);

        return {
          id: `appeal-${String(appeal._id)}`,
          entityType: 'appeal',
          entityId: String(appeal._id),
          title: `Appeal ${shortId(appeal._id)}`,
          subtitle: [appeal.appealLevel, appeal.denialCode].filter(Boolean).join(' • ') || 'Appeal management',
          status: appeal.appealStatus || 'Appeal pending',
          priority: nearingDeadline && unresolvedOutcome ? 'critical' : 'high',
          summary:
            appeal.appealReason ||
            'Appeal is active and still awaiting submission or outcome movement.',
          nextBestAction: unresolvedOutcome
            ? 'Complete the appeal package and submit before the payer deadline.'
            : 'Review the outcome and move the account to payment posting or further follow-up.',
          aiBriefing: nearingDeadline
            ? 'Deadline pressure is high; draft the appeal package before this account rolls into AR.'
            : 'Appeal status should be monitored as part of denial recovery workflow.',
          route: buildDashboardItemRoute('/rcm/appeals', 'appeals', appeal._id),
          dueAt: toIsoDate(appeal.appealDeadline ?? appeal.submissionDate),
          badges: [appeal.appealStatus, appeal.appealLevel].filter(
            (value): value is string => typeof value === 'string' && Boolean(value.trim()),
          ),
        } satisfies CommandCenterQueueItem;
      }),
    ];

    const arItems = arDocs.map((item) => {
      const dueNow =
        item.nextFollowUpDate instanceof Date && item.nextFollowUpDate <= followUpCutoff;
      const escalationFlag = item.escalationFlag === true;
      const priority: QueuePriority = escalationFlag || dueNow ? 'critical' : 'high';

      return {
        id: `ar-${String(item._id)}`,
        entityType: 'ar-work-item',
        entityId: String(item._id),
        title: getPatientLabel(patientMap, item.patientId),
        subtitle:
          [item.category, item.agingBucket, item.balanceAmount].filter(Boolean).join(' • ') ||
          `AR ${shortId(item._id)}`,
        status: item.status || 'AR follow-up',
        priority,
        summary:
          item.rootCauseAnalysis ||
          item.suggestedFix ||
          item.reason ||
          'This account needs payer or account-level follow-up.',
        nextBestAction: item.nextAction ? String(item.nextAction) : item.correctedClaimRequired
          ? 'Prepare the corrected claim and schedule the next payer follow-up.'
          : item.appealRequired
            ? 'Launch the appeal path and keep follow-up dates current.'
            : 'Work the next best action and update follow-up history after contact.',
        aiBriefing: escalationFlag
          ? 'Escalation is active; prioritize payer follow-up or supervisor review.'
          : 'This AR item is ready for guided next-best-action follow-up.',
        route: buildDashboardItemRoute('/rcm/ar-work-items', 'ar', item._id),
        details: item,
        dueAt: toIsoDate(item.followUpDate ?? item.nextFollowUpDate ?? item.dueDate),
        badges: [item.priority, item.status, item.category, item.denialCategory].filter(
          (value): value is string => typeof value === 'string' && Boolean(value.trim()),
        ),
      } satisfies CommandCenterQueueItem;
    });

    const patientBalanceItems = [
      ...patientBillingDocs.map((billing) => {
        const overdue = billing.dueDate instanceof Date && billing.dueDate <= now;
        const inCollections = billing.collectionsFlag === true;
        const priority: QueuePriority = overdue || inCollections ? 'critical' : 'high';

        return {
          id: `patient-billing-${String(billing._id)}`,
          entityType: 'patient-billing',
          entityId: String(billing._id),
          title: getPatientLabel(patientMap, billing.patientId),
          subtitle:
            [billing.statementNumber, billing.status ?? billing.statementStatus, billing.currentBalance ?? billing.amountDue].filter(Boolean).join(' • ') ||
            `Statement ${shortId(billing._id)}`,
          status: billing.status || billing.statementStatus || 'Open balance',
          priority,
          summary: inCollections
            ? 'This balance is already flagged for collections.'
            : overdue
              ? 'Patient balance is overdue and needs statement or payment plan action.'
              : 'Patient responsibility is open and should move through statement workflow.',
          nextBestAction: inCollections
            ? 'Move the account into collection workflow or resolve the balance directly.'
            : billing.paymentPlanId
              ? 'Monitor the payment plan and follow up on missed installments.'
              : 'Generate the next statement and offer a payment plan before collections.',
          aiBriefing: overdue
            ? 'Offer a patient-friendly payment plan before the balance rolls deeper into AR.'
            : 'This balance can still be resolved in the patient billing workflow.',
          route: buildDashboardItemRoute('/rcm/patient-billings', 'patient-balance', billing._id),
          dueAt: toIsoDate(billing.dueDate ?? billing.statementDate),
          badges: [billing.status ?? billing.statementStatus, billing.agingBucket, billing.collectionsFlag ? 'Collections flag' : ''].filter(
            (value): value is string => Boolean(value),
          ),
        } satisfies CommandCenterQueueItem;
      }),
      ...collectionDocs.map((collection) => ({
        id: `collection-${String(collection._id)}`,
        entityType: 'collection',
        entityId: String(collection._id),
        title: getPatientLabel(patientMap, collection.patientId),
        subtitle:
          [collection.status ?? collection.collectionStatus, collection.collectionStage, collection.currentBalance ?? collection.balanceAmount].filter(Boolean).join(' • ') ||
          `Collection ${shortId(collection._id)}`,
        status: collection.status || collection.collectionStatus || 'Collections active',
        priority: 'critical' as QueuePriority,
        summary:
          collection.collectionStage === 'EXTERNAL_READY'
            ? 'Collection record is ready for external collections review, but no vendor integration is active.'
            : `Patient balance is ${collection.daysPastDue ?? 0} days past due with ${collection.contactAttempts ?? 0} contact attempts.`,
        nextBestAction:
          collection.nextContactDate
            ? 'Complete the scheduled collection follow-up and log the contact result.'
            : 'Assign an owner and schedule the next internal collection contact.',
        aiBriefing:
          'Use balance status and collection stage to guide communication and recovery timing.',
        route: buildDashboardItemRoute('/rcm/collections', 'collections', collection._id),
        dueAt: toIsoDate(collection.nextContactDate ?? collection.referredDate ?? collection.closeDate),
        badges: [collection.status ?? collection.collectionStatus, collection.collectionStage, collection.owner].filter(
          (value): value is string => typeof value === 'string' && Boolean(value.trim()),
        ),
      })),
    ];

    const workflowStages = [
      createStage(
        'patientAccess',
        'Patient Access',
        'Insurance verification and front-door coverage readiness.',
        buildDashboardQueueRoute('/rcm/insurance-policies', 'patient-access'),
        patientAccessCount,
        patientAccessItems,
      ),
      createStage(
        'authorization',
        'Authorizations',
        'Required approvals and auth blockers before care delivery.',
        buildDashboardQueueRoute('/rcm/prior-authorizations', 'authorization'),
        authorizationCount,
        authorizationItems,
      ),
      createStage(
        'coding',
        'Coding & Charge Review',
        'Documentation, charge quality, and coding review blockers.',
        buildDashboardQueueRoute('/rcm/charges', 'coding'),
        codingCount,
        codingItems,
      ),
      createStage(
        'claims',
        'Claims',
        'Claim scrub and claim correction blockers before transmission.',
        buildDashboardQueueRoute('/rcm/claims', 'claims'),
        claimCount,
        claimItems,
      ),
      createStage(
        'claimSubmission',
        'Claim Submissions',
        'Clearinghouse transmission and acknowledgement exceptions.',
        buildDashboardQueueRoute('/rcm/claim-submissions', 'claim-submission'),
        claimSubmissionCount,
        claimSubmissionItems,
      ),
      createStage(
        'claimTracking',
        'Claim Tracking / Rejections',
        '277CA, payer portal, and rejection follow-up exceptions after submission.',
        buildDashboardQueueRoute('/rcm/claim-trackings', 'claim-tracking'),
        claimTrackingCount,
        claimTrackingItems,
      ),
      createStage(
        'denials',
        'Denials & Appeals',
        'Active denials, appeal work, and payer dispute recovery.',
        buildDashboardQueueRoute('/rcm/denials', 'denials'),
        denialCount + appealCount,
        denialItems,
      ),
      createStage(
        'ar',
        'AR Follow-up',
        'Accounts that need next-best-action follow-up and escalation.',
        buildDashboardQueueRoute('/rcm/ar-work-items', 'ar'),
        arCount,
        arItems,
      ),
      createStage(
        'patientBalance',
        'Patient Balance',
        'Statements, payment plans, and collections pressure.',
        buildDashboardQueueRoute('/rcm/patient-billings', 'patient-balance'),
        patientBillingCount + collectionCount,
        patientBalanceItems,
      ),
    ];

    const metrics: CommandCenterMetric[] = [
      {
        key: 'total-claims',
        label: 'Total Claims',
        value: activeClaimDocs.length,
        format: 'count',
        tone: 'neutral',
        helperText: 'Active claims in the RCM workflow',
        route: buildMetricRoute('/rcm/claims', 'claims'),
      },
      {
        key: 'claims-ready',
        label: 'Ready for Submission',
        value: readyClaimCount,
        format: 'count',
        tone: buildPositiveTone(readyClaimCount),
        helperText: 'Claims with no readiness blockers detected',
        route: buildMetricRoute('/rcm/claims', 'claims-ready'),
      },
      {
        key: 'claims-blocked',
        label: 'Claims Blocked',
        value: blockedClaimCount,
        format: 'count',
        tone: buildTone(blockedClaimCount, 1, 3),
        helperText: 'Claims blocked by pricing, eligibility, coverage, auth, or referral gaps',
        route: buildMetricRoute('/rcm/claims', 'claims-blocked'),
      },
      {
        key: 'submitted-claims',
        label: 'Submitted Claims',
        value: submissionStatusCounts.SUBMITTED,
        format: 'count',
        tone: 'neutral',
        helperText: 'Latest claim submissions normalized as submitted/transmitted',
        route: buildMetricRoute('/rcm/claim-submissions', 'claim-submitted'),
      },
      {
        key: 'accepted-claims',
        label: 'Accepted Claims',
        value: submissionStatusCounts.ACCEPTED,
        format: 'count',
        tone: buildPositiveTone(submissionStatusCounts.ACCEPTED),
        helperText: 'Claim submissions acknowledged or accepted',
        route: buildMetricRoute('/rcm/claim-submissions', 'claim-accepted'),
      },
      {
        key: 'rejected-claims',
        label: 'Rejected Claims',
        value: submissionStatusCounts.REJECTED,
        format: 'count',
        tone: buildTone(submissionStatusCounts.REJECTED, 1, 3),
        helperText: 'Claim submissions or acknowledgements normalized as rejected',
        route: buildMetricRoute('/rcm/claim-submissions', 'claim-rejected'),
      },
      {
        key: 'pending-claims',
        label: 'Pending Claims',
        value: submissionStatusCounts.PENDING,
        format: 'count',
        tone: submissionStatusCounts.PENDING ? 'warning' : 'positive',
        helperText: 'Claim submissions awaiting clearinghouse or payer acknowledgement',
        route: buildMetricRoute('/rcm/claim-submissions', 'claim-pending'),
      },
      {
        key: 'failed-claims',
        label: 'Failed Claims',
        value: submissionStatusCounts.FAILED,
        format: 'count',
        tone: buildTone(submissionStatusCounts.FAILED, 1, 2),
        helperText: 'Claim submission transport or status failures',
        route: buildMetricRoute('/rcm/claim-submissions', 'claim-failed'),
      },
      {
        key: 'claim-rejection-events',
        label: 'Rejection Events',
        value: rejectedTrackingEventCount,
        format: 'count',
        tone: buildTone(rejectedTrackingEventCount, 1, 3),
        helperText: 'Normalized rejected 999, 277CA, or claim status timeline events',
        route: buildMetricRoute('/rcm/claim-trackings', 'claim-rejections'),
      },
      {
        key: 'claims-needing-follow-up',
        label: 'Need Follow-up',
        value: trackingFollowUpEventCount,
        format: 'count',
        tone: buildTone(trackingFollowUpEventCount, 1, 3),
        helperText: 'Tracking events with rejected, failed, or next-action status',
        route: buildMetricRoute('/rcm/claim-trackings', 'claim-follow-up'),
      },
      {
        key: 'missing-contract-rates',
        label: 'Missing Contract Rates',
        value: missingContractRateCount,
        format: 'count',
        tone: buildTone(missingContractRateCount, 1, 3),
        helperText: `${activeFeeScheduleDocs.length} active fee schedule records configured`,
        route: buildMetricRoute('/rcm/claims', 'missing-contract-rates'),
      },
      {
        key: 'eligibility-failures',
        label: 'Eligibility Failures',
        value: eligibilityFailureCount,
        format: 'count',
        tone: buildTone(eligibilityFailureCount, 1, 3),
        helperText: 'Claims missing fresh active EligibilityVerification records',
        route: buildMetricRoute('/rcm/claims', 'eligibility-failures'),
      },
      {
        key: 'coverage-rule-failures',
        label: 'Coverage Rule Failures',
        value: coverageRuleFailureCount,
        format: 'count',
        tone: buildTone(coverageRuleFailureCount, 1, 3),
        helperText: `${activeCoverageRuleCount} active coverage rules configured`,
        route: buildMetricRoute('/rcm/claims', 'coverage-rule-failures'),
      },
      {
        key: 'auth-missing',
        label: 'Auth Missing',
        value: authorizationMissingCount,
        format: 'count',
        tone: buildTone(authorizationMissingCount, 1, 3),
        helperText: 'Claims requiring authorization without a linked authorization',
        route: buildMetricRoute('/rcm/claims', 'auth-missing'),
      },
      {
        key: 'referral-missing',
        label: 'Referral Missing',
        value: referralMissingCount,
        format: 'count',
        tone: buildTone(referralMissingCount, 1, 3),
        helperText: 'Claims requiring referral without a linked referral',
        route: buildMetricRoute('/rcm/claims', 'referral-missing'),
      },
      {
        key: 'total-billed',
        label: 'Total Billed',
        value: totalBilledAmount,
        format: 'currency',
        tone: 'neutral',
        helperText: 'Sum of claim line billed amounts',
        route: buildMetricRoute('/rcm/claims', 'claims'),
      },
      {
        key: 'expected-allowed',
        label: 'Expected Allowed',
        value: totalExpectedAllowedAmount,
        format: 'currency',
        tone: 'neutral',
        helperText: 'Sum of claim line contract allowed snapshots',
        route: buildMetricRoute('/rcm/claims', 'claims'),
      },
      {
        key: 'expected-insurance',
        label: 'Expected Insurance',
        value: totalExpectedInsurancePayment,
        format: 'currency',
        tone: 'positive',
        helperText: 'Expected insurance payment from claim line snapshots',
        route: buildMetricRoute('/rcm/claims', 'claims'),
      },
      {
        key: 'expected-patient',
        label: 'Expected Patient',
        value: totalExpectedPatientResponsibility,
        format: 'currency',
        tone: 'warning',
        helperText: 'Expected patient responsibility from claim line snapshots',
        route: buildMetricRoute('/rcm/claims', 'claims'),
      },
      {
        key: 'era-received',
        label: 'ERAs Received',
        value: eraReceivedCount,
        format: 'count',
        tone: buildPositiveTone(eraReceivedCount),
        helperText: '835 ERA import records received into payment posting',
        route: buildMetricRoute('/rcm/era-eob-processings', 'era-received'),
      },
      {
        key: 'payments-posted',
        label: 'Payments Posted',
        value: paymentsPostedCount,
        format: 'count',
        tone: buildPositiveTone(paymentsPostedCount),
        helperText: 'Payment postings created from matched 835 ERA claims',
        route: buildMetricRoute('/rcm/payment-postings', 'payments-posted'),
      },
      {
        key: 'unmatched-eras',
        label: 'Unmatched ERAs',
        value: unmatchedEraCount,
        format: 'count',
        tone: buildTone(unmatchedEraCount, 1, 3),
        helperText: 'ERA claim payments that need claim or line matching review',
        route: buildMetricRoute('/rcm/era-eob-processings', 'unmatched-eras'),
      },
      {
        key: 'total-paid',
        label: 'Total Paid',
        value: totalPaidAmount,
        format: 'currency',
        tone: buildPositiveTone(totalPaidAmount),
        helperText: 'Posted payer payment dollars from 835 ERA imports',
        route: buildMetricRoute('/rcm/payment-postings', 'payments-posted'),
      },
      {
        key: 'total-adjustments',
        label: 'Total Adjustments',
        value: totalAdjustmentAmount,
        format: 'currency',
        tone: totalAdjustmentAmount ? 'warning' : 'neutral',
        helperText: 'Payer, contractual, patient responsibility, and denial-related CAS adjustments stored from ERA lines',
        route: buildMetricRoute('/rcm/adjustments', 'era-adjustments'),
      },
      {
        key: 'underpaid-claims',
        label: 'Underpaid Claims',
        value: underpaidClaimCount,
        format: 'count',
        tone: buildTone(underpaidClaimCount, 1, 3),
        helperText: 'Claims where ERA payment is below expected insurance and lines balance',
        route: buildMetricRoute('/rcm/claims', 'underpaid-claims'),
      },
      {
        key: 'ar-total-balance',
        label: 'AR Balance',
        value: arTotalBalance,
        format: 'currency',
        tone: arTotalBalance > 0 ? 'warning' : 'positive',
        helperText: 'Open AR follow-up balance from payer and variance work items',
        route: buildMetricRoute('/rcm/ar-work-items', 'ar-total-balance'),
      },
      {
        key: 'open-ar-work-items',
        label: 'Open AR Items',
        value: openArDocs.length,
        format: 'count',
        tone: buildTone(openArDocs.length, 2, 5),
        helperText: 'Open payer follow-up, denial rework, appeal, corrected claim, and variance items',
        route: buildMetricRoute('/rcm/ar-work-items', 'open-ar-work-items'),
      },
      {
        key: 'underpayment-amount',
        label: 'Underpayment Amount',
        value: underpaymentAmount,
        format: 'currency',
        tone: underpaymentAmount > 0 ? 'critical' : 'positive',
        helperText: 'Expected insurance minus actual payer paid amount on open underpayment work items',
        route: buildMetricRoute('/rcm/ar-work-items', 'underpayment-amount'),
      },
      ...Object.entries(arAgingBuckets).map(([bucket, value]) => ({
        key: `ar-aging-${bucket.replace('+', 'plus')}`,
        label: `AR ${bucket}`,
        value,
        format: 'count' as const,
        tone: bucket.includes('91') || bucket.includes('120') ? 'critical' as const : buildTone(value, 2, 5),
        helperText: `Open AR work items in aging bucket ${bucket}`,
        route: buildMetricRoute('/rcm/ar-work-items', `ar-aging-${bucket}`),
      })),
      {
        key: 'patient-balance-total',
        label: 'Patient Balance',
        value: patientBalanceTotal,
        format: 'currency',
        tone: patientBalanceTotal > 0 ? 'warning' : 'positive',
        helperText: 'Finalized post-ERA patient responsibility still outstanding',
        route: buildMetricRoute('/rcm/patient-billings', 'patient-balance-total'),
      },
      {
        key: 'patient-statements-ready',
        label: 'Statements Ready',
        value: patientStatementsReadyCount,
        format: 'count',
        tone: patientStatementsReadyCount ? 'warning' : 'neutral',
        helperText: 'Patient billing records ready for statement workflow',
        route: buildMetricRoute('/rcm/patient-billings', 'statements-ready'),
      },
      {
        key: 'overdue-patient-balances',
        label: 'Overdue Balances',
        value: overduePatientBalanceCount,
        format: 'count',
        tone: buildTone(overduePatientBalanceCount, 1, 3),
        helperText: 'Patient balances past due date and eligible for configured collections evaluation',
        route: buildMetricRoute('/rcm/patient-billings', 'overdue-balances'),
      },
      {
        key: 'refund-pending-review',
        label: 'Refund Review',
        value: refundPendingReviewCount,
        format: 'count',
        tone: refundPendingReviewCount ? 'warning' : 'positive',
        helperText: 'Patient overpayment refund candidates pending manual review',
        route: buildMetricRoute('/rcm/refunds', 'pending-review'),
      },
      {
        key: 'collections-active',
        label: 'Active Collections',
        value: activeCollectionDocs.length,
        format: 'count',
        tone: buildTone(activeCollectionDocs.length, 1, 3),
        helperText: 'Internal collection workflows currently active or ready for escalation',
        route: buildMetricRoute('/rcm/collections', 'collections-active'),
      },
      {
        key: 'collections-recovered',
        label: 'Collections Recovered',
        value: collectionsRecoveredAmount,
        format: 'currency',
        tone: buildPositiveTone(collectionsRecoveredAmount),
        helperText: 'Recovered or settled amount recorded on collection workflows',
        route: buildMetricRoute('/rcm/collections', 'collections-recovered'),
      },
      {
        key: 'collection-write-offs',
        label: 'Collection Write-offs',
        value: collectionWriteOffAmount,
        format: 'currency',
        tone: collectionWriteOffAmount > 0 ? 'warning' : 'positive',
        helperText: 'Collection balances written off through auditable adjustment workflow',
        route: buildMetricRoute('/rcm/collections', 'collection-write-offs'),
      },
      {
        key: 'open-denials',
        label: 'Open Denials',
        value: openDenialDocs.length,
        format: 'count',
        tone: buildTone(openDenialDocs.length, 1, 3),
        helperText: 'Unresolved denials created from ERA/payment outcomes',
        route: buildMetricRoute('/rcm/denials', 'open-denials'),
      },
      {
        key: 'denial-amount',
        label: 'Denial Amount',
        value: openDenialAmount,
        format: 'currency',
        tone: openDenialAmount > 0 ? 'critical' : 'positive',
        helperText: 'Total unresolved denied amount',
        route: buildMetricRoute('/rcm/denials', 'denial-amount'),
      },
      {
        key: 'preventable-denials',
        label: 'Preventable Denials',
        value: preventableDenialCount,
        format: 'count',
        tone: buildTone(preventableDenialCount, 1, 3),
        helperText: 'Open denials flagged as preventable',
        route: buildMetricRoute('/rcm/denials', 'preventable-denials'),
      },
      {
        key: 'corrected-claim-ready',
        label: 'Corrected Ready',
        value: correctedClaimReadyCount,
        format: 'count',
        tone: correctedClaimReadyCount ? 'warning' : 'neutral',
        helperText: 'Denials ready for corrected claim handoff without auto-submission',
        route: buildMetricRoute('/rcm/denials', 'corrected-claim-ready'),
      },
      {
        key: 'appeal-ready',
        label: 'Appeal Ready',
        value: appealReadyCount,
        format: 'count',
        tone: appealReadyCount ? 'warning' : 'neutral',
        helperText: 'Denials marked ready for appeal review only',
        route: buildMetricRoute('/rcm/denials', 'appeal-ready'),
      },
      {
        key: 'corrected-claims-pending',
        label: 'Corrected Pending',
        value: correctedClaimsPendingCount,
        format: 'count',
        tone: correctedClaimsPendingCount ? 'warning' : 'neutral',
        helperText: 'Corrected claim records waiting on corrections, readiness, or resubmission',
        route: buildMetricRoute('/rcm/corrected-claims', 'corrected-claims-pending'),
      },
      {
        key: 'corrected-claims-submitted',
        label: 'Corrected Submitted',
        value: correctedClaimsSubmittedCount,
        format: 'count',
        tone: buildPositiveTone(correctedClaimsSubmittedCount),
        helperText: 'Corrected claim records submitted through the existing claim submission lifecycle',
        route: buildMetricRoute('/rcm/corrected-claims', 'corrected-claims-submitted'),
      },
      {
        key: 'appeals-pending',
        label: 'Appeals Pending',
        value: appealsPendingCount,
        format: 'count',
        tone: appealsPendingCount ? 'warning' : 'neutral',
        helperText: 'Appeals in draft, ready, submitted, or pending status',
        route: buildMetricRoute('/rcm/appeals', 'appeals-pending'),
      },
      {
        key: 'appeals-overturned',
        label: 'Appeals Overturned',
        value: appealsOverturnedCount,
        format: 'count',
        tone: buildPositiveTone(appealsOverturnedCount),
        helperText: 'Appeals with payer response recorded as overturned',
        route: buildMetricRoute('/rcm/appeals', 'appeals-overturned'),
      },
      {
        key: 'appeals-upheld',
        label: 'Appeals Upheld',
        value: appealsUpheldCount,
        format: 'count',
        tone: buildTone(appealsUpheldCount, 1, 3),
        helperText: 'Appeals with payer response recorded as upheld',
        route: buildMetricRoute('/rcm/appeals', 'appeals-upheld'),
      },
      {
        key: 'denial-recovery-rate',
        label: 'Denial Recovery %',
        value: denialRecoveryRate,
        format: 'count',
        tone: denialRecoveryRate > 0 ? 'positive' : 'neutral',
        helperText: 'Operational recovery signal from resolved denials, submitted corrected claims, and overturned appeals',
        route: buildMetricRoute('/rcm/denials', 'denial-recovery-rate'),
      },
      {
        key: 'preventable-denial-recovery',
        label: 'Preventable Recovery %',
        value: preventableDenialRecoveryRate,
        format: 'count',
        tone: preventableDenialRecoveryRate > 0 ? 'positive' : 'neutral',
        helperText: 'Preventable denial recovery rate from resolved preventable denial records',
        route: buildMetricRoute('/rcm/denials', 'preventable-denial-recovery'),
      },
      {
        key: 'reopened-claims',
        label: 'Reopened Claims',
        value: reopenedClaimsCount,
        format: 'count',
        tone: reopenedClaimsCount ? 'warning' : 'neutral',
        helperText: 'Original denials reopened into corrected claim clones',
        route: buildMetricRoute('/rcm/corrected-claims', 'reopened-claims'),
      },
      ...Object.entries(denialCategoryCounts).map(([category, value]) => ({
        key: `denials-category-${category.toLowerCase().replace(/_/g, '-')}`,
        label: `${category.replace(/_/g, ' ')} Denials`,
        value,
        format: 'count' as const,
        tone: buildTone(value, 1, 3),
        helperText: `Open denials classified as ${category}`,
        route: buildMetricRoute('/rcm/denials', `denial-category-${category.toLowerCase()}`),
      })),
      ...Object.entries(denialAgingBuckets).map(([bucket, value]) => ({
        key: `denials-aging-${bucket.replace('+', 'plus')}`,
        label: `Denials ${bucket}`,
        value,
        format: 'count' as const,
        tone: buildTone(value, 2, 5),
        helperText: `Open denial aging bucket ${bucket} days`,
        route: buildMetricRoute('/rcm/denials', `denial-aging-${bucket}`),
      })),
      {
        key: 'patient-access',
        label: 'Eligibility Risk',
        value: eligibilityFailureCount,
        format: 'count',
        tone: buildTone(eligibilityFailureCount, 1, 3),
        helperText: 'Claim eligibility gaps from EligibilityVerification records',
        route: buildMetricRoute('/rcm/claims', 'eligibility-failures'),
      },
      {
        key: 'authorization',
        label: 'Pending Authorizations',
        value: authorizationCount,
        format: 'count',
        tone: buildTone(authorizationCount, 1, 3),
        helperText: 'Accounts blocked on auth approval or follow-up',
        route: buildMetricRoute('/rcm/prior-authorizations', 'authorization'),
      },
      {
        key: 'coding',
        label: 'Coding Queue',
        value: codingCount,
        format: 'count',
        tone: buildTone(codingCount, 2, 4),
        helperText: 'Charges waiting on documentation, validation, or coder review',
        route: buildMetricRoute('/rcm/charges', 'coding'),
      },
      {
        key: 'claims',
        label: 'Claims at Risk',
        value: claimCount + claimSubmissionCount + claimTrackingCount,
        format: 'count',
        tone: buildTone(claimCount + claimSubmissionCount + claimTrackingCount, 2, 5),
        helperText: 'Claims stuck in scrub, submission, or tracking',
        route: buildMetricRoute('/rcm/claims', 'claims'),
      },
      {
        key: 'denials',
        label: 'Denials / Appeals',
        value: denialCount + appealCount,
        format: 'count',
        tone: buildTone(denialCount + appealCount, 1, 3),
        helperText: 'Open payer disputes and active appeal workload',
        route: buildMetricRoute('/rcm/denials', 'denials'),
      },
      {
        key: 'ar',
        label: 'AR Follow-ups',
        value: arCount,
        format: 'count',
        tone: buildTone(arCount, 1, 3),
        helperText: 'Accounts due for payer contact or escalation',
        route: buildMetricRoute('/rcm/ar-work-items', 'ar'),
      },
      {
        key: 'patient-balance',
        label: 'Patient Balance Work',
        value: patientBillingCount + collectionCount,
        format: 'count',
        tone: buildTone(patientBillingCount + collectionCount, 2, 5),
        helperText: 'Statements, payment plans, and collection queue pressure',
        route: buildMetricRoute('/rcm/patient-billings', 'patient-balance'),
      },
    ];

    const aiInsights = [
      patientAccessCount > 0
        ? {
            id: 'eligibility-front-door',
            title: 'Front-door coverage risk is building in patient access',
            summary: `${patientAccessCount} policies need verification or correction before they reach care delivery and claims.`,
            severity:
              patientAccessItems.some((item) => item.priority === 'critical')
                ? 'critical'
                : ('warning' as InsightSeverity),
            route: buildDashboardQueueRoute('/rcm/insurance-policies', 'patient-access'),
            actionLabel: 'Review patient access',
          }
        : null,
      authorizationCount > 0
        ? {
            id: 'authorization-lag',
            title: 'Authorization lag is the current care-delivery blocker',
            summary: `${authorizationCount} authorization records are still pending, denied, or expired and need action before services continue.`,
            severity:
              authorizationItems.some((item) => item.priority === 'critical')
                ? 'critical'
                : ('warning' as InsightSeverity),
            route: buildDashboardQueueRoute('/rcm/prior-authorizations', 'authorization'),
            actionLabel: 'Work authorizations',
          }
        : null,
      claimCount + claimSubmissionCount + claimTrackingCount > 0
        ? {
            id: 'claim-pressure',
            title: 'Claim correction pressure is showing up before adjudication',
            summary: `${claimCount + claimSubmissionCount + claimTrackingCount} claims are failing scrub, submission, or tracking and should be corrected before they compound into denials.`,
            severity:
              claimItems.some((item) => item.priority === 'critical')
                ? 'critical'
                : ('warning' as InsightSeverity),
            route: buildDashboardQueueRoute('/rcm/claims', 'claims'),
            actionLabel: 'Open claims queue',
          }
        : null,
      blockedClaimCount > 0
        ? {
            id: 'claim-readiness-blockers',
            title: 'Readiness blockers are preventing claim submission',
            summary: `${blockedClaimCount} claims are blocked by pricing, eligibility, coverage rule, authorization, or referral readiness checks.`,
            severity: blockedClaimCount >= 3 ? 'critical' : ('warning' as InsightSeverity),
            route: buildDashboardQueueRoute('/rcm/claims', 'claims-blocked'),
            actionLabel: 'Review blocked claims',
          }
        : null,
      unmatchedEraCount > 0
        ? {
            id: 'leakage-unmatched-era',
            title: 'Revenue leakage alert: unmatched ERA payments',
            summary: `${unmatchedEraCount} ERA imports include unmatched claim or service-line payments that cannot be posted cleanly.`,
            severity: 'warning' as InsightSeverity,
            route: buildDashboardQueueRoute('/rcm/era-eob-processings', 'unmatched-eras'),
            actionLabel: 'Resolve ERA matching',
          }
        : null,
      underpaymentAmount > 0
        ? {
            id: 'leakage-underpayments',
            title: 'Revenue leakage alert: underpayments require review',
            summary: `Open underpayment work items represent ${underpaymentAmount.toFixed(2)} in expected-to-paid variance.`,
            severity: 'critical' as InsightSeverity,
            route: buildDashboardQueueRoute('/rcm/ar-work-items', 'underpayment-amount'),
            actionLabel: 'Work underpayments',
          }
        : null,
      overduePatientBalanceCount > 0 || activeCollectionDocs.length > 0
        ? {
            id: 'patient-balance-collections-pressure',
            title: 'Patient balance and collections pressure is active',
            summary: `${overduePatientBalanceCount} patient balances are overdue and ${activeCollectionDocs.length} collection records are active.`,
            severity: activeCollectionDocs.length > 0 ? 'critical' as InsightSeverity : 'warning' as InsightSeverity,
            route: buildDashboardQueueRoute('/rcm/collections', 'collections'),
            actionLabel: 'Review collections',
          }
        : null,
    ]
      .filter((item): item is CommandCenterInsight => Boolean(item))
      .sort((firstItem, secondItem) => {
        const severityWeight = {
          critical: 0,
          warning: 1,
          info: 2,
        };

        return severityWeight[firstItem.severity] - severityWeight[secondItem.severity];
      });

    const unifiedWorkQueue = workflowStages
      .flatMap((stage) =>
        stage.items.map((item) => ({
          type: item.entityType,
          owner: item.badges.find((badge) => String(badge).startsWith('owner:')) ?? undefined,
          priority: item.priority,
          dueDate: item.dueAt,
          aging: item.badges.find((badge) => /^\d/.test(String(badge))) ?? undefined,
          amountAtRisk: item.subtitle?.match(/\d+(\.\d+)?/)?.[0] ? Number(item.subtitle.match(/\d+(\.\d+)?/)?.[0]) : undefined,
          nextAction: item.nextBestAction,
          route: item.route,
          sourceStage: stage.key,
          entityId: item.entityId,
          title: item.title,
          status: item.status,
          details: (item as any).details ?? undefined,
        })),
      )
      .sort((left, right) => {
        const priorityOrder: Record<QueuePriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[left.priority] - priorityOrder[right.priority];
      })
      .slice(0, 50);

    return {
      generatedAt: now.toISOString(),
      refreshIntervalSeconds: REALTIME_REFRESH_INTERVAL_SECONDS,
      metrics,
      workflowStages,
      aiInsights,
      unifiedWorkQueue,
      claimReadiness: prioritizedClaimReadinessRows,
      recentClaimActivity,
    };
  },
};
