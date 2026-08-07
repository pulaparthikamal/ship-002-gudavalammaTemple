import type { ClientSession } from 'mongoose';
import { createHash } from 'crypto';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { Claim } from './claim.model';
import { ClaimClosureSnapshot } from './claim-closure-snapshot.model';
import { Denial } from '../denial/denial.model';
import { Appeal } from '../appeal/appeal.model';
import { CorrectedClaim } from '../corrected-claim/corrected-claim.model';
import { ArWorkItem } from '../ar-work-item/ar-work-item.model';
import { EraEobProcessing } from '../era-eob-processing/era-eob-processing.model';
import { PaymentPosting } from '../payment-posting/payment-posting.model';
import { PatientBilling } from '../patient-billing/patient-billing.model';
import { Refund } from '../refund/refund.model';
import { Collection } from '../collection/collection.model';
import { EraException } from '../era-exception/era-exception.model';
import { appendStatusHistory } from '../workflow/workflow-history';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { financialEventService } from '../financial-event/financial-event.service';
import { auditLogService } from '../audit-log/audit-log.service';

const OPEN_DENIAL_STATUSES = [
  'OPEN',
  'APPEAL_READY',
  'APPEALED',
  'PAYER_REVIEW',
  'OVERTURNED',
  'PARTIALLY_OVERTURNED',
  'UPHELD',
  'CORRECTED_CLAIM_PENDING',
  'IN_REVIEW',
  'AWAITING_PAYER_RESPONSE',
  'NEEDS_CORRECTION',
  'CORRECTED_CLAIM_READY',
  'CORRECTED_CLAIM_SUBMITTED',
];
const OPEN_APPEAL_STATUSES = ['DRAFT', 'PACKET_GENERATED', 'READY', 'SUBMITTED', 'PAYER_RECEIVED', 'PAYER_REVIEW', 'IN_REVIEW', 'MORE_INFO_REQUIRED', 'EVIDENCE_SUBMITTED'];
const OPEN_CORRECTED_CLAIM_STATUSES = ['DRAFT', 'PACKET_GENERATED', 'READY', 'READY_FOR_REVIEW', 'SUBMITTED', 'PENDING', 'REJECTED'];
const OPEN_AR_STATUSES = ['OPEN', 'IN_PROGRESS', 'PENDING', 'ESCALATED', 'APPEAL_DRAFT', 'AWAITING_REPROCESSED_ERA', 'CORRECTED_CLAIM_PENDING', 'WRITE_OFF_REVIEW', 'FOLLOW_UP_REQUIRED', 'PARTIALLY_RESOLVED', 'WAITING_ON_INTERNAL'];
const UNRECONCILED_ERA_STATUSES = ['RECEIVED', 'PARSED', 'POSTED', 'PARTIALLY_POSTED', 'EXCEPTION'];
const OPEN_BILLING_STATUSES = ['OPEN', 'READY_TO_SEND', 'SENT', 'PARTIALLY_PAID', 'PENDING', 'PAST_DUE', 'OVERDUE', 'COLLECTIONS', 'COLLECTIONS_READY', 'PAYMENT_PLAN'];
const OPEN_REFUND_STATUSES = ['REQUESTED', 'PENDING', 'PENDING_REVIEW', 'APPROVED', 'READY'];
const OPEN_COLLECTION_STATUSES = ['REVIEW', 'ACTIVE', 'OPEN', 'CONTACTED', 'PAYMENT_PLAN', 'EXTERNAL_COLLECTIONS_READY', 'ESCALATED'];

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildBlocker(label: string, count: number, action: string) {
  return count > 0 ? `${label}: ${count}. ${action}` : undefined;
}

function caseInsensitiveStatusMatcher(statuses: string[]) {
  return {
    $in: statuses.flatMap((status) => [status, status.toLowerCase(), status.toUpperCase()]),
  };
}

function stableValue(value: any): any {
  if (value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === 'object') {
    if (typeof value.toHexString === 'function') {
      return value.toHexString();
    }
    return Object.keys(value)
      .sort()
      .reduce((result: Record<string, unknown>, key) => {
        result[key] = stableValue(value[key]);
        return result;
      }, {});
  }
  return value;
}

function hashClosureSnapshot(payload: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify(stableValue(payload))).digest('hex');
}

