import { Adjustment, IAdjustment } from '../adjustment/adjustment.model';
import { ArWorkItem } from '../ar-work-item/ar-work-item.model';
import { Claim, IClaim } from '../claim/claim.model';
import { CorrectedClaim } from '../corrected-claim/corrected-claim.model';
import { Denial, IDenial } from './denial.model';
import { Appeal } from '../appeal/appeal.model';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import type { ClientSession } from 'mongoose';
import { registerRcmJobHandler } from '../background-job/rcm-queue.service';
import { auditLogService } from '../audit-log/audit-log.service';
import { assignAuditActor, auditActorPatch } from '../shared/audit-actor.util';

export const DENIAL_STATUSES = [
  'OPEN',
  'APPEAL_READY',
  'APPEALED',
  'PAYER_REVIEW',
  'OVERTURNED',
  'UPHELD',
  'PARTIALLY_OVERTURNED',
  'CORRECTED_CLAIM_PENDING',
  'TRANSFERRED_TO_PATIENT',
  'COLLECTIONS',
  'RESOLVED',
  'WRITTEN_OFF',
  'CLOSED',
  // Legacy statuses are accepted for existing records and normalized on transition.
  'IN_REVIEW',
  'AWAITING_PAYER_RESPONSE',
  'NEEDS_CORRECTION',
  'CORRECTED_CLAIM_READY',
  'CORRECTED_CLAIM_SUBMITTED',
] as const;

export type DenialStatus = typeof DENIAL_STATUSES[number];

const DENIAL_STATUS_ALIASES: Record<string, DenialStatus> = {
  IN_REVIEW: 'PAYER_REVIEW',
  AWAITING_PAYER_RESPONSE: 'PAYER_REVIEW',
  NEEDS_CORRECTION: 'CORRECTED_CLAIM_PENDING',
  CORRECTED_CLAIM_READY: 'CORRECTED_CLAIM_PENDING',
  CORRECTED_CLAIM_SUBMITTED: 'CORRECTED_CLAIM_PENDING',
};

const DENIAL_TRANSITIONS: Record<string, DenialStatus[]> = {
  OPEN: ['APPEAL_READY', 'CORRECTED_CLAIM_PENDING', 'TRANSFERRED_TO_PATIENT', 'WRITTEN_OFF'],
  APPEAL_READY: ['APPEALED'],
  APPEALED: ['PAYER_REVIEW'],
  PAYER_REVIEW: ['OVERTURNED', 'UPHELD', 'PARTIALLY_OVERTURNED'],
  OVERTURNED: ['RESOLVED'],
  PARTIALLY_OVERTURNED: ['RESOLVED', 'APPEALED'],
  UPHELD: ['WRITTEN_OFF', 'COLLECTIONS', 'TRANSFERRED_TO_PATIENT', 'CORRECTED_CLAIM_PENDING'],
  CORRECTED_CLAIM_PENDING: ['PAYER_REVIEW', 'RESOLVED', 'CLOSED'],
  TRANSFERRED_TO_PATIENT: ['CLOSED'],
  COLLECTIONS: ['CLOSED'],
  RESOLVED: ['CLOSED'],
  WRITTEN_OFF: ['CLOSED'],
  CLOSED: [],
};

export function normalizeDenialStatus(value: unknown): DenialStatus {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : 'OPEN';
  const aliased = DENIAL_STATUS_ALIASES[normalized] ?? normalized;
  return DENIAL_STATUSES.includes(aliased as DenialStatus) ? aliased as DenialStatus : 'OPEN';
}

