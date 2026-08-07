import { Claim } from '../claim/claim.model';
import { ClaimSubmission } from '../claim-submission/claim-submission.model';
import { ClaimTracking } from '../claim-tracking/claim-tracking.model';
import { CodingReview } from '../coding-review/coding-review.model';
import { PaymentPosting } from '../payment-posting/payment-posting.model';
import { PatientPayment } from '../patient-payment/patient-payment.model';
import { Adjustment } from '../adjustment/adjustment.model';
import { PatientBilling } from '../patient-billing/patient-billing.model';
import { ArWorkItem } from '../ar-work-item/ar-work-item.model';
import { Denial } from '../denial/denial.model';
import { Appeal } from '../appeal/appeal.model';
import { CorrectedClaim } from '../corrected-claim/corrected-claim.model';
import { Collection } from '../collection/collection.model';
import { EraEobProcessing } from '../era-eob-processing/era-eob-processing.model';
import { EraException } from '../era-exception/era-exception.model';
import { Refund } from '../refund/refund.model';
import { FinancialEvent } from '../financial-event/financial-event.model';
import { RcmBackgroundJob } from '../background-job/background-job.model';
import { getRcmQueueHealth } from '../background-job/rcm-queue.service';
import { ReportSnapshot } from './report-snapshot.model';
import { AuditLog } from '../audit-log/audit-log.model';
import { TimelyFilingAlert } from '../timely-filing-alert/timely-filing-alert.model';
import { createHash } from 'crypto';
import mongoose from 'mongoose';

const ACTIVE_RECORD_FILTER = { isDeleted: false, active: { $ne: false } };
const CLOSED_STATUSES = new Set(['CLOSED', 'RESOLVED', 'WRITTEN_OFF', 'CANCELLED', 'VOIDED', 'PROCESSED']);

type ReportKind =
  | 'dashboard'
  | 'claims'
  | 'financial'
  | 'denials'
  | 'appeals'
  | 'ar'
  | 'patient-billing'
  | 'productivity'
  | 'realtime'
  | 'claim-closure'
  | 'financial-risk'
  | 'timely-filing'
  | 'ai-operations';

type ReportFilters = {
  dateFrom?: Date;
  dateTo?: Date;
  claimId?: string;
  patientId?: string;
  payerId?: string;
  providerId?: string;
  facilityId?: string;
  status?: string;
  denialStatus?: string;
  appealStatus?: string;
  arStatus?: string;
  closureStatus?: string;
  riskType?: string;
  exceptionType?: string;
  financialEventId?: string;
  correlationId?: string;
  page: number;
  limit: number;
  drillDown?: string;
};

const REPORT_CACHE_TTL_MS = 60_000;

function getNumber(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizeStatus(value: unknown) {
  return String(value ?? '').trim().toUpperCase();
}

function toIsoDate(value: unknown) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
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

function parseFilters(query: any = {}): ReportFilters {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const maxLimit = query.exportAll === 'true' || query.exportAll === true ? 5000 : 250;
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit ?? 25) || 25));
  const text = (key: string) => typeof query[key] === 'string' && query[key].trim() ? query[key].trim() : undefined;
  return {
    dateFrom: parseDate(query.dateFrom),
    dateTo: parseDate(query.dateTo, true),
    claimId: text('claimId'),
    patientId: text('patientId'),
    payerId: text('payerId'),
    providerId: text('providerId'),
    facilityId: text('facilityId'),
    status: text('status'),
    denialStatus: text('denialStatus'),
    appealStatus: text('appealStatus'),
    arStatus: text('arStatus'),
    closureStatus: text('closureStatus'),
    riskType: text('riskType'),
    exceptionType: text('exceptionType'),
    financialEventId: text('financialEventId'),
    correlationId: text('correlationId'),
    page,
    limit,
    drillDown: text('drillDown'),
  };
}

function filterHash(kind: ReportKind, filters: ReportFilters) {
  return createHash('sha256')
    .update(JSON.stringify({
      kind,
      dateFrom: filters.dateFrom?.toISOString(),
      dateTo: filters.dateTo?.toISOString(),
      claimId: filters.claimId,
      patientId: filters.patientId,
      payerId: filters.payerId,
      providerId: filters.providerId,
      facilityId: filters.facilityId,
      status: filters.status,
      denialStatus: filters.denialStatus,
      appealStatus: filters.appealStatus,
      arStatus: filters.arStatus,
      closureStatus: filters.closureStatus,
      riskType: filters.riskType,
      exceptionType: filters.exceptionType,
      financialEventId: filters.financialEventId,
      correlationId: filters.correlationId,
      page: filters.page,
      limit: filters.limit,
      drillDown: filters.drillDown,
    }))
    .digest('hex');
}

function dateFilter(filters: ReportFilters, field = 'created') {
  if (!filters.dateFrom && !filters.dateTo) return {};
  return {
    [field]: {
      ...(filters.dateFrom ? { $gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { $lte: filters.dateTo } : {}),
    },
  };
}

function paginate<T>(items: T[], filters: ReportFilters) {
  const start = (filters.page - 1) * filters.limit;
  return {
    rows: items.slice(start, start + filters.limit),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      totalCount: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / filters.limit)),
    },
  };
}

function average(values: number[]) {
  const usable = values.filter((value) => Number.isFinite(value) && value >= 0);
  return usable.length ? Math.round((usable.reduce((total, value) => total + value, 0) / usable.length) * 10) / 10 : 0;
}

function daysBetween(start?: Date, end?: Date) {
  if (!start || !end) return null;
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return null;
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
}

function sumBy<T>(items: T[], getter: (item: T) => unknown) {
  return Math.round(items.reduce((total, item) => total + getNumber(getter(item)), 0) * 100) / 100;
}

function countBy<T>(items: T[], getter: (item: T) => unknown) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = normalizeStatus(getter(item)) || 'UNSPECIFIED';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function amountBy<T>(items: T[], keyGetter: (item: T) => unknown, amountGetter: (item: T) => unknown) {
  return items.reduce<Record<string, number>>((totals, item) => {
    const key = normalizeStatus(keyGetter(item)) || 'UNSPECIFIED';
    totals[key] = Math.round(((totals[key] ?? 0) + getNumber(amountGetter(item))) * 100) / 100;
    return totals;
  }, {});
}

function trendByDate<T>(items: T[], dateGetter: (item: T) => unknown, amountGetter?: (item: T) => unknown) {
  const buckets = items.reduce<Record<string, { date: string; count: number; amount: number }>>((totals, item) => {
    const date = toIsoDate(dateGetter(item)) || 'undated';
    totals[date] = totals[date] ?? { date, count: 0, amount: 0 };
    totals[date].count += 1;
    totals[date].amount = Math.round((totals[date].amount + (amountGetter ? getNumber(amountGetter(item)) : 0)) * 100) / 100;
    return totals;
  }, {});
  return Object.values(buckets).sort((left, right) => left.date.localeCompare(right.date));
}

function claimLineAllowed(claim: any) {
  return sumBy(claim.claimLines ?? [], (line: any) => line.expectedAllowedAmount);
}

function claimLineInsuranceExpected(claim: any) {
  return sumBy(claim.claimLines ?? [], (line: any) => line.expectedInsurancePayment);
}

function claimLinePatientExpected(claim: any) {
  return sumBy(claim.claimLines ?? [], (line: any) => line.expectedPatientResponsibility);
}

function amountFromDenial(denial: any) {
  return getNumber(denial.remainingDeniedBalance ?? denial.denialBalance ?? denial.denialAmount ?? denial.adjustmentAmount);
}

function originalDeniedAmount(denial: any) {
  return getNumber(denial.denialAmount ?? denial.adjustmentAmount ?? denial.originalDeniedAmount);
}

function remainingDeniedAmount(denial: any) {
  return getNumber(denial.remainingDeniedBalance ?? denial.denialBalance ?? 0);
}

function postingAllowedAmount(posting: any) {
  const lineAllowed = sumBy(posting.paymentLines ?? [], (line: any) => line.allowedAmount);
  return lineAllowed || getNumber((posting as any).allowedAmount);
}

function agingBucket(dateValue: unknown) {
  const date = dateValue instanceof Date ? dateValue : new Date(String(dateValue ?? ''));
  if (!Number.isFinite(date.getTime())) return 'UNAGED';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  if (days <= 120) return '91-120';
  return '120+';
}

function isOpenStatus(value: unknown) {
  return !CLOSED_STATUSES.has(normalizeStatus(value));
}

function claimMatchesContext(claim: any, filters: ReportFilters) {
  if (filters.claimId && String(claim._id ?? '') !== filters.claimId && String(claim.claimId ?? '') !== filters.claimId) return false;
  if (filters.patientId && String(claim.patientId ?? '') !== filters.patientId) return false;
  if (filters.payerId && String(claim.payerId ?? '') !== filters.payerId) return false;
  if (filters.facilityId && String(claim.facilityId ?? '') !== filters.facilityId) return false;
  if (
    filters.providerId &&
    String(claim.billingProviderId ?? '') !== filters.providerId &&
    String(claim.renderingProviderId ?? '') !== filters.providerId
  ) {
    return false;
  }
  if (filters.status) {
    const target = normalizeStatus(filters.status);
    const statuses = [
      claim.claimStatus,
      claim.submissionStatus,
      claim.paymentStatus,
      claim.closureStatus,
      claim.ediStatus,
    ].map(normalizeStatus);
    if (!statuses.includes(target)) return false;
  }
  if (filters.closureStatus && normalizeStatus(claim.closureStatus) !== normalizeStatus(filters.closureStatus)) return false;
  return true;
}

