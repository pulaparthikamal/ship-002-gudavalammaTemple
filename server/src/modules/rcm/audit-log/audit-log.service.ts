import mongoose, { ClientSession } from 'mongoose';
import { AuditLog } from './audit-log.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { Appointment } from '../appointment/appointment.model';
import { Encounter } from '../encounter/encounter.model';
import { Charge } from '../charge/charge.model';
import { CodingReview } from '../coding-review/coding-review.model';
import { Claim } from '../claim/claim.model';
import { EraEobProcessing } from '../era-eob-processing/era-eob-processing.model';
import { Payer } from '../payer/payer.model';
import { Facility } from '../facility/facility.model';

const SENSITIVE_KEY_PATTERN = /(raw|payload|x12|835|837|member|subscriber|ssn|social|dob|birth|address|phone|email|api[_-]?key|token|secret|password|authorization|name|firstName|lastName)/i;
const VISIBLE_AUDIT_VISIBILITIES = ['COMPLIANCE_VISIBLE', 'OPERATIONAL_VISIBLE'];
const TECHNICAL_DEBUG_ACTIONS = new Set([
  'QUEUE_JOB_DUPLICATE_IGNORED',
  'QUEUE_JOB_CREATED',
  'QUEUE_JOB_STARTED',
  'QUEUE_JOB_COMPLETED',
  'QUEUE_JOB_RETRIED',
  'QUEUE_STALE_JOB_RECOVERED',
  'DUPLICATE_WEBHOOK_IGNORED',
]);

function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[REDACTED_DEPTH]';
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => sanitizeForAudit(item, depth + 1));
  if (typeof value !== 'object') return value;

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((safe, [key, nestedValue]) => {
    safe[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : sanitizeForAudit(nestedValue, depth + 1);
    return safe;
  }, {});
}

function parseDate(value: unknown, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return undefined;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

function buildListCriteria(query: any = {}) {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const limit = Math.min(250, Math.max(1, Number(query.limit ?? 25) || 25));
  const dateFrom = parseDate(query.dateFrom);
  const dateTo = parseDate(query.dateTo, true);
  const defaultDateFrom = new Date();
  defaultDateFrom.setDate(defaultDateFrom.getDate() - 30);
  const filter: Record<string, unknown> = { isDeleted: false };

  for (const field of [
    'entityType',
    'action',
    'userId',
    'claimId',
    'appointmentId',
    'submissionId',
    'financialEventId',
    'correlationId',
    'severity',
    'category',
    'visibility',
    'source',
    'payerId',
    'patientId',
  ]) {
    if (typeof query[field] === 'string' && query[field].trim()) {
      filter[field] = ['severity', 'category', 'visibility'].includes(field)
        ? query[field].trim().toUpperCase()
        : query[field].trim();
    }
  }

  if (!filter.visibility && query.includeTechnical !== 'true' && query.includeTechnical !== true) {
    filter.visibility = { $in: VISIBLE_AUDIT_VISIBILITIES };
  }

  if (typeof query.user === 'string' && query.user.trim()) {
    filter.$or = [
      { userId: query.user.trim() },
      { userName: { $regex: query.user.trim(), $options: 'i' } },
      { changedBy: { $regex: query.user.trim(), $options: 'i' } },
    ];
  }

  if (typeof query.entityId === 'string' && query.entityId.trim()) {
    filter.entityId = query.entityId.trim();
  }
  if (typeof query.denial === 'string' && query.denial.trim()) {
    filter.entityType = 'denial';
    filter.entityId = query.denial.trim();
  }
  if (typeof query.appeal === 'string' && query.appeal.trim()) {
    filter.entityType = 'appeal';
    filter.entityId = query.appeal.trim();
  }
  if (dateFrom || dateTo || query.defaultDateRange !== 'none') {
    filter.timestamp = {
      ...(dateFrom ? { $gte: dateFrom } : { $gte: defaultDateFrom }),
      ...(dateTo ? { $lte: dateTo } : {}),
    };
  }
  if (typeof query.search === 'string' && query.search.trim()) {
    const search = query.search.trim();
    const searchClause = {
      $or: [
        { entityType: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } },
        { source: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { severity: { $regex: search, $options: 'i' } },
        { correlationId: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
      ],
    };
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, searchClause];
      delete filter.$or;
    } else {
      Object.assign(filter, searchClause);
    }
  }

  return {
    filter,
    page,
    limit,
    sorting: { timestamp: -1 as const, created: -1 as const },
  };
}

function toAuditAction(action: string) {
  return action.trim().toUpperCase().replace(/\s+/g, '_');
}

function deriveAuditCategory(action: string, entityType?: string) {
  const combined = `${action} ${entityType ?? ''}`.toUpperCase();
  if (combined.includes('APPOINTMENT')) return 'APPOINTMENT';
  if (combined.includes('SUBMISSION') || combined.includes('ACK') || combined.includes('TRACKING')) return 'SUBMISSION';
  if (combined.includes('WEBHOOK') || combined.includes('CLEARINGHOUSE')) return 'CLEARINGHOUSE';
  if (combined.includes('ERA') || combined.includes('835')) return 'ERA';
  if (combined.includes('PAYMENT') || combined.includes('FINANCIAL')) return 'PAYMENT';
  if (combined.includes('DENIAL')) return 'DENIAL';
  if (combined.includes('APPEAL')) return 'APPEAL';
  if (combined.includes('AR_') || combined.includes('ARWORK') || combined.includes('WORK_ITEM')) return 'AR';
  if (combined.includes('BILLING') || combined.includes('STATEMENT')) return 'BILLING';
  if (combined.includes('REFUND')) return 'REFUND';
  if (combined.includes('COLLECTION')) return 'COLLECTION';
  if (combined.includes('QUEUE')) return 'QUEUE';
  if (combined.includes('CLOSE') || combined.includes('REOPEN')) return 'CLOSURE';
  if (combined.includes('SECURITY') || combined.includes('AUTH')) return 'SECURITY';
  if (/\bAI\b|AI_|_AI/.test(combined)) return 'AI';
  return 'CLAIM';
}

