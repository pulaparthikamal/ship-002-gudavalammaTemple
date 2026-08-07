export const CLAIM_TYPE_OPTIONS = ['Professional', 'Institutional'] as const;

export const CLAIM_COVERAGE_PRIORITY_OPTIONS = ['Primary', 'Secondary', 'Tertiary'] as const;

export const CLAIM_STATUS_OPTIONS = [
  'Draft',
  'Ready for Submission',
  'Submitted',
  'Rejected',
  'UnderCorrection',
  'Resubmitted',
  'On Hold',
] as const;

export const CLAIM_SCRUB_STATUS_OPTIONS = ['Passed', 'Failed'] as const;

export const CLAIM_SUBMISSION_STATUS_OPTIONS = [
  'Not Submitted',
  'Queued',
  'Submitted',
  'Printed',
  'Transmitted',
  'Acknowledged',
  'Rejected',
  'Failed',
] as const;

export const CLAIM_PAYMENT_STATUS_OPTIONS = [
  'PAYMENT_RECEIVED',
  'PARTIALLY_PAID',
  'PAID',
  'PATIENT_RESPONSIBILITY',
  'DENIED',
  'UNDERPAID',
  'PAYMENT_POSTING_FAILED',
] as const;

export const CLAIM_CLOSURE_STATUS_OPTIONS = [
  'OPEN',
  'IN_PROGRESS',
  'AWAITING_ERA',
  'ERA_DELAYED',
  'FOLLOW_UP_REQUIRED',
  'PARTIALLY_PAID',
  'DENIED',
  'RESOLVED',
  'READY_TO_CLOSE',
  'CLOSED',
  'REOPENED',
] as const;