function hasClaimScopedFilter(filters: ReportFilters) {
  return Boolean(
    filters.dateFrom
    || filters.dateTo
    || filters.claimId
    || filters.patientId
    || filters.payerId
    || filters.providerId
    || filters.facilityId
    || filters.status
    || filters.closureStatus
  );
}

function maybeClaimIdFilter(filters: ReportFilters, claimIds: unknown[]) {
  if (hasClaimScopedFilter(filters)) {
    return { claimId: { $in: claimIds } };
  }
  return {};
}

function relatedClaimFilter(filters: ReportFilters, claimIds: unknown[], extra: Record<string, unknown> = {}) {
  return {
    ...maybeClaimIdFilter(filters, claimIds),
    ...extra,
  };
}

function secondsBetween(start?: Date, end?: Date) {
  if (!start || !end) return null;
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return null;
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 1000));
}

function buildAiInsights(report: {
  denialRate: number;
  appealSuccessRate: number;
  outstandingAr: number;
  averageDaysToPayment: number;
  payerDenials: Record<string, number>;
  arAging: Record<string, number>;
}) {
  const highestRiskPayer = Object.entries(report.payerDenials).sort((a, b) => b[1] - a[1])[0];
  const oldestAr = Object.entries(report.arAging).sort((a, b) => b[1] - a[1])[0];
  return [
    {
      title: 'Denial trend summary',
      severity: report.denialRate >= 10 ? 'HIGH' : report.denialRate > 0 ? 'WATCH' : 'LOW',
      insight: report.denialRate >= 10
        ? 'Denial rate is above controlled DEV tolerance; review payer and CPT drill-down before expanding test volume.'
        : 'Denial rate is within current DEV operating range.',
    },
    {
      title: 'Payer risk summary',
      severity: highestRiskPayer ? 'WATCH' : 'LOW',
      insight: highestRiskPayer
        ? `${highestRiskPayer[0]} is the highest-denial payer in the selected period.`
        : 'No payer-specific denial concentration detected.',
    },
    {
      title: 'Appeal success recommendations',
      severity: report.appealSuccessRate < 50 ? 'WATCH' : 'LOW',
      insight: report.appealSuccessRate < 50
        ? 'Appeal success is low; validate packet evidence and reprocessed ERA matching before production pilot.'
        : 'Appeal outcomes are trending favorably for the selected period.',
    },
    {
      title: 'AR risk summary',
      severity: report.outstandingAr > 0 ? 'WATCH' : 'LOW',
      insight: oldestAr
        ? `${oldestAr[0]} is the largest AR aging bucket by unresolved balance.`
        : 'No unresolved AR balance detected.',
    },
    {
      title: 'Reimbursement trend analysis',
      severity: report.averageDaysToPayment > 14 ? 'WATCH' : 'LOW',
      insight: report.averageDaysToPayment > 14
        ? 'Average days to payment is high for DEV validation; inspect ERA backlog and payer response timing.'
        : 'Average days to payment is within expected DEV validation range.',
    },
  ];
}

async function loadReportContext(filters: ReportFilters) {
  const claimQuery = {
    ...ACTIVE_RECORD_FILTER,
    ...dateFilter(filters, 'created'),
  };

  const rawClaims = await Claim.find(claimQuery).lean();
  const claims = rawClaims.filter((claim) => claimMatchesContext(claim, filters));
  const claimIds = claims.map((claim) => claim._id);
  const payerFilter = filters.payerId ? { payerId: filters.payerId } : {};
  const denialStatusFilter = filters.denialStatus ? { denialStatus: filters.denialStatus } : {};
  const appealStatusFilter = filters.appealStatus ? { appealStatus: filters.appealStatus } : {};
  const arStatusFilter = filters.arStatus ? { status: filters.arStatus } : {};
  const exceptionTypeFilter = filters.exceptionType ? { exceptionType: filters.exceptionType } : {};
  const financialEventFilter = filters.financialEventId && mongoose.Types.ObjectId.isValid(filters.financialEventId)
    ? { _id: new mongoose.Types.ObjectId(filters.financialEventId) }
    : {};

  const [
    submissions,
    trackings,
    postings,
    patientPayments,
    adjustments,
    patientBillings,
    arItems,
    denials,
    appeals,
    correctedClaims,
    collections,
    eras,
    eraExceptions,
    refunds,
    codingReviews,
    financialEvents,
    auditLogs,
    timelyFilingAlerts,
    queueHealth,
    queueJobs,
  ] = await Promise.all([
    ClaimSubmission.find({ ...ACTIVE_RECORD_FILTER, ...relatedClaimFilter(filters, claimIds), ...dateFilter(filters, 'created') }).lean(),
    ClaimTracking.find({ ...ACTIVE_RECORD_FILTER, ...relatedClaimFilter(filters, claimIds), ...dateFilter(filters, 'created') }).lean(),
    PaymentPosting.find({ ...ACTIVE_RECORD_FILTER, ...relatedClaimFilter(filters, claimIds), ...payerFilter, ...dateFilter(filters, 'created') }).lean(),
    PatientPayment.find({ ...ACTIVE_RECORD_FILTER, ...relatedClaimFilter(filters, claimIds), ...dateFilter(filters, 'created') }).lean(),
    Adjustment.find({ ...ACTIVE_RECORD_FILTER, ...relatedClaimFilter(filters, claimIds), ...dateFilter(filters, 'created') }).lean(),
    PatientBilling.find({ ...ACTIVE_RECORD_FILTER, ...relatedClaimFilter(filters, claimIds), ...dateFilter(filters, 'created') }).lean(),
    ArWorkItem.find({ ...ACTIVE_RECORD_FILTER, ...relatedClaimFilter(filters, claimIds), ...payerFilter, ...arStatusFilter, ...dateFilter(filters, 'created') }).lean(),
    Denial.find({ ...ACTIVE_RECORD_FILTER, ...relatedClaimFilter(filters, claimIds), ...payerFilter, ...denialStatusFilter, ...dateFilter(filters, 'created') }).lean(),
    Appeal.find({ ...ACTIVE_RECORD_FILTER, ...relatedClaimFilter(filters, claimIds), ...payerFilter, ...appealStatusFilter, ...dateFilter(filters, 'created') }).lean(),
    CorrectedClaim.find({ ...ACTIVE_RECORD_FILTER, ...relatedClaimFilter(filters, claimIds), ...dateFilter(filters, 'created') }).lean(),
    Collection.find({ ...ACTIVE_RECORD_FILTER, ...relatedClaimFilter(filters, claimIds), ...dateFilter(filters, 'created') }).lean(),
    EraEobProcessing.find({ ...ACTIVE_RECORD_FILTER, ...relatedClaimFilter(filters, claimIds), ...dateFilter(filters, 'created') }).lean(),
    EraException.find({ ...ACTIVE_RECORD_FILTER, ...relatedClaimFilter(filters, claimIds), ...exceptionTypeFilter, ...dateFilter(filters, 'created') }).lean(),
    Refund.find({ ...ACTIVE_RECORD_FILTER, ...relatedClaimFilter(filters, claimIds), ...dateFilter(filters, 'created') }).lean(),
    CodingReview.find({ ...ACTIVE_RECORD_FILTER, ...dateFilter(filters, 'created') }).lean(),
    FinancialEvent.find({ ...ACTIVE_RECORD_FILTER, ...relatedClaimFilter(filters, claimIds), ...financialEventFilter, ...dateFilter(filters, 'created') }).lean(),
    AuditLog.find({
      isDeleted: false,
      ...(hasClaimScopedFilter(filters) ? { claimId: { $in: claimIds.map((id) => String(id)) } } : {}),
      ...(filters.financialEventId ? { financialEventId: filters.financialEventId } : {}),
      ...(filters.correlationId ? { correlationId: filters.correlationId } : {}),
      ...dateFilter(filters, 'timestamp'),
    }).sort({ timestamp: -1 }).limit(5000).lean(),
    TimelyFilingAlert.find({ ...ACTIVE_RECORD_FILTER, ...relatedClaimFilter(filters, claimIds), ...payerFilter, ...dateFilter(filters, 'created') }).lean(),
    getRcmQueueHealth(),
    RcmBackgroundJob.find({ ...ACTIVE_RECORD_FILTER }).sort({ updated: -1 }).limit(100).lean(),
  ]);

  return {
    filters,
    claims,
    submissions,
    trackings,
    postings,
    patientPayments,
    adjustments,
    patientBillings,
    arItems,
    denials,
    appeals,
    correctedClaims,
    collections,
    eras,
    eraExceptions,
    refunds,
    codingReviews,
    financialEvents,
    auditLogs,
    timelyFilingAlerts,
    queueHealth,
    queueJobs,
  };
}