function deriveAuditSeverity(action: string, explicit?: string) {
  if (explicit) return explicit.trim().toUpperCase();
  if (action.includes('CRITICAL')) return 'CRITICAL';
  if (action.includes('FAILED') || action.includes('REJECTED') || action.includes('DEAD_LETTER') || action.includes('ERROR')) return 'ERROR';
  if (action.includes('DENIAL') || action.includes('REVERSED') || action.includes('IMBALANCE') || action.includes('WARNING') || action.includes('EXCEPTION')) return 'WARNING';
  return 'INFO';
}

function deriveAuditVisibility(action: string, severity: string, explicit?: string) {
  if (explicit) return explicit.trim().toUpperCase();
  if (TECHNICAL_DEBUG_ACTIONS.has(action)) return 'TECHNICAL_DEBUG_ONLY';
  if (severity === 'ERROR' || severity === 'CRITICAL') return 'OPERATIONAL_VISIBLE';
  if (
    action.includes('CLOSED')
    || action.includes('REOPENED')
    || action.includes('SUBMITTED')
    || action.includes('ACK_')
    || action.includes('ERA_IMPORTED')
    || action.includes('PAYMENT_POSTED')
    || action.includes('PAYMENT_REVERSED')
    || action.includes('DENIAL')
    || action.includes('APPEAL')
    || action.includes('REFUND')
    || action.includes('COLLECTION')
    || action.includes('WEBHOOK_REJECTED')
  ) {
    return 'COMPLIANCE_VISIBLE';
  }
  return 'OPERATIONAL_VISIBLE';
}

function buildTimelineGroups(events: any[]) {
  const groups: Record<string, unknown[]> = {
    claim: [],
    readiness: [],
    submission: [],
    acknowledgementTracking: [],
    era: [],
    payment: [],
    denial: [],
    appeal: [],
    correctedClaim: [],
    ar: [],
    patientBilling: [],
    refund: [],
    collection: [],
    closure: [],
    appointment: [],
    encounter: [],
    charge: [],
    codingReview: [],
    other: [],
  };

  for (const item of events) {
    const entityType = String(item.entityType ?? '').toLowerCase();
    const action = String(item.action ?? '').toUpperCase();
    const category = String(item.category ?? '').toUpperCase();
    if (entityType.includes('appointment') || category === 'APPOINTMENT') groups.appointment.push(item);
    else if (entityType.includes('encounter')) groups.encounter.push(item);
    else if (entityType.includes('charge')) groups.charge.push(item);
    else if (entityType.includes('coding')) groups.codingReview.push(item);
    else if (action.includes('READINESS')) groups.readiness.push(item);
    else if (action.includes('CLOSE') || action.includes('REOPEN') || category === 'CLOSURE') groups.closure.push(item);
    else if (entityType.includes('denial') || category === 'DENIAL') groups.denial.push(item);
    else if (entityType.includes('appeal') || category === 'APPEAL') groups.appeal.push(item);
    else if (entityType.includes('corrected') || action.includes('CORRECTED')) groups.correctedClaim.push(item);
    else if (entityType.includes('ar') || category === 'AR') groups.ar.push(item);
    else if (entityType.includes('billing') || category === 'BILLING') groups.patientBilling.push(item);
    else if (entityType.includes('refund') || category === 'REFUND') groups.refund.push(item);
    else if (entityType.includes('collection') || category === 'COLLECTION') groups.collection.push(item);
    else if (entityType.includes('payment') || category === 'PAYMENT') groups.payment.push(item);
    else if (entityType.includes('submission') || category === 'SUBMISSION') groups.submission.push(item);
    else if (action.includes('ACK') || action.includes('TRACKING')) groups.acknowledgementTracking.push(item);
    else if (entityType.includes('era') || category === 'ERA') groups.era.push(item);
    else if (entityType.includes('claim')) groups.claim.push(item);
    else groups.other.push(item);
  }

  return groups;
}

const TIMELINE_SECTION_ORDER = [
  { section: 'Appointment', keys: ['appointment'] },
  { section: 'Encounter', keys: ['encounter'] },
  { section: 'Charge / Coding', keys: ['charge', 'codingReview', 'readiness'] },
  { section: 'Claim', keys: ['claim'] },
  { section: 'Submission / ACK', keys: ['submission', 'acknowledgementTracking'] },
  { section: 'ERA / Payment', keys: ['era', 'payment'] },
  { section: 'Denial / Appeal', keys: ['denial', 'appeal', 'correctedClaim', 'ar'] },
  { section: 'Patient Balance', keys: ['patientBilling', 'refund', 'collection'] },
  { section: 'Closure', keys: ['closure'] },
  { section: 'Other', keys: ['other'] },
];

function buildTimelineSections(groups: Record<string, any[]>) {
  return TIMELINE_SECTION_ORDER.map(({ section, keys }) => ({
    section,
    events: keys.flatMap((key) => groups[key] ?? []).sort(sortByTimestampAsc),
  })).filter((group) => group.events.length);
}

function sortByTimestampAsc(left: any, right: any) {
  return new Date(left.timestamp ?? left.createdAt ?? left.created ?? 0).getTime()
    - new Date(right.timestamp ?? right.createdAt ?? right.created ?? 0).getTime();
}

function idString(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value);
}

function objectIdOrUndefined(value: unknown) {
  const text = idString(value);
  return text && mongoose.Types.ObjectId.isValid(text) ? new mongoose.Types.ObjectId(text) : undefined;
}

function idQueryValues(values: unknown[]) {
  const normalized = new Map<string, unknown>();
  for (const value of values) {
    const text = idString(value);
    if (!text) continue;
    normalized.set(`str:${text}`, text);
    if (mongoose.Types.ObjectId.isValid(text)) {
      normalized.set(`oid:${text}`, new mongoose.Types.ObjectId(text));
    }
  }
  return Array.from(normalized.values());
}

