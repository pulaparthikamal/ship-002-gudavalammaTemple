import 'dotenv/config';
import mongoose from 'mongoose';
import { EraEobProcessing } from '../modules/rcm/era-eob-processing/era-eob-processing.model';
import { PaymentPosting } from '../modules/rcm/payment-posting/payment-posting.model';
import { Claim } from '../modules/rcm/claim/claim.model';
import { PatientBilling } from '../modules/rcm/patient-billing/patient-billing.model';
import { Denial } from '../modules/rcm/denial/denial.model';
import { ArWorkItem } from '../modules/rcm/ar-work-item/ar-work-item.model';
import { Adjustment } from '../modules/rcm/adjustment/adjustment.model';

type VerificationIssue = {
  severity: 'ERROR' | 'WARNING';
  entity: string;
  entityId?: string;
  message: string;
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

function currencyEquals(left: number, right: number, tolerance = 0.01) {
  return Math.abs(roundCurrency(left) - roundCurrency(right)) <= tolerance;
}

function sumPaymentLines(posting: any, field: string) {
  return roundCurrency((posting.paymentLines ?? []).reduce((total: number, line: any) => total + Number(line[field] ?? 0), 0));
}

function expectedClaimPaymentStatus(posting: any) {
  const paidAmount = sumPaymentLines(posting, 'paidAmount');
  const deniedAmount = sumPaymentLines(posting, 'deniedAmount');
  const remainingBalance = roundCurrency(Number(posting.remainingBalance ?? 0));
  const expectedInsurance = sumPaymentLines(posting, 'expectedInsurancePayment');

  if (deniedAmount > 0 && paidAmount <= 0) return 'DENIED';
  if (expectedInsurance > 0 && paidAmount > 0 && paidAmount < expectedInsurance) return 'UNDERPAID';
  if (paidAmount > 0 && remainingBalance <= 0) return 'PAID';
  if (paidAmount > 0) return 'PAYMENT_RECEIVED';
  return 'PAYMENT_POSTING_FAILED';
}

async function loadPaymentPostings() {
  const paymentPostingId = normalizeText(process.env.PAYMENT_POSTING_ID);
  const eraEobProcessingId = normalizeText(process.env.ERA_EOB_PROCESSING_ID);

  if (paymentPostingId) {
    if (!mongoose.Types.ObjectId.isValid(paymentPostingId)) {
      throw new Error('PAYMENT_POSTING_ID must be a valid Mongo ObjectId.');
    }
    const posting = await PaymentPosting.findOne({ _id: paymentPostingId, isDeleted: false });
    return posting ? [posting] : [];
  }

  if (eraEobProcessingId) {
    if (!mongoose.Types.ObjectId.isValid(eraEobProcessingId)) {
      throw new Error('ERA_EOB_PROCESSING_ID must be a valid Mongo ObjectId.');
    }
    return PaymentPosting.find({ eraEobProcessingId, isDeleted: false }).sort({ created: 1 });
  }

  const latestEra = await EraEobProcessing.findOne({ isDeleted: false }).sort({ created: -1 });
  if (!latestEra) return [];

  return PaymentPosting.find({ eraEobProcessingId: latestEra._id, isDeleted: false }).sort({ created: 1 });
}

async function verifyPosting(posting: any) {
  const issues: VerificationIssue[] = [];
  const claim = posting.claimId ? await Claim.findOne({ _id: posting.claimId, isDeleted: false }) : null;
  const patientBillings = await PatientBilling.find({ paymentPostingId: posting._id, isDeleted: false });
  const denials = await Denial.find({ paymentPostingId: posting._id, isDeleted: false });
  const arWorkItems = await ArWorkItem.find({ paymentPostingId: posting._id, isDeleted: false });
  const adjustments = await Adjustment.find({ paymentPostingId: posting._id, isDeleted: false });

  const paidAmount = sumPaymentLines(posting, 'paidAmount');
  const adjustmentAmount = sumPaymentLines(posting, 'adjustmentAmount');
  const patientResponsibilityAmount = sumPaymentLines(posting, 'patientRespAmount');
  const deniedAmount = sumPaymentLines(posting, 'deniedAmount');
  const expectedInsuranceAmount = sumPaymentLines(posting, 'expectedInsurancePayment');
  const remainingBalance = roundCurrency(Number(posting.remainingBalance ?? 0));
  const expectedStatus = expectedClaimPaymentStatus(posting);
  const requiresPatientBilling = patientResponsibilityAmount > 0;
  const requiresDenial = deniedAmount > 0;
  const requiresArWork = requiresDenial || (expectedInsuranceAmount > 0 && paidAmount < expectedInsuranceAmount);

  if (!claim) {
    issues.push({
      severity: 'ERROR',
      entity: 'PaymentPosting',
      entityId: String(posting._id),
      message: 'Payment posting is not linked to an active claim.',
    });
  } else if (claim.paymentStatus !== expectedStatus) {
    issues.push({
      severity: 'ERROR',
      entity: 'Claim',
      entityId: String(claim._id),
      message: `Claim paymentStatus is ${claim.paymentStatus ?? 'empty'} but expected ${expectedStatus}.`,
    });
  }

  if (!posting.paymentLines?.length) {
    issues.push({
      severity: 'ERROR',
      entity: 'PaymentPosting',
      entityId: String(posting._id),
      message: 'Payment posting has no payment lines.',
    });
  }

  if (!currencyEquals(Number(posting.postedAmount ?? 0), paidAmount)) {
    issues.push({
      severity: 'ERROR',
      entity: 'PaymentPosting',
      entityId: String(posting._id),
      message: `postedAmount ${posting.postedAmount ?? 0} does not equal line paid total ${paidAmount}.`,
    });
  }

  if (!currencyEquals(Number(posting.patientResponsibilityAmount ?? 0), patientResponsibilityAmount)) {
    issues.push({
      severity: 'ERROR',
      entity: 'PaymentPosting',
      entityId: String(posting._id),
      message: `patientResponsibilityAmount ${posting.patientResponsibilityAmount ?? 0} does not equal line PR total ${patientResponsibilityAmount}.`,
    });
  }

  if (requiresPatientBilling && !patientBillings.length) {
    issues.push({
      severity: 'ERROR',
      entity: 'PatientBilling',
      message: 'Patient responsibility exists, but no patient billing record was created.',
    });
  }

  if (!requiresPatientBilling && patientBillings.length) {
    issues.push({
      severity: 'WARNING',
      entity: 'PatientBilling',
      message: 'Patient billing exists even though patient responsibility is zero.',
    });
  }

  if (requiresDenial && !denials.length) {
    issues.push({
      severity: 'ERROR',
      entity: 'Denial',
      message: 'Denied amount exists, but no denial record was created.',
    });
  }

  if (!requiresDenial && denials.length) {
    issues.push({
      severity: 'WARNING',
      entity: 'Denial',
      message: 'Denial records exist even though denied amount is zero.',
    });
  }

  if (requiresArWork && !arWorkItems.length) {
    issues.push({
      severity: 'ERROR',
      entity: 'ArWorkItem',
      message: 'AR follow-up is expected, but no AR work item was created.',
    });
  }

  if (!requiresArWork && arWorkItems.length) {
    issues.push({
      severity: 'WARNING',
      entity: 'ArWorkItem',
      message: 'AR work items exist even though no denial or underpayment is expected.',
    });
  }

  return {
    paymentPosting: {
      id: String(posting._id),
      claimId: String(posting.claimId ?? ''),
      postingStatus: posting.postingStatus,
      postedAmount: posting.postedAmount,
      linePaidAmount: paidAmount,
      adjustmentAmount,
      patientResponsibilityAmount,
      deniedAmount,
      expectedInsuranceAmount,
      remainingBalance,
      paymentLineCount: posting.paymentLines?.length ?? 0,
    },
    claim: claim ? {
      id: String(claim._id),
      paymentStatus: claim.paymentStatus,
      expectedPaymentStatus: expectedStatus,
    } : null,
    downstream: {
      patientBilling: {
        expected: requiresPatientBilling,
        count: patientBillings.length,
        ids: patientBillings.map((item) => String(item._id)),
      },
      denial: {
        expected: requiresDenial,
        count: denials.length,
        ids: denials.map((item) => String(item._id)),
      },
      arWorkItem: {
        expected: requiresArWork,
        count: arWorkItems.length,
        ids: arWorkItems.map((item) => String(item._id)),
      },
      adjustment: {
        count: adjustments.length,
        ids: adjustments.map((item) => String(item._id)),
      },
    },
    issues,
  };
}

async function main() {
  const mongoUri = getMongoUri();
  if (!mongoUri) {
    throw new Error('MONGO_URI or MONGODB_URI is required to verify payment posting outcomes.');
  }

  await mongoose.connect(mongoUri);
  const postings = await loadPaymentPostings();
  if (!postings.length) {
    throw new Error('No payment postings were found for the provided PAYMENT_POSTING_ID, ERA_EOB_PROCESSING_ID, or latest ERA.');
  }

  const postingResults = [];
  for (const posting of postings) {
    postingResults.push(await verifyPosting(posting));
  }

  const issues = postingResults.flatMap((result) => result.issues);
  const errorCount = issues.filter((issue) => issue.severity === 'ERROR').length;
  const warningCount = issues.filter((issue) => issue.severity === 'WARNING').length;

  console.log(JSON.stringify({
    verified: errorCount === 0,
    paymentPostingCount: postings.length,
    errorCount,
    warningCount,
    results: postingResults,
  }, null, 2));

  if (errorCount > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('Payment posting outcome verification failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