function buildClaimReport(context: Awaited<ReturnType<typeof loadReportContext>>) {
  const { claims, submissions, postings, denials, filters } = context;
  const submittedClaimIds = new Set(submissions.map((submission) => String(submission.claimId ?? '')).filter(Boolean));
  const acceptedClaimIds = new Set(
    submissions
      .filter((submission) => ['ACCEPTED', 'ACKNOWLEDGED'].includes(normalizeStatus(submission.normalizedStatus ?? submission.acknowledgementStatus ?? submission.status)))
      .map((submission) => String(submission.claimId ?? ''))
      .filter(Boolean)
  );
  const rejectedClaimIds = new Set(
    submissions
      .filter((submission) => ['REJECTED', 'FAILED'].includes(normalizeStatus(submission.normalizedStatus ?? submission.acknowledgementStatus ?? submission.status)))
      .map((submission) => String(submission.claimId ?? ''))
      .filter(Boolean)
  );
  const positivePaymentClaimIds = new Set(
    postings
      .filter((posting) => getNumber(posting.postedAmount ?? posting.receivedAmount) > 0 && normalizeStatus(posting.postingStatus) !== 'REVERSED')
      .map((posting) => String(posting.claimId ?? ''))
      .filter(Boolean)
  );
  const paidClaimIds = new Set(
    claims
      .filter((claim) =>
        positivePaymentClaimIds.has(String(claim._id))
        || ['PAID', 'PAYMENT_RECEIVED'].includes(normalizeStatus(claim.paymentStatus))
      )
      .map((claim) => String(claim._id))
  );
  const deniedClaimIds = new Set(denials.map((denial) => String(denial.claimId ?? '')).filter(Boolean));
  const closureClaims = claims.filter((claim) => normalizeStatus(claim.closureStatus) === 'CLOSED');
  const readyClaims = claims.filter((claim) => ['READY FOR SUBMISSION', 'READY_TO_CLOSE', 'READY TO CLOSE'].includes(normalizeStatus(claim.claimStatus ?? claim.closureStatus)));
  const waitingEraClaimIds = new Set([
    ...claims
      .filter((claim) => ['AWAITING_ERA', 'WAITING_FOR_ERA'].includes(normalizeStatus(claim.closureStatus ?? claim.paymentStatus)))
      .map((claim) => String(claim._id)),
    ...Array.from(acceptedClaimIds)
      .filter((claimId) => !positivePaymentClaimIds.has(claimId) && !deniedClaimIds.has(claimId)),
  ]);
  const partiallyPaid = claims.filter((claim) => normalizeStatus(claim.paymentStatus).includes('PARTIAL'));
  const averageDaysToSubmit = average(
    submissions
      .map((submission) => {
        const claim = claims.find((item) => String(item._id) === String(submission.claimId));
        return daysBetween(claim?.created, submission.submissionDateTime ?? submission.submittedAt ?? submission.created);
      })
      .filter((value): value is number => typeof value === 'number')
  );
  const averageDaysToPayment = average(
    postings
      .map((posting) => {
        const claim = claims.find((item) => String(item._id) === String(posting.claimId));
        return daysBetween(claim?.created, posting.paymentDate ?? posting.postedAt ?? posting.created);
      })
      .filter((value): value is number => typeof value === 'number')
  );
  const averageDaysToClosure = average(
    closureClaims
      .map((claim) => daysBetween(claim.created, claim.closedAt ?? claim.updated))
      .filter((value): value is number => typeof value === 'number')
  );
  const rows = claims
    .map((claim) => ({
      claimId: String(claim._id),
      displayClaimId: claim.claimId,
      payerId: claim.payerId,
      providerId: claim.renderingProviderId ?? claim.billingProviderId,
      facilityId: claim.facilityId,
      totalChargeAmount: getNumber(claim.totalChargeAmount),
      allowedAmount: claimLineAllowed(claim),
      claimStatus: claim.claimStatus,
      submissionStatus: claim.submissionStatus,
      paymentStatus: claim.paymentStatus,
      closureStatus: claim.closureStatus,
      createdAt: claim.created,
      updatedAt: claim.updated,
    }))
    .sort((left, right) => String(right.updatedAt ?? '').localeCompare(String(left.updatedAt ?? '')));

  return {
    summary: {
      totalClaims: claims.length,
      readyClaims: readyClaims.length,
      submittedClaims: submittedClaimIds.size,
      acceptedClaims: acceptedClaimIds.size,
      rejectedClaims: rejectedClaimIds.size,
      waitingEra: waitingEraClaimIds.size,
      claimsAwaitingEra: waitingEraClaimIds.size,
      paidClaims: paidClaimIds.size,
      partiallyPaidClaims: partiallyPaid.length,
      deniedClaims: deniedClaimIds.size,
      closedClaims: closureClaims.length,
      averageDaysToSubmit,
      averageDaysToPayment,
      averageDaysToClosure,
    },
    trends: trendByDate(claims, (claim) => claim.created, (claim) => claim.totalChargeAmount),
    byStatus: countBy(claims, (claim) => claim.closureStatus ?? claim.claimStatus),
    ...paginate(rows, filters),
  };
}

function buildFinancialReport(context: Awaited<ReturnType<typeof loadReportContext>>) {
  const {
    claims,
    postings,
    patientPayments,
    adjustments,
    patientBillings,
    refunds,
    collections,
    financialEvents,
    filters,
  } = context;
  const totalBilled = sumBy(claims, (claim) => claim.totalChargeAmount);
  const actualAllowed = sumBy(postings, postingAllowedAmount);
  const expectedAllowed = sumBy(claims, claimLineAllowed);
  const totalAllowed = actualAllowed || expectedAllowed;
  const totalInsurancePaid = sumBy(postings, (posting) => posting.postedAmount ?? posting.receivedAmount);
  const expectedPatientResponsibility = sumBy(claims, claimLinePatientExpected);
  const adjudicatedPatientResponsibility = sumBy(postings, (posting) => posting.patientResponsibilityAmount);
  const billedPatientResponsibility = sumBy(patientBillings, (billing) => billing.originalBalance ?? billing.amountDue ?? billing.patientBalance);
  const paidPatientResponsibility = sumBy(patientPayments, (payment) => payment.appliedAmount ?? payment.amount);
  const remainingPatientBalance = sumBy(patientBillings, (billing) => billing.currentBalance ?? billing.amountDue ?? billing.patientBalance);
  const totalPatientResponsibility = adjudicatedPatientResponsibility || expectedPatientResponsibility;
  const totalPatientPayments = sumBy(patientPayments, (payment) => payment.appliedAmount ?? payment.amount);
  const refundsAmount = sumBy(refunds, (refund) => refund.refundAmount);
  const collectionsAmount = sumBy(collections, (collection) => collection.recoveredAmount ?? collection.settlementAmount);
  const writeOffs = sumBy(
    adjustments.filter((adjustment) => adjustment.writeOffFlag === true || normalizeStatus(adjustment.adjustmentType).includes('WRITE')),
    (adjustment) => adjustment.adjustmentAmount
  ) + sumBy(collections, (collection) => collection.writeOffAmount);
  const openArItems = context.arItems.filter((item) => isOpenStatus(item.status));
  const denialAr = sumBy(openArItems.filter((item) => item.denialId || normalizeStatus(item.category).includes('DENIAL')), (item) => item.balanceAmount);
  const insuranceAr = sumBy(openArItems.filter((item) => !item.denialId && !normalizeStatus(item.category).includes('PATIENT')), (item) => item.balanceAmount);
  const patientAr = remainingPatientBalance;
  const outstandingAr = Math.round((insuranceAr + denialAr + patientAr) * 100) / 100;
  const rows = financialEvents
    .map((event) => ({
      financialEventId: String(event._id),
      claimId: event.claimId ? String(event.claimId) : '',
      eventType: event.eventType,
      amount: getNumber(event.amount),
      ledgerSequence: event.ledgerSequence,
      reconciliationStatus: event.reconciliationStatus,
      accountingPeriod: event.accountingPeriod,
      createdAt: event.created,
    }))
    .sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')));

  return {
    summary: {
      totalBilled,
      totalAllowed,
      actualAllowed,
      expectedAllowed,
      totalInsurancePaid,
      totalExpectedInsurancePayment: sumBy(claims, claimLineInsuranceExpected),
      totalPatientResponsibility,
      expectedPatientResponsibility,
      adjudicatedPatientResponsibility,
      billedPatientResponsibility,
      paidPatientResponsibility,
      remainingPatientBalance,
      totalPatientPayments,
      refunds: refundsAmount,
      collections: collectionsAmount,
      writeOffs,
      outstandingAr,
      insuranceAr,
      denialAr,
      patientAr,
      totalAr: outstandingAr,
      netCollections: Math.round((totalInsurancePaid + totalPatientPayments + collectionsAmount - refundsAmount) * 100) / 100,
    },
    trends: trendByDate(postings, (posting) => posting.paymentDate ?? posting.created, (posting) => posting.postedAmount ?? posting.receivedAmount),
    byEventType: amountBy(financialEvents, (event) => event.eventType, (event) => event.amount),
    ...paginate(rows, filters),
  };
}

