import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { EraException } from './era-exception.model';
import { ArWorkItem } from '../ar-work-item/ar-work-item.model';
import { Claim } from '../claim/claim.model';
import { Denial } from '../denial/denial.model';
import { Appeal } from '../appeal/appeal.model';
import { PatientBilling } from '../patient-billing/patient-billing.model';
import { EraEobProcessing } from '../era-eob-processing/era-eob-processing.model';
import { PaymentPosting } from '../payment-posting/payment-posting.model';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { enqueueRcmJob, registerRcmJobHandler } from '../background-job/rcm-queue.service';
import { auditLogService } from '../audit-log/audit-log.service';
import { claimClosureService } from '../claim/claim-closure.service';
import { requireActionReason } from '../shared/rcm-lifecycle-safety';
import { assertDenialTransition } from '../denial/denial-workflow.service';
import { rcmAiService } from '../workflow/rcm-ai.service';

function toPlainObject(value: any) {
  return value && typeof value.toObject === 'function' ? value.toObject() : value;
}

function appendAction(item: any, action: string, userId: string, note?: string) {
  item.actionHistory = [
    ...(item.actionHistory ?? []),
    {
      action,
      note,
      performedBy: userId,
      performedAt: new Date(),
    },
  ];
}

function roundCurrency(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

async function resolveManualPaymentMatch(item: any, data: any, updatedBy: string, note: string) {
  const denialId = data?.denialId ?? item.relatedDenial;
  const paymentPostingId = data?.paymentPostingId ?? item.relatedPaymentPosting;
  if (!denialId || !paymentPostingId) {
    throw new AppError('Manual payment match requires related denial and payment posting.', HTTP_STATUS.BAD_REQUEST);
  }
  const [denial, paymentPosting] = await Promise.all([
    Denial.findOne({ _id: denialId, isDeleted: false }),
    PaymentPosting.findOne({ _id: paymentPostingId, isDeleted: false }),
  ]);
  if (!denial) throw new AppError('Related denial was not found.', HTTP_STATUS.NOT_FOUND);
  if (!paymentPosting) throw new AppError('Related payment posting was not found.', HTTP_STATUS.NOT_FOUND);
  const appeal = data?.appealId || denial.appealId
    ? await Appeal.findOne({ _id: data?.appealId ?? denial.appealId, isDeleted: false })
    : await Appeal.findOne({ denialId: denial._id, isDeleted: false });
  const payerRecoveredAmount = roundCurrency(Number(data?.payerRecoveredAmount ?? data?.payerPaidAmount ?? paymentPosting.postedAmount ?? paymentPosting.receivedAmount ?? 0));
  const patientRecoveredAmount = roundCurrency(Number(data?.patientRecoveredAmount ?? data?.patientResponsibilityAmount ?? 0));
  const contractualAdjustmentAmount = roundCurrency(Number(data?.contractualAdjustmentAmount ?? 0));
  const appliedAmount = roundCurrency(payerRecoveredAmount + patientRecoveredAmount + contractualAdjustmentAmount);
  if (appliedAmount <= 0) throw new AppError('Manual payment match requires a positive recovered or adjustment amount.', HTTP_STATUS.BAD_REQUEST);

  const previousResolved = roundCurrency(Number(denial.resolvedAmount ?? 0));
  const denialAmount = roundCurrency(Number(denial.denialAmount ?? 0));
  const resolvedAmount = roundCurrency(previousResolved + appliedAmount);
  const remainingDeniedBalance = roundCurrency(Math.max(0, denialAmount - resolvedAmount));
  denial.denialStatus = remainingDeniedBalance <= 0.01 ? 'RESOLVED' : 'PARTIALLY_OVERTURNED';
  denial.resolvedAmount = resolvedAmount;
  denial.remainingDeniedBalance = remainingDeniedBalance;
  denial.denialBalance = remainingDeniedBalance;
  denial.manualReviewRequired = false;
  denial.paymentPostingId = denial.paymentPostingId ?? paymentPosting._id;
  denial.relatedPaymentPostingIds = Array.from(new Set([
    ...(denial.relatedPaymentPostingIds ?? []).map(String),
    String(paymentPosting._id),
  ])) as any;
  denial.resolutionNotes = note;
  denial.resolutionDate = remainingDeniedBalance <= 0.01 ? new Date() : denial.resolutionDate;
  denial.updated = new Date();
  denial.updatedBy = updatedBy as any;
  await denial.save();

  if (appeal) {
    const previousAppealStatus = appeal.appealStatus;
    const recoveredAmount = roundCurrency(Number(appeal.recoveredAmount ?? 0) + appliedAmount);
    appeal.relatedPaymentPostingId = paymentPosting._id;
    appeal.relatedEraId = paymentPosting.eraEobProcessingId;
    appeal.payerRecoveredAmount = roundCurrency(Number((appeal as any).payerRecoveredAmount ?? 0) + payerRecoveredAmount) as any;
    appeal.patientRecoveredAmount = roundCurrency(Number((appeal as any).patientRecoveredAmount ?? 0) + patientRecoveredAmount) as any;
    appeal.contractualAdjustmentRecoveredAmount = roundCurrency(Number((appeal as any).contractualAdjustmentRecoveredAmount ?? 0) + contractualAdjustmentAmount) as any;
    appeal.recoveredAmount = recoveredAmount;
    appeal.recoveredAt = new Date();
    appeal.recoveryPercent = denialAmount > 0 ? Math.round(Math.min(100, (recoveredAmount / denialAmount) * 100) * 10) / 10 : 0;
    (appeal as any).recoveryStatus = remainingDeniedBalance <= 0.01 ? 'FULL' : 'PARTIAL';
    if (remainingDeniedBalance <= 0.01) {
      appeal.appealStatus = 'CLOSED';
      appeal.packetStatus = 'CLOSED';
      if (String(previousAppealStatus ?? '').toUpperCase() !== 'CLOSED') {
        appeal.statusHistory = [
          ...(appeal.statusHistory ?? []),
          {
            previousStatus: previousAppealStatus,
            newStatus: 'CLOSED',
            reason: note,
            userId: updatedBy,
            timestamp: new Date(),
            source: 'MANUAL_PAYMENT_MATCH',
            relatedPaymentPostingId: paymentPosting._id,
            relatedEraId: paymentPosting.eraEobProcessingId,
          },
        ];
      }
    }
    appeal.updated = new Date();
    appeal.updatedBy = updatedBy as any;
    await appeal.save();
  }

  if (denial.arWorkItemId) {
    await ArWorkItem.updateOne(
      { _id: denial.arWorkItemId, isDeleted: false },
      {
        status: remainingDeniedBalance <= 0.01 ? 'CLOSED' : 'PARTIALLY_RESOLVED',
        balanceAmount: remainingDeniedBalance,
        nextAction: remainingDeniedBalance <= 0.01 ? 'Denied balance resolved by manual payment match.' : 'Follow up on remaining denied balance.',
        updated: new Date(),
        updatedBy,
      }
    );
  }

  await auditLogService.record({
    entityType: 'eraException',
    entityId: item._id,
    action: 'MANUAL_PAYMENT_MATCH_RESOLVED',
    userId: updatedBy,
    changedBy: updatedBy,
    source: 'eraException',
    claimId: denial.claimId,
    payerId: denial.payerId,
    financialEventId: (paymentPosting as any).financialEventId,
    reason: note,
    newState: {
      denialId: denial._id,
      appealId: appeal?._id,
      paymentPostingId: paymentPosting._id,
      payerRecoveredAmount,
      patientRecoveredAmount,
      contractualAdjustmentAmount,
      remainingDeniedBalance,
      denialStatus: denial.denialStatus,
    },
  });
  publishRcmRealtimeEvent({
    eventType: 'PAYMENT_RESOLVED_DENIAL',
    title: 'Manual payment match resolved',
    entityType: 'denial',
    entityId: String(denial._id),
    claimId: denial.claimId ? String(denial.claimId) : undefined,
    status: denial.denialStatus,
  });
  if (denial.claimId) await claimClosureService.syncClaimClosureStatus(String(denial.claimId), updatedBy);
  return denial;
}

async function getById(id: string) {
  const item = await EraException.findOne({ _id: id, isDeleted: false });
  if (!item) {
    throw new AppError('ERA exception not found.', HTTP_STATUS.NOT_FOUND);
  }
  return item;
}

async function publish(item: any, eventType: string, title: string) {
  publishRcmRealtimeEvent({
    eventType: eventType as any,
    title,
    message: `${item.exceptionType} is ${item.status}.`,
    entityType: 'eraException',
    entityId: String(item._id),
    claimId: item.relatedClaim ? String(item.relatedClaim) : undefined,
    status: item.status,
  });
}

async function createArFromException(item: any, updatedBy: string) {
  const [arItem] = await ArWorkItem.create([{
    claimId: item.relatedClaim,
    category: item.exceptionType,
    status: 'OPEN',
    priority: item.severity === 'HIGH' ? 'High' : 'Normal',
    reason: `ERA exception: ${item.exceptionType}`,
    nextAction: 'Work ERA exception and document payer follow-up.',
    sourceType: 'ERA_EXCEPTION',
    sourceId: item._id,
    active: true,
    created: new Date(),
    updated: new Date(),
    createdBy: updatedBy,
    updatedBy,
  }]);
  item.relatedARWorkItem = arItem._id;
  return arItem;
}

async function createDenialFromException(item: any, data: any, updatedBy: string) {
  if (!item.relatedClaim) {
    throw new AppError('Related claim is required to create a denial from an ERA exception.', HTTP_STATUS.BAD_REQUEST);
  }
  const claim = await Claim.findOne({ _id: item.relatedClaim, isDeleted: false });
  if (!claim) {
    throw new AppError('Related claim was not found for ERA exception denial creation.', HTTP_STATUS.NOT_FOUND);
  }
  const [denial] = await Denial.create([{
    claimId: claim._id,
    patientId: claim.patientId,
    payerId: claim.payerId,
    eraEobProcessingId: item.relatedERA,
    paymentPostingId: item.relatedPaymentPosting,
    denialCode: data.denialCode ?? data.carcCode ?? 'ERA_EXCEPTION',
    carcCodes: data.carcCode ? [data.carcCode] : [],
    denialReason: data.reason ?? data.notes ?? `Denial created from ERA exception ${item.exceptionType}.`,
    denialCategory: data.denialCategory ?? 'OTHER',
    denialSource: 'ERA_EXCEPTION',
    denialDate: new Date(),
    denialAmount: Number(data.denialAmount ?? data.amount ?? 0),
    denialStatus: 'OPEN',
    priority: item.severity === 'HIGH' ? 'high' : 'medium',
    aiConfidenceScore: 0.4,
    aiRecommendationSource: 'era_exception_workflow_rules',
    aiRecommendationHistory: [{
      recommendation: 'MANUAL_REVIEW',
      reason: `ERA exception ${item.exceptionType} requires operator validation before appeal, correction, billing, or write-off.`,
      confidenceScore: 0.4,
      source: 'era_exception_workflow_rules',
      generatedAt: new Date(),
      safeAutomation: 'ADVISORY_ONLY',
    }],
    active: true,
    created: new Date(),
    updated: new Date(),
    createdBy: updatedBy,
  }]);
  const arItem = await createArFromException(item, updatedBy);
  denial.arWorkItemId = arItem._id;
  await denial.save();
  item.relatedDenial = denial._id;
  item.relatedARWorkItem = arItem._id;
  if (claim._id) await claimClosureService.syncClaimClosureStatus(String(claim._id), updatedBy);
  return denial;
}

async function createAppealFromException(item: any, data: any, updatedBy: string) {
  const denialId = data.denialId ?? item.relatedDenial;
  if (!denialId) {
    await createDenialFromException(item, data, updatedBy);
  }
  const denial = await Denial.findOne({ _id: item.relatedDenial ?? data.denialId, isDeleted: false });
  if (!denial) {
    throw new AppError('Related denial is required to create an appeal from an ERA exception.', HTTP_STATUS.BAD_REQUEST);
  }
  const [appeal] = await Appeal.create([{
    denialId: denial._id,
    claimId: denial.claimId,
    arWorkItemId: denial.arWorkItemId,
    payerId: denial.payerId,
    denialCode: denial.denialCode,
    appealCategory: data.appealCategory ?? denial.denialCategory ?? 'OTHER',
    appealLevel: data.appealLevel ?? 'FIRST_LEVEL',
    appealReason: data.reason ?? denial.denialReason ?? 'ERA exception appeal created for payer review.',
    appealStatus: 'DRAFT',
    dueDate: data.dueDate ? new Date(data.dueDate) : denial.appealDeadline ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    appealDeadline: data.dueDate ? new Date(data.dueDate) : denial.appealDeadline,
    active: true,
    created: new Date(),
    updated: new Date(),
    createdBy: updatedBy,
  }]);
  try {
    assertDenialTransition(denial.denialStatus, 'APPEAL_READY', {
      source: 'ERA_EXCEPTION_APPEAL_CREATED',
      reason: data.reason ?? 'ERA exception appeal created for payer review.',
    });
  } catch (error) {
    throw new AppError(error instanceof Error ? error.message : 'Invalid denial transition.', HTTP_STATUS.BAD_REQUEST);
  }
  denial.appealId = appeal._id;
  denial.denialStatus = 'APPEAL_READY';
  denial.updated = new Date();
  denial.updatedBy = updatedBy as any;
  await denial.save();
  item.relatedDenial = denial._id;
  if (denial.arWorkItemId) {
    await ArWorkItem.updateOne({ _id: denial.arWorkItemId, isDeleted: false }, {
      appealId: appeal._id,
      status: 'APPEAL_DRAFT',
      nextAction: 'Generate appeal packet and submit to payer.',
      updated: new Date(),
      updatedBy,
    });
  }
  if (denial.claimId) await claimClosureService.syncClaimClosureStatus(String(denial.claimId), updatedBy);
  return appeal;
}

async function transferExceptionToBilling(item: any, data: any, updatedBy: string) {
  if (!item.relatedClaim) {
    throw new AppError('Related claim is required to transfer an ERA exception to billing.', HTTP_STATUS.BAD_REQUEST);
  }
  const claim = await Claim.findOne({ _id: item.relatedClaim, isDeleted: false });
  if (!claim) {
    throw new AppError('Related claim was not found for ERA exception billing transfer.', HTTP_STATUS.NOT_FOUND);
  }
  const amount = Number(data.amount ?? data.patientResponsibilityAmount ?? 0);
  if (amount <= 0) {
    throw new AppError('Transfer to billing requires a positive patient responsibility amount.', HTTP_STATUS.BAD_REQUEST);
  }
  const [billing] = await PatientBilling.create([{
    patientId: claim.patientId,
    claimId: claim._id,
    paymentPostingId: item.relatedPaymentPosting,
    statementNumber: `EXC-${String(item._id).slice(-8).toUpperCase()}`,
    statementDate: new Date(),
    statementCycle: 'ERA Exception Transfer',
    originalBalance: amount,
    currentBalance: amount,
    patientBalance: amount,
    amountDue: amount,
    status: 'READY_TO_SEND',
    statementStatus: 'READY_TO_SEND',
    active: true,
    created: new Date(),
    updated: new Date(),
    createdBy: updatedBy,
  }]);
  if (claim._id) await claimClosureService.syncClaimClosureStatus(String(claim._id), updatedBy);
  return billing;
}

export const eraExceptionService = {
  async create(data: any, createdBy: string) {
    const [item] = await EraException.create([{
      ...data,
      status: data.status ?? 'OPEN',
      severity: data.severity ?? 'MEDIUM',
      active: data.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
      updatedBy: createdBy,
    }]);

    await publish(item, 'ERA_EXCEPTION_CREATED', 'ERA exception created');
    await auditLogService.record({
      entityType: 'eraException',
      entityId: item._id,
      action: 'ERA_EXCEPTION_CREATED',
      userId: createdBy,
      changedBy: createdBy,
      source: 'eraException',
      claimId: item.relatedClaim,
      reason: item.resolutionNotes ?? (item as any).exceptionReason,
      newState: item.toObject(),
    });
    return item;
  },

  async getById(id: string) {
    return getById(id);
  },

  async update(id: string, data: any, updatedBy: string) {
    const item = await getById(id);
    Object.assign(item, {
      ...data,
      updatedBy,
      updated: new Date(),
    });
    appendAction(item, 'UPDATE', updatedBy, data.resolutionNotes);
    await item.save();
    await publish(item, 'ERA_EXCEPTION_UPDATED', 'ERA exception updated');
    return item;
  },

  async explainWithAi(id: string, updatedBy: string) {
    const item = await getById(id);
    const [claim, denial, paymentPosting, era] = await Promise.all([
      item.relatedClaim ? Claim.findOne({ _id: item.relatedClaim, isDeleted: false }) : Promise.resolve(null),
      item.relatedDenial ? Denial.findOne({ _id: item.relatedDenial, isDeleted: false }) : Promise.resolve(null),
      item.relatedPaymentPosting ? PaymentPosting.findOne({ _id: item.relatedPaymentPosting, isDeleted: false }) : Promise.resolve(null),
      item.relatedERA ? EraEobProcessing.findOne({ _id: item.relatedERA, isDeleted: false }) : Promise.resolve(null),
    ]);
    const analysis = await rcmAiService.explainEraMatchException({
      eraException: toPlainObject(item),
      claim: toPlainObject(claim) ?? {},
      denial: toPlainObject(denial) ?? {},
      paymentPosting: toPlainObject(paymentPosting) ?? {},
      era: toPlainObject(era) ?? {},
    });
    item.aiAnalysis = analysis as unknown as Record<string, unknown>;
    item.aiRecommendationHistory = [
      ...(item.aiRecommendationHistory ?? []),
      {
        type: 'ERA_MATCH_EXCEPTION_EXPLANATION',
        generatedAt: new Date(),
        generatedBy: updatedBy,
        ...analysis,
      },
    ];
    appendAction(item, 'AI_EXPLAIN', updatedBy, analysis.explanation);
    item.updated = new Date();
    item.updatedBy = updatedBy;
    await item.save();
    await publish(item, 'ERA_EXCEPTION_UPDATED', 'AI ERA exception explanation completed');
    return item;
  },

  async action(id: string, action: string, data: any, updatedBy: string) {
    const item = await getById(id);
    const normalizedAction = action.trim().toUpperCase();
    const note = data?.reason ?? data?.resolutionNotes ?? data?.notes;
    const previousStatus = item.status;

    if (normalizedAction === 'RESOLVE') {
      requireActionReason(note, 'ERA exception resolution');
      item.status = 'RESOLVED';
      item.resolutionNotes = note.trim();
    } else if (normalizedAction === 'RESOLVE_PAYMENT_MATCH') {
      const requiredNote = requireActionReason(note, 'Manual payment match resolution');
      await resolveManualPaymentMatch(item, data, updatedBy, requiredNote);
      item.status = 'RESOLVED';
      item.resolutionNotes = requiredNote;
    } else if (normalizedAction === 'REPROCESS') {
      const requiredNote = requireActionReason(note, 'ERA exception reprocess');
      item.status = 'REPROCESSING';
      item.replayStatus = 'QUEUED';
      item.replayReason = requiredNote;
      if (item.relatedERA) {
        await EraEobProcessing.updateOne({ _id: item.relatedERA, isDeleted: false }, {
          reconciliationStatus: 'EXCEPTION',
          exceptionReason: `Queued for reprocessing from ERA exception ${String(item._id)}.`,
          updated: new Date(),
          updatedBy,
        });
      }
      await enqueueRcmJob({
        jobType: 'PROCESS_ERA_EXCEPTION',
        idempotencyKey: `era-exception:${item._id}:reprocess:${item.replayVersion ?? 0}:${Date.now()}`,
        payload: { eraExceptionId: String(item._id), action: normalizedAction, reason: requiredNote },
        createdBy: updatedBy,
      });
    } else if (normalizedAction === 'ESCALATE') {
      item.status = 'ESCALATED';
      item.severity = data?.severity ?? 'HIGH';
    } else if (normalizedAction === 'IGNORE') {
      if (!note?.trim()) {
        throw new AppError('Ignore reason is required.', HTTP_STATUS.BAD_REQUEST);
      }
      item.status = 'IGNORED';
      item.ignoredReason = note.trim();
    } else if (normalizedAction === 'CREATE_AR') {
      await createArFromException(item, updatedBy);
      item.status = 'IN_REVIEW';
    } else if (normalizedAction === 'CREATE_DENIAL') {
      await createDenialFromException(item, data, updatedBy);
      item.status = 'IN_REVIEW';
    } else if (normalizedAction === 'CREATE_APPEAL') {
      await createAppealFromException(item, data, updatedBy);
      item.status = 'IN_REVIEW';
    } else if (normalizedAction === 'TRANSFER_TO_BILLING') {
      await transferExceptionToBilling(item, data, updatedBy);
      item.status = 'IN_REVIEW';
    } else {
      throw new AppError('Unsupported ERA exception action.', HTTP_STATUS.BAD_REQUEST);
    }

    appendAction(item, normalizedAction, updatedBy, note);
    item.updated = new Date();
    item.updatedBy = updatedBy;
    await item.save();
    await publish(item, 'ERA_EXCEPTION_STATUS_CHANGED', 'ERA exception status changed');
    await auditLogService.record({
      entityType: 'eraException',
      entityId: item._id,
      action: normalizedAction === 'RESOLVE' ? 'ERA_EXCEPTION_RESOLVED' : `ERA_EXCEPTION_${normalizedAction}`,
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'eraException',
      claimId: item.relatedClaim,
      reason: note,
      previousState: { status: previousStatus },
      newState: { status: item.status, replayStatus: item.replayStatus },
    });
    return item;
  },

  async softDelete(id: string, updatedBy: string) {
    const item = await getById(id);
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('ERA exceptions cannot be deleted in production. Resolve or ignore with a reason.', HTTP_STATUS.BAD_REQUEST);
    }
    item.active = false;
    item.isDeleted = true;
    item.deletedAt = new Date();
    item.updated = new Date();
    item.updatedBy = updatedBy;
    await item.save();
    return true;
  },
};

