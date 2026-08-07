import { ArWorkItem } from './ar-work-item.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { Claim } from '../claim/claim.model';
import { ClaimSubmission } from '../claim-submission/claim-submission.model';
import { Denial } from '../denial/denial.model';
import { Appeal } from '../appeal/appeal.model';
import { CorrectedClaim } from '../corrected-claim/corrected-claim.model';
import type { ClientSession } from 'mongoose';
import { claimClosureService } from '../claim/claim-closure.service';
import { rejectAppendOnlyMutation, requireActionReason } from '../shared/rcm-lifecycle-safety';
import { rcmAiService } from '../workflow/rcm-ai.service';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { auditLogService } from '../audit-log/audit-log.service';
import { assignAuditActor, auditActorPatch, omitAuditActorFields } from '../shared/audit-actor.util';

function toPlainObject(value: any) {
  return value && typeof value.toObject === 'function' ? value.toObject() : value;
}

const OPEN_AR_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_ON_PAYER', 'WAITING_ON_INTERNAL', 'ESCALATED'];
const TERMINAL_AR_STATUSES = ['RESOLVED', 'CLOSED'];
const TERMINAL_DENIAL_STATUSES = ['RESOLVED', 'WRITTEN_OFF', 'TRANSFERRED_TO_PATIENT', 'COLLECTIONS', 'CLOSED'];

function normalizeArStatus(status: unknown) {
  return typeof status === 'string' && status.trim() ? status.trim().toUpperCase() : status;
}