function buildDenialReport(context: Awaited<ReturnType<typeof loadReportContext>>) {
  const { claims, denials, appeals, arItems, financialEvents, filters } = context;
  const deniedClaimIds = new Set(denials.map((denial) => String(denial.claimId ?? '')).filter(Boolean));
  const denialAmount = sumBy(denials, originalDeniedAmount);
  const remainingDeniedBalance = sumBy(denials, remainingDeniedAmount);
  const recoveredAmount = sumBy(denials, (denial) => denial.resolvedAmount)
    + sumBy(financialEvents.filter((event) => ['APPEAL_PAYMENT', 'DENIAL_RECOVERY', 'CORRECTED_CLAIM_PAYMENT'].includes(normalizeStatus(event.eventType))), (event) => event.amount);
  const openDenials = denials.filter((denial) => isOpenStatus(denial.denialStatus));
  const appealedDenialIds = new Set(appeals.map((appeal) => String(appeal.denialId ?? '')).filter(Boolean));
  const statusMatches = (denial: any, pattern: string) => normalizeStatus(denial.denialStatus).includes(pattern);
  const rows = denials.map((denial) => ({
    denialId: String(denial._id),
    claimId: denial.claimId ? String(denial.claimId) : '',
    payerId: denial.payerId,
    cptCode: denial.cptCode,
    providerId: (denial.serviceLineDetails as any)?.providerId,
    facilityId: (denial.serviceLineDetails as any)?.facilityId,
    denialCode: denial.denialCode,
    carcCodes: Array.isArray(denial.carcCodes) ? denial.carcCodes.join('|') : '',
    rarcCodes: Array.isArray(denial.rarcCodes) ? denial.rarcCodes.join('|') : '',
    denialCategory: denial.denialCategory,
    denialStatus: denial.denialStatus,
    denialAmount: amountFromDenial(denial),
    originalDeniedAmount: originalDeniedAmount(denial),
    remainingDeniedBalance: remainingDeniedAmount(denial),
    denialDate: denial.denialDate ?? denial.created,
    agingBucket: agingBucket(denial.denialDate ?? denial.created),
    owner: denial.owner,
    priority: denial.priority,
    needsAction: denial.manualReviewRequired === true || normalizeStatus(denial.priority) === 'HIGH' || Boolean(denial.slaDueAt && new Date(denial.slaDueAt).getTime() < Date.now()),
    daysToDeadline: denial.slaDueAt ? Math.ceil((new Date(denial.slaDueAt).getTime() - Date.now()) / 86_400_000) : undefined,
  }));
  const deadlineRiskRows = rows.filter((row) => row.daysToDeadline !== undefined);

  return {
    summary: {
      totalDenials: denials.length,
      denialRate: claims.length ? Math.round((deniedClaimIds.size / claims.length) * 1000) / 10 : 0,
      totalDeniedAmount: denialAmount,
      remainingDeniedBalance,
      recoveredAmount,
      outstandingDeniedAmount: remainingDeniedBalance,
      openDenials: openDenials.length,
      appealedDenials: denials.filter((denial) => appealedDenialIds.has(String(denial._id)) || statusMatches(denial, 'APPEAL')).length,
      appealReadyDenials: denials.filter((denial) => statusMatches(denial, 'APPEAL_READY')).length,
      overturnedDenials: denials.filter((denial) => statusMatches(denial, 'OVERTURN')).length,
      overturnedAmount: sumBy(denials.filter((denial) => statusMatches(denial, 'OVERTURN')), originalDeniedAmount),
      upheldDenials: denials.filter((denial) => statusMatches(denial, 'UPHELD')).length,
      upheldAmount: sumBy(denials.filter((denial) => statusMatches(denial, 'UPHELD')), originalDeniedAmount),
      writtenOffDenials: denials.filter((denial) => statusMatches(denial, 'WRITE') || statusMatches(denial, 'WRITTEN')).length,
      transferredToPatientDenials: denials.filter((denial) => statusMatches(denial, 'PATIENT') || statusMatches(denial, 'TRANSFER')).length,
      denialsNeedingAction: rows.filter((row) => row.needsAction).length,
      denialsNearDeadline: deadlineRiskRows.filter((row) => Number(row.daysToDeadline) >= 0 && Number(row.daysToDeadline) <= 7).length,
      denialsOverdue: deadlineRiskRows.filter((row) => Number(row.daysToDeadline) < 0).length,
      filingDeadlineRisk: deadlineRiskRows.filter((row) => Number(row.daysToDeadline) <= 7).length,
      recoveryOpportunity: remainingDeniedBalance,
      preventableDenials: denials.filter((denial) => denial.preventableFlag === true).length,
      denialRelatedAr: arItems.filter((item) => item.denialId || normalizeStatus(item.category).includes('DENIAL')).length,
    },
    byPayer: amountBy(denials, (denial) => denial.payerId, originalDeniedAmount),
    byCpt: amountBy(denials, (denial) => denial.cptCode, originalDeniedAmount),
    byProvider: countBy(denials, (denial) => (denial.serviceLineDetails as any)?.providerId),
    byFacility: countBy(denials, (denial) => (denial.serviceLineDetails as any)?.facilityId),
    byCarc: amountBy(denials.flatMap((denial) => (denial.carcCodes?.length ? denial.carcCodes : [denial.denialCode ?? 'UNSPECIFIED']).map((code: string) => ({ code, amount: originalDeniedAmount(denial) }))), (item) => item.code, (item) => item.amount),
    byRarc: amountBy(denials.flatMap((denial) => (denial.rarcCodes?.length ? denial.rarcCodes : ['UNSPECIFIED']).map((code: string) => ({ code, amount: originalDeniedAmount(denial) }))), (item) => item.code, (item) => item.amount),
    byCategory: amountBy(denials, (denial) => denial.denialCategory, originalDeniedAmount),
    agingBuckets: amountBy(denials, (denial) => agingBucket(denial.denialDate ?? denial.created), remainingDeniedAmount),
    trends: trendByDate(denials, (denial) => denial.denialDate ?? denial.created, originalDeniedAmount),
    drillDownLinks: {
      totalDenials: { target: '/rcm/denials', query: context.filters },
      openDenials: { target: '/rcm/denials', query: { ...context.filters, denialStatus: 'OPEN' } },
      appealedDenials: { target: '/rcm/appeals', query: { ...context.filters, relatedDenialStatus: 'APPEALED' } },
      denialsNeedingAction: { target: '/rcm/denials', query: { ...context.filters, status: 'NEEDS_ACTION' } },
      denialsNearDeadline: { target: '/rcm/denials', query: { ...context.filters, drillDown: 'nearDeadline' } },
      denialsOverdue: { target: '/rcm/denials', query: { ...context.filters, drillDown: 'overdue' } },
      denialRelatedAr: { target: '/rcm/ar-work-items', query: { ...context.filters, category: 'DENIAL' } },
    },
    ...paginate(rows, filters),
  };
}

function buildAppealReport(context: Awaited<ReturnType<typeof loadReportContext>>) {
  const { appeals, claims, filters } = context;
  const claimById = new Map(claims.map((claim) => [String(claim._id), claim]));
  const statusOf = (appeal: any) => normalizeStatus(appeal.outcome ?? appeal.resolution ?? appeal.appealStatus);
  const overturned = appeals.filter((appeal) => statusOf(appeal).includes('OVERTURNED') && !statusOf(appeal).includes('PARTIAL'));
  const partiallyOverturned = appeals.filter((appeal) => statusOf(appeal).includes('PARTIAL'));
  const upheld = appeals.filter((appeal) => statusOf(appeal).includes('UPHELD'));
  const decided = overturned.length + partiallyOverturned.length + upheld.length;
  const recoveredAmount = (appeal: any) => Number(appeal.recoveredAmount ?? 0) || sumBy(context.financialEvents.filter((event) => String(event.appealId ?? '') === String(appeal._id)), (event) => event.amount);
  const rows = appeals.map((appeal) => {
    const claim = claimById.get(String(appeal.claimId ?? ''));
    return {
    appealId: String(appeal._id),
    denialId: appeal.denialId ? String(appeal.denialId) : '',
    claimId: appeal.claimId ? String(appeal.claimId) : '',
    payerId: appeal.payerId,
    providerId: claim?.billingProviderId ?? claim?.renderingProviderId,
    facilityId: claim?.facilityId,
    appealLevel: appeal.appealLevel,
    appealStatus: appeal.appealStatus,
    packetStatus: appeal.packetStatus,
    packetGenerated: Boolean(appeal.packetGenerated),
    packetVersion: appeal.packetVersion ?? 0,
    documentCount: Array.isArray(appeal.supportingDocumentsMetadata)
      ? appeal.supportingDocumentsMetadata.filter((document: any) => normalizeStatus(document.status ?? 'ACTIVE') === 'ACTIVE').length
      : 0,
    outcome: appeal.outcome ?? appeal.resolution,
    submittedAt: appeal.submittedAt ?? appeal.submissionDate,
    decisionAt: appeal.decisionAt ?? appeal.outcomeDate,
    daysRemaining: appeal.daysRemaining,
    deadlineStatus: appeal.deadlineStatus,
    slaStatus: appeal.slaStatus,
    recoveryStatus: appeal.recoveryStatus,
    payerRecoveredAmount: getNumber(appeal.payerRecoveredAmount),
    patientRecoveredAmount: getNumber(appeal.patientRecoveredAmount),
    contractualAdjustmentRecoveredAmount: getNumber(appeal.contractualAdjustmentRecoveredAmount),
    recoveryPercent: getNumber(appeal.recoveryPercent),
    recoveredAmount: recoveredAmount(appeal),
    recoveredAt: appeal.recoveredAt,
    owner: appeal.owner,
    };
  });
  const deadlineStatusOf = (appeal: any) => {
    const dueDate = appeal.appealDeadline ?? appeal.dueDate;
    if (!dueDate) return 'UNKNOWN';
    const daysRemaining = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
    if (daysRemaining < 0) return 'PAST_DUE';
    if (daysRemaining <= 7) return 'NEAR_DEADLINE';
    return 'ON_TRACK';
  };

  return {
    summary: {
      appealsSubmitted: appeals.filter((appeal) => appeal.submittedAt || normalizeStatus(appeal.appealStatus).includes('SUBMITTED')).length,
      appealsAwaitingPacket: appeals.filter((appeal) => !appeal.packetGenerated || ['DRAFT', 'GENERATED'].includes(normalizeStatus(appeal.packetStatus))).length,
      appealsReadyForSubmission: appeals.filter((appeal) => normalizeStatus(appeal.packetStatus) === 'READY_FOR_SUBMISSION' || normalizeStatus(appeal.appealStatus) === 'READY').length,
      appealsUnderReview: appeals.filter((appeal) => ['PAYER_RECEIVED', 'PAYER_REVIEW', 'IN_REVIEW'].includes(normalizeStatus(appeal.appealStatus))).length,
      appealsAwaitingMoreInfo: appeals.filter((appeal) => normalizeStatus(appeal.appealStatus) === 'MORE_INFO_REQUIRED').length,
      appealsNearDeadline: appeals.filter((appeal) => deadlineStatusOf(appeal) === 'NEAR_DEADLINE').length,
      appealsPastDue: appeals.filter((appeal) => deadlineStatusOf(appeal) === 'PAST_DUE').length,
      slaViolations: appeals.filter((appeal) => ['OVERDUE', 'VIOLATED'].includes(normalizeStatus(appeal.slaStatus))).length,
      overturned: overturned.length,
      partiallyOverturned: partiallyOverturned.length,
      upheld: upheld.length,
      appealSuccessPercent: decided ? Math.round(((overturned.length + partiallyOverturned.length) / decided) * 1000) / 10 : 0,
      appealRecoveryAmount: sumBy(appeals, recoveredAmount),
      recoveredDollars: sumBy(appeals, recoveredAmount),
      averageRecoveryPercent: average(rows.map((row) => row.recoveryPercent)),
    },
    byStatus: countBy(appeals, (appeal) => appeal.outcome ?? appeal.resolution ?? appeal.appealStatus),
    recoveryByPayer: amountBy(appeals, (appeal) => appeal.payerId, recoveredAmount),
    recoveryByProvider: amountBy(rows, (row) => row.providerId, (row) => row.recoveredAmount),
    recoveryByFacility: amountBy(rows, (row) => row.facilityId, (row) => row.recoveredAmount),
    recoveryByDenialType: amountBy(appeals, (appeal) => appeal.appealCategory ?? appeal.denialCode, recoveredAmount),
    recoveryByTemplate: amountBy(appeals, (appeal) => (appeal.packetSnapshot as any)?.templateType ?? 'UNSPECIFIED', recoveredAmount),
    monthlyRecovery: trendByDate(rows, (row) => row.recoveredAt ?? row.decisionAt ?? row.submittedAt, (row) => row.recoveredAmount),
    trends: trendByDate(appeals, (appeal) => appeal.submittedAt ?? appeal.submissionDate ?? appeal.created),
    ...paginate(rows, filters),
  };
}