export function assertDenialTransition(current: unknown, next: unknown, options: { source?: string; reason?: string } = {}) {
  const from = normalizeDenialStatus(current);
  const to = normalizeDenialStatus(next);
  if (from === to) return { from, to };

  if (options.source === 'REOPEN') {
    if (!options.reason?.trim()) {
      throw new Error('Denial reopen reason is required.');
    }
    return { from, to: 'OPEN' as DenialStatus };
  }

  const allowed = DENIAL_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid denial transition from ${from} to ${to}.`);
  }
  return { from, to };
}

export const DENIAL_CATEGORIES = [
  'ELIGIBILITY',
  'AUTHORIZATION',
  'REFERRAL',
  'CODING',
  'MEDICAL_NECESSITY',
  'TIMELY_FILING',
  'DUPLICATE',
  'COORDINATION_OF_BENEFITS',
  'INFORMATION_MISSING',
  'COVERAGE',
  'OTHER',
] as const;

type DenialCategory = typeof DENIAL_CATEGORIES[number];

const CATEGORY_BY_CARC: Record<string, DenialCategory> = {
  '16': 'INFORMATION_MISSING',
  '18': 'DUPLICATE',
  '22': 'COORDINATION_OF_BENEFITS',
  '26': 'ELIGIBILITY',
  '27': 'ELIGIBILITY',
  '29': 'TIMELY_FILING',
  '31': 'ELIGIBILITY',
  '50': 'MEDICAL_NECESSITY',
  '96': 'COVERAGE',
  '109': 'COVERAGE',
  '119': 'COVERAGE',
  '151': 'INFORMATION_MISSING',
  '197': 'AUTHORIZATION',
  '198': 'REFERRAL',
  '234': 'CODING',
};

const CATEGORY_ACTIONS: Record<DenialCategory, string> = {
  ELIGIBILITY: 'Verify coverage for the service date, correct subscriber/payer details, and rebill if coverage is active.',
  AUTHORIZATION: 'Review authorization evidence and mark appeal-ready or corrected-claim-ready based on payer requirements.',
  REFERRAL: 'Attach valid referral evidence or prepare corrected claim if referral data was missing from the original claim.',
  CODING: 'Route to coding review, correct CPT/modifier/diagnosis data, and prepare a corrected claim if supported.',
  MEDICAL_NECESSITY: 'Review medical documentation and payer policy before appeal readiness.',
  TIMELY_FILING: 'Check timely filing proof and payer exceptions before appeal readiness.',
  DUPLICATE: 'Validate original claim history and payer duplicate rationale before rework.',
  COORDINATION_OF_BENEFITS: 'Verify primary/secondary payer order and update COB details before rebill.',
  INFORMATION_MISSING: 'Collect missing documentation or required data and prepare a correction package.',
  COVERAGE: 'Review coverage rules, benefit exclusions, and payer policy before rework.',
  OTHER: 'Review CARC/RARC details manually; automated classification was not confident.',
};

const CORRECTION_ELIGIBLE_CATEGORIES = new Set<DenialCategory>([
  'CODING',
  'INFORMATION_MISSING',
  'COORDINATION_OF_BENEFITS',
  'REFERRAL',
  'ELIGIBILITY',
]);

function normalizeCodes(codes: unknown) {
  return Array.isArray(codes)
    ? codes.map((code) => String(code ?? '').trim()).filter(Boolean)
    : [];
}

function agingBucket(dateValue?: Date) {
  const denialDate = dateValue instanceof Date ? dateValue : new Date();
  const ageDays = Math.max(0, Math.floor((Date.now() - denialDate.getTime()) / (24 * 60 * 60 * 1000)));

  if (ageDays <= 30) return '0-30';
  if (ageDays <= 60) return '31-60';
  if (ageDays <= 90) return '61-90';
  return '90+';
}

function priorityFor(category: DenialCategory, amount: number) {
  if (['TIMELY_FILING', 'AUTHORIZATION'].includes(category) || amount >= 1000) return 'high';
  if (amount >= 250 || category !== 'OTHER') return 'medium';
  return 'low';
}

export function classifyDenial(carcCodes: string[], rarcCodes: string[] = []) {
  const matchedCode = carcCodes.find((code) => CATEGORY_BY_CARC[code]);
  const category = matchedCode ? CATEGORY_BY_CARC[matchedCode] : 'OTHER';

  return {
    category,
    explanation: matchedCode
      ? `Classified from CARC ${matchedCode}.`
      : `No configured CARC/RARC classification matched. CARC: ${carcCodes.join(', ') || 'none'}; RARC: ${rarcCodes.join(', ') || 'none'}.`,
    recommendedAction: CATEGORY_ACTIONS[category],
    correctionEligible: CORRECTION_ELIGIBLE_CATEGORIES.has(category),
    appealEligible: !CORRECTION_ELIGIBLE_CATEGORIES.has(category) || ['AUTHORIZATION', 'MEDICAL_NECESSITY', 'TIMELY_FILING'].includes(category),
    priority: priorityFor(category, 0),
  };
}

export function recommendDenialDecision(options: {
  category?: string;
  carcCodes?: string[];
  rarcCodes?: string[];
  preventableFlag?: boolean;
}) {
  const category = String(options.category ?? 'OTHER').toUpperCase();
  const carcCodes = options.carcCodes ?? [];

  if (category === 'DUPLICATE' || carcCodes.includes('18')) {
    return {
      recommendation: 'WRITE_OFF' as const,
      reason: 'Duplicate denial is usually closed or written off after confirming no valid corrected rebill is available.',
    };
  }

  if (
    ['CODING', 'INFORMATION_MISSING', 'REFERRAL', 'ELIGIBILITY', 'COORDINATION_OF_BENEFITS'].includes(category)
    || options.preventableFlag === true
  ) {
    return {
      recommendation: 'CORRECTED_CLAIM' as const,
      reason: 'The denial appears correctable through claim data, coding, authorization/referral, COB, or missing information updates.',
    };
  }

  if (['MEDICAL_NECESSITY', 'AUTHORIZATION', 'TIMELY_FILING', 'COVERAGE'].includes(category)) {
    return {
      recommendation: 'APPEAL' as const,
      reason: 'The denial likely requires supporting documentation or payer reconsideration rather than a claim-data correction.',
    };
  }

  return {
    recommendation: 'WRITE_OFF' as const,
    reason: 'No confident correction or appeal path was detected. Manual override is still allowed.',
  };
}

async function ensureArWorkItem(denial: IDenial, claim: IClaim | null, createdBy?: string, session?: ClientSession) {
  if (!denial.claimId) return null;

  const existing = await ArWorkItem.findOne({
    isDeleted: false,
    denialId: denial._id,
  }).session(session ?? null);

  if (existing) return existing;

  const [item] = await ArWorkItem.create([{
    claimId: denial.claimId,
    denialId: denial._id,
    patientId: denial.patientId ?? claim?.patientId,
    payerId: denial.payerId ?? claim?.payerId,
    balanceAmount: denial.denialAmount,
    agingBucket: agingBucket(denial.denialDate),
    denialCode: denial.denialCode,
    denialCategory: denial.denialCategory,
    priority: denial.priority ?? 'medium',
    status: 'OPEN',
    assignedTo: denial.owner,
    sourceType: 'DENIAL',
    sourceId: denial._id,
    rootCauseAnalysis: denial.rootCause,
    suggestedFix: denial.recommendedAction,
    nextFollowUpDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    appealRequired: denial.denialStatus === 'APPEAL_READY',
    correctedClaimRequired: denial.denialStatus === 'CORRECTED_CLAIM_READY',
    escalationFlag: denial.priority === 'high',
    followUpHistory: [],
    active: true,
    created: new Date(),
    updated: new Date(),
    ...(createdBy ? { createdBy } : {}),
  }], { session });
  return item;
}

export const denialWorkflowService = {
  async createFromAdjustment(options: {
    adjustment: any;
    claim: IClaim;
    paymentPostingId?: unknown;
    eraEobProcessingId?: unknown;
    payerId?: string;
    cptCode?: string;
    deniedAmount?: number;
    carcCodes?: string[];
    lineBilledAmount?: number;
    linePaidAmount?: number;
    lineAllowedAmount?: number;
    createdBy?: string;
    session?: ClientSession;
  }) {
    const carcCodes = options.carcCodes?.length
      ? options.carcCodes
      : [options.adjustment.adjustmentReasonCode].filter((code): code is string => Boolean(code));
    const rarcCodes = normalizeCodes(options.adjustment.remarkCodes);
    const classification = classifyDenial(carcCodes, rarcCodes);
    const adjustmentAmount = Number(options.adjustment.adjustmentAmount ?? 0);
    const denialAmount = options.deniedAmount !== undefined
      ? options.deniedAmount
      : adjustmentAmount;
    const priority = priorityFor(classification.category, denialAmount);
    const appealDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const decision = recommendDenialDecision({
      category: classification.category,
      carcCodes,
      rarcCodes,
      preventableFlag: ['AUTHORIZATION', 'REFERRAL', 'CODING', 'INFORMATION_MISSING'].includes(classification.category),
    });

    const existing = await Denial.findOne({
      isDeleted: false,
      adjustmentId: options.adjustment._id,
    }).session(options.session ?? null);

    if (existing) return existing;

    const [denial] = await Denial.create([{
      claimId: options.claim._id,
      claimLineId: options.adjustment.claimLineId,
      paymentPostingId: options.paymentPostingId,
      eraEobProcessingId: options.eraEobProcessingId,
      adjustmentId: options.adjustment._id,
      patientId: options.claim.patientId,
      payerId: options.payerId ?? options.claim.payerId,
      cptCode: options.cptCode,
      denialCode: carcCodes[0],
      carcCodes,
      rarcCodes,
      denialReason: `ERA CAS ${options.adjustment.adjustmentGroupCode ?? ''}-${options.adjustment.adjustmentReasonCode ?? ''}`.trim(),
      payerDenialReason: `CARC ${carcCodes.join(', ') || 'unknown'}${rarcCodes.length ? ` / RARC ${rarcCodes.join(', ')}` : ''}`,
      denialCategory: classification.category,
      classificationExplanation: classification.explanation,
      denialSource: '835_ERA',
      denialDate: options.adjustment.adjustmentDate ?? new Date(),
      denialAmount,
      adjustmentAmount,
      denialBalance: denialAmount,
      lineBilledAmount: options.lineBilledAmount,
      linePaidAmount: options.linePaidAmount,
      lineAllowedAmount: options.lineAllowedAmount,
      resolvedAmount: 0,
      remainingDeniedBalance: denialAmount,
      appealDeadline,
      slaDueAt: appealDeadline,
      serviceLineDetails: {
        claimLineId: options.adjustment.claimLineId,
        cptCode: options.cptCode,
        adjustmentGroupCode: options.adjustment.adjustmentGroupCode,
        adjustmentReasonCode: options.adjustment.adjustmentReasonCode,
        remarkCodes: rarcCodes,
        lineBilledAmount: options.lineBilledAmount,
        linePaidAmount: options.linePaidAmount,
        lineAllowedAmount: options.lineAllowedAmount,
      },
      preventableFlag: ['AUTHORIZATION', 'REFERRAL', 'CODING', 'INFORMATION_MISSING'].includes(classification.category),
      rootCause: classification.category === 'OTHER' ? classification.explanation : classification.category,
      owner: undefined,
      priority,
      denialStatus: 'OPEN',
      reworkType: classification.correctionEligible ? 'CORRECTION_REVIEW' : 'PAYER_FOLLOW_UP',
      recommendedAction: classification.recommendedAction,
      correctionEligible: classification.correctionEligible,
      appealEligible: classification.appealEligible,
      recoveryRecommendation: decision.recommendation,
      recommendationReason: decision.reason,
      aiConfidenceScore: classification.category === 'OTHER' ? 0.45 : 0.78,
      aiRecommendationSource: 'workflow_rules',
      aiRecommendationHistory: [{
        recommendation: decision.recommendation,
        reason: decision.reason,
        confidenceScore: classification.category === 'OTHER' ? 0.45 : 0.78,
        source: 'workflow_rules',
        generatedAt: new Date(),
        safeAutomation: 'ADVISORY_ONLY',
        suggestedNextAction: classification.recommendedAction,
      }],
      statusHistory: [{
        previousStatus: undefined,
        newStatus: 'OPEN',
        reason: 'Denial detected from 835 ERA adjustment.',
        timestamp: new Date(),
        source: '835_ERA',
        paymentPostingId: options.paymentPostingId,
        eraEobProcessingId: options.eraEobProcessingId,
      }],
      active: true,
      created: new Date(),
      updated: new Date(),
      ...(options.createdBy ? { createdBy: options.createdBy } : {}),
    }], { session: options.session });

    const arWorkItem = await ensureArWorkItem(denial, options.claim, options.createdBy, options.session);
    if (arWorkItem) {
      denial.arWorkItemId = arWorkItem._id;
      await denial.save({ session: options.session });
      publishRcmRealtimeEvent({
        eventType: 'AR_WORK_ITEM_CREATED',
        title: 'AR work item created',
        claimId: String(options.claim._id),
        entityType: 'arWorkItem',
        entityId: String(arWorkItem._id),
        status: arWorkItem.status,
      });
    }

    await auditLogService.record({
      entityType: 'denial',
      entityId: denial._id,
      action: 'DENIAL_CREATED_FROM_ERA',
      userId: options.createdBy,
      changedBy: options.createdBy,
      source: 'era835',
      claimId: options.claim._id,
      patientId: options.claim.patientId,
      payerId: options.payerId ?? options.claim.payerId,
      reason: 'Denial detected from 835 ERA adjustment.',
      newState: {
        denialStatus: denial.denialStatus,
        denialAmount: denial.denialAmount,
        cptCode: denial.cptCode,
        carcCodes: denial.carcCodes,
        arWorkItemId: denial.arWorkItemId,
        paymentPostingId: options.paymentPostingId,
        eraEobProcessingId: options.eraEobProcessingId,
      },
      session: options.session,
    });

    if (arWorkItem) {
      await auditLogService.record({
        entityType: 'arWorkItem',
        entityId: arWorkItem._id,
        action: 'DENIAL_AR_CREATED',
        userId: options.createdBy,
        changedBy: options.createdBy,
        source: 'denialWorkflow',
        claimId: options.claim._id,
        patientId: options.claim.patientId,
        payerId: options.payerId ?? options.claim.payerId,
        reason: 'AR work item created for ERA denial.',
        newState: {
          status: arWorkItem.status,
          balanceAmount: arWorkItem.balanceAmount,
          denialId: denial._id,
        },
        session: options.session,
      });
    }

    publishRcmRealtimeEvent({
      eventType: 'DENIAL_CREATED',
      title: 'Denial created from ERA',
      claimId: String(options.claim._id),
      entityType: 'denial',
      entityId: String(denial._id),
      status: denial.denialStatus,
    });

    return denial;
  },

  async ensureArWorkItemForUnderpaidClaim(options: {
    claim: IClaim;
    paymentPostingId?: unknown;
    balanceAmount: number;
    createdBy?: string;
    session?: ClientSession;
  }) {
    const existing = await ArWorkItem.findOne({
      isDeleted: false,
      claimId: options.claim._id,
      sourceType: 'UNDERPAYMENT',
      sourceId: options.paymentPostingId,
    }).session(options.session ?? null);

    if (existing) return existing;

    const [item] = await ArWorkItem.create([{
      claimId: options.claim._id,
      patientId: options.claim.patientId,
      payerId: options.claim.payerId,
      balanceAmount: options.balanceAmount,
      agingBucket: '0-30',
      priority: options.balanceAmount >= 1000 ? 'high' : 'medium',
      status: 'OPEN',
      sourceType: 'UNDERPAYMENT',
      sourceId: options.paymentPostingId,
      rootCauseAnalysis: 'UNDERPAID',
      suggestedFix: 'Review ERA allowed/paid amounts against expected reimbursement and determine payer follow-up.',
      nextFollowUpDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      escalationFlag: options.balanceAmount >= 1000,
      followUpHistory: [],
      active: true,
      created: new Date(),
      updated: new Date(),
      ...(options.createdBy ? { createdBy: options.createdBy } : {}),
    }], { session: options.session });
    return item;
  },

  async ensureArWorkItemForRejectedClaim(options: {
    claimId: unknown;
    payerId?: string;
    reason?: string;
    sourceId?: unknown;
    createdBy?: string;
    session?: ClientSession;
  }) {
    const claim = await Claim.findOne({ _id: options.claimId, isDeleted: false }).session(options.session ?? null);
    if (!claim) return null;

    const existing = await ArWorkItem.findOne({
      isDeleted: false,
      claimId: claim._id,
      sourceType: 'CLAIM_REJECTION',
      sourceId: options.sourceId,
    }).session(options.session ?? null);

    if (existing) return existing;

    const [item] = await ArWorkItem.create([{
      claimId: claim._id,
      patientId: claim.patientId,
      payerId: options.payerId ?? claim.payerId,
      balanceAmount: claim.totalChargeAmount,
      agingBucket: '0-30',
      denialCategory: 'CLAIM_REJECTION',
      priority: 'high',
      status: 'OPEN',
      sourceType: 'CLAIM_REJECTION',
      sourceId: options.sourceId,
      rootCauseAnalysis: options.reason,
      suggestedFix: 'Review claim tracking rejection and correct the claim before resubmission.',
      nextFollowUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      correctedClaimRequired: true,
      escalationFlag: true,
      followUpHistory: [],
      active: true,
      created: new Date(),
      updated: new Date(),
      ...(options.createdBy ? { createdBy: options.createdBy } : {}),
    }], { session: options.session });
    return item;
  },

  async createOrLinkCorrectedClaim(denial: IDenial, updatedBy: string, options: { session?: ClientSession } = {}) {
    if (!denial.claimId) return null;

    let correctedClaim = denial.correctedClaimId
      ? await CorrectedClaim.findOne({ _id: denial.correctedClaimId, isDeleted: false }).session(options.session ?? null)
      : null;

    if (!correctedClaim) {
      correctedClaim = await CorrectedClaim.findOne({
        isDeleted: false,
        originalClaimId: denial.claimId,
        denialId: denial._id,
      }).session(options.session ?? null);
    }

    if (!correctedClaim) {
      const [createdCorrectedClaim] = await CorrectedClaim.create([{
        originalClaimId: denial.claimId,
        denialId: denial._id,
        resubmissionReason: denial.denialReason,
        correctedFrequencyCode: '7',
        correctedClaimStatus: 'READY_FOR_REWORK',
        correctedFieldsChanged: [],
        notes: `Corrected claim shell created from denial ${denial.denialCode ?? denial._id}. Do not submit automatically.`,
        active: true,
        created: new Date(),
        updated: new Date(),
        createdBy: updatedBy,
      }], { session: options.session });
      correctedClaim = createdCorrectedClaim;
    }

    denial.correctedClaimId = correctedClaim._id;
    denial.statusHistory = [
      ...(denial.statusHistory ?? []),
      {
        previousStatus: denial.denialStatus ?? 'OPEN',
        newStatus: 'CORRECTED_CLAIM_PENDING',
        reason: 'Corrected claim draft linked to denial.',
        userId: updatedBy,
        timestamp: new Date(),
        source: 'CORRECTED_CLAIM_CREATED',
        correctedClaimId: correctedClaim._id,
      },
    ];
    denial.denialStatus = 'CORRECTED_CLAIM_PENDING';
    denial.correctionEligible = true;
    denial.reworkType = 'CORRECTED_CLAIM';
    denial.updated = new Date();
    denial.updatedBy = updatedBy as any;
    await denial.save({ session: options.session });

    publishRcmRealtimeEvent({
      eventType: 'DENIAL_STATUS_CHANGED',
      title: 'Denial moved to corrected claim workflow',
      claimId: denial.claimId ? String(denial.claimId) : undefined,
      entityType: 'denial',
      entityId: String(denial._id),
      status: denial.denialStatus,
    });

    return correctedClaim;
  },

  async syncArWorkItemForDenial(denial: IDenial, updatedBy: string, options: { session?: ClientSession } = {}) {
    const claim = denial.claimId ? await Claim.findOne({ _id: denial.claimId, isDeleted: false }).session(options.session ?? null) : null;
    const arWorkItem = await ensureArWorkItem(denial, claim, updatedBy, options.session);

    if (arWorkItem) {
      let changed = false;

      if (String(denial.arWorkItemId ?? '') !== String(arWorkItem._id)) {
        denial.arWorkItemId = arWorkItem._id;
        changed = true;
      }

      if (denial.denialStatus && ['RESOLVED', 'WRITTEN_OFF'].includes(denial.denialStatus)) {
        if (arWorkItem.status !== 'RESOLVED') {
          arWorkItem.status = 'RESOLVED';
          changed = true;
        }
      } else if (normalizeDenialStatus(denial.denialStatus) === 'CORRECTED_CLAIM_PENDING') {
        if (arWorkItem.status !== 'WAITING_ON_INTERNAL' || !arWorkItem.correctedClaimRequired) {
          arWorkItem.status = 'WAITING_ON_INTERNAL';
          arWorkItem.correctedClaimRequired = true;
          changed = true;
        }
      } else if (normalizeDenialStatus(denial.denialStatus) === 'APPEAL_READY') {
        if (arWorkItem.status !== 'WAITING_ON_INTERNAL' || !arWorkItem.appealRequired) {
          arWorkItem.status = 'WAITING_ON_INTERNAL';
          arWorkItem.appealRequired = true;
          changed = true;
        }
      }

      if (denial.correctedClaimId && String(arWorkItem.correctedClaimId ?? '') !== String(denial.correctedClaimId)) {
        arWorkItem.correctedClaimId = denial.correctedClaimId;
        changed = true;
      }

      const relatedAppeal = await Appeal.findOne({ denialId: denial._id, isDeleted: false }).session(options.session ?? null);
      if (relatedAppeal && String(arWorkItem.appealId ?? '') !== String(relatedAppeal._id)) {
        arWorkItem.appealId = relatedAppeal._id;
        changed = true;
      }

      if (denial.owner && arWorkItem.assignedTo !== denial.owner) {
        arWorkItem.assignedTo = denial.owner;
        arWorkItem.owner = denial.owner;
        changed = true;
      }

      if (changed) {
        arWorkItem.updated = new Date();
        arWorkItem.updatedBy = updatedBy as any;
        await arWorkItem.save({ session: options.session });
        await denial.save({ session: options.session });
      }
    }

    return arWorkItem;
  },

  async isDenialRelatedAdjustment(adjustment: IAdjustment) {
    return adjustment.adjustmentType === 'denial-related adjustment';
  },

  async getAdjustmentById(id: unknown) {
    return Adjustment.findOne({ _id: id, isDeleted: false });
  },
};

export async function runDenialSlaAgingCheck(updatedBy = 'rcm-denial-aging') {
  const now = new Date();
  const denials = await Denial.find({
    isDeleted: false,
    active: true,
    denialStatus: { $in: ['OPEN', 'APPEAL_READY', 'APPEALED', 'PAYER_REVIEW', 'AWAITING_PAYER_RESPONSE', 'CORRECTED_CLAIM_PENDING'] },
    $or: [
      { slaDueAt: { $lte: now } },
      { appealDeadline: { $lte: now } },
    ],
  }).limit(100);

  for (const denial of denials) {
    denial.escalatedAt = denial.escalatedAt ?? now;
    denial.escalationCount = (denial.escalationCount ?? 0) + 1;
    denial.escalationReason = 'Denial exceeded SLA or appeal deadline.';
    denial.priority = 'high';
    denial.transitionAudit = [
      ...(denial.transitionAudit ?? []),
      {
        previousStatus: normalizeDenialStatus(denial.denialStatus),
        newStatus: normalizeDenialStatus(denial.denialStatus),
        reason: denial.escalationReason,
        userId: updatedBy,
        timestamp: now,
        source: 'DENIAL_SLA_AGING',
      },
    ];
    denial.updated = now;
    assignAuditActor(denial, 'updatedBy', updatedBy);
    await denial.save();

    if (denial.arWorkItemId) {
      await ArWorkItem.updateOne(
        { _id: denial.arWorkItemId, isDeleted: false },
        {
          status: 'ESCALATED',
          priority: 'high',
          escalationFlag: true,
          nextAction: 'Denial SLA breached. Escalate payer follow-up or supervisor review.',
          updated: now,
          ...auditActorPatch('updatedBy', updatedBy),
        },
      );
    }

    publishRcmRealtimeEvent({
      eventType: 'DENIAL_SLA_BREACHED',
      title: 'Denial SLA breached',
      claimId: denial.claimId ? String(denial.claimId) : undefined,
      entityType: 'denial',
      entityId: String(denial._id),
      status: denial.denialStatus,
    });
  }

  return { overdueDenials: denials.length };
}

registerRcmJobHandler('CHECK_DENIAL_SLA_AGING', async (job) => {
  await runDenialSlaAgingCheck(String(job.updatedBy ?? 'rcm-denial-aging'));
});