function claimMatchedEraFilter(claimIds: unknown[]) {
  const values = idQueryValues(claimIds);
  return {
    isDeleted: false,
    $or: [
      { 'matchedClaims.claimId': { $in: values } },
      { 'matchedClaims.internalClaimId': { $in: values } },
      { 'matchedClaims.claimObjectId': { $in: values } },
    ],
  };
}

function buildSummaryPagination(query: any = {}) {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25) || 25));
  return { page, limit };
}

function buildVisibleAuditMatch(query: any = {}) {
  const criteria = buildListCriteria({
    ...query,
    page: 1,
    limit: 1,
    defaultDateRange: query.defaultDateRange ?? 'none',
  });
  delete criteria.filter.timestamp;
  delete criteria.filter.entityType;
  delete criteria.filter.entityId;
  delete criteria.filter.claimId;
  delete criteria.filter.appointmentId;
  delete criteria.filter.patientId;
  delete criteria.filter.payerId;
  delete criteria.filter.financialEventId;
  delete criteria.filter.submissionId;
  delete criteria.filter.correlationId;
  delete criteria.filter.action;
  delete criteria.filter.category;
  delete criteria.filter.severity;
  return criteria.filter;
}

function isRiskAuditEvent(item: any) {
  const severity = String(item.severity ?? '').toUpperCase();
  const action = String(item.action ?? '').toUpperCase();
  return ['WARNING', 'ERROR', 'CRITICAL'].includes(severity)
    || action.includes('DENIAL')
    || action.includes('REJECTED')
    || action.includes('FAILED')
    || action.includes('EXCEPTION')
    || action.includes('IMBALANCE')
    || action.includes('UNSUPPORTED');
}

function maxSeverity(events: any[]) {
  if (!events.length) return 'INFO';
  if (events.some((item) => String(item.severity).toUpperCase() === 'CRITICAL')) return 'CRITICAL';
  if (events.some((item) => String(item.severity).toUpperCase() === 'ERROR')) return 'ERROR';
  if (events.some((item) => String(item.severity).toUpperCase() === 'WARNING')) return 'WARNING';
  return 'INFO';
}

function lastEvent(events: any[]) {
  return [...events].sort((left, right) =>
    new Date(right.timestamp ?? right.createdAt ?? right.created ?? 0).getTime()
    - new Date(left.timestamp ?? left.createdAt ?? left.created ?? 0).getTime()
  )[0];
}

function stageFromAppointment(appointment: any, encounter?: any, charge?: any, claim?: any) {
  if (claim?.closureStatus === 'CLOSED') return 'Closure';
  if (claim?.paymentStatus || claim?.financialLedgerSequence > 0) return 'Payment';
  if (claim?.submissionStatus && claim.submissionStatus !== 'Not Submitted') return 'Submission';
  if (claim) return 'Claim';
  if (charge?.codingReviewStatus && charge.codingReviewStatus !== 'Not Started') return 'Coding Review';
  if (charge) return 'Charge';
  if (encounter) return 'Encounter';
  if (appointment?.checkInStatus && appointment.checkInStatus !== 'Pending') return 'Check-In';
  return 'Appointment';
}

function matchesSummaryQuery(row: any, query: any = {}) {
  if (query.severity && String(row.severity).toUpperCase() !== String(query.severity).toUpperCase()) return false;
  if (query.status && String(row.status).toLowerCase() !== String(query.status).toLowerCase()) return false;
  if (query.currentStage && String(row.currentStage).toLowerCase() !== String(query.currentStage).toLowerCase()) return false;
  if (query.hasOpenRisks === 'true' || query.hasOpenRisks === true) return row.openRiskCount > 0;
  if (query.hasOpenRisks === 'false' || query.hasOpenRisks === false) return row.openRiskCount === 0;
  return true;
}

function paginateRows(rows: any[], query: any = {}) {
  const { page, limit } = buildSummaryPagination(query);
  const sorted = [...rows].sort((left, right) =>
    new Date(right.lastUpdatedAt ?? 0).getTime() - new Date(left.lastUpdatedAt ?? 0).getTime()
  );
  const totalCount = sorted.length;
  return {
    data: sorted.slice((page - 1) * limit, page * limit),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    },
  };
}

function hasPersistedEvent(events: any[], entityType: string, entityId: unknown, action: string) {
  return events.some((item) =>
    String(item.entityType ?? '').toLowerCase() === entityType.toLowerCase()
    && String(item.entityId ?? '') === String(entityId)
    && String(item.action ?? '').toUpperCase() === action
  );
}

function derivedAuditEvent(params: {
  entityType: string;
  entityId: unknown;
  action: string;
  timestamp?: unknown;
  appointmentId?: unknown;
  claimId?: unknown;
  patientId?: unknown;
  payerId?: string;
  status?: string;
  previousState?: unknown;
  newState?: unknown;
  reason?: string;
  source?: string;
  correlationId?: string;
}) {
  const action = toAuditAction(params.action);
  const timestamp = parseDate(params.timestamp) ?? new Date(0);
  const severity = deriveAuditSeverity(action);
  const category = deriveAuditCategory(action, params.entityType);
  return {
    _id: `derived:${params.entityType}:${String(params.entityId)}:${action}`,
    entityType: params.entityType,
    entityId: params.entityId,
    action,
    timestamp,
    created: timestamp,
    updated: timestamp,
    appointmentId: params.appointmentId,
    claimId: params.claimId,
    patientId: params.patientId,
    payerId: params.payerId,
    status: params.status,
    severity,
    category,
    visibility: 'OPERATIONAL_VISIBLE',
    source: params.source ?? 'derivedLifecycle',
    correlationId: params.correlationId ?? (params.claimId ? String(params.claimId) : undefined),
    reason: params.reason ?? 'Derived from existing RCM lifecycle record because no persisted audit event was recorded at the time.',
    previousState: sanitizeForAudit(params.previousState),
    newState: sanitizeForAudit({
      ...(typeof params.newState === 'object' && params.newState !== null ? params.newState as Record<string, unknown> : {}),
      derivedLifecycleMarker: true,
    }),
    derived: true,
  };
}