function buildArReport(context: Awaited<ReturnType<typeof loadReportContext>>) {
  const { arItems, filters } = context;
  const openItems = arItems.filter((item) => !CLOSED_STATUSES.has(normalizeStatus(item.status)));
  const rows = arItems.map((item) => ({
    arWorkItemId: String(item._id),
    claimId: item.claimId ? String(item.claimId) : '',
    denialId: item.denialId ? String(item.denialId) : '',
    payerId: item.payerId,
    category: item.category,
    status: item.status,
    agingBucket: item.agingBucket,
    balanceAmount: getNumber(item.balanceAmount),
    followUpDate: item.followUpDate ?? item.nextFollowUpDate,
    owner: item.owner ?? item.assignedTo,
    priority: item.priority,
  }));
  return {
    summary: {
      openAr: openItems.length,
      outstandingAr: sumBy(openItems, (item) => item.balanceAmount),
      followUpCounts: openItems.filter((item) => item.followUpDate || item.nextFollowUpDate).length,
      unresolvedBalances: sumBy(openItems, (item) => item.balanceAmount),
    },
    agingBuckets: amountBy(openItems, (item) => item.agingBucket, (item) => item.balanceAmount),
    byOwner: countBy(openItems, (item) => item.owner ?? item.assignedTo),
    ...paginate(rows, filters),
  };
}

function buildPatientBillingReport(context: Awaited<ReturnType<typeof loadReportContext>>) {
  const { patientBillings, patientPayments, refunds, collections, filters } = context;
  const billsPaid = patientBillings.filter((billing) => ['PAID', 'CLOSED'].includes(normalizeStatus(billing.status ?? billing.statementStatus)));
  const rows = patientBillings.map((billing) => ({
    patientBillingId: String(billing._id),
    claimId: billing.claimId ? String(billing.claimId) : '',
    patientId: billing.patientId ? String(billing.patientId) : '',
    statementNumber: billing.statementNumber,
    status: billing.status ?? billing.statementStatus,
    originalBalance: getNumber(billing.originalBalance),
    currentBalance: getNumber(billing.currentBalance ?? billing.amountDue ?? billing.patientBalance),
    dueDate: billing.dueDate,
    agingBucket: billing.agingBucket,
  }));
  return {
    summary: {
      billsIssued: patientBillings.length,
      billsPaid: billsPaid.length,
      collections: collections.length,
      refunds: refunds.length,
      outstandingBalances: sumBy(patientBillings, (billing) => billing.currentBalance ?? billing.amountDue ?? billing.patientBalance),
      patientPayments: sumBy(patientPayments, (payment) => payment.appliedAmount ?? payment.amount),
      refundAmount: sumBy(refunds, (refund) => refund.refundAmount),
      collectionAmount: sumBy(collections, (collection) => collection.recoveredAmount ?? collection.settlementAmount),
    },
    agingBuckets: amountBy(patientBillings, (billing) => billing.agingBucket, (billing) => billing.currentBalance ?? billing.amountDue),
    trends: trendByDate(patientBillings, (billing) => billing.statementDate ?? billing.created, (billing) => billing.originalBalance),
    ...paginate(rows, filters),
  };
}

function buildProductivityReport(context: Awaited<ReturnType<typeof loadReportContext>>) {
  const { claims, codingReviews, denials, appeals, collections, filters } = context;
  const rows = [
    ...trendByDate(claims, (claim) => claim.created).map((row) => ({ ...row, metric: 'claimsCreatedPerDay' })),
    ...trendByDate(codingReviews, (review) => review.updated ?? review.created).map((row) => ({ ...row, metric: 'codingReviewsCompleted' })),
    ...trendByDate(denials, (denial) => denial.updated ?? denial.created).map((row) => ({ ...row, metric: 'denialsWorked' })),
    ...trendByDate(appeals, (appeal) => appeal.updated ?? appeal.created).map((row) => ({ ...row, metric: 'appealsWorked' })),
    ...trendByDate(collections, (collection) => collection.updated ?? collection.created).map((row) => ({ ...row, metric: 'collectionsWorked' })),
  ].sort((left, right) => right.date.localeCompare(left.date));
  return {
    summary: {
      claimsCreatedPerDay: trendByDate(claims, (claim) => claim.created),
      codingReviewsCompleted: codingReviews.filter((review) => ['APPROVED', 'PASSED', 'COMPLETED'].includes(normalizeStatus((review as any).reviewStatus ?? (review as any).scrubStatus ?? (review as any).status))).length,
      denialsWorked: denials.filter((denial) => denial.updated && denial.updated !== denial.created).length,
      appealsWorked: appeals.filter((appeal) => appeal.updated && appeal.updated !== appeal.created).length,
      collectionsWorked: collections.filter((collection) => collection.updated && collection.updated !== collection.created).length,
    },
    ...paginate(rows, filters),
  };
}

function buildRealtimeReport(context: Awaited<ReturnType<typeof loadReportContext>>) {
  const { queueHealth, queueJobs, eras, submissions, denials, appeals, arItems, collections, eraExceptions, filters } = context;
  const processingTimes = queueJobs
    .map((job) => secondsBetween(job.startedAt, job.completedAt))
    .filter((value): value is number => typeof value === 'number');
  const failedJobs = queueJobs.filter((job) => normalizeStatus(job.status) === 'FAILED');
  const jobsByType = countBy(queueJobs, (job) => job.jobType);
  const retriesByType = queueJobs.reduce<Record<string, number>>((totals, job) => {
    const key = normalizeStatus(job.jobType) || 'UNKNOWN';
    totals[key] = (totals[key] ?? 0) + getNumber(job.attempts);
    return totals;
  }, {});
  const slowestJobType = queueJobs
    .map((job) => ({ jobType: job.jobType, duration: secondsBetween(job.startedAt, job.completedAt) ?? 0 }))
    .sort((left, right) => right.duration - left.duration)[0]?.jobType;
  const rows = queueJobs.map((job) => ({
    jobId: String(job._id),
    jobType: job.jobType,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    nextRunAt: job.nextRunAt,
    updatedAt: job.updated,
    lastError: job.lastError,
  }));
  return {
    summary: {
      queueDepth: getNumber((queueHealth as any).queued),
      pendingJobs: queueJobs.filter((job) => normalizeStatus(job.status) === 'QUEUED').length || getNumber((queueHealth as any).queued),
      runningJobs: queueJobs.filter((job) => normalizeStatus(job.status) === 'RUNNING').length || getNumber((queueHealth as any).running),
      staleJobs: queueJobs.filter((job) => normalizeStatus(job.status) === 'STALE' || job.staleAt).length || getNumber((queueHealth as any).stale),
      deadLetterJobs: queueJobs.filter((job) => normalizeStatus(job.status) === 'DEAD_LETTER').length || getNumber((queueHealth as any).deadLetter),
      failedJobs: failedJobs.length || getNumber((queueHealth as any).failed),
      recoveredJobs: queueJobs.filter((job) => job.recoveredAt || getNumber(job.recoveryAttemptCount) > 0).length,
      averageProcessingTimeSeconds: average(processingTimes),
      averageProcessingTimeMinutes: Math.round((average(processingTimes) / 60) * 10) / 10,
      slowestJobType: slowestJobType ?? 'NONE',
      webhookBacklog: queueJobs.filter((job) => normalizeStatus(job.jobType).includes('WEBHOOK') || normalizeStatus(job.jobType).includes('CLEARINGHOUSE')).length,
      eraBacklog: eras.filter((era) => !['POSTED', 'RESOLVED', 'CLOSED'].includes(normalizeStatus((era as any).postingStatus ?? (era as any).importStatus ?? (era as any).reconciliationStatus))).length,
      ackBacklog: submissions.filter((submission) => ['PENDING', 'TRANSMITTED'].includes(normalizeStatus(submission.acknowledgementStatus ?? submission.status))).length,
      denialBacklog: denials.filter((denial) => !CLOSED_STATUSES.has(normalizeStatus(denial.denialStatus))).length,
      appealBacklog: appeals.filter((appeal) => !CLOSED_STATUSES.has(normalizeStatus(appeal.appealStatus))).length,
      arBacklog: arItems.filter((item) => !CLOSED_STATUSES.has(normalizeStatus(item.status))).length,
      collectionBacklog: collections.filter((collection) => !CLOSED_STATUSES.has(normalizeStatus(collection.status ?? collection.collectionStatus))).length,
      eraExceptionBacklog: eraExceptions.filter((exception) => !CLOSED_STATUSES.has(normalizeStatus((exception as any).exceptionStatus ?? (exception as any).status))).length,
      failedHandlerCount: failedJobs.length,
      latestFailedJob: failedJobs[0]?._id ? String(failedJobs[0]._id) : '',
      jobsNeedingReplay: queueJobs.filter((job) => ['FAILED', 'DEAD_LETTER', 'STALE'].includes(normalizeStatus(job.status))).length,
      realtimeProcessingHealth: (queueHealth as any).status ?? 'UNKNOWN',
    },
    byJobType: jobsByType,
    retriesByJobType: retriesByType,
    drillDownLinks: {
      failedJobs: { target: '/rcm/audit-logs', query: { entityType: 'system', action: 'QUEUE_JOB_FAILED' } },
      staleJobs: { target: '/rcm/audit-logs', query: { entityType: 'system', action: 'QUEUE_STALE' } },
      eraBacklog: { target: '/rcm/era-eob-processings', query: { status: 'PENDING' } },
      ackBacklog: { target: '/rcm/claim-submissions', query: { acknowledgementStatus: 'PENDING' } },
    },
    queueHealth,
    ...paginate(rows, filters),
  };
}

