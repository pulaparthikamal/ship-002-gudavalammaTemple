import { Appeal, IAppeal } from './appeal.model';
import { Denial, IDenial } from '../denial/denial.model';
import { ArWorkItem } from '../ar-work-item/ar-work-item.model';
import { Claim, IClaim } from '../claim/claim.model';
import { IPaymentPosting, PaymentPosting } from '../payment-posting/payment-posting.model';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import type { ClientSession } from 'mongoose';
import { claimClosureService } from '../claim/claim-closure.service';
import { correctedClaimService } from '../corrected-claim/corrected-claim.service';
import { EraException } from '../era-exception/era-exception.model';
import { assertDenialTransition } from '../denial/denial-workflow.service';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { auditLogService } from '../audit-log/audit-log.service';

const PAYMENT_ELIGIBLE_DENIAL_STATUSES = [
  'OVERTURNED',
  'PARTIALLY_OVERTURNED',
  'CORRECTED_CLAIM_PENDING',
];

function roundCurrency(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function addDenialHistory(denial: IDenial, nextStatus: string, options: {
  reason?: string;
  userId?: string;
  source: string;
  appealId?: unknown;
  paymentPostingId?: unknown;
  eraEobProcessingId?: unknown;
}) {
  const previousStatus = denial.denialStatus ?? 'OPEN';
  denial.statusHistory = [
    ...(denial.statusHistory ?? []),
    {
      previousStatus,
      newStatus: nextStatus,
      reason: options.reason,
      userId: options.userId,
      timestamp: new Date(),
      source: options.source,
      appealId: options.appealId,
      paymentPostingId: options.paymentPostingId,
      eraEobProcessingId: options.eraEobProcessingId,
    },
  ];
}

async function updateArForDenial(denial: IDenial, status: string, options: {
  balanceAmount?: number;
  nextAction?: string;
  updatedBy?: string;
  session?: ClientSession;
}) {
  if (!denial.arWorkItemId) return null;
  const update: Record<string, unknown> = {
    status,
    updated: new Date(),
    updatedBy: options.updatedBy,
  };
  if (options.balanceAmount !== undefined) update.balanceAmount = roundCurrency(options.balanceAmount);
  if (options.nextAction !== undefined) update.nextAction = options.nextAction;

  const item = await ArWorkItem.findOneAndUpdate(
    { _id: denial.arWorkItemId, isDeleted: false },
    update,
    { new: true, session: options.session },
  );

  if (item) {
    publishRcmRealtimeEvent({
      eventType: 'AR_STATUS_CHANGED',
      title: 'AR work item updated',
      claimId: denial.claimId ? String(denial.claimId) : undefined,
      entityType: 'arWorkItem',
      entityId: String(item._id),
      status: item.status,
    });
  }

  return item;
}

function toDateOnly(value: unknown) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function scorePaymentLineForDenial(line: any, paymentPosting: IPaymentPosting, denial: IDenial, appeal?: IAppeal | null) {
  const signals: string[] = [];
  let score = 20; // The posting query already requires the same internal claim.
  signals.push('claimId');

  if (denial.payerId && paymentPosting.payerId) {
    if (String(denial.payerId) !== String(paymentPosting.payerId)) return { score: 0, signals: ['payerMismatch'] };
    score += 10;
    signals.push('payerId');
  }

  if (denial.claimLineId && line.claimLineId && String(denial.claimLineId) === String(line.claimLineId)) {
    score += 40;
    signals.push('claimLineId');
  }
  if (denial.cptCode && line.procedureCode && denial.cptCode === line.procedureCode) {
    score += 10;
    signals.push('cpt');
  }
  const denialDate = toDateOnly((denial.serviceLineDetails as any)?.serviceDate ?? (denial.serviceLineDetails as any)?.dateOfService);
  const paymentDate = toDateOnly(line.serviceDate);
  if (denialDate && paymentDate && denialDate === paymentDate) {
    score += 10;
    signals.push('dos');
  }
  const remainingBalance = Number(denial.remainingDeniedBalance ?? denial.denialAmount ?? 0);
  if (remainingBalance > 0 && line.paidAmount && Math.abs(remainingBalance - Number(line.paidAmount)) <= 1) {
    score += 10;
    signals.push('paymentAmountTolerance');
  }
  const details = denial.serviceLineDetails as any;
  if (details?.payerClaimNumber && paymentPosting.payerClaimNumber && details.payerClaimNumber === paymentPosting.payerClaimNumber) {
    score += 10;
    signals.push('payerClaimNumber');
  }
  if (details?.claimControlNumber && paymentPosting.claimControlNumber && details.claimControlNumber === paymentPosting.claimControlNumber) {
    score += 10;
    signals.push('claimControlNumber');
  }
  if (details?.denialId && String(details.denialId) === String(denial._id)) {
    score += 10;
    signals.push('denialId');
  }
  if (details?.appealId && appeal?._id && String(details.appealId) === String(appeal._id)) {
    score += 10;
    signals.push('appealId');
  }
  if (
    Array.isArray(line.adjustmentCodes)
    && (denial.carcCodes ?? []).some((code) => line.adjustmentCodes.some((adjustmentCode: string) => adjustmentCode.endsWith(`-${code}`)))
  ) {
    score += 5;
    signals.push('adjustmentCode');
  }

  return { score: Math.min(100, score), signals };
}

function paymentMatchForDenial(paymentPosting: IPaymentPosting, denial: IDenial, appeal?: IAppeal | null, allocatedLineIndexes = new Set<number>()) {
  const lines = paymentPosting.paymentLines ?? [];
  const scored = lines
    .map((line, lineIndex) => ({ line, lineIndex, ...scorePaymentLineForDenial(line, paymentPosting, denial, appeal) }))
    .filter((entry) => {
      const paidAmount = Number(entry.line.paidAmount ?? 0);
      const patientRespAmount = Number((entry.line as any).patientRespAmount ?? (entry.line as any).patientResponsibilityAmount ?? 0);
      return (paidAmount > 0 || patientRespAmount > 0) && !allocatedLineIndexes.has(entry.lineIndex);
    })
    .sort((left, right) => right.score - left.score);
  const bestScore = scored[0]?.score ?? 0;
  const bestMatches = scored.filter((entry) => entry.score === bestScore);
  const hasStableLineMatch = bestMatches[0]?.signals.includes('claimLineId')
    || (bestMatches[0]?.signals.includes('cpt') && bestMatches[0]?.signals.includes('dos'));
  const ambiguous = bestMatches.length > 1;
  const autoResolvable = bestScore >= 70 && Boolean(hasStableLineMatch) && !ambiguous;
  const matchedLine = autoResolvable ? bestMatches[0] : undefined;
  const paidAmount = matchedLine ? roundCurrency(Number(matchedLine.line.paidAmount ?? 0)) : 0;
  const patientRespAmount = matchedLine
    ? roundCurrency(Number((matchedLine.line as any).patientRespAmount ?? (matchedLine.line as any).patientResponsibilityAmount ?? 0))
    : 0;
  const deniedAmount = matchedLine ? roundCurrency(Number((matchedLine.line as any).deniedAmount ?? 0)) : 0;
  const adjustmentAmount = matchedLine ? roundCurrency(Number((matchedLine.line as any).adjustmentAmount ?? 0)) : 0;
  const patientResponsibilityResolutionAmount = deniedAmount <= 0 ? patientRespAmount : 0;
  const contractualResolutionAmount = deniedAmount <= 0 && (paidAmount > 0 || patientRespAmount > 0)
    ? adjustmentAmount
    : 0;
  return {
    paidAmount,
    patientRespAmount,
    contractualResolutionAmount,
    patientResponsibilityResolutionAmount,
    resolutionAmount: roundCurrency(paidAmount + patientResponsibilityResolutionAmount + contractualResolutionAmount),
    line: matchedLine?.line,
    lineIndex: matchedLine?.lineIndex,
    confidenceScore: bestScore,
    signals: bestMatches.flatMap((entry) => entry.signals),
    ambiguous,
    autoResolvable,
  };
}

async function setClaimPaymentStatus(claim: IClaim | null, status: string, updatedBy?: string, session?: ClientSession) {
  if (!claim) return;
  claim.paymentStatus = status;
  claim.updated = new Date();
  if (updatedBy) claim.updatedBy = updatedBy as any;
  await claim.save({ session });
}

export const appealResolutionService = {
  async handleAppealOutcome(
    appeal: IAppeal,
    outcomeStatus: string,
    data: any,
    locale: string,
    updatedBy: string,
    options: { session?: ClientSession } = {},
  ) {
    const denial = appeal.denialId
      ? await Denial.findOne({ _id: appeal.denialId, isDeleted: false }).session(options.session ?? null)
      : null;
    if (!denial) return null;

    let denialStatus = outcomeStatus;
    let arStatus = 'FOLLOW_UP_REQUIRED';
    let nextAction = 'Review payer appeal decision and determine next action.';

    if (outcomeStatus === 'OVERTURNED') {
      denialStatus = 'OVERTURNED';
      arStatus = 'AWAITING_REPROCESSED_ERA';
      nextAction = 'Wait for reprocessed ERA/payment from payer.';
    } else if (outcomeStatus === 'PARTIALLY_OVERTURNED') {
      denialStatus = 'PARTIALLY_OVERTURNED';
      arStatus = 'AWAITING_REPROCESSED_ERA';
      nextAction = 'Monitor for partial reprocessed payment and remaining denial balance.';
    } else if (outcomeStatus === 'UPHELD') {
      denialStatus = 'UPHELD';
      arStatus = 'WRITE_OFF_REVIEW';
      nextAction = 'Review write-off, corrected claim, patient billing, or collections path.';
    }

    try {
      assertDenialTransition(denial.denialStatus, denialStatus, {
        source: 'APPEAL_OUTCOME',
        reason: data?.decisionNotes ?? data?.reason ?? `Appeal outcome ${outcomeStatus}.`,
      });
    } catch (error) {
      throw new AppError(error instanceof Error ? error.message : 'Invalid denial transition.', HTTP_STATUS.BAD_REQUEST);
    }

    addDenialHistory(denial, denialStatus, {
      reason: data?.decisionNotes ?? data?.reason ?? `Appeal outcome ${outcomeStatus}.`,
      userId: updatedBy,
      source: 'APPEAL_OUTCOME',
      appealId: appeal._id,
      paymentPostingId: data?.relatedPaymentPostingId,
      eraEobProcessingId: data?.relatedEraId,
    });
    denial.appealId = appeal._id;
    denial.denialStatus = denialStatus;
    denial.updated = new Date();
    denial.updatedBy = updatedBy as any;
    denial.resolutionNotes = data?.decisionNotes ?? denial.resolutionNotes;
    if (data?.relatedPaymentPostingId) {
      denial.relatedPaymentPostingIds = Array.from(new Set([
        ...(denial.relatedPaymentPostingIds ?? []).map(String),
        String(data.relatedPaymentPostingId),
      ])) as any;
    }
    await denial.save({ session: options.session });

    await updateArForDenial(denial, arStatus, {
      nextAction,
      updatedBy,
      session: options.session,
    });

    const eventType = outcomeStatus === 'UPHELD'
      ? 'APPEAL_UPHELD'
      : outcomeStatus === 'PARTIALLY_OVERTURNED'
        ? 'APPEAL_PARTIALLY_OVERTURNED'
        : 'APPEAL_OVERTURNED';
    publishRcmRealtimeEvent({
      eventType,
      title: `Appeal ${outcomeStatus.toLowerCase().replace(/_/g, ' ')}`,
      claimId: denial.claimId ? String(denial.claimId) : undefined,
      entityType: 'appeal',
      entityId: String(appeal._id),
      status: outcomeStatus,
    });

    publishRcmRealtimeEvent({
      eventType: 'DENIAL_STATUS_CHANGED',
      title: 'Denial status changed',
      claimId: denial.claimId ? String(denial.claimId) : undefined,
      entityType: 'denial',
      entityId: String(denial._id),
      status: denial.denialStatus,
    });

    if (denial.claimId) {
      await claimClosureService.syncClaimClosureStatus(String(denial.claimId), updatedBy, options.session);
    }

    return denial;
  },

  async resolveFromPaymentPosting(paymentPosting: IPaymentPosting, options: {
    claim?: IClaim | null;
    updatedBy?: string;
    session?: ClientSession;
  } = {}) {
    if (!paymentPosting.claimId) return [];

    const claim = options.claim ?? await Claim.findOne({ _id: paymentPosting.claimId, isDeleted: false }).session(options.session ?? null);
    const denials = await Denial.find({
      isDeleted: false,
      claimId: paymentPosting.claimId,
      denialStatus: { $in: PAYMENT_ELIGIBLE_DENIAL_STATUSES },
    }).session(options.session ?? null);

    const resolved: IDenial[] = [];
    const allocatedLineIndexes = new Set<number>();
    let paymentPostingChanged = false;
    for (const denial of denials) {
      const paymentAlreadyApplied = (denial.relatedPaymentPostingIds ?? []).some((id) => String(id) === String(paymentPosting._id));
      if (paymentAlreadyApplied) continue;

      const appeal = denial.appealId
        ? await Appeal.findOne({ _id: denial.appealId, isDeleted: false }).session(options.session ?? null)
        : await Appeal.findOne({ denialId: denial._id, isDeleted: false }).session(options.session ?? null);
      const match = paymentMatchForDenial(paymentPosting, denial, appeal, allocatedLineIndexes);
      const competingDenials = match.autoResolvable && match.lineIndex !== undefined
        ? denials.filter((candidate) => String(candidate._id) !== String(denial._id)).filter((candidate) => {
          const competingMatch = paymentMatchForDenial(paymentPosting, candidate, null, allocatedLineIndexes);
          return competingMatch.autoResolvable && competingMatch.lineIndex === match.lineIndex;
        })
        : [];
      const requiresManualReview = match.ambiguous || competingDenials.length > 0;
      if (!match.autoResolvable || match.resolutionAmount <= 0 || requiresManualReview) {
        if (match.confidenceScore > 0) {
          await EraException.create([{
            exceptionType: requiresManualReview ? 'SERVICE_LINE_MISMATCH' : 'UNRESOLVED_ADJUSTMENT',
            severity: requiresManualReview ? 'HIGH' : 'MEDIUM',
            status: 'OPEN',
            relatedClaim: paymentPosting.claimId,
            relatedERA: paymentPosting.eraEobProcessingId,
            relatedPaymentPosting: paymentPosting._id,
            relatedDenial: denial._id,
            resolutionNotes: `Reprocessed payment match confidence ${match.confidenceScore}; manual review required before denial resolution.${competingDenials.length ? ' Payment line matched more than one denial.' : ''}`,
            actionHistory: [{
              action: 'MANUAL_REVIEW_CREATED',
              note: `Signals: ${Array.from(new Set(match.signals)).join(', ') || 'none'}.`,
              performedAt: new Date(),
              performedBy: options.updatedBy,
            }],
            active: true,
            created: new Date(),
            updated: new Date(),
            createdBy: options.updatedBy,
            updatedBy: options.updatedBy,
          }], { session: options.session });
          denial.manualReviewRequired = true;
          denial.matchConfidence = match.confidenceScore;
          denial.matchedBy = Array.from(new Set(match.signals));
          denial.updated = new Date();
          await denial.save({ session: options.session });
          await auditLogService.record({
            entityType: 'denial',
            entityId: denial._id,
            action: 'PAYMENT_AMBIGUITY_EXCEPTION_CREATED',
            userId: options.updatedBy,
            changedBy: options.updatedBy,
            source: 'appealResolution',
            claimId: denial.claimId,
            payerId: denial.payerId,
            reason: `Reprocessed payment match confidence ${match.confidenceScore}; manual review required.`,
            newState: {
              matchConfidence: match.confidenceScore,
              matchedBy: Array.from(new Set(match.signals)),
              manualReviewRequired: true,
            },
            session: options.session,
          });
        }
        continue;
      }

      const previousResolved = roundCurrency(Number(denial.resolvedAmount ?? 0));
      const denialAmount = roundCurrency(Number(denial.denialAmount ?? 0));
      const payerPaidAppliedAmount = roundCurrency(Math.min(match.paidAmount, Math.max(0, denialAmount - previousResolved)));
      const patientResponsibilityAppliedAmount = roundCurrency(Math.min(
        match.patientResponsibilityResolutionAmount,
        Math.max(0, denialAmount - previousResolved - payerPaidAppliedAmount),
      ));
      const contractualAdjustmentAppliedAmount = roundCurrency(Math.min(
        match.contractualResolutionAmount,
        Math.max(0, denialAmount - previousResolved - payerPaidAppliedAmount - patientResponsibilityAppliedAmount),
      ));
      const appliedAmount = roundCurrency(payerPaidAppliedAmount + patientResponsibilityAppliedAmount + contractualAdjustmentAppliedAmount);
      const newResolvedAmount = roundCurrency(previousResolved + appliedAmount);
      const remainingDeniedBalance = roundCurrency(Math.max(0, denialAmount - newResolvedAmount));
      const nextStatus = remainingDeniedBalance <= 0.01 ? 'RESOLVED' : denial.denialStatus ?? 'OVERTURNED';
      const resolutionReason = patientResponsibilityAppliedAmount > 0 || contractualAdjustmentAppliedAmount > 0
        ? `Payment posting ${String(paymentPosting._id)} applied ${payerPaidAppliedAmount} payer paid, ${patientResponsibilityAppliedAmount} patient responsibility, and ${contractualAdjustmentAppliedAmount} contractual adjustment to denied balance.`
        : `Payment posting ${String(paymentPosting._id)} applied ${appliedAmount} to denied balance.`;

      try {
        assertDenialTransition(denial.denialStatus, nextStatus, {
          source: 'REPROCESSED_PAYMENT',
          reason: resolutionReason,
        });
      } catch (error) {
        await EraException.create([{
          exceptionType: 'UNRESOLVED_ADJUSTMENT',
          severity: 'HIGH',
          status: 'OPEN',
          relatedClaim: paymentPosting.claimId,
          relatedERA: paymentPosting.eraEobProcessingId,
          relatedPaymentPosting: paymentPosting._id,
          relatedDenial: denial._id,
          resolutionNotes: error instanceof Error ? error.message : 'Payment could not be applied to denial lifecycle.',
          active: true,
          created: new Date(),
          updated: new Date(),
          createdBy: options.updatedBy,
          updatedBy: options.updatedBy,
        }], { session: options.session });
        continue;
      }

      addDenialHistory(denial, nextStatus, {
        reason: resolutionReason,
        userId: options.updatedBy,
        source: 'REPROCESSED_PAYMENT',
        paymentPostingId: paymentPosting._id,
        eraEobProcessingId: paymentPosting.eraEobProcessingId,
      });
      const previousDenialStatus = denial.denialStatus;
      denial.denialStatus = nextStatus;
      denial.paymentPostingId = denial.paymentPostingId ?? paymentPosting._id;
      denial.relatedPaymentPostingIds = Array.from(new Set([
        ...(denial.relatedPaymentPostingIds ?? []).map(String),
        String(paymentPosting._id),
      ])) as any;
      denial.resolvedAmount = newResolvedAmount;
      denial.remainingDeniedBalance = remainingDeniedBalance;
      denial.denialBalance = remainingDeniedBalance;
      denial.matchConfidence = match.confidenceScore;
      denial.matchedBy = Array.from(new Set(match.signals));
      denial.allocationAmount = appliedAmount;
      denial.manualReviewRequired = false;
      denial.paymentAllocations = [
        ...(denial.paymentAllocations ?? []),
        {
          paymentPostingId: paymentPosting._id,
          paymentLineIndex: match.lineIndex,
          allocationAmount: appliedAmount,
          payerPaidAmount: payerPaidAppliedAmount,
          patientResponsibilityAppliedAmount,
          contractualAdjustmentAppliedAmount,
          matchConfidence: match.confidenceScore,
          matchedBy: Array.from(new Set(match.signals)),
          allocatedAt: new Date(),
        },
      ];
      denial.resolutionDate = nextStatus === 'RESOLVED' ? new Date() : denial.resolutionDate;
      denial.resolutionNotes = nextStatus === 'RESOLVED'
        ? 'Denied balance resolved by reprocessed adjudication.'
        : `Partial payment received. Remaining denied balance ${remainingDeniedBalance}.`;
      denial.updated = new Date();
      if (options.updatedBy) denial.updatedBy = options.updatedBy as any;
      await denial.save({ session: options.session });
      await auditLogService.record({
        entityType: 'denial',
        entityId: denial._id,
        action: nextStatus === 'RESOLVED' ? 'PAYMENT_RESOLVED_DENIAL' : 'PAYMENT_PARTIALLY_RESOLVED_DENIAL',
        userId: options.updatedBy,
        changedBy: options.updatedBy,
        source: 'appealResolution',
        claimId: denial.claimId,
        payerId: denial.payerId,
        financialEventId: (paymentPosting as any).financialEventId,
        reason: resolutionReason,
        previousState: { denialStatus: previousDenialStatus, resolvedAmount: previousResolved },
        newState: {
          denialStatus: nextStatus,
          resolvedAmount: newResolvedAmount,
          remainingDeniedBalance,
          payerPaidAmount: payerPaidAppliedAmount,
          patientResponsibilityAppliedAmount,
          contractualAdjustmentAppliedAmount,
        },
        session: options.session,
      });
      if (match.lineIndex !== undefined) {
        allocatedLineIndexes.add(match.lineIndex);
        const matchedLine = paymentPosting.paymentLines?.[match.lineIndex] as any;
        if (matchedLine) {
          matchedLine.matchingConfidenceScore = match.confidenceScore;
          matchedLine.matchingSignals = Array.from(new Set(match.signals));
          matchedLine.requiresManualReview = false;
          matchedLine.matchedDenialIds = [denial._id] as any;
          paymentPostingChanged = true;
        }
      }

      if (appeal) {
        const previousRecovered = Number(appeal.recoveredAmount ?? 0);
        const previousRecoveryStatus = (appeal as any).recoveryStatus;
        const previousAppealStatus = appeal.appealStatus;
        const recoveredAmount = roundCurrency(previousRecovered + appliedAmount);
        const recoveryPercent = denialAmount > 0 ? Math.round(Math.min(100, (recoveredAmount / denialAmount) * 100) * 10) / 10 : 0;
        appeal.relatedPaymentPostingId = paymentPosting._id;
        appeal.relatedEraId = paymentPosting.eraEobProcessingId;
        appeal.payerRecoveredAmount = roundCurrency(Number((appeal as any).payerRecoveredAmount ?? 0) + payerPaidAppliedAmount) as any;
        appeal.patientRecoveredAmount = roundCurrency(Number((appeal as any).patientRecoveredAmount ?? 0) + patientResponsibilityAppliedAmount) as any;
        appeal.contractualAdjustmentRecoveredAmount = roundCurrency(Number((appeal as any).contractualAdjustmentRecoveredAmount ?? 0) + contractualAdjustmentAppliedAmount) as any;
        appeal.recoveredAmount = recoveredAmount;
        appeal.recoveredAt = new Date();
        appeal.recoveryPercent = recoveryPercent;
        (appeal as any).recoveryStatus = remainingDeniedBalance <= 0.01 ? 'FULL' : recoveredAmount > 0 ? 'PARTIAL' : 'NONE';
        if (nextStatus === 'RESOLVED') {
          appeal.appealStatus = 'CLOSED';
          appeal.packetStatus = 'CLOSED';
          if (String(previousAppealStatus ?? '').toUpperCase() !== 'CLOSED') {
            appeal.statusHistory = [
              ...(appeal.statusHistory ?? []),
              {
                previousStatus: previousAppealStatus,
                newStatus: 'CLOSED',
                reason: 'Appeal closed after reprocessed payment resolved the denied balance.',
                userId: options.updatedBy,
                timestamp: new Date(),
                source: 'REPROCESSED_PAYMENT',
                relatedPaymentPostingId: paymentPosting._id,
                relatedEraId: paymentPosting.eraEobProcessingId,
              },
            ];
          }
        }
        appeal.updated = new Date();
        if (options.updatedBy) appeal.updatedBy = options.updatedBy as any;
        await appeal.save({ session: options.session });
        await auditLogService.record({
          entityType: 'appeal',
          entityId: appeal._id,
          action: 'APPEAL_RECOVERY_ACCOUNTING_UPDATED',
          userId: options.updatedBy,
          changedBy: options.updatedBy,
          source: 'appealResolution',
          claimId: appeal.claimId,
          payerId: appeal.payerId,
          financialEventId: (paymentPosting as any).financialEventId,
          reason: resolutionReason,
          previousState: { recoveredAmount: previousRecovered, recoveryStatus: previousRecoveryStatus },
          newState: {
            recoveredAmount,
            payerRecoveredAmount: appeal.payerRecoveredAmount,
            patientRecoveredAmount: appeal.patientRecoveredAmount,
            contractualAdjustmentRecoveredAmount: appeal.contractualAdjustmentRecoveredAmount,
            recoveryStatus: (appeal as any).recoveryStatus,
            recoveryPercent,
          },
          session: options.session,
        });
        publishRcmRealtimeEvent({
          eventType: 'APPEAL_RECOVERY_ACCOUNTING_UPDATED',
          title: 'Appeal recovery accounting updated',
          claimId: appeal.claimId ? String(appeal.claimId) : undefined,
          entityType: 'appeal',
          entityId: String(appeal._id),
          status: (appeal as any).recoveryStatus,
        });
      }

      await updateArForDenial(denial, nextStatus === 'RESOLVED' ? 'CLOSED' : 'PARTIALLY_RESOLVED', {
        balanceAmount: remainingDeniedBalance,
        nextAction: nextStatus === 'RESOLVED'
          ? 'Denied balance resolved by payment.'
          : 'Follow up on remaining denied balance.',
        updatedBy: options.updatedBy,
        session: options.session,
      });
      if (nextStatus === 'RESOLVED') {
        publishRcmRealtimeEvent({
          eventType: 'AR_CLOSED_FROM_PAYMENT',
          title: 'AR closed by reprocessed payment',
          claimId: denial.claimId ? String(denial.claimId) : undefined,
          entityType: 'arWorkItem',
          entityId: denial.arWorkItemId ? String(denial.arWorkItemId) : undefined,
          status: 'CLOSED',
        });
      }

      if (nextStatus === 'RESOLVED') {
        const openDenialCount = await Denial.countDocuments({
          isDeleted: false,
          claimId: paymentPosting.claimId,
          denialStatus: { $nin: ['RESOLVED', 'WRITTEN_OFF', 'CLOSED'] },
        }).session(options.session ?? null);
        await setClaimPaymentStatus(claim, openDenialCount === 0 ? 'PAYMENT_RECEIVED' : 'PARTIALLY_PAID', options.updatedBy, options.session);
      } else {
        await setClaimPaymentStatus(claim, 'PARTIALLY_PAID', options.updatedBy, options.session);
      }

      if (nextStatus === 'RESOLVED') {
        await correctedClaimService.finalizeResolvedByPayment({
          claimId: paymentPosting.claimId,
          denialId: denial._id,
          paymentPostingId: paymentPosting._id,
          updatedBy: options.updatedBy,
          session: options.session,
        });
      }

      if (denial.claimId && options.updatedBy) {
        await claimClosureService.syncClaimClosureStatus(String(denial.claimId), options.updatedBy, options.session);
      }

      publishRcmRealtimeEvent({
        eventType: 'PAYMENT_RESOLVED_DENIAL',
        title: 'Payment resolved denied balance',
        claimId: denial.claimId ? String(denial.claimId) : undefined,
        entityType: 'denial',
        entityId: String(denial._id),
        status: denial.denialStatus,
      });

      resolved.push(denial);
    }
    if (paymentPostingChanged && typeof (paymentPosting as any).save === 'function') {
      await (paymentPosting as any).save({ session: options.session });
    }

    return resolved;
  },
};