function appendDerivedEvent(events: any[], params: Parameters<typeof derivedAuditEvent>[0]) {
  const action = toAuditAction(params.action);
  if (hasPersistedEvent(events, params.entityType, params.entityId, action)) return;
  events.push(derivedAuditEvent({ ...params, action }));
}

function appendDerivedLifecycleEvents(events: any[], context: {
  appointment?: any;
  encounters?: any[];
  charges?: any[];
  codingReviews?: any[];
  claims?: any[];
}) {
  const { appointment, encounters = [], charges = [], codingReviews = [], claims = [] } = context;
  const appointmentId = appointment?._id;
  if (appointment) {
    appendDerivedEvent(events, {
      entityType: 'appointment',
      entityId: appointment._id,
      action: 'APPOINTMENT_CREATED',
      timestamp: appointment.created ?? appointment.appointmentDate ?? appointment.appointmentStart,
      appointmentId,
      patientId: appointment.patientId,
      status: appointment.appointmentStatus,
      newState: {
        appointmentStatus: appointment.appointmentStatus,
        checkInStatus: appointment.checkInStatus,
        appointmentDate: appointment.appointmentDate,
        appointmentStart: appointment.appointmentStart,
      },
    });
    if (appointment.checkInStatus && appointment.checkInStatus !== 'Pending') {
      appendDerivedEvent(events, {
        entityType: 'appointment',
        entityId: appointment._id,
        action: 'APPOINTMENT_CHECK_IN_UPDATED',
        timestamp: appointment.checkInTime ?? appointment.updated,
        appointmentId,
        patientId: appointment.patientId,
        status: appointment.checkInStatus,
        newState: {
          checkInStatus: appointment.checkInStatus,
          checkInTime: appointment.checkInTime,
        },
      });
    }
  }

  for (const encounter of encounters) {
    appendDerivedEvent(events, {
      entityType: 'encounter',
      entityId: encounter._id,
      action: 'ENCOUNTER_CREATED',
      timestamp: encounter.created ?? encounter.encounterDate ?? encounter.startTime,
      appointmentId: encounter.appointmentId ?? appointmentId,
      patientId: encounter.patientId,
      status: encounter.visitStatus,
      newState: {
        visitStatus: encounter.visitStatus,
        encounterDate: encounter.encounterDate,
        startTime: encounter.startTime,
        endTime: encounter.endTime,
      },
    });
    if (encounter.visitStatus && String(encounter.visitStatus).toLowerCase() !== 'created') {
      appendDerivedEvent(events, {
        entityType: 'encounter',
        entityId: encounter._id,
        action: 'ENCOUNTER_STATUS_UPDATED',
        timestamp: encounter.updated ?? encounter.endTime ?? encounter.startTime,
        appointmentId: encounter.appointmentId ?? appointmentId,
        patientId: encounter.patientId,
        status: encounter.visitStatus,
        newState: {
          visitStatus: encounter.visitStatus,
          endTime: encounter.endTime,
        },
      });
    }
  }

  for (const charge of charges) {
    appendDerivedEvent(events, {
      entityType: 'charge',
      entityId: charge._id,
      action: 'CHARGE_CREATED',
      timestamp: charge.created ?? charge.serviceDate,
      appointmentId,
      patientId: charge.patientId,
      status: charge.chargeStatus,
      newState: {
        chargeStatus: charge.chargeStatus,
        codingReviewStatus: charge.codingReviewStatus,
        totalChargeAmount: charge.totalChargeAmount,
      },
    });
    if (charge.chargeStatus && String(charge.chargeStatus).toLowerCase() !== 'draft') {
      appendDerivedEvent(events, {
        entityType: 'charge',
        entityId: charge._id,
        action: 'CHARGE_STATUS_UPDATED',
        timestamp: charge.updated ?? charge.serviceDate,
        appointmentId,
        patientId: charge.patientId,
        status: charge.chargeStatus,
        newState: {
          chargeStatus: charge.chargeStatus,
          codingReviewStatus: charge.codingReviewStatus,
        },
      });
    }
  }

  for (const codingReview of codingReviews) {
    appendDerivedEvent(events, {
      entityType: 'codingReview',
      entityId: codingReview._id,
      action: 'CODING_REVIEW_CREATED',
      timestamp: codingReview.created,
      appointmentId,
      patientId: codingReview.patientId,
      status: codingReview.scrubStatus,
      newState: {
        scrubStatus: codingReview.scrubStatus,
        codingRiskLevel: codingReview.codingRiskLevel,
      },
    });
    if (codingReview.scrubStatus && String(codingReview.scrubStatus).toLowerCase() !== 'pending') {
      appendDerivedEvent(events, {
        entityType: 'codingReview',
        entityId: codingReview._id,
        action: 'CODING_REVIEW_STATUS_UPDATED',
        timestamp: codingReview.reviewedAt ?? codingReview.updated,
        appointmentId,
        patientId: codingReview.patientId,
        status: codingReview.scrubStatus,
        newState: {
          scrubStatus: codingReview.scrubStatus,
          codingRiskLevel: codingReview.codingRiskLevel,
          reviewedAt: codingReview.reviewedAt,
        },
      });
    }
  }

  for (const claim of claims) {
    appendDerivedEvent(events, {
      entityType: 'claim',
      entityId: claim._id,
      action: 'CLAIM_CREATED',
      timestamp: claim.created ?? claim.claimDate,
      appointmentId,
      claimId: claim._id,
      patientId: claim.patientId,
      payerId: claim.payerId,
      status: claim.claimStatus,
      newState: {
        claimStatus: claim.claimStatus,
        submissionStatus: claim.submissionStatus,
        paymentStatus: claim.paymentStatus,
        closureStatus: claim.closureStatus,
      },
    });
    if (
      claim.closureStatus === 'CLOSED'
      && !events.some((item) =>
        String(item.action ?? '').toUpperCase() === 'CLAIM_CLOSED'
        && (
          String(item.claimId ?? '') === String(claim._id)
          || String(item.entityId ?? '') === String(claim._id)
        )
      )
    ) {
      appendDerivedEvent(events, {
        entityType: 'claimClosure',
        entityId: claim._id,
        action: 'CLAIM_CLOSED',
        timestamp: claim.closedAt ?? claim.updated,
        appointmentId,
        claimId: claim._id,
        patientId: claim.patientId,
        payerId: claim.payerId,
        status: claim.closureStatus,
        newState: {
          closureStatus: claim.closureStatus,
          paymentStatus: claim.paymentStatus,
          closedAt: claim.closedAt,
        },
      });
    }
  }
}