function buildClaimStatusSnapshot(claim: any) {
  return {
    claimId: String(claim._id),
    claimBusinessId: claim.claimId ? String(claim.claimId) : undefined,
    claimStatus: claim.claimStatus,
    scrubStatus: claim.scrubStatus,
    submissionStatus: claim.submissionStatus,
    paymentStatus: claim.paymentStatus,
    closureStatus: claim.closureStatus,
    closeReason: claim.closeReason,
    closedAt: claim.closedAt,
    closedBy: claim.closedBy ? String(claim.closedBy) : undefined,
    reopenReason: claim.reopenReason,
    reopenedAt: claim.reopenedAt,
    reopenedBy: claim.reopenedBy ? String(claim.reopenedBy) : undefined,
    totalChargeAmount: roundCurrency(Number(claim.totalChargeAmount ?? 0)),
    financialLedgerSequence: Number(claim.financialLedgerSequence ?? 0),
    financialLedgerHeadHash: claim.financialLedgerHeadHash,
    updated: claim.updated,
    updatedBy: claim.updatedBy ? String(claim.updatedBy) : undefined,
  };
}

async function createClosureSnapshot(input: {
  eventType: 'CLAIM_CLOSED' | 'CLAIM_REOPENED' | 'CLAIM_AUTO_REOPENED';
  reason: string;
  evaluation: Awaited<ReturnType<typeof evaluateClaimClosure>>;
  claim?: any;
  financialEvent?: any;
  createdBy: string;
  session?: ClientSession;
}) {
  const claim = input.claim ?? input.evaluation.claim;
  const created = new Date();
  let lastError: any;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const previousSnapshot = await ClaimClosureSnapshot.findOne({ claimId: claim._id, isDeleted: false })
      .sort({ snapshotSequence: -1 })
      .session(input.session ?? null)
      .lean();
    const snapshotSequence = Number(previousSnapshot?.snapshotSequence ?? 0) + 1;
    const previousSnapshotHash = previousSnapshot?.snapshotHash;
    const financialLedgerSequence = Number(input.financialEvent?.ledgerSequence ?? claim.financialLedgerSequence ?? 0);
    const financialLedgerHeadHash = input.financialEvent?.ledgerHash ?? claim.financialLedgerHeadHash;
    const claimStatusSnapshot = {
      ...buildClaimStatusSnapshot(claim),
      financialLedgerSequence,
      financialLedgerHeadHash,
    };
    const snapshotPayload = {
      claimId: String(claim._id),
      claimBusinessId: claim.claimId ? String(claim.claimId) : undefined,
      eventType: input.eventType,
      closureStatus: claim.closureStatus,
      reason: input.reason,
      canClose: input.evaluation.canClose,
      blockers: input.evaluation.blockers,
      counts: input.evaluation.counts,
      financial: input.evaluation.financial,
      claimStatusSnapshot,
      financialLedgerSequence,
      financialLedgerHeadHash,
      snapshotSequence,
      previousSnapshotHash,
      createdBy: input.createdBy,
      created,
    };
    const snapshotHash = hashClosureSnapshot(snapshotPayload);

    try {
      const [snapshot] = await ClaimClosureSnapshot.create([{
        ...snapshotPayload,
        snapshotHash,
        active: true,
        updated: created,
        updatedBy: input.createdBy,
        isDeleted: false,
      }], { session: input.session });
      return snapshot;
    } catch (error: any) {
      lastError = error;
      if (error?.code !== 11000) {
        throw error;
      }
    }
  }

  throw lastError ?? new AppError('Unable to write claim closure snapshot.', HTTP_STATUS.CONFLICT);
}

