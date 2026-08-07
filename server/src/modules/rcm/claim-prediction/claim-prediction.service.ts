import mongoose from 'mongoose';
import { ClaimPrediction, IClaimPrediction } from './claim-prediction.model';
import { PaymentPosting } from '../payment-posting/payment-posting.model';
import { Claim } from '../claim/claim.model';
import { Appointment } from '../appointment/appointment.model';
import { Charge } from '../charge/charge.model';
import { Encounter } from '../encounter/encounter.model';
import { CodingReview } from '../coding-review/coding-review.model';
import { InsurancePolicy } from '../insurance-policy/insurance-policy.model';
import { EligibilityVerification } from '../eligibility-verification/eligibility-verification.model';
import { PriorAuthorization } from '../prior-authorization/prior-authorization.model';
import { Referral } from '../referral/referral.model';
import { ClaimSubmission } from '../claim-submission/claim-submission.model';
import { ClaimTracking } from '../claim-tracking/claim-tracking.model';
import { Denial } from '../denial/denial.model';
import { Payer } from '../payer/payer.model';
import { Facility } from '../facility/facility.model';
import { ChargeMaster } from '../charge-master/charge-master.model';
import { ProcedureCode } from '../procedure-code/procedure-code.model';
import { ruleService } from '../rule/rule.service';
import { feeScheduleService } from '../fee-schedule/fee-schedule.service';
import { normalizeUsState } from '../shared/state-normalization';
import { rcmAiService } from '../workflow/rcm-ai.service';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';
type PredictionSource = 'historical' | 'ai' | 'workflow_rules' | 'hybrid';

type PredictionInput = {
  claimId?: string;
  cptCode: string;
  payerId?: string;
  renderingProviderId?: string;
  billingProviderId?: string;
  facilityId?: string;
  placeOfServiceCode?: string;
  pricingState?: string;
  lineNumber?: number;
  units?: number;
  chargeAmount?: number;
  createdBy?: string;
  chargeId?: string;
  encounterId?: string;
  appointmentId?: string;
  patientId?: string;
  benefitAccumulator?: BenefitResponsibilityAccumulator;
};

type HistoricalStats = {
  avgAllowed: number;
  avgPaid: number;
  avgPatientResponsibility: number;
  avgDenied: number;
  count: number;
};

type PredictionContext = {
  claim?: any;
  line?: any;
  charge?: any;
  encounter?: any;
  appointment?: any;
  codingReview?: any;
  insurancePolicy?: any;
  eligibility?: any;
  priorAuthorization?: any;
  referral?: any;
  latestSubmission?: any;
  latestTracking?: any;
  latestDenial?: any;
  payer?: any;
  facility?: any;
  feeSchedule?: any;
  feeScheduleMatchLevel?: string;
  serviceDate?: Date;
  placeOfServiceCode?: string;
  pricingState?: string;
  chargeMaster?: any;
  procedureCode?: any;
  rules?: any[];
};

type RiskAssessment = {
  denialRiskScore: number;
  eligibilityRiskScore: number;
  authorizationRiskScore: number;
  paymentVarianceScore: number;
  riskLevel: RiskLevel;
  workflowStage: string;
  riskFactors: string[];
  evidence: string[];
  nextBestActions: string[];
  confidencePenalty: number;
};

type BenefitResponsibilityAccumulator = {
  remainingDeductibleByKey: Map<string, number>;
  remainingOutOfPocketByKey: Map<string, number>;
};

const INDUSTRY_ALLOWED_RATIOS: Record<string, number> = {
  medicare: 0.62,
  medicaid: 0.5,
  'managed medicaid': 0.52,
  commercial: 0.72,
  'workers compensation': 0.8,
  selfpay: 0.9,
  default: 0.68,
};

const APPROVED_AUTH_STATUSES = new Set(['approved', 'authorized', 'certified']);
const BLOCKING_TRACKING_STATUSES = ['reject', 'denied', 'failed', 'error', 'hold'];

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function normalizeTextLower(value: unknown) {
  return normalizeText(value)?.toLowerCase();
}

