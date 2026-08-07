import { Denial } from './denial.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import {
  denialWorkflowService,
  DENIAL_STATUSES,
  assertDenialTransition,
  normalizeDenialStatus,
  recommendDenialDecision,
} from './denial-workflow.service';
import { correctedClaimService } from '../corrected-claim/corrected-claim.service';
import { appealService } from '../appeal/appeal.service';
import { withMongoTransaction } from '../../../utils/mongoose-transaction.util';
import { ArWorkItem } from '../ar-work-item/ar-work-item.model';
import { Claim } from '../claim/claim.model';
import { PaymentPosting } from '../payment-posting/payment-posting.model';
import { EraEobProcessing } from '../era-eob-processing/era-eob-processing.model';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import type { ClientSession } from 'mongoose';
import { claimClosureService } from '../claim/claim-closure.service';
import { assertUnsafeMutationAllowed, requireActionReason } from '../shared/rcm-lifecycle-safety';
import { rcmAiService } from '../workflow/rcm-ai.service';
import { auditLogService } from '../audit-log/audit-log.service';

function toPlainObject(value: any) {
  return value && typeof value.toObject === 'function' ? value.toObject() : value;
}

function ensureStatus(value: string) {
  if (!DENIAL_STATUSES.includes(value as any)) {
    throw new AppError(`Invalid denial status: ${value}`, HTTP_STATUS.BAD_REQUEST);
  }
}

function appendDenialStatusHistory(item: any, newStatus: string, reason: string | undefined, updatedBy: string, source: string) {
  const previousStatus = normalizeDenialStatus(item.denialStatus);
  item.statusHistory = [
    ...(item.statusHistory ?? []),
    {
      previousStatus,
      newStatus,
      reason,
      userId: updatedBy,
      timestamp: new Date(),
      source,
    },
  ];
  item.transitionAudit = [
    ...(item.transitionAudit ?? []),
    {
      previousStatus,
      newStatus,
      reason,
      userId: updatedBy,
      timestamp: new Date(),
      source,
    },
  ];
}

async function updateLinkedArStatus(item: any, status: string, nextAction: string, updatedBy: string, session?: ClientSession) {
  if (!item.arWorkItemId) return;
  const ar = await ArWorkItem.findOneAndUpdate(
    { _id: item.arWorkItemId, isDeleted: false },
    {
      status,
      nextAction,
      updatedBy,
      updated: new Date(),
    },
    { new: true, session },
  );
  if (ar) {
    publishRcmRealtimeEvent({
      eventType: 'AR_STATUS_CHANGED',
      title: 'AR work item updated',
      claimId: item.claimId ? String(item.claimId) : undefined,
      entityType: 'arWorkItem',
      entityId: String(ar._id),
      status: ar.status,
    });
  }
}