async function evaluateClaimClosure(claimId: string, session?: ClientSession) {
  const claim = await Claim.findOne({ _id: claimId, isDeleted: false }).session(session ?? null);
  if (!claim) {
    throw new AppError('Claim not found.', HTTP_STATUS.NOT_FOUND);
  }

  const [
    openDenials,
    openAppeals,
    openCorrectedClaims,
    openArItems,
    unreconciledEras,
    openEraExceptions,
    openBillings,
    pendingCollections,
    pendingRefunds,
    activePostings,
    reversedPostings,
  ] = await Promise.all([
    Denial.countDocuments({ claimId, isDeleted: false, denialStatus: { $in: OPEN_DENIAL_STATUSES } }).session(session ?? null),
    Appeal.countDocuments({ claimId, isDeleted: false, appealStatus: { $in: OPEN_APPEAL_STATUSES } }).session(session ?? null),
    CorrectedClaim.countDocuments({
      $or: [{ originalClaimId: claimId }, { clonedClaimId: claimId }, { claimId }],
      isDeleted: false,
      correctedClaimStatus: { $in: OPEN_CORRECTED_CLAIM_STATUSES },
    }).session(session ?? null),
    ArWorkItem.countDocuments({ claimId, isDeleted: false, status: caseInsensitiveStatusMatcher(OPEN_AR_STATUSES) }).session(session ?? null),
    EraEobProcessing.countDocuments({
      isDeleted: false,
      reconciliationStatus: { $in: UNRECONCILED_ERA_STATUSES },
      matchedClaims: { $elemMatch: { claimId } },
    }).session(session ?? null),
    EraException.countDocuments({
      isDeleted: false,
      relatedClaim: claimId,
      status: { $in: ['OPEN', 'IN_REVIEW', 'ESCALATED', 'REPROCESSING'] },
    }).session(session ?? null),
    PatientBilling.find({ claimId, isDeleted: false, status: { $in: OPEN_BILLING_STATUSES } }).session(session ?? null).lean(),
    Collection.countDocuments({ claimId, isDeleted: false, status: { $in: OPEN_COLLECTION_STATUSES } }).session(session ?? null),
    Refund.countDocuments({ claimId, isDeleted: false, refundStatus: { $in: OPEN_REFUND_STATUSES } }).session(session ?? null),
    PaymentPosting.find({ claimId, isDeleted: false, postingStatus: { $ne: 'REVERSED' } }).session(session ?? null).lean(),
    PaymentPosting.countDocuments({ claimId, isDeleted: false, postingStatus: 'REVERSED', reversalReason: { $exists: false } }).session(session ?? null),
  ]);

  const billedOpenBalance = openBillings.reduce((sum: number, billing: any) => sum + Number(billing.currentBalance ?? billing.amountDue ?? 0), 0);
  const ledgerSnapshot = await financialEventService.buildClaimFinancialBalanceSnapshot(claimId, session);
  const paidAmount = Number((ledgerSnapshot as any).postedAmount ?? activePostings.reduce((sum: number, posting: any) => sum + Number(posting.postedAmount ?? 0), 0));
  const remainingBalance = roundCurrency(Number((ledgerSnapshot as any).remainingBalance ?? Number(claim.totalChargeAmount ?? 0) - paidAmount));
  const payerResponsibilityBalance = Number((ledgerSnapshot as any).payerResponsibilityBalance ?? remainingBalance);
  const patientResponsibilityBalance = Number((ledgerSnapshot as any).patientResponsibilityBalance ?? billedOpenBalance);
  const pendingRefundAmount = Number((ledgerSnapshot as any).pendingRefundAmount ?? 0);
  const unresolvedReversalAmount = Number((ledgerSnapshot as any).unresolvedReversalAmount ?? 0);
  const unreconciledPaymentAmount = Number((ledgerSnapshot as any).unreconciledPaymentAmount ?? 0);
  const recoupmentBalance = Number((ledgerSnapshot as any).recoupmentBalance ?? 0);
  const takebackBalance = Number((ledgerSnapshot as any).takebackBalance ?? 0);
  const paymentBalanced = Boolean((ledgerSnapshot as any).ledgerBalanced)
    && payerResponsibilityBalance <= 0.01
    && patientResponsibilityBalance <= 0.01
    && pendingRefundAmount <= 0.01
    && unresolvedReversalAmount <= 0.01
    && unreconciledPaymentAmount <= 0.01
    && recoupmentBalance <= 0.01
    && takebackBalance <= 0.01;

  const blockers = [
    buildBlocker('Open denials remain', openDenials, 'Resolve, write off, or transfer every denial.'),
    buildBlocker('Open appeals remain', openAppeals, 'Close appeal outcomes or wait for reprocessed payment.'),
    buildBlocker('Open corrected claims remain', openCorrectedClaims, 'Submit and adjudicate corrected claims.'),
    buildBlocker('Open AR work items remain', openArItems, 'Close operational follow-up work.'),
    buildBlocker('Open ERA exceptions remain', openEraExceptions, 'Resolve, reprocess, or ignore ERA exceptions with a reason.'),
    buildBlocker('Unreconciled ERA records remain', unreconciledEras, 'Reconcile or resolve ERA exceptions.'),
    buildBlocker('Patient responsibility remains open', billedOpenBalance > 0.01 ? 1 : 0, 'Collect, settle, write off, or transfer balance.'),
    buildBlocker('Pending collections remain', pendingCollections, 'Close or resolve collection activity.'),
    buildBlocker('Pending refunds remain', pendingRefunds, 'Process or cancel pending refunds.'),
    buildBlocker('Pending reversals remain', reversedPostings, 'Complete reversal audit and downstream propagation.'),
    paymentBalanced ? undefined : 'Ledger balances are not balanced. Resolve payer balance, patient balance, reversals, refunds, takebacks, or unreconciled payments before closure.',
  ].filter((value): value is string => Boolean(value));

  return {
    claim,
    canClose: blockers.length === 0,
    blockers,
    counts: {
      openDenials,
      openAppeals,
      openCorrectedClaims,
      openArItems,
      openEraExceptions,
      unreconciledEras,
      openBillings: openBillings.length,
      pendingCollections,
      pendingRefunds,
      reversedPostings,
    },
    financial: {
      totalChargeAmount: roundCurrency(Number(claim.totalChargeAmount ?? 0)),
      paidAmount: roundCurrency(paidAmount),
      remainingBalance,
      patientOpenBalance: roundCurrency(billedOpenBalance),
      paymentBalanced,
      payerResponsibilityBalance: roundCurrency(payerResponsibilityBalance),
      patientResponsibilityBalance: roundCurrency(patientResponsibilityBalance),
      pendingRefundAmount: roundCurrency(pendingRefundAmount),
      unresolvedReversalAmount: roundCurrency(unresolvedReversalAmount),
      unreconciledPaymentAmount: roundCurrency(unreconciledPaymentAmount),
      recoupmentBalance: roundCurrency(recoupmentBalance),
      takebackBalance: roundCurrency(takebackBalance),
      ledgerBalanced: Boolean((ledgerSnapshot as any).ledgerBalanced),
      ledgerSnapshot,
    },
  };
}