registerRcmJobHandler('PROCESS_ERA_EXCEPTION', async (job) => {
  const eraExceptionId = String(job.payload?.eraExceptionId ?? '');
  if (!eraExceptionId) return;
  const item = await getById(eraExceptionId);
  if (!item.relatedERA) {
    throw new AppError('ERA exception reprocess requires a related ERA.', HTTP_STATUS.BAD_REQUEST);
  }
  item.replayStatus = 'RUNNING';
  item.replayVersion = (item.replayVersion ?? 0) + 1;
  item.updated = new Date();
  await item.save();
  const { eraEobProcessingService } = await import('../era-eob-processing/era-eob-processing.service');
  const result = await eraEobProcessingService.replay(
    String(item.relatedERA),
    String(job.payload?.reason ?? item.replayReason ?? 'ERA exception replay'),
    'en',
    String(job.updatedBy ?? job.createdBy ?? 'rcm-queue-worker'),
  );
  appendAction(
    item,
    'REPROCESS_JOB_COMPLETED',
    String(job.updatedBy ?? 'rcm-queue-worker'),
    `ERA replay completed with ${result.matchedClaims.length} matched claim(s).`,
  );
  item.status = result.importErrors.length ? 'IN_REVIEW' : 'RESOLVED';
  item.replayStatus = 'COMPLETED';
  item.updated = new Date();
  await item.save();
  await publish(item, 'ERA_EXCEPTION_REPROCESSED', 'ERA exception reprocessed');
});
