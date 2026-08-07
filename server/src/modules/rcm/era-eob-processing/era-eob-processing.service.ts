import mongoose from 'mongoose';
import type { ClientSession } from 'mongoose';
import { createHash } from 'crypto';
import { EraEobProcessing } from './era-eob-processing.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { envConfig } from '../../../config/env.config';
import { Adjustment } from '../adjustment/adjustment.model';
import { Claim, IClaim, IClaimClaimLine } from '../claim/claim.model';
import { ClaimSubmission } from '../claim-submission/claim-submission.model';
import { PaymentPosting } from '../payment-posting/payment-posting.model';
import { Denial } from '../denial/denial.model';
import { PatientBilling } from '../patient-billing/patient-billing.model';
import { FinancialEvent } from '../financial-event/financial-event.model';
import { denialWorkflowService } from '../denial/denial-workflow.service';
import { arWorkItemService } from '../ar-work-item/ar-work-item.service';
import { patientBillingService } from '../patient-billing/patient-billing.service';
import { createRcmLogTimer, logRcmEvent } from '../../../utils/hipaa-logger.util';
import { withMongoTransaction } from '../../../utils/mongoose-transaction.util';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { appealResolutionService } from '../appeal/appeal-resolution.service';
import { financialEventService } from '../financial-event/financial-event.service';
import { claimClosureService } from '../claim/claim-closure.service';
import { eraExceptionService } from '../era-exception/era-exception.service';
import { auditLogService } from '../audit-log/audit-log.service';
import {
  Parsed835Adjustment,
  Parsed835Claim,
  Parsed835ServiceLine,
  parse835,
  redact835Payload,
} from './era-835-parser.service';

const DENIAL_REASON_CODES = new Set(['16', '18', '22', '26', '27', '29', '31', '50', '96', '109', '119', '151', '197', '198', '234']);
const CONTRACTUAL_GROUP_CODES = new Set(['CO']);
const PATIENT_RESPONSIBILITY_GROUP_CODES = new Set(['PR']);
const PAYER_ADJUSTMENT_GROUP_CODES = new Set(['OA', 'PI']);

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function currencyEquals(left: number, right: number, tolerance = 0.01) {
  return Math.abs(roundCurrency(left) - roundCurrency(right)) <= tolerance;
}