function buildClaimClosureReport(context: Awaited<ReturnType<typeof loadReportContext>>) {
  const { claims, arItems, denials, appeals, eras, eraExceptions, refunds, collections, auditLogs, filters } = context;
  const openArClaimIds = new Set(arItems.filter((item) => isOpenStatus(item.status)).map((item) => String(item.claimId ?? '')).filter(Boolean));
  const openDenialClaimIds = new Set(denials.filter((denial) => isOpenStatus(denial.denialStatus)).map((denial) => String(denial.claimId ?? '')).filter(Boolean));
  const openAppealClaimIds = new Set(appeals.filter((appeal) => isOpenStatus(appeal.appealStatus)).map((appeal) => String(appeal.claimId ?? '')).filter(Boolean));
  const unresolvedEraClaimIds = new Set([
    ...eras.filter((era) => !['POSTED', 'RECONCILED', 'CLOSED', 'RESOLVED'].includes(normalizeStatus((era as any).postingStatus ?? (era as any).reconciliationStatus))).map((era) => String((era as any).claimId ?? '')),
    ...eraExceptions.filter((exception) => isOpenStatus((exception as any).status ?? (exception as any).exceptionStatus)).map((exception) => String((exception as any).claimId ?? '')),
  ].filter(Boolean));
  const pendingRefundClaimIds = new Set(refunds.filter((refund) => ['PENDING', 'REQUESTED', 'APPROVED'].includes(normalizeStatus(refund.refundStatus ?? (refund as any).status))).map((refund) => String(refund.claimId ?? '')).filter(Boolean));
  const openCollectionClaimIds = new Set(collections.filter((collection) => isOpenStatus(collection.status ?? collection.collectionStatus)).map((collection) => String(collection.claimId ?? '')).filter(Boolean));
  const reopenedClaimIds = new Set(auditLogs.filter((log) => normalizeStatus(log.action).includes('REOPEN')).map((log) => String(log.claimId ?? log.entityId ?? '')).filter(Boolean));
  const blockerRows = claims.map((claim) => {
    const claimId = String(claim._id);
    const snapshot = claim.financialBalanceSnapshot as any;
    const blockers = [
      openArClaimIds.has(claimId) ? 'openAr' : '',
      openDenialClaimIds.has(claimId) ? 'openDenial' : '',
      openAppealClaimIds.has(claimId) ? 'openAppeal' : '',
      unresolvedEraClaimIds.has(claimId) ? 'unreconciledEra' : '',
      getNumber(snapshot?.patientResponsibilityBalance ?? snapshot?.patientBalance) > 0 ? 'patientBalance' : '',
      pendingRefundClaimIds.has(claimId) ? 'refundPending' : '',
      getNumber(snapshot?.unresolvedReversalAmount) > 0 ? 'reversalPending' : '',
      openCollectionClaimIds.has(claimId) ? 'collectionOpen' : '',
      ['IMBALANCED', 'MANUAL_REVIEW_REQUIRED', 'UNSUPPORTED_ADJUSTMENT'].includes(normalizeStatus(snapshot?.financialBalanceStatus)) ? 'financialImbalance' : '',
    ].filter(Boolean);
    return {
      claimId,
      displayClaimId: claim.claimId,
      closureStatus: claim.closureStatus,
      paymentStatus: claim.paymentStatus,
      totalChargeAmount: getNumber(claim.totalChargeAmount),
      blockers: blockers.join('|'),
      blockerCount: blockers.length,
      reopened: reopenedClaimIds.has(claimId),
      closeReason: claim.closeReason,
      createdAt: claim.created,
      closedAt: claim.closedAt,
      updatedAt: claim.updated,
    };
  });
  const closureClaims = claims.filter((claim) => normalizeStatus(claim.closureStatus) === 'CLOSED');
  return {
    summary: {
      claimsReadyToClose: claims.filter((claim) => ['READY_TO_CLOSE', 'READY TO CLOSE'].includes(normalizeStatus(claim.closureStatus))).length,
      claimsClosed: closureClaims.length,
      claimsReopened: reopenedClaimIds.size,
      claimsBlockedFromClosure: blockerRows.filter((row) => row.blockerCount > 0 && normalizeStatus(row.closureStatus) !== 'CLOSED').length,
      averageDaysToClose: average(closureClaims.map((claim) => daysBetween(claim.created, claim.closedAt ?? claim.updated)).filter((value): value is number => typeof value === 'number')),
      claimsAwaitingFinalFinancialSync: claims.filter((claim) => ['AWAITING_ERA', 'AWAITING_PAYMENT', 'IMBALANCED'].includes(normalizeStatus((claim.financialBalanceSnapshot as any)?.financialBalanceStatus ?? claim.closureStatus))).length,
    },
    closureBlockersByType: blockerRows.reduce<Record<string, number>>((totals, row) => {
      row.blockers.split('|').filter(Boolean).forEach((blocker) => {
        totals[blocker] = (totals[blocker] ?? 0) + 1;
      });
      return totals;
    }, {}),
    reopenedByReason: countBy(auditLogs.filter((log) => normalizeStatus(log.action).includes('REOPEN')), (log) => log.reason ?? 'UNSPECIFIED'),
    drillDownLinks: {
      claimsReadyToClose: { target: '/rcm/claims', query: { ...context.filters, closureStatus: 'READY_TO_CLOSE' } },
      claimsClosed: { target: '/rcm/claims', query: { ...context.filters, closureStatus: 'CLOSED' } },
      claimsReopened: { target: '/rcm/audit-logs', query: { ...context.filters, action: 'CLAIM_REOPENED' } },
      claimsBlockedFromClosure: { target: '/rcm/claims', query: { ...context.filters, closureStatus: 'BLOCKED' } },
    },
    ...paginate(blockerRows.sort((left, right) => right.blockerCount - left.blockerCount), filters),
  };
}