async function syncClaimClosureStatus(claimId: string, updatedBy: string, session?: ClientSession) {
  const evaluation = await evaluateClaimClosure(claimId, session);
  const claim = evaluation.claim;
  const previousStatus = claim.closureStatus;
  let nextStatus = claim.closureStatus ?? 'OPEN';
  const reopenedBecauseFinanciallyBlocked = Boolean(claim.closedAt && !evaluation.canClose);
  const automaticReopenReason = `Automatically reopened after financial or lifecycle change introduced closure blockers: ${evaluation.blockers.join(' ')}`;
  const hasFinancialActivity = Boolean(
    ['PAID', 'PAYMENT_RECEIVED', 'PARTIALLY_PAID', 'PATIENT_RESPONSIBILITY', 'UNDERPAID', 'DENIED'].includes(String(claim.paymentStatus ?? '').toUpperCase())
    || Number(evaluation.financial?.paidAmount ?? 0) > 0
    || Number(evaluation.financial?.ledgerSnapshot?.postedAmount ?? 0) > 0
    || Number(evaluation.financial?.ledgerSnapshot?.postingCount ?? 0) > 0
    || Number(evaluation.financial?.ledgerSnapshot?.adjustmentCount ?? 0) > 0
    || Number(evaluation.financial?.ledgerSnapshot?.patientBillingCount ?? 0) > 0
  );

  if (reopenedBecauseFinanciallyBlocked) {
    nextStatus = 'REOPENED';
    claim.reopenReason = automaticReopenReason;
    claim.reopenedBy = updatedBy as any;
    claim.reopenedAt = new Date();
    claim.closedAt = undefined;
    claim.closedBy = undefined;
    claim.closeReason = undefined;
  } else if (claim.closedAt) {
    nextStatus = 'CLOSED';
  } else if (evaluation.canClose) {
    nextStatus = 'READY_TO_CLOSE';
  } else if (claim.paymentStatus === 'DENIED') {
    nextStatus = 'DENIED';
  } else if (claim.paymentStatus === 'PARTIALLY_PAID' || claim.paymentStatus === 'UNDERPAID') {
    nextStatus = 'PARTIALLY_PAID';
  } else if (hasFinancialActivity) {
    nextStatus = 'FOLLOW_UP_REQUIRED';
  } else if (claim.submissionStatus === 'Acknowledged') {
    nextStatus = 'AWAITING_ERA';
  } else if (claim.submissionStatus && ['Submitted', 'Transmitted'].includes(claim.submissionStatus)) {
    nextStatus = 'IN_PROGRESS';
  } else if (claim.closureStatus === 'REOPENED') {
    nextStatus = 'REOPENED';
  } else {
    nextStatus = 'OPEN';
  }

  claim.closureStatus = nextStatus;
  claim.financialBalanceSnapshot = await financialEventService.buildClaimFinancialBalanceSnapshot(claimId, session);
  if (previousStatus !== nextStatus) {
    claim.statusHistory = appendStatusHistory(
      claim.statusHistory,
      nextStatus,
      updatedBy,
      reopenedBecauseFinanciallyBlocked
        ? automaticReopenReason
        : evaluation.canClose
          ? 'Claim meets financial and operational close criteria'
          : 'Claim closure status synchronized'
    );
  }
  claim.updated = new Date();
  claim.updatedBy = updatedBy as any;
  await claim.save({ session });

  if (reopenedBecauseFinanciallyBlocked && previousStatus !== 'REOPENED') {
    const financialEvent = await financialEventService.record({
      eventType: 'CLAIM_REOPENED',
      sourceModule: 'claimClosure',
      claimId,
      reason: automaticReopenReason,
      metadata: { trigger: 'FINANCIAL_OR_LIFECYCLE_BLOCKER', blockers: evaluation.blockers },
      createdBy: updatedBy,
      session,
    });
    await createClosureSnapshot({
      eventType: 'CLAIM_AUTO_REOPENED',
      reason: automaticReopenReason,
      evaluation,
      claim,
      financialEvent,
      createdBy: updatedBy,
      session,
    });
    publishRcmRealtimeEvent({
      eventType: 'CLAIM_REOPENED',
      title: 'Claim reopened',
      message: `Claim ${claim.claimId ?? claim._id} was reopened because a financial or lifecycle blocker was detected.`,
      entityType: 'claim',
      entityId: String(claim._id),
      claimId: String(claim._id),
      status: nextStatus,
    });
  }

  if (nextStatus === 'READY_TO_CLOSE' && previousStatus !== 'READY_TO_CLOSE') {
    publishRcmRealtimeEvent({
      eventType: 'CLAIM_READY_TO_CLOSE',
      title: 'Claim ready to close',
      message: `Claim ${claim.claimId ?? claim._id} meets closure criteria.`,
      entityType: 'claim',
      entityId: String(claim._id),
      claimId: String(claim._id),
      status: nextStatus,
    });
  }

  return { claim, evaluation };
}