async function assertLinkedDenialAllowsArClosure(item: any, status: unknown, reason?: string) {
  const normalizedStatus = String(normalizeArStatus(status) ?? '').toUpperCase();
  if (!TERMINAL_AR_STATUSES.includes(normalizedStatus) || !item.denialId) {
    return;
  }

  requireActionReason(reason, 'AR work item closure');
  const denial = await Denial.findOne({ _id: item.denialId, isDeleted: false });
  if (denial && !TERMINAL_DENIAL_STATUSES.includes(String(denial.denialStatus ?? '').toUpperCase())) {
    throw new AppError(
      'Linked denial is still open. Resolve the denial through payment, appeal, corrected claim, write-off, or transfer-to-patient workflow before closing AR.',
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function daysBetween(from?: Date | string, to = new Date()) {
  if (!from) return 0;
  const date = from instanceof Date ? from : new Date(from);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((to.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)));
}

export function calculateAgingBucket(ageInDays: number) {
  if (ageInDays <= 30) return '0-30';
  if (ageInDays <= 60) return '31-60';
  if (ageInDays <= 90) return '61-90';
  if (ageInDays <= 120) return '91-120';
  return '120+';
}

export function priorityForAgingBucket(bucket: string) {
  if (bucket === '0-30') return 'NORMAL';
  if (bucket === '31-60') return 'NORMAL';
  if (bucket === '61-90') return 'HIGH';
  return 'CRITICAL';
}

function plusDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export const arWorkItemService = {
  async create(data: any, locale: string, createdBy: string) {
    const safeData = omitAuditActorFields(data);
    const item = await ArWorkItem.create({
      ...safeData,
      status: normalizeArStatus(safeData.status) ?? 'OPEN',
      active: safeData.active ?? true,
      created: new Date(),
      updated: new Date(),
      ...auditActorPatch('createdBy', createdBy),
    });

    await auditLogService.record({
      entityType: 'arWorkItem',
      entityId: item._id,
      action: 'AR_CREATED',
      userId: createdBy,
      claimId: item.claimId,
      patientId: item.patientId,
      payerId: item.payerId,
      newState: { status: item.status, category: item.category, balanceAmount: item.balanceAmount },
      source: 'AR_WORK_ITEM',
    });

    return item;
  },

  async getById(id: string, locale: string) {
    const item = await ArWorkItem.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('arWorkItem.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    const item = await ArWorkItem.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('arWorkItem.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const safeData = omitAuditActorFields(data);
    const nextStatus = safeData.status === undefined ? item.status : normalizeArStatus(safeData.status);
    const previousState = { status: item.status, owner: item.owner, assignedTo: item.assignedTo };
    await assertLinkedDenialAllowsArClosure(item, nextStatus, safeData.reason ?? safeData.notes);

    Object.assign(item, {
      ...safeData,
      status: nextStatus,
      updated: new Date(),
      ...auditActorPatch('updatedBy', updatedBy),
    });

    await item.save();

    if (item.denialId) {
      const denial = await Denial.findOne({ _id: item.denialId, isDeleted: false });
      if (denial) {
        let denialChanged = false;
        if (item.assignedTo && denial.owner !== item.assignedTo) {
          denial.owner = item.assignedTo;
          denialChanged = true;
        }
        if (denialChanged) {
          assignAuditActor(denial, 'updatedBy', updatedBy);
          denial.updated = new Date();
          await denial.save();
        }
      }
    }

    if (item.claimId) {
      await claimClosureService.syncClaimClosureStatus(String(item.claimId), updatedBy);
    }

    await auditLogService.record({
      entityType: 'arWorkItem',
      entityId: item._id,
      action: normalizeArStatus(nextStatus) === 'CLOSED' ? 'AR_CLOSED' : item.assignedTo !== previousState.assignedTo ? 'AR_ASSIGNED' : 'AR_UPDATED',
      userId: updatedBy,
      claimId: item.claimId,
      patientId: item.patientId,
      payerId: item.payerId,
      previousState,
      newState: { status: item.status, owner: item.owner, assignedTo: item.assignedTo },
      reason: data.reason ?? data.notes,
      source: 'AR_WORK_ITEM',
    });

    return item;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    rejectAppendOnlyMutation('AR work item', 'deleted');

    const item = await ArWorkItem.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        active: false,
        isDeleted: true,
        deletedAt: new Date(),
        updated: new Date(),
        ...auditActorPatch('updatedBy', updatedBy),
      },
      { new: true }
    );

    if (!item) {
      throw new AppError(t('arWorkItem.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },

  async upsertWorkflowItem(data: any, locale: string, createdBy: string, options: { session?: ClientSession } = {}) {
    const session = options.session;
    const now = new Date();
    const safeData = omitAuditActorFields(data);
    const dedupeKey = safeData.dedupeKey ?? [
      safeData.category,
      safeData.claimId,
      safeData.claimLineId,
      safeData.denialId,
      safeData.appealId,
      safeData.correctedClaimId,
      safeData.paymentPostingId,
      safeData.reason,
    ].filter(Boolean).map(String).join(':');

    const existing = dedupeKey
      ? await ArWorkItem.findOne({ dedupeKey, isDeleted: false, status: { $in: OPEN_AR_STATUSES } }).session(session ?? null)
      : null;

    const ageInDays = daysBetween(safeData.ageAnchorDate ?? safeData.followUpDate ?? safeData.dueDate ?? now);
    const agingBucket = safeData.agingBucket ?? calculateAgingBucket(ageInDays);
    const priority = safeData.priority ?? priorityForAgingBucket(agingBucket);

    const payload = {
      ...safeData,
      dedupeKey,
      agingBucket,
      priority,
      status: normalizeArStatus(safeData.status) ?? 'OPEN',
      owner: safeData.owner ?? safeData.assignedTo,
      assignedTo: safeData.assignedTo ?? safeData.owner,
      followUpDate: safeData.followUpDate ?? plusDays(now, priority === 'CRITICAL' ? 1 : priority === 'HIGH' ? 3 : 7),
      nextFollowUpDate: safeData.nextFollowUpDate ?? safeData.followUpDate ?? plusDays(now, priority === 'CRITICAL' ? 1 : priority === 'HIGH' ? 3 : 7),
      active: safeData.active ?? true,
      updated: now,
    };

    if (existing) {
      const previousState = { status: existing.status, priority: existing.priority, assignedTo: existing.assignedTo };
      Object.assign(existing, payload, auditActorPatch('updatedBy', createdBy));
      await existing.save({ session });
      await auditLogService.record({
        entityType: 'arWorkItem',
        entityId: existing._id,
        action: normalizeArStatus(existing.status) === 'ESCALATED' ? 'AR_ESCALATED' : 'AR_UPDATED',
        userId: createdBy,
        claimId: existing.claimId,
        patientId: existing.patientId,
        payerId: existing.payerId,
        previousState,
        newState: { status: existing.status, priority: existing.priority, assignedTo: existing.assignedTo },
        source: 'AR_WORK_ITEM',
        session,
      });
      return existing;
    }

    const [item] = await ArWorkItem.create([{
      ...payload,
      created: now,
      ...auditActorPatch('createdBy', createdBy),
    }], { session });
    await auditLogService.record({
      entityType: 'arWorkItem',
      entityId: item._id,
      action: 'AR_CREATED',
      userId: createdBy,
      claimId: item.claimId,
      patientId: item.patientId,
      payerId: item.payerId,
      newState: { status: item.status, category: item.category, balanceAmount: item.balanceAmount },
      source: 'AR_WORK_ITEM',
      session,
    });
    return item;
  },

  async createUnderpaymentVarianceItem(options: {
    claim: any;
    paymentPostingId: unknown;
    claimLineId?: unknown;
    expectedAmount: number;
    paidAmount: number;
    balanceAmount?: number;
    reason?: string;
    createdBy: string;
    session?: ClientSession;
  }) {
    const varianceAmount = roundCurrency(Math.max(0, options.expectedAmount - options.paidAmount));
    if (varianceAmount <= 0) return null;

    return this.upsertWorkflowItem({
      claimId: options.claim._id,
      claimLineId: options.claimLineId,
      patientId: options.claim.patientId,
      payerId: options.claim.payerId,
      paymentPostingId: options.paymentPostingId,
      category: 'UNDERPAYMENT',
      sourceType: 'PAYMENT_POSTING',
      sourceId: options.paymentPostingId,
      expectedAmount: options.expectedAmount,
      paidAmount: options.paidAmount,
      varianceAmount,
      balanceAmount: options.balanceAmount ?? varianceAmount,
      reason: options.reason ?? 'Actual payer payment is below expected insurance reimbursement.',
      nextAction: 'Review payer contract, ERA allowed amount, and payment variance.',
      dedupeKey: `UNDERPAYMENT:${String(options.paymentPostingId)}:${String(options.claim._id)}:${String(options.claimLineId ?? 'claim')}`,
    }, 'en', options.createdBy, { session: options.session });
  },

  async generateOperationalWorkQueue(options: any = {}, locale: string, createdBy: string) {
    const now = new Date();
    const pendingResponseDays = Number(options.pendingResponseDays ?? 30);
    const appealFollowUpDays = Number(options.appealFollowUpDays ?? 14);
    const correctedClaimFollowUpDays = Number(options.correctedClaimFollowUpDays ?? 7);
    const createdOrUpdated: any[] = [];

    const staleSubmissionDate = plusDays(now, -pendingResponseDays);
    const staleSubmissions = await ClaimSubmission.find({
      isDeleted: false,
      claimId: { $exists: true },
      normalizedStatus: { $in: ['SUBMITTED', 'PENDING', 'ACCEPTED'] },
      submissionDateTime: { $lte: staleSubmissionDate },
    }).sort({ submissionDateTime: 1 }).limit(250);

    for (const submission of staleSubmissions) {
      const claim = await Claim.findOne({ _id: submission.claimId, isDeleted: false });
      if (!claim) continue;
      const ageInDays = daysBetween(submission.submissionDateTime ?? submission.created, now);
      createdOrUpdated.push(await this.upsertWorkflowItem({
        claimId: claim._id,
        patientId: claim.patientId,
        payerId: claim.payerId,
        category: 'NO_RESPONSE',
        sourceType: 'CLAIM_SUBMISSION',
        sourceId: submission._id,
        balanceAmount: claim.totalChargeAmount ?? 0,
        agingBucket: calculateAgingBucket(ageInDays),
        priority: priorityForAgingBucket(calculateAgingBucket(ageInDays)),
        reason: `No payer response after ${ageInDays} days from submission.`,
        nextAction: 'Follow up with payer or clearinghouse for claim status.',
        ageAnchorDate: submission.submissionDateTime ?? submission.created,
        dedupeKey: `NO_RESPONSE:${String(submission._id)}`,
      }, locale, createdBy));
    }

    const rejectedClaims = await Claim.find({
      isDeleted: false,
      $or: [
        { submissionStatus: 'Rejected' },
        { paymentStatus: 'PAYMENT_POSTING_FAILED' },
      ],
    }).sort({ updated: -1 }).limit(250);

    for (const claim of rejectedClaims) {
      createdOrUpdated.push(await this.upsertWorkflowItem({
        claimId: claim._id,
        patientId: claim.patientId,
        payerId: claim.payerId,
        category: 'PAYER_FOLLOW_UP',
        sourceType: 'CLAIM',
        sourceId: claim._id,
        balanceAmount: claim.totalChargeAmount ?? 0,
        reason: claim.rejectionReason ?? 'Rejected or failed claim requires payer follow-up.',
        nextAction: 'Review rejection details and prepare correction or payer follow-up.',
        ageAnchorDate: claim.updated,
        dedupeKey: `REJECTED_CLAIM:${String(claim._id)}`,
      }, locale, createdBy));
    }

    const denials = await Denial.find({ isDeleted: false, denialStatus: { $nin: ['RESOLVED', 'WRITTEN_OFF'] } }).limit(250);
    for (const denial of denials) {
      createdOrUpdated.push(await this.upsertWorkflowItem({
        claimId: denial.claimId,
        claimLineId: denial.claimLineId,
        denialId: denial._id,
        patientId: denial.patientId,
        payerId: denial.payerId,
        category: 'DENIAL_REWORK',
        sourceType: 'DENIAL',
        sourceId: denial._id,
        balanceAmount: denial.denialAmount ?? 0,
        denialCode: denial.denialCode,
        denialCategory: denial.denialCategory,
        reason: denial.denialReason ?? 'Unresolved denial requires rework.',
        nextAction: denial.recommendedAction ?? 'Resolve denial or route to corrected claim/appeal.',
        ageAnchorDate: denial.denialDate ?? denial.created,
        dedupeKey: `DENIAL_REWORK:${String(denial._id)}`,
      }, locale, createdBy));
    }

    const staleAppealDate = plusDays(now, -appealFollowUpDays);
    const appeals = await Appeal.find({
      isDeleted: false,
      appealStatus: { $in: ['SUBMITTED', 'PENDING'] },
      updated: { $lte: staleAppealDate },
    }).limit(250);
    for (const appeal of appeals) {
      createdOrUpdated.push(await this.upsertWorkflowItem({
        claimId: appeal.claimId,
        denialId: appeal.denialId,
        appealId: appeal._id,
        payerId: appeal.payerId,
        category: 'APPEAL_FOLLOW_UP',
        sourceType: 'APPEAL',
        sourceId: appeal._id,
        dueDate: appeal.dueDate ?? appeal.appealDeadline,
        reason: 'Appeal is pending payer response.',
        nextAction: 'Follow up with payer on appeal status.',
        ageAnchorDate: appeal.submissionDate ?? appeal.updated,
        dedupeKey: `APPEAL_FOLLOW_UP:${String(appeal._id)}`,
      }, locale, createdBy));
    }

    const staleCorrectedClaimDate = plusDays(now, -correctedClaimFollowUpDays);
    const correctedClaims = await CorrectedClaim.find({
      isDeleted: false,
      correctedClaimStatus: { $in: ['DRAFT', 'READY_FOR_REVIEW', 'READY'] },
      updated: { $lte: staleCorrectedClaimDate },
    }).limit(250);
    for (const correctedClaim of correctedClaims) {
      const claim = correctedClaim.clonedClaimId
        ? await Claim.findOne({ _id: correctedClaim.clonedClaimId, isDeleted: false })
        : null;
      createdOrUpdated.push(await this.upsertWorkflowItem({
        claimId: correctedClaim.clonedClaimId ?? correctedClaim.originalClaimId,
        denialId: correctedClaim.sourceDenialId ?? correctedClaim.denialId,
        correctedClaimId: correctedClaim._id,
        patientId: claim?.patientId,
        payerId: claim?.payerId,
        category: 'CORRECTED_CLAIM_FOLLOW_UP',
        sourceType: 'CORRECTED_CLAIM',
        sourceId: correctedClaim._id,
        balanceAmount: claim?.totalChargeAmount ?? 0,
        reason: 'Corrected claim is pending readiness or manual resubmission.',
        nextAction: 'Complete corrected claim readiness and submit manually when ready.',
        ageAnchorDate: correctedClaim.updated,
        dedupeKey: `CORRECTED_CLAIM_FOLLOW_UP:${String(correctedClaim._id)}`,
      }, locale, createdBy));
    }

    return {
      createdOrUpdatedCount: createdOrUpdated.filter(Boolean).length,
      items: createdOrUpdated.filter(Boolean),
    };
  },

  async changeStatus(id: string, data: any, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    const nextStatus = normalizeArStatus(data.status);
    const previousStatus = item.status;
    await assertLinkedDenialAllowsArClosure(item, nextStatus, data.reason ?? data.notes);
    item.status = nextStatus as any;
    item.owner = data.owner ?? item.owner;
    item.assignedTo = data.owner ?? item.assignedTo;
    item.notes = data.notes ?? item.notes;
    item.nextAction = data.nextAction ?? item.nextAction;
    item.followUpDate = data.followUpDate ?? item.followUpDate;
    item.nextFollowUpDate = data.followUpDate ?? item.nextFollowUpDate;
    item.updated = new Date();
    assignAuditActor(item, 'updatedBy', updatedBy);
    await item.save();
    await auditLogService.record({
      entityType: 'arWorkItem',
      entityId: item._id,
      action: nextStatus === 'CLOSED' ? 'AR_CLOSED' : nextStatus === 'OPEN' && previousStatus !== 'OPEN' ? 'AR_REOPENED' : nextStatus === 'ESCALATED' ? 'AR_ESCALATED' : 'AR_STATUS_CHANGED',
      userId: updatedBy,
      claimId: item.claimId,
      patientId: item.patientId,
      payerId: item.payerId,
      previousState: { status: previousStatus },
      newState: { status: item.status, owner: item.owner, assignedTo: item.assignedTo },
      reason: data.reason ?? data.notes,
      source: 'AR_WORK_ITEM',
    });
    return item;
  },

  async addContactHistory(id: string, data: any, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    item.contactHistory = [
      ...(item.contactHistory ?? []),
      {
        ...data,
        contactDate: data.contactDate ?? new Date(),
        performedBy: data.performedBy ?? String(updatedBy),
      },
    ];
    item.followUpHistory = [
      ...(item.followUpHistory ?? []),
      {
        followUpDate: data.contactDate ?? new Date(),
        followUpType: data.contactType,
        notes: data.notes ?? data.outcome,
        performedBy: data.performedBy ?? String(updatedBy),
      },
    ];
    item.updated = new Date();
    assignAuditActor(item, 'updatedBy', updatedBy);
    await item.save();
    await auditLogService.record({
      entityType: 'arWorkItem',
      entityId: item._id,
      action: 'AR_CONTACT_RECORDED',
      userId: updatedBy,
      claimId: item.claimId,
      patientId: item.patientId,
      payerId: item.payerId,
      newState: { contactType: data.contactType, outcome: data.outcome },
      reason: data.notes ?? data.outcome,
      source: 'AR_WORK_ITEM',
    });
    return item;
  },

  async prioritizeWithAi(id: string, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    const [claim, denial, appeal] = await Promise.all([
      item.claimId ? Claim.findOne({ _id: item.claimId, isDeleted: false }) : Promise.resolve(null),
      item.denialId ? Denial.findOne({ _id: item.denialId, isDeleted: false }) : Promise.resolve(null),
      item.appealId ? Appeal.findOne({ _id: item.appealId, isDeleted: false }) : Promise.resolve(null),
    ]);
    const analysis = await rcmAiService.prioritizeArWork({
      arWorkItem: toPlainObject(item),
      claim: toPlainObject(claim) ?? {},
      denial: toPlainObject(denial) ?? {},
      appeal: toPlainObject(appeal) ?? {},
    });
    item.aiPriorityAnalysis = analysis as unknown as Record<string, unknown>;
    item.aiRecommendationHistory = [
      ...(item.aiRecommendationHistory ?? []),
      {
        type: 'AR_PRIORITIZATION',
        generatedAt: new Date(),
        generatedBy: updatedBy,
        ...analysis,
      },
    ];
    item.updated = new Date();
    assignAuditActor(item, 'updatedBy', updatedBy);
    await item.save();
    publishRcmRealtimeEvent({
      eventType: 'AI_RECOMMENDATION_RECORDED',
      title: 'AI AR prioritization completed',
      claimId: item.claimId ? String(item.claimId) : undefined,
      entityType: 'arWorkItem',
      entityId: String(item._id),
      status: item.status,
    });
    return item;
  },
};
