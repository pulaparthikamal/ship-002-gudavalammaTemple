import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { Claim, IClaim, IClaimClaimLine } from '../modules/rcm/claim/claim.model';
import { ClaimSubmission, IClaimSubmission } from '../modules/rcm/claim-submission/claim-submission.model';
import { Payer } from '../modules/rcm/payer/payer.model';
import { PaymentPosting } from '../modules/rcm/payment-posting/payment-posting.model';

type Prepared835Scenario = 'paid' | 'patient-responsibility' | 'underpayment' | 'denial';

type PreparedClaimContext = {
  claim: IClaim;
  submission: IClaimSubmission;
  payerName: string;
  controlNumber: string;
  eligibleLines: IClaimClaimLine[];
};

type Prepared835 = {
  scenario: Prepared835Scenario;
  generatedAt: string;
  claimId: string;
  claimSubmissionId: string;
  controlNumber: string;
  payerName: string;
  traceNumber: string;
  totalBilledAmount: number;
  totalPaidAmount: number;
  totalPatientResponsibilityAmount: number;
  outputFile: string;
  raw835Text: string;
};

function getMongoUri() {
  return process.env.MONGO_URI || process.env.MONGODB_URI;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function safeSegmentText(value: unknown, fallback: string) {
  const normalized = normalizeText(value)
    .replace(/[~*:^|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
}

function money(value: number) {
  return roundCurrency(value).toFixed(2).replace(/\.00$/, '');
}

function firstSubmissionControlNumber(submission: IClaimSubmission) {
  return [
    submission.controlNumber,
    submission.claimControlNumber,
    submission.externalSubmissionId,
    submission.clearinghouseTraceNumber,
    submission.submissionTraceId,
    submission.payerClaimNumber,
  ].map(normalizeText).find(Boolean);
}

function lineServiceDate(line: IClaimClaimLine, claim: IClaim) {
  const date = line.serviceDateFrom ?? line.serviceDateTo ?? claim.claimDate ?? new Date();
  return date instanceof Date ? date : new Date(date);
}

function lineChargeAmount(line: IClaimClaimLine) {
  return roundCurrency(Number(line.chargeAmount ?? 0));
}

function lineAllowedAmount(line: IClaimClaimLine) {
  const configuredAllowed = Number(line.expectedAllowedAmount ?? 0);
  return roundCurrency(configuredAllowed > 0 ? configuredAllowed : lineChargeAmount(line));
}

function linePaidAmount(line: IClaimClaimLine, scenario: Prepared835Scenario) {
  const allowedAmount = lineAllowedAmount(line);
  if (scenario === 'denial') return 0;
  if (scenario === 'underpayment') return roundCurrency(Math.max(0, allowedAmount * 0.75));
  if (scenario === 'patient-responsibility') return roundCurrency(Math.max(0, allowedAmount * 0.8));
  return allowedAmount;
}

function linePatientResponsibility(line: IClaimClaimLine, scenario: Prepared835Scenario) {
  if (scenario !== 'patient-responsibility') return 0;
  return roundCurrency(lineAllowedAmount(line) - linePaidAmount(line, scenario));
}

function lineContractualAdjustment(line: IClaimClaimLine, scenario: Prepared835Scenario) {
  const chargeAmount = lineChargeAmount(line);
  const paidAmount = linePaidAmount(line, scenario);
  const patientResponsibility = linePatientResponsibility(line, scenario);
  if (scenario === 'denial') return 0;
  return roundCurrency(Math.max(0, chargeAmount - paidAmount - patientResponsibility));
}

function buildServiceLineSegments(line: IClaimClaimLine, claim: IClaim, scenario: Prepared835Scenario) {
  const procedureCode = safeSegmentText(line.cptCode, 'UNSPECIFIED');
  const billedAmount = lineChargeAmount(line);
  const paidAmount = linePaidAmount(line, scenario);
  const patientResponsibility = linePatientResponsibility(line, scenario);
  const contractualAdjustment = lineContractualAdjustment(line, scenario);
  const serviceDate = formatDate(lineServiceDate(line, claim));
  const serviceLineControlNumber = safeSegmentText(String(line._id ?? ''), String(line.lineNumber ?? '1'));
  const segments = [
    `SVC*HC:${procedureCode}*${money(billedAmount)}*${money(paidAmount)}`,
  ];

  if (contractualAdjustment > 0) {
    segments.push(`CAS*CO*45*${money(contractualAdjustment)}`);
  }

  if (patientResponsibility > 0) {
    segments.push(`CAS*PR*1*${money(patientResponsibility)}`);
  }

  if (scenario === 'denial') {
    segments.push(`CAS*CO*96*${money(billedAmount)}`);
    segments.push('LQ*HE*N130');
  }

  segments.push(`REF*6R*${serviceLineControlNumber}`);
  segments.push(`DTM*472*${serviceDate}`);

  if (scenario !== 'denial') {
    segments.push(`AMT*B6*${money(lineAllowedAmount(line))}`);
  }

  return segments;
}

function build835(context: PreparedClaimContext, scenario: Prepared835Scenario): Prepared835 {
  const generatedAt = new Date();
  const paymentDate = formatDate(generatedAt);
  const traceNumber = `ERA${Date.now().toString(36).toUpperCase()}`;
  const totalBilledAmount = roundCurrency(context.eligibleLines.reduce((total, line) => total + lineChargeAmount(line), 0));
  const totalPaidAmount = roundCurrency(context.eligibleLines.reduce((total, line) => total + linePaidAmount(line, scenario), 0));
  const totalPatientResponsibilityAmount = roundCurrency(
    context.eligibleLines.reduce((total, line) => total + linePatientResponsibility(line, scenario), 0),
  );
  const payerClaimNumber = safeSegmentText(context.submission.payerClaimNumber, `PAYER-${context.controlNumber}`);
  const claimStatusCode = scenario === 'denial' ? '4' : '1';
  const segments = [
    'ISA*00*          *00*          *ZZ*CLEARINGHOUSE   *ZZ*RCMRECEIVER    *260521*1200*^*00501*000000001*0*T*:~',
    'GS*HP*CLEARINGHOUSE*RCMRECEIVER*20260521*1200*1*X*005010X221A1~',
    'ST*835*0001~',
    `BPR*I*${money(totalPaidAmount)}*C*ACH************${paymentDate}~`,
    `TRN*1*${traceNumber}*1999999999~`,
    `N1*PR*${safeSegmentText(context.payerName, 'PAYER')}~`,
    'N1*PE*RCM PAYMENT RECEIVER~',
    `CLP*${safeSegmentText(context.controlNumber, String(context.claim._id))}*${claimStatusCode}*${money(totalBilledAmount)}*${money(totalPaidAmount)}*${money(totalPatientResponsibilityAmount)}*12*${payerClaimNumber}~`,
    ...context.eligibleLines.flatMap((line) => buildServiceLineSegments(line, context.claim, scenario).map((segment) => `${segment}~`)),
    'SE*10*0001~',
    'GE*1*1~',
    'IEA*1*000000001~',
  ];

  return {
    scenario,
    generatedAt: generatedAt.toISOString(),
    claimId: String(context.claim._id),
    claimSubmissionId: String(context.submission._id),
    controlNumber: context.controlNumber,
    payerName: context.payerName,
    traceNumber,
    totalBilledAmount,
    totalPaidAmount,
    totalPatientResponsibilityAmount,
    outputFile: '',
    raw835Text: segments.join(''),
  };
}

async function findPaymentReadyClaim(): Promise<PreparedClaimContext | null> {
  const submissions = await ClaimSubmission.find({
    isDeleted: false,
    claimId: { $exists: true, $ne: null },
    $or: [
      { normalizedStatus: { $in: ['ACCEPTED', 'PENDING', 'SUBMITTED'] } },
      { acknowledgementStatus: /accepted/i },
      { transmissionStatus: /success|submitted|transmitted/i },
    ],
  }).sort({ submissionDateTime: -1, updated: -1 }).limit(100);

  for (const submission of submissions) {
    const controlNumber = firstSubmissionControlNumber(submission);
    if (!controlNumber) continue;

    const existingPosting = await PaymentPosting.findOne({
      claimId: submission.claimId,
      isDeleted: false,
    });
    if (existingPosting) continue;

    const claim = await Claim.findOne({
      _id: submission.claimId,
      isDeleted: false,
      claimStatus: { $in: ['Submitted', 'Ready for Submission'] },
    });
    if (!claim) continue;

    const eligibleLines = (claim.claimLines ?? []).filter((line) =>
      normalizeText(line.cptCode) && lineChargeAmount(line) > 0,
    );
    if (!eligibleLines.length) continue;

    const payer = claim.payerId
      ? await Payer.findOne({
        isDeleted: false,
        $or: [
          { payerId: claim.payerId },
          { _id: mongoose.Types.ObjectId.isValid(claim.payerId) ? claim.payerId : undefined },
        ].filter((item) => Object.values(item)[0]),
      })
      : null;

    return {
      claim,
      submission,
      payerName: safeSegmentText(payer?.payerName ?? claim.payerId, 'PAYER'),
      controlNumber,
      eligibleLines,
    };
  }

  return null;
}

async function main() {
  const mongoUri = getMongoUri();
  const scenario = (process.env.PAYMENT_POSTING_SCENARIO || 'paid').trim().toLowerCase() as Prepared835Scenario;
  const allowedScenarios: Prepared835Scenario[] = ['paid', 'patient-responsibility', 'underpayment', 'denial'];

  if (!mongoUri) {
    throw new Error('MONGO_URI or MONGODB_URI is required to prepare payment posting readiness data.');
  }

  if (!allowedScenarios.includes(scenario)) {
    throw new Error(`PAYMENT_POSTING_SCENARIO must be one of: ${allowedScenarios.join(', ')}.`);
  }

  await mongoose.connect(mongoUri);
  const context = await findPaymentReadyClaim();

  if (!context) {
    console.log(JSON.stringify({
      ready: false,
      message: 'No payment-ready submitted claim was found. Create or submit one claim before preparing an 835.',
      requirements: [
        'ClaimSubmission linked to a claim',
        'Submission control number or external identifier',
        'Claim status Submitted or Ready for Submission',
        'At least one claim line with procedure code and charge amount',
        'No existing payment posting for the claim',
      ],
    }, null, 2));
    return;
  }

  const prepared835 = build835(context, scenario);
  const outputDirectory = path.resolve(process.cwd(), '..', 'scratch');
  fs.mkdirSync(outputDirectory, { recursive: true });
  const outputFile = path.join(outputDirectory, `payment-posting-${prepared835.claimId}-${prepared835.traceNumber}.835`);
  fs.writeFileSync(outputFile, prepared835.raw835Text, 'utf8');
  prepared835.outputFile = outputFile;

  console.log(JSON.stringify({
    ready: true,
    previousStep: {
      claimId: prepared835.claimId,
      claimSubmissionId: prepared835.claimSubmissionId,
      controlNumber: prepared835.controlNumber,
      claimLineCount: context.eligibleLines.length,
      payerName: prepared835.payerName,
      status: 'Payment-ready claim found from existing workflow data.',
    },
    currentStepInput: {
      scenario: prepared835.scenario,
      outputFile: prepared835.outputFile,
      traceNumber: prepared835.traceNumber,
      totalBilledAmount: prepared835.totalBilledAmount,
      totalPaidAmount: prepared835.totalPaidAmount,
      totalPatientResponsibilityAmount: prepared835.totalPatientResponsibilityAmount,
      status: 'Matching 835 prepared from real claim/submission identifiers.',
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('Payment posting readiness preparation failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