export const denialService = {
  async create(data: any, locale: string, createdBy: string, options: { session?: ClientSession } = {}) {
    const createWithSession = async (session?: ClientSession) => {
      const [item] = await Denial.create([{
      ...data,
      active: data.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
      }], { session });

      await denialWorkflowService.syncArWorkItemForDenial(item, createdBy, { session });
      await auditLogService.record({
        entityType: 'denial',
        entityId: item._id,
        action: 'DENIAL_CREATED',
        userId: createdBy,
        changedBy: createdBy,
        source: 'denial',
        claimId: item.claimId,
        patientId: item.patientId,
        payerId: item.payerId,
        reason: item.denialReason,
        newState: item.toObject(),
        session,
      });
    return item;
    };

    return options.session
      ? createWithSession(options.session)
      : withMongoTransaction((session) => createWithSession(session));
  },

  async getById(id: string, locale: string) {
    const item = await Denial.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('denial.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    assertUnsafeMutationAllowed('Denial', 'updated through generic CRUD');
    const item = await Denial.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('denial.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    Object.assign(item, {
      ...data,
      updatedBy,
      updated: new Date(),
    });

    await item.save();
    return item;
  },

  async assignOwner(id: string, owner: string, locale: string, updatedBy: string) {
    return withMongoTransaction(async (session) => {
    const item = await Denial.findOne({ _id: id, isDeleted: false }).session(session);
    if (!item) {
      throw new AppError(t('denial.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    item.owner = owner;
    item.updatedBy = updatedBy as any;
    item.updated = new Date();
    await item.save({ session });
    await denialWorkflowService.syncArWorkItemForDenial(item, updatedBy, { session });
    if (item.claimId) {
      await claimClosureService.syncClaimClosureStatus(String(item.claimId), updatedBy, session);
    }
    return item;
    });
  },

  async changeStatus(id: string, denialStatus: string, resolutionNotes: string | undefined, locale: string, updatedBy: string) {
    ensureStatus(denialStatus);
    return withMongoTransaction(async (session) => {
    const item = await Denial.findOne({ _id: id, isDeleted: false }).session(session);
    if (!item) {
      throw new AppError(t('denial.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    let transition;
    try {
      transition = assertDenialTransition(item.denialStatus, denialStatus, { source: 'STATUS_CHANGE', reason: resolutionNotes });
    } catch (error) {
      throw new AppError(error instanceof Error ? error.message : 'Invalid denial transition.', HTTP_STATUS.BAD_REQUEST);
    }
    if (transition.to === 'CLOSED' && !['RESOLVED', 'WRITTEN_OFF', 'TRANSFERRED_TO_PATIENT', 'COLLECTIONS'].includes(transition.from)) {
      throw new AppError('Denial cannot be closed without a resolution outcome.', HTTP_STATUS.BAD_REQUEST);
    }
    appendDenialStatusHistory(item, transition.to, resolutionNotes, updatedBy, 'STATUS_CHANGE');
    item.denialStatus = transition.to;
    if (resolutionNotes) item.resolutionNotes = resolutionNotes;
    if (['RESOLVED', 'WRITTEN_OFF', 'TRANSFERRED_TO_PATIENT', 'COLLECTIONS', 'CLOSED'].includes(transition.to)) {
      item.resolutionDate = new Date();
    }
    item.updatedBy = updatedBy as any;
    item.updated = new Date();
    await item.save({ session });
    await denialWorkflowService.syncArWorkItemForDenial(item, updatedBy, { session });
    if (item.claimId) {
      await claimClosureService.syncClaimClosureStatus(String(item.claimId), updatedBy, session);
    }
    publishRcmRealtimeEvent({
      eventType: 'DENIAL_STATUS_CHANGED',
      title: 'Denial status changed',
      claimId: item.claimId ? String(item.claimId) : undefined,
      entityType: 'denial',
      entityId: String(item._id),
      status: item.denialStatus,
    });
    publishRcmRealtimeEvent({
      eventType: 'DENIAL_TRANSITION_RECORDED',
      title: 'Denial lifecycle transition recorded',
      claimId: item.claimId ? String(item.claimId) : undefined,
      entityType: 'denial',
      entityId: String(item._id),
      status: item.denialStatus,
    });
    await auditLogService.record({
      entityType: 'denial',
      entityId: item._id,
      action: `DENIAL_${transition.to}`,
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'denial',
      claimId: item.claimId,
      patientId: item.patientId,
      payerId: item.payerId,
      reason: resolutionNotes,
      previousState: { denialStatus: transition.from },
      newState: { denialStatus: transition.to, resolutionDate: item.resolutionDate },
      session,
    });
    return item;
    });
  },

  async addResolutionNotes(id: string, resolutionNotes: string, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    item.resolutionNotes = resolutionNotes;
    item.updatedBy = updatedBy as any;
    item.updated = new Date();
    await item.save();
    return item;
  },

  async markPreventable(id: string, preventableFlag: boolean, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    item.preventableFlag = preventableFlag;
    item.updatedBy = updatedBy as any;
    item.updated = new Date();
    await item.save();
    return item;
  },

  async markReadyForCorrectedClaim(id: string, locale: string, updatedBy: string) {
    return withMongoTransaction(async (session) => {
    const item = await Denial.findOne({ _id: id, isDeleted: false }).session(session);
    if (!item) {
      throw new AppError(t('denial.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    await correctedClaimService.createFromDenial(String(item._id), {}, locale, updatedBy, { session });
    await denialWorkflowService.syncArWorkItemForDenial(item, updatedBy, { session });
    return item;
    });
  },

  async markReadyForAppeal(id: string, locale: string, updatedBy: string) {
    return withMongoTransaction(async (session) => {
    const item = await Denial.findOne({ _id: id, isDeleted: false }).session(session);
    if (!item) {
      throw new AppError(t('denial.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    await appealService.createFromDenial(String(item._id), {}, locale, updatedBy, { session });
    await denialWorkflowService.syncArWorkItemForDenial(item, updatedBy, { session });
    return Denial.findOne({ _id: id, isDeleted: false }).session(session);
    });
  },

  async getRecommendation(id: string, locale: string) {
    const item = await this.getById(id, locale);
    return recommendDenialDecision({
      category: item.denialCategory,
      carcCodes: item.carcCodes ?? (item.denialCode ? [item.denialCode] : []),
      rarcCodes: item.rarcCodes ?? [],
      preventableFlag: item.preventableFlag,
    });
  },

  async runAiAnalysis(id: string, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    const [claim, paymentPosting, era, arWorkItem] = await Promise.all([
      item.claimId ? Claim.findOne({ _id: item.claimId, isDeleted: false }) : Promise.resolve(null),
      item.paymentPostingId ? PaymentPosting.findOne({ _id: item.paymentPostingId, isDeleted: false }) : Promise.resolve(null),
      item.eraEobProcessingId ? EraEobProcessing.findOne({ _id: item.eraEobProcessingId, isDeleted: false }) : Promise.resolve(null),
      item.arWorkItemId ? ArWorkItem.findOne({ _id: item.arWorkItemId, isDeleted: false }) : Promise.resolve(null),
    ]);
    const analysis = await rcmAiService.analyzeDenial({
      denial: toPlainObject(item),
      claim: toPlainObject(claim) ?? {},
      paymentPosting: toPlainObject(paymentPosting) ?? {},
      era: toPlainObject(era) ?? {},
      arWorkItem: toPlainObject(arWorkItem) ?? {},
    });

    item.aiAnalysis = analysis as unknown as Record<string, unknown>;
    item.aiConfidenceScore = analysis.confidence;
    item.aiRecommendationSource = analysis.source;
    item.aiRecommendationHistory = [
      ...(item.aiRecommendationHistory ?? []),
      {
        type: 'DENIAL_ROOT_CAUSE_ANALYSIS',
        recommendation: analysis.recommendation,
        reason: analysis.recommendationReason,
        confidenceScore: analysis.confidence,
        source: analysis.source,
        generatedAt: new Date(),
        generatedBy: updatedBy,
        response: analysis,
        safeAutomation: 'ADVISORY_ONLY',
      },
    ];
    item.updatedBy = updatedBy as any;
    item.updated = new Date();
    await item.save();

    publishRcmRealtimeEvent({
      eventType: 'AI_RECOMMENDATION_RECORDED',
      title: 'AI denial analysis completed',
      claimId: item.claimId ? String(item.claimId) : undefined,
      entityType: 'denial',
      entityId: String(item._id),
      status: item.denialStatus,
    });
    return item;
  },

  async writeOff(id: string, resolutionNotes: string | undefined, locale: string, updatedBy: string) {
    const requiredNotes = requireActionReason(resolutionNotes, 'Denial write-off');
    return withMongoTransaction(async (session) => {
    const item = await Denial.findOne({ _id: id, isDeleted: false }).session(session);
    if (!item) {
      throw new AppError(t('denial.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    const currentStatus = normalizeDenialStatus(item.denialStatus);
    try {
      assertDenialTransition(item.denialStatus, 'WRITTEN_OFF', { source: 'WRITE_OFF', reason: requiredNotes });
    } catch (error) {
      throw new AppError(error instanceof Error ? error.message : 'Invalid denial transition.', HTTP_STATUS.BAD_REQUEST);
    }
    appendDenialStatusHistory(item, 'WRITTEN_OFF', requiredNotes, updatedBy, 'WRITE_OFF');
    item.denialStatus = 'WRITTEN_OFF';
    item.resolutionDate = new Date();
    item.resolutionNotes = requiredNotes;
    item.updatedBy = updatedBy as any;
    item.updated = new Date();
    await item.save({ session });
    await updateLinkedArStatus(item, 'CLOSED', 'Denied balance written off.', updatedBy, session);
    if (item.claimId) {
      await claimClosureService.syncClaimClosureStatus(String(item.claimId), updatedBy, session);
    }
    publishRcmRealtimeEvent({
      eventType: 'DENIAL_STATUS_CHANGED',
      title: 'Denial written off',
      claimId: item.claimId ? String(item.claimId) : undefined,
      entityType: 'denial',
      entityId: String(item._id),
      status: item.denialStatus,
    });
    await auditLogService.record({
      entityType: 'denial',
      entityId: item._id,
      action: 'DENIAL_WRITTEN_OFF',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'denial',
      claimId: item.claimId,
      patientId: item.patientId,
      payerId: item.payerId,
      reason: requiredNotes,
      previousState: { denialStatus: currentStatus },
      newState: { denialStatus: item.denialStatus, resolutionDate: item.resolutionDate },
      session,
    });
    return item;
    });
  },

  async transferToPatient(id: string, resolutionNotes: string | undefined, locale: string, updatedBy: string) {
    return withMongoTransaction(async (session) => {
      const item = await Denial.findOne({ _id: id, isDeleted: false }).session(session);
      if (!item) {
        throw new AppError(t('denial.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
      }

      const requiredNotes = requireActionReason(resolutionNotes, 'Denial transfer to patient responsibility');
      const currentStatus = normalizeDenialStatus(item.denialStatus);
      try {
        assertDenialTransition(item.denialStatus, 'TRANSFERRED_TO_PATIENT', { source: 'TRANSFER_TO_PATIENT', reason: requiredNotes });
      } catch (error) {
        throw new AppError(error instanceof Error ? error.message : 'Invalid denial transition.', HTTP_STATUS.BAD_REQUEST);
      }
      appendDenialStatusHistory(item, 'TRANSFERRED_TO_PATIENT', requiredNotes, updatedBy, 'TRANSFER_TO_PATIENT');
      item.denialStatus = 'TRANSFERRED_TO_PATIENT';
      item.resolutionDate = new Date();
      item.resolutionNotes = requiredNotes;
      item.updatedBy = updatedBy as any;
      item.updated = new Date();
      await item.save({ session });
      await updateLinkedArStatus(item, 'CLOSED', 'Transferred to patient responsibility.', updatedBy, session);
      if (item.claimId) {
        await claimClosureService.syncClaimClosureStatus(String(item.claimId), updatedBy, session);
      }

      publishRcmRealtimeEvent({
        eventType: 'DENIAL_STATUS_CHANGED',
        title: 'Denial transferred to patient responsibility',
        claimId: item.claimId ? String(item.claimId) : undefined,
        entityType: 'denial',
        entityId: String(item._id),
        status: item.denialStatus,
      });
      await auditLogService.record({
        entityType: 'denial',
        entityId: item._id,
        action: 'DENIAL_TRANSFERRED_TO_PATIENT',
        userId: updatedBy,
        changedBy: updatedBy,
        source: 'denial',
        claimId: item.claimId,
        patientId: item.patientId,
        payerId: item.payerId,
        reason: requiredNotes,
        previousState: { denialStatus: currentStatus },
        newState: { denialStatus: item.denialStatus, resolutionDate: item.resolutionDate },
        session,
      });
      return item;
    });
  },

  async reopen(id: string, reason: string | undefined, locale: string, updatedBy: string) {
    if (!reason?.trim()) {
      throw new AppError('Reopen reason is required.', HTTP_STATUS.BAD_REQUEST);
    }
    return withMongoTransaction(async (session) => {
      const item = await Denial.findOne({ _id: id, isDeleted: false }).session(session);
      if (!item) {
        throw new AppError(t('denial.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
      }

      const currentStatus = normalizeDenialStatus(item.denialStatus);
      try {
        assertDenialTransition(item.denialStatus, 'OPEN', { source: 'REOPEN', reason });
      } catch (error) {
        throw new AppError(error instanceof Error ? error.message : 'Invalid denial transition.', HTTP_STATUS.BAD_REQUEST);
      }
      appendDenialStatusHistory(item, 'OPEN', reason, updatedBy, 'REOPEN');
      item.denialStatus = 'OPEN';
      item.resolutionDate = undefined;
      item.resolutionNotes = reason;
      item.updatedBy = updatedBy as any;
      item.updated = new Date();
      await item.save({ session });
      await updateLinkedArStatus(item, 'OPEN', 'Denial reopened for follow-up.', updatedBy, session);
      if (item.claimId) {
        await claimClosureService.syncClaimClosureStatus(String(item.claimId), updatedBy, session);
      }

      publishRcmRealtimeEvent({
        eventType: 'DENIAL_STATUS_CHANGED',
        title: 'Denial reopened',
        claimId: item.claimId ? String(item.claimId) : undefined,
        entityType: 'denial',
        entityId: String(item._id),
        status: item.denialStatus,
      });
      await auditLogService.record({
        entityType: 'denial',
        entityId: item._id,
        action: 'DENIAL_REOPENED',
        userId: updatedBy,
        changedBy: updatedBy,
        source: 'denial',
        claimId: item.claimId,
        patientId: item.patientId,
        payerId: item.payerId,
        reason,
        previousState: { denialStatus: currentStatus },
        newState: { denialStatus: item.denialStatus },
        session,
      });
      return item;
    });
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    assertUnsafeMutationAllowed('Denial', 'deleted');

    const item = await Denial.findOneAndUpdate(
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
      throw new AppError(t('denial.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },
};
