import { CorrectedClaim } from './corrected-claim.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { Claim } from '../claim/claim.model';
import { Denial } from '../denial/denial.model';
import { claimService } from '../claim/claim.service';
import { appendStatusHistory } from '../workflow/workflow-history';
import { ClaimSubmission } from '../claim-submission/claim-submission.model';
import { ClaimTracking } from '../claim-tracking/claim-tracking.model';
import { PaymentPosting } from '../payment-posting/payment-posting.model';
import { EraEobProcessing } from '../era-eob-processing/era-eob-processing.model';
import { Appeal } from '../appeal/appeal.model';
import { ArWorkItem } from '../ar-work-item/ar-work-item.model';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { withMongoTransaction } from '../../../utils/mongoose-transaction.util';
import type { ClientSession } from 'mongoose';
import { claimClosureService } from '../claim/claim-closure.service';
import { assertUnsafeMutationAllowed } from '../shared/rcm-lifecycle-safety';
import { registerRcmJobHandler } from '../background-job/rcm-queue.service';
import { assertDenialTransition, denialWorkflowService, normalizeDenialStatus } from '../denial/denial-workflow.service';
import { auditLogService } from '../audit-log/audit-log.service';
import { assignAuditActor } from '../shared/audit-actor.util';

function normalizeCorrectionType(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return normalized === 'VOID' || normalized === 'CANCEL' ? 'VOID' : 'REPLACEMENT';
}

function frequencyCodeForCorrectionType(correctionType: string) {
  return correctionType === 'VOID' ? '8' : '7';
}

function removeSystemFields(source: any) {
  const clone = { ...source };
  delete clone._id;
  delete clone.claimId;
  delete clone.__v;
  delete clone.created;
  delete clone.updated;
  delete clone.createdAt;
  delete clone.updatedAt;
  delete clone.createdBy;
  delete clone.updatedBy;
  delete clone.isDeleted;
  delete clone.deletedAt;
  return clone;
}

function buildClaimClonePayload(originalClaim: any, correctedClaimId: unknown, denial: any, options: any, createdBy: string) {
  const correctionType = normalizeCorrectionType(options?.correctionType);
  const frequencyCode = frequencyCodeForCorrectionType(correctionType);
  const originalObject = typeof originalClaim.toObject === 'function' ? originalClaim.toObject() : originalClaim;
  const lineageSeed = Array.isArray(originalObject.lineageChain) && originalObject.lineageChain.length
    ? originalObject.lineageChain
    : [originalClaim.originalClaimId ?? originalClaim._id];

  const clonedLines = (originalObject.claimLines ?? []).map((line: any) => {
    const nextLine = { ...line };
    delete nextLine._id;
    return nextLine;
  });

  return {
    ...removeSystemFields(originalObject),
    originalClaimId: originalClaim.originalClaimId ?? originalClaim._id,
    correctedFromClaimId: originalClaim._id,
    sourceDenialId: denial?._id,
    correctedClaimRecordId: correctedClaimId,
    correctionType,
    correctedClaimIndicator: true,
    frequencyCode,
    claimStatus: 'Ready for Submission',
    scrubStatus: 'Passed',
    submissionStatus: 'Not Submitted',
    rejectionReason: undefined,
    batchId: undefined,
    clearingHouse: undefined,
    ediStatus: undefined,
    paymentStatus: undefined,
    claimLines: clonedLines,
    lineageChain: lineageSeed,
    statusHistory: appendStatusHistory(
      originalObject.statusHistory,
      'Ready for Submission',
      createdBy,
      `Corrected claim cloned from ${String(originalClaim._id)} for ${denial?.denialCode ?? 'denial rework'}`
    ),
    active: true,
    isDeleted: false,
    created: new Date(),
    updated: new Date(),
    createdBy,
  };
}

function readValue(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value ?? null);
}

function trackChange(changes: any[], field: string, before: unknown, after: unknown) {
  if (readValue(before) !== readValue(after)) {
    changes.push({ field, before, after });
  }
}