function isValidObjectId(value: unknown) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function hashPayload(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function toDateOnly(value: unknown) {
  if (!value) {
    return '';
  }

  const dateValue = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(dateValue.getTime()) ? '' : dateValue.toISOString().slice(0, 10);
}

function sumAdjustments(adjustments: Parsed835Adjustment[], predicate?: (adjustment: Parsed835Adjustment) => boolean) {
  return roundCurrency(
    adjustments
      .filter((adjustment) => !predicate || predicate(adjustment))
      .reduce((total, adjustment) => total + adjustment.amount, 0),
  );
}

function adjustmentType(adjustment: Parsed835Adjustment) {
  if (PATIENT_RESPONSIBILITY_GROUP_CODES.has(adjustment.groupCode)) {
    return 'patient responsibility';
  }

  if (CONTRACTUAL_GROUP_CODES.has(adjustment.groupCode)) {
    return DENIAL_REASON_CODES.has(adjustment.reasonCode)
      ? 'denial-related adjustment'
      : 'contractual adjustment';
  }

  if (PAYER_ADJUSTMENT_GROUP_CODES.has(adjustment.groupCode)) {
    return 'payer adjustment';
  }

  if (DENIAL_REASON_CODES.has(adjustment.reasonCode)) {
    return 'denial-related adjustment';
  }

  return 'payer adjustment';
}

function isDeniedLine(line: Parsed835ServiceLine, claim: Parsed835Claim) {
  if (claim.claimStatusCode === '4') {
    return true;
  }

  return line.paidAmount <= 0 && line.adjustments.some((adjustment) => DENIAL_REASON_CODES.has(adjustment.reasonCode));
}

function postingLineHasDenialDecision(line: Record<string, unknown>) {
  if (Number(line.deniedAmount ?? 0) > 0) {
    return true;
  }

  return Array.isArray(line.adjustmentCodes)
    && line.adjustmentCodes.some((code) => {
      const [, reasonCode] = String(code).split('-');
      return DENIAL_REASON_CODES.has(reasonCode);
    });
}

function getLineAllowedAmount(line: Parsed835ServiceLine) {
  if (typeof line.allowedAmount === 'number') {
    return roundCurrency(line.allowedAmount);
  }

  const contractualAmount = sumAdjustments(line.adjustments, (adjustment) =>
    CONTRACTUAL_GROUP_CODES.has(adjustment.groupCode),
  );
  return roundCurrency(Math.max(0, line.billedAmount - contractualAmount));
}

async function matchInternalClaim(eraClaim: Parsed835Claim, session?: ClientSession) {
  const identifiers = [
    eraClaim.patientControlNumber,
    eraClaim.payerClaimNumber,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  if (!identifiers.length) {
    return { claim: null, claimSubmission: null };
  }

  const submission = await ClaimSubmission.findOne({
    isDeleted: false,
    $or: [
      { controlNumber: { $in: identifiers } },
      { claimControlNumber: { $in: identifiers } },
      { payerClaimNumber: { $in: identifiers } },
      { externalSubmissionId: { $in: identifiers } },
      { clearinghouseTraceNumber: { $in: identifiers } },
    ],
  }).sort({ submissionDateTime: -1, updated: -1 }).session(session ?? null);

  if (submission?.claimId) {
    const claim = await Claim.findOne({ _id: submission.claimId, isDeleted: false }).session(session ?? null);
    if (claim) {
      return { claim, claimSubmission: submission };
    }
  }

  const claimOr: any[] = [
    { batchId: { $in: identifiers } },
  ];

  identifiers.forEach((identifier) => {
    if (isValidObjectId(identifier)) {
      claimOr.push({ _id: identifier }, { claimId: identifier });
    }
  });

  const claim = await Claim.findOne({
    isDeleted: false,
    $or: claimOr,
  }).sort({ claimDate: -1, updated: -1 }).session(session ?? null);

  return { claim, claimSubmission: submission };
}

function scoreClaimLine(candidate: IClaimClaimLine, serviceLine: Parsed835ServiceLine) {
  let score = 0;

  if (serviceLine.serviceLineControlNumber && String(candidate._id ?? '') === serviceLine.serviceLineControlNumber) {
    score += 100;
  }

  if (candidate.cptCode && serviceLine.procedureCode && candidate.cptCode === serviceLine.procedureCode) {
    score += 40;
  }

  if (currencyEquals(candidate.chargeAmount ?? 0, serviceLine.billedAmount)) {
    score += 25;
  }

  const claimLineDate = toDateOnly(candidate.serviceDateFrom ?? candidate.serviceDateTo);
  const serviceDate = toDateOnly(serviceLine.serviceDate);
  if (claimLineDate && serviceDate && claimLineDate === serviceDate) {
    score += 20;
  }

  return score;
}

function matchClaimLine(claim: IClaim, serviceLine: Parsed835ServiceLine, usedClaimLineIds: Set<string>) {
  const rankedLines = (claim.claimLines ?? [])
    .map((claimLine) => ({
      claimLine,
      score: scoreClaimLine(claimLine, serviceLine),
      id: String(claimLine._id ?? ''),
    }))
    .filter((item) => item.id && !usedClaimLineIds.has(item.id) && item.score > 0)
    .sort((left, right) => right.score - left.score);

  const bestMatch = rankedLines[0];
  if (!bestMatch || bestMatch.score < 40) {
    return null;
  }

  usedClaimLineIds.add(bestMatch.id);
  return bestMatch.claimLine;
}

function buildClaimPaymentStatus(options: {
  claim: IClaim;
  matchedLineCount: number;
  paidAmount: number;
  billedAmount: number;
  adjustmentAmount: number;
  patientRespAmount: number;
  deniedAmount: number;
}) {
  const expectedInsurance = roundCurrency(
    (options.claim.claimLines ?? []).reduce((total, line) => total + (line.expectedInsurancePayment ?? 0), 0),
  );
  const allClaimLinesMatched = options.matchedLineCount > 0 && options.matchedLineCount >= (options.claim.claimLines ?? []).length;
  const balances = currencyEquals(
    options.billedAmount,
    options.paidAmount + options.adjustmentAmount + options.patientRespAmount,
    0.05,
  );

  if (!options.matchedLineCount) {
    return 'PAYMENT_POSTING_FAILED';
  }

  if (options.deniedAmount > 0 && options.paidAmount <= 0) {
    return 'DENIED';
  }

  if (expectedInsurance > 0 && options.paidAmount > 0 && options.paidAmount < expectedInsurance && balances) {
    return 'UNDERPAID';
  }

  if (allClaimLinesMatched && balances) {
    if (options.paidAmount > 0) {
      return 'PAID';
    }
    if (options.patientRespAmount > 0 && options.deniedAmount <= 0) {
      return 'PATIENT_RESPONSIBILITY';
    }
  }

  if (options.paidAmount > 0) {
    return allClaimLinesMatched ? 'PAYMENT_RECEIVED' : 'PARTIALLY_PAID';
  }

  return 'PAYMENT_POSTING_FAILED';
}

async function assertEraReplayHasNoFinancialSideEffects(eraId: unknown) {
  const paymentPostings = await PaymentPosting.find({
    eraEobProcessingId: eraId,
    isDeleted: false,
  }).select('_id').lean();
  const paymentPostingIds = paymentPostings.map((posting) => posting._id);
  const [adjustmentCount, denialCount, financialEventCount, patientBillingCount] = await Promise.all([
    Adjustment.countDocuments({ eraEobProcessingId: eraId, isDeleted: false }),
    Denial.countDocuments({ eraEobProcessingId: eraId, isDeleted: false }),
    FinancialEvent.countDocuments({ eraEobProcessingId: eraId, isDeleted: false }),
    paymentPostingIds.length
      ? PatientBilling.countDocuments({ paymentPostingId: { $in: paymentPostingIds }, isDeleted: false })
      : Promise.resolve(0),
  ]);
  const sideEffectCount = paymentPostings.length + adjustmentCount + denialCount + financialEventCount + patientBillingCount;

  if (sideEffectCount > 0) {
    throw new AppError(
      [
        'ERA replay is blocked because this ERA already created financial side effects.',
        'Reverse or void the prior postings through controlled financial workflows before replaying the 835.',
        `Detected ${paymentPostings.length} payment posting(s), ${adjustmentCount} adjustment(s), ${denialCount} denial(s), ${financialEventCount} financial event(s), and ${patientBillingCount} patient billing record(s).`,
      ].join(' '),
      HTTP_STATUS.BAD_REQUEST,
    );
  }
}

export const eraEobProcessingService = {
  async create(data: any, locale: string, createdBy: string): Promise<any> {
    throw new AppError('ERA records are generated only through controlled 835 import or replay.', HTTP_STATUS.BAD_REQUEST);
  },

  async getById(id: string, locale: string) {
    const item = await EraEobProcessing.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('eraEobProcessing.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    throw new AppError('ERA records are append-only. Use lock, unlock with reason, replay, or exception resolution.', HTTP_STATUS.BAD_REQUEST);
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    throw new AppError('ERA records are append-only and cannot be deleted. Resolve or replay with a reason.', HTTP_STATUS.BAD_REQUEST);
  },

  async lockAccounting(id: string, reason: string | undefined, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);

    if (item.reconciliationStatus !== 'RECONCILED') {
      throw new AppError('Only reconciled ERA batches can be accounting locked.', HTTP_STATUS.BAD_REQUEST);
    }

    item.accountingLocked = true;
    item.accountingLockedAt = new Date();
    item.accountingLockedBy = updatedBy as any;
    item.accountingLockReason = reason || 'ERA reconciled and locked for accounting close.';
    item.updated = new Date();
    item.updatedBy = updatedBy as any;
    await item.save();

    logRcmEvent({
      module: 'rcm.era835',
      eventType: 'ACCOUNTING_LOCK',
      status: 'SUCCEEDED',
      userId: updatedBy,
      correlationId: String(item._id),
      metadata: {
        eraEobProcessingId: String(item._id),
        reconciliationStatus: item.reconciliationStatus,
        reason: item.accountingLockReason,
      },
    });

    await auditLogService.record({
      entityType: 'eraEobProcessing',
      entityId: item._id,
      action: 'ERA_LOCKED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'era835',
      reason: item.accountingLockReason,
      previousState: { accountingLocked: false },
      newState: { accountingLocked: item.accountingLocked, accountingLockedAt: item.accountingLockedAt },
    });

    return item;
  },

  async unlockAccounting(id: string, reason: string, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);

    if (!item.accountingLocked) {
      return item;
    }

    item.accountingLocked = false;
    item.accountingUnlockedAt = new Date();
    item.accountingUnlockedBy = updatedBy as any;
    item.accountingUnlockReason = reason;
    item.updated = new Date();
    item.updatedBy = updatedBy as any;
    await item.save();

    logRcmEvent({
      module: 'rcm.era835',
      eventType: 'ACCOUNTING_UNLOCK',
      status: 'SUCCEEDED',
      userId: updatedBy,
      correlationId: String(item._id),
      metadata: {
        eraEobProcessingId: String(item._id),
        reason,
      },
    });

    await auditLogService.record({
      entityType: 'eraEobProcessing',
      entityId: item._id,
      action: 'ERA_UNLOCKED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'era835',
      reason,
      previousState: { accountingLocked: true },
      newState: { accountingLocked: item.accountingLocked, accountingUnlockedAt: item.accountingUnlockedAt },
    });

    return item;
  },

  async import835(data: any, locale: string, createdBy: string) {
    const duration = createRcmLogTimer();
    const raw835Text = String(data.raw835Text ?? '');
    const idempotencyKey = normalizeText(data.idempotencyKey) || `835:${hashPayload(raw835Text)}`;
    const result = await withMongoTransaction(async (session) => {
    const duplicateEraRecord = await EraEobProcessing.findOne({
      idempotencyKey,
      isDeleted: false,
      active: true,
    }).session(session);

    if (duplicateEraRecord) {
      return {
        eraEobProcessing: duplicateEraRecord,
        paymentPostings: await PaymentPosting.find({
          eraEobProcessingId: duplicateEraRecord._id,
          isDeleted: false,
        }).session(session),
        matchedClaims: duplicateEraRecord.matchedClaims ?? [],
        unmatchedClaims: duplicateEraRecord.unmatchedClaims ?? [],
        parseErrors: duplicateEraRecord.parseErrors ?? [],
        importErrors: ['Duplicate ERA ignored because the idempotency key was already processed.'],
        duplicate: true,
      };
    }

    const parsed835 = parse835(raw835Text);
    const duplicateTraceRecord = parsed835.traceNumber && !data.allowReplay
      ? await EraEobProcessing.findOne({
        isDeleted: false,
        active: true,
        $or: [
          { paymentTraceNumber: parsed835.traceNumber },
          { checkNumber: parsed835.traceNumber },
        ],
      }).session(session)
      : null;

    if (duplicateTraceRecord) {
      return {
        eraEobProcessing: duplicateTraceRecord,
        paymentPostings: await PaymentPosting.find({
          eraEobProcessingId: duplicateTraceRecord._id,
          isDeleted: false,
        }).session(session),
        matchedClaims: duplicateTraceRecord.matchedClaims ?? [],
        unmatchedClaims: duplicateTraceRecord.unmatchedClaims ?? [],
        parseErrors: duplicateTraceRecord.parseErrors ?? [],
        importErrors: [`Duplicate ERA ignored because payment trace/check number ${parsed835.traceNumber} was already processed.`],
        duplicate: true,
      };
    }

    const receivedDate = data.receivedDate ? new Date(data.receivedDate) : new Date();
    const importErrors: string[] = [];
    const matchedClaims: Array<Record<string, unknown>> = [];
    const unmatchedClaims: Array<Record<string, unknown>> = [];
    const createdPaymentPostings: any[] = [];

    const [eraRecord] = await EraEobProcessing.create([{
      payerId: normalizeText(data.payerId),
      payerName: normalizeText(data.payerName) || parsed835.payerName,
      eraReceived: true,
      eraFileReference: normalizeText(data.eraFileReference),
      eraBatchId: normalizeText(data.eraBatchId) || normalizeText(data.fileMetadata?.batchId) || idempotencyKey,
      depositId: normalizeText(data.depositId) || normalizeText(data.fileMetadata?.depositId) || parsed835.traceNumber,
      raw835FileReference: normalizeText(data.fileMetadata?.fileName) || normalizeText(data.eraFileReference),
      rawPayloadRedacted: redact835Payload(raw835Text),
      raw835Payload: envConfig.eraStoreRawPayloads ? raw835Text : undefined,
      rawPayloadStored: envConfig.eraStoreRawPayloads,
      idempotencyKey,
      sourceType: normalizeText(data.sourceType) || 'MANUAL_IMPORT',
      checkNumber: parsed835.traceNumber,
      paymentTraceNumber: parsed835.traceNumber,
      paymentMethod: parsed835.paymentMethod,
      paymentDate: parsed835.paymentDate ?? receivedDate,
      totalAmount: parsed835.totalPaymentAmount,
      totalPaymentAmount: parsed835.totalPaymentAmount,
      depositAmount: typeof data.depositAmount === 'number' ? data.depositAmount : parsed835.totalPaymentAmount,
      claimPaidAmount: roundCurrency(parsed835.claims.reduce((total, claim) => total + claim.paidAmount, 0)),
      serviceLinePaidAmount: roundCurrency(parsed835.claims.reduce((claimTotal, claim) =>
        claimTotal + claim.serviceLines.reduce((lineTotal, line) => lineTotal + line.paidAmount, 0), 0)),
      adjustmentTotal: roundCurrency(parsed835.claims.reduce((claimTotal, claim) =>
        claimTotal + claim.serviceLines.reduce((lineTotal, line) =>
          lineTotal + sumAdjustments(line.adjustments), 0), 0)),
      patientResponsibilityTotal: roundCurrency(parsed835.claims.reduce((claimTotal, claim) =>
        claimTotal + claim.serviceLines.reduce((lineTotal, line) =>
          lineTotal + sumAdjustments(line.adjustments, (adjustment) => PATIENT_RESPONSIBILITY_GROUP_CODES.has(adjustment.groupCode)), 0), 0)),
      reconciliationStatus: parsed835.parseErrors.length ? 'EXCEPTION' : 'PARSED',
      receivedDate,
      importStatus: 'RECEIVED',
      parsedStatus: parsed835.parseErrors.length ? 'PARSED_WITH_ERRORS' : 'PARSED',
      fileMetadata: data.fileMetadata,
      replayVersion: data.replayVersion,
      replayStatus: data.replayOfEraId ? 'REPLAYING' : undefined,
      replayHistory: data.replayOfEraId ? [{
        replayOfEraId: data.replayOfEraId,
        replayVersion: data.replayVersion,
        reason: data.replayReason,
        replayedAt: new Date(),
        replayedBy: createdBy,
      }] : [],
      parseErrors: parsed835.parseErrors,
      importErrors,
      active: true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    }], { session });

    for (const eraClaim of parsed835.claims) {
      const { claim, claimSubmission } = await matchInternalClaim(eraClaim, session);

      if (!claim) {
        unmatchedClaims.push({
          patientControlNumber: eraClaim.patientControlNumber,
          payerClaimNumber: eraClaim.payerClaimNumber,
          billedAmount: eraClaim.billedAmount,
          paidAmount: eraClaim.paidAmount,
          reason: 'No internal claim matched ERA claim identifiers.',
        });
        continue;
      }

      const usedClaimLineIds = new Set<string>();
      const postingLines: any[] = [];
      const adjustmentRows: any[] = [];
      const unmatchedServiceLines: Array<Record<string, unknown>> = [];

      eraClaim.serviceLines.forEach((serviceLine) => {
        const claimLine = matchClaimLine(claim, serviceLine, usedClaimLineIds);

        if (!claimLine?._id) {
          unmatchedServiceLines.push({
            procedureCode: serviceLine.procedureCode,
            serviceDate: serviceLine.serviceDate,
            billedAmount: serviceLine.billedAmount,
            paidAmount: serviceLine.paidAmount,
            reason: 'No claim line matched CPT, service date, charge amount, or line control number.',
          });
          return;
        }

        const patientRespAmount = sumAdjustments(serviceLine.adjustments, (adjustment) =>
          PATIENT_RESPONSIBILITY_GROUP_CODES.has(adjustment.groupCode),
        );
        const adjustmentAmount = sumAdjustments(serviceLine.adjustments, (adjustment) =>
          !PATIENT_RESPONSIBILITY_GROUP_CODES.has(adjustment.groupCode),
        );
        const deniedAmount = isDeniedLine(serviceLine, eraClaim)
          ? sumAdjustments(serviceLine.adjustments, (adjustment) => adjustmentType(adjustment) === 'denial-related adjustment')
          : 0;
        const reconciledLineAmount = roundCurrency(serviceLine.paidAmount + adjustmentAmount + patientRespAmount);
        if (!currencyEquals(serviceLine.billedAmount, reconciledLineAmount, 0.05)) {
          importErrors.push(
            `Service line ${serviceLine.procedureCode || String(claimLine._id)} does not reconcile: billed ${serviceLine.billedAmount}, paid/adjusted/responsibility ${reconciledLineAmount}.`
          );
        }

        postingLines.push({
          claimLineId: claimLine._id,
          serviceLineControlNumber: serviceLine.serviceLineControlNumber,
          procedureCode: serviceLine.procedureCode,
          serviceDate: serviceLine.serviceDate,
          billedAmount: serviceLine.billedAmount,
          expectedAllowedAmount: claimLine.expectedAllowedAmount,
          expectedInsurancePayment: claimLine.expectedInsurancePayment,
          allowedAmount: getLineAllowedAmount(serviceLine),
          paidAmount: serviceLine.paidAmount,
          adjustmentAmount,
          patientRespAmount,
          deniedAmount,
          adjustmentCodes: serviceLine.adjustments.map((adjustment) => `${adjustment.groupCode}-${adjustment.reasonCode}`),
          remarkCodes: serviceLine.remarkCodes,
        });

        serviceLine.adjustments.forEach((adjustment) => {
          adjustmentRows.push({
            eraEobProcessingId: eraRecord._id,
            claimId: claim._id,
            claimLineId: claimLine._id,
            adjustmentType: adjustmentType(adjustment),
            adjustmentGroupCode: adjustment.groupCode,
            adjustmentReasonCode: adjustment.reasonCode,
            adjustmentAmount: adjustment.amount,
            remarkCodes: serviceLine.remarkCodes,
            source: '835_ERA',
            writeOffFlag: CONTRACTUAL_GROUP_CODES.has(adjustment.groupCode),
            adjustmentDate: parsed835.paymentDate ?? receivedDate,
            active: true,
            created: new Date(),
            updated: new Date(),
            createdBy,
          });
        });
      });

      const paidAmount = roundCurrency(postingLines.reduce((total, line) => total + (line.paidAmount ?? 0), 0));
      const billedAmount = roundCurrency(postingLines.reduce((total, line) => total + (line.billedAmount ?? 0), 0));
      const adjustmentAmount = roundCurrency(postingLines.reduce((total, line) => total + (line.adjustmentAmount ?? 0), 0));
      const patientRespAmount = roundCurrency(postingLines.reduce((total, line) => total + (line.patientRespAmount ?? 0), 0));
      const deniedAmount = roundCurrency(postingLines.reduce((total, line) => total + (line.deniedAmount ?? 0), 0));
      const paymentStatus = buildClaimPaymentStatus({
        claim,
        matchedLineCount: postingLines.length,
        paidAmount,
        billedAmount,
        adjustmentAmount,
        patientRespAmount,
        deniedAmount,
      });
      const postingStatus = paymentStatus === 'PAYMENT_POSTING_FAILED'
        ? 'LINE_MATCH_FAILED'
        : paymentStatus === 'PARTIALLY_PAID'
          ? 'PARTIAL'
          : 'POSTED';

      const paymentPostingIdempotencyKey = `${idempotencyKey}:${String(claim._id)}:${eraClaim.patientControlNumber ?? eraClaim.payerClaimNumber ?? createdPaymentPostings.length}`;
      const duplicatePaymentPosting = await PaymentPosting.findOne({
        idempotencyKey: paymentPostingIdempotencyKey,
        isDeleted: false,
      }).session(session);

      if (duplicatePaymentPosting) {
        createdPaymentPostings.push(duplicatePaymentPosting);
        importErrors.push(`Duplicate payment posting ignored for claim ${String(claim._id)}.`);
        continue;
      }
      await claimClosureService.reopenForFinancialMutation(
        String(claim._id),
        `ERA adjudication imported from ${String(eraRecord._id)}.`,
        createdBy,
        session
      );

      const [paymentPosting] = await PaymentPosting.create([{
        eraEobProcessingId: eraRecord._id,
        claimId: claim._id,
        payerId: normalizeText(data.payerId) || claim.payerId,
        payerClaimNumber: eraClaim.payerClaimNumber,
        claimControlNumber: eraClaim.patientControlNumber ?? claimSubmission?.controlNumber ?? claimSubmission?.claimControlNumber,
        paymentDate: parsed835.paymentDate ?? receivedDate,
        checkNumber: parsed835.traceNumber,
        eftTraceNumber: parsed835.traceNumber,
        paymentMethod: parsed835.paymentMethod,
        idempotencyKey: paymentPostingIdempotencyKey,
        sourceType: '835_ERA',
        receivedAmount: eraClaim.paidAmount,
        postedAmount: paidAmount,
        patientResponsibilityAmount: patientRespAmount,
        remainingBalance: roundCurrency(Math.max(0, billedAmount - paidAmount - adjustmentAmount - patientRespAmount)),
        postingStatus,
        postedBy: String(createdBy),
        postedAt: new Date(),
        paymentLines: postingLines,
        active: true,
        created: new Date(),
        updated: new Date(),
        createdBy,
      }], { session });

      const financialEvent = await financialEventService.record({
        eventType: 'PAYMENT_POSTED',
        sourceModule: 'era835',
        amount: paidAmount,
        claimId: claim._id,
        paymentPostingId: paymentPosting._id,
        eraEobProcessingId: eraRecord._id,
        createdBy,
        session,
      });
      paymentPosting.financialEventId = financialEvent._id;
      paymentPosting.ledgerSequence = financialEvent.ledgerSequence;
      paymentPosting.financialBalanceSnapshot = financialEvent.financialBalanceSnapshot;
      await paymentPosting.save({ session });

      if (adjustmentRows.length) {
        const insertedAdjustments = await Adjustment.insertMany(
          adjustmentRows.map((row) => ({
            ...row,
            paymentPostingId: paymentPosting._id,
          })),
          { session },
        );

        const denialAdjustmentGroups = new Map<string, any[]>();
        for (const adjustment of insertedAdjustments) {
          if (adjustment.adjustmentType !== 'denial-related adjustment') continue;
          const key = String(adjustment.claimLineId ?? adjustment._id);
          denialAdjustmentGroups.set(key, [...(denialAdjustmentGroups.get(key) ?? []), adjustment]);
        }
        for (const lineAdjustments of denialAdjustmentGroups.values()) {
          const adjustment = lineAdjustments[0];
          const postingLine = postingLines.find((line) => String(line.claimLineId ?? '') === String(adjustment.claimLineId ?? ''));
          const denialAmountForLine = roundCurrency(
            lineAdjustments.reduce((total, row) => total + Number(row.adjustmentAmount ?? 0), 0)
          );
          await denialWorkflowService.createFromAdjustment({
            adjustment: {
              ...(typeof adjustment.toObject === 'function' ? adjustment.toObject() : adjustment),
              adjustmentAmount: denialAmountForLine,
              remarkCodes: Array.from(new Set(lineAdjustments.flatMap((row) => row.remarkCodes ?? []))),
            },
            claim,
            paymentPostingId: paymentPosting._id,
            eraEobProcessingId: eraRecord._id,
            payerId: normalizeText(data.payerId) || claim.payerId,
            cptCode: postingLine?.procedureCode,
            carcCodes: Array.from(new Set(lineAdjustments.map((row) => row.adjustmentReasonCode).filter(Boolean))),
            deniedAmount: denialAmountForLine,
            lineBilledAmount: postingLine?.billedAmount,
            linePaidAmount: postingLine?.paidAmount,
            lineAllowedAmount: postingLine?.allowedAmount,
            createdBy,
            session,
          });
        }
      }

      claim.paymentStatus = paymentStatus;
      claim.updated = new Date();
      claim.updatedBy = createdBy as any;
      await claim.save({ session });

      if (paymentStatus === 'UNDERPAID') {
        await denialWorkflowService.ensureArWorkItemForUnderpaidClaim({
          claim,
          paymentPostingId: paymentPosting._id,
          balanceAmount: Math.max(0, (claim.claimLines ?? []).reduce((total, line) => total + (line.expectedInsurancePayment ?? 0), 0) - paidAmount),
          createdBy,
          session,
        });
      }

      for (const postingLine of postingLines) {
        if (postingLineHasDenialDecision(postingLine)) {
          continue;
        }

        const expectedInsurancePayment = roundCurrency(Number(postingLine.expectedInsurancePayment ?? 0));
        const actualPaidAmount = roundCurrency(Number(postingLine.paidAmount ?? 0));
        if (expectedInsurancePayment > 0 && actualPaidAmount < expectedInsurancePayment) {
          await arWorkItemService.createUnderpaymentVarianceItem({
            claim,
            paymentPostingId: paymentPosting._id,
            claimLineId: postingLine.claimLineId,
            expectedAmount: expectedInsurancePayment,
            paidAmount: actualPaidAmount,
            balanceAmount: roundCurrency(expectedInsurancePayment - actualPaidAmount),
            reason: `Expected payer payment ${expectedInsurancePayment} exceeded actual paid ${actualPaidAmount}.`,
            createdBy,
            session,
          });
        }
      }

      const patientBilling = await patientBillingService.createFromPaymentPosting(String(paymentPosting._id), locale, createdBy, { session });
      await appealResolutionService.resolveFromPaymentPosting(paymentPosting, {
        claim,
        updatedBy: createdBy,
        session,
      });
      await claimClosureService.syncClaimClosureStatus(String(claim._id), createdBy, session);

      createdPaymentPostings.push(paymentPosting);
      matchedClaims.push({
        claimId: claim._id,
        claimNumber: claim.claimId,
        claimSubmissionId: claimSubmission?._id,
        paymentPostingId: paymentPosting._id,
        payerClaimNumber: eraClaim.payerClaimNumber,
        patientControlNumber: eraClaim.patientControlNumber,
        matchedLineCount: postingLines.length,
        unmatchedLineCount: unmatchedServiceLines.length,
        paidAmount,
        billedAmount,
        adjustmentAmount,
        patientRespAmount,
        deniedAmount,
        paymentStatus,
        postingStatus,
        patientBillingId: patientBilling?._id,
        unmatchedServiceLines,
      });
    }

    if (parsed835.parseErrors.length) {
      importErrors.push(...parsed835.parseErrors);
    }
    if (parsed835.providerAdjustments.length) {
      importErrors.push(
        `Unsupported provider-level adjustment/PLB detected: ${parsed835.providerAdjustments
          .map((adjustment) => `${adjustment.reasonCode ?? 'PLB'} ${adjustment.amount}`)
          .join(', ')}. Manual deposit reconciliation is required.`
      );
    }

    eraRecord.paymentId = createdPaymentPostings[0]?._id;
    eraRecord.matchedClaims = matchedClaims;
    eraRecord.unmatchedClaims = unmatchedClaims;
    eraRecord.importErrors = importErrors;
    eraRecord.postedAmount = roundCurrency(createdPaymentPostings.reduce((total, posting) => total + Number(posting.postedAmount ?? 0), 0));
    eraRecord.unmatchedAmount = roundCurrency(Math.max(0, Number(eraRecord.totalPaymentAmount ?? 0) - Number(eraRecord.postedAmount ?? 0)));
    eraRecord.importStatus = unmatchedClaims.length && matchedClaims.length
      ? 'PARTIALLY_MATCHED'
      : unmatchedClaims.length
        ? 'UNMATCHED'
        : importErrors.length
          ? 'POSTED_WITH_WARNINGS'
          : 'POSTED';
    eraRecord.parsedStatus = importErrors.length ? 'PARSED_WITH_ERRORS' : 'PARSED';
    const balanced = currencyEquals(Number(eraRecord.totalPaymentAmount ?? 0), Number(eraRecord.postedAmount ?? 0));
    eraRecord.reconciliationStatus = unmatchedClaims.length || importErrors.length || !balanced
      ? (matchedClaims.length ? 'PARTIALLY_POSTED' : 'EXCEPTION')
      : 'RECONCILED';
    eraRecord.accountingLocked = false;
    eraRecord.accountingLockedAt = undefined;
    eraRecord.accountingLockedBy = undefined;
    eraRecord.accountingLockReason = eraRecord.reconciliationStatus === 'RECONCILED'
      ? 'ERA is reconciled and ready for explicit accounting lock.'
      : undefined;
    eraRecord.exceptionReason = eraRecord.reconciliationStatus === 'EXCEPTION' || eraRecord.reconciliationStatus === 'PARTIALLY_POSTED'
      ? [
        unmatchedClaims.length ? `${unmatchedClaims.length} unmatched ERA claim(s)` : '',
        importErrors.length ? `${importErrors.length} import/parse error(s)` : '',
        !balanced ? `Posted amount ${eraRecord.postedAmount ?? 0} does not equal ERA total ${eraRecord.totalPaymentAmount ?? 0}` : '',
      ].filter(Boolean).join('; ')
      : undefined;
    eraRecord.updated = new Date();
    await eraRecord.save({ session });

    for (const unmatchedClaim of unmatchedClaims) {
      await eraExceptionService.create({
        exceptionType: 'CLAIM_NOT_FOUND',
        severity: 'HIGH',
        status: 'OPEN',
        relatedERA: eraRecord._id,
        resolutionNotes: `ERA claim could not be matched: ${unmatchedClaim.patientControlNumber ?? unmatchedClaim.payerClaimNumber ?? 'unknown control number'}.`,
      }, String(createdBy));
    }

    for (const importError of importErrors) {
      await eraExceptionService.create({
        exceptionType: importError.toLowerCase().includes('duplicate')
          ? 'DUPLICATE_ERA'
          : importError.toLowerCase().includes('plb') || importError.toLowerCase().includes('provider-level')
            ? 'UNSUPPORTED_FINANCIAL_RECONCILIATION'
            : 'UNRESOLVED_ADJUSTMENT',
        severity: 'MEDIUM',
        status: 'OPEN',
        relatedERA: eraRecord._id,
        relatedClaim: importError.toLowerCase().includes('plb') || importError.toLowerCase().includes('provider-level')
          ? matchedClaims[0]?.claimId
          : undefined,
        resolutionNotes: importError,
      }, String(createdBy));
    }

    if (parsed835.providerAdjustments.length && matchedClaims.length > 1) {
      for (const matchedClaim of matchedClaims.slice(1)) {
        await eraExceptionService.create({
          exceptionType: 'UNSUPPORTED_FINANCIAL_RECONCILIATION',
          severity: 'MEDIUM',
          status: 'OPEN',
          relatedERA: eraRecord._id,
          relatedClaim: matchedClaim.claimId,
          resolutionNotes: 'Unsupported provider-level adjustment/PLB detected on ERA. Manual deposit reconciliation is required before claim closure.',
        }, String(createdBy));
      }
    }

    if (!balanced) {
      await eraExceptionService.create({
        exceptionType: 'POSTING_IMBALANCE',
        severity: 'HIGH',
        status: 'OPEN',
        relatedERA: eraRecord._id,
        resolutionNotes: `Posted amount ${eraRecord.postedAmount ?? 0} does not equal ERA total ${eraRecord.totalPaymentAmount ?? 0}.`,
      }, String(createdBy));
    }

    logRcmEvent({
      module: 'rcm.era835',
      eventType: 'IMPORT_835',
      status: importErrors.length ? 'FAILED' : 'SUCCEEDED',
      correlationId: idempotencyKey,
      userId: String(createdBy),
      durationMs: duration(),
      errorCode: importErrors.length ? 'ERA_IMPORT_WITH_EXCEPTIONS' : undefined,
      metadata: {
        eraEobProcessingId: String(eraRecord._id),
        matchedClaimCount: matchedClaims.length,
        unmatchedClaimCount: unmatchedClaims.length,
        reconciliationStatus: eraRecord.reconciliationStatus,
      },
    });

    return {
      eraEobProcessing: eraRecord,
      paymentPostings: createdPaymentPostings,
      matchedClaims,
      unmatchedClaims,
      parseErrors: parsed835.parseErrors,
      importErrors,
    };
    });

    publishRcmRealtimeEvent({
      eventType: 'ERA_RECEIVED',
      title: '835 ERA imported',
      message: `ERA ${result.eraEobProcessing.reconciliationStatus ?? 'received'} with ${result.matchedClaims.length} matched claim(s).`,
      entityType: 'eraEobProcessing',
      entityId: String(result.eraEobProcessing._id),
      status: result.eraEobProcessing.reconciliationStatus,
    });

    await auditLogService.record({
      entityType: 'eraEobProcessing',
      entityId: result.eraEobProcessing._id,
      action: 'ERA_IMPORTED',
      userId: createdBy,
      changedBy: String(createdBy),
      source: 'era835',
      reason: result.importErrors.length ? 'ERA imported with exceptions' : 'ERA imported',
      correlationId: result.eraEobProcessing.idempotencyKey,
      newState: {
        reconciliationStatus: result.eraEobProcessing.reconciliationStatus,
        matchedClaimCount: result.matchedClaims.length,
        unmatchedClaimCount: result.unmatchedClaims.length,
        paymentPostingCount: result.paymentPostings.length,
      },
    });

    if (result.paymentPostings.length) {
      publishRcmRealtimeEvent({
        eventType: 'PAYMENT_POSTED',
        title: 'Payment posted',
        message: `${result.paymentPostings.length} payment posting record(s) created or linked from ERA.`,
        entityType: 'paymentPosting',
        entityId: String(result.paymentPostings[0]._id),
        status: result.paymentPostings[0].postingStatus,
      });
    }

    return result;
  },

  async replay(id: string, reason: string, locale: string, updatedBy: string) {
    if (!reason?.trim()) {
      throw new AppError('ERA replay reason is required.', HTTP_STATUS.BAD_REQUEST);
    }
    const original = await this.getById(id, locale);
    if (!original.raw835Payload) {
      throw new AppError('ERA replay requires stored raw 835 payload. Enable ERA raw payload storage or re-import the source file.', HTTP_STATUS.BAD_REQUEST);
    }
    if (original.accountingLocked) {
      throw new AppError('Accounting-locked ERA batches cannot be replayed without unlocking first.', HTTP_STATUS.BAD_REQUEST);
    }
    await assertEraReplayHasNoFinancialSideEffects(original._id);

    const replayVersion = Number(original.replayVersion ?? 0) + 1;
    original.replayVersion = replayVersion;
    original.replayStatus = 'REPLAYING';
    original.replayHistory = [
      ...(original.replayHistory ?? []),
      {
        action: 'ERA_REPLAY_STARTED',
        reason: reason.trim(),
        replayVersion,
        replayedBy: updatedBy,
        replayedAt: new Date(),
      },
    ];
    original.updated = new Date();
    original.updatedBy = updatedBy as any;
    await original.save();

    publishRcmRealtimeEvent({
      eventType: 'ERA_REPLAY_STARTED',
      title: 'ERA replay started',
      entityType: 'eraEobProcessing',
      entityId: String(original._id),
      status: original.replayStatus,
    });

    await auditLogService.record({
      entityType: 'eraEobProcessing',
      entityId: original._id,
      action: 'ERA_REPLAY_STARTED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'era835',
      reason: reason.trim(),
      correlationId: String(original._id),
      newState: { replayStatus: original.replayStatus, replayVersion },
    });

    const result = await this.import835({
      raw835Text: original.raw835Payload,
      payerId: original.payerId,
      payerName: original.payerName,
      eraFileReference: original.eraFileReference,
      eraBatchId: `${original.eraBatchId ?? String(original._id)}-REPLAY-${replayVersion}`,
      depositId: original.depositId,
      depositAmount: original.depositAmount,
      sourceType: 'ERA_REPLAY',
      fileMetadata: {
        ...(original.fileMetadata ?? {}),
        replayOfEraId: String(original._id),
        replayVersion,
      },
      idempotencyKey: `${original.idempotencyKey ?? String(original._id)}:replay:${replayVersion}`,
      allowReplay: true,
      replayOfEraId: String(original._id),
      replayVersion,
      replayReason: reason.trim(),
    }, locale, updatedBy);

    original.replayStatus = 'REPLAYED';
    original.replayHistory = [
      ...(original.replayHistory ?? []),
      {
        action: 'ERA_REPLAY_COMPLETED',
        replayVersion,
        replayedEraId: result.eraEobProcessing._id,
        matchedClaimCount: result.matchedClaims.length,
        unmatchedClaimCount: result.unmatchedClaims.length,
        completedAt: new Date(),
      },
    ];
    original.updated = new Date();
    original.updatedBy = updatedBy as any;
    await original.save();

    publishRcmRealtimeEvent({
      eventType: 'ERA_REPLAY_COMPLETED',
      title: 'ERA replay completed',
      entityType: 'eraEobProcessing',
      entityId: String(original._id),
      status: original.replayStatus,
    });

    await auditLogService.record({
      entityType: 'eraEobProcessing',
      entityId: original._id,
      action: 'ERA_REPLAY_COMPLETED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'era835',
      reason: reason.trim(),
      correlationId: String(original._id),
      newState: {
        replayStatus: original.replayStatus,
        replayVersion,
        replayedEraId: String(result.eraEobProcessing._id),
        matchedClaimCount: result.matchedClaims.length,
      },
    });

    return { originalEra: original, ...result };
  },
};