export const auditLogService = {
  async record(data: {
    entityType: string;
    entityId?: unknown;
    action: string;
    userId?: unknown;
    userName?: string;
    previousState?: unknown;
    newState?: unknown;
    reason?: string;
    source?: string;
    ipAddress?: string;
    correlationId?: string;
    claimId?: unknown;
    submissionId?: unknown;
    financialEventId?: unknown;
    appointmentId?: unknown;
    patientId?: unknown;
    payerId?: string;
    severity?: string;
    category?: string;
    visibility?: string;
    status?: string;
    userAgent?: string;
    changedBy?: string;
    sourceModule?: string;
    metadata?: Record<string, unknown>;
    session?: ClientSession;
  }) {
    const timestamp = new Date();
    const action = toAuditAction(data.action);
    const severity = deriveAuditSeverity(action, data.severity);
    const category = (data.category ?? deriveAuditCategory(action, data.entityType)).trim().toUpperCase();
    const visibility = deriveAuditVisibility(action, severity, data.visibility);
    if (process.env.NODE_ENV === 'test' && mongoose.connection.readyState !== 1) {
      return {
        _id: `audit-${Date.now()}`,
        entityType: data.entityType,
        entityId: data.entityId,
        action,
        severity,
        category,
        visibility,
        appointmentId: data.appointmentId,
        previousState: sanitizeForAudit(data.previousState),
        newState: sanitizeForAudit(data.newState),
        timestamp,
      } as any;
    }
    const [item] = await AuditLog.create([{
      entityType: data.entityType,
      entityId: data.entityId,
      action,
      userId: data.userId,
      userName: data.userName,
      previousState: sanitizeForAudit(data.previousState),
      newState: sanitizeForAudit(data.newState),
      reason: data.reason,
      source: data.source ?? data.sourceModule ?? 'RCM',
      ipAddress: data.ipAddress,
      correlationId: data.correlationId ?? (data.claimId ? String(data.claimId) : undefined),
      claimId: data.claimId,
      submissionId: data.submissionId,
      financialEventId: data.financialEventId,
      appointmentId: data.appointmentId,
      patientId: data.patientId,
      payerId: data.payerId,
      severity,
      category,
      visibility,
      status: data.status,
      userAgent: data.userAgent,
      redactionVersion: 'v1',
      retentionClass: 'RCM_AUDIT',
      changedBy: data.changedBy ?? (data.userId ? String(data.userId) : undefined),
      sourceModule: data.sourceModule,
      timestamp,
      active: true,
      created: timestamp,
      updated: timestamp,
      createdBy: data.userId as any,
      updatedBy: data.userId as any,
      isDeleted: false,
    }], { session: data.session });

    publishRcmRealtimeEvent({
      eventType: 'AUDIT_LOG_RECORDED',
      title: 'Audit log recorded',
      message: `${item.action} recorded for ${item.entityType}.`,
      entityType: 'auditLog',
      entityId: String(item._id),
      claimId: data.claimId ? String(data.claimId) : undefined,
      status: item.action,
    });

    return item;
  },

  async list(query: any = {}) {
    const criteria = buildListCriteria(query);
    const [items, totalCount] = await Promise.all([
      AuditLog.find(criteria.filter)
        .sort(criteria.sorting)
        .skip((criteria.page - 1) * criteria.limit)
        .limit(criteria.limit)
        .lean(),
      AuditLog.countDocuments(criteria.filter),
    ]);
    return {
      data: items,
      pagination: {
        page: criteria.page,
        limit: criteria.limit,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / criteria.limit)),
      },
    };
  },

  async getById(id: string, locale: string) {
    const item = await AuditLog.findOne({ _id: id, isDeleted: false }).lean();

    if (!item) {
      throw new AppError(t('auditLog.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async getByEntity(entityType: string, entityId: string, query: any = {}) {
    return this.list({
      ...query,
      entityType,
      entityId,
    });
  },

  async getAppointmentSummaries(query: any = {}) {
    const appointmentFilter: Record<string, unknown> = { isDeleted: false };
    const dateFrom = parseDate(query.dateFrom);
    const dateTo = parseDate(query.dateTo, true);
    const appointmentObjectId = objectIdOrUndefined(query.appointmentId);
    const patientObjectId = objectIdOrUndefined(query.patientId);
    const providerObjectId = objectIdOrUndefined(query.providerId);
    const facilityObjectId = objectIdOrUndefined(query.facilityId);

    if (appointmentObjectId) {
      appointmentFilter.$or = [{ _id: appointmentObjectId }, { appointmentId: appointmentObjectId }];
    }
    if (patientObjectId) appointmentFilter.patientId = patientObjectId;
    if (providerObjectId) appointmentFilter.providerId = providerObjectId;
    if (facilityObjectId) appointmentFilter.facilityId = facilityObjectId;
    if (query.status) appointmentFilter.appointmentStatus = String(query.status);
    if (dateFrom || dateTo) {
      appointmentFilter.appointmentDate = {
        ...(dateFrom ? { $gte: dateFrom } : {}),
        ...(dateTo ? { $lte: dateTo } : {}),
      };
    }

    const appointments = await Appointment.find(appointmentFilter).sort({ appointmentDate: -1, updated: -1 }).limit(5000).lean();
    const appointmentIds = appointments.map((item: any) => item._id).filter(Boolean);
    if (!appointmentIds.length) return paginateRows([], query);

    const encounters = await Encounter.find({ appointmentId: { $in: appointmentIds }, isDeleted: false }).lean();
    const encounterByAppointment = new Map(encounters.map((item: any) => [String(item.appointmentId), item]));
    const encounterIds = encounters.map((item: any) => item._id).filter(Boolean);
    const chargesForEncounters = await Charge.find({ encounterId: { $in: encounterIds }, isDeleted: false }).lean();
    const chargeByEncounter = new Map(chargesForEncounters.map((item: any) => [String(item.encounterId), item]));
    const chargeIds = chargesForEncounters.map((item: any) => item._id).filter(Boolean);
    const codingReviews = await CodingReview.find({
      isDeleted: false,
      $or: [
        { encounterId: { $in: encounterIds } },
        { chargeId: { $in: chargeIds } },
      ],
    }).lean();
    const codingReviewByCharge = new Map(codingReviews.map((item: any) => [String(item.chargeId), item]));
    const codingReviewIds = codingReviews.map((item: any) => item._id).filter(Boolean);
    const claims = await Claim.find({
      isDeleted: false,
      $or: [
        { encounterId: { $in: encounterIds } },
        { chargeId: { $in: chargeIds } },
      ],
      ...(query.claimId && objectIdOrUndefined(query.claimId)
        ? { _id: objectIdOrUndefined(query.claimId) }
        : {}),
      ...(query.payerId ? { payerId: String(query.payerId) } : {}),
    }).lean();
    const claimByEncounter = new Map(claims.map((item: any) => [String(item.encounterId), item]));
    const eras = claims.length
      ? await EraEobProcessing.find(claimMatchedEraFilter(claims.map((item: any) => item._id))).lean()
      : [];
    const eraIds = eras.map((item: any) => item._id).filter(Boolean);
    const eraIdsByClaim = new Map<string, string[]>();
    for (const era of eras) {
      for (const matchedClaim of era.matchedClaims ?? []) {
        const matchedClaimId = idString(matchedClaim?.claimId ?? matchedClaim?.internalClaimId ?? matchedClaim?.claimObjectId);
        if (!matchedClaimId) continue;
        eraIdsByClaim.set(matchedClaimId, [...(eraIdsByClaim.get(matchedClaimId) ?? []), String(era._id)]);
      }
    }
    const relatedEntityIds = [
      ...appointmentIds,
      ...encounterIds,
      ...chargeIds,
      ...codingReviewIds,
      ...eraIds,
      ...claims.map((item: any) => item._id).filter(Boolean),
    ];
    const relatedEntityIdValues = idQueryValues(relatedEntityIds);
    const appointmentIdValues = idQueryValues(appointmentIds);
    const claimIdValues = idQueryValues(claims.map((item: any) => item._id).filter(Boolean));

    const auditBase = buildVisibleAuditMatch(query);
    const auditMatch = {
      ...auditBase,
      $or: [
        { appointmentId: { $in: appointmentIdValues } },
        { entityId: { $in: relatedEntityIdValues } },
        { claimId: { $in: claimIdValues } },
      ],
    };
    const events = await AuditLog.find(auditMatch).sort({ timestamp: -1 }).limit(20000).lean();

    const rows = appointments.map((appointment: any) => {
      const encounter = encounterByAppointment.get(String(appointment._id));
      const charge = encounter ? chargeByEncounter.get(String(encounter._id)) : undefined;
      const codingReview = charge ? codingReviewByCharge.get(String(charge._id)) : undefined;
      const claim = encounter ? claimByEncounter.get(String(encounter._id)) : undefined;
      const rowEraIds = claim ? eraIdsByClaim.get(String(claim._id)) ?? [] : [];
      const rowEvents = events.filter((event: any) =>
        String(event.appointmentId ?? '') === String(appointment._id)
        || String(event.entityId ?? '') === String(appointment._id)
        || (!!encounter && String(event.entityId ?? '') === String(encounter._id))
        || (!!charge && String(event.entityId ?? '') === String(charge._id))
        || (!!codingReview && String(event.entityId ?? '') === String(codingReview._id))
        || rowEraIds.includes(String(event.entityId ?? ''))
        || (!!claim && String(event.claimId ?? '') === String(claim._id))
      );
      appendDerivedLifecycleEvents(rowEvents, {
        appointment,
        encounters: encounter ? [encounter] : [],
        charges: charge ? [charge] : [],
        codingReviews: codingReview ? [codingReview] : [],
        claims: claim ? [claim] : [],
      });
      const latest = lastEvent(rowEvents);
      const severity = maxSeverity(rowEvents);
      const openRiskCount = rowEvents.filter(isRiskAuditEvent).length;
      return {
        appointmentId: String(appointment._id),
        appointmentDate: appointment.appointmentStart ?? appointment.appointmentDate,
        patientReference: idString(appointment.patientId),
        encounterId: idString(encounter?._id),
        chargeId: idString(charge?._id),
        claimId: idString(claim?._id),
        currentStage: stageFromAppointment(appointment, encounter, charge, claim),
        currentClaimStatus: claim?.claimStatus,
        lastAuditAction: latest?.action,
        lastUpdatedAt: latest?.timestamp ?? appointment.updated ?? appointment.appointmentDate,
        eventCount: rowEvents.length,
        openRiskCount,
        status: openRiskCount > 0 ? 'Needs Review' : appointment.appointmentStatus,
        severity,
      };
    }).filter((row) => matchesSummaryQuery(row, query));

    return paginateRows(rows, query);
  },

  async getClaimSummaries(query: any = {}) {
    const claimFilter: Record<string, unknown> = { isDeleted: false };
    const dateFrom = parseDate(query.dateFrom);
    const dateTo = parseDate(query.dateTo, true);
    const claimObjectId = objectIdOrUndefined(query.claimId);
    const patientObjectId = objectIdOrUndefined(query.patientId);
    const providerObjectId = objectIdOrUndefined(query.providerId);
    const facilityObjectId = objectIdOrUndefined(query.facilityId);

    const claimIdFilters: Record<string, unknown>[] = [];
    const statusFilters: Record<string, unknown>[] = [];
    if (claimObjectId) claimIdFilters.push({ _id: claimObjectId }, { claimId: claimObjectId });
    if (patientObjectId) claimFilter.patientId = patientObjectId;
    if (query.payerId) claimFilter.payerId = String(query.payerId);
    if (providerObjectId) claimFilter.renderingProviderId = providerObjectId;
    if (facilityObjectId) claimFilter.facilityId = facilityObjectId;
    if (query.status) {
      statusFilters.push(
        { claimStatus: String(query.status) },
        { submissionStatus: String(query.status) },
        { paymentStatus: String(query.status) },
        { closureStatus: String(query.status) }
      );
    }
    if (claimIdFilters.length && statusFilters.length) {
      claimFilter.$and = [{ $or: claimIdFilters }, { $or: statusFilters }];
    } else if (claimIdFilters.length) {
      claimFilter.$or = claimIdFilters;
    } else if (statusFilters.length) {
      claimFilter.$or = statusFilters;
    }
    if (dateFrom || dateTo) {
      claimFilter.claimDate = {
        ...(dateFrom ? { $gte: dateFrom } : {}),
        ...(dateTo ? { $lte: dateTo } : {}),
      };
    }

    const claims = await Claim.find(claimFilter).sort({ updated: -1, claimDate: -1 }).limit(5000).lean();
    const claimIds = claims.map((item: any) => String(item._id));
    const claimIdValues = idQueryValues(claims.map((item: any) => item._id));
    if (!claimIds.length) return paginateRows([], query);

    const [payers, facilities, events] = await Promise.all([
      Payer.find({ payerId: { $in: claims.map((item: any) => item.payerId).filter(Boolean) }, isDeleted: false }).lean(),
      Facility.find({ _id: { $in: claims.map((item: any) => item.facilityId).filter(Boolean) }, isDeleted: false }).lean(),
      AuditLog.find({ ...buildVisibleAuditMatch(query), claimId: { $in: claimIdValues } }).sort({ timestamp: -1 }).limit(20000).lean(),
    ]);
    const payerById = new Map(payers.map((item: any) => [String(item.payerId), item]));
    const facilityById = new Map(facilities.map((item: any) => [String(item._id), item]));

    const rows = claims.map((claim: any) => {
      const rowEvents = events.filter((event: any) => String(event.claimId) === String(claim._id));
      const latest = lastEvent(rowEvents);
      const severity = maxSeverity(rowEvents);
      const openRiskCount = rowEvents.filter(isRiskAuditEvent).length;
      return {
        claimId: String(claim._id),
        patientReference: idString(claim.patientId),
        payerName: payerById.get(String(claim.payerId))?.payerName ?? claim.payerId,
        facilityName: facilityById.get(String(claim.facilityId))?.facilityName ?? idString(claim.facilityId),
        claimStatus: claim.claimStatus,
        submissionStatus: claim.submissionStatus,
        paymentStatus: claim.paymentStatus,
        closureStatus: claim.closureStatus,
        lastAuditAction: latest?.action,
        lastUpdatedAt: latest?.timestamp ?? claim.updated ?? claim.claimDate,
        eventCount: rowEvents.length,
        openRiskCount,
        status: openRiskCount > 0 ? 'Needs Review' : claim.closureStatus ?? claim.claimStatus,
        severity,
      };
    }).filter((row) => matchesSummaryQuery(row, query));

    return paginateRows(rows, query);
  },

  async getClaimTimeline(claimId: string, query: any = {}) {
    if (process.env.NODE_ENV === 'test' && mongoose.connection.readyState !== 1) {
      const result = await this.list({
        ...query,
        claimId,
        page: 1,
        limit: Math.min(5000, Math.max(Number(query.limit ?? 5000) || 5000, 1)),
      });
      const events = [...(result.data as any[])].sort(sortByTimestampAsc);
      const groups = buildTimelineGroups(events);

      return {
        claimId,
        correlationIds: Array.from(new Set(events.map((item) => item.correlationId).filter(Boolean))),
        groups,
        sections: buildTimelineSections(groups),
        events,
        pagination: result.pagination,
      };
    }

    const criteria = buildListCriteria({
      ...query,
      page: 1,
      limit: Math.min(5000, Math.max(Number(query.limit ?? 5000) || 5000, 1)),
    });
    const claimIdValues = idQueryValues([claimId]);
    const eras = await EraEobProcessing.find(claimMatchedEraFilter([claimId])).lean();
    const eraIdValues = idQueryValues(eras.map((item: any) => item._id).filter(Boolean));
    const filter = {
      ...criteria.filter,
      $or: [
        { claimId: { $in: claimIdValues } },
        { entityId: { $in: [...claimIdValues, ...eraIdValues] } },
      ],
    };
    const [items, totalCount] = await Promise.all([
      AuditLog.find(filter).sort({ timestamp: 1, created: 1 }).limit(criteria.limit).lean(),
      AuditLog.countDocuments(filter),
    ]);
    const events = [...items].sort(sortByTimestampAsc);
    const groups = buildTimelineGroups(events);

    return {
      claimId,
      correlationIds: Array.from(new Set(events.map((item) => item.correlationId).filter(Boolean).map(String))),
      groups,
      sections: buildTimelineSections(groups),
      events,
      pagination: {
        page: 1,
        limit: criteria.limit,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / criteria.limit)),
      },
    };
  },

  async getAppointmentTimeline(appointmentId: string, query: any = {}) {
    if (process.env.NODE_ENV === 'test' && mongoose.connection.readyState !== 1) {
      const result = await this.list({
        ...query,
        appointmentId,
        page: 1,
        limit: Math.min(5000, Math.max(Number(query.limit ?? 5000) || 5000, 1)),
      });
      const events = [...(result.data as any[])].sort(sortByTimestampAsc);
      const groups = buildTimelineGroups(events);
      return {
        appointmentId,
        claimIds: Array.from(new Set(events.map((item) => item.claimId).filter(Boolean).map(String))),
        correlationIds: Array.from(new Set(events.map((item) => item.correlationId).filter(Boolean).map(String))),
        groups,
        sections: buildTimelineSections(groups),
        events,
        pagination: result.pagination,
      };
    }

    const appointmentObjectId = objectIdOrUndefined(appointmentId);
    let appointment: any;
    let encounters: any[] = [];
    let charges: any[] = [];
    let codingReviews: any[] = [];
    let claims: any[] = [];
    if (appointmentObjectId && mongoose.connection.readyState === 1) {
      appointment = await Appointment.findOne({
        isDeleted: false,
        $or: [{ _id: appointmentObjectId }, { appointmentId: appointmentObjectId }],
      }).lean();
      encounters = await Encounter.find({ appointmentId: appointmentObjectId, isDeleted: false }).lean();
      const encounterIds = encounters.map((item: any) => item._id).filter(Boolean);
      charges = await Charge.find({ encounterId: { $in: encounterIds }, isDeleted: false }).lean();
      const chargeIds = charges.map((item: any) => item._id).filter(Boolean);
      codingReviews = await CodingReview.find({
        isDeleted: false,
        $or: [
          { encounterId: { $in: encounterIds } },
          { chargeId: { $in: chargeIds } },
        ],
      }).lean();
      claims = await Claim.find({
        isDeleted: false,
        $or: [
          { encounterId: { $in: encounterIds } },
          { chargeId: { $in: chargeIds } },
        ],
      }).lean();
    }
    const encounterIds = encounters.map((item: any) => item._id).filter(Boolean);
    const chargeIds = charges.map((item: any) => item._id).filter(Boolean);
    const codingReviewIds = codingReviews.map((item: any) => item._id).filter(Boolean);
    const relatedClaimIds = claims.map((item: any) => String(item._id));
    const eras = claims.length
      ? await EraEobProcessing.find(claimMatchedEraFilter(claims.map((item: any) => item._id))).lean()
      : [];
    const eraIds = eras.map((item: any) => item._id).filter(Boolean);
    const relatedEntityIds = [
      appointmentId,
      ...(appointmentObjectId ? [appointmentObjectId] : []),
      ...encounterIds,
      ...chargeIds,
      ...codingReviewIds,
      ...eraIds,
      ...claims.map((item: any) => item._id).filter(Boolean),
    ];
    const appointmentIdValues = idQueryValues([appointmentId, ...(appointmentObjectId ? [appointmentObjectId] : [])]);
    const relatedEntityIdValues = idQueryValues(relatedEntityIds);
    const relatedClaimIdValues = idQueryValues(claims.map((item: any) => item._id).filter(Boolean));

    const criteria = buildListCriteria({
      ...query,
      page: 1,
      limit: Math.min(5000, Math.max(Number(query.limit ?? 5000) || 5000, 1)),
    });
    const filter = {
      ...criteria.filter,
      $or: [
        { appointmentId: { $in: appointmentIdValues } },
        { entityId: { $in: relatedEntityIdValues } },
        ...(relatedClaimIdValues.length ? [{ claimId: { $in: relatedClaimIdValues } }] : []),
      ],
    };
    const [items, totalCount] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: 1, created: 1 })
        .limit(criteria.limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    const events = [...items].sort(sortByTimestampAsc);
    appendDerivedLifecycleEvents(events, {
      appointment,
      encounters,
      charges,
      codingReviews,
      claims,
    });
    events.sort(sortByTimestampAsc);
    const groups = buildTimelineGroups(events);

    return {
      appointmentId,
      claimIds: Array.from(new Set(events.map((item) => item.claimId).filter(Boolean).map(String))),
      correlationIds: Array.from(new Set(events.map((item) => item.correlationId).filter(Boolean).map(String))),
      groups,
      sections: buildTimelineSections(groups),
      events,
      pagination: {
        page: 1,
        limit: criteria.limit,
        totalCount: Math.max(totalCount, events.length),
        totalPages: Math.max(1, Math.ceil(Math.max(totalCount, events.length) / criteria.limit)),
      },
    };
  },

  async create(data: any, locale: string, createdBy: string) {
    return this.record({
      ...data,
      userId: data.userId ?? createdBy,
      changedBy: data.changedBy ?? createdBy,
    });
  },

  async update() {
    throw new AppError('Audit logs are append-only and cannot be updated.', HTTP_STATUS.METHOD_NOT_ALLOWED);
  },

  async softDelete() {
    throw new AppError('Audit logs are append-only and cannot be deleted.', HTTP_STATUS.METHOD_NOT_ALLOWED);
  },

  sanitizeForAudit,

  async export(query: any = {}) {
    const result = await this.list({ ...query, page: 1, limit: 5000 });
    const columns = [
      'timestamp',
      'severity',
      'category',
      'visibility',
      'entityType',
      'entityId',
      'claimId',
      'appointmentId',
      'action',
      'source',
      'userId',
      'userName',
      'changedBy',
      'reason',
      'correlationId',
      'payerId',
      'patientId',
      'financialEventId',
    ];
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const metadata = [
      `generatedAt,${new Date().toISOString()}`,
      `filters,${escape(JSON.stringify(sanitizeForAudit(query)))}`,
      '',
    ];
    const rows = result.data.map((item: any) => columns.map((column) => escape(item[column])).join(','));
    return {
      fileName: 'rcm-audit-logs.csv',
      contentType: 'text/csv',
      content: [...metadata, columns.join(','), ...rows].join('\n'),
    };
  },
};