function buildFinancialRiskReport(context: Awaited<ReturnType<typeof loadReportContext>>) {
  const { claims, arItems, denials, postings, refunds, eraExceptions, financialEvents, collections, filters } = context;
  const claimIds = new Set(claims.map((claim) => String(claim._id)));
  const openArClaimIds = new Set(arItems.map((item) => String(item.claimId ?? '')).filter(Boolean));
  const denialClaimIds = new Set(denials.map((denial) => String(denial.claimId ?? '')).filter(Boolean));
  const postingClaimIds = new Set(postings.map((posting) => String(posting.claimId ?? '')).filter(Boolean));
  const duplicatePaymentKeys = postings.reduce<Record<string, number>>((totals, posting) => {
    const key = [posting.claimId, (posting as any).externalPaymentId ?? (posting as any).traceNumber ?? posting.eftTraceNumber ?? posting.checkNumber, posting.postedAmount ?? posting.receivedAmount].join(':');
    totals[key] = (totals[key] ?? 0) + 1;
    return totals;
  }, {});
  const refundCandidates = claims.filter((claim) => getNumber((claim.financialBalanceSnapshot as any)?.patientBalance) < 0 || getNumber((claim.financialBalanceSnapshot as any)?.pendingRefundAmount) > 0);
  const rows = claims.map((claim) => {
    const snapshot = claim.financialBalanceSnapshot as any;
    const claimId = String(claim._id);
    const risks = [
      getNumber(snapshot?.patientBalance) < 0 ? 'negativeBalance' : '',
      !openArClaimIds.has(claimId) && getNumber(snapshot?.remainingBalance) > 0 ? 'orphanAr' : '',
      denials.some((denial) => String(denial.claimId ?? '') === claimId && !denial.arWorkItemId) ? 'orphanDenial' : '',
      postingClaimIds.has(claimId) && !claimIds.has(claimId) ? 'orphanPaymentPosting' : '',
      getNumber(snapshot?.financialBalanceStatus === 'IMBALANCED' ? 1 : 0) ? 'financialImbalance' : '',
      getNumber(snapshot?.unreconciledPaymentAmount) > 0 ? 'unreconciledPayment' : '',
      getNumber(snapshot?.recoupmentBalance) > 0 || getNumber(snapshot?.takebackBalance) > 0 ? 'recoupmentTakeback' : '',
      ['UNSUPPORTED_ADJUSTMENT', 'MANUAL_REVIEW_REQUIRED'].includes(normalizeStatus(snapshot?.financialBalanceStatus ?? snapshot?.plbSupportStatus)) ? 'unsupportedAdjustment' : '',
    ].filter(Boolean);
    return {
      claimId,
      displayClaimId: claim.claimId,
      payerId: claim.payerId,
      closureStatus: claim.closureStatus,
      paymentStatus: claim.paymentStatus,
      riskTypes: risks.join('|'),
      riskCount: risks.length,
      patientBalance: getNumber(snapshot?.patientBalance),
      remainingBalance: getNumber(snapshot?.remainingBalance),
      financialBalanceStatus: snapshot?.financialBalanceStatus,
      updatedAt: claim.updated,
    };
  });
  return {
    summary: {
      negativeBalances: rows.filter((row) => row.riskTypes.includes('negativeBalance')).length,
      orphanAr: rows.filter((row) => row.riskTypes.includes('orphanAr')).length,
      orphanDenials: denials.filter((denial) => !denial.arWorkItemId).length,
      orphanPaymentPostings: postings.filter((posting) => posting.claimId && !claimIds.has(String(posting.claimId))).length,
      duplicatePaymentRisk: Object.values(duplicatePaymentKeys).filter((count) => count > 1).length,
      refundCandidates: refundCandidates.length,
      pendingRefunds: refunds.filter((refund) => ['PENDING', 'REQUESTED', 'APPROVED'].includes(normalizeStatus(refund.refundStatus ?? (refund as any).status))).length,
      overpayments: refundCandidates.length,
      underpayments: denials.filter((denial) => normalizeStatus(denial.denialCategory).includes('UNDER') || getNumber(denial.remainingDeniedBalance) > 0).length,
      eraExceptions: eraExceptions.length,
      unsupportedAdjustments: eraExceptions.filter((exception) => normalizeStatus((exception as any).exceptionType ?? (exception as any).exceptionReason).includes('UNSUPPORTED')).length + rows.filter((row) => row.riskTypes.includes('unsupportedAdjustment')).length,
      unreconciledPayments: rows.filter((row) => row.riskTypes.includes('unreconciledPayment')).length,
      financialImbalanceClaims: rows.filter((row) => row.riskTypes.includes('financialImbalance')).length,
      claimsReopenedDueToFinancialMutation: context.auditLogs.filter((log) => normalizeStatus(log.action).includes('REOPEN') && normalizeStatus(log.reason).includes('FINANC')).length,
      collectionsWithBalanceMismatch: collections.filter((collection) => getNumber((collection as any).balanceAmount) !== getNumber((collection as any).currentBalance ?? (collection as any).remainingBalance)).length,
      writeOffsPendingApproval: financialEvents.filter((event) => normalizeStatus(event.eventType).includes('WRITE') && ['PENDING', 'REQUESTED'].includes(normalizeStatus(event.reconciliationStatus))).length,
    },
    byRiskType: rows.reduce<Record<string, number>>((totals, row) => {
      row.riskTypes.split('|').filter(Boolean).forEach((risk) => {
        totals[risk] = (totals[risk] ?? 0) + 1;
      });
      return totals;
    }, {}),
    drillDownLinks: {
      eraExceptions: { target: '/rcm/era-exceptions', query: context.filters },
      pendingRefunds: { target: '/rcm/refunds', query: { ...context.filters, status: 'PENDING' } },
      financialImbalanceClaims: { target: '/rcm/claims', query: { ...context.filters, riskType: 'financialImbalance' } },
      orphanAr: { target: '/rcm/ar-work-items', query: { ...context.filters, riskType: 'orphanAr' } },
    },
    ...paginate(rows.filter((row) => row.riskCount > 0).sort((left, right) => right.riskCount - left.riskCount), filters),
  };
}

function buildTimelyFilingReport(context: Awaited<ReturnType<typeof loadReportContext>>) {
  const { timelyFilingAlerts, filters } = context;
  const activeAlerts = timelyFilingAlerts.filter((alert) => alert.active !== false);
  const riskAlerts = activeAlerts.filter((alert) => ['WARNING', 'CRITICAL', 'EXPIRED'].includes(normalizeStatus(alert.status)));
  const expiredAlerts = activeAlerts.filter((alert) => normalizeStatus(alert.status) === 'EXPIRED');
  const criticalAlerts = activeAlerts.filter((alert) => normalizeStatus(alert.status) === 'CRITICAL');
  const sevenDayAlerts = activeAlerts.filter((alert) => getNumber(alert.daysRemaining) >= 0 && getNumber(alert.daysRemaining) <= 7);
  const thirtyDayAlerts = activeAlerts.filter((alert) => getNumber(alert.daysRemaining) >= 0 && getNumber(alert.daysRemaining) <= 30);

  const rows = activeAlerts
    .map((alert) => ({
      alertId: String(alert._id),
      claimId: String(alert.claimId ?? ''),
      payerId: alert.payerId,
      serviceDate: alert.serviceDate,
      filingDeadline: alert.filingDeadline,
      daysRemaining: alert.daysRemaining,
      severity: alert.severity,
      status: alert.status,
      zapierDeliveryStatus: alert.zapierDeliveryStatus,
      lastZapierTriggeredAt: alert.lastZapierTriggeredAt,
      updatedAt: alert.updated,
    }))
    .sort((left, right) => getNumber(left.daysRemaining) - getNumber(right.daysRemaining));

  return {
    summary: {
      totalAlerts: activeAlerts.length,
      riskAlerts: riskAlerts.length,
      expiredAlerts: expiredAlerts.length,
      criticalAlerts: criticalAlerts.length,
      dueWithin7Days: sevenDayAlerts.length,
      dueWithin30Days: thirtyDayAlerts.length,
      zapierFailures: activeAlerts.filter((alert) => normalizeStatus(alert.zapierDeliveryStatus) === 'FAILED').length,
    },
    byStatus: countBy(activeAlerts, (alert) => alert.status),
    bySeverity: countBy(activeAlerts, (alert) => alert.severity),
    byPayer: countBy(riskAlerts, (alert) => alert.payerId),
    drillDownLinks: {
      expiredAlerts: { target: '/rcm/timely-filing-alerts', query: { ...context.filters, status: 'EXPIRED' } },
      criticalAlerts: { target: '/rcm/timely-filing-alerts', query: { ...context.filters, status: 'CRITICAL' } },
      zapierFailures: { target: '/rcm/timely-filing-alerts', query: { ...context.filters, zapierDeliveryStatus: 'FAILED' } },
    },
    ...paginate(rows, filters),
  };
}

function buildAiOperationsReport(context: Awaited<ReturnType<typeof loadReportContext>>) {
  const { codingReviews, denials, auditLogs, filters } = context;
  const aiLogs = auditLogs.filter((log) => normalizeStatus(log.action).includes('AI') || normalizeStatus(log.sourceModule).includes('AI'));
  const rows = [
    ...aiLogs.map((log) => ({
      eventId: String(log._id),
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      claimId: log.claimId,
      confidence: getNumber((log.newState as any)?.confidence ?? (log.newState as any)?.confidenceScore),
      status: (log.newState as any)?.status ?? log.action,
      timestamp: log.timestamp ?? log.created,
    })),
    ...denials.filter((denial) => denial.aiAnalysis || denial.aiConfidenceScore || denial.aiRecommendationHistory?.length).map((denial) => ({
      eventId: String(denial._id),
      action: 'AI_DENIAL_RECOMMENDATION',
      entityType: 'denial',
      entityId: String(denial._id),
      claimId: denial.claimId ? String(denial.claimId) : '',
      confidence: getNumber(denial.aiConfidenceScore),
      status: denial.recommendedAction ?? denial.recoveryRecommendation,
      timestamp: denial.updated ?? denial.created,
    })),
  ].sort((left, right) => String(right.timestamp ?? '').localeCompare(String(left.timestamp ?? '')));
  const confidenceBuckets = rows.reduce<Record<string, number>>((totals, row) => {
    const confidence = getNumber(row.confidence);
    const bucket = confidence >= 0.8 || confidence >= 80 ? 'HIGH' : confidence >= 0.5 || confidence >= 50 ? 'MEDIUM' : confidence > 0 ? 'LOW' : 'UNKNOWN';
    totals[bucket] = (totals[bucket] ?? 0) + 1;
    return totals;
  }, {});
  return {
    summary: {
      aiReadinessReviewsRun: auditLogs.filter((log) => normalizeStatus(log.action) === 'CLAIM_READINESS_RUN').length,
      aiClaimReviewsRun: auditLogs.filter((log) => normalizeStatus(log.action) === 'CLAIM_AI_REVIEW_RUN').length,
      aiDenialPredictionsGenerated: denials.filter((denial) => denial.aiAnalysis || denial.aiConfidenceScore).length,
      aiCodingSuggestionsGenerated: codingReviews.filter((review) => (review as any).aiSuggestions || (review as any).aiFindings || (review as any).aiScrubAnalysis).length,
      aiRecommendationsAccepted: aiLogs.filter((log) => normalizeStatus(log.action).includes('ACCEPT')).length,
      aiRecommendationsOverridden: aiLogs.filter((log) => normalizeStatus(log.action).includes('OVERRIDE')).length,
      aiRecommendationsIgnored: aiLogs.filter((log) => normalizeStatus(log.action).includes('IGNORE')).length,
      aiFailureCount: aiLogs.filter((log) => normalizeStatus((log.newState as any)?.status ?? log.reason).includes('FAIL')).length,
      aiTimeoutCount: aiLogs.filter((log) => normalizeStatus((log.newState as any)?.status ?? log.reason).includes('TIMEOUT')).length,
    },
    commonAiSuggestions: countBy(rows, (row) => row.status),
    topReadinessRisks: countBy(aiLogs, (log) => (log.newState as any)?.riskLevel ?? (log.newState as any)?.risk),
    topDenialPredictionReasons: countBy(denials, (denial) => denial.recommendationReason ?? denial.rootCause ?? denial.denialCategory),
    confidenceDistribution: confidenceBuckets,
    advisoryOnlyControls: {
      automatedClaimSubmission: false,
      automatedDenialResolution: false,
      automatedAppealSubmission: false,
      automatedPaymentPosting: false,
      automatedClaimClosure: false,
    },
    drillDownLinks: {
      aiFailureCount: { target: '/rcm/audit-logs', query: { ...context.filters, search: 'AI failed' } },
      aiClaimReviewsRun: { target: '/rcm/audit-logs', query: { ...context.filters, action: 'CLAIM_AI_REVIEW_RUN' } },
      aiDenialPredictionsGenerated: { target: '/rcm/denials', query: { ...context.filters, hasAi: 'true' } },
    },
    ...paginate(rows, filters),
  };
}