export const claimClosureService = {
  evaluate: evaluateClaimClosure,
  syncClaimClosureStatus,

  async listSnapshots(claimId: string, session?: ClientSession) {
    return ClaimClosureSnapshot.find({ claimId, isDeleted: false })
      .sort({ snapshotSequence: -1 })
      .session(session ?? null)
      .lean();
  },

  async reopenForFinancialMutation(claimId: string, mutationReason: string, updatedBy: string, session?: ClientSession) {
    const claim = await Claim.findOne({ _id: claimId, isDeleted: false }).session(session ?? null);
    if (!claim) {
      throw new AppError('Claim not found.', HTTP_STATUS.NOT_FOUND);
    }
    if (!claim.closedAt && claim.closureStatus !== 'CLOSED') {
      return false;
    }
    await this.reopen(claimId, `Financial mutation required reopen: ${mutationReason}`, updatedBy, session);
    return true;
  },

  async close(claimId: string, reason: string, updatedBy: string, session?: ClientSession) {
    if (!reason?.trim()) {
      throw new AppError('Claim close reason is required.', HTTP_STATUS.BAD_REQUEST);
    }

    const evaluation = await evaluateClaimClosure(claimId, session);
    if (!evaluation.canClose) {
      throw new AppError(`Claim cannot be closed: ${evaluation.blockers.join(' ')}`, HTTP_STATUS.BAD_REQUEST);
    }

    const claim = evaluation.claim;
    claim.closureStatus = 'CLOSED';
    claim.closeReason = reason.trim();
    claim.closedBy = updatedBy as any;
    claim.closedAt = new Date();
    claim.statusHistory = appendStatusHistory(claim.statusHistory, 'CLOSED', updatedBy, reason.trim());
    claim.financialBalanceSnapshot = await financialEventService.buildClaimFinancialBalanceSnapshot(claimId, session);
    claim.updated = new Date();
    claim.updatedBy = updatedBy as any;
    await claim.save({ session });

    const financialEvent = await financialEventService.record({
      eventType: 'CLAIM_CLOSED',
      sourceModule: 'claimClosure',
      claimId,
      reason: reason.trim(),
      createdBy: updatedBy,
      session,
    });
    const closureSnapshot = await createClosureSnapshot({
      eventType: 'CLAIM_CLOSED',
      reason: reason.trim(),
      evaluation,
      claim,
      financialEvent,
      createdBy: updatedBy,
      session,
    });

    publishRcmRealtimeEvent({
      eventType: 'CLAIM_CLOSED',
      title: 'Claim closed',
      message: `Claim ${claim.claimId ?? claim._id} was closed.`,
      entityType: 'claim',
      entityId: String(claim._id),
      claimId: String(claim._id),
      status: 'CLOSED',
    });

    await auditLogService.record({
      entityType: 'claim',
      entityId: claim._id,
      action: 'CLAIM_CLOSED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'claimClosure',
      reason: reason.trim(),
      claimId,
      financialEventId: financialEvent._id,
      previousState: { closureStatus: evaluation.claim.closureStatus },
      newState: { closureStatus: 'CLOSED', closedAt: claim.closedAt },
      session,
    });

    return { claim, evaluation, closureSnapshot };
  },

  async reopen(claimId: string, reason: string, updatedBy: string, session?: ClientSession) {
    if (!reason?.trim()) {
      throw new AppError('Claim reopen reason is required.', HTTP_STATUS.BAD_REQUEST);
    }

    const claim = await Claim.findOne({ _id: claimId, isDeleted: false }).session(session ?? null);
    if (!claim) {
      throw new AppError('Claim not found.', HTTP_STATUS.NOT_FOUND);
    }

    claim.closureStatus = 'REOPENED';
    claim.reopenReason = reason.trim();
    claim.reopenedBy = updatedBy as any;
    claim.reopenedAt = new Date();
    claim.closedAt = undefined;
    claim.closedBy = undefined;
    claim.closeReason = undefined;
    claim.statusHistory = appendStatusHistory(claim.statusHistory, 'REOPENED', updatedBy, reason.trim());
    claim.updated = new Date();
    claim.updatedBy = updatedBy as any;
    await claim.save({ session });

    const financialEvent = await financialEventService.record({
      eventType: 'CLAIM_REOPENED',
      sourceModule: 'claimClosure',
      claimId,
      reason: reason.trim(),
      createdBy: updatedBy,
      session,
    });
    const evaluation = await evaluateClaimClosure(claimId, session);
    const closureSnapshot = await createClosureSnapshot({
      eventType: 'CLAIM_REOPENED',
      reason: reason.trim(),
      evaluation,
      claim,
      financialEvent,
      createdBy: updatedBy,
      session,
    });

    publishRcmRealtimeEvent({
      eventType: 'CLAIM_REOPENED',
      title: 'Claim reopened',
      message: `Claim ${claim.claimId ?? claim._id} was reopened.`,
      entityType: 'claim',
      entityId: String(claim._id),
      claimId: String(claim._id),
      status: 'REOPENED',
    });

    await auditLogService.record({
      entityType: 'claim',
      entityId: claim._id,
      action: 'CLAIM_REOPENED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'claimClosure',
      reason: reason.trim(),
      claimId,
      financialEventId: financialEvent._id,
      previousState: { closureStatus: 'CLOSED' },
      newState: { closureStatus: 'REOPENED', reopenedAt: claim.reopenedAt },
      session,
    });

    return { claim, evaluation, closureSnapshot };
  },
};
