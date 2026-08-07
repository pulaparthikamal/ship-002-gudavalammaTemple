import { Claim } from '../claim/claim.model';
import { ClaimSubmission } from '../claim-submission/claim-submission.model';
import { AppError } from '../../../utils/error.util';
import { logger } from '../../../utils/logger.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

export type GeneratedX12Acknowledgements = {
  accepted999Ack: string;
  accepted277Ack: string;
  rejected277Ack: string;
  acceptedAck: string;
  rejectedAck: string;
};

function pad(value: string, length: number) {
  return value.padEnd(length, ' ').slice(0, length);
}

function currentX12Date() {
  const date = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.RCM_X12_DATE_TIME_ZONE || 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return year && month && day ? `${year}${month}${day}` : date.toISOString().slice(0, 10).replace(/-/g, '');
}

function currentX12Time() {
  const date = new Date();
  return `${String(date.getUTCHours()).padStart(2, '0')}${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

function formatAmount(value: unknown) {
  const amount = Number(value ?? 0);
  return (Number.isFinite(amount) ? amount : 0).toFixed(2).replace(/\.00$/, '');
}

function normalizeText(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function segmentCount(segments: string[], transactionSet: string, controlNumber: string) {
  const stIndex = segments.findIndex((segment) => segment.startsWith(`ST*${transactionSet}*${controlNumber}`));
  if (stIndex < 0) return 0;
  return segments.length - stIndex + 1;
}

function makeControl(seed: string, suffix: string) {
  const digits = seed.replace(/\D/g, '');
  return `${digits.slice(-7).padStart(7, '0')}${suffix}`.slice(-9);
}

function build999Ack(claim: any, submission: any) {
  const date = currentX12Date();
  const time = currentX12Time();
  const controlNumber = normalizeText(submission.controlNumber || submission.claimControlNumber, String(claim._id).slice(-12).toUpperCase());
  const groupControlNumber = makeControl(controlNumber, '91');
  const isaControlNumber = groupControlNumber.padStart(9, '0');
  const stControlNumber = '9001';
  const sourceGroupControl = normalizeText(submission.batchId, '1').replace(/\D/g, '').slice(-9) || '1';
  const sourceTransactionControl = normalizeText(String(submission.payloadSnapshot ?? '').match(/ST\*837\*([^*~]+)/)?.[1], controlNumber);
  const segments = [
    `ISA*00*${pad('', 10)}*00*${pad('', 10)}*ZZ*${pad('STEDI', 15)}*ZZ*${pad('RCMTEST', 15)}*${date.slice(2)}*${time}*^*00501*${isaControlNumber}*0*T*:`,
    `GS*FA*STEDI*RCMTEST*${date}*${time}*${groupControlNumber}*X*005010X231A1`,
    `ST*999*${stControlNumber}*005010X231A1`,
    `AK1*HC*${sourceGroupControl}*005010X222A1`,
    `AK2*837*${sourceTransactionControl}*005010X222A1`,
    'IK5*A',
    'AK9*A*1*1*1',
  ];
  segments.push(`SE*${segmentCount(segments, '999', stControlNumber)}*${stControlNumber}`);
  segments.push(`GE*1*${groupControlNumber}`);
  segments.push(`IEA*1*${isaControlNumber}`);
  return `${segments.join('~')}~`;
}

function build277Ack(claim: any, submission: any, scenario: 'accepted' | 'rejected') {
  const date = currentX12Date();
  const time = currentX12Time();
  const controlNumber = normalizeText(submission.controlNumber || submission.claimControlNumber, String(claim._id).slice(-12).toUpperCase());
  const submissionTraceId = normalizeText(submission.submissionTraceId, controlNumber);
  const payerId = normalizeText(claim.payerId, '60054');
  const payerName = 'Aetna Insurance Company';
  const totalBilled = formatAmount(claim.totalChargeAmount || claim.claimLines?.reduce((sum: number, line: any) => sum + Number(line.chargeAmount ?? 0), 0));
  const stControlNumber = scenario === 'accepted' ? '2771' : '2772';
  const groupControlNumber = makeControl(controlNumber, scenario === 'accepted' ? '71' : '72');
  const isaControlNumber = groupControlNumber.padStart(9, '0');
  const stcCode = scenario === 'accepted' ? 'A1:19:PR' : 'A3:50:85';
  const statusText = scenario === 'accepted' ? 'accepted for adjudication' : 'rejected for medical documentation review';
  const firstLineId = claim.claimLines?.[0]?._id ? String(claim.claimLines[0]._id) : 'LINE-1';
  const segments = [
    `ISA*00*${pad('', 10)}*00*${pad('', 10)}*ZZ*${pad('STEDI', 15)}*ZZ*${pad('RCMTEST', 15)}*${date.slice(2)}*${time}*^*00501*${isaControlNumber}*0*T*:`,
    `GS*HN*STEDI*RCMTEST*${date}*${time}*${groupControlNumber}*X*005010X214`,
    `ST*277*${stControlNumber}*005010X214`,
    `BHT*0085*08*${controlNumber}*${date}*${time}*TH`,
    'HL*1**20*1',
    `NM1*PR*2*${payerName}*****PI*${payerId}`,
    `TRN*1*${submissionTraceId}`,
    'HL*2*1*21*1',
    'NM1*41*2*Realtime RCM Test Submitter*****46*RCMAPP',
    `TRN*2*${controlNumber}`,
    'HL*3*2*19*1',
    'NM1*1P*1*PROVIDER*MEDICAL****XX*1999999984',
    `TRN*1*${controlNumber}`,
    'HL*4*3*22*0',
    `TRN*2*${controlNumber}`,
    `STC*${stcCode}*${date}*WQ*${totalBilled}`,
    `REF*EJ*${controlNumber}`,
    `REF*1K*${scenario === 'accepted' ? `AETNA-CLM-${controlNumber}` : `AETNA-REJ-${controlNumber}`}`,
    `REF*6R*${firstLineId}`,
    `DTP*472*D8*${date}`,
    `MSG*Claim ${statusText}.`,
  ];
  segments.push(`SE*${segmentCount(segments, '277', stControlNumber)}*${stControlNumber}`);
  segments.push(`GE*1*${groupControlNumber}`);
  segments.push(`IEA*1*${isaControlNumber}`);
  return `${segments.join('~')}~`;
}

export class AiX12AckGeneratorService {
  async generateX12Ack(
    claimId: string,
    claimSubmissionId: string,
  ): Promise<GeneratedX12Acknowledgements> {
    const claim = await Claim.findOne({ _id: claimId, isDeleted: false });
    const submission = await ClaimSubmission.findOne({ _id: claimSubmissionId, isDeleted: false });

    if (!claim) {
      throw new AppError('Claim not found.', HTTP_STATUS.NOT_FOUND);
    }
    if (!submission) {
      throw new AppError('Claim submission not found.', HTTP_STATUS.NOT_FOUND);
    }

    const accepted999Ack = build999Ack(claim, submission);
    const accepted277Ack = build277Ack(claim, submission, 'accepted');
    const rejected277Ack = build277Ack(claim, submission, 'rejected');

    logger.info('Using deterministic claim-based X12 acknowledgement test scenario generation.');
    return {
      accepted999Ack,
      accepted277Ack,
      rejected277Ack,
      acceptedAck: accepted277Ack,
      rejectedAck: rejected277Ack,
    };
  }
}

export const aiX12AckGeneratorService = new AiX12AckGeneratorService();