function buildDashboard(context: Awaited<ReturnType<typeof loadReportContext>>) {
  const claims = buildClaimReport(context);
  const financial = buildFinancialReport(context);
  const denials = buildDenialReport(context);
  const appeals = buildAppealReport(context);
  const ar = buildArReport(context);
  const patientBilling = buildPatientBillingReport(context);
  const realtime = buildRealtimeReport(context);
  const productivity = buildProductivityReport(context);
  const claimClosure = buildClaimClosureReport(context);
  const financialRisk = buildFinancialRiskReport(context);
  const timelyFiling = buildTimelyFilingReport(context);
  const aiOperations = buildAiOperationsReport(context);
  return {
    generatedAt: new Date(),
    filters: context.filters,
    executive: {
      totalClaims: claims.summary.totalClaims,
      totalBilled: financial.summary.totalBilled,
      totalInsurancePaid: financial.summary.totalInsurancePaid,
      outstandingAr: financial.summary.outstandingAr,
      denialRate: denials.summary.denialRate,
      appealSuccessPercent: appeals.summary.appealSuccessPercent,
      queueDepth: realtime.summary.queueDepth,
      realtimeProcessingHealth: realtime.summary.realtimeProcessingHealth,
      claimsReadyToClose: claimClosure.summary.claimsReadyToClose,
      financialRiskItems: financialRisk.rows.length,
      timelyFilingRiskAlerts: timelyFiling.summary.riskAlerts,
      timelyFilingExpiredAlerts: timelyFiling.summary.expiredAlerts,
      aiFailureCount: aiOperations.summary.aiFailureCount,
    },
    claims: claims.summary,
    financial: financial.summary,
    denials: denials.summary,
    appeals: appeals.summary,
    ar: ar.summary,
    patientBilling: patientBilling.summary,
    productivity: productivity.summary,
    realtime: realtime.summary,
    claimClosure: claimClosure.summary,
    financialRisk: financialRisk.summary,
    timelyFiling: timelyFiling.summary,
    aiOperations: aiOperations.summary,
    trends: {
      claims: claims.trends,
      payments: financial.trends,
      denials: denials.trends,
      patientBilling: patientBilling.trends,
    },
    aiInsights: buildAiInsights({
      denialRate: denials.summary.denialRate,
      appealSuccessRate: appeals.summary.appealSuccessPercent,
      outstandingAr: financial.summary.outstandingAr,
      averageDaysToPayment: claims.summary.averageDaysToPayment,
      payerDenials: denials.byPayer,
      arAging: ar.agingBuckets,
    }),
    drillDownLinks: {
      totalClaims: { target: '/rcm/claims', query: context.filters },
      totalBilled: { target: '/rcm/payment-postings', query: context.filters },
      totalInsurancePaid: { target: '/rcm/payment-postings', query: { ...context.filters, postingStatus: 'POSTED' } },
      outstandingAr: { target: '/rcm/ar-work-items', query: { ...context.filters, status: 'OPEN' } },
      denialRate: { target: '/rcm/denials', query: context.filters },
      appealSuccessPercent: { target: '/rcm/appeals', query: context.filters },
      queueDepth: { target: '/rcm/ops', query: { queueStatus: 'QUEUED' } },
      claimsAwaitingEra: { target: '/rcm/claims', query: { ...context.filters, closureStatus: 'AWAITING_ERA' } },
      claimsReadyToClose: { target: '/rcm/claims', query: { ...context.filters, closureStatus: 'READY_TO_CLOSE' } },
      financialRiskItems: { target: '/rcm/claims', query: { ...context.filters, riskType: 'financial' } },
      timelyFilingRiskAlerts: { target: '/rcm/timely-filing-alerts', query: { ...context.filters, status: 'WARNING' } },
      timelyFilingExpiredAlerts: { target: '/rcm/timely-filing-alerts', query: { ...context.filters, status: 'EXPIRED' } },
      aiFailureCount: { target: '/rcm/audit-logs', query: { ...context.filters, search: 'AI failed' } },
    },
  };
}

function rowsForExport(report: any) {
  if (Array.isArray(report.rows)) return report.rows;
  if (report.executive) {
    return Object.entries(report.executive).map(([metric, value]) => ({ metric, value }));
  }
  if (report.summary) {
    return Object.entries(report.summary).map(([metric, value]) => ({ metric, value: typeof value === 'object' ? JSON.stringify(value) : value }));
  }
  return [];
}

function toCsv(rows: Array<Record<string, unknown>>) {
  const columns = Array.from(rows.reduce<Set<string>>((keys, row) => {
    Object.keys(row).forEach((key) => keys.add(key));
    return keys;
  }, new Set<string>()));
  const escape = (value: unknown) => {
    const text = value instanceof Date ? value.toISOString() : String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    columns.map(escape).join(','),
    ...rows.map((row) => columns.map((column) => escape(row[column])).join(',')),
  ].join('\n');
}

export const reportService = {
  async getReport(kind: ReportKind, query: any = {}) {
    const filters = parseFilters(query);
    const hash = filterHash(kind, filters);
    const now = new Date();
    const cached = await ReportSnapshot.findOne({
      reportType: kind,
      filterHash: hash,
      isDeleted: false,
      refreshStatus: 'FRESH',
      expiresAt: { $gt: now },
    }).lean();
    if (cached?.payload) {
      return {
        ...cached.payload,
        lastRefreshedAt: cached.lastRefreshedAt,
        refreshStatus: cached.refreshStatus,
        cacheHit: true,
      };
    }

    const context = await loadReportContext(filters);
    let report;
    switch (kind) {
      case 'dashboard':
        report = buildDashboard(context);
        break;
      case 'claims':
        report = buildClaimReport(context);
        break;
      case 'financial':
        report = buildFinancialReport(context);
        break;
      case 'denials':
        report = buildDenialReport(context);
        break;
      case 'appeals':
        report = buildAppealReport(context);
        break;
      case 'ar':
        report = buildArReport(context);
        break;
      case 'patient-billing':
        report = buildPatientBillingReport(context);
        break;
      case 'productivity':
        report = buildProductivityReport(context);
        break;
      case 'realtime':
        report = buildRealtimeReport(context);
        break;
      case 'claim-closure':
        report = buildClaimClosureReport(context);
        break;
      case 'financial-risk':
        report = buildFinancialRiskReport(context);
        break;
      case 'timely-filing':
        report = buildTimelyFilingReport(context);
        break;
      case 'ai-operations':
        report = buildAiOperationsReport(context);
        break;
      default:
        report = buildDashboard(context);
    }
    const lastRefreshedAt = new Date();
    const payload = {
      ...report,
      lastRefreshedAt,
      refreshStatus: 'FRESH',
      cacheHit: false,
    };
    await ReportSnapshot.findOneAndUpdate(
      { reportType: kind, filterHash: hash },
      {
        reportType: kind,
        filterHash: hash,
        filters,
        payload,
        lastRefreshedAt,
        refreshStatus: 'FRESH',
        refreshError: undefined,
        expiresAt: new Date(lastRefreshedAt.getTime() + REPORT_CACHE_TTL_MS),
        active: true,
        updated: lastRefreshedAt,
        isDeleted: false,
      },
      { upsert: true, new: true }
    );
    return payload;
  },

  async getRcmOperationsReport(filters: any = {}) {
    return this.getReport('dashboard', filters);
  },

  async exportReport(query: any = {}) {
    const reportType = (typeof query.reportType === 'string' ? query.reportType : 'dashboard') as ReportKind;
    const report = await this.getReport(reportType, { ...query, page: 1, limit: 5000, exportAll: true });
    const csv = [
      `generatedAt,"${new Date().toISOString()}"`,
      `filters,"${JSON.stringify(parseFilters(query)).replace(/"/g, '""')}"`,
      '',
      toCsv(rowsForExport(report)),
    ].join('\n');
    return {
      fileName: `rcm-${reportType}-report.csv`,
      contentType: 'text/csv',
      content: csv,
    };
  },

  async invalidateSnapshots(reason = 'RCM lifecycle event') {
    await ReportSnapshot.updateMany(
      { isDeleted: false, refreshStatus: 'FRESH' },
      {
        refreshStatus: 'STALE',
        refreshError: reason,
        updated: new Date(),
      }
    );
  },
};