function normalizeCode(value: unknown) {
  return normalizeText(value)?.toUpperCase();
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizePositiveNumber(value: unknown) {
  const numberValue = normalizeNumber(value);
  return numberValue && numberValue > 0 ? numberValue : undefined;
}

function roundCurrency(value: number) {
  return Math.max(0, Math.round(value * 100) / 100);
}

function createBenefitResponsibilityAccumulator(): BenefitResponsibilityAccumulator {
  return {
    remainingDeductibleByKey: new Map<string, number>(),
    remainingOutOfPocketByKey: new Map<string, number>(),
  };
}

function benefitAccumulatorKey(eligibility: any) {
  return String(
    eligibility?._id
    ?? [
      eligibility?.patientId,
      eligibility?.insuranceId,
      eligibility?.payerId,
      eligibility?.coveragePriority,
      eligibility?.checkedAt,
    ].filter(Boolean).join(':')
    ?? 'default'
  );
}

function getAccumulatorValue(map: Map<string, number>, key: string, initialValue: unknown) {
  if (!map.has(key)) {
    map.set(key, Math.max(Number(initialValue ?? 0), 0));
  }
  return Number(map.get(key) ?? 0);
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function isObjectId(value?: string) {
  return Boolean(value && mongoose.Types.ObjectId.isValid(value));
}

function toObjectId(value?: string) {
  return isObjectId(value) ? new mongoose.Types.ObjectId(value) : undefined;
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
  }

  return undefined;
}

function dateOnOrAfter(left?: Date, right?: Date) {
  if (!left || !right) return true;
  return left.getTime() >= right.getTime();
}

function dateOnOrBefore(left?: Date, right?: Date) {
  if (!left || !right) return true;
  return left.getTime() <= right.getTime();
}

function getServiceDate(input: PredictionInput, context: Pick<PredictionContext, 'claim' | 'line' | 'charge' | 'encounter' | 'appointment'>) {
  void input;
  return (
    normalizeDate(context.line?.serviceDateFrom)
    ?? normalizeDate(context.charge?.serviceDate)
    ?? normalizeDate(context.encounter?.encounterDate)
    ?? normalizeDate(context.appointment?.appointmentStart)
    ?? normalizeDate(context.appointment?.appointmentDate)
    ?? normalizeDate(context.claim?.claimDate)
    ?? new Date()
  );
}

function getProviderId(input: PredictionInput, context: Pick<PredictionContext, 'claim' | 'line' | 'charge' | 'encounter' | 'appointment'>) {
  return normalizeText(input.renderingProviderId)
    ?? normalizeText(context.line?.renderingProviderId?.toString?.())
    ?? normalizeText(context.claim?.renderingProviderId?.toString?.())
    ?? normalizeText(context.encounter?.renderingProviderId?.toString?.())
    ?? normalizeText(context.encounter?.providerId?.toString?.())
    ?? normalizeText(context.charge?.providerId?.toString?.())
    ?? normalizeText(context.appointment?.providerId?.toString?.());
}

function getFacilityId(input: PredictionInput, context: Pick<PredictionContext, 'claim' | 'charge' | 'encounter' | 'appointment'>) {
  return normalizeText(input.facilityId)
    ?? normalizeText(context.claim?.facilityId?.toString?.())
    ?? normalizeText(context.charge?.facilityId?.toString?.())
    ?? normalizeText(context.encounter?.facilityId?.toString?.())
    ?? normalizeText(context.appointment?.facilityId?.toString?.());
}

function getPlaceOfService(context: Pick<PredictionContext, 'line' | 'charge' | 'facility'>) {
  return normalizeText(context.line?.placeOfService)
    ?? normalizeText(context.charge?.placeOfService)
    ?? normalizeText(context.facility?.placeOfServiceCode);
}

function getFeeScheduleMatchLevel(feeSchedule: any, query: {
  providerId?: string;
  facilityId?: string;
  state?: string;
  placeOfServiceCode?: string;
}) {
  if (!feeSchedule) return undefined;

  const dimensions = [
    query.providerId && String(feeSchedule.providerId ?? '') === query.providerId ? 'provider' : undefined,
    query.facilityId && String(feeSchedule.facilityId ?? '') === query.facilityId ? 'facility' : undefined,
    query.state && normalizeCode(feeSchedule.state) === query.state ? 'state' : undefined,
    query.placeOfServiceCode && normalizeText(feeSchedule.placeOfServiceCode) === query.placeOfServiceCode ? 'pos' : undefined,
  ].filter(Boolean);

  return dimensions.length ? dimensions.join('+') : 'payer+cpt';
}

function getPayerLookupIds(payerId: string | undefined, payer: any, insurancePolicy: any) {
  return Array.from(new Set([
    payerId,
    insurancePolicy?.payerId,
    insurancePolicy?.ediPayerId,
    payer?._id?.toString?.(),
    payer?.payerId,
    payer?.ediPayerId,
  ].map(normalizeText).filter((value): value is string => Boolean(value))));
}

function insurancePolicyIsValidForServiceDate(policy: any, serviceDate: Date) {
  const policyStatus = normalizeTextLower(policy?.policyStatus);

  if (policyStatus && ['inactive', 'terminated', 'cancelled', 'canceled'].includes(policyStatus)) {
    return false;
  }

  return (
    dateOnOrAfter(serviceDate, normalizeDate(policy?.effectiveDate))
    && dateOnOrBefore(serviceDate, normalizeDate(policy?.terminationDate))
  );
}

function buildRiskLevel(score: number): RiskLevel {
  if (score >= 0.8) return 'Critical';
  if (score >= 0.6) return 'High';
  if (score >= 0.35) return 'Medium';
  return 'Low';
}

function getPayerAllowedRatio(payer?: any) {
  const payerType = normalizeTextLower(payer?.payerType) ?? 'default';
  return INDUSTRY_ALLOWED_RATIOS[payerType] ?? INDUSTRY_ALLOWED_RATIOS.default;
}

function readProcedureUnitsFromEncounter(context: PredictionContext, cptCode: string) {
  const procedureCodeUnits = context.encounter?.procedureCodeUnits;
  const normalizedCptCode = normalizeCode(cptCode);

  if (!procedureCodeUnits || !normalizedCptCode) {
    return undefined;
  }

  if (procedureCodeUnits instanceof Map) {
    return normalizePositiveNumber(procedureCodeUnits.get(normalizedCptCode));
  }

  if (typeof procedureCodeUnits === 'object') {
    return normalizePositiveNumber(procedureCodeUnits[normalizedCptCode]);
  }

  return undefined;
}

function getPredictionUnits(input: PredictionInput, context: PredictionContext) {
  return (
    normalizePositiveNumber(input.units)
    ?? normalizePositiveNumber(context.line?.units)
    ?? readProcedureUnitsFromEncounter(context, input.cptCode)
    ?? 1
  );
}

function normalizeCoinsurancePercent(value: unknown) {
  const numberValue = normalizeNumber(value);

  if (numberValue === undefined || numberValue < 0) {
    return undefined;
  }

  return numberValue > 1 ? clamp(numberValue / 100) : clamp(numberValue);
}

function isSelfPayContext(context: PredictionContext) {
  return /self\s*pay|selfpay/i.test([
    context.insurancePolicy?.coverageType,
    context.payer?.payerType,
    context.payer?.payerName,
    context.payer?.payerId,
  ].filter(Boolean).join(' '));
}

function calculateBenefitResponsibility(
  allowedAmount: number,
  context: PredictionContext,
  accumulator?: BenefitResponsibilityAccumulator,
) {
  if (allowedAmount <= 0) {
    return null;
  }

  if (isSelfPayContext(context)) {
    return {
      patientResponsibility: allowedAmount,
      insurancePaid: 0,
      evidence: ['Self-pay context: patient responsibility equals estimated allowed amount.'],
    };
  }

  const eligibility = context.eligibility;

  if (!eligibility || eligibility.planActive === false) {
    return null;
  }

  const copayAmount = normalizeNumber(eligibility.copayAmount);
  const deductibleRemaining = normalizeNumber(eligibility.deductibleRemaining);
  const coinsurancePercent = normalizeCoinsurancePercent(eligibility.coinsurancePercent);
  const outOfPocketRemaining = normalizeNumber(eligibility.outOfPocketRemaining);
  const hasBenefitValues = [
    copayAmount,
    deductibleRemaining,
    coinsurancePercent,
    outOfPocketRemaining,
  ].some((value) => value !== undefined);

  if (!hasBenefitValues) {
    return null;
  }

  let remainingAllowed = allowedAmount;
  const copayApplied = Math.min(Math.max(copayAmount ?? 0, 0), remainingAllowed);
  remainingAllowed = roundCurrency(remainingAllowed - copayApplied);

  const accumulatorKey = accumulator ? benefitAccumulatorKey(eligibility) : undefined;
  const availableDeductible = deductibleRemaining !== undefined
    ? accumulator && accumulatorKey
      ? getAccumulatorValue(accumulator.remainingDeductibleByKey, accumulatorKey, deductibleRemaining)
      : Math.max(deductibleRemaining, 0)
    : 0;
  let deductibleApplied = Math.min(availableDeductible, remainingAllowed);
  remainingAllowed = roundCurrency(remainingAllowed - deductibleApplied);

  let coinsuranceApplied = roundCurrency(remainingAllowed * (coinsurancePercent ?? 0));
  let patientResponsibility = roundCurrency(copayApplied + deductibleApplied + coinsuranceApplied);

  const availableOutOfPocket = outOfPocketRemaining !== undefined
    ? accumulator && accumulatorKey
      ? getAccumulatorValue(accumulator.remainingOutOfPocketByKey, accumulatorKey, outOfPocketRemaining)
      : Math.max(outOfPocketRemaining, 0)
    : undefined;

  if (availableOutOfPocket !== undefined) {
    const uncappedPatientResponsibility = patientResponsibility;
    patientResponsibility = Math.min(patientResponsibility, availableOutOfPocket);
    const cappedReduction = roundCurrency(Math.max(0, uncappedPatientResponsibility - patientResponsibility));
    if (cappedReduction > 0) {
      const coinsuranceReduction = Math.min(coinsuranceApplied, cappedReduction);
      coinsuranceApplied = roundCurrency(coinsuranceApplied - coinsuranceReduction);
      const deductibleReduction = Math.min(deductibleApplied, roundCurrency(cappedReduction - coinsuranceReduction));
      deductibleApplied = roundCurrency(deductibleApplied - deductibleReduction);
    }
  }

  patientResponsibility = Math.min(patientResponsibility, allowedAmount);
  if (accumulator && accumulatorKey) {
    if (deductibleRemaining !== undefined) {
      accumulator.remainingDeductibleByKey.set(
        accumulatorKey,
        roundCurrency(Math.max(0, availableDeductible - deductibleApplied))
      );
    }
    if (availableOutOfPocket !== undefined) {
      accumulator.remainingOutOfPocketByKey.set(
        accumulatorKey,
        roundCurrency(Math.max(0, availableOutOfPocket - patientResponsibility))
      );
    }
  }
  const insurancePaid = roundCurrency(allowedAmount - patientResponsibility);
  const evidence = [
    `Eligibility benefits applied: copay $${roundCurrency(copayApplied)}, deductible $${roundCurrency(deductibleApplied)}, coinsurance $${roundCurrency(coinsuranceApplied)}.`,
    outOfPocketRemaining !== undefined
      ? `Out-of-pocket remaining cap: $${roundCurrency(Math.max(outOfPocketRemaining, 0))}.`
      : undefined,
  ].filter((value): value is string => Boolean(value));

  return {
    patientResponsibility,
    insurancePaid,
    evidence,
  };
}

function getWorkflowStage(context: PredictionContext) {
  if (context.latestDenial && !context.latestDenial.resolutionDate) return 'Denial / Rework';
  if (context.latestTracking?.rejectionLevel || context.latestTracking?.nextActionRequired) return 'Claim Tracking Exception';
  if (context.latestSubmission) return 'Submitted / Acknowledgement';
  if (context.claim?.claimStatus === 'Ready for Submission') return 'Ready for Submission';
  if (context.codingReview) return 'Coding Review';
  if (context.charge) return 'Charge Capture';
  if (context.encounter) return 'Encounter';
  if (context.appointment) return 'Appointment / Pre-Encounter';
  return 'Pre-Submission';
}

function hasBlockingTrackingStatus(context: PredictionContext) {
  const statusText = [
    context.latestTracking?.statusCode,
    context.latestTracking?.statusDescription,
    context.latestTracking?.rejectionLevel,
    context.latestTracking?.rejectionSource,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return BLOCKING_TRACKING_STATUSES.some((status) => statusText.includes(status));
}

function codeMatchesRule(rule: any, code: string) {
  return rule.code === code || (Array.isArray(rule.codes) && rule.codes.includes(code));
}

function getClaimLineCodes(context: PredictionContext) {
  return (context.claim?.claimLines ?? context.charge?.chargeLines ?? [])
    .map((line: any) => normalizeText(line?.cptCode))
    .filter((code: string | undefined): code is string => Boolean(code));
}

function hasRequiredWorkflowField(field: string, context: PredictionContext) {
  const normalizedField = field.trim().toLowerCase();

  switch (normalizedField) {
    case 'clinicalnotes':
    case 'clinical_notes':
      return Boolean(
        normalizeText(context.codingReview?.clinicalNotes)
        || normalizeText(context.charge?.clinicalNotes)
        || context.charge?.documentationComplete
        || context.codingReview?.missingDocumentationFlag === false
      );
    case 'xray':
    case 'x-ray':
    case 'radiograph':
      return Boolean(
        context.claim?.attachments?.some?.((item: any) => /x-?ray|radiograph/i.test(String(item?.documentType ?? item?.title ?? '')))
        || context.charge?.attachments?.some?.((item: any) => /x-?ray|radiograph/i.test(String(item?.documentType ?? item?.title ?? '')))
      );
    default:
      return Boolean(
        context.claim?.[field]
        || context.charge?.[field]
        || context.codingReview?.[field]
      );
  }
}

function buildExplanation(
  input: PredictionInput,
  context: PredictionContext,
  historical: HistoricalStats | null,
  risk: RiskAssessment,
  source: PredictionSource,
) {
  const evidence = risk.evidence.slice(0, 4).join(' ');
  const sampleText = historical?.count
    ? ` Historical payment sample size: ${historical.count}.`
    : ' No strong historical payment sample was available.';
  const payerText = context.payer?.payerName ? ` Payer context: ${context.payer.payerName}.` : '';

  return [
    `Predicted from ${source.replace('_', ' ')} logic for CPT ${input.cptCode}.`,
    payerText,
    sampleText,
    ` Workflow stage: ${risk.workflowStage}.`,
    ` Risk level: ${risk.riskLevel}.`,
    evidence,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class ClaimPredictionService {
  async predictForClaim(claimId: string, userId?: string): Promise<IClaimPrediction[]> {
    const claim = await Claim.findOne({ _id: claimId, isDeleted: false });
    if (!claim) {
      throw new AppError('Claim not found', HTTP_STATUS.NOT_FOUND);
    }

    await ClaimPrediction.updateMany(
      { claimId, isDeleted: false },
      {
        isDeleted: true,
        active: false,
        deletedAt: new Date(),
        updatedBy: userId,
      }
    );

    const predictions: IClaimPrediction[] = [];
    const benefitAccumulator = createBenefitResponsibilityAccumulator();

    for (const line of claim.claimLines ?? []) {
      if (!line.cptCode) continue;

      const prediction = await this.predict({
        claimId,
        cptCode: line.cptCode,
        payerId: claim.payerId ?? '',
        renderingProviderId: line.renderingProviderId?.toString() || claim.renderingProviderId?.toString(),
        billingProviderId: claim.billingProviderId?.toString(),
        facilityId: claim.facilityId?.toString(),
        lineNumber: line.lineNumber,
        units: line.units,
        chargeAmount: line.chargeAmount,
        createdBy: userId,
        benefitAccumulator,
      });

      predictions.push(prediction);
    }

    return predictions;
  }

  async predictForCharge(chargeId: string, userId?: string): Promise<IClaimPrediction[]> {
    const charge = await Charge.findOne({ _id: chargeId, isDeleted: false });
    if (!charge) {
      throw new AppError('Charge not found', HTTP_STATUS.NOT_FOUND);
    }

    await ClaimPrediction.updateMany(
      { chargeId, isDeleted: false },
      {
        isDeleted: true,
        active: false,
        deletedAt: new Date(),
        updatedBy: userId,
      }
    );

    const predictions: IClaimPrediction[] = [];
    const benefitAccumulator = createBenefitResponsibilityAccumulator();

    for (const line of charge.chargeLines ?? []) {
      if (!line.cptCode) continue;

      const prediction = await this.predict({
        chargeId,
        cptCode: line.cptCode,
        renderingProviderId: line.renderingProviderId?.toString() || charge.providerId?.toString(),
        billingProviderId: charge.providerId?.toString(),
        facilityId: charge.facilityId?.toString(),
        lineNumber: line.lineNumber,
        units: line.units,
        chargeAmount: line.chargeAmount,
        createdBy: userId,
        benefitAccumulator,
      });

      predictions.push(prediction);
    }

    return predictions;
  }

  async predictForEncounter(encounterId: string, userId?: string): Promise<IClaimPrediction[]> {
    const encounter = await Encounter.findOne({ _id: encounterId, isDeleted: false });
    if (!encounter) {
      throw new AppError('Encounter not found', HTTP_STATUS.NOT_FOUND);
    }

    const procedureCodes = (encounter.procedureCodes ?? []).filter(Boolean);
    const predictions: IClaimPrediction[] = [];
    const benefitAccumulator = createBenefitResponsibilityAccumulator();

    if (procedureCodes.length > 0) {
      for (const cptCode of procedureCodes) {
        const prediction = await this.predict({
          encounterId,
          cptCode,
          renderingProviderId: encounter.renderingProviderId?.toString() || encounter.providerId?.toString(),
          billingProviderId: encounter.providerId?.toString(),
          facilityId: encounter.facilityId?.toString(),
          units: readProcedureUnitsFromEncounter({ encounter }, cptCode),
          createdBy: userId,
          benefitAccumulator,
        });

        predictions.push(prediction);
      }
    } else if (encounter.clinicalNotes || encounter.chiefComplaint) {
      // Logic for suggesting codes if encounter procedure codes are empty
      const appointment = encounter.appointmentId 
        ? await Appointment.findOne({ _id: encounter.appointmentId, isDeleted: false })
        : null;

      const aiResponse = await rcmAiService.suggestEncounterCodes({
        encounterNote: encounter.clinicalNotes || encounter.chiefComplaint || '',
        chiefComplaint: encounter.chiefComplaint,
        clinicalNotes: encounter.clinicalNotes,
        appointmentType: appointment?.appointmentType,
        visitType: appointment?.visitType,
        appointmentReason: appointment?.reason,
      });

      if (aiResponse.procedureCodes.length === 0) {
        const reason = encounter.chiefComplaint || encounter.clinicalNotes || appointment?.reason || '';
        const keywords = reason.split(/\s+/).filter(k => k.length > 3);
        const synonyms: Record<string, string[]> = {
          'pain': ['evaluation', 'exam', 'emergency', 'extraction'],
          'teeth': ['oral', 'dental', 'prophylaxis'],
          'tooth': ['oral', 'dental', 'extraction', 'filling'],
          'cleaning': ['prophylaxis', 'varnish'],
          'checkup': ['evaluation', 'periodic', 'comprehensive'],
          'bleeding': ['periodontal', 'scaling'],
          'swelling': ['extraction', 'emergency'],
          'headache': ['evaluation', 'diagnostic', 'periodic'],
          'follow': ['evaluation', 'periodic'],
          'consultation': ['evaluation', 'comprehensive'],
        };

        const expanded = [...keywords];
        keywords.forEach(k => {
          const lowerK = k.toLowerCase();
          if (synonyms[lowerK]) expanded.push(...synonyms[lowerK]);
        });

        if (expanded.length > 0) {
          const fallback = await ChargeMaster.find({
            $or: expanded.map(k => ({ 
              $or: [{ description: { $regex: new RegExp(k, 'i') } }, { cptCode: { $regex: new RegExp(k, 'i') } }]
            })),
            isDeleted: false, active: true,
          }).limit(3);

          for (const pc of fallback) {
            aiResponse.procedureCodes.push({
              code: pc.cptCode || '',
              description: pc.description || '',
              confidence: 0.4,
              reasoning: `Suggested based on encounter notes and Charge Master keyword matching`,
            });
          }
        }
      }

      if (aiResponse.procedureCodes.length === 0) {
        const isNew = appointment?.appointmentType === 'New Patient';
        const defaultCode = isNew ? 'D0150' : 'D0120';
        const pc = await ChargeMaster.findOne({ cptCode: defaultCode, isDeleted: false, active: true }) 
                 || await ProcedureCode.findOne({ code: defaultCode, isDeleted: false, active: true });
        if (pc) {
          aiResponse.procedureCodes.push({
            code: (pc as any).cptCode || (pc as any).code,
            description: pc.description || '',
            confidence: 0.3,
            reasoning: `Default evaluation based on encounter context`,
          });
        }
      }

      for (const suggested of aiResponse.procedureCodes) {
        if (!suggested.code) continue;
        const prediction = await this.predict({
          encounterId,
          cptCode: suggested.code,
          renderingProviderId: encounter.renderingProviderId?.toString() || encounter.providerId?.toString(),
          billingProviderId: encounter.providerId?.toString(),
          facilityId: encounter.facilityId?.toString(),
          units: suggested.units,
          createdBy: userId,
          benefitAccumulator,
        });
        predictions.push(prediction);
      }
    }

    return predictions;
  }

  async estimateForAppointment(appointmentId: string, userId?: string): Promise<IClaimPrediction[]> {
    const appointment = await Appointment.findOne({ _id: appointmentId, isDeleted: false });
    if (!appointment) {
      throw new AppError('Appointment not found', HTTP_STATUS.NOT_FOUND);
    }

    const aiResponse = await rcmAiService.suggestEncounterCodes({
      encounterNote: appointment.reason || '',
      appointmentReason: appointment.reason,
      appointmentType: appointment.appointmentType,
      visitType: appointment.visitType,
      appointmentNotes: appointment.notes,
    });

    if (aiResponse.procedureCodes.length === 0 && appointment.reason) {
      const originalKeywords = appointment.reason.split(/\s+/).filter(k => k.length > 3);
      const synonyms: Record<string, string[]> = {
        'pain': ['evaluation', 'exam', 'emergency', 'extraction'],
        'teeth': ['oral', 'dental', 'prophylaxis'],
        'tooth': ['oral', 'dental', 'extraction', 'filling'],
        'cleaning': ['prophylaxis', 'varnish'],
        'checkup': ['evaluation', 'periodic', 'comprehensive'],
        'bleeding': ['periodontal', 'scaling'],
        'swelling': ['extraction', 'emergency'],
        'headache': ['evaluation', 'diagnostic', 'periodic'],
        'follow': ['evaluation', 'periodic'],
        'consultation': ['evaluation', 'comprehensive'],
      };

      const expandedKeywords = [...originalKeywords];
      originalKeywords.forEach(k => {
        const lowerK = k.toLowerCase();
        if (synonyms[lowerK]) {
          expandedKeywords.push(...synonyms[lowerK]);
        }
      });

      if (expandedKeywords.length > 0) {
        const fallbackCodes = await ChargeMaster.find({
          $or: expandedKeywords.map(k => ({ 
            $or: [
              { description: { $regex: new RegExp(k, 'i') } },
              { cptCode: { $regex: new RegExp(k, 'i') } }
            ]
          })),
          isDeleted: false,
          active: true,
        }).limit(3);

        for (const pc of fallbackCodes) {
          aiResponse.procedureCodes.push({
            code: pc.cptCode || '',
            description: pc.description || '',
            confidence: 0.4,
            reasoning: `Suggested based on appointment reason keyword: "${appointment.reason}" from Charge Master`,
          });
        }
      }
    }

    if (aiResponse.procedureCodes.length === 0) {
      // Last resort: Suggest a basic evaluation based on visit type
      const isNewPatient = appointment.appointmentType === 'New Patient';
      const defaultCode = isNewPatient ? 'D0150' : 'D0120';

      const pc = await ChargeMaster.findOne({ cptCode: defaultCode, isDeleted: false, active: true })
               || await ProcedureCode.findOne({ code: defaultCode, isDeleted: false, active: true });
      if (pc) {
        aiResponse.procedureCodes.push({
          code: (pc as any).cptCode || (pc as any).code,
          description: pc.description || '',
          confidence: 0.3,
          reasoning: `Default evaluation suggested based on visit type (${appointment.appointmentType})`,
        });
      }
    }

    const predictions: IClaimPrediction[] = [];
    const benefitAccumulator = createBenefitResponsibilityAccumulator();

    for (const suggested of aiResponse.procedureCodes) {
      if (!suggested.code) continue;

      const prediction = await this.predict({
        appointmentId,
        cptCode: suggested.code,
        renderingProviderId: appointment.providerId?.toString(),
        billingProviderId: appointment.providerId?.toString(),
        facilityId: appointment.facilityId?.toString(),
        units: suggested.units,
        createdBy: userId,
        benefitAccumulator,
      });

      predictions.push(prediction);
    }

    return predictions;
  }

  async predict(input: PredictionInput): Promise<IClaimPrediction> {
    if (!normalizeText(input.cptCode)) {
      throw new AppError('CPT code is required for claim prediction.', HTTP_STATUS.BAD_REQUEST);
    }

    if (!normalizeText(input.payerId) && !input.claimId && !input.chargeId && !input.encounterId && !input.appointmentId) {
      throw new AppError('Payer ID, claim ID, charge ID, encounter ID, or appointment ID is required for claim prediction.', HTTP_STATUS.BAD_REQUEST);
    }

    const context = await this.buildPredictionContext(input) as any;
    let resolvedPayerId = normalizeText(input.payerId) ?? normalizeText(context.claim?.payerId) ?? normalizeText(context.insurancePolicy?.payerId) ?? normalizeText(context.insurancePolicy?.ediPayerId);

    // Fallback to Self-Pay if no payer is found (common for new appointments)
    if (!resolvedPayerId) {
      const defaultPayer = await Payer.findOne({
        payerName: /Self/i,
        isDeleted: false,
        active: true,
      }) || await Payer.findOne({ isDeleted: false, active: true });
      resolvedPayerId = defaultPayer?.payerId || defaultPayer?._id?.toString() || 'SELF_PAY';
    }

    const units = getPredictionUnits(input, context);
    const explicitLineChargeAmount =
      normalizeNumber(input.chargeAmount)
      ?? normalizeNumber(context.line?.chargeAmount);
    const fallbackUnitChargeAmount =
      normalizeNumber(context.chargeMaster?.defaultChargeAmount)
      ?? normalizeNumber(context.procedureCode?.chargeFee)
      ?? 0;
    const lineChargeAmount = explicitLineChargeAmount ?? roundCurrency(fallbackUnitChargeAmount * units);

    const historical = await this.getHistoricalStats(
      input.cptCode,
      getPayerLookupIds(resolvedPayerId, context.payer, context.insurancePolicy),
      context,
    );
    const risk = this.assessWorkflowRisk(input, context, historical);
    const financial = this.calculateFinancialPrediction(input, context, historical, risk, lineChargeAmount);
    const resolvedInput = { ...input, payerId: resolvedPayerId };
    const aiSignal = await this.getAiRiskSignal(resolvedInput, context, risk);

    if (aiSignal) {
      risk.riskFactors = Array.from(new Set([...risk.riskFactors, ...aiSignal.riskFactors]));
      risk.nextBestActions = Array.from(new Set([...risk.nextBestActions, ...aiSignal.nextBestActions]));
      risk.evidence = Array.from(new Set([...risk.evidence, ...aiSignal.evidence]));
      risk.denialRiskScore = clamp(Math.max(risk.denialRiskScore, aiSignal.denialRiskScore));
      risk.riskLevel = buildRiskLevel(Math.max(risk.denialRiskScore, risk.authorizationRiskScore, risk.eligibilityRiskScore));
    }

    const source = this.resolvePredictionSource(historical, context, aiSignal !== null);
    const confidenceScore = clamp(financial.confidenceScore - risk.confidencePenalty);

    return ClaimPrediction.create({
      claimId: input.claimId ?? context.claim?._id,
      chargeId: input.chargeId ?? context.charge?._id,
      encounterId: input.encounterId ?? context.encounter?._id,
      appointmentId: input.appointmentId ?? context.appointment?._id,
      patientId: context.claim?.patientId ?? context.charge?.patientId ?? context.encounter?.patientId ?? context.appointment?.patientId,
      cptCode: normalizeCode(input.cptCode) ?? input.cptCode,
      payerId: resolvedPayerId,
      lineNumber: input.lineNumber ?? context.line?.lineNumber,
      renderingProviderId: input.renderingProviderId ?? context.line?.renderingProviderId ?? context.claim?.renderingProviderId ?? context.encounter?.renderingProviderId ?? context.encounter?.providerId ?? context.charge?.providerId ?? context.appointment?.providerId,
      billingProviderId: input.billingProviderId ?? context.claim?.billingProviderId ?? context.charge?.providerId ?? context.encounter?.providerId ?? context.appointment?.providerId,
      facilityId: input.facilityId ?? context.claim?.facilityId ?? context.charge?.facilityId ?? context.encounter?.facilityId ?? context.appointment?.facilityId,
      units,
      chargeAmount: lineChargeAmount,
      predictedAllowed: financial.predictedAllowed,
      predictedPaid: financial.predictedPaid,
      predictedPatientResponsibility: financial.predictedPatientResponsibility,
      expectedAllowedPercentage: lineChargeAmount ? roundCurrency(financial.predictedAllowed / lineChargeAmount) : 0,
      expectedPaidPercentage: lineChargeAmount ? roundCurrency(financial.predictedPaid / lineChargeAmount) : 0,
      confidenceScore,
      denialRiskScore: risk.denialRiskScore,
      eligibilityRiskScore: risk.eligibilityRiskScore,
      authorizationRiskScore: risk.authorizationRiskScore,
      paymentVarianceScore: risk.paymentVarianceScore,
      riskLevel: risk.riskLevel,
      workflowStage: risk.workflowStage,
      nextBestActions: risk.nextBestActions,
      riskFactors: risk.riskFactors,
      evidence: risk.evidence,
      sampleSize: historical?.count ?? 0,
      feeScheduleId: context.feeSchedule?._id,
      feeScheduleMatchLevel: context.feeScheduleMatchLevel,
      pricingState: context.pricingState,
      placeOfServiceCode: context.placeOfServiceCode,
      source,
      explanation: buildExplanation(input, context, historical, risk, source),
      active: true,
      createdBy: input.createdBy,
    });
  }

  private async buildPredictionContext(input: PredictionInput): Promise<PredictionContext> {
    const claim = input.claimId
      ? await Claim.findOne({ _id: input.claimId, isDeleted: false })
      : null;
    const charge = input.chargeId
      ? await Charge.findOne({ _id: input.chargeId, isDeleted: false })
      : claim?.chargeId
        ? await Charge.findOne({ _id: claim.chargeId, isDeleted: false })
        : null;
    const encounter = input.encounterId
      ? await Encounter.findOne({ _id: input.encounterId, isDeleted: false })
      : charge?.encounterId
        ? await Encounter.findOne({ _id: charge.encounterId, isDeleted: false })
        : null;
    const appointment = input.appointmentId
      ? await Appointment.findOne({ _id: input.appointmentId, isDeleted: false })
      : encounter?.appointmentId
        ? await Appointment.findOne({ _id: encounter.appointmentId, isDeleted: false })
        : null;
    const patientId = claim?.patientId ?? charge?.patientId ?? encounter?.patientId ?? appointment?.patientId;
    const line = (claim?.claimLines ?? charge?.chargeLines)?.find((l: any) => {
      if (input.lineNumber && l.lineNumber === input.lineNumber) return true;
      return l.cptCode === input.cptCode;
    });
    const serviceDate = getServiceDate(input, { claim, line, charge, encounter, appointment });
    const requestedPayerId = normalizeText(input.payerId) ?? normalizeText(claim?.payerId);
    const insurancePolicyFilter = {
      patientId,
      active: true,
      isDeleted: false,
      ...(requestedPayerId ? { $or: [{ payerId: requestedPayerId }, { ediPayerId: requestedPayerId }] } : {}),
    };
    const insurancePolicies = patientId
      ? await InsurancePolicy.find(insurancePolicyFilter).sort({ coordinationOfBenefitsOrder: 1, updated: -1 })
      : [];
    const insurancePolicy = insurancePolicies.find((policy) => insurancePolicyIsValidForServiceDate(policy, serviceDate))
      ?? insurancePolicies[0]
      ?? null;
    const payerId = requestedPayerId ?? normalizeText(insurancePolicy?.payerId) ?? normalizeText(insurancePolicy?.ediPayerId);
    const payer = payerId ? await Payer.findOne({
      active: true,
      isDeleted: false,
      $or: [
        { payerId },
        { ediPayerId: payerId },
        ...(isObjectId(payerId) ? [{ _id: toObjectId(payerId) }] : []),
      ],
    }) : null;
    const providerId = getProviderId(input, { claim, line, charge, encounter, appointment });
    const facilityId = getFacilityId(input, { claim, charge, encounter, appointment });
    const facility = facilityId
      ? await Facility.findOne({ _id: facilityId, isDeleted: false })
      : null;
    const pricingState = normalizeUsState(input.pricingState) ?? normalizeUsState(facility?.state);
    const placeOfServiceCode = normalizeText(input.placeOfServiceCode) ?? getPlaceOfService({ line, charge, facility });
    const payerLookupIds = getPayerLookupIds(payerId, payer, insurancePolicy);
    const planName = normalizeText(insurancePolicy?.planName);
    const groupNumber = normalizeText(insurancePolicy?.groupNumber);
    const network = normalizeText(insurancePolicy?.network);
    const coverageType = normalizeText(insurancePolicy?.coverageType);
    const feeSchedule = await feeScheduleService.findBestMatch({
      payerIds: payerLookupIds,
      cptCode: input.cptCode,
      providerId,
      facilityId,
      state: pricingState,
      placeOfServiceCode,
      planName,
      groupNumber,
      network,
      coverageType,
      serviceDate,
    });
    const feeScheduleMatchLevel = getFeeScheduleMatchLevel(feeSchedule, {
      providerId,
      facilityId,
      state: pricingState,
      placeOfServiceCode,
    });

    const [
      codingReview,
      eligibility,
      priorAuthorization,
      referral,
      latestSubmission,
      latestTracking,
      latestDenial,
      chargeMaster,
      procedureCode,
      rules,
    ] = await Promise.all([
      charge?._id ? CodingReview.findOne({ chargeId: charge._id, isDeleted: false }).sort({ updated: -1 }) : null,
      patientId ? EligibilityVerification.findOne({
        patientId,
        active: true,
        isDeleted: false,
        ...(insurancePolicy?._id ? { insuranceId: insurancePolicy._id } : {}),
      }).sort({ checkedAt: -1, updated: -1 }) : null,
      patientId ? PriorAuthorization.findOne({
        patientId,
        active: true,
        isDeleted: false,
        ...(insurancePolicy?._id ? { insuranceId: insurancePolicy._id } : {}),
        procedureCodes: input.cptCode,
      }).sort({ updated: -1, requestDate: -1 }) : null,
      patientId ? Referral.findOne({
        patientId,
        active: true,
        isDeleted: false,
        ...(payerId ? { payerId } : {}),
      }).sort({ updated: -1, startDate: -1 }) : null,
      claim?._id ? ClaimSubmission.findOne({ claimId: claim._id, isDeleted: false }).sort({ submissionDateTime: -1, updated: -1 }) : null,
      claim?._id ? ClaimTracking.findOne({ claimId: claim._id, isDeleted: false }).sort({ receivedDate: -1, updated: -1 }) : null,
      claim?._id ? Denial.findOne({ claimId: claim._id, isDeleted: false }).sort({ denialDate: -1, updated: -1 }) : null,
      ChargeMaster.findOne({
        cptCode: input.cptCode,
        active: true,
        isDeleted: false,
      }).sort({ effectiveDate: -1, updated: -1 }),
      ProcedureCode.findOne({
        code: input.cptCode,
        active: true,
        isDeleted: false,
      }),
      ruleService.findApplicable({
        payerIds: payerLookupIds,
        cptCode: input.cptCode,
        providerId,
        facilityId,
        state: pricingState,
        placeOfServiceCode,
        planName,
        groupNumber,
        network,
        coverageType,
        serviceDate,
      }),
    ]);

    return {
      claim,
      line,
      charge,
      encounter,
      codingReview,
      insurancePolicy,
      eligibility,
      priorAuthorization,
      referral,
      latestSubmission,
      latestTracking,
      latestDenial,
      payer,
      facility,
      feeSchedule,
      feeScheduleMatchLevel,
      serviceDate,
      placeOfServiceCode,
      pricingState,
      chargeMaster,
      procedureCode,
      rules,
      appointment,
    };
  }

  private async getHistoricalStats(cptCode: string, payerIds: string[], context: PredictionContext): Promise<HistoricalStats | null> {
    const normalizedCptCode = normalizeCode(cptCode);
    const normalizedPayerIds = Array.from(new Set(payerIds.map(normalizeText).filter((value): value is string => Boolean(value))));

    if (!normalizedCptCode || !normalizedPayerIds.length) {
      return null;
    }

    const claimLineMatch: Record<string, unknown> = {
      'claimInfo.claimLines.cptCode': normalizedCptCode,
    };

    const providerId = getProviderId({ cptCode }, context);
    const facilityId = getFacilityId({ cptCode }, context);
    const placeOfServiceCode = context.placeOfServiceCode;

    if (providerId) {
      claimLineMatch['claimInfo.claimLines.renderingProviderId'] = toObjectId(providerId) ?? providerId;
    }

    const claimInfoMatch: Record<string, unknown> = {};

    if (facilityId) {
      claimInfoMatch['claimInfo.facilityId'] = toObjectId(facilityId) ?? facilityId;
    }

    if (placeOfServiceCode) {
      claimLineMatch['claimInfo.claimLines.placeOfService'] = placeOfServiceCode;
    }

    const stats = await PaymentPosting.aggregate([
      { $match: { payerId: { $in: normalizedPayerIds }, isDeleted: false, active: { $ne: false } } },
      {
        $lookup: {
          from: 'claims',
          localField: 'claimId',
          foreignField: '_id',
          as: 'claimInfo',
        },
      },
      { $unwind: '$claimInfo' },
      ...(Object.keys(claimInfoMatch).length ? [{ $match: claimInfoMatch }] : []),
      { $unwind: '$claimInfo.claimLines' },
      { $match: claimLineMatch },
      { $unwind: '$paymentLines' },
      {
        $match: {
          $or: [
            { 'paymentLines.claimLineId': { $exists: false } },
            { 'paymentLines.claimLineId': null },
            { $expr: { $eq: ['$paymentLines.claimLineId', '$claimInfo.claimLines.chargeLineId'] } },
          ],
        },
      },
      {
        $group: {
          _id: null,
          avgAllowed: { $avg: '$paymentLines.allowedAmount' },
          avgPaid: { $avg: '$paymentLines.paidAmount' },
          avgPatientResponsibility: { $avg: '$paymentLines.patientRespAmount' },
          avgDenied: { $avg: '$paymentLines.deniedAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const result = stats[0];
    if (!result) return null;

    return {
      avgAllowed: Number(result.avgAllowed ?? 0),
      avgPaid: Number(result.avgPaid ?? 0),
      avgPatientResponsibility: Number(result.avgPatientResponsibility ?? 0),
      avgDenied: Number(result.avgDenied ?? 0),
      count: Number(result.count ?? 0),
    };
  }

  private calculateFinancialPrediction(
    input: PredictionInput,
    context: PredictionContext,
    historical: HistoricalStats | null,
    risk: RiskAssessment,
    chargeAmount: number,
  ) {
    const units = getPredictionUnits(input, context);
    const feeScheduleAllowedPerUnit = normalizeNumber(context.feeSchedule?.allowedAmount);
    const chargeMasterAllowedPerUnit = normalizeNumber(context.chargeMaster?.defaultAllowedAmount);
    const feeScheduleAllowed = feeScheduleAllowedPerUnit !== undefined
      ? roundCurrency(feeScheduleAllowedPerUnit * units)
      : undefined;
    const chargeMasterAllowed = chargeMasterAllowedPerUnit !== undefined
      ? roundCurrency(chargeMasterAllowedPerUnit * units)
      : undefined;
    const benchmarkAllowed = roundCurrency(chargeAmount * getPayerAllowedRatio(context.payer));
    const historicalAllowed = historical?.count ? roundCurrency(historical.avgAllowed) : undefined;
    const referenceAllowed =
      feeScheduleAllowed
      ?? historicalAllowed
      ?? chargeMasterAllowed
      ?? benchmarkAllowed;
    const predictedAllowed = roundCurrency(
      chargeAmount > 0 ? Math.min(chargeAmount, referenceAllowed) : referenceAllowed
    );
    const benefitResponsibility = calculateBenefitResponsibility(predictedAllowed, context, input.benefitAccumulator);

    const historicalPatientResponsibility = historical?.avgPatientResponsibility !== undefined
      ? roundCurrency(Math.min(historical.avgPatientResponsibility, predictedAllowed))
      : undefined;
    const historicalPaid = historical?.avgPaid !== undefined
      ? roundCurrency(Math.min(historical.avgPaid, predictedAllowed))
      : undefined;
    const historicalPaidRatio = historical?.avgAllowed
      ? clamp(historical.avgPaid / historical.avgAllowed, 0, 1)
      : undefined;
    const payerPaidRatio = normalizeTextLower(context.payer?.payerType) === 'medicaid' ? 0.92 : 0.82;
    const fallbackPaid = roundCurrency(predictedAllowed * (historicalPaidRatio ?? payerPaidRatio));
    const predictedPatientResponsibility = benefitResponsibility
      ? benefitResponsibility.patientResponsibility
      : historicalPatientResponsibility !== undefined
        ? historicalPatientResponsibility
        : roundCurrency(Math.max(0, predictedAllowed - fallbackPaid));
    const predictedPaid = benefitResponsibility
      ? benefitResponsibility.insurancePaid
      : historicalPaid !== undefined
        ? historicalPaid
        : roundCurrency(Math.max(0, predictedAllowed - predictedPatientResponsibility));
    const historyConfidence = historical ? this.calculateHistoricalConfidence(historical.count) : 0.35;
    const referenceConfidence = feeScheduleAllowed ? 0.9 : historicalAllowed ? historyConfidence : chargeMasterAllowed ? 0.65 : 0.45;
    const confidenceScore = benefitResponsibility
      ? Math.max(referenceConfidence, feeScheduleAllowed ? 0.94 : 0.82)
      : referenceConfidence;

    risk.paymentVarianceScore = chargeAmount
      ? clamp(Math.abs(chargeAmount - predictedAllowed) / chargeAmount)
      : 0;

    if (risk.paymentVarianceScore > 0.45) {
      risk.riskFactors.push('High variance between charge amount and expected allowed amount.');
      risk.nextBestActions.push('Review payer contract or charge master pricing before submission.');
    }

    if (feeScheduleAllowed) {
      risk.evidence.push(`Contracted fee schedule allowed amount found: $${feeScheduleAllowed}${units > 1 ? ` (${units} units)` : ''}${context.feeScheduleMatchLevel ? ` (${context.feeScheduleMatchLevel})` : ''}.`);
    } else if (historicalAllowed) {
      risk.evidence.push(`Used matched historical allowed amount average: $${historicalAllowed}.`);
      risk.nextBestActions.push('Load the payer contract fee schedule for this payer, provider, state, POS, and CPT to replace historical fallback pricing.');
    } else if (chargeMasterAllowed) {
      risk.evidence.push(`Charge master default allowed amount found: $${chargeMasterAllowed} because no matching payer contract fee schedule was available.`);
      risk.nextBestActions.push('Load the payer contract fee schedule for this payer, provider, state, POS, and CPT before relying on patient estimates.');
    } else {
      risk.evidence.push('Used industry payer-type benchmark because fee schedule and charge master allowed amount were unavailable.');
      risk.nextBestActions.push('Load payer contract rates or historical remittance data before relying on patient estimates.');
    }

    if (benefitResponsibility) {
      risk.evidence.push(...benefitResponsibility.evidence);
    } else {
      risk.evidence.push('Patient responsibility estimated from historical payment behavior or payer-type fallback because real-time benefit fields were unavailable.');
    }

    return {
      predictedAllowed,
      predictedPaid,
      predictedPatientResponsibility,
      confidenceScore,
    };
  }

  private assessWorkflowRisk(
    input: PredictionInput,
    context: PredictionContext,
    historical: HistoricalStats | null,
  ): RiskAssessment {
    const riskFactors: string[] = [];
    const evidence: string[] = [];
    const nextBestActions: string[] = [];
    let denialRiskScore = 0.08;
    let eligibilityRiskScore = 0;
    let authorizationRiskScore = 0;
    let confidencePenalty = 0;
    const claimLineCodes = getClaimLineCodes(context);

    if (!context.procedureCode) {
      confidencePenalty += 0.04;
      riskFactors.push(`Procedure code ${input.cptCode} is not configured in procedure code catalog.`);
      nextBestActions.push('Add or validate the procedure code master record so auth/frequency rules can be evaluated consistently.');
    } else {
      evidence.push(`Procedure catalog match: ${context.procedureCode.code} (${context.procedureCode.category}).`);
      if (context.procedureCode.frequencyLimit) {
        evidence.push(`Procedure frequency limit: ${context.procedureCode.frequencyLimit}.`);
      }
    }

    if (!context.insurancePolicy) {
      eligibilityRiskScore += 0.45;
      denialRiskScore += 0.25;
      confidencePenalty += 0.12;
      riskFactors.push('No active insurance policy was found for the claim/patient.');
      nextBestActions.push('Capture or activate insurance before claim submission, or route to patient billing.');
    }

    if (!context.eligibility) {
      eligibilityRiskScore += 0.3;
      denialRiskScore += 0.18;
      confidencePenalty += 0.08;
      riskFactors.push('Eligibility has not been verified for this claim context.');
      nextBestActions.push('Run eligibility verification before submission.');
    } else {
      evidence.push(`Latest eligibility status: ${context.eligibility.eligibilityStatus ?? 'Unknown'} / ${context.eligibility.coverageStatus ?? 'Unknown'}.`);
      if (context.eligibility.planActive === false) {
        eligibilityRiskScore += 0.55;
        denialRiskScore += 0.35;
        nextBestActions.push('Resolve inactive coverage before submitting the claim.');
      }
    }

    const authRequired =
      context.eligibility?.authorizationRequired
      || context.procedureCode?.requiresAuth
      || context.priorAuthorization?.authorizationRequired
      || context.rules?.some((rule) => rule.type === 'auth_required' && codeMatchesRule(rule, input.cptCode));
    const authStatus = normalizeTextLower(context.priorAuthorization?.authorizationStatus);
    const authApproved = Boolean(authStatus && APPROVED_AUTH_STATUSES.has(authStatus) && normalizeText(context.priorAuthorization?.authNumber));

    if (authRequired && !authApproved) {
      authorizationRiskScore += 0.6;
      denialRiskScore += 0.28;
      confidencePenalty += 0.1;
      riskFactors.push(`CPT ${input.cptCode} appears to require authorization, but no approved authorization is linked.`);
      nextBestActions.push('Obtain or link approved prior authorization before submission.');
    } else if (authApproved) {
      evidence.push(`Approved authorization is available: ${context.priorAuthorization.authNumber}.`);
    }

    if (context.eligibility?.referralRequired && !normalizeText(context.referral?.referralNumber)) {
      denialRiskScore += 0.16;
      riskFactors.push('Eligibility indicates a referral is required, but no active referral is linked.');
      nextBestActions.push('Link a valid referral before submission.');
    }

    if (context.codingReview) {
      evidence.push(`Coding review status: ${context.codingReview.scrubStatus ?? 'Unknown'}.`);
      if (context.codingReview.scrubStatus !== 'Passed' && context.codingReview.scrubStatus !== 'Approved') {
        denialRiskScore += 0.25;
        confidencePenalty += 0.08;
        riskFactors.push('Coding review has not passed.');
        nextBestActions.push('Resolve coding review errors and rerun the scrub.');
      }
      if (context.codingReview.validationErrors?.length) {
        riskFactors.push(...context.codingReview.validationErrors.slice(0, 3));
      }
    }

    for (const rule of context.rules ?? []) {
      if (!codeMatchesRule(rule, input.cptCode) && rule.type !== 'invalid_combination') {
        continue;
      }

      const isError = normalizeTextLower(rule.severity) === 'error';
      const riskIncrement = isError ? 0.18 : 0.08;
      const actionPrefix = isError ? 'Resolve blocking rule' : 'Review rule';

      if (rule.type === 'invalid_combination') {
        const ruleCodes = Array.isArray(rule.codes) ? rule.codes : [];
        const allCodesPresent = ruleCodes.length > 1 && ruleCodes.every((code: string) => claimLineCodes.includes(code));

        if (allCodesPresent) {
          denialRiskScore += isError ? 0.28 : 0.12;
          riskFactors.push(rule.message);
          nextBestActions.push(`${actionPrefix}: ${rule.message}`);
          evidence.push(`Rule ${rule.ruleId} matched invalid code combination: ${ruleCodes.join(', ')}.`);
        }
        continue;
      }

      if (rule.type === 'auth_required') {
        evidence.push(`Rule ${rule.ruleId} marks ${input.cptCode} as authorization-sensitive.`);
        continue;
      }

      if (rule.type === 'frequency_limit') {
        denialRiskScore += riskIncrement;
        riskFactors.push(rule.message);
        nextBestActions.push(`${actionPrefix}: verify prior service history for ${input.cptCode}${rule.limit ? ` within ${rule.limit}` : ''}.`);
        evidence.push(`Rule ${rule.ruleId} frequency limit: ${rule.limit ?? 'configured'}.`);
        continue;
      }

      if (rule.type === 'missing_required') {
        const missingFields = (rule.requiredFields ?? [])
          .filter((field: string) => !hasRequiredWorkflowField(field, context));

        if (missingFields.length) {
          denialRiskScore += isError ? 0.24 : 0.1;
          confidencePenalty += isError ? 0.06 : 0.03;
          riskFactors.push(`${rule.message}. Missing: ${missingFields.join(', ')}.`);
          nextBestActions.push(`${actionPrefix}: attach or complete ${missingFields.join(', ')}.`);
          evidence.push(`Rule ${rule.ruleId} requires ${missingFields.join(', ')}.`);
        }
      }
    }

    if (!context.facility?.npi || !context.facility?.taxId) {
      denialRiskScore += 0.18;
      riskFactors.push('Billing facility NPI or tax ID is missing.');
      nextBestActions.push('Complete facility NPI and tax ID setup.');
    }

    if (context.latestSubmission) {
      evidence.push(`Submission status: ${context.latestSubmission.transmissionStatus ?? 'Unknown'} / ${context.latestSubmission.acknowledgementStatus ?? 'Unknown'}.`);
      if (context.latestSubmission.submissionErrorCode || context.latestSubmission.submissionErrorMessage) {
        denialRiskScore += 0.3;
        riskFactors.push(context.latestSubmission.submissionErrorMessage ?? 'Submission contains clearinghouse error.');
        nextBestActions.push('Correct submission error and resubmit the claim.');
      }
    }

    if (context.latestTracking) {
      evidence.push(`Latest tracking status: ${context.latestTracking.statusDescription ?? context.latestTracking.statusCode ?? 'Unknown'}.`);
      if (hasBlockingTrackingStatus(context)) {
        denialRiskScore += 0.35;
        riskFactors.push(context.latestTracking.nextActionRequired ?? 'Claim tracking indicates rejection or payer exception.');
        nextBestActions.push('Work the tracking exception and create corrected claim if needed.');
      }
    }

    if (context.latestDenial && !context.latestDenial.resolutionDate) {
      denialRiskScore += 0.45;
      confidencePenalty += 0.08;
      riskFactors.push(context.latestDenial.denialReason ?? 'An unresolved denial exists for this claim.');
      nextBestActions.push('Resolve denial root cause before expecting payment.');
    }

    if (historical?.count) {
      evidence.push(`Historical payer/CPT payments found: ${historical.count}.`);
      if (historical.avgDenied > 0) {
        denialRiskScore += 0.08;
        riskFactors.push('Historical payments for this payer/CPT include denied amounts.');
      }
    }

    if (!riskFactors.length) {
      nextBestActions.push('Claim is prediction-ready; continue normal submission or follow-up workflow.');
    }

    denialRiskScore = clamp(denialRiskScore);
    eligibilityRiskScore = clamp(eligibilityRiskScore);
    authorizationRiskScore = clamp(authorizationRiskScore);
    const combinedRisk = Math.max(denialRiskScore, eligibilityRiskScore, authorizationRiskScore);

    return {
      denialRiskScore,
      eligibilityRiskScore,
      authorizationRiskScore,
      paymentVarianceScore: 0,
      riskLevel: buildRiskLevel(combinedRisk),
      workflowStage: getWorkflowStage(context),
      riskFactors: Array.from(new Set(riskFactors)),
      evidence: Array.from(new Set(evidence)),
      nextBestActions: Array.from(new Set(nextBestActions)),
      confidencePenalty,
    };
  }

  private async getAiRiskSignal(
    input: PredictionInput,
    context: PredictionContext,
    risk: RiskAssessment,
  ) {
    const payerId = normalizeText(input.payerId);
    if (!payerId) {
      return null;
    }

    try {
      const response = await rcmAiService.predictDenial(
        {
          claimId: input.claimId,
          payerId,
          memberId: context.insurancePolicy?.memberId,
          billingProviderNpi: context.facility?.npi,
          diagnosisCodes: context.claim?.diagnosisCodes ?? [],
          authorizationRequired: context.eligibility?.authorizationRequired,
          authNumber: context.priorAuthorization?.authNumber,
          referralRequired: context.eligibility?.referralRequired,
          referralNumber: context.referral?.referralNumber,
          claimDate: context.claim?.claimDate,
          claimLines: [
            {
              cptCode: input.cptCode,
              units: input.units ?? context.line?.units,
              chargeAmount: input.chargeAmount ?? context.line?.chargeAmount,
              placeOfService: context.line?.placeOfService ?? context.facility?.placeOfServiceCode,
            },
          ],
        },
        payerId,
      );

      if (response.status !== 'success') {
        return null;
      }

      return {
        denialRiskScore: response.denialProbability ?? 0,
        riskFactors: Array.isArray(response.potentialRejectionReasons) ? response.potentialRejectionReasons : [],
        nextBestActions: Array.isArray(response.recommendedActions) ? response.recommendedActions : [],
        evidence: [`Agentic denial prediction probability: ${Math.round((response.denialProbability ?? 0) * 100)}%.`],
      };
    } catch (error) {
      void risk;
      return null;
    }
  }

  private calculateHistoricalConfidence(count: number): number {
    if (count >= 100) return 0.95;
    if (count >= 50) return 0.88;
    if (count >= 20) return 0.78;
    if (count >= 5) return 0.62;
    return 0.45;
  }

  private resolvePredictionSource(
    historical: HistoricalStats | null,
    context: PredictionContext,
    usedAiSignal: boolean,
  ): PredictionSource {
    if (historical && historical.count >= 20 && (context.feeSchedule || context.chargeMaster || usedAiSignal)) {
      return 'hybrid';
    }

    if (historical && historical.count >= 20) {
      return 'historical';
    }

    if (usedAiSignal) {
      return 'ai';
    }

    return 'workflow_rules';
  }

  async list(criteria: any): Promise<{ data: IClaimPrediction[]; total: number }> {
    const filter = { ...criteria.filter, isDeleted: false };
    const [data, total] = await Promise.all([
      ClaimPrediction.list({ ...criteria, filter }),
      ClaimPrediction.totalCount({ filter }),
    ]);
    return { data, total };
  }
}

export const claimPredictionService = new ClaimPredictionService();

export const claimPredictionServiceTestUtils = {
  createBenefitResponsibilityAccumulator,
  calculateBenefitResponsibility,
};
