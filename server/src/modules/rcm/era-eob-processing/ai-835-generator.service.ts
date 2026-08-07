import { Claim } from '../claim/claim.model';
import { ClaimSubmission } from '../claim-submission/claim-submission.model';
import { AppError } from '../../../utils/error.util';
import { logger } from '../../../utils/logger.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function positiveAmount(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount > 0 ? roundCurrency(amount) : 0;
}

function formatAmount(value: number) {
  return roundCurrency(value).toFixed(2).replace(/\.00$/, '');
}

function toX12Date(value: unknown, fallback: string) {
  if (!value) {
    return fallback;
  }

  const dateValue = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(dateValue.getTime())) {
    return fallback;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.RCM_X12_DATE_TIME_ZONE || 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(dateValue);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return year && month && day ? `${year}${month}${day}` : fallback;
}

function currentX12Date() {
  return toX12Date(new Date(), new Date().toISOString().slice(0, 10).replace(/-/g, ''));
}

function currentX12Time() {
  const date = new Date();
  return `${String(date.getUTCHours()).padStart(2, '0')}${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

function segmentCount(segments: string[], transactionSetControlNumber: string) {
  const stIndex = segments.findIndex((segment) => segment.startsWith(`ST*835*${transactionSetControlNumber}`));
  if (stIndex < 0) {
    return 0;
  }
  return segments.length - stIndex + 1;
}

function buildPatientResponsibilityAdjustments(line: any) {
  const adjustments: string[] = [];
  const deductible = positiveAmount(line.deductibleAppliedAmount);
  const coinsurance = positiveAmount(line.patientCoinsuranceAmount);
  const copay = positiveAmount(line.patientCopayAmount);
  const explicitPatientResponsibility = positiveAmount(line.expectedPatientResponsibility);
  const componentTotal = roundCurrency(deductible + coinsurance + copay);
  const remainingPatientResponsibility = roundCurrency(Math.max(0, explicitPatientResponsibility - componentTotal));

  if (deductible > 0) adjustments.push(`CAS*PR*1*${formatAmount(deductible)}`);
  if (coinsurance > 0) adjustments.push(`CAS*PR*2*${formatAmount(coinsurance)}`);
  if (copay > 0) adjustments.push(`CAS*PR*3*${formatAmount(copay)}`);
  if (remainingPatientResponsibility > 0) adjustments.push(`CAS*PR*1*${formatAmount(remainingPatientResponsibility)}`);

  return adjustments;
}

function generateLocal835(
  claim: any,
  submission: any,
  scenario: 'full' | 'denied' | 'corrected'
): string {
  const controlNumber = submission.controlNumber || submission.claimControlNumber || 'CTRL-MOCK';
  const payerName = claim.clearingHouse || 'Aetna Insurance Company';
  const payerClaimNumber = `PAYER-${controlNumber}`;
  const todayStr = currentX12Date();
  const time = currentX12Time();
  const scenarioToken = scenario === 'corrected' ? 'REPROCESS' : scenario.toUpperCase();
  const transactionSetControlNumber = scenario === 'full' ? '0001' : scenario === 'denied' ? '0002' : '0003';
  const groupControlNumber = `${Date.now().toString().slice(-7)}${scenario === 'full' ? '1' : scenario === 'denied' ? '2' : '3'}`.slice(-9);
  const isaControlNumber = groupControlNumber.padStart(9, '0').slice(-9);
  const traceNumber = `TRACE-${scenarioToken}-${controlNumber}-${Date.now().toString().slice(-6)}`;

  let totalBilled = 0;
  let totalPaid = 0;
  let totalPatientResp = 0;

  const linesSegments: string[] = [];

  claim.claimLines.forEach((line: any) => {
    const lineId = String(line._id);
    const cpt = line.cptCode || '99213';
    const billed = roundCurrency(Number(line.chargeAmount ?? 150));
    totalBilled += billed;

    let paid = 0;
    let allowed = 0;
    const adjustments: string[] = [];

    const lineDate = toX12Date(line.serviceDateFrom ?? line.serviceDateTo ?? claim.claimDate, todayStr);

    let patientResp = 0;

    if (scenario === 'full' || scenario === 'corrected') {
      const expectedInsurancePayment = Number(line.expectedInsurancePayment);
      const expectedAllowedAmount = Number(line.expectedAllowedAmount);
      const expectedPatientResponsibility = Number(line.expectedPatientResponsibility);

      patientResp = Number.isFinite(expectedPatientResponsibility) && expectedPatientResponsibility > 0
        ? roundCurrency(Math.min(expectedPatientResponsibility, billed))
        : 0;
      paid = roundCurrency(Math.max(
        0,
        Math.min(
          billed - patientResp,
          Number.isFinite(expectedInsurancePayment) && expectedInsurancePayment > 0
            ? expectedInsurancePayment
            : Number.isFinite(expectedAllowedAmount) && expectedAllowedAmount > 0
              ? Math.max(0, expectedAllowedAmount - patientResp)
              : billed - patientResp,
        ),
      ));
      allowed = Number.isFinite(expectedAllowedAmount) && expectedAllowedAmount > 0
        ? roundCurrency(expectedAllowedAmount)
        : roundCurrency(paid + patientResp);

      const writeoff = roundCurrency(billed - paid - patientResp);
      if (writeoff > 0) {
        adjustments.push(`CAS*CO*45*${formatAmount(writeoff)}`);
      }
      adjustments.push(...buildPatientResponsibilityAdjustments(line));
    } else if (scenario === 'denied') {
      paid = 0;
      allowed = 0;
      adjustments.push(`CAS*CO*50*${formatAmount(billed)}`);
    }

    totalPaid += paid;
    totalPatientResp += patientResp;

    linesSegments.push(`SVC*HC:${cpt}*${formatAmount(billed)}*${formatAmount(paid)}`);

    adjustments.forEach(adj => {
      linesSegments.push(adj);
    });

    linesSegments.push(`REF*6R*${lineId}`);
    linesSegments.push(`DTM*472*${lineDate}`);
    linesSegments.push(`AMT*B6*${formatAmount(allowed)}`);
  });

  totalBilled = roundCurrency(totalBilled);
  totalPaid = roundCurrency(totalPaid);
  totalPatientResp = roundCurrency(totalPatientResp);

  const claimStatusCode = scenario === 'denied' ? '4' : '1';

  const segments = [
    `ISA*00*          *00*          *ZZ*AETNA          *ZZ*RCMTEST        *${todayStr.slice(2)}*${time}*^*00501*${isaControlNumber}*0*T*:`,
    `GS*HP*AETNA*RCMTEST*${todayStr}*${time}*${groupControlNumber}*X*005010X221A1`,
    `ST*835*${transactionSetControlNumber}`,
    `BPR*I*${formatAmount(totalPaid)}*C*CHK************${todayStr}`,
    `TRN*1*${traceNumber}*1999999999`,
    `N1*PR*${payerName}`,
    `N1*PE*PROVIDER MEDICAL`,
    `CLP*${controlNumber}*${claimStatusCode}*${formatAmount(totalBilled)}*${formatAmount(totalPaid)}*${formatAmount(totalPatientResp)}*12*${payerClaimNumber}*11*1`,
    ...linesSegments,
  ];

  const seCount = segmentCount(segments, transactionSetControlNumber);
  segments.push(`SE*${seCount}*${transactionSetControlNumber}`);
  segments.push(`GE*1*${groupControlNumber}`);
  segments.push(`IEA*1*${isaControlNumber}`);

  return `${segments.join('~')}~`;
}

export class Ai835GeneratorService {
  async generateAi835(
    claimId: string,
    claimSubmissionId: string
  ): Promise<{ fullPayment835: string; denialPayment835: string; denialCorrection835: string }> {
    const claim = await Claim.findOne({ _id: claimId, isDeleted: false });
    const submission = await ClaimSubmission.findOne({ _id: claimSubmissionId, isDeleted: false });

    if (!claim) {
      throw new AppError('Claim not found.', HTTP_STATUS.NOT_FOUND);
    }
    if (!submission) {
      throw new AppError('Claim submission not found.', HTTP_STATUS.NOT_FOUND);
    }

    const localResult = {
      fullPayment835: generateLocal835(claim, submission, 'full'),
      denialPayment835: generateLocal835(claim, submission, 'denied'),
      denialCorrection835: generateLocal835(claim, submission, 'corrected'),
    };

    logger.info('Using deterministic claim-based 835 test scenario generation.');
    return localResult;
  }
}

export const ai835GeneratorService = new Ai835GeneratorService();