function isOpenCorrectedClaimStatus(value: unknown) {
  const status = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return !['SUBMITTED', 'CLOSED', 'RESOLVED'].includes(status);
}

function canMoveDenialToCorrectedClaim(denial: any) {
  const status = normalizeDenialStatus(denial.denialStatus);
  return status === 'OPEN' || status === 'UPHELD' || status === 'CORRECTED_CLAIM_PENDING';
}

function objectIdStrings(values: unknown[]) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value))));
}

export const correctedClaimService = {
  async create(data: any, locale: string, createdBy: string, options: { session?: ClientSession } = {}) {
    const [item] = await CorrectedClaim.create([{
      ...data,
      active: data.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    }], { session: options.session });

    await auditLogService.record({
      entityType: 'correctedClaim',
      entityId: item._id,
      action: 'CORRECTED_CLAIM_CREATED',
      userId: createdBy,
      claimId: item.clonedClaimId ?? item.originalClaimId ?? item.correctedFromClaimId,
      newState: { status: item.correctedClaimStatus, correctionType: item.correctionType },
      source: 'CORRECTED_CLAIM',
      session: options.session,
    });

    return item;
  },

  async getById(id: string, locale: string) {
    const item = await CorrectedClaim.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('correctedClaim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    assertUnsafeMutationAllowed('Corrected claim', 'updated through generic CRUD');
    const item = await CorrectedClaim.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('correctedClaim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    Object.assign(item, {
      ...data,
      updatedBy,
      updated: new Date(),
    });

    await item.save();
    const claimId = item.clonedClaimId ?? item.correctedFromClaimId ?? item.originalClaimId;
    if (claimId) {
      await claimClosureService.syncClaimClosureStatus(String(claimId), updatedBy);
    }
    return item;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    assertUnsafeMutationAllowed('Corrected claim', 'deleted');
    const item = await CorrectedClaim.findOneAndUpdate(
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
      throw new AppError(t('correctedClaim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },

  async createFromDenial(denialId: string, data: any, locale: string, createdBy: string, options: { session?: ClientSession } = {}) {
    const createWithSession = async (session?: ClientSession) => {
    const denial = await Denial.findOne({ _id: denialId, isDeleted: false }).session(session ?? null);
    if (!denial) {
      throw new AppError(t('denial.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    if (!denial.claimId) {
      throw new AppError('Denial is not linked to a claim.', HTTP_STATUS.BAD_REQUEST);
    }

    const originalClaim = await Claim.findOne({ _id: denial.claimId, isDeleted: false }).session(session ?? null);
    if (!originalClaim) {
      throw new AppError(t('claim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const correctionType = normalizeCorrectionType(data?.correctionType);
    const frequencyCode = frequencyCodeForCorrectionType(correctionType);
    const correctionReason = data?.correctionReason ?? denial.denialReason ?? denial.recommendedAction;
    const sourcePreviousStatus = normalizeDenialStatus(denial.denialStatus);
    const rootClaimId = originalClaim.originalClaimId ?? originalClaim._id;
    const relatedDenialCandidates = await Denial.find({
      isDeleted: false,
      claimId: originalClaim._id,
    }).session(session ?? null);
    const relatedDenials = relatedDenialCandidates.filter((candidate: any) => {
      if (String(candidate._id) === String(denial._id)) return true;
      if (candidate.correctedClaimId && !canMoveDenialToCorrectedClaim(candidate)) return false;
      return canMoveDenialToCorrectedClaim(candidate);
    });
    const linkedCorrectedClaimIds = objectIdStrings(relatedDenials.map((candidate: any) => candidate.correctedClaimId));

    let item = await CorrectedClaim.findOne({
      isDeleted: false,
      correctedClaimStatus: { $nin: ['SUBMITTED', 'CLOSED', 'RESOLVED'] },
      $or: [
        ...(linkedCorrectedClaimIds.length ? [{ _id: { $in: linkedCorrectedClaimIds } }] : []),
        { correctedFromClaimId: originalClaim._id },
        { originalClaimId: rootClaimId },
      ],
    }).session(session ?? null);

    if (item && !isOpenCorrectedClaimStatus(item.correctedClaimStatus)) {
      item = null;
    }

    if (!item) {
      const [createdCorrectedClaim] = await CorrectedClaim.create([{
        originalClaimId: rootClaimId,
        denialId: denial._id,
        sourceDenialId: denial._id,
        correctedFromClaimId: originalClaim._id,
        correctionReason,
        correctionType,
        frequencyCode,
        resubmissionReason: correctionReason,
        correctedFrequencyCode: frequencyCode,
        correctedClaimStatus: 'DRAFT',
        agingDueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        correctedFieldsChanged: [],
        correctedFields: [],
        lineageChain: Array.isArray(originalClaim.lineageChain) && originalClaim.lineageChain.length
          ? originalClaim.lineageChain
          : [originalClaim.originalClaimId ?? originalClaim._id],
        correctionAudit: [{
          action: 'CORRECTED_CLAIM_CREATED',
          correctedBy: createdBy,
          correctedAt: new Date(),
          denialId: denial._id,
          linkedDenialIds: relatedDenials.map((candidate: any) => candidate._id),
        }],
        notes: 'Corrected claim shell created from denial. Submission is manual after readiness.',
        active: true,
        created: new Date(),
        updated: new Date(),
        createdBy,
      }], { session });
      item = createdCorrectedClaim;
    }

    if (!item.clonedClaimId) {
      const [clonedClaim] = await Claim.create([buildClaimClonePayload(originalClaim, item._id, denial, { correctionType }, createdBy)], { session });
      clonedClaim.lineageChain = [
        ...((Array.isArray(item.lineageChain) && item.lineageChain.length ? item.lineageChain : [originalClaim._id]) as any[]),
        clonedClaim._id,
      ] as any;
      await clonedClaim.save({ session });

      item.clonedClaimId = clonedClaim._id;
      item.lineageChain = clonedClaim.lineageChain as any;
      item.updated = new Date();
      item.updatedBy = createdBy as any;
      await item.save({ session });
    }

    const linkedDenialIds = [];
    for (const relatedDenial of relatedDenials) {
      const previousStatus = normalizeDenialStatus(relatedDenial.denialStatus);
      if (previousStatus !== 'CORRECTED_CLAIM_PENDING') {
        try {
          assertDenialTransition(relatedDenial.denialStatus, 'CORRECTED_CLAIM_PENDING', {
            source: 'CORRECTED_CLAIM_CREATED',
            reason: correctionReason,
          });
        } catch (error) {
          if (String(relatedDenial._id) === String(denial._id)) {
            throw new AppError(error instanceof Error ? error.message : 'Invalid denial transition.', HTTP_STATUS.BAD_REQUEST);
          }
          continue;
        }
      }

      relatedDenial.correctedClaimId = item._id;
      relatedDenial.denialStatus = 'CORRECTED_CLAIM_PENDING';
      relatedDenial.correctionEligible = true;
      relatedDenial.reworkType = 'CORRECTED_CLAIM';
      relatedDenial.statusHistory = [
        ...(relatedDenial.statusHistory ?? []),
        {
          previousStatus,
          newStatus: 'CORRECTED_CLAIM_PENDING',
          reason: correctionReason,
          userId: createdBy,
          timestamp: new Date(),
          source: 'CORRECTED_CLAIM_CREATED',
          correctedClaimId: item._id,
        },
      ];
      relatedDenial.updated = new Date();
      relatedDenial.updatedBy = createdBy as any;
      await relatedDenial.save({ session });
      await denialWorkflowService.syncArWorkItemForDenial(relatedDenial, createdBy, { session });
      linkedDenialIds.push(String(relatedDenial._id));
    }

    item.correctionAudit = [
      ...(item.correctionAudit ?? []),
      {
        action: 'DENIALS_LINKED_TO_CORRECTED_CLAIM',
        linkedBy: createdBy,
        linkedAt: new Date(),
        linkedDenialIds,
      },
    ];
    item.updated = new Date();
    item.updatedBy = createdBy as any;
    await item.save({ session });

    await auditLogService.record({
      entityType: 'correctedClaim',
      entityId: item._id,
      action: 'CORRECTED_CLAIM_CREATED',
      userId: createdBy,
      claimId: item.clonedClaimId ?? item.originalClaimId ?? originalClaim._id,
      payerId: originalClaim.payerId,
      patientId: originalClaim.patientId,
      previousState: { sourceDenialStatus: sourcePreviousStatus },
      newState: { status: item.correctedClaimStatus, correctionType, sourceDenialId: denial._id, linkedDenialIds },
      reason: correctionReason,
      source: 'CORRECTED_CLAIM',
      session,
    });

    return item;
    };

    return options.session
      ? createWithSession(options.session)
      : withMongoTransaction((session) => createWithSession(session));
  },

  async createFromClaim(claimId: string, data: any, locale: string, createdBy: string, options: { session?: ClientSession } = {}) {
    const createWithSession = async (session?: ClientSession) => {
    const originalClaim = await Claim.findOne({ _id: claimId, isDeleted: false }).session(session ?? null);
    if (!originalClaim) {
      throw new AppError(t('claim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const latestDenial = await Denial.findOne({ claimId: originalClaim._id, isDeleted: false })
      .sort({ denialDate: -1, created: -1 })
      .session(session ?? null);

    let item = await CorrectedClaim.findOne({
      isDeleted: false,
      correctedFromClaimId: originalClaim._id,
      sourceDenialId: latestDenial?._id,
    }).session(session ?? null);

    const correctionType = normalizeCorrectionType(data?.correctionType);
    const frequencyCode = frequencyCodeForCorrectionType(correctionType);
    const correctionReason = data?.correctionReason ?? originalClaim.rejectionReason ?? latestDenial?.recommendedAction ?? 'Corrected claim created from rejected claim tracking.';

    if (!item) {
      const [createdCorrectedClaim] = await CorrectedClaim.create([{
        originalClaimId: originalClaim.originalClaimId ?? originalClaim._id,
        denialId: latestDenial?._id,
        sourceDenialId: latestDenial?._id,
        correctedFromClaimId: originalClaim._id,
        correctionReason,
        correctionType,
        frequencyCode,
        resubmissionReason: correctionReason,
        correctedFrequencyCode: frequencyCode,
        correctedClaimStatus: 'DRAFT',
        agingDueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        correctedFieldsChanged: [],
        correctedFields: [],
        lineageChain: Array.isArray(originalClaim.lineageChain) && originalClaim.lineageChain.length
          ? originalClaim.lineageChain
          : [originalClaim.originalClaimId ?? originalClaim._id],
        correctionAudit: [{
          action: 'CORRECTED_CLAIM_CREATED_FROM_REJECTION',
          correctedBy: createdBy,
          correctedAt: new Date(),
          claimId: originalClaim._id,
          denialId: latestDenial?._id,
        }],
        notes: 'Corrected claim shell created from rejected claim tracking. Submission is manual after readiness.',
        active: true,
        created: new Date(),
        updated: new Date(),
        createdBy,
      }], { session });
      item = createdCorrectedClaim;
    }

    if (!item.clonedClaimId) {
      const [clonedClaim] = await Claim.create([buildClaimClonePayload(originalClaim, item._id, latestDenial, { correctionType }, createdBy)], { session });
      clonedClaim.lineageChain = [
        ...((Array.isArray(item.lineageChain) && item.lineageChain.length ? item.lineageChain : [originalClaim._id]) as any[]),
        clonedClaim._id,
      ] as any;
      await clonedClaim.save({ session });

      item.clonedClaimId = clonedClaim._id;
      item.lineageChain = clonedClaim.lineageChain as any;
      item.updated = new Date();
      item.updatedBy = createdBy as any;
      await item.save({ session });
    }

    if (latestDenial) {
      try {
        assertDenialTransition(latestDenial.denialStatus, 'CORRECTED_CLAIM_PENDING', {
          source: 'CORRECTED_CLAIM_CREATED_FROM_REJECTION',
          reason: correctionReason,
        });
      } catch (error) {
        throw new AppError(error instanceof Error ? error.message : 'Invalid denial transition.', HTTP_STATUS.BAD_REQUEST);
      }
      latestDenial.correctedClaimId = item._id;
      latestDenial.denialStatus = 'CORRECTED_CLAIM_PENDING';
      latestDenial.correctionEligible = true;
      latestDenial.reworkType = 'CORRECTED_CLAIM';
      latestDenial.updated = new Date();
      latestDenial.updatedBy = createdBy as any;
      await latestDenial.save({ session });
    }

    await auditLogService.record({
      entityType: 'correctedClaim',
      entityId: item._id,
      action: 'CORRECTED_CLAIM_CREATED',
      userId: createdBy,
      claimId: item.clonedClaimId ?? item.originalClaimId ?? originalClaim._id,
      payerId: originalClaim.payerId,
      patientId: originalClaim.patientId,
      newState: { status: item.correctedClaimStatus, correctionType, sourceDenialId: latestDenial?._id },
      reason: correctionReason,
      source: 'CORRECTED_CLAIM',
      session,
    });

    return item;
    };

    return options.session
      ? createWithSession(options.session)
      : withMongoTransaction((session) => createWithSession(session));
  },

  async applyCorrections(id: string, data: any, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    if (!item.clonedClaimId) {
      throw new AppError('Corrected claim has not been cloned from the original claim yet.', HTTP_STATUS.BAD_REQUEST);
    }

    const claim = await Claim.findOne({ _id: item.clonedClaimId, isDeleted: false });
    if (!claim) {
      throw new AppError(t('claim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const lockedSubmissionStatuses = new Set(['Queued', 'Submitted', 'Printed', 'Transmitted', 'Acknowledged']);
    if (claim.submissionStatus && lockedSubmissionStatuses.has(claim.submissionStatus)) {
      throw new AppError('Submitted corrected claims cannot be edited. Create another corrected claim iteration.', HTTP_STATUS.BAD_REQUEST);
    }

    const changes: any[] = [];
    const safeTopLevelFields = [
      'payerId',
      'coveragePriority',
      'diagnosisCodes',
      'patientId',
      'billingProviderId',
      'renderingProviderId',
      'facilityId',
    ];

    safeTopLevelFields.forEach((field) => {
      if (data[field] !== undefined) {
        trackChange(changes, field, (claim as any)[field], data[field]);
        (claim as any)[field] = data[field];
      }
    });

    (claim.claimLines ?? []).forEach((line: any) => {
      if (data.priorAuthorizationId !== undefined) {
        trackChange(changes, `claimLines.${line._id}.priorAuthorizationId`, line.priorAuthorizationId, data.priorAuthorizationId);
        line.priorAuthorizationId = data.priorAuthorizationId;
      }
      if (data.referralId !== undefined) {
        trackChange(changes, `claimLines.${line._id}.referralId`, line.referralId, data.referralId);
        line.referralId = data.referralId;
      }
    });

    (data.claimLines ?? []).forEach((patch: any) => {
      const line = (claim.claimLines ?? []).find((candidate: any) => String(candidate._id) === String(patch.claimLineId));
      if (!line) return;

      ['modifiers', 'icdPointers', 'priorAuthorizationId', 'referralId'].forEach((field) => {
        if (patch[field] !== undefined) {
          const editableLine = line as any;
          trackChange(changes, `claimLines.${line._id}.${field}`, editableLine[field], patch[field]);
          editableLine[field] = patch[field];
        }
      });
    });

    if (!changes.length) {
      return { correctedClaim: item, claim, changes: [] };
    }

    claim.claimStatus = 'Ready for Submission';
    claim.submissionStatus = 'Not Submitted';
    claim.statusHistory = appendStatusHistory(claim.statusHistory, 'Ready for Submission', updatedBy, 'Corrected claim fields updated');
    claim.updated = new Date();
    claim.updatedBy = updatedBy as any;
    await claim.save();

    item.correctionReason = data.correctionReason ?? item.correctionReason;
    item.correctionType = normalizeCorrectionType(data.correctionType ?? item.correctionType);
    item.frequencyCode = frequencyCodeForCorrectionType(item.correctionType ?? 'REPLACEMENT');
    item.correctedFrequencyCode = item.frequencyCode;
    item.correctedClaimStatus = 'READY_FOR_REVIEW';
    item.correctedFieldsChanged = Array.from(new Set([...(item.correctedFieldsChanged ?? []), ...changes.map((change) => change.field)]));
    item.correctedFields = [...(item.correctedFields ?? []), ...changes];
    item.correctionAudit = [
      ...(item.correctionAudit ?? []),
      { action: 'CORRECTION_FIELDS_UPDATED', correctedBy: updatedBy, correctedAt: new Date(), changes },
    ];
    item.updated = new Date();
    item.updatedBy = updatedBy as any;
    await item.save();

    await auditLogService.record({
      entityType: 'correctedClaim',
      entityId: item._id,
      action: 'CORRECTED_CLAIM_UPDATED',
      userId: updatedBy,
      claimId: item.clonedClaimId ?? item.originalClaimId,
      previousState: { changedFields: changes.map((change) => change.field) },
      newState: { status: item.correctedClaimStatus, changedFields: item.correctedFieldsChanged },
      reason: data.correctionReason,
      source: 'CORRECTED_CLAIM',
    });

    return { correctedClaim: item, claim, changes };
  },

  async getReadiness(id: string, locale: string) {
    const item = await this.getById(id, locale);
    if (!item.clonedClaimId) {
      throw new AppError('Corrected claim has no cloned claim to validate.', HTTP_STATUS.BAD_REQUEST);
    }

    const readiness = await claimService.getReadiness(String(item.clonedClaimId), locale);
    return { correctedClaim: item, claimId: String(item.clonedClaimId), readiness };
  },

  async submit(id: string, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    if (!item.clonedClaimId) {
      throw new AppError('Corrected claim has no cloned claim to submit.', HTTP_STATUS.BAD_REQUEST);
    }

    const result = await claimService.submit(String(item.clonedClaimId), locale, updatedBy);
    return withMongoTransaction(async (session) => {
    const transactionalItem = await CorrectedClaim.findOne({ _id: id, isDeleted: false }).session(session);
    if (!transactionalItem) {
      throw new AppError(t('correctedClaim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    transactionalItem.correctedClaimStatus = 'SUBMITTED';
    transactionalItem.submittedDate = new Date();
    transactionalItem.correctionAudit = [
      ...(transactionalItem.correctionAudit ?? []),
      { action: 'CORRECTED_CLAIM_SUBMITTED', submittedBy: updatedBy, submittedAt: new Date(), claimSubmissionId: result.claimSubmissionId },
    ];
    transactionalItem.updated = new Date();
    transactionalItem.updatedBy = updatedBy as any;
    await transactionalItem.save({ session });

    if (transactionalItem.denialId) {
      const denial = await Denial.findOne({ _id: transactionalItem.denialId, isDeleted: false }).session(session);
      if (denial) {
        denial.statusHistory = [
          ...(denial.statusHistory ?? []),
          {
            previousStatus: denial.denialStatus,
            newStatus: 'CORRECTED_CLAIM_SUBMITTED',
            reason: 'Corrected claim submitted.',
            userId: updatedBy,
            timestamp: new Date(),
            source: 'CORRECTED_CLAIM_SUBMITTED',
            correctedClaimId: transactionalItem._id,
          },
        ];
        denial.denialStatus = 'CORRECTED_CLAIM_PENDING';
        denial.correctedClaimId = transactionalItem._id;
        denial.updated = new Date();
        denial.updatedBy = updatedBy as any;
        await denial.save({ session });

        if (denial.arWorkItemId) {
          await ArWorkItem.updateOne(
            { _id: denial.arWorkItemId, isDeleted: false },
            {
              correctedClaimId: transactionalItem._id,
              status: 'CORRECTED_CLAIM_PENDING',
              nextAction: 'Monitor corrected claim acknowledgement and reprocessed ERA.',
              updated: new Date(),
              updatedBy,
            },
            { session },
          );
        }
      }
    }

    publishRcmRealtimeEvent({
      eventType: 'CORRECTED_CLAIM_SUBMITTED',
      title: 'Corrected claim submitted',
      claimId: transactionalItem.clonedClaimId ? String(transactionalItem.clonedClaimId) : undefined,
      entityType: 'correctedClaim',
      entityId: String(transactionalItem._id),
      status: transactionalItem.correctedClaimStatus,
    });

    await auditLogService.record({
      entityType: 'correctedClaim',
      entityId: transactionalItem._id,
      action: 'CORRECTED_CLAIM_SUBMITTED',
      userId: updatedBy,
      claimId: transactionalItem.clonedClaimId ?? transactionalItem.originalClaimId,
      submissionId: (result as any).claimSubmissionId,
      newState: { status: transactionalItem.correctedClaimStatus, submittedDate: transactionalItem.submittedDate },
      source: 'CORRECTED_CLAIM',
      session,
    });

    if (transactionalItem.clonedClaimId) {
      await claimClosureService.syncClaimClosureStatus(String(transactionalItem.clonedClaimId), updatedBy, session);
    }
    if (transactionalItem.originalClaimId) {
      await claimClosureService.syncClaimClosureStatus(String(transactionalItem.originalClaimId), updatedBy, session);
    }

      return { correctedClaim: transactionalItem, ...result };
    });
  },

  async getLineageByClaimId(claimId: string, locale: string) {
    const claim = await Claim.findOne({ _id: claimId, isDeleted: false });
    if (!claim) {
      throw new AppError(t('claim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const rootClaimId = claim.originalClaimId ?? claim._id;
    const claimDocs = await Claim.find({
      isDeleted: false,
      $or: [
        { _id: rootClaimId },
        { originalClaimId: rootClaimId },
        { correctedFromClaimId: claim._id },
      ],
    }).sort({ created: 1 }).lean();
    const claimIds = claimDocs.map((item) => item._id);

    const [correctedClaims, appeals, submissions, trackingEvents, paymentPostings, eraRecords] = await Promise.all([
      CorrectedClaim.find({ isDeleted: false, $or: [{ originalClaimId: rootClaimId }, { clonedClaimId: { $in: claimIds } }] }).sort({ created: 1 }).lean(),
      Appeal.find({ isDeleted: false, claimId: { $in: claimIds } }).sort({ created: 1 }).lean(),
      ClaimSubmission.find({ isDeleted: false, claimId: { $in: claimIds } }).sort({ submissionDateTime: 1, created: 1 }).lean(),
      ClaimTracking.find({ isDeleted: false, claimId: { $in: claimIds } }).sort({ timestamp: 1, receivedDate: 1 }).lean(),
      PaymentPosting.find({ isDeleted: false, claimId: { $in: claimIds } }).sort({ paymentDate: 1, created: 1 }).lean(),
      EraEobProcessing.find({ isDeleted: false, 'matchedClaims.claimId': { $in: claimIds.map((value) => String(value)) } }).sort({ receivedDate: 1 }).lean(),
    ]);

    return {
      rootClaimId: String(rootClaimId),
      activeClaimId: String(claim._id),
      claims: claimDocs,
      correctedClaims,
      appeals,
      submissions,
      trackingEvents,
      paymentPostings,
      eraRecords,
    };
  },

  async finalizeResolvedByPayment(options: {
    claimId?: unknown;
    denialId?: unknown;
    paymentPostingId?: unknown;
    updatedBy?: string;
    session?: ClientSession;
  }) {
    const query: any = { isDeleted: false };
    if (options.denialId) {
      query.$or = [{ denialId: options.denialId }, { sourceDenialId: options.denialId }];
    } else if (options.claimId) {
      query.$or = [{ clonedClaimId: options.claimId }, { originalClaimId: options.claimId }, { correctedFromClaimId: options.claimId }];
    } else {
      return [];
    }

    const items = await CorrectedClaim.find(query).session(options.session ?? null);
    const finalized = [];
    for (const item of items) {
      if (['CLOSED', 'RESOLVED'].includes(String(item.correctedClaimStatus ?? '').toUpperCase())) {
        continue;
      }
      item.correctedClaimStatus = 'CLOSED';
      item.closedAt = new Date();
      item.closedBy = options.updatedBy as any;
      item.closureReason = 'Corrected claim resolved by reprocessed payment.';
      item.correctionAudit = [
        ...(item.correctionAudit ?? []),
        {
          action: 'CORRECTED_CLAIM_CLOSED',
          paymentPostingId: options.paymentPostingId,
          denialId: options.denialId,
          closedBy: options.updatedBy,
          closedAt: new Date(),
        },
      ];
      item.updated = new Date();
      if (options.updatedBy) item.updatedBy = options.updatedBy as any;
      await item.save({ session: options.session });
      await auditLogService.record({
        entityType: 'correctedClaim',
        entityId: item._id,
        action: 'CORRECTED_CLAIM_CLOSED',
        userId: options.updatedBy,
        claimId: item.clonedClaimId ?? item.originalClaimId,
        financialEventId: options.paymentPostingId,
        newState: { status: item.correctedClaimStatus, closureReason: item.closureReason },
        source: 'CORRECTED_CLAIM',
        session: options.session,
      });
      publishRcmRealtimeEvent({
        eventType: 'CORRECTED_CLAIM_CLOSED',
        title: 'Corrected claim closed',
        claimId: item.clonedClaimId ? String(item.clonedClaimId) : undefined,
        entityType: 'correctedClaim',
        entityId: String(item._id),
        status: item.correctedClaimStatus,
      });
      finalized.push(item);
    }
    return finalized;
  },
};

export async function runCorrectedClaimAgingCheck(updatedBy = 'rcm-corrected-claim-aging') {
  const now = new Date();
  const items = await CorrectedClaim.find({
    isDeleted: false,
    active: true,
    correctedClaimStatus: { $in: ['DRAFT', 'READY_FOR_REVIEW', 'SUBMITTED', 'PENDING', 'REJECTED'] },
    agingDueAt: { $lte: now },
  }).limit(100);

  for (const item of items) {
    item.escalatedAt = item.escalatedAt ?? now;
    item.escalationCount = (item.escalationCount ?? 0) + 1;
    item.correctionAudit = [
      ...(item.correctionAudit ?? []),
      {
        action: 'CORRECTED_CLAIM_AGING_ESCALATED',
        reason: 'Corrected claim exceeded aging threshold.',
        escalatedBy: updatedBy,
        escalatedAt: now,
      },
    ];
    item.updated = now;
    assignAuditActor(item, 'updatedBy', updatedBy);
    await item.save();

    publishRcmRealtimeEvent({
      eventType: 'CORRECTED_CLAIM_AGING_ESCALATED',
      title: 'Corrected claim aging escalated',
      claimId: item.clonedClaimId ? String(item.clonedClaimId) : undefined,
      entityType: 'correctedClaim',
      entityId: String(item._id),
      status: item.correctedClaimStatus,
    });
  }

  return { escalatedCorrectedClaims: items.length };
}

registerRcmJobHandler('CHECK_CORRECTED_CLAIM_AGING', async (job) => {
  await runCorrectedClaimAgingCheck(String(job.updatedBy ?? 'rcm-corrected-claim-aging'));
});
